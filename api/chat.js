import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';

// Initialize services with error handling
let groq;
let pinecone;
let hf;
let servicesInitialized = false;

// Function to initialize services
function initializeServices() {
  if (servicesInitialized) return;
  
  try {
    console.log('Initializing services...');
    
    // Check for required environment variables
    const requiredEnvVars = [
      'GROQ_API_KEY',
      'PINECONE_API_KEY',
      'PINECONE_ENVIRONMENT',
      'PINECONE_INDEX',
      'HUGGINGFACE_API_KEY'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    // Initialize Groq
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
    console.log('Groq initialized');

    // Initialize Pinecone
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT
    });
    console.log('Pinecone client initialized');

    // Initialize Hugging Face for embeddings
    hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
    console.log('Hugging Face initialized');
    
    servicesInitialized = true;
    
  } catch (error) {
    console.error('Failed to initialize services:', error);
    // Don't throw here, we'll handle it when services are actually used
  }
}

// Helper function to mask sensitive information in logs
function maskSensitiveInfo(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  const masked = { ...obj };
  const sensitiveKeys = ['key', 'token', 'secret', 'password', 'apiKey'];
  
  Object.keys(masked).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      masked[key] = '***MASKED***';
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveInfo(masked[key]);
    }
  });
  
  return masked;
}

// Initialize services immediately
console.log('Initializing services with environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT ? '***SET***' : 'MISSING',
  PINECONE_INDEX: process.env.PINECONE_INDEX ? '***SET***' : 'MISSING',
  // Don't log actual API keys, just confirm they exist
  GROQ_API_KEY: process.env.GROQ_API_KEY ? '***SET***' : 'MISSING',
  PINECONE_API_KEY: process.env.PINECONE_API_KEY ? '***SET***' : 'MISSING',
  HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY ? '***SET***' : 'MISSING'
});

initializeServices();

// Cache for embeddings to avoid redundant API calls
const embeddingCache = new Map();

// Generate embedding for text using Hugging Face
async function getEmbedding(text) {
  const cacheKey = text.trim().toLowerCase();
  
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }

  try {
    const embedding = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: text
    });
    
    embeddingCache.set(cacheKey, embedding);
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate text embedding');
  }
}

// Query Pinecone for relevant context
async function queryPinecone(query, topK = 3) {
  try {
    // Ensure services are initialized
    if (!servicesInitialized) {
      initializeServices();
      if (!servicesInitialized) {
        throw new Error('Services failed to initialize. Please check server logs.');
      }
    }

    if (!pinecone) {
      throw new Error('Pinecone client not properly initialized');
    }

    const pineconeIndex = process.env.PINECONE_INDEX;
    if (!pineconeIndex) {
      throw new Error('Pinecone index not configured');
    }

    console.log(`Querying Pinecone index: ${pineconeIndex}`);
    const index = pinecone.Index(pineconeIndex);
    
    console.log('Generating embedding for query...');
    const queryEmbedding = await getEmbedding(query);
    
    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new Error('Failed to generate query embedding');
    }

    console.log('Sending query to Pinecone...');
    const queryResponse = await index.query({
      vector: queryEmbedding[0],
      topK,
      includeMetadata: true,
      includeValues: false
    });

    console.log(`Pinecone query returned ${queryResponse.matches?.length || 0} matches`);
    return queryResponse.matches || [];
  } catch (error) {
    console.error('Error querying Pinecone:', error);
    
    // Check for specific error conditions
    if (error.message.includes('API key')) {
      throw new Error('Invalid Pinecone API key or environment');
    } else if (error.message.includes('index not found')) {
      throw new Error(`Pinecone index not found: ${process.env.PINECONE_INDEX}`);
    } else if (error.message.includes('connect')) {
      throw new Error('Could not connect to Pinecone service');
    }
    
    throw new Error(`Knowledge base error: ${error.message}`);
  }
}

