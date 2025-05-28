import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Groq } from 'groq-sdk';
import { Pinecone } from '@pinecone-database/pinecone';
import { HfInference } from '@huggingface/inference';
import https from 'https';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the Vite build directory in production

// Serve static files with proper MIME types
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    }
  }
}));

// API routes should be defined before the catch-all route
// Your existing API routes are already defined above

// Handle SPA fallback - return the main index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't serve HTML for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  // Serve index.html for all other routes
  res.sendFile(path.join(__dirname, 'dist', 'index.html'), {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8'
    }
  });
});

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://dhaneshraju.vercel.app',
  'https://dhaneshraju.vercel.app/'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200 // For legacy browser support
};

// Enable pre-flight across-the-board
app.options('*', cors(corsOptions));

// Apply CORS middleware
app.use(cors(corsOptions));

// Log CORS headers for debugging
app.use((req, res, next) => {
  console.log('Incoming request:', {
    method: req.method,
    url: req.url,
    origin: req.headers.origin,
    'user-agent': req.headers['user-agent']
  });
  next();
});

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Serve static files from the Vite build directory
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  
  // Handle client-side routing - return the main entry file for any route that doesn't match an API route
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Initialize Groq
const groq = new Groq({
  apiKey: process.env.VITE_GROQ_API_KEY,
});

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.VITE_PINECONE_API_KEY,
  environment: process.env.VITE_PINECONE_ENVIRONMENT || 'us-west1-gcp',
  projectId: process.env.VITE_PINECONE_PROJECT_ID
});

// Initialize Hugging Face for embeddings
const hf = new HfInference(process.env.VITE_HUGGINGFACE_API_KEY);

// Function to generate embeddings
async function getEmbedding(text) {
  try {
    console.log('Generating embedding for text...');
    
    // Clean and normalize the input text
    const cleanText = text
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .trim()
      .substring(0, 1000);  // Limit input length
    
    const response = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: cleanText,
      options: { wait_for_model: true }
    });
    
    // Handle different response formats
    let embedding = [];
    if (Array.isArray(response)) {
      // Flatten nested arrays
      embedding = response.flat(Infinity);
    } else if (response && typeof response === 'object') {
      // Handle object response by taking values
      embedding = Object.values(response);
    }
    
    // Ensure we have exactly 384 dimensions
    if (embedding.length !== 384) {
      if (embedding.length > 384) {
        embedding = embedding.slice(0, 384);
      } else {
        const padding = new Array(384 - embedding.length).fill(0);
        embedding = [...embedding, ...padding];
      }
    }
    
    // Normalize the embedding
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      embedding = embedding.map(val => val / norm);
    }
    
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return new Array(384).fill(0);
  }
}

// Function to search Pinecone
async function searchPinecone(query, topK = 3) {
  try {
    const queryEmbedding = await getEmbedding(query);
    const index = pinecone.index(process.env.VITE_PINECONE_INDEX);
    
    const results = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      includeValues: false
    });
    
    return results.matches || [];
  } catch (error) {
    console.error('Error searching Pinecone:', error);
    return [];
  }
}

