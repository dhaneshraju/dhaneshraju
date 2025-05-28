export default async function handler(req, res) {
  // Handle GET request
  if (req.method === 'GET') {
    return res.status(200).json({ 
      message: "API is working! Send a POST request with a 'message' field to get an echo response." 
    });
  }

  // Handle POST request
  if (req.method === 'POST') {
    try {
      // Vercel may not parse JSON automatically
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          console.error('Error parsing JSON:', e);
          return res.status(400).json({ error: 'Invalid JSON format' });
        }
      }

      console.log('Request body:', body); // Debug log

      // Handle different possible message field names
      const message = body.message || body.query || body.prompt || body.input;
      
      if (!message) {
        console.error('No message found in request body:', body);
        return res.status(400).json({ 
          error: 'Message is required', 
          receivedBody: body,
          possibleFields: ['message', 'query', 'prompt', 'input']
        });
      }

      // Example logic, replace with your AI assistant logic
      const response = `Echo: ${message}`;
      return res.status(200).json({ 
        response,
        originalMessage: message
      });
    } catch (err) {
      console.error('Error in /api/chat:', err);
      return res.status(500).json({ 
        error: 'Internal server error',
        details: err.message 
      });
    }
  }

  // Handle other methods
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}