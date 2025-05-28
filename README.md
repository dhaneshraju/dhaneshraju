# My Portfolio

A modern portfolio website built with React, Vite, and Three.js.

## Features

- Responsive design
- 3D animations with Three.js
- Contact form
- Project showcase
- Blog section

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd dhanesh-portfolio
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

3. Create a `.env` file in the root directory and add your environment variables:
   ```
   VITE_API_URL=your_api_url
   # Add other environment variables here
   ```

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

## Deployment

### Deploying to Vercel

1. Push your code to a GitHub, GitLab, or Bitbucket repository.

2. Go to [Vercel](https://vercel.com) and sign in with your Git provider.

3. Click on "New Project" and import your repository.

4. Configure the project settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build` or `yarn build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install` or `yarn`

5. Add your environment variables in the Vercel dashboard:
   - Go to Project Settings > Environment Variables
   - Add all the variables from your `.env` file

6. Click "Deploy" and wait for the deployment to complete.

### Environment Variables

Make sure to set the following environment variables in your Vercel project:

- `VITE_API_URL`: Your API URL
- `PINECONE_API_KEY`: Your Pinecone API key
- `GROQ_API_KEY`: Your Groq API key
- `HUGGINGFACE_API_KEY`: Your Hugging Face API key
- Any other API keys or sensitive information

## Built With

- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Three.js](https://threejs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
