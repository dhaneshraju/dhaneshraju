
import { Pinecone } from '@pinecone-database/pinecone'; 
import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';

// Initialize with environment variables
const groqApiKey = process.env.VITE_GROQ_API_KEY;
const pineconeApiKey = process.env.VITE_PINECONE_API_KEY;
const pineconeHost = process.env.VITE_PINECONE_HOST;  // <-- NEW env var: full host URL
const hfApiKey = process.env.VITE_HUGGINGFACE_API_KEY;
const pineconeIndexName = process.env.VITE_PINECONE_INDEX;

// Validate required environment variables
const requiredVars = {
  'VITE_GROQ_API_KEY': groqApiKey,
  'VITE_PINECONE_API_KEY': pineconeApiKey,
  'VITE_PINECONE_INDEX': pineconeIndexName,
  'VITE_PINECONE_HOST': pineconeHost,
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

      // Initialize Pinecone client for serverless index
      pinecone = new Pinecone({
        apiKey: pineconeApiKey,
        indexHost: pineconeHost, // full URL like https://gleaming-cypress-xxx.pinecone.io
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

      
      console.log('[API] All clients initialized successfully');
      return;
      
    } catch (error) {
      lastError = error;
      console.error(`[API] Initialization attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`[API] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Failed to initialize clients after ${maxRetries} attempts: ${lastError.message}`);
}

// Initialize all clients
await initializeClients();

// Disable noisy logs in production except important
if (process.env.NODE_ENV === 'production') {
  const originalLog = console.log;
  console.log = (...args) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[')) {
      originalLog(...args);
    }
  };
}

// Constants
const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
const EMBEDDING_MAX_LENGTH = 512;
const EMBEDDING_TIMEOUT = 10000;

// Simple fallback embedding
const simpleEmbedding = (text) => {
  const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = cleanText.split(/\s+/).filter(Boolean);
  const embedding = new Array(384).fill(0);

  words.forEach(word => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) % 384;
    }
    embedding[hash] = (embedding[hash] || 0) + 1;
  });

  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
  return embedding.map(v => v / norm);
};

// Get embedding from Hugging Face or fallback
const getEmbedding = async (text, attempt = 1) => {
  if (!hf) {
    console.warn('Hugging Face client not initialized, using fallback embedding');
    return simpleEmbedding(text || '');
  }

  if (!text || typeof text !== 'string') {
    console.warn('[Embedding] Invalid input, using fallback embedding');
    return simpleEmbedding(String(text || ''));
  }

  const clean = text.trim().substring(0, EMBEDDING_MAX_LENGTH);
  if (!clean) return simpleEmbedding('');

  if (!hfApiKey) {
    console.warn('[Embedding] No API key, using fallback embedding');
    return simpleEmbedding(clean);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT);

    const response = await hf.featureExtraction({
      model: EMBEDDING_MODEL,
      inputs: clean,
      options: { wait_for_model: true, use_cache: true },
      fetch: (url, options) => fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...(options.headers || {}),
          'User-Agent': 'DhaneshPortfolio/1.0.0',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hfApiKey}`
        }
      })
    });

    clearTimeout(timeoutId);

    let embedding;
    if (Array.isArray(response)) {
      embedding = response[0] || response;
    } else if (response && typeof response === 'object') {
      embedding = response.embeddings || response.embedding || response;
    }

    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Invalid embedding format');
    }

    return embedding;

  } catch (error) {
    console.error('[Embedding] Error:', error.message);
    if (attempt === 1 && ['AbortError', 'FetchError'].includes(error.name)) {
      console.warn('[Embedding] Retrying...');
      return getEmbedding(text, attempt + 1);
    }
    console.warn('[Embedding] Using fallback embedding');
    return simpleEmbedding(clean);
  }
};

// Search Pinecone for context
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
    
    const queryEmbedding = await getEmbedding(query);
    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      console.error('Failed to generate valid embedding for query');
      return [];
    }
    
    let index;
    try {
      // Note: use .Index() to get the index in pinecone client v2
      index = pinecone.Index(pineconeIndexName);
    } catch (error) {
      console.error('Failed to get Pinecone index:', error);
      return [];
    }
    
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

// Generate chat response using Groq with context
async function generateResponse(query, context) {
  try {
    const formattedContext = context.map((item, i) => 
      `--- Source ${i + 1} ---\n${item.metadata.text}`
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
    console.error('Error generating response:', error.message);
    return "I'm sorry, I encountered an error while processing your request.";
  }
}

// Main API handler
export default async function handler(req, res) {
  const requestId = Date.now();
  console.log(`\n=== New Chat Request (ID: ${requestId}) ===`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

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

    // Search Pinecone
    const searchResults = await searchPinecone(userQuery, 3);

    if (searchResults.length === 0) {
      console.log(`[${requestId}] No relevant context found. Falling back to Groq general chat.`);
      const fallbackResponse = await groq.chat.completions.create({
        messages: [
          ...messages,
          {
            role: "system",
            content: "You are a helpful AI assistant. Answer the user's question based on your general knowledge."
          }
        ],
        model: 'llama3-8b-8192',
        temperature: 0.7,
        max_tokens: 1000
      });

      return res.json({
        id: fallbackResponse.id,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: fallbackResponse.model,
        choices: fallbackResponse.choices.map(choice => ({
          index: choice.index,
          message: {
            role: choice.message.role,
            content: choice.message.content
          },
          finish_reason: choice.finish_reason
        })),
        usage: fallbackResponse.usage
      });
    }

    console.log(`[${requestId}] Found ${searchResults.length} relevant context items. Generating response...`);
    const responseText = await generateResponse(userQuery, searchResults);

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
        prompt_tokens: 0,  // Add actual token count if needed
        completion_tokens: 0,
        total_tokens: 0
      }
    });

  } catch (error) {
    console.error(`[${requestId}] Error:`, error);

    let statusCode = 500;
    let errorMessage = 'An unexpected error occurred';

    if (error.message.includes('unauthorized') || error.message.includes('401')) {
      statusCode = 401;
      errorMessage = 'Authentication failed. Please check your API keys.';
    } else if (error.message.includes('rate limit')) {
      statusCode = 429;
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