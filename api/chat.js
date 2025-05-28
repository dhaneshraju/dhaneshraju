// Import the main Express app
import { app } from '../server.js';

// This is the Vercel serverless function handler
export default async function handler(req, res) {
  try {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    // For health check
    if (req.url === '/api/health' && req.method === 'GET') {
      return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    }
    
    // Handle chat requests
    if (req.url === '/api/chat' && req.method === 'POST') {
      // Parse the request body if it's a string
      if (typeof req.body === 'string') {
        try {
          req.body = JSON.parse(req.body);
        } catch (e) {
          console.error('Error parsing request body:', e);
          return res.status(400).json({
            error: {
              code: 'invalid_json',
              message: 'Invalid JSON in request body'
            }
          });
        }
      }
      
      // Call the original app's request handler
      return app(req, res);
    }
    
    // Handle 404 for other routes
    console.log(`[404] Route not found: ${req.method} ${req.url}`);
    return res.status(404).json({
      error: {
        code: 'not_found',
        message: 'The requested resource was not found',
        path: req.url
      }
    });
    
  } catch (error) {
    console.error('Unhandled error in serverless function:', error);
    return res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred',
        ...(process.env.NODE_ENV === 'development' && { 
          details: error.message,
          stack: error.stack 
        })
      }
    });
  }
}
