import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HfInference } from '@huggingface/inference';
import { Pinecone } from '@pinecone-database/pinecone';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCUMENTS_DIR = path.join(__dirname, 'documents');

// Initialize Hugging Face for embeddings
const hf = new HfInference(process.env.VITE_HUGGINGFACE_API_KEY);

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.VITE_PINECONE_API_KEY,
});
const index = pinecone.index(process.env.VITE_PINECONE_INDEX);

// Simple text splitter
function splitText(text, chunkSize = 500, overlap = 100) {
  const result = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + chunkSize;
    if (end > text.length) {
      end = text.length;
    }
    
    // Try to find a sentence boundary
    const chunk = text.slice(start, end);
    const lastPunctuation = Math.max(
      chunk.lastIndexOf('.'),
      chunk.lastIndexOf('!'),
      chunk.lastIndexOf('?')
    );
    
    if (lastPunctuation > chunkSize / 2) {
      end = start + lastPunctuation + 1;
    }
    
    result.push(text.slice(start, end).trim());
    start = end - overlap;
    
    if (start <= 0) start = 0;
    if (start >= text.length) break;
  }
  
  return result;
}

// Function to read text from different file types
async function readFileContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  try {
    if (ext === '.pdf') {
      // For PDFs, we'll use a simple text extractor
      const { fromBuffer } = await import('pdf-parse/lib/pdf-parse.js');
      const data = await fs.readFile(filePath);
      const pdfData = await fromBuffer(data);
      return pdfData.text;
    } else if (ext === '.txt') {
      // For text files
      return await fs.readFile(filePath, 'utf-8');
    } else if (ext === '.docx') {
      // For DOCX files, we'll use a simple text extractor
      const { default: mammoth } = await import('mammoth');
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else {
      console.warn(`Unsupported file type: ${ext}`);
      return '';
    }
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return '';
  }
}

// Function to generate embeddings
async function getEmbedding(text) {
  try {
    const response = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: text.replace(/\s+/g, ' ').trim().substring(0, 1000)
    });

    let embedding = Array.isArray(response) 
      ? response.flat(Infinity) 
      : Object.values(response);

    // Ensure 384 dimensions
    if (embedding.length !== 384) {
      embedding = embedding.length > 384 
        ? embedding.slice(0, 384) 
        : [...embedding, ...new Array(384 - embedding.length).fill(0)];
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? embedding.map(val => val / norm) : embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return new Array(384).fill(0);
  }
}

// Process a single file
async function processFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`Processing file: ${fileName}`);
  
  // Read the file content
  const content = await readFileContent(filePath);
  if (!content) {
    console.log(`No content found in ${fileName}`);
    return [];
  }

  // Split into chunks
  const chunks = splitText(content);
  console.log(`Split into ${chunks.length} chunks`);

  // Process each chunk
  const vectors = [];
  
  for (let i = 0; i < chunks.length; i++) {
    try {
      console.log(`Processing chunk ${i + 1}/${chunks.length}`);
      
      const text = chunks[i];
      const embedding = await getEmbedding(text);
      
      vectors.push({
        id: `${fileName}-${i}-${Date.now()}`,
        values: embedding,
        metadata: {
          text: text,
          source: fileName,
          chunk: i,
          documentType: path.basename(filePath, path.extname(filePath))
        }
      });
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error processing chunk ${i}:`, error);
    }
  }
  
  return vectors;
}

// Main function
async function main() {
  try {
    // Read all files from the documents directory
    const files = await fs.readdir(DOCUMENTS_DIR);
    
    if (files.length === 0) {
      console.error('No documents found in the documents directory');
      return;
    }
    
    console.log(`Found ${files.length} files to process`);
    
    // Process each file
    let allVectors = [];
    for (const file of files) {
      if (file.startsWith('.')) continue; // Skip hidden files
      
      const filePath = path.join(DOCUMENTS_DIR, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        const vectors = await processFile(filePath);
        allVectors = [...allVectors, ...vectors];
      }
    }
    
    if (allVectors.length === 0) {
      console.log('No vectors to upload');
      return;
    }
    
    // Upload to Pinecone in batches (Pinecone has a limit per batch)
    console.log(`Uploading ${allVectors.length} vectors to Pinecone...`);
    const BATCH_SIZE = 32; // Smaller batch size to avoid timeouts
    
    for (let i = 0; i < allVectors.length; i += BATCH_SIZE) {
      const batch = allVectors.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allVectors.length / BATCH_SIZE);
      
      console.log(`Uploading batch ${batchNum}/${totalBatches} (${batch.length} vectors)`);
      
      try {
        await index.namespace('').upsert(batch);
        console.log(`Uploaded batch ${batchNum} successfully`);
      } catch (error) {
        console.error(`Error uploading batch ${batchNum}:`, error);
      }
      
      // Add delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('All documents processed and uploaded successfully!');
    
  } catch (error) {
    console.error('Error processing documents:', error);
  }
}

// Run the main function
main();
