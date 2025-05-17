# Proxy Extension for VS Code

A VS Code extension that runs a Node.js proxy server with token rotation capabilities.

## Features

- Proxy HTTP requests to a configurable destination
- Automatically add bearer token authentication to requests
- Execute a command to obtain the bearer token (e.g., `gcloud auth print-identity-token`)
- Rotate the token automatically at a configurable interval
- Control and configure the proxy server from a graphical interface

## Requirements to change the library

- Node.js and npm installed
- VS Code 1.60.0 or higher

## Extension Settings

This extension contributes the following settings:

* `proxyExtension.destination`: The destination URL to proxy requests to (e.g., `http://example.com/api`)
* `proxyExtension.tokenCommand`: Command to execute to get bearer token (e.g., `gcloud auth print-identity-token`)
* `proxyExtension.proxyPort`: Port to run the proxy server on (default: `8080`)
* `proxyExtension.tokenRotationMinutes`: Time in minutes to rotate the token (default: `60`)

## Commands

* `Start Proxy Server`: Starts the proxy server with the configured settings
* `Stop Proxy Server`: Stops the running proxy server
* `Open Proxy Control Panel`: Opens a graphical interface to control and configure the proxy server

## How to Use

1. Install the extension
2. Open the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
3. Run the command `Open Proxy Control Panel`
4. Configure the proxy settings in the panel:
   - Set the destination URL
   - Set the token command (e.g., `gcloud auth print-identity-token`)
   - Adjust the proxy port and token rotation interval if needed
5. Click "Save Settings" to save your configuration
6. Click "Start Server" to start the proxy
7. To stop the proxy, click "Stop Server" in the panel

You can also start and stop the server directly from the command palette using the `Start Proxy Server` and `Stop Proxy Server` commands.

## Example Configuration

```json
{
  "proxyExtension.destination": "https://api.example.com",
  "proxyExtension.tokenCommand": "gcloud auth print-identity-token",
  "proxyExtension.proxyPort": 8080,
  "proxyExtension.tokenRotationMinutes": 60
}
```

This can be edited on the panel.

## Panel

Panel is made with simple HTML allowing you to change settings. This could be done with react but was done this way to keep it simple.

## Building and Running the Extension

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press `F5` to start debugging the extension in a new VS Code window 

## Flow to release

To trigger a release to VSIX to release, you need to push a tag:
git tag v0.1.0
git push origin v0.1.0