// Function to generate response with context
async function generateResponse(query, context) {
  try {
    const formattedContext = context.map((item, index) => 
      `--- Source ${index + 1} ---\n${item.metadata.text}`
    ).join('\n\n');
    
    const systemPrompt = `You are a helpful AI assistant that helps answer questions based on the provided context.
    - If the answer isn't in the context, say you don't know.
    - Keep responses concise (2-3 sentences).
    - Always respond in first person as if you are the person being asked about.
    - Focus on the most relevant information from the context.`;
    
    const response = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Context:\n${formattedContext}\n\nQuestion: ${query}\n\nAnswer:` }
      ],
      model: "llama3-70b-8192",
      temperature: 0.5,
      max_tokens: 500
    });

    return response.choices[0]?.message?.content || "I couldn't generate a response based on the available information.";
  } catch (error) {
    console.error('Error generating response:', error);
    return "I'm sorry, I encountered an error while processing your request.";
  }
}

// Process and upload documents to Pinecone
app.post('/api/upload-documents', async (req, res) => {
  try {
    const { documents } = req.body;
    
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'Expected documents array in request body'
      });
    }

    console.log(`Processing ${documents.length} documents for Pinecone upload`);
    
    // Process each document
    const vectors = [];
    
    for (const [index, doc] of documents.entries()) {
      try {
        console.log(`Processing document ${index + 1}/${documents.length}`);
        
        // Generate embedding for the document text
        const embedding = await getEmbedding(doc.text);
        
        // Create a vector object for Pinecone
        vectors.push({
          id: `doc-${Date.now()}-${index}`,
          values: embedding,
          metadata: {
            text: doc.text,
            source: doc.source || 'unknown',
            title: doc.title || `Document ${index + 1}`,
            ...(doc.metadata || {})
          }
        });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing document ${index}:`, error);
        // Continue with next document even if one fails
      }
    }

    if (vectors.length === 0) {
      throw new Error('No valid documents could be processed');
    }

    // Upload to Pinecone
    const index = pinecone.index(process.env.VITE_PINECONE_INDEX);
    const upsertResponse = await index.namespace('').upsert(vectors);
    
    console.log(`Successfully uploaded ${vectors.length} documents to Pinecone`);
    
    res.json({
      success: true,
      message: `Successfully processed and uploaded ${vectors.length} documents`,
      upsertResponse
    });
    
  } catch (error) {
    console.error('Error uploading documents to Pinecone:', error);
    res.status(500).json({
      success: false,
      error: 'upload_failed',
      message: error.message
    });
  }
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ success: true, message: 'Test endpoint working' });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const requestId = Date.now();
  console.log(`\n=== New Chat Request (ID: ${requestId}) ===`);
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Check for missing body
    if (!req.body) {
      console.error('No request body received');
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'Request body is required',
        requestId
      });
    }
    
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      console.error('Invalid request: Missing or invalid messages array');
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'Expected messages array in request body',
        requestId
      });
    }
    
    // Get the last user message
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) {
      return res.status(400).json({
        success: false,
        error: 'no_user_message',
        message: 'No user message found in conversation',
        requestId
      });
    }
    
    const userQuery = lastUserMessage.content;
    console.log(`[${requestId}] Processing query: "${userQuery}"`);
    
    // 1. Search Pinecone for relevant context
    console.log(`[${requestId}] Searching Pinecone for relevant context...`);
    const searchResults = await searchPinecone(userQuery, 3);
    
    if (searchResults.length === 0) {
      console.log(`[${requestId}] No relevant context found in Pinecone`);
      // Fallback to regular chat if no context found
      const response = await groq.chat.completions.create({
        messages: [
          ...messages,
          {
            role: "system",
            content: "You are a helpful AI assistant. Answer the user's question based on your general knowledge."
          }
        ],
        model: 'llama3-8b-8192',
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      });
      
      return res.json({
        id: response.id,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: response.model,
        choices: response.choices.map(choice => ({
          index: choice.index,
          message: {
            role: choice.message.role,
            content: choice.message.content
          },
          finish_reason: choice.finish_reason
        })),
        usage: response.usage
      });
    }
    
    console.log(`[${requestId}] Found ${searchResults.length} relevant context items`);
    
    // 2. Generate response using context
    console.log(`[${requestId}] Generating response with context...`);
    const responseText = await generateResponse(userQuery, searchResults);
    
    // 3. Format and send response
    console.log(`[${requestId}] Sending response to client`);
    
    return res.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'llama3-70b-8192',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseText
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 0,  // These would need to be calculated
        completion_tokens: 0,
        total_tokens: 0
      }
    });
    
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: error.message,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// Determine if we're in development mode
const isDev = process.env.NODE_ENV !== 'production';

if (isDev) {
  try {
    // Try to use HTTPS in development with self-signed certs
    const sslOptions = {
      key: fs.readFileSync(path.join(__dirname, '.cert/key.pem')),
      cert: fs.readFileSync(path.join(__dirname, '.cert/cert.pem')),
    };

    const PORT = process.env.PORT || 3000;
    const HOST = '0.0.0.0';

    // Create HTTPS server
    const server = https.createServer(sslOptions, app);

    // Start the server
    server.listen(PORT, HOST, () => {
      console.log(`Server running at https://localhost:${PORT}`);
      console.log(`API available at https://localhost:${PORT}/api/chat`);
      console.log('Note: Using self-signed certificate. You may need to accept the security exception in your browser.');
      console.log(`Listening on all network interfaces (0.0.0.0:${PORT} and [::]:${PORT})`);
    });

    // Handle port in use error
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        const altPort = parseInt(PORT) + 1;
        console.warn(`Port ${PORT} is in use, trying port ${altPort}...`);
        
        // Try to start server on alternative port
        const altServer = https.createServer(sslOptions, app).listen(altPort, HOST, () => {
          console.log(`Server is running on https://${HOST}:${altPort}`);
          console.log(`API available at https://${HOST}:${altPort}/api/chat`);
          console.log('Note: Using self-signed certificate. You may need to accept the security exception in your browser.');
          console.log(`Listening on all network interfaces (${HOST}:${altPort} and [::]:${altPort})`);
        });
        
        // Handle errors on the alternative server
        altServer.on('error', (altError) => {
          console.error(`Failed to start server on port ${altPort}:`, altError);
          process.exit(1);
        });
      } else {
        console.error('Server error:', error);
        process.exit(1);
      }
    });
  } catch (error) {
    console.warn('Could not start HTTPS server. Falling back to HTTP. Error:', error.message);
    startHttpServer(process.env.PORT || 3000);
  }
} else {
  // In production, use HTTP (Vercel will handle HTTPS)
  startHttpServer(process.env.PORT || 3000);
}

// Function to start HTTP server with port fallback
function startHttpServer(port) {
  const HOST = '0.0.0.0';
  
  const server = app.listen(port, HOST, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`API available at http://localhost:${port}/api/chat`);
    console.log(`Listening on all network interfaces (${HOST}:${port} and [::]:${port})`);
  });

  // Handle port in use error for HTTP server
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const altPort = parseInt(port) + 1;
      console.warn(`Port ${port} is in use, trying port ${altPort}...`);
      startHttpServer(altPort);
    } else {
      console.error('HTTP server error:', error);
      process.exit(1);
    }
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});
