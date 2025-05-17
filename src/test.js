// Example script to test the proxy server
// Run this with: node test.js

const http = require('http');

// Make a request to the proxy server
const options = {
  hostname: 'localhost',
  port: 123456, // The default port of the proxy server
  path: '/', // This will be forwarded to the destination
  method: 'GET',
};

console.log('Sending request to proxy server...');
const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response body:');
    console.log(data);
  });
});

req.on('error', (error) => {
  console.error(`Request error: ${error.message}`);
});

req.end(); 