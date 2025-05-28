import https from 'https';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bypass self-signed certificate errors (for development only)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

const data = JSON.stringify({
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ]
});

console.log('Sending request to:', `https://${options.hostname}:${options.port}${options.path}`);
console.log('Request body:', data);

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  
  let response = '';
  
  res.on('data', (chunk) => {
    response += chunk;
  });
  
  res.on('end', () => {
    try {
      console.log('Response:', JSON.stringify(JSON.parse(response), null, 2));
    } catch (e) {
      console.log('Raw response:', response);
    }
    console.log('Request completed');
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.write(data);
req.end();
