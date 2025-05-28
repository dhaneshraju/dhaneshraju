import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  // Load env file based on `mode` in the current directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Check if we're in development mode
  const isDev = command === 'serve';
  
  // HTTPS configuration - only for local development
  const httpsConfig = isDev && fs.existsSync('.cert/key.pem') && fs.existsSync('.cert/cert.pem')
    ? {
        key: fs.readFileSync('.cert/key.pem'),
        cert: fs.readFileSync('.cert/cert.pem'),
      }
    : false;

  return {
    plugins: [
      react(),
      // Enable basic SSL in development if certs exist
      isDev && httpsConfig && basicSsl()
    ].filter(Boolean),
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js'
        }
      }
    },
    base: '/',
    server: {
      port: 3000,
      open: true,
      https: httpsConfig,
      strictPort: true,
      host: true, // Listen on all network interfaces
      proxy: isDev ? {
        // Only configure proxy in development
        '/api': {
          target: 'https://localhost:3000',
          changeOrigin: true,
          secure: false,  // false because we're using self-signed certs in development
          ws: true,
          // Add this to handle self-signed certificates in development
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.error('Proxy error:', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Proxying request:', req.method, req.url);
            });
          }
        }
      } : undefined
    },
    // Explicitly define global constant replacements
    define: {
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
        VITE_GROQ_API_KEY: JSON.stringify(env.VITE_GROQ_API_KEY),
        VITE_PINECONE_API_KEY: JSON.stringify(env.VITE_PINECONE_API_KEY),
        VITE_PINECONE_ENVIRONMENT: JSON.stringify(env.VITE_PINECONE_ENVIRONMENT),
        VITE_PINECONE_INDEX: JSON.stringify(env.VITE_PINECONE_INDEX),
        VITE_PINECONE_PROJECT_ID: JSON.stringify(env.VITE_PINECONE_PROJECT_ID),
        VITE_HUGGINGFACE_API_KEY: JSON.stringify(env.VITE_HUGGINGFACE_API_KEY)
      }
    }
  };
});
