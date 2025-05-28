export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Vercel may not parse JSON automatically
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    const { message } = body;
    // Example logic, replace with your AI assistant logic
    const response = `Echo: ${message}`;
    res.status(200).json({ response });
  } catch (err) {
    console.error('Error in /api/chat:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

