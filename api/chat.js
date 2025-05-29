// /api/chat.js - Updated to match working local deployment
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';

// Initialize with environment variables
const groqApiKey = process.env.VITE_GROQ_API_KEY;
const pineconeApiKey = process.env.VITE_PINECONE_API_KEY;
const pineconeEnvironment = process.env.VITE_PINECONE_ENVIRONMENT || 'aped-4627-b74a';
const hfApiKey = process.env.VITE_HUGGINGFACE_API_KEY;
const pineconeIndexName = process.env.VITE_PINECONE_INDEX;

// Validate required environment variables
const requiredVars = {
  'VITE_GROQ_API_KEY': groqApiKey,
  'VITE_PINECONE_API_KEY': pineconeApiKey,
  'VITE_PINECONE_INDEX': pineconeIndexName,
  'VITE_HUGGINGFACE_API_KEY': hfApiKey
};

const missingVars = Object.entries(requiredVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// Initialize clients
let groq, pinecone, hf;

// Initialize clients with retry logic
async function initializeClients() {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[API] Initializing clients (attempt ${attempt}/${maxRetries})`);
      
      // Initialize Groq
      groq = new Groq({ 
        apiKey: groqApiKey,
        fetch: (url, options) => {
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
        }
      });

      // Initialize Pinecone with environment from the full API URL
      // The environment should be the part after 'https://' and before '.pinecone.io'
      // For example: 'us-east1-aws' from 'https://your-index-name-us-east1-aws.svc.pinecone.io'
      pinecone = new Pinecone({
        apiKey: pineconeApiKey,
        environment: pineconeEnvironment,
        // Add custom fetch with timeout
        fetch: (url, options) => {
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
        }
      });

      // Initialize Hugging Face
      hf = new HfInference(hfApiKey, {
        fetch: (url, options) => {
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
        }
      });

      // Test Pinecone connection with better error details
      try {
        console.log(`[Pinecone] Testing connection to environment: ${pineconeEnvironment}`);
        const indexes = await pinecone.listIndexes();
        console.log(`[Pinecone] Successfully connected. Available indexes:`, 
          indexes.indexes?.map(i => i.name).join(', ') || 'None');
      } catch (pineconeError) {
        console.error('[Pinecone] Connection test failed:', {
          message: pineconeError.message,
          environment: pineconeEnvironment,
          indexName: pineconeIndexName,
          apiKeyPrefix: pineconeApiKey?.substring(0, 8) + '...' || 'Not set'
        });
        throw pineconeError; // Re-throw to trigger retry
      }
      
      console.log('[API] All clients initialized successfully');
      return;
      
    } catch (error) {
      lastError = error;
      console.error(`[API] Initialization attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`[API] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  const errorMessage = `Failed to initialize clients after ${maxRetries} attempts: ${lastError.message}`;
  console.error(errorMessage, {
    pineconeEnvironment,
    pineconeIndexName,
    apiKeyPrefix: pineconeApiKey?.substring(0, 8) + '...' || 'Not set'
  });
  throw new Error(errorMessage);
}

// Initialize all clients
await initializeClients();

// Disable noisy logs in production
if (process.env.NODE_ENV === 'production') {
  // Keep error and warn logs in production
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    // Only log if it's an important message (starts with [)
    if (args[0] && typeof args[0] === 'string' && args[0].startsWith('[')) {
      originalConsoleLog.apply(console, args);
    }
  };
}

// Constants
const PINECONE_MIN_SCORE = 0.7;
const PINECONE_TOP_K = 5;
const PINECONE_QUERY_TIMEOUT = 20000; // 20 seconds

// Groq model configuration
// Using the latest recommended model from Groq
const GROQ_MODEL = 'llama3-70b-8192';
// Fallback model in case the primary is not available
const GROQ_MODEL_FALLBACK = 'llama3-8b-8192';
const GROQ_TEMPERATURE = 0.5;
const GROQ_MAX_TOKENS = 2000;
const GROQ_TIMEOUT = 30000; // 30 seconds

const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
const EMBEDDING_MAX_LENGTH = 512; // Max characters to process
const EMBEDDING_TIMEOUT = 10000; // 10 seconds

// Simple fallback embedding function
const simpleEmbedding = (text) => {
  // This is a very basic embedding that just converts text to numbers
  // It's not as good as a real embedding model but can work as a fallback
  const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  const embedding = new Array(384).fill(0); // Using 384 dimensions to match common models
  
  // Simple word frequency based embedding
  words.forEach(word => {
    // Simple hash to distribute values
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) % 384;
    }
    embedding[hash] = (embedding[hash] || 0) + 1;
  });
  
  // Normalize the vector
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
  return embedding.map(val => val / norm);
};

/**
 * Generates an embedding vector for the given text using Hugging Face's inference API
 * with fallback to a simple embedding method if the API fails
 * @param {string} text - The input text to generate embedding for
 * @param {number} attempt - Current attempt number (for retries)
 * @returns {Promise<number[]>} - The embedding vector
 */
const getEmbedding = async (text, attempt = 1) => {
  // Use simple embedding if Hugging Face is not initialized
  if (!hf) {
    console.warn('Hugging Face client not initialized, using simple embedding');
    return simpleEmbedding(text || '');
  }
  const startTime = Date.now();
  let timeoutId;
  
  // Simple validation
  if (!text || typeof text !== 'string') {
    console.warn('[Embedding] Invalid input, using fallback embedding');
    return simpleEmbedding(String(text || ''));
  }
  
  // Clean and truncate the input text
  const clean = text.trim().substring(0, EMBEDDING_MAX_LENGTH);
  if (!clean) {
    console.warn('[Embedding] Empty text after cleaning, using fallback');
    return simpleEmbedding('');
  }
  
  console.log(`[Embedding] Generating for text (${clean.length} chars):`, 
    clean.substring(0, 50) + (clean.length > 50 ? '...' : ''));
  
  // If no API key is provided, use the simple embedding
  if (!hfApiKey) {
    console.warn('[Embedding] No API key provided, using fallback embedding');
    return simpleEmbedding(clean);
  }
  
  try {
    // Initialize Hugging Face client if not already done
    if (!hf) {
      console.log('[Embedding] Initializing Hugging Face client...');
      hf = new HfInference(hfApiKey);
    }
    
    // Set up timeout and abort controller
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT);
    
    try {
      // Make the API request
      const response = await hf.featureExtraction({
        model: EMBEDDING_MODEL,
        inputs: clean,
        options: { 
          wait_for_model: true,
          use_cache: true,
          timeout: Math.floor(EMBEDDING_TIMEOUT * 0.8) // Slightly less than the fetch timeout
        },
        fetch: (url, options) => {
          return fetch(url, { 
            ...options, 
            signal: controller.signal,
            headers: {
              ...(options?.headers || {}),
              'User-Agent': 'DhaneshPortfolio/1.0.0',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${hfApiKey}`
            }
          });
        }
      });
      
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      if (!response) {
        throw new Error('Empty response from embedding service');
      }
      
      // Normalize response format (handle different response structures)
      let embedding;
      if (Array.isArray(response)) {
        embedding = response[0] || response;
      } else if (response && typeof response === 'object') {
        embedding = response.embeddings || response.embedding || response;
      }
      
      // Validate the embedding
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('Invalid embedding format received');
      }
      
      console.log(`[Embedding] Generated in ${duration}ms (${embedding.length} dimensions)`);
      return embedding;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      const errorDetails = {
        message: error.message,
        name: error.name,
        type: error.type,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
      
      console.error('[Embedding] API error:', errorDetails);
      
      // If this is the first attempt and the error is retryable, try once more
      if (attempt === 1 && (
        error.name === 'AbortError' ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('fetch')
      )) {
        console.warn('[Embedding] Retrying embedding generation...');
        return getEmbedding(text, attempt + 1);
      }
      
      // For other errors, use the fallback embedding
      console.warn('[Embedding] Using fallback embedding due to error');
      return simpleEmbedding(clean);
    }
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    
    console.error('[Embedding] Unexpected error, using fallback embedding:', {
      message: error.message,
      name: error.name,
      text: text?.substring(0, 100)
    });
    
    // Use the fallback embedding in case of any unexpected errors
    return simpleEmbedding(clean);
  }
};

