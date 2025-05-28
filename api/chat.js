import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';

// Initialize services with error handling and retries
let groq;
let pinecone;
let hf;
let servicesInitialized = false;
let serviceInitializationError = null;

/**
 * Initialize all required services with retry logic
 */
async function initializeServices() {
  if (servicesInitialized) return true;
  
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`Initializing services (Attempt ${retryCount + 1}/${maxRetries})...`);
      
      // Check for required environment variables
      const requiredEnvVars = {
        'GROQ_API_KEY': process.env.GROQ_API_KEY,
        'PINECONE_API_KEY': process.env.PINECONE_API_KEY,
        'PINECONE_ENDPOINT': process.env.PINECONE_ENDPOINT,
        'PINECONE_INDEX': process.env.PINECONE_INDEX,
        'HUGGINGFACE_API_KEY': process.env.HUGGINGFACE_API_KEY
      };
      
      const missingVars = Object.entries(requiredEnvVars)
        .filter(([key, value]) => {
          // Special handling for PINECONE_ENDPOINT to ensure it's not empty
          if (key === 'PINECONE_ENDPOINT') {
            return !value || value.trim() === '';
          }
          return !value;
        })
        .map(([key]) => key);
      
      if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
      }
      
      // Initialize Groq
      groq = new Groq({
        apiKey: process.env.GROQ_API_KEY,
        timeout: 10000 // 10 second timeout
      });
      console.log('✅ Groq initialized successfully');

      // Initialize Pinecone for serverless environment
      console.log('Initializing Pinecone serverless...');
      
      // Get Pinecone endpoint from environment variable
      const pineconeEndpoint = process.env.PINECONE_ENDPOINT;
      if (!pineconeEndpoint) {
        throw new Error('PINECONE_ENDPOINT environment variable is required');
      }
      
      // Log the configuration (without the full endpoint for security)
      console.log('Pinecone configuration:', {
        hasEndpoint: !!pineconeEndpoint,
        hasApiKey: !!process.env.PINECONE_API_KEY,
        index: process.env.PINECONE_INDEX
      });
      
      // Initialize Pinecone with custom fetch and configuration
      const fetchWithRetry = async (url, options = {}) => {
        const maxRetries = 3;
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
          try {
            const response = await fetch(url, {
              ...options,
              headers: {
                'Content-Type': 'application/json',
                'Api-Key': process.env.PINECONE_API_KEY,
                ...(options.headers || {})
              }
            });
            
            if (!response.ok) {
              const error = new Error(`HTTP error! status: ${response.status}`);
              error.status = response.status;
              throw error;
            }
            
            return response;
          } catch (error) {
            lastError = error;
            console.warn(`Attempt ${i + 1} failed:`, error.message);
            if (i < maxRetries - 1) {
              // Exponential backoff
              const delay = Math.pow(2, i) * 1000;
              console.log(`Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        throw lastError || new Error('Failed to fetch after multiple attempts');
      };
      
      // Initialize Pinecone with custom fetch and configuration
      pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
        environment: 'serverless', // Dummy value
        fetch: fetchWithRetry
      });
      
      console.log('Pinecone client initialized with custom fetch implementation');
      
      // For serverless, we need to create a custom index configuration
      const indexName = process.env.PINECONE_INDEX;
      if (!indexName) {
        throw new Error('PINECONE_INDEX environment variable is required');
      }
      
      // Test Pinecone serverless connection
      try {
        console.log('Testing Pinecone serverless connection...');
        
        // Get a reference to the index with the full endpoint
        const index = pinecone.Index(indexName, {
          host: pineconeEndpoint
        });
        
        // Try a simple operation to test the connection
        console.log('Sending test request to Pinecone serverless...');
        const indexStats = await index.describeIndexStats();
        
        console.log('✅ Pinecone serverless connected successfully', {
          index: indexName,
          stats: indexStats,
          endpoint: pineconeEndpoint
        });
      } catch (pineconeError) {
        console.error('❌ Pinecone serverless connection failed:', {
          message: pineconeError.message,
          code: pineconeError.code,
          status: pineconeError.status,
          stack: pineconeError.stack,
          endpoint: pineconeEndpoint,
          index: indexName
        });
        
        // Provide more helpful error messages for common issues
        if (pineconeError.message.includes('404') || pineconeError.status === 404) {
          throw new Error(`Pinecone index "${indexName}" not found. Please verify the index exists in your Pinecone project.`);
        } else if (pineconeError.message.includes('401') || pineconeError.status === 401) {
          throw new Error('Invalid Pinecone API key. Please verify your API key is correct.');
        } else if (pineconeError.message.includes('403') || pineconeError.status === 403) {
          throw new Error('Access denied. Please check your API key and project permissions.');
        } else if (pineconeError.message.includes('timeout') || pineconeError.code === 'ECONNABORTED') {
          throw new Error('Connection to Pinecone timed out. Please check your network connection.');
        } else if (pineconeError.message.includes('ENOTFOUND') || pineconeError.code === 'ENOTFOUND') {
          throw new Error(`Could not resolve Pinecone endpoint: ${pineconeEndpoint}. Please verify the endpoint is correct.`);
        } else if (pineconeError.message.includes('Unexpected token') || pineconeError.message.includes('JSON Parse')) {
          throw new Error('Received an invalid response from Pinecone. Please verify your endpoint and API key.');
        }
      }

      // Initialize Hugging Face for embeddings
      hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
      
      // Test Hugging Face connection with a simple request
      await hf.featureExtraction({
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        inputs: 'test',
        options: { wait_for_model: true }
      });
      console.log('✅ Hugging Face initialized and responsive');
      
      servicesInitialized = true;
      serviceInitializationError = null;
      return true;
      
    } catch (error) {
      retryCount++;
      serviceInitializationError = error;
      
      const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
      console.error(`❌ Service initialization failed (Attempt ${retryCount}/${maxRetries}):`, {
        error: error.message,
        stack: error.stack,
        retryIn: `${waitTime}ms`
      });
      
      if (retryCount < maxRetries) {
        console.log(`Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error('❌ Max retries reached. Service initialization failed.');
        return false;
      }
    }
  }
  
  return false;
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

// Generate embedding for text using Hugging Face with retries and fallback models
async function getEmbedding(text, retries = 2) {
  const cacheKey = text.trim().toLowerCase();
  
  // Return cached embedding if available
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }

  // List of models to try in order of preference
  const models = [
    'sentence-transformers/all-MiniLM-L6-v2',  // Fast and good for most cases
    'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',  // Multilingual support
    'sentence-transformers/all-mpnet-base-v2'  // Higher quality but slower
  ];

  let lastError;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    console.log(`Trying model: ${model}`);
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1} with model: ${model}`);
        
        // Add a small delay between retries
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
        
        // Make the API call
        const response = await hf.featureExtraction({
          model: model,
          inputs: text,
          options: {
            wait_for_model: true,  // Wait if model is loading
            use_cache: true        // Use cached results if available
          }
        });
        
        if (!response || !Array.isArray(response) || response.length === 0) {
          throw new Error('Empty response from Hugging Face');
        }
        
        // Cache the successful response
        embeddingCache.set(cacheKey, response);
        console.log(`Successfully generated embedding using ${model}`);
        return response;
        
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt + 1} failed for model ${model}:`, error.message);
        
        // If we get a rate limit error, wait before retrying
        if (error.message.includes('rate limit') || error.status === 429) {
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
  }
  
  // If we get here, all models and retries failed
  const errorMessage = `All embedding generation attempts failed. Last error: ${lastError?.message || 'Unknown error'}`;
  console.error(errorMessage, { text: text.substring(0, 100) + '...' });
  throw new Error(`Failed to generate text embedding after multiple attempts: ${errorMessage}`);
}

