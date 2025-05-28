import { HfInference } from '@huggingface/inference';

// Function to create an embedding with the provided API key
export function createEmbedder(apiKey) {
  const hf = new HfInference(apiKey);
  
  return async function generateEmbedding(text) {
    try {
      const response = await hf.featureExtraction({
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        inputs: text.substring(0, 1000), // Limit input length
        options: { wait_for_model: true }
      });
      
      // Flatten the response and ensure it's an array
      let embedding = Array.isArray(response) ? response.flat(Infinity) : [];
      
      // Ensure we have exactly 384 dimensions
      if (embedding.length !== 384) {
        if (embedding.length > 384) {
          embedding = embedding.slice(0, 384);
        } else {
          const padding = new Array(384 - embedding.length).fill(0);
          embedding = [...embedding, ...padding];
        }
      }
      
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  };
}

/**
 * Generate embeddings for the given text using Hugging Face
 * @param {string} text - The text to generate embeddings for
 * @returns {Promise<number[]>} - The embedding vector
 */
export async function generateEmbedding(text) {
  try {
    const response = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: text.substring(0, 1000), // Limit input length
      options: { wait_for_model: true }
    });
    
    // Flatten the response and ensure it's an array
    let embedding = Array.isArray(response) ? response.flat(Infinity) : [];
    
    // Ensure we have exactly 384 dimensions
    if (embedding.length !== 384) {
      if (embedding.length > 384) {
        embedding = embedding.slice(0, 384);
      } else {
        const padding = new Array(384 - embedding.length).fill(0);
        embedding = [...embedding, ...padding];
      }
    }
    
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}
