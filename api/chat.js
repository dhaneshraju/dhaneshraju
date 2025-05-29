// /api/chat.js - Refactored for Vercel
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT || 'gcp-starter'  // Default to gcp-starter if not specified
});

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
const indexName = process.env.PINECONE_INDEX;

// Disable noisy logs in production
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
}

const getEmbedding = async (text) => {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid input text for embedding');
    }
    
    const clean = text.trim().substring(0, 1000);
    console.log('Generating embedding for text:', clean.substring(0, 50) + '...');
    
    const res = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: clean,
      options: { 
        wait_for_model: true,
        use_cache: true
      }
    });
    
    if (!res || !Array.isArray(res)) {
      throw new Error('Invalid response from Hugging Face API');
    }
    
    const embedding = Array.isArray(res[0]) ? res[0] : res;
    if (!embedding || embedding.length === 0) {
      throw new Error('Empty embedding received');
    }
    
    console.log('Generated embedding with length:', embedding.length);
    return embedding;
  } catch (e) {
    console.error('Embedding error:', e.message);
    throw new Error('Embedding failed');
  }
};

const queryPinecone = async (query) => {
  try {
    console.log('Starting Pinecone query...');
    
    if (!query || typeof query !== 'string') {
      throw new Error('Invalid query: Query must be a non-empty string');
    }
    
    console.log('Generating embedding for query...');
    const vector = await getEmbedding(query);
    
    if (!vector || !Array.isArray(vector) || vector.length === 0) {
      throw new Error('Failed to generate valid embedding vector');
    }
    
    console.log('Connecting to Pinecone index:', indexName);
    const index = pinecone.index(indexName);
    
    if (!index) {
      throw new Error('Failed to connect to Pinecone index');
    }
    
    console.log('Sending query to Pinecone...');
    const result = await index.query({
      vector,
      topK: 3,
      includeMetadata: true,
      includeValues: false
    });
    
    console.log('Pinecone query successful, matches found:', (result.matches || []).length);
    return result.matches || [];
    
  } catch (error) {
    console.error('Pinecone query failed:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      status: error.status,
      response: error.response?.data
    });
    
    // Provide more specific error messages based on error type
    let errorMessage = 'Knowledge base query failed';
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      errorMessage = 'Could not connect to the knowledge base service';
    } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
      errorMessage = 'Authentication failed for knowledge base service';
    } else if (error.message.includes('index not found')) {
      errorMessage = `Knowledge base index not found: ${indexName}`;
    } else if (error.message.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded for knowledge base service';
    }
    
    throw new Error(errorMessage);
  }
};

const generateResponse = async (messages, contextResults) => {
  const context = contextResults.map((item, i) => {
    const txt = item.metadata?.text || ''; 
    return `--- Source ${i + 1} ---\n${txt.substring(0, 300)}...`;
  }).join('\n\n');

  const systemPrompt = `You are Sophon, an AI assistant trained on Dhanesh Raju's background. Be helpful, warm, and professional. Answer briefly with Markdown formatting.\n\nContext:\n${context || 'No relevant context found.'}`;

  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const completion = await groq.chat.completions.create({
    messages: fullMessages,
    model: 'mixtral-8x7b-32768',
    temperature: 0.7,
    max_tokens: 1024
  });

  return completion.choices[0]?.message?.content || 'No response available.';
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userMessage = body.message || body.messages?.find(m => m.role === 'user')?.content;
    if (!userMessage) return res.status(400).json({ error: 'No message found' });

    const messages = [ { role: 'user', content: userMessage } ];
    const context = await queryPinecone(userMessage);
    const responseText = await generateResponse(messages, context);

    return res.status(200).json({
      success: true,
      response: responseText,
      sources: context.map((r, i) => ({
        id: r.id,
        source: r.metadata?.source || 'unknown',
        text: r.metadata?.text?.substring(0, 200) || '',
        score: r.score || 0
      }))
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Server Error',
      message: error.message
    });
  }
}
