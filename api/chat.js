import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';

// Initialize services with error handling
let groq;
let pinecone;
let hf;

try {
  // Initialize Groq
  groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || ''
  });

  // Initialize Pinecone
  pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || '',
    environment: process.env.PINECONE_ENVIRONMENT || ''
  });

  // Initialize Hugging Face for embeddings
  hf = new HfInference(process.env.HUGGINGFACE_API_KEY || '');
} catch (error) {
  console.error('Failed to initialize services:', error);
}

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
    if (!pinecone) {
      throw new Error('Pinecone client not initialized');
    }

    const index = pinecone.Index(process.env.PINECONE_INDEX || '');
    const queryEmbedding = await getEmbedding(query);

    const queryResponse = await index.query({
      vector: queryEmbedding[0],
      topK,
      includeMetadata: true,
      includeValues: false
    });

    return queryResponse.matches || [];
  } catch (error) {
    console.error('Error querying Pinecone:', error);
    throw new Error('Failed to query knowledge base');
  }
}

// Generate response using Groq with context from Pinecone
async function generateResponseWithContext(messages, query) {
  try {
    // 1. Get relevant context from Pinecone
    const contextResults = await queryPinecone(query);
    
    // 2. Format the context for the prompt
    let context = '';
    if (contextResults.length > 0) {
      context = contextResults
        .map((result, i) => {
          const source = result.metadata?.source || 'Unknown source';
          const text = result.metadata?.text || result.metadata?.content || '';
          return `[${i + 1}] Source: ${source}\n${text}`;
        })
        .join('\n\n');
    }

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

    // 5. Call Groq API
    const completion = await groq.chat.completions.create({
      messages: groqMessages,
      model: 'mixtral-8x7b-32768',
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1,
      stream: false,
    });

    // 6. Format response with sources if available
    const aiResponse = completion.choices[0]?.message?.content || 
                      "I'm sorry, I couldn't generate a response at this time.";

    // 7. Include sources in the response
    const sources = contextResults.length > 0
      ? contextResults.map(r => ({
          text: r.metadata?.text || r.metadata?.content || '',
          source: r.metadata?.source || 'Unknown source',
          score: r.score
        }))
      : [];

    return {
      response: aiResponse,
      sources,
      model: completion.model,
      usage: completion.usage,
      created: completion.created
    };
  } catch (error) {
    console.error('Error in generateResponseWithContext:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
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
      const response = await generateResponseWithContext(body.messages, userMessage);

      // Return the response
      return res.status(200).json({
        success: true,
        ...response
      });

    } catch (error) {
      console.error('Error in /api/chat:', error);
      
      // Handle different types of errors
      if (error.message.includes('API key') || error.message.includes('authentication')) {
        return res.status(401).json({
          error: 'Authentication error',
          message: 'Invalid or missing API key',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      } else if (error.message.includes('Pinecone') || error.message.includes('knowledge base')) {
        return res.status(503).json({
          error: 'Knowledge base unavailable',
          message: 'Unable to access the knowledge base',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      } else if (error.message.includes('embedding')) {
        return res.status(500).json({
          error: 'Processing error',
          message: 'Failed to process the input text',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      } else {
        return res.status(500).json({
          error: 'Internal server error',
          message: 'An unexpected error occurred',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }
  }

  // Handle unsupported methods
  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
  return res.status(405).json({
    error: `Method ${req.method} not allowed`,
    allowedMethods: ['GET', 'POST', 'OPTIONS']
  });
}