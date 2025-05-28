import React, { useState, useEffect, useRef, useCallback } from "react";
import Sophon from "./components/Sophon";
import { Mic, MessageCircle, Music, Music2, Github, Linkedin, Twitter, Mail, Brain } from "lucide-react";
import './App.css';
import TerminalName from './components/TerminalName';
import Terminal from './components/Terminal';
import HeartbeatWave from './components/HeartbeatWave';
import DynamicMusicPlayer from "./components/DynamicMusicPlayer";
import MicSpectralAnalyzer from './components/MicSpectralAnalyzer';
import VoiceAssistant from './components/VoiceAssistant';
import { Button } from "./components/ui/button";
import { useNavigate } from "react-router-dom";
import About from "./pages/About";

export default function App() {
  const [micActive, setMicActive] = useState(false);
  const [musicMuted, setMusicMuted] = useState(true);
  const [userInteracted, setUserInteracted] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(6);
  const [showChat, setShowChat] = useState(false);
  const [inputMode, setInputMode] = useState('voice'); // 'voice' or 'text'
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [showTerminal, setShowTerminal] = useState(true);
  const navigate = useNavigate();
  const terminalRef = useRef(null);

  const terminalMessages = [
    "Initializing neural interface...",
    // "Loading consciousness modules...",
    // "Establishing quantum connection...",
    // "Synchronizing with the digital ether...",
    // "Initialization complete. Welcome back, Dhanesh.",
    // "",
    "Hi, I'm Sophon - an advanced AI system designed by Mr. Dhanesh Raju as his personal assistant.",
    "You can interact with me using the microphone or chat buttons.",
    "",
    "Please note: some features are currently disabled for ethical considerations and are still under development.",
    "I'm here to assist you and provide answers on behalf of Mr. Dhanesh Raju.",
    "",
    "To explore his full body of work and capabilities, click the Neural Node button at the bottom to visit the About page."
  ];

  const handleTerminalComplete = useCallback(() => {
    // Hide terminal after a delay when messages complete
    const timer = setTimeout(() => {
      setShowTerminal(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleNeuralNodeClick = () => navigate('/about');

  useEffect(() => {
    const onFirstInteraction = () => {
      if (!userInteracted) {
        setUserInteracted(true);
        setMusicMuted(false);
      }
      window.removeEventListener('click', onFirstInteraction);
      window.removeEventListener('keydown', onFirstInteraction);
    };
    window.addEventListener('click', onFirstInteraction);
    window.addEventListener('keydown', onFirstInteraction);
    return () => {
      window.removeEventListener('click', onFirstInteraction);
      window.removeEventListener('keydown', onFirstInteraction);
    };
  }, [userInteracted]);

  const toggleMic = () => {
    const newState = !micActive;
    setMicActive(newState);
    // Show console when mic is activated
    if (newState) {
      setShowChat(true);
      setInputMode('voice');
    }
  };
  const toggleMusicMute = () => {
    if (!micActive) setMusicMuted(prev => !prev);
  };

  const musicVolume = 0.01;

  const getOpacity = () => {
    const minZoom = 600;
    const maxZoom = 800;
    const clamped = Math.min(Math.max(zoomLevel, minZoom), maxZoom);
    return (clamped - minZoom) / (maxZoom - minZoom);
  };

  const uiOpacity = getOpacity();

  return (
    <div className="w-full h-screen fixed bg-black overflow-hidden">
      {/* Light Beam */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-[2] h-[70vh] w-[60vw] pointer-events-none">
        <div className="w-full h-full bg-gradient-to-b from-white/40 via-white/10 to-transparent blur-[120px] opacity-50 rounded-full" />
      </div>

      {/* Terminal - Left Side - Show when zoomed in, hide when zoomed out */}
      {showTerminal && (
        <div 
          className="fixed left-8 top-1/2 transform -translate-y-1/2 z-10 w-1/3 max-w-md hidden md:block transition-opacity duration-300"
          style={{ 
            // Show when zoomed in (higher zoomLevel), hide when zoomed out (lower zoomLevel)
            opacity: zoomLevel > 700 ? 1 : 0,
            pointerEvents: zoomLevel > 700 ? 'auto' : 'none',
            transition: 'opacity 0.3s ease-in-out',
            visibility: zoomLevel > 700 ? 'visible' : 'hidden'
          }}>
          <Terminal 
            ref={terminalRef}
            messages={terminalMessages} 
            speed={20}  // Lower number = faster typing
            showCursor={true}
            onComplete={handleTerminalComplete}
          />
        </div>
      )}

      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        <Sophon active={micActive || isAISpeaking} onZoomChange={setZoomLevel} isAISpeaking={isAISpeaking} />
        <DynamicMusicPlayer mute={micActive || musicMuted} page="mainPage" volume={musicVolume} />
        <VoiceAssistant 
          isActive={micActive} 
          isOpen={showChat} 
          onClose={() => setShowChat(false)}
          inputMode={inputMode}
          onInputModeChange={setInputMode}
          onAISpeakingChange={setIsAISpeaking}
        />
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none" style={{ opacity: uiOpacity, transition: 'opacity 0.5s ease' }}>
        <div className="h-full flex flex-col justify-between p-4 sm:p-6 md:p-8">

          {/* Top Left */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex flex-col space-y-4 sm:space-y-6 pointer-events-auto">
            <div className="flex space-x-4 sm:space-x-6">
              <a href="https://github.com/dhaneshraju" target="_blank" rel="noopener noreferrer" title="GitHub Profile">
                <Github className="w-5 h-5 sm:w-6 sm:h-6 text-white hover:text-cyan-400 transition" />
              </a>
              <a href="https://linkedin.com/in/dhaneshraju" target="_blank" rel="noopener noreferrer" title="LinkedIn Profile">
                <Linkedin className="w-5 h-5 sm:w-6 sm:h-6 text-white hover:text-cyan-400 transition" />
              </a>
              {/* <a href="https://twitter.com/yourusername" target="_blank" rel="noopener noreferrer" title="Twitter Profile">
                <Twitter className="w-5 h-5 sm:w-6 sm:h-6 text-white hover:text-cyan-400 transition" />
              </a> */}
              <a href="mailto:dhanesh8880@gmail.com" title="Send Email">
                <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-white hover:text-cyan-400 transition" />
              </a>
            </div>

            {/* Analyzer Container */}
            <div className="flex flex-col gap-2 w-[min(80vw,280px)]">
              <div className="h-16 sm:h-20 w-full bg-transparent">
                <HeartbeatWave />
              </div>
              <div className="h-16 sm:h-20 w-full bg-transparent">
                <MicSpectralAnalyzer micActive={micActive} />
              </div>
            </div>
          </div>

          {/* Top Right */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-3 pointer-events-auto">
            <button 
              onClick={toggleMic} 
              title="Toggle Voice Interaction" 
              className="control-button"
            >
              <Mic className={`w-5 h-5 sm:w-6 sm:h-6 ${micActive ? 'text-cyan-400' : 'text-white'}`} />
            </button>
            <button 
              onClick={() => {
                setShowChat(prev => !prev);
                setInputMode('text');
              }}
              title="Chat" 
              className={`control-button ${showChat ? 'text-cyan-400' : 'text-white'}`}
            >
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button 
              onClick={toggleMusicMute} 
              title={musicMuted ? "Unmute Music" : "Mute Music"} 
              className="control-button"
            >
              {(musicMuted || micActive) ? (
                <Music className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              ) : (
                <Music2 className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
              )}
            </button>
          </div>

          {/* Bottom Left - Hero Section
          <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 pointer-events-auto">
            <div className="flex flex-col items-start space-y-2 font-mono text-white select-text">
              <h1 className="text-[clamp(1rem,4vw,2.5rem)] font-semibold leading-tight tracking-wide">
                I write thoughts into code,<br />
                and code into <span className="text-cyan-400 font-bold">consciousness</span>.
              </h1>
              <p className="text-[clamp(0.75rem,1.5vw,1.125rem)] text-neutral-300 tracking-wider mt-1">
                Engineer of Minds — <span className="text-cyan-200">Natural & Machine</span>
              </p>
              <Button className="glow-button mt-3 animate-pulse" title="Trace My Identity" onClick={handleNeuralNodeClick}>
                <Brain className="mr-2" />
                Neural Node
              </Button>
            </div>
          </div> */}

          {/* Bottom Right - Name */}
          <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 text-right pointer-events-auto">
            <TerminalName text="Dhanesh Raju" />
          </div>
        </div>

        {/* Bottom Left - Hero Section */}
        <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 pointer-events-auto">
          <div className="flex flex-col items-start space-y-2 font-mono text-white select-text">
            <h1 className="text-[clamp(0.875rem,3vw,1.75rem)] font-semibold leading-tight tracking-wide">
              I write thoughts into code,<br />
              and code into <span className="keyword-glow text-cyan-400 font-bold">consciousness</span>.
            </h1>
            <p className="text-[clamp(0.65rem,1.25vw,1rem)] text-neutral-300 tracking-wider mt-1">
              Engineer of Minds — <span className="text-cyan-200">Natural & Machine</span>
            </p>
            <Button 
              className="glow-button mt-4 hover:bg-cyan-700 transition-colors duration-200" 
              title="Trace My Identity" 
              onClick={handleNeuralNodeClick}
            >
              <Brain className="mr-2 h-4 w-4" />
              Neural Node
            </Button>
          </div>
        </div>

        {/* Bottom Right - Name */}
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 text-right pointer-events-auto">
          <div className="font-mono text-white text-[clamp(1rem,2vw,1.5rem)] tracking-widest">
            <TerminalName text="Dhanesh Raju" />
          </div>
        </div>
      </div>
    </div>
  );
}