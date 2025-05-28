// Import the main Express app
import { app } from '../server.js';
import express from 'express';

// Create a new Express app for Vercel
const vercelApp = express();

// Middleware to parse JSON bodies
vercelApp.use(express.json());

// Log all requests
vercelApp.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Health check endpoint
vercelApp.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Chat endpoint
vercelApp.post('/api/chat', async (req, res) => {
  try {
    console.log('Chat request received:', req.body);
    
    // Create a mock response object
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          res.status(code).json(data);
        }
      })
    };
    
    // Call the original handler
    await app.handle(req, mockRes);
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

// Catch-all for other routes
vercelApp.all('*', (req, res) => {
  console.log(`[404] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: {
      code: 'not_found',
      message: 'The requested resource was not found',
      path: req.originalUrl
    }
  });
});

// Error handling middleware
vercelApp.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && { details: err.message })
    }
  });
});

// Export the Vercel serverless function
export default vercelApp;