// Function to search Pinecone
const searchPinecone = async (query, topK = 3) => {
  if (!pinecone) {
    console.error('Pinecone client not initialized');
    return [];
  }
  
  if (!pineconeIndexName) {
    console.error('Pinecone index name not configured');
    return [];
  }
  
  try {
    console.log(`Searching Pinecone for: "${query}"`);
    
    // Get the embedding for the query
    const queryEmbedding = await getEmbedding(query);
    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      console.error('Failed to generate valid embedding for query');
      return [];
    }
    
    // Get the Pinecone index
    let index;
    try {
      index = pinecone.index(pineconeIndexName);
    } catch (error) {
      console.error('Failed to get Pinecone index:', error);
      return [];
    }
    
    // Query the index
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
};

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
};

export default async function handler(req, res) {
  const requestId = Date.now();
  console.log(`\n=== New Chat Request (ID: ${requestId}) ===`);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'method_not_allowed',
      message: 'Only POST requests are supported',
      requestId
    });
  }

  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
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
    
    // Determine appropriate status code and error message
    let statusCode = 500;
    let errorMessage = 'An unexpected error occurred';
    
    if (error.message.includes('unauthorized') || error.message.includes('401')) {
      statusCode = 401;
      errorMessage = 'Authentication failed. Please check your API keys.';
    } else if (error.message.includes('rate limit')) {
      statusCode = 429; // Too Many Requests
      errorMessage = 'Rate limit exceeded. Please try again later.';
    }
    
    return res.status(statusCode).json({
      success: false,
      error: error.name || 'server_error',
      message: errorMessage,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { 
        details: error.message,
        stack: error.stack 
      })
    });
  }
}
