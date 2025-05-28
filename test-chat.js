import https from 'https';

const data = JSON.stringify({
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ]
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  },
  rejectUnauthorized: false // Only for testing with self-signed certs
};

console.log('Sending request to:', `https://${options.hostname}:${options.port}${options.path}`);
console.log('Request body:', data);

const req = https.request(options, (res) => {
  console.log(`\n=== Response ===`);
  console.log(`Status Code: ${res.statusCode}`);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    try {
      console.log('Response Body:', JSON.stringify(JSON.parse(responseData), null, 2));
    } catch (e) {
      console.log('Raw response:', responseData);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.write(data);
req.end();
