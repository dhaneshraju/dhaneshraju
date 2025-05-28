import { app } from '../server.js';
import cors from 'cors';
import express from 'express';

// Create a new Express app for Vercel
const vercelApp = express();

// Enable CORS
vercelApp.use(cors());

// Parse JSON bodies
vercelApp.use(express.json());

// Log all requests for debugging
vercelApp.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
vercelApp.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Forward all requests to the main Express app
vercelApp.all('/api/chat', (req, res) => {
  // Set the URL to match the expected path in the main app
  req.url = req.url.replace(/^\/api/, '');
  return app(req, res);
});

// Catch-all for other routes
vercelApp.all('*', (req, res) => {
  console.log(`[404] Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: {
      code: '404',
      message: 'The requested resource was not found'
    }
  });
});

// Error handling middleware
vercelApp.use((err, req, res, next) => {
  console.error('Error in API handler:', err);
  res.status(500).json({
    error: {
      code: '500',
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }
  });
});

export default vercelApp;
