import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const Terminal = forwardRef(({ messages = [], speed = 50, showCursor = true, onComplete = () => {} }, ref) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const terminalRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastScrollY = useRef(0);
  const scrollThreshold = 100; // pixels to scroll before hiding
  
  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    hide: () => setIsVisible(false),
    show: () => setIsVisible(true)
  }), []);

  // Handle scroll events with improved detection
  useEffect(() => {
    let lastScrollTop = 0;
    let ticking = false;

    const handleScroll = () => {
      const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
      
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Only trigger if scrolled more than threshold (100px)
          if (Math.abs(currentScroll - lastScrollTop) > 100) {
            // Scrolling down
            if (currentScroll > lastScrollTop && currentScroll > 100) {
              setIsVisible(false);
            } 
            // Scrolling up
            else if (currentScroll < lastScrollTop) {
              setIsVisible(true);
            }
            
            lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
          }
          ticking = false;
        });
        
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle typing effect
  useEffect(() => {
    if (messages.length === 0) return;
    
    let timeoutId;
    const currentMessage = messages[currentMessageIndex];
    const isLastMessage = currentMessageIndex === messages.length - 1;
    
    if (isTyping) {
      if (displayedText.length < currentMessage.length) {
        timeoutId = setTimeout(() => {
          setDisplayedText(currentMessage.substring(0, displayedText.length + 1));
        }, speed);
      } else {
        // Wait before starting to delete or completing
        timeoutId = setTimeout(() => {
          if (isLastMessage) {
            onComplete?.();
          } else {
            setIsTyping(false);
          }
        }, 2000);
      }
    } else {
      if (displayedText.length > 0) {
        timeoutId = setTimeout(() => {
          setDisplayedText(displayedText.substring(0, displayedText.length - 1));
        }, speed / 2);
      } else {
        // Move to next message
        setIsTyping(true);
        setCurrentMessageIndex(prevIndex => (prevIndex + 1) % messages.length);
      }
    }

    // Auto-scroll to bottom
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }

    return () => clearTimeout(timeoutId);
  }, [displayedText, currentMessageIndex, isTyping, messages, speed, onComplete]);

  if (!isVisible) return null;
  
  return (
    <div 
      ref={terminalRef}
      className="terminal-window font-mono text-sm sm:text-base text-green-400 bg-black/70 backdrop-blur-sm border border-green-900/50 rounded-md p-4 h-[30vh] min-h-[200px] max-h-[400px] w-full max-w-2xl overflow-y-auto transition-opacity duration-300"
      style={{ opacity: isVisible ? 1 : 0 }}
    >
      <div className="terminal-header flex items-center gap-2 mb-3 pb-2 border-b border-green-900/30">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
        <span className="text-green-300 text-xs ml-2">terminal</span>
      </div>
      <div className="terminal-content font-mono">
        <span className="text-green-500">$ </span>
        <span className="text-green-200">{displayedText}</span>
        {showCursor && (
          <span className="animate-pulse">_</span>
        )}
      </div>
    </div>
  );
});

Terminal.displayName = 'Terminal';

export default Terminal;
