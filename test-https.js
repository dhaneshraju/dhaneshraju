import https from 'https';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  // Add agent options to handle self-signed certs
  agent: new https.Agent({
    rejectUnauthorized: false,
    requestCert: false,
    keepAlive: true
  }),
  // Add timeout
  timeout: 10000 // 10 seconds
};

const data = JSON.stringify({
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ]
});

console.log('=== Starting HTTPS Request ===');
console.log('Sending request to:', `https://${options.hostname}:${options.port}${options.path}`);
console.log('Request body:', data);

const req = https.request(options, (res) => {
  console.log('\n=== Response Received ===');
  console.log(`Status Code: ${res.statusCode}`);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  
  let response = '';
  
  res.on('data', (chunk) => {
    response += chunk;
  });
  
  res.on('end', () => {
    console.log('\n=== Response Body ===');
    try {
      console.log(JSON.stringify(JSON.parse(response), null, 2));
    } catch (e) {
      console.log('Raw response:', response);
    }
    console.log('\n=== Request Completed ===');
  });
});

req.on('socket', (socket) => {
  console.log('\n=== Socket Created ===');
  console.log('Socket connecting to:', socket.remoteAddress, socket.remotePort);
  
  socket.on('connect', () => {
    console.log('Socket connected');
  });
  
  socket.on('secureConnect', () => {
    console.log('Socket securely connected');
    console.log('TLS version:', socket.getProtocol());
  });
  
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
  
  socket.on('timeout', () => {
    console.error('Socket timeout');
  });
});

req.on('error', (e) => {
  console.error('\n=== Request Error ===');
  console.error('Error message:', e.message);
  console.error('Error code:', e.code);
  console.error('Error stack:', e.stack);
});

req.on('timeout', () => {
  console.error('\n=== Request Timeout ===');
  req.destroy();
});

// Write data to request body
console.log('\nSending request...');
req.write(data);
req.end();

console.log('Request sent, waiting for response...');
