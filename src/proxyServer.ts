/**
 * @file proxyServer.ts
 * @description This file contains the ProxyServer class, which is used to start and stop the proxy server.
 * @author Felipe Acuña
 * @version 1.0.0
 * @since 2025-05-17
 * 
 * console.log are keep as they are for debugging purposes, and won't be shown to the user.
 * Only vscode.window.showInformationMessage and vscode.window.showErrorMessage are shown to the user.
 * 
 * Server is created using http.createServer, and proxy is created using http-proxy.
 * All requests are forwarded to the destination URL (POST, GET, etc.), and the response is returned to the client.
 * 
 * Token rotation is implemented, and the token is rotated every tokenRotationMinutes minutes.
 * If the token command is empty, authentication is disabled.
 * Only Bearer token is supported.
 * Token is stored in the class, and is used to authenticate requests to the destination URL.
 */

import * as http from 'http';
import * as https from 'https';
import { execSync } from 'child_process';
import * as vscode from 'vscode';

// Import http-proxy without type checking to avoid type issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const httpProxy = require('http-proxy');

export class ProxyServer {
  private server: http.Server | null = null;
  private proxy: any = null;
  private token: string = '';
  private tokenRotationInterval: NodeJS.Timeout | null = null;
  private shouldUseAuthentication: boolean = false;
  
  constructor() {}

