import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import logoAnimation from '../assets/animations/logo-animation.json';

const LandingPage = () => {
  const [timeLeft, setTimeLeft] = useState(15);
  const [redirectTimer, setRedirectTimer] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();

  // Handle window resize for responsive design
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Set a flag in session storage to indicate the landing page has been shown
    const hasSeenLanding = sessionStorage.getItem('hasSeenLanding');
    
    // Only set the flag if it doesn't exist
    if (!hasSeenLanding) {
      sessionStorage.setItem('hasSeenLanding', 'true');
    }
    
    // Comment out the immediate redirection for now
    // We'll handle the redirection with the timer
    // if (hasSeenLanding) {
    //   navigate('/app');
    //   return;
    // }

    // Set up the redirect timer
    const timer = setTimeout(() => {
      navigate('/app');
    }, 15000);
    setRedirectTimer(timer);

    // Set up the countdown timer
    const countdown = setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          clearInterval(countdown);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    // Clean up timers on component unmount
    return () => {
      clearTimeout(timer);
      clearInterval(countdown);
    };
  }, [navigate]);

  const handleSkip = () => {
    if (redirectTimer) {
      clearTimeout(redirectTimer);
    }
    navigate('/app');
  };

  // Responsive font sizes
  const getResponsiveFontSize = (baseSize, mobileMultiplier = 0.7) => {
    return isMobile ? `${baseSize * mobileMultiplier}rem` : `${baseSize}rem`;
  };

  // Responsive padding/margin
  const getResponsiveSpacing = (baseSize, mobileMultiplier = 0.7) => {
    return isMobile ? `${baseSize * mobileMultiplier}px` : `${baseSize}px`;
  };

  // Main container styles
  const containerStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
    color: 'white',
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden',
    zIndex: 1000,
    margin: 0,
    padding: 0,
    width: '100vw',
    height: '100vh'
  };

  // Main content area styles
  const mainContentStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    padding: isMobile ? '20px' : '40px',
    boxSizing: 'border-box',
    margin: 0,
    overflow: 'hidden',
    height: '100%',
    width: '100%'
  };

  // Welcome section styles
  const welcomeSectionStyle = {
    textAlign: 'center',
    maxWidth: '800px',
    width: '100%',
    margin: '0 auto',
    padding: '20px',
    boxSizing: 'border-box',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    marginTop: isMobile ? '-50px' : '0' // Adjust vertical centering
  };

  // Warning section styles
  const warningSectionStyle = {
    position: 'absolute',
    left: isMobile ? '20px' : '40px',
    bottom: isMobile ? '20px' : '50%',
    transform: isMobile ? 'none' : 'translateY(50%)',
    maxWidth: isMobile ? 'calc(100% - 40px)' : '400px',
    width: '100%',
    zIndex: 1,
    margin: 0,
    padding: 0
  };

  // Timer and skip button container
  const timerContainerStyle = {
    position: 'fixed',
    top: isMobile ? 'auto' : '50%',
    bottom: isMobile ? '20px' : 'auto',
    right: isMobile ? '20px' : '40px',
    left: isMobile ? 'auto' : 'auto',
    transform: isMobile ? 'none' : 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: isMobile ? '12px 16px' : '16px 24px',
    borderRadius: isMobile ? '20px' : '12px',
    backdropFilter: 'blur(5px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    maxWidth: isMobile ? 'auto' : '220px',
    gap: '8px'
  };

  // Rotating hourglass animation
  const spinKeyframes = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  return (
    <div style={containerStyle}>
      {/* Main Content Area */}
      <div style={mainContentStyle}>


        {/* Warning Section - Desktop */}
        {!isMobile && (
          <div style={warningSectionStyle}>
            <div style={{
              backgroundColor: 'rgba(255, 165, 0, 0.1)',
              borderLeft: '4px solid #ffa500',
              padding: '25px',
              borderRadius: '0 8px 8px 0',
              position: 'relative',
              maxWidth: '100%'
            }}>
              <div style={{
                position: 'absolute',
                left: '25px',
                top: '-15px',
                backgroundColor: 'black',
                padding: '0 10px',
                fontSize: '1.8rem',
                lineHeight: '1'
              }}>
                ⚠️
              </div>
              <p style={{
                margin: 0,
                fontSize: getResponsiveFontSize(1),
                color: 'rgba(255, 255, 255, 0.9)',
                fontStyle: 'italic',
                lineHeight: 1.7,
                fontFamily: 'inherit'
              }}>
                <strong>Heads up:</strong> This site is a live work-in-progress. For the best experience, please use a laptop, iPad, or tablet.
                Some features may not work as expected - especially in browsers like Brave or Firefox.
                You might encounter temporary issues such as audio glitches or loading delays. Im actively improving the experience. 
                Thanks for your patience - and feel free to share any feedback!
              </p>
            </div>
          </div>
        )}

        {/* Centered Logo Section */}
        <div style={welcomeSectionStyle}>
          <div style={{
            width: isMobile ? '250px' : '400px',
            height: isMobile ? '250px' : '400px',
            margin: '0 auto 20px',
            position: 'relative',
            zIndex: 1
          }}>
            <Lottie
              animationData={logoAnimation}
              loop={true}
              autoplay={true}
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          {/* Warning Section - Mobile */}
          {isMobile && (
            <div style={{
              backgroundColor: 'rgba(255, 165, 0, 0.1)',
              borderLeft: '4px solid #ffa500',
              padding: '20px',
              borderRadius: '0 8px 8px 0',
              position: 'relative',
              marginTop: '20px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{
                position: 'absolute',
                left: '15px',
                top: '-12px',
                backgroundColor: 'black',
                padding: '0 8px',
                fontSize: '1.5rem',
                lineHeight: '1'
              }}>
                ⚠️
              </div>
              <p style={{
                margin: 0,
                fontSize: getResponsiveFontSize(0.9),
                color: 'rgba(255, 255, 255, 0.9)',
                fontStyle: 'italic',
                lineHeight: 1.6,
                fontFamily: 'inherit'
              }}>
                <strong>Heads up:</strong> This site is a live work-in-progress. Some features may not work as expected—especially in mobile browsers.
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{spinKeyframes}</style>
      <div style={timerContainerStyle}>
        {/* Timer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'rgba(255, 255, 255, 0.9)'
        }}>
          <span style={{
            display: 'inline-block',
            fontSize: '1.2em',
            animation: 'spin 2s linear infinite',
            transformOrigin: 'center'
          }}>⏳</span>
          <span style={{
            fontSize: getResponsiveFontSize(0.95, 0.85),
            fontWeight: '500',
            letterSpacing: '0.3px',
            whiteSpace: 'nowrap'
          }}>
            Loading in {timeLeft} seconds
          </span>
        </div>
        
        {/* Skip Button */}
        <button
          onClick={handleSkip}
          style={{
            background: 'none',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'rgba(255, 255, 255, 0.8)',
            cursor: 'pointer',
            fontSize: '0.85em',
            padding: '4px 12px',
            borderRadius: '12px',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit',
            width: '100%',
            marginTop: '4px'
          }}
          onMouseOver={(e) => {
            e.target.style.color = 'white';
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseOut={(e) => {
            e.target.style.color = 'rgba(255, 255, 255, 0.8)';
            e.target.style.backgroundColor = 'transparent';
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
