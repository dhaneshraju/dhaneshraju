
import { Pinecone } from '@pinecone-database/pinecone'; 
import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';

// Initialize with environment variables (Vite prefixed for client-side compatibility)
const groqApiKey = process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY;
const pineconeApiKey = process.env.VITE_PINECONE_API_KEY || process.env.PINECONE_API_KEY;
const pineconeEnvironment = process.env.VITE_PINECONE_ENVIRONMENT || process.env.PINECONE_ENVIRONMENT || 'us-west1-gcp';
const hfApiKey = process.env.VITE_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY;
const pineconeIndexName = process.env.VITE_PINECONE_INDEX || 'gleaming-cypress';

// Update the validation object
const requiredVars = {
  'VITE_GROQ_API_KEY or GROQ_API_KEY': groqApiKey,
  'VITE_PINECONE_API_KEY or PINECONE_API_KEY': pineconeApiKey,
  'VITE_PINECONE_INDEX or PINECONE_INDEX': pineconeIndexName,
  'VITE_PINECONE_ENVIRONMENT or PINECONE_ENVIRONMENT': pineconeEnvironment,
  'VITE_HUGGINGFACE_API_KEY or HUGGINGFACE_API_KEY': hfApiKey
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
let pineconeIndex; // Store the index instance

// Initialize clients with retry logic
async function initializeClients() {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[API] Initializing clients (attempt ${attempt}/${maxRetries})`);
      
      // Initialize Groq
      groq = new Groq({
        auth: groqApiKey,
        timeout: 10000
      });

      // Initialize Pinecone client with the latest API
      pinecone = new Pinecone({
        apiKey: pineconeApiKey,
        // For the latest version, we only need the API key
        // The environment/region is included in the index name
      });
      
      console.log('[API] Pinecone client initialized');
      
      if (!pinecone) {
        throw new Error('Failed to initialize Pinecone client');
      }
      
      try {
        // Get the index reference during initialization
        pineconeIndex = pinecone.Index(pineconeIndexName);
        console.log(`[API] Pinecone initialized with index: ${pineconeIndexName}`);
        
        // Test the Pinecone connection
        try {
          const stats = await pineconeIndex.describeIndexStats();
          console.log('[API] Successfully connected to Pinecone index. Stats:', {
            dimension: stats.dimension,
            indexFullness: stats.indexFullness,
            totalVectorCount: stats.totalVectorCount,
            namespaces: stats.namespaces ? Object.keys(stats.namespaces) : []
          });
          
          // Verify we can query the index
          const testQuery = await pineconeIndex.query({
            vector: new Array(384).fill(0), // Test with zero vector
            topK: 1,
            includeMetadata: true
          });
          console.log('[API] Test query successful');
          
        } catch (error) {
          console.error('[API] Failed to connect to Pinecone index:', error.message);
          console.error('Error details:', {
            message: error.message,
            code: error.code,
            status: error.status,
            stack: error.stack
          });
          throw new Error(`Failed to connect to Pinecone index: ${error.message}`);
        }
      } catch (error) {
        console.error('[API] Error initializing Pinecone index:', error.message);
        throw new Error(`Failed to initialize Pinecone index: ${error.message}`);
      }

      // Initialize Hugging Face
      hf = new HfInference(hfApiKey);

      
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
    console.log('Generating embedding for text...');
    
    // Clean and normalize the input text
    const cleanText = text
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .trim()
      .substring(0, 1000);  // Limit input length
    
    // Use the latest HF inference API
    const response = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: cleanText,
      options: { 
        wait_for_model: true,
        use_cache: true
      }
    });
    
    // Handle different response formats
    let embedding = [];
    if (Array.isArray(response)) {
      // Flatten nested arrays
      embedding = response.flat(Infinity);
    } else if (response && typeof response === 'object') {
      // Handle object response by taking values
      if (response.embeddings) {
        embedding = response.embeddings;
      } else if (response.embedding) {
        embedding = response.embedding;
      } else {
        embedding = Object.values(response);
      }
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
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    if (attempt === 1) {
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
    
    try {
    if (!pineconeIndex) {
      throw new Error('Pinecone index not initialized');
    }
    
    console.log('[API] Querying Pinecone with embedding length:', queryEmbedding.length);
    console.log('[API] Pinecone index name:', pineconeIndexName);
    console.log('[API] Pinecone environment:', pineconeEnvironment);
      
      // Query the index using the latest API for v6+
      try {
        // Query without any filter
        const queryResponse = await pineconeIndex.query({
          vector: queryEmbedding,
          topK: Math.min(topK * 2, 10), // Get more results to increase chances of matches
          includeMetadata: true,
          includeValues: false
        });
        
        if (!queryResponse.matches || queryResponse.matches.length === 0) {
          console.log('[API] No matches found in Pinecone');
          return [];
        }

        // Log match details for debugging
        console.log(`[API] Found ${queryResponse.matches.length} matches`);
        queryResponse.matches.forEach((match, i) => {
          console.log(`[API] Match ${i + 1}:`);
          console.log(`  Score: ${match.score}`);
          console.log(`  Content Type: ${match.metadata?.contentType || 'N/A'}`);
          console.log(`  Document Type: ${match.metadata?.documentType || 'N/A'}`);
          console.log(`  Text preview: ${match.metadata?.text?.substring(0, 100)}...`);
        });

        // Filter out low-scoring matches
        const MIN_SCORE = 0.6; // Adjust this threshold as needed
        const filteredMatches = queryResponse.matches.filter(match => match.score >= MIN_SCORE);
        
        if (filteredMatches.length === 0) {
          console.log(`[API] No matches met the minimum score threshold of ${MIN_SCORE}`);
          return [];
        }

        console.log(`[API] Returning ${filteredMatches.length} matches after filtering`);
        return filteredMatches;
      } catch (error) {
        console.error('[API] Error querying Pinecone:', {
          message: error.message,
          code: error.code,
          status: error.status
        });
        throw new Error(`Failed to query Pinecone: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to query Pinecone index:', error);
      console.error('Pinecone error details:', {
        message: error.message,
        code: error.code,
        status: error.status,
        indexName: import.meta.env.VITE_PINECONE_INDEX_NAME,
        environment: import.meta.env.VITE_PINECONE_ENVIRONMENT
      });
      return [];
    }
    
  } catch (error) {
    console.error('Error searching Pinecone:', error);
    console.error('Pinecone search error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      indexName: pineconeIndexName,
      environment: pineconeEnvironment,
      stack: error.stack
    });
    return [];
  }
};

