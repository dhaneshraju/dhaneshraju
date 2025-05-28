import https from 'https';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/test',
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  },
  rejectUnauthorized: false // Only for testing with self-signed certs
};

console.log('Sending GET request to:', `https://${options.hostname}:${options.port}${options.path}`);

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      console.log('Response:', JSON.parse(data));
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.end();
