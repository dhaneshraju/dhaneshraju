import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set environment variables
process.env.NODE_ENV = 'production';
process.env.VITE_APP_MODE = 'production';

console.log('Starting Vercel build process...');
console.log('Node version:', process.version);
console.log('NODE_ENV:', process.env.NODE_ENV);

const runCommand = (command, description) => {
  console.log(`\n=== ${description} ===`);
  console.log(`$ ${command}`);
  
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✓ ${description} completed successfully`);
    return true;
  } catch (error) {
    console.error(`✗ ${description} failed:`, error);
    return false;
  }
};

// Main build process
const build = async () => {
  console.log('Current working directory:', process.cwd());
  console.log('Directory contents:', fs.readdirSync('.'));
  
  // Install dependencies
  console.log('Installing production dependencies...');
  if (!runCommand('npm install --production=false --prefer-offline', 'Installing all dependencies')) {
    throw new Error('Failed to install dependencies');
  }

  // Install Vite and other build tools globally to make them available
  console.log('Installing Vite globally...');
  if (!runCommand('npm install -g vite', 'Installing Vite globally')) {
    console.log('Falling back to local Vite installation...');
    if (!runCommand('npm install --save-dev vite', 'Installing Vite locally')) {
      throw new Error('Failed to install Vite');
    }
  }

  // Build the frontend
  console.log('Running build script...');
  const buildCommand = fs.existsSync(path.join(process.cwd(), 'node_modules/.bin/vite')) 
    ? 'npx vite build' 
    : 'vite build';
    
  if (!runCommand(buildCommand, 'Building frontend')) {
    throw new Error('Frontend build failed');
  }

  // Verify build output
  const distPath = path.join(process.cwd(), 'dist');
  console.log('Looking for dist directory at:', distPath);
  
  if (!fs.existsSync(distPath)) {
    console.error('Build output not found. Current directory contents:');
    console.log(fs.readdirSync('.'));
    throw new Error(`Build output directory not found at ${distPath}`);
  }
  
  console.log('Build output found. Contents of dist directory:');
  console.log(fs.readdirSync(distPath));

  console.log('\n=== Build Output ===');
  const listFiles = (dir, prefix = '') => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        console.log(`${prefix}📁 ${file}/`);
        listFiles(fullPath, `${prefix}  `);
      } else {
        console.log(`${prefix}📄 ${file} (${(stat.size / 1024).toFixed(2)} KB)`);
      }
    });
  };
  
  listFiles(distPath);
  console.log('\nBuild completed successfully! 🚀');
};

// Run the build process
build().catch(error => {
  console.error('\n❌ Build failed:', error);
  process.exit(1);
});
