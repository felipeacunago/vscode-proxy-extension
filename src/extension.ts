import * as vscode from 'vscode';
import { ProxyServer } from './proxyServer';
import { ProxyPanel } from './panel';

let proxyServer: ProxyServer | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Proxy Extension activated');

  // Create a new proxy server instance
  proxyServer = new ProxyServer();

  // Register the start proxy command
  let startProxyCommand = vscode.commands.registerCommand('proxy-extension.startProxy', async () => {
    if (!proxyServer) {
      proxyServer = new ProxyServer();
    }
    await proxyServer.start();
  });

  // Register the stop proxy command
  let stopProxyCommand = vscode.commands.registerCommand('proxy-extension.stopProxy', () => {
    if (proxyServer) {
      proxyServer.stop();
    }
  });

  // Register the open panel command
  let openPanelCommand = vscode.commands.registerCommand('proxy-extension.openPanel', () => {
    if (!proxyServer) {
      proxyServer = new ProxyServer();
    }
    ProxyPanel.createOrShow(context.extensionUri, proxyServer);
  });

  // Add commands to the context
  context.subscriptions.push(startProxyCommand);
  context.subscriptions.push(stopProxyCommand);
  context.subscriptions.push(openPanelCommand);
}

export function deactivate() {
  // Stop the proxy server if it's running
  if (proxyServer) {
    proxyServer.stop();
    proxyServer = undefined;
  }
} 