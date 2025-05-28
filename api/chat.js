import { app } from '../server.js';
import cors from 'cors';
import express from 'express';

// Create a new Express app for Vercel
const vercelApp = express();

// Enable CORS
vercelApp.use(cors());

// Parse JSON bodies
vercelApp.use(express.json());

// Forward all requests to the main Express app
vercelApp.all('*', (req, res) => {
  // Set the URL to match the expected path in the main app
  req.url = req.url.replace(/^\/api/, '');
  return app(req, res);
});

export default vercelApp;
