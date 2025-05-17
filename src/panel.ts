import * as vscode from 'vscode';
import { ProxyServer } from './proxyServer';

export class ProxyPanel {
  public static currentPanel: ProxyPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _proxyServer: ProxyServer;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, proxyServer: ProxyServer) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._proxyServer = proxyServer;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'startServer':
            await this._proxyServer.start();
            this._update();
            break;
          case 'stopServer':
            this._proxyServer.stop();
            this._update();
            break;
          case 'saveSettings':
            const config = vscode.workspace.getConfiguration('proxyExtension');
            await config.update('destination', message.destination, vscode.ConfigurationTarget.Global);
            await config.update('tokenCommand', message.tokenCommand, vscode.ConfigurationTarget.Global);
            await config.update('proxyPort', parseInt(message.proxyPort), vscode.ConfigurationTarget.Global);
            await config.update('tokenRotationMinutes', parseInt(message.tokenRotationMinutes), vscode.ConfigurationTarget.Global);
            
            // Restart the server if it's running
            const wasRunning = this._proxyServer.isRunning();
            if (wasRunning) {
              this._proxyServer.stop();
              await this._proxyServer.start();
              vscode.window.showInformationMessage('Proxy settings saved and server restarted');
            } else {
              vscode.window.showInformationMessage('Proxy settings saved');
            }
            
            this._update();
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(extensionUri: vscode.Uri, proxyServer: ProxyServer) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (ProxyPanel.currentPanel) {
      ProxyPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      'proxyExtension',
      'Proxy Server Control',
      column || vscode.ViewColumn.One,
      {
        // Enable javascript in the webview
        enableScripts: true,
        // Restrict the webview to only load content from our extension's directory
        localResourceRoots: [extensionUri]
      }
    );

    ProxyPanel.currentPanel = new ProxyPanel(panel, extensionUri, proxyServer);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, proxyServer: ProxyServer) {
    ProxyPanel.currentPanel = new ProxyPanel(panel, extensionUri, proxyServer);
  }

  public dispose() {
    ProxyPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private async _update() {
    const webview = this._panel.webview;
    this._panel.title = "Proxy Server Control";
    this._panel.webview.html = await this._getHtmlForWebview(webview);
  }

  private async _getHtmlForWebview(webview: vscode.Webview) {
    const config = vscode.workspace.getConfiguration('proxyExtension');
    const destination = config.get<string>('destination') || '';
    const tokenCommand = config.get<string>('tokenCommand') || '';
    const proxyPort = config.get<number>('proxyPort') || 8080;
    const tokenRotationMinutes = config.get<number>('tokenRotationMinutes') || 60;
    
    const isRunning = this._proxyServer.isRunning();
    
    // Create the HTML with directly evaluated values rather than template literals
    const statusClass = isRunning ? 'running' : 'stopped';
    const statusText = isRunning ? 'Running' : 'Stopped';
    const portInfo = isRunning ? `<div>Running on port: ${proxyPort}</div>` : '';
    const startButtonDisabled = isRunning ? 'disabled' : '';
    const stopButtonDisabled = !isRunning ? 'disabled' : '';

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Proxy Server Control</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                padding: 20px;
                color: var(--vscode-foreground);
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
            }
            .form-group {
                margin-bottom: 15px;
            }
            label {
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
            }
            input[type="text"], input[type="number"] {
                width: 100%;
                padding: 8px;
                box-sizing: border-box;
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
            }
            .button-container {
                margin-top: 20px;
                display: flex;
                justify-content: space-between;
            }
            button {
                padding: 8px 16px;
                cursor: pointer;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                min-width: 120px;
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .status {
                margin-bottom: 20px;
                padding: 10px;
                border-radius: 4px;
            }
            .running {
                background-color: var(--vscode-notificationsInfoBackground);
                color: var(--vscode-notificationsInfoForeground);
            }
            .stopped {
                background-color: var(--vscode-editorInfo-background);
                color: var(--vscode-editorInfo-foreground);
            }
            h1 {
                margin-bottom: 20px;
            }
            .section {
                margin-bottom: 30px;
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: 20px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Proxy Server Control</h1>
            
            <div class="section">
                <div class="status ${statusClass}">
                    Server Status: <strong>${statusText}</strong>
                    ${portInfo}
                </div>
                
                <div class="button-container">
                    <button id="startButton" ${startButtonDisabled}>Start Server</button>
                    <button id="stopButton" ${stopButtonDisabled}>Stop Server</button>
                </div>
            </div>
            
            <div class="section">
                <h2>Server Configuration</h2>
                <form id="settingsForm">
                    <div class="form-group">
                        <label for="destination">Destination URL:</label>
                        <input type="text" id="destination" value="${destination}" placeholder="e.g., http://example.com/api">
                    </div>
                    
                    <div class="form-group">
                        <label for="tokenCommand">Token Command:</label>
                        <input type="text" id="tokenCommand" value="${tokenCommand}" placeholder="e.g., gcloud auth print-identity-token">
                    </div>
                    
                    <div class="form-group">
                        <label for="proxyPort">Proxy Port:</label>
                        <input type="number" id="proxyPort" value="${proxyPort}" min="1" max="65535">
                    </div>
                    
                    <div class="form-group">
                        <label for="tokenRotationMinutes">Token Rotation Interval (minutes):</label>
                        <input type="number" id="tokenRotationMinutes" value="${tokenRotationMinutes}" min="1">
                    </div>
                    
                    <div class="button-container">
                        <button type="submit">Save Settings</button>
                    </div>
                </form>
            </div>
        </div>

        <script>
            (function() {
                const vscode = acquireVsCodeApi();
                
                document.getElementById('startButton').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'startServer'
                    });
                });
                
                document.getElementById('stopButton').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'stopServer'
                    });
                });
                
                document.getElementById('settingsForm').addEventListener('submit', (event) => {
                    event.preventDefault();
                    vscode.postMessage({
                        command: 'saveSettings',
                        destination: document.getElementById('destination').value,
                        tokenCommand: document.getElementById('tokenCommand').value,
                        proxyPort: document.getElementById('proxyPort').value,
                        tokenRotationMinutes: document.getElementById('tokenRotationMinutes').value
                    });
                });
            }());
        </script>
    </body>
    </html>`;
  }
} 