  /**
   * Check if the proxy server is running
   */
  public isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Start the proxy server
   */
  public async start(): Promise<boolean> {
    if (this.server) {
      vscode.window.showInformationMessage('Proxy server is already running');
      return false;
    }

    const config = vscode.workspace.getConfiguration('proxyExtension');
    const destination = config.get<string>('destination');
    const tokenCommand = config.get<string>('tokenCommand') || '';
    const proxyPort = config.get<number>('proxyPort') || 123456;
    const tokenRotationMinutes = config.get<number>('tokenRotationMinutes') || 60;

    // Determine if we should use authentication based on token command
    this.shouldUseAuthentication = tokenCommand.trim() !== '';
    
    if (!destination) {
      vscode.window.showErrorMessage('Destination URL is not set');
      return false;
    }

    try {
      // Initialize the token if we should use authentication
      if (this.shouldUseAuthentication) {
        await this.rotateToken();
      } else {
        console.log('Token command is empty. Authentication is disabled.');
        vscode.window.showInformationMessage('Token command is empty. Authentication is disabled.');
      }
      
      // Create the server with direct request handling
      this.server = http.createServer(async (req, res) => {
        console.log(`Received request for: ${req.url}`);
        
        try {
          const url = new URL(destination);
          const isHttps = url.protocol === 'https:';
          const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: req.url,
            method: req.method,
            headers: { ...req.headers },
            timeout: 30000, // 30 second timeout
            keepAlive: true,
            keepAliveMsecs: 1000,
            maxSockets: 50,
            rejectUnauthorized: false // Don't verify SSL certificates
          };

          // Add authorization header if needed
          if (this.shouldUseAuthentication && this.token && this.token.trim() !== '') {
            const sanitizedToken = this.token.trim().replace(/[\r\n\s]+/g, '');
            options.headers['Authorization'] = `Bearer ${sanitizedToken}`;
            console.log(sanitizedToken)
          }

          // Remove problematic headers
          delete options.headers['host'];
          delete options.headers['connection'];
          delete options.headers['proxy-connection'];

          console.log('Making proxy request with options:', {
            hostname: options.hostname,
            port: options.port,
            path: options.path,
            method: options.method,
            protocol: isHttps ? 'https' : 'http'
          });

          const requestFn = isHttps ? https.request : http.request;
          const proxyReq = requestFn(options, (proxyRes) => {
            console.log(`Received response with status: ${proxyRes.statusCode}`);
            
            // Handle redirects
            if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302) {
              const location = proxyRes.headers.location;
              if (location) {
                console.log(`Redirecting to: ${location}`);
                res.writeHead(proxyRes.statusCode, { 'Location': location });
                res.end();
                return;
              }
            }

            // Copy response headers
            const responseHeaders = { ...proxyRes.headers };
            delete responseHeaders['connection'];
            delete responseHeaders['proxy-connection'];
            
            res.writeHead(proxyRes.statusCode || 500, responseHeaders);
            
            // Handle response streaming
            proxyRes.on('error', (err) => {
              console.error('Error streaming response:', err);
              if (!res.headersSent) {
                res.writeHead(500);
                res.end('Error streaming response');
              }
            });

            proxyRes.pipe(res);
          });

          // Set up request timeout
          proxyReq.setTimeout(30000, () => {
            console.error('Request timeout');
            proxyReq.destroy();
            if (!res.headersSent) {
              res.writeHead(504);
              res.end('Gateway Timeout');
            }
          });

          // Handle request errors
          proxyReq.on('error', (err) => {
            console.error('Proxy request error:', err);
            if (!res.headersSent) {
              res.writeHead(502);
              res.end(`Proxy request failed: ${err.message}`);
            }
          });

          // Handle client disconnect
          req.on('close', () => {
            console.log('Client disconnected');
            proxyReq.destroy();
          });

          // Handle request body
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            req.pipe(proxyReq);
          } else {
            proxyReq.end();
          }
        } catch (error) {
          console.error('Error handling request:', error);
          if (!res.headersSent) {
            res.writeHead(500);
            res.end('Internal server error');
          }
        }
      });

      // Start the server
      return new Promise((resolve) => {
        if (this.server) {
          this.server.listen(proxyPort, () => {
            const authStatus = this.shouldUseAuthentication ? 'enabled' : 'disabled';
            const message = `Proxy server started on port ${proxyPort}, forwarding to ${destination} (authentication ${authStatus})`;
            console.log(message);
            vscode.window.showInformationMessage(message);
            
            // Set up token rotation only if authentication is enabled
            if (this.shouldUseAuthentication) {
              this.tokenRotationInterval = setInterval(
                () => this.rotateToken(),
                tokenRotationMinutes * 60 * 1000
              );
            }
            
            resolve(true);
          });
        } else {
          resolve(false);
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to start proxy server:', error);
      vscode.window.showErrorMessage(`Failed to start proxy server: ${message}`);
      return false;
    }
  }

  /**
   * Stop the proxy server
   */
  public stop(): boolean {
    if (!this.server) {
      vscode.window.showInformationMessage('Proxy server is not running');
      return false;
    }

    try {
      // Clear the token rotation interval
      if (this.tokenRotationInterval) {
        clearInterval(this.tokenRotationInterval);
        this.tokenRotationInterval = null;
      }

      // Close the proxy and server
      if (this.proxy) {
        this.proxy.close();
      }
      
      this.server.close();
      this.server = null;
      this.proxy = null;
      this.shouldUseAuthentication = false;
      
      vscode.window.showInformationMessage('Proxy server stopped');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to stop proxy server: ${message}`);
      return false;
    }
  }

  /**
   * Execute the token command and update the token
   */
  private async rotateToken(): Promise<void> {
    if (!this.shouldUseAuthentication) {
      console.log('Token rotation skipped: Authentication is disabled');
      return;
    }

    try {
      const config = vscode.workspace.getConfiguration('proxyExtension');
      const tokenCommand = config.get<string>('tokenCommand');
      
      if (!tokenCommand || tokenCommand.trim() === '') {
        this.shouldUseAuthentication = false;
        this.token = '';
        console.log('Token command is empty. Authentication is disabled.');
        vscode.window.showWarningMessage('Token command is empty. Authentication is disabled.');
        return;
      }

      // Execute the command to get the token
      console.log(`Executing token command: ${tokenCommand}`);
      try {
        const result = execSync(tokenCommand, { encoding: 'utf-8', timeout: 60000 }).trim();
        // Sanitize the token by removing any whitespace, newlines, and special characters
        this.token = result.replace(/[\r\n\s]+/g, '');
        console.log('Token rotated successfully');
        vscode.window.showInformationMessage('Token rotated successfully');
      } catch (execError) {
        const message = execError instanceof Error ? execError.message : String(execError);
        console.error('Failed to execute token command:', execError);
        vscode.window.showErrorMessage(`Failed to execute token command: ${message}`);
        // Keep the old token if the command fails
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Token rotation error:', error);
      vscode.window.showErrorMessage(`Failed to rotate token: ${message}`);
    }
  }
} 