// Generate response using Groq with context from Pinecone
async function generateResponseWithContext(messages, query) {
  console.log('generateResponseWithContext called with:', { 
    messagesLength: messages?.length,
    queryLength: query?.length,
    groqInitialized: !!groq,
    pineconeInitialized: !!pinecone,
    hfInitialized: !!hf
  });

  try {
    console.log('1. Querying Pinecone for context...');
    const contextResults = await queryPinecone(query);
    console.log(`Pinecone returned ${contextResults.length} context results`);
    
    // 2. Format the context for the prompt
    let context = '';
    if (contextResults.length > 0) {
      context = contextResults
        .map((result, i) => {
          const source = result.metadata?.source || 'Unknown source';
          const text = (result.metadata?.text || result.metadata?.content || '').substring(0, 200) + '...';
          return `[${i + 1}] Source: ${source}\n${text}`;
        })
        .join('\n\n');
    }

    console.log('2. Creating system prompt with context...');
    // 3. Create system prompt with context
    const systemPrompt = `You are a helpful AI assistant. Use the following context to answer the user's question. If you don't know the answer, just say that you don't know, don't try to make up an answer.

Context:
${context || 'No relevant context found.'}`;

    // 4. Prepare messages for Groq
    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.filter(msg => msg.role !== 'system'), // Keep existing messages but replace system prompt
      { role: 'user', content: query }
    ];

    console.log('3. Sending request to Groq API...');
    console.log('Groq messages structure:', {
      systemPromptLength: systemPrompt.length,
      userMessagesCount: messages.filter(m => m.role === 'user').length,
      totalMessages: groqMessages.length
    });

    // 5. Call Groq API
    const completion = await groq.chat.completions.create({
      messages: groqMessages,
      model: 'mixtral-8x7b-32768',
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1,
      stream: false,
    }).catch(groqError => {
      console.error('Groq API error:', {
        status: groqError?.status,
        statusText: groqError?.statusText,
        message: groqError?.message,
        code: groqError?.code,
        response: groqError?.response?.data
      });
      throw new Error(`Groq API error: ${groqError.message}`);
    });

    console.log('4. Groq API response received');
    
    // 6. Format response with sources if available
    const aiResponse = completion.choices[0]?.message?.content || 
                      "I'm sorry, I couldn't generate a response at this time.";

    // 7. Include sources in the response
    const sources = contextResults.length > 0
      ? contextResults.map(r => ({
          text: (r.metadata?.text || r.metadata?.content || '').substring(0, 500) + '...',
          source: r.metadata?.source || 'Unknown source',
          score: r.score,
          id: r.id
        }))
      : [];

    const response = {
      response: aiResponse,
      sources,
      model: completion.model,
      usage: completion.usage,
      created: completion.created
    };

    console.log('5. Response prepared successfully');
    return response;
  } catch (error) {
    console.error('Error in generateResponseWithContext:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      ...(error.response && { 
        response: {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        }
      })
    });
    throw error;
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Add request logging
  console.log('\n=== NEW REQUEST ===');
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', maskSensitiveInfo(req.headers));
  
  // Log environment info
  console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    NODE_VERSION: process.version,
    PLATFORM: process.platform,
    MEMORY_USAGE: process.memoryUsage()
  });

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return res.status(200).end();
  }

  // Handle GET request
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'online',
      service: 'Dhanesh Raju Portfolio Chat API',
      endpoints: {
        chat: {
          method: 'POST',
          path: '/api/chat',
          description: 'Send a chat message',
          body: {
            messages: 'Array of message objects with role and content',
            query: 'The user\'s query (optional if last message is from user)'
          }
        }
      },
      environment: process.env.NODE_ENV || 'development'
    });
  }

  // Handle POST request
  if (req.method === 'POST') {
    try {
      // Parse request body
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          console.error('Error parsing JSON:', e);
          return res.status(400).json({ 
            error: 'Invalid JSON format',
            message: 'Please send a valid JSON object',
            example: {
              messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Hello, how are you?' }
              ]
            }
          });
        }
      }

      // Validate request body
      if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Messages array is required',
          received: body
        });
      }

      // Extract the latest user message
      const userMessage = body.query || 
                         body.messages.filter(m => m.role === 'user').pop()?.content ||
                         body.messages[body.messages.length - 1]?.content ||
                         '';

      if (!userMessage) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'No user message found in the request',
          received: body
        });
      }

      // Generate response with context
      console.log('Generating response with context...');
      console.log('Request body:', maskSensitiveInfo(body));
      
      try {
        const response = await generateResponseWithContext(body.messages, userMessage);
        
        if (!response) {
          throw new Error('generateResponseWithContext returned null or undefined');
        }

        console.log('Response generated successfully');
        console.log('Response preview:', {
          responseLength: response.response?.length,
          sourcesCount: response.sources?.length || 0
        });
        
        // Return the response
        return res.status(200).json({
          success: true,
          ...response
        });
      } catch (genError) {
        console.error('Error in generateResponseWithContext:', {
          message: genError.message,
          stack: genError.stack,
          name: genError.name,
          code: genError.code
        });
        throw genError; // Re-throw to be caught by the outer catch
      }

    } catch (error) {
      console.error('Error in /api/chat:', error);
      
      // Log detailed error information
      console.error('API Error Details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        code: error.code,
        statusCode: error.statusCode,
        response: error.response?.data || 'No response data'
      });

      // Handle different types of errors
      let statusCode = 500;
      let errorType = 'Internal Server Error';
      let message = 'An unexpected error occurred';
      let details = {};

      // Authentication errors
      if (error.message.includes('API key') || 
          error.message.includes('authentication') ||
          error.message.includes('unauthorized')) {
        statusCode = 401;
        errorType = 'Authentication Error';
        message = 'Invalid or missing API key';
      } 
      // Pinecone/Knowledge base errors
      else if (error.message.includes('Pinecone') || 
               error.message.includes('knowledge base') ||
               error.message.includes('index not found')) {
        statusCode = 503;
        errorType = 'Knowledge Base Error';
        message = 'Unable to access the knowledge base';
      } 
      // Embedding/processing errors
      else if (error.message.includes('embedding') || 
               error.message.includes('processing') ||
               error.message.includes('generate')) {
        statusCode = 422;
        errorType = 'Processing Error';
        message = 'Failed to process the input text';
      }
      // Validation errors
      else if (error.message.includes('valid') || 
               error.message.includes('require') ||
               error.message.includes('missing')) {
        statusCode = 400;
        errorType = 'Validation Error';
        message = 'Invalid request: ' + error.message;
      }

      // Add debug details in development
      if (process.env.NODE_ENV === 'development') {
        details = {
          message: error.message,
          stack: error.stack,
          code: error.code,
          ...(error.response?.data && { response: error.response.data })
        };
      }

      return res.status(statusCode).json({
        error: errorType,
        message: message,
        ...(Object.keys(details).length > 0 && { details })
      });
    }
  }

  // Handle unsupported methods
  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
  return res.status(405).json({
    error: `Method ${req.method} not allowed`,
    allowedMethods: ['GET', 'POST', 'OPTIONS']
  });
}