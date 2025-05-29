// /api/chat.js - Enhanced with better error handling and timeouts
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';

// Initialize with environment variables
const groqApiKey = process.env.GROQ_API_KEY;
const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeEnv = process.env.PINECONE_ENVIRONMENT || 'gcp-starter';
const hfApiKey = process.env.HUGGINGFACE_API_KEY;
const pineconeIndexName = process.env.PINECONE_INDEX;

// Validate required environment variables
const requiredEnvVars = {
  'GROQ_API_KEY': groqApiKey,
  'PINECONE_API_KEY': pineconeApiKey,
  'HUGGINGFACE_API_KEY': hfApiKey,
  'PINECONE_INDEX': pineconeIndexName
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// Initialize clients with error handling
let groq, pinecone, hf;

try {
  groq = new Groq({ apiKey: groqApiKey });
  hf = new HfInference(hfApiKey);
  // Pinecone will be initialized on first use to prevent connection issues
} catch (error) {
  console.error('Failed to initialize API clients:', error);
  throw new Error(`Failed to initialize API clients: ${error.message}`);
}

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
const GROQ_TEMPERATURE = 0.7;
const GROQ_MAX_TOKENS = 2000;
const GROQ_TIMEOUT = 30000; // 30 seconds

const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
const EMBEDDING_MAX_LENGTH = 512; // Max characters to process
const EMBEDDING_TIMEOUT = 10000; // 10 seconds

/**
 * Generates an embedding vector for the given text using Hugging Face's inference API
 * @param {string} text - The input text to generate embedding for
 * @returns {Promise<number[]>} - The embedding vector
 * @throws {Error} If the embedding generation fails
 */
const getEmbedding = async (text) => {
  const startTime = Date.now();
  let timeoutId;
  
  try {
    // Input validation
    if (!text || typeof text !== 'string') {
      throw new Error('Input text must be a non-empty string');
    }
    
    // Clean and truncate the input text
    const clean = text.trim().substring(0, EMBEDDING_MAX_LENGTH);
    if (!clean) {
      throw new Error('Text is empty after cleaning');
    }
    
    console.log(`[Embedding] Generating for text (${clean.length} chars):`, 
      clean.substring(0, 50) + (clean.length > 50 ? '...' : ''));
    
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
              'Content-Type': 'application/json'
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
      
      // Provide more specific error messages
      if (error.name === 'AbortError') {
        throw new Error('Embedding generation timed out');
      } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        throw new Error('Could not connect to the embedding service');
      } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
        throw new Error('Authentication failed for embedding service');
      } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
        throw new Error('Embedding service rate limit exceeded');
      } else if (error.message.includes('model') && error.message.includes('not found')) {
        throw new Error('Embedding model not found');
      }
      
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    
    const errorDetails = {
      message: error.message,
      name: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      text: text?.substring(0, 100)
    };
    
    console.error('[Embedding] Critical error:', errorDetails);
    
    // Re-throw with a consistent error format
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
};

const queryPinecone = async (query) => {
  const startTime = Date.now();
  let timeoutId;
  
  try {
    console.log('[Pinecone] Starting query...');
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
      console.error('[Pinecone] Invalid query:', query);
      throw new Error('Query must be a non-empty string');
    }
    
    // Add timeout to the Pinecone query
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), PINECONE_QUERY_TIMEOUT);
    
    // Get the embedding for the query
    console.log('[Pinecone] Generating embedding for query...');
    const embedding = await getEmbedding(query);
    
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Failed to generate valid embedding for query');
    }
    
    // Initialize Pinecone if not already done
    if (!pinecone) {
      console.log('[Pinecone] Initializing Pinecone client...');
      pinecone = new Pinecone({
        apiKey: pineconeApiKey,
        environment: pineconeEnv
      });
    }
    
    // Query Pinecone
    console.log(`[Pinecone] Querying index: ${pineconeIndexName}`);
    const index = pinecone.index(pineconeIndexName);
    
    const results = await index.query({
      vector: embedding,
      topK: PINECONE_TOP_K,
      includeMetadata: true,
      includeValues: false,
    }).catch(error => {
      console.error('[Pinecone] Query error:', error);
      throw new Error(`Query failed: ${error.message}`);
    });
    
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    
    if (!results || !Array.isArray(results.matches)) {
      console.warn('[Pinecone] Unexpected response format:', results);
      return [];
    }
    
    // Filter out low-scoring results and format the response
    const filteredResults = results.matches
      .filter(match => match.score >= PINECONE_MIN_SCORE)
      .map((match, index) => ({
        id: match.id || `result-${index}`,
        score: match.score || 0,
        text: match.metadata?.text || '',
        source: match.metadata?.source || 'unknown',
        metadata: match.metadata || {}
      }));
    
    console.log(`[Pinecone] Query completed in ${duration}ms. Found ${filteredResults.length} relevant results.`);
    
    if (filteredResults.length === 0) {
      console.warn('[Pinecone] No relevant results found for query:', query.substring(0, 100));
    }
    
    return filteredResults;
    
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    
    const errorDetails = {
      message: error.message,
      name: error.name,
      type: error.type,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      query: query?.substring(0, 100)
    };
    
    console.error('[Pinecone] Error in queryPinecone:', errorDetails);
    
    // Don't throw the error, just log it and return an empty array
    // This allows the chat to continue with just the LLM's knowledge
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Pinecone] Continuing without vector search results due to error');
    }
    
    return [];
  }
};

