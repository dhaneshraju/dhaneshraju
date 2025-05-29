import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles/global.css';  // Import global styles first
import './index.css';         // Then import component-specific styles
import App from "./App";
import About from "./pages/About";
import LandingPage from "./pages/LandingPage";

// Check if user has already seen the landing page in this session
const hasSeenLanding = sessionStorage.getItem('hasSeenLanding') === 'true';

const AppWithLanding = () => {
  // If user has already seen the landing page, redirect to /app
  // Otherwise, show the landing page
  return hasSeenLanding ? <Navigate to="/app" replace /> : <LandingPage />;
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppWithLanding />} />
        <Route path="/app" element={<App />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);