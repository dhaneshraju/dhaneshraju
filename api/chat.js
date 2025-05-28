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
        body = JSON.parse(body);
      }

      const { message } = body;
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Example logic, replace with your AI assistant logic
      const response = `Echo: ${message}`;
      return res.status(200).json({ response });
    } catch (err) {
      console.error('Error in /api/chat:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Handle other methods
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

