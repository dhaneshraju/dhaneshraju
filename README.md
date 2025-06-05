# Dhanesh Raju - Interactive Portfolio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/vite-%5E4.0.0-646CFF)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/react-%5E18.2.0-61DAFB)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/three.js-%5E0.154.0-000000)](https://threejs.org/)

An immersive, AI-powered portfolio website featuring 3D visualizations, voice interaction, and real-time chat capabilities. Built with modern web technologies to showcase professional work and skills in an engaging, interactive format.

## ✨ Features

- **3D Interactive Interface**
  - Real-time 3D rendering with Three.js and React Three Fiber
  - Smooth animations and transitions using GSAP and Framer Motion
  - Dynamic camera controls and scene management

- **AI-Powered Interaction**
  - Voice-controlled interface with speech recognition
  - AI chat assistant powered by Groq and Hugging Face
  - Context-aware responses using Pinecone vector database

- **Immersive Audio Experience**
  - Dynamic background music system
  - Voice activity visualization
  - Audio spectrum analysis

- **Responsive Design**
  - Fully responsive layout that works on all devices
  - Adaptive UI components with Tailwind CSS
  - Optimized performance for various screen sizes

- **Developer Experience**
  - Built with Vite for fast development and hot module replacement
  - TypeScript support for better code quality
  - Comprehensive ESLint and Prettier configuration

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or later
- npm 9.0.0 or later, or yarn 1.22.0 or later
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/dhanesh-portfolio.git
   cd dhanesh-portfolio/portfolio_git_repo
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn
   ```

3. **Set up environment variables**
   Copy the example environment file and update with your API keys:
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local` with your actual API keys.

4. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```
   The application will be available at `http://localhost:5173`

## 🔧 Configuration

### Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Server Configuration
VITE_API_URL=http://localhost:3000
NODE_ENV=development
PORT=3000

# API Keys (get these from respective services)
PINECONE_API_KEY=your_pinecone_api_key
GROQ_API_KEY=your_groq_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key

# Optional: Email Configuration
EMAILJS_SERVICE_ID=your_emailjs_service_id
EMAILJS_TEMPLATE_ID=your_emailjs_template_id
EMAILJS_PUBLIC_KEY=your_emailjs_public_key
```

## 🛠 Development

### Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint
- `npm run server` - Start the development server with nodemon

### Project Structure

```
src/
├── assets/            # Static assets (images, audio, etc.)
├── components/        # Reusable React components
│   ├── ui/            # UI components (buttons, inputs, etc.)
│   └── ...
├── pages/             # Page components
├── styles/            # Global styles and Tailwind configuration
├── utils/             # Utility functions and helpers
├── App.jsx            # Main application component
└── main.jsx           # Application entry point
```

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to a GitHub/GitLab/Bitbucket repository
2. Import the repository to [Vercel](https://vercel.com)
3. Configure the project settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build` or `yarn build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install` or `yarn`
4. Add all required environment variables in the Vercel dashboard
5. Deploy!

### Netlify

1. Push your code to a Git repository
2. Create a new site in [Netlify](https://www.netlify.com/)
3. Configure the build settings:
   - Build command: `npm run build` or `yarn build`
   - Publish directory: `dist`
4. Add environment variables in the Netlify dashboard
5. Deploy the site

## 🤖 AI Features

### Voice Assistant
- Speech-to-text and text-to-speech capabilities
- Natural language processing with Groq
- Context-aware responses using Pinecone vector database

### AI Chat
- Real-time chat interface
- Contextual responses based on conversation history
- Integration with multiple AI models

## 📚 Tech Stack

### Frontend
- [React 18](https://reactjs.org/) - UI Library
- [Vite](https://vitejs.dev/) - Build tool
- [Three.js](https://threejs.org/) - 3D rendering
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) - React renderer for Three.js
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Framer Motion](https://www.framer.com/motion/) - Animation library
- [GSAP](https://greensock.com/gsap/) - Animation library

### Backend
- [Node.js](https://nodejs.org/) - JavaScript runtime
- [Express](https://expressjs.com/) - Web framework
- [Pinecone](https://www.pinecone.io/) - Vector database
- [Groq](https://groq.com/) - AI inference API
- [Hugging Face](https://huggingface.co/) - AI models and embeddings

### Development Tools
- [TypeScript](https://www.typescriptlang.org/) - Type checking
- [ESLint](https://eslint.org/) - Code linting
- [Prettier](https://prettier.io/) - Code formatting
- [PostCSS](https://postcss.org/) - CSS processing

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Three.js](https://threejs.org/) for amazing 3D capabilities
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) for making Three.js with React amazing
- [Tailwind CSS](https://tailwindcss.com/) for utility-first CSS
- All the amazing open source libraries used in this project

## 📬 Contact

Dhanesh Raju - [dhanesh8880@gmail.com](mailto:dhanesh8880@gmail.com)

Project Link: [https://github.com/yourusername/dhanesh-portfolio](https://github.com/yourusername/dhanesh-portfolio)