const generateResponse = async (messages, contextResults, attempt = 1) => {
  const startTime = Date.now();
  let timeoutId;
  
  try {
    console.log('[Groq] Starting response generation...');
    
    // Input validation
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('No messages provided');
    }
    
    // Format the context from Pinecone results
    const context = Array.isArray(contextResults) && contextResults.length > 0
      ? contextResults
          .filter(result => result?.text)
          .map((result, i) => `[${i + 1}] ${result.text}`)
          .join('\n\n')
      : 'No relevant context found.';
    
    // Create the system message with context
    const systemMessage = {
      role: 'system',
      content: `You are Sophon, an AI assistant trained on Dhanesh Raju's background. 
Be helpful, warm, and professional. Answer briefly with Markdown formatting.

Use the following context to answer questions. If you don't know the answer, say so.\n\nContext:\n${context}`
    };
    
    // Combine system message with user messages (ensure they're in the right format)
    const conversation = [
      systemMessage,
      ...messages.filter(msg => 
        msg && 
        typeof msg === 'object' && 
        msg.role && 
        msg.content &&
        ['system', 'user', 'assistant'].includes(msg.role)
      ).map(msg => ({
        role: msg.role,
        content: String(msg.content).substring(0, 10000) // Limit content length
      }))
    ];
    
    // Choose the model to use (with fallback)
    const modelToUse = attempt === 1 ? GROQ_MODEL : GROQ_MODEL_FALLBACK;
    
    // Add timeout to the Groq API call
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT);
    
    console.log(`[Groq] Sending request to ${modelToUse} with ${conversation.length} messages`);
    
    try {
      // Call Groq API
      const response = await groq.chat.completions.create(
        {
          messages: conversation,
          model: modelToUse,
          temperature: GROQ_TEMPERATURE,
          max_tokens: GROQ_MAX_TOKENS,
        },
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'DhaneshPortfolio/1.0.0',
            'Content-Type': 'application/json'
          }
        }
      );
      
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      if (!response?.choices?.[0]?.message?.content) {
        console.warn('[Groq] Unexpected response format:', response);
        throw new Error('Received invalid response format from AI service');
      }
      
      const responseContent = response.choices[0].message.content.trim();
      console.log(`[Groq] Response generated in ${duration}ms (${responseContent.length} chars)`);
      
      return responseContent || 'I apologize, but I could not generate a response at this time.';
      
    } catch (apiError) {
      // Handle model deprecation specifically
      if (attempt === 1 && 
          (apiError.message.includes('model_decommissioned') || 
           apiError.message.includes('model not found'))) {
        console.warn(`[Groq] Model ${modelToUse} not available, falling back to ${GROQ_MODEL_FALLBACK}`);
        return generateResponse(messages, contextResults, attempt + 1);
      }
      throw apiError; // Re-throw other errors
    }
    
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    
    const errorDetails = {
      message: error.message,
      name: error.name,
      type: error.type,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      messageCount: Array.isArray(messages) ? messages.length : 0,
      hasContext: Array.isArray(contextResults) && contextResults.length > 0,
      attempt
    };
    
    console.error('[Groq] Error:', errorDetails);
    
    // Provide user-friendly error messages
    if (error.name === 'AbortError') {
      throw new Error('AI service request timed out. Please try again.');
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      throw new Error('Could not connect to the AI service. Please check your internet connection.');
    } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
      throw new Error('Authentication failed. Please check your API key and try again.');
    } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
      throw new Error('Rate limit exceeded. Please try again in a few moments.');
    } else if (error.message.includes('context length') || error.message.includes('too many tokens')) {
      throw new Error('The conversation is too long. Please start a new conversation.');
    } else if (error.message.includes('model') && error.message.includes('not found')) {
      throw new Error('The AI model is currently unavailable. Please try again later.');
    } else if (error.message.includes('invalid_request') || error.message.includes('validation_error')) {
      throw new Error('Invalid request. Please try again with a different message.');
    } else if (error.message.includes('model_decommissioned')) {
      throw new Error('The AI model has been updated. Please refresh the page and try again.');
    }
    
    // Fallback to a generic error message
    throw new Error('Sorry, I encountered an error while processing your request. Please try again.');
  }
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method Not Allowed',
      message: 'Only POST requests are allowed' 
    });
  }

  try {
    // Parse request body
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      console.error('[API] Error parsing request body:', parseError);
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON',
        message: 'The request body must be valid JSON'
      });
    }

    // Validate request body
    if (!body) {
      console.error('[API] Empty request body');
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Request body is required'
      });
    }

    // Extract user message
    let userMessage;
    if (body.message) {
      userMessage = body.message;
    } else if (Array.isArray(body.messages)) {
      const userMsg = body.messages.find(m => m.role === 'user');
      userMessage = userMsg?.content;
    }

    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === '') {
      console.error('[API] No valid user message found');
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'A non-empty message is required'
      });
    }

    console.log(`[API] Received message: ${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}`);
    
    // Process the message
    const messages = [{ role: 'user', content: userMessage }];
    
    try {
      // Get relevant context from Pinecone
      let context = [];
      try {
        context = await queryPinecone(userMessage);
        console.log(`[API] Retrieved ${context.length} context items`);
      } catch (embeddingError) {
        console.error('[API] Error getting context from Pinecone:', embeddingError);
        // Continue without context if embedding fails
        context = [];
      }
      
      // Generate response using the context (or without it if context fetching failed)
      const responseText = await generateResponse(messages, context);
      
      // Prepare response data
      const responseData = {
        success: true,
        response: responseText,
        timestamp: new Date().toISOString()
      };
      
      // Only include sources if we have them
      if (context.length > 0) {
        responseData.sources = context.map((item, index) => ({
          id: index,
          source: item.source || 'unknown',
          text: item.text?.substring(0, 200) || '',
          score: item.score || 0
        }));
      }
      
      // Return successful response
      return res.status(200).json(responseData);
      
    } catch (error) {
      console.error('[API] Error processing request:', error);
      
      // Provide more specific error messages based on error type
      let statusCode = 500;
      let errorMessage = 'An unexpected error occurred';
      
      if (error.message.includes('timed out') || error.name === 'AbortError') {
        statusCode = 504; // Gateway Timeout
        errorMessage = 'The request took too long to process. Please try again.';
      } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
        statusCode = 401;
        errorMessage = 'Authentication failed. Please check your API keys.';
      } else if (error.message.includes('rate limit')) {
        statusCode = 429; // Too Many Requests
        errorMessage = 'Rate limit exceeded. Please try again later.';
      }
      
      return res.status(statusCode).json({
        success: false,
        error: error.name || 'Server Error',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      });
    }
    
  } catch (error) {
    console.error('[API] Unhandled error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
}