async function generateResponse(query, context) {
  try {
    const formattedContext = context.map((item, i) => 
      `--- Source ${i + 1} ---\n${item.metadata.text}`
    ).join('\n\n');

    let systemPrompt;
    
    if (context.length > 0) {
      // Group context by document type for better organization
      const contextByType = context.reduce((acc, item) => {
        const type = item.metadata?.documentType || 'general';
        if (!acc[type]) acc[type] = [];
        acc[type].push(item.metadata?.text || '');
        return acc;
      }, {});
      
      // Format the context for the prompt
      const contextSections = Object.entries(contextByType).map(([type, texts]) => {
        return `## ${type.charAt(0).toUpperCase() + type.slice(1)}\n${texts.join('\n\n')}`;
      }).join('\n\n');
      
      systemPrompt = `You are Dhanesh Raju's AI assistant. Use the following context to answer the user's question about Dhanesh Raju. 
If the information is not in the context, say you don't have that specific information but can answer other questions about Dhanesh.

Context:
${contextSections}`;
      
      console.log('[API] Using context for response generation');
    } else {
      systemPrompt = `You are Dhanesh Raju's AI assistant. Answer questions about Dhanesh Raju based on your general knowledge. 
If you don't know something specific, say you don't have that information but can help with other questions about Dhanesh.`;
      console.log('[API] No context available, using general knowledge');
    }

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      model: 'llama3-70b-8192',
      temperature: 0.7,
      max_tokens: 2000,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1
    });

    return completion.choices[0]?.message?.content || "I couldn't generate a response based on the available information.";

  } catch (error) {
    console.error('Error generating response:', error);
    console.error('Groq API error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      stack: error.stack
    });
    return "I'm sorry, I encountered an error while processing your request. Please try again later.";
  }
}

// Main API handler
export default async function handler(req, res) {
  const requestId = Date.now();
  console.log(`\n=== New Chat Request (ID: ${requestId}) ===`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'method_not_allowed', 
      message: 'Only POST requests are supported' 
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