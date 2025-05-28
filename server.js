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
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  
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
  
  // Handle SPA fallback - return the main index.html for all routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'), {
      headers: {
        'Content-Type': 'text/html; charset=UTF-8'
      }
    });
  });
}

// CORS configuration
const corsOptions = process.env.NODE_ENV === 'production' 
  ? {
      origin: [
        'https://your-vercel-app-url.vercel.app',
        'https://*.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'https://localhost:3000',
        'https://localhost:3001',
        'https://localhost:5173'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }
  : {
      origin: [
        'http://localhost:3000',
        'https://localhost:3000',
        'http://127.0.0.1:3000',
        'https://127.0.0.1:3000',
        'http://localhost:3001',
        'https://localhost:3001',
        'http://localhost:5173',
        'https://localhost:5173',
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    };

app.use(cors(corsOptions));

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
  
  try {
    const { messages, message } = req.body;
    let userQuery, conversationMessages;
    
    // Handle both message (legacy) and messages (chat completion) formats
    if (message) {
      // Legacy format: { message: "user query" }
      userQuery = message;
      conversationMessages = [
        { role: "system", content: "You are a helpful AI assistant." },
        { role: "user", content: message }
      ];
    } else if (messages && Array.isArray(messages)) {
      // Chat completion format: { messages: [...] }
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      if (!lastUserMessage) {
        return res.status(400).json({
          success: false,
          error: 'no_user_message',
          message: 'No user message found in conversation',
          requestId
        });
      }
      userQuery = lastUserMessage.content;
      conversationMessages = messages;
    } else {
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'Expected either "message" or "messages" in request body',
        requestId
      });
    }
    console.log(`[${requestId}] Processing query: "${userQuery}"`);
    
    // 1. Search Pinecone for relevant context
    console.log(`[${requestId}] Searching Pinecone for relevant context...`);
    const searchResults = await searchPinecone(userQuery, 3);
    
    if (searchResults.length === 0) {
      console.log(`[${requestId}] No relevant context found in Pinecone`);
      // Fallback to regular chat if no context found
      try {
        const response = await groq.chat.completions.create({
          messages: conversationMessages, // Use the already prepared conversation messages
          model: 'llama3-70b-8192',
          temperature: 0.7,
          max_tokens: 1000,
          stream: false
        });
        
        return res.json({
          id: response.id,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: response.model,
          response: response.choices[0]?.message?.content || "I couldn't generate a response.",
          choices: response.choices.map(choice => ({
            index: choice.index,
            message: {
              role: choice.message.role,
              content: choice.message.content
            },
            finish_reason: choice.finish_reason
          })),
          usage: response.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          },
          sources: []
        });
        
      } catch (groqError) {
        console.error(`[${requestId}] Groq API Error:`, groqError);
        return res.status(500).json({
          success: false,
          error: 'groq_api_error',
          message: 'Failed to generate response from Groq API',
          details: groqError.message,
          requestId
        });
      }
      
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
    
    try {
      console.log(`[${requestId}] Found ${searchResults.length} relevant context items`);
      
      // 2. Generate response using context
      console.log(`[${requestId}] Generating response with context...`);
      const responseText = await generateResponse(userQuery, searchResults);
      
      // 3. Format and send response
      console.log(`[${requestId}] Sending response to client`);
      
      // Return response in a format that works with both chat completion and legacy formats
      const responseData = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'llama3-70b-8192',
        response: responseText,  // Legacy format
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
        },
        sources: (searchResults || []).map((result, idx) => ({
          id: result.id || `result-${idx}`,
          text: result.metadata?.text || '',
          source: result.metadata?.source || 'unknown',
          score: result.score || 0
        }))
      };
      
      return res.json(responseData);
      
    } catch (genError) {
      console.error(`[${requestId}] Error generating response:`, genError);
      return res.status(500).json({
        success: false,
        error: 'response_generation_error',
        message: 'Failed to generate response',
        details: genError.message,
        requestId
      });
    }
    
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

// Check if we're running in Vercel
const isVercel = process.env.VERCEL === '1';

// Determine if we're in development mode
const isDev = !isVercel && process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 3001;

if (isVercel) {
  // Export the Express app for Vercel serverless functions
  module.exports = app;
} else if (isDev) {
  // Development server with HTTPS
  try {
    const sslOptions = {
      key: fs.readFileSync(path.join(__dirname, '.cert/key.pem')),
      cert: fs.readFileSync(path.join(__dirname, '.cert/cert.pem')),
    };

    const server = https.createServer(sslOptions, app);
    
    const startServer = (port) => {
      const onError = (error) => {
        if (error.code === 'EADDRINUSE') {
          const nextPort = parseInt(port) + 1;
          console.warn(`Port ${port} is in use, trying port ${nextPort}...`);
          server.close();
          startServer(nextPort);
        } else {
          console.error('Server error:', error);
          process.exit(1);
        }
      };

      server.listen(port, '0.0.0.0', () => {
        console.log(`Backend server running at https://localhost:${port}`);
        console.log(`API available at https://localhost:${port}/api/chat`);
        console.log('Note: Using self-signed certificate. You may need to accept the security exception in your browser.');
        console.log(`Listening on all network interfaces (0.0.0.0:${port} and [::]:${port})`);
      }).on('error', onError);
    };

    startServer(PORT);
  } catch (error) {
    console.warn('Could not start HTTPS server. Falling back to HTTP. Error:', error.message);
    startHttpServer(PORT);
  }
} else {
  // Production HTTP server (not on Vercel)
  startHttpServer(PORT);
}

// Function to start HTTP server with port fallback
function startHttpServer(port) {
  const HOST = '0.0.0.0';
  
  const server = app.listen(port, HOST, () => {
    console.log(`Server is running on http://${HOST}:${port}`);
    console.log(`API available at http://${HOST}:${port}/api/chat`);
  });

  // Handle port in use error by trying the next port
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = parseInt(port) + 1;
      console.warn(`Port ${port} is in use, trying port ${nextPort}...`);
      
      // Try to start server on alternative port
      const altServer = app.listen(nextPort, HOST, () => {
        console.log(`Server is running on http://${HOST}:${nextPort}`);
        console.log(`API available at http://${HOST}:${nextPort}/api/chat`);
      });
      
      // Handle errors on the alternative server
      altServer.on('error', (altError) => {
        console.error(`Failed to start server on port ${nextPort}:`, altError);
        process.exit(1);
      });
    } else {
      console.error('Server error:', error);
      process.exit(1);
    }
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});