// Query Pinecone for relevant context with enhanced error handling
// Query Pinecone serverless with better error handling
async function queryPinecone(query, topK = 3) {
  try {
    console.log('Starting Pinecone query...');
    
    // Ensure services are initialized
    if (!servicesInitialized) {
      console.log('Services not initialized, initializing...');
      await initializeServices();
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

    console.log(`Querying Pinecone serverless index: ${pineconeIndex}`);
    
    try {
      if (!process.env.PINECONE_ENDPOINT) {
        throw new Error('PINECONE_ENDPOINT environment variable is required');
      }
      
      // Parse the endpoint to get the environment and index name
      const endpointUrl = new URL(process.env.PINECONE_ENDPOINT);
      const hostParts = endpointUrl.hostname.split('.');
      const environment = hostParts[2]; // e.g., 'aped-4627-b74a'
      const indexName = hostParts[0];    // e.g., 'gleaming-cypress-0dwhbk1'
      
      console.log('Creating Pinecone index reference:', {
        environment,
        indexName: pineconeIndex,
        endpoint: `${endpointUrl.protocol}//${endpointUrl.host}`,
        hostname: endpointUrl.hostname
      });
      
      // Create index with serverless configuration
      const index = pinecone.Index(pineconeIndex, {
        host: endpointUrl.hostname,
        apiKey: process.env.PINECONE_API_KEY,
        fetch: (url, options) => {
          // Ensure the URL is correct for serverless
          const serverlessUrl = new URL(url);
          if (!serverlessUrl.hostname.endsWith('.pinecone.io')) {
            serverlessUrl.hostname = endpointUrl.hostname;
          }
          
          console.log('Pinecone request:', {
            method: options?.method || 'GET',
            url: serverlessUrl.toString(),
            headers: options?.headers ? Object.keys(options.headers) : []
          });
          
          return fetch(serverlessUrl.toString(), {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              'Api-Key': process.env.PINECONE_API_KEY,
              ...(options?.headers || {})
            }
          });
        }
      });
      
      console.log('Pinecone index reference created successfully');
      
      console.log('Successfully connected to Pinecone serverless index');
      
      console.log('Generating embedding for query...');
      const queryEmbedding = await getEmbedding(query);
      
      if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
        throw new Error('Failed to generate query embedding: Empty or invalid embedding');
      }
      
      console.log(`Generated embedding with ${queryEmbedding[0]?.length || 0} dimensions`);

      console.log('Sending query to Pinecone serverless...');
      const queryResponse = await index.query({
        vector: queryEmbedding[0],
        topK,
        includeMetadata: true,
        includeValues: false
      });

      const matches = queryResponse.matches || [];
      console.log(`Pinecone query successful. Found ${matches.length} matches`);
      
      // Log a sample of the matches for debugging
      if (matches.length > 0) {
        console.log('Sample match:', {
          id: matches[0].id,
          score: matches[0].score,
          metadata: {
            source: matches[0].metadata?.source,
            text: (matches[0].metadata?.text || '').substring(0, 100) + '...'
          }
        });
      } else {
        console.log('No matches found in Pinecone index');
      }
      
      return matches;
      
    } catch (pineconeError) {
      console.error('Pinecone query error:', {
        message: pineconeError.message,
        name: pineconeError.name,
        code: pineconeError.code,
        status: pineconeError.status,
        stack: pineconeError.stack
      });
      
      // Enhanced error handling for different Pinecone error scenarios
      if (pineconeError.message.includes('API key') || pineconeError.status === 401) {
        throw new Error('Invalid Pinecone API key or environment');
      } else if (pineconeError.message.includes('index not found') || pineconeError.status === 404) {
        throw new Error(`Pinecone index not found: ${pineconeIndex}. Please check if the index exists and is accessible.`);
      } else if (pineconeError.message.includes('connect') || 
                pineconeError.message.includes('timeout') || 
                pineconeError.message.includes('network')) {
        throw new Error('Could not connect to Pinecone service. Please check your network connection and try again.');
      } else if (pineconeError.status === 429) {
        throw new Error('Rate limit exceeded for Pinecone API. Please try again later.');
      }
      
      throw new Error(`Failed to query knowledge base: ${pineconeError.message}`);
    }
    
  } catch (error) {
    console.error('Error in queryPinecone:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code: error.code,
      status: error.status
    });
    
    // Rethrow with a more user-friendly message
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
    const systemPrompt = `You are Sophon, an advanced AI assistant created by Dhanesh Raju. You are helpful, knowledgeable, and always aim to provide accurate and useful information.

Guidelines for your responses:
- Always be polite, professional, and friendly
- If you don't know something, say so rather than making up information
- Use markdown formatting for better readability (e.g., **bold**, *italic*, lists, etc.)
- Keep responses concise but thorough
- Use a warm, approachable tone
- If relevant, you can reference Dhanesh's expertise in AI and software development

Context from Dhanesh's knowledge base:
${context || 'No specific context found that directly answers the question.'}

Current conversation history:
${messages.filter(m => m.role === 'user').map((m, i) => `User: ${m.content}`).join('\n')}

Sophon: `;

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
    let aiResponse = completion.choices[0]?.message?.content || 
                   "I'm sorry, I couldn't generate a response at this time.";
    
    // Clean up the response
    aiResponse = aiResponse
      .replace(/^Sophon: /, '')  // Remove any leading "Sophon: "
      .trim();


    // 7. Include sources in the response
    const sources = contextResults.length > 0
      ? contextResults.map(r => ({
          text: (r.metadata?.text || r.metadata?.content || '').substring(0, 500) + '...',
          source: r.metadata?.source || 'Unknown source',
          score: r.score,
          id: r.id
        }))
      : [];

    // Format the final response
    const response = {
      response: aiResponse,
      sources: sources.map(s => ({
        ...s,
        // Truncate source text further if needed for the response
        text: s.text.length > 150 ? s.text.substring(0, 150) + '...' : s.text
      })),
      model: completion.model,
      usage: completion.usage,
      created: completion.created,
      assistant: 'Sophon'  // Identify the assistant
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
  
  // Log environment info (without sensitive data)
  const envInfo = {
    NODE_ENV: process.env.NODE_ENV,
    NODE_VERSION: process.version,
    PLATFORM: process.platform,
    // Only show if variables are set, not their values
    requiredEnvVars: {
      HAS_GROQ_KEY: !!process.env.GROQ_API_KEY,
      HAS_PINECONE_KEY: !!process.env.PINECONE_API_KEY,
      HAS_PINECONE_ENDPOINT: !!process.env.PINECONE_ENDPOINT,
      HAS_PINECONE_INDEX: !!process.env.PINECONE_INDEX,
      HAS_HF_KEY: !!process.env.HUGGINGFACE_API_KEY
    },
    // Show partial endpoint for debugging (first 10 chars)
    pineconeEndpointPreview: process.env.PINECONE_ENDPOINT 
      ? `${process.env.PINECONE_ENDPOINT.substring(0, 10)}...` 
      : 'not set'
  };
  
  console.log('Environment Info:', JSON.stringify(envInfo, null, 2));
  
  // Check for required environment variables early
  const missingVars = [
    !process.env.GROQ_API_KEY && 'GROQ_API_KEY',
    !process.env.PINECONE_API_KEY && 'PINECONE_API_KEY',
    !process.env.PINECONE_ENDPOINT && 'PINECONE_ENDPOINT',
    !process.env.PINECONE_INDEX && 'PINECONE_INDEX',
    !process.env.HUGGINGFACE_API_KEY && 'HUGGINGFACE_API_KEY'
  ].filter(Boolean);
  
  if (missingVars.length > 0) {
    const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}`;
    console.error('❌', errorMsg);
    return res.status(500).json({
      error: 'Configuration Error',
      message: errorMsg,
      timestamp: new Date().toISOString()
    });
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return res.status(200).end();
  }
  
  // Initialize services if not already done
  if (!servicesInitialized) {
    console.log('Services not initialized, initializing now...');
    const initialized = await initializeServices();
    if (!initialized) {
      console.error('Failed to initialize services:', serviceInitializationError);
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Failed to initialize required services',
        details: {
          error: serviceInitializationError?.message || 'Unknown error',
          serviceStatus: {
            groq: !!groq,
            pinecone: !!pinecone,
            huggingface: !!hf,
            lastError: serviceInitializationError?.message || null
          },
          environment: {
            nodeEnv: process.env.NODE_ENV,
            missingEnvVars: {
              GROQ_API_KEY: !process.env.GROQ_API_KEY,
              PINECONE_API_KEY: !process.env.PINECONE_API_KEY,
              PINECONE_ENVIRONMENT: !process.env.PINECONE_ENVIRONMENT,
              PINECONE_INDEX: !process.env.PINECONE_INDEX,
              HUGGINGFACE_API_KEY: !process.env.HUGGINGFACE_API_KEY
            }
          }
        },
        timestamp: new Date().toISOString()
      });
    }
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