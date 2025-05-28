import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Send, Keyboard, X, Bot, Loader2, MessageCircle, Type } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ErrorBoundary } from './ErrorBoundary';

const VoiceAssistant = ({ isOpen, onClose, inputMode, onInputModeChange, onAISpeakingChange }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [error, setError] = useState('');
  const [inputText, setInputText] = useState('');
  const [language, setLanguage] = useState(() => {
    // Try to get language from browser or default to en-US
    return navigator.language || 'en-US';
  });
  const [browserSupport, setBrowserSupport] = useState({
    hasSpeechRecognition: false,
    isSecureContext: false,
    browserName: 'unknown',
    version: ''
  });

  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Check browser compatibility
  useEffect(() => {
    // In development, allow HTTP for localhost
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    
    // Allow insecure context in development for localhost
    const isSecure = window.isSecureContext || (isDevelopment && isLocalhost);
    
    const userAgent = window.navigator.userAgent;
    const userAgentLower = userAgent.toLowerCase();
    let browserName = 'unknown';
    let version = '';
    
    // Check for Safari (must check before Chrome since Chrome also contains 'safari' in its user agent)
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
      browserName = 'safari';
      const match = userAgent.match(/version\/(\d+)/i);
      version = match ? match[1] : 'unknown';
    } 
    // Check for Chrome/Chromium
    else if (/chrome|chromium|crios/i.test(userAgent)) {
      browserName = 'chrome';
    } 
    // Check for Firefox
    else if (/firefox|fxios/i.test(userAgent)) {
      browserName = 'firefox';
    } 
    // Check for Edge (must check before Chrome since Edge also contains 'chrome' in its user agent)
    else if (/edg/i.test(userAgent)) {
      browserName = 'edge';
    }
    
    // Check for speech recognition support
    const hasWebkitSpeechRecognition = 'webkitSpeechRecognition' in window;
    const hasStandardSpeechRecognition = 'SpeechRecognition' in window;
    const hasSpeechRecognition = hasWebkitSpeechRecognition || hasStandardSpeechRecognition;
    
    // Log detailed browser info
    console.log('=== BROWSER DETECTION ===');
    console.log('User Agent:', userAgent);
    console.log('Detected Browser:', browserName, version);
    console.log('Secure Context:', isSecure);
    console.log('Protocol:', window.location.protocol);
    console.log('Hostname:', window.location.hostname);
    console.log('Speech Recognition Support:', {
      'webkitSpeechRecognition': hasWebkitSpeechRecognition,
      'SpeechRecognition': hasStandardSpeechRecognition,
      'Available': hasSpeechRecognition
    });
    
    setBrowserSupport({
      hasSpeechRecognition,
      isSecureContext: isSecure,
      browserName,
      version
    });
  }, []);

  // Get supported languages
  const getSupportedLanguages = async (recognition) => {
    try {
      if ('langs' in recognition) {
        return recognition.langs();
      } else if ('getVoices' in window.speechSynthesis) {
        return new Promise((resolve) => {
          const voices = window.speechSynthesis.getVoices();
          if (voices.length) {
            resolve(Array.from(new Set(voices.map(v => v.lang))));
          } else {
            window.speechSynthesis.onvoiceschanged = () => {
              const voices = window.speechSynthesis.getVoices();
              resolve(Array.from(new Set(voices.map(v => v.lang))));
            };
          }
        });
      }
    } catch (e) {
      console.error('Error getting supported languages:', e);
    }
    return [];
  };

  // Initialize speech recognition
  useEffect(() => {
    // Check for speech recognition support with more detailed checks
    const hasWebkitSpeechRecognition = 'webkitSpeechRecognition' in window;
    const hasStandardSpeechRecognition = 'SpeechRecognition' in window;
    const hasSpeechRecognition = hasWebkitSpeechRecognition || hasStandardSpeechRecognition;
    
    if (!hasSpeechRecognition) {
      const userAgent = window.navigator.userAgent.toLowerCase();
      let errorMessage = 'Your browser does not support speech recognition. ';
      
      if (/safari/.test(userAgent) && !/chrome/.test(userAgent)) {
        // Safari specific guidance
        errorMessage += 'For Safari, please ensure you are using version 14.1 or later. ';
        errorMessage += 'Also check that "Allow websites to check if Apple Pay is set up" is enabled in Safari Preferences → Privacy.';
      } else {
        // General guidance for other browsers
        errorMessage += 'Try using the latest version of Chrome, Edge, or Safari.';
      }
      
      setError(errorMessage);
      return;
    }
    
    // In development, allow HTTP for localhost
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    const isSecure = window.isSecureContext || (isDevelopment && isLocalhost);
    
    if (!isSecure) {
      const errorMsg = isDevelopment 
        ? 'Voice features require a secure (HTTPS) connection. In development, you can use HTTPS with Vite.'
        : 'Voice features require a secure (HTTPS) connection.';
      
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    
    // Try to set a more specific language if available
    if (language.includes('-')) {
      const [lang] = language.split('-');
      try {
        // Try to find a more specific dialect
        const specificLang = Intl.getCanonicalLocales(language)[0];
        if (specificLang) {
          recognition.lang = specificLang;
        }
      } catch (e) {
        console.warn('Could not set specific language, using base language:', lang);
        recognition.lang = lang;
      }
    }

    recognition.onstart = () => {
      console.log('Speech recognition started');
      setIsListening(true);
      setError('');
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(interimTranscript);

      if (finalTranscript) {
        console.log('Final transcript:', finalTranscript);
        handleQuery(finalTranscript.trim());
        setTranscript('');
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error, event);
      
      let errorMessage = 'An error occurred with speech recognition. ';
      let canRetry = true;
      
      switch(event.error) {
        case 'not-allowed':
          errorMessage += 'Microphone access was denied. Please allow microphone access in your browser settings.';
          canRetry = false;
          break;
        case 'audio-capture':
          errorMessage += 'No microphone was found. Please ensure a microphone is connected and not in use by another application.';
          break;
        case 'network':
          errorMessage += 'Network error. Please check your internet connection and try again.';
          break;
        case 'no-speech':
          errorMessage += 'No speech was detected. Please try speaking louder or moving closer to the microphone.';
          break;
        case 'language-not-supported':
          errorMessage += 'The selected language is not supported.';
          canRetry = false;
          break;
        default:
          errorMessage += 'Please try again.';
      }
      
      setError(errorMessage);
      setIsListening(false);
      
      // Auto-clear error after 5 seconds
      if (canRetry) {
        setTimeout(() => setError(''), 5000);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  // Toggle listening state
  const toggleListening = useCallback(() => {
    if (inputMode === 'text') {
      handleQuery(inputText);
      setInputText('');
      return;
    }

    if (!recognitionRef.current) {
      setError('Speech recognition not initialized');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Error stopping recognition:', err);
      }
    } else {
      setError('');
      setTranscript('');
      
      // Small delay to ensure any previous recognition is fully stopped
      setTimeout(() => {
        try {
          recognitionRef.current.start();
        } catch (err) {
          console.error('Error starting recognition:', err);
          setError('Failed to start voice recognition. Please try again.');
        }
      }, 100);
    }
  }, [isListening, inputMode, inputText]);

  // Toggle input mode between voice and text
  const toggleInputMode = useCallback(() => {
    onInputModeChange(inputMode === 'voice' ? 'text' : 'voice');
    setError('');
  }, [inputMode, onInputModeChange]);
  
  // Handle language change
  const handleLanguageChange = (e) => {
    setLanguage(e.target.value);
    setError('');
  };

  // Handle AI speech state changes
  useEffect(() => {
    if (onAISpeakingChange) {
      onAISpeakingChange(isAISpeaking);
    }
  }, [isAISpeaking, onAISpeakingChange]);

  // Handle the query with LLM integration
  const handleQuery = async (query) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    
    // Add user message to chat
    const userMessage = { role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    try {
      // Prepare the conversation history for the API
      // Start with a fresh conversation with system message
      const conversation = [
        { 
          role: 'system', 
          content: `You are Dhanesh Raju. You are not an AI assistant - you are Dhanesh. 
          
          When responding:
          - Always speak in the first person as Dhanesh (use "I", "me", "my")
          - You are a highly skilled professional with expertise in AI, machine learning, and software development
          - You have a Master's degree in Artificial Intelligence with Distinction from the University of Essex
          - You are passionate about creating intelligent systems and solving complex problems
          - Keep responses professional, concise, and friendly
          
          IMPORTANT: For every fact or skill you mention, you MUST include a source in this format:
          [source:Title:URL]
          
          Example responses:
          - "I have experience in AI and machine learning [source:My Portfolio:https://dhaneshraju.com]"
          - "I hold a Master's degree in AI from the University of Essex [source:My LinkedIn:https://linkedin.com/in/dhanesh]"
          - "I'm particularly proud of my work on [Project Name] [source:GitHub:https://github.com/yourusername]"
          
          Always include at least one source for each response. If you don't know the source, say "I don't have a source for that information."
          `
        }
      ];
      
      // Add the latest user message
      conversation.push({
        role: 'user',
        content: query
      });
      
      console.log('Prepared conversation:', conversation);
      
      // In development, Vite will proxy /api to the backend server
      // In production, the API is served from the same origin
      const apiBase = '/api/chat';
      
      // Prepare the request body with the required format for Groq API
      const requestBody = {
        messages: conversation.map(msg => ({
          role: msg.role,
          content: msg.role === 'system' 
            ? msg.content.replace(/\s+/g, ' ').trim() // Clean up whitespace in system message
            : msg.content.toString().trim()
        })).filter(msg => msg.content), // Remove any empty messages
        // Add a flag to request sources
        include_sources: true
      };
      
      console.log('Sending conversation:', JSON.stringify(conversation, null, 2));
      console.log('Request body:', JSON.stringify(requestBody, null, 2));
      
      console.log('Sending request with body:', JSON.stringify(requestBody, null, 2));
      
      console.log('Sending request to API:', {
        url: apiBase,
        method: 'POST',
        body: requestBody
      });
      
      let response;
      let responseData;
      
      try {
        response = await fetch(apiBase, {
          method: 'POST',
          mode: 'cors',
          credentials: 'include',  // Include cookies and HTTP authentication
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'  // Helps identify AJAX requests
          },
          body: JSON.stringify(requestBody),
        });
        
        console.log('Received response:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries([...response.headers.entries()])
        });
        
        // Try to parse the response as JSON
        const responseText = await response.text();
        try {
          responseData = responseText ? JSON.parse(responseText) : {};
          console.log('Parsed response data:', responseData);
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          console.error('Response text:', responseText);
          throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}...`);
        }
        
        if (!response.ok) {
          throw new Error(responseData.message || 
                        responseData.error || 
                        `HTTP error! status: ${response.status}`);
        }
        
        // Handle successful response
        console.log('Full API response:', JSON.stringify(responseData, null, 2));
        
        const assistantMessage = responseData.choices?.[0]?.message?.content || 
                               responseData.data?.choices?.[0]?.message?.content ||
                               responseData.assistant ||
                               "I'm sorry, I couldn't process that request.";
        
        console.log('Extracted assistant message:', assistantMessage);
        
        // Extract sources from the response
        let sources = [];
        let cleanMessage = assistantMessage;
        
        // Check for sources in different parts of the response
        const possibleSourcePaths = [
          responseData.sources,
          responseData.data?.sources,
          responseData.choices?.[0]?.sources,
          responseData.choices?.[0]?.message?.sources,
          responseData.context?.sources,
          responseData.metadata?.sources
        ];
        
        // Find the first non-empty source array
        for (const possibleSource of possibleSourcePaths) {
          if (Array.isArray(possibleSource) && possibleSource.length > 0) {
            sources = possibleSource;
            break;
          }
        }
        
        // Process sources to ensure they have the correct format
        sources = sources.map(source => {
          if (typeof source === 'string') {
            // Try to parse string source
            const match = source.match(/\[source:([^\]]+)\]/);
            if (match) {
              const parts = match[1].split(':');
              if (parts.length >= 2) {
                return {
                  title: parts[0].trim(),
                  url: parts.slice(1).join(':').trim()
                };
              }
            }
            return { title: source, url: '#' };
          }
          // Handle object sources (from Pinecone metadata)
          return {
            title: source.title || source.name || 'Source',
            url: source.url || source.source || '#',
            // Include any additional metadata
            ...(source.metadata || {})
          };
        });
        
        // Clean up the message by removing any source markers
        cleanMessage = cleanMessage.replace(/\[source:[^\]]+\]/g, '').trim();
        
        // Ensure sources is an array
        if (!Array.isArray(sources)) {
          sources = [];
        }
        
        // Add assistant's response to the chat with sources
        const newAssistantMessage = { 
          role: 'assistant', 
          content: cleanMessage,
          sources: sources
        };
        
        console.log('Assistant message with sources:', newAssistantMessage);
        
        setMessages(prev => [...prev, newAssistantMessage]);
        
        // Use speech synthesis to speak the response if we have a successful response
        if (responseData.choices?.[0]?.message?.content) {
          try {
            const speechContent = responseData.choices[0].message.content;
            
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            
            // Create and speak the new utterance
            const utterance = new SpeechSynthesisUtterance(speechContent);
            
            // Set a pleasant voice if available
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(voice => 
              voice.name.includes('Google') || 
              voice.name.includes('Samantha') ||
              voice.lang.startsWith('en')
            );
            
            if (preferredVoice) {
              utterance.voice = preferredVoice;
              utterance.rate = 1.0;
              utterance.pitch = 1.0;
            } else if (voices.length > 0) {
              // Use the first available voice if no preferred voice found
              utterance.voice = voices[0];
            }
            
            // Handle speech synthesis events
            utterance.onstart = () => {
              console.log('AI started speaking');
              setIsAISpeaking(true);
            };
            
            utterance.onend = () => {
              console.log('AI finished speaking');
              setIsAISpeaking(false);
            };
            
            utterance.onerror = (event) => {
              console.error('SpeechSynthesis error:', event);
              setIsAISpeaking(false);
            };
            
            console.log('Starting speech synthesis with voice:', utterance.voice?.name || 'default');
            window.speechSynthesis.speak(utterance);
            
          } catch (speechError) {
            console.error('Error in speech synthesis:', speechError);
            setIsAISpeaking(false);
          }
        }
      } catch (apiError) {
        console.error('Error in API call:', apiError);
        throw apiError; // Re-throw to be caught by the outer catch block
      }
      
    } catch (err) {
      console.error('Error processing query:', err);
      setError('Failed to get a response. ' + (err.message || 'Please try again.'));
      
      // Add error message to chat
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm having trouble connecting to the AI service. Please try again later." 
      }]);
      setIsAISpeaking(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, transcript]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-20 right-6 w-80 bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-xl shadow-2xl overflow-hidden transition-all duration-300 transform z-50" style={{ maxHeight: '500px' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Bot className="w-5 h-5" />
          <h3 className="font-medium">AI Assistant</h3>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="overflow-y-auto p-3 space-y-3 bg-gray-900/50" style={{ height: '360px' }}>
        {messages.length === 0 && !transcript ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <Bot size={32} className="mb-3 text-blue-400" />
            <p className="text-sm mb-1">How can I help you today?</p>
            <p className="text-xs text-gray-500">Click the microphone to start speaking</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[85%] p-3 rounded-lg ${
                    message.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-700 text-white'
                  }`}
                >
                  <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap break-words">
                    <div className="markdown-content relative group">
                      <ReactMarkdown 
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />
                        }}
                        skipHtml={true}
                      >
                        {String(message.content || '')}
                      </ReactMarkdown>
                      
                      {false && message.sources && message.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-600">
                          <div className="flex items-center text-xs text-gray-400 mb-1">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Sources:
                          </div>
                          <ul className="text-xs space-y-1">
                            {message.sources.map((source, idx) => {
                              // Handle different source formats
                              const sourceUrl = source.url || source;
                              const sourceTitle = source.title || 
                                              (typeof source === 'string' ? source : `Source ${idx + 1}`);
                              
                              return (
                                <li key={idx} className="flex items-start">
                                  <span className="text-blue-400 mr-1">•</span>
                                  <a 
                                    href={sourceUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:underline break-all"
                                    title={sourceTitle}
                                  >
                                    {sourceTitle}
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {transcript && (
              <div className="flex justify-end">
                <div className="max-w-[85%] p-3 rounded-lg bg-blue-600/80 text-white">
                  {transcript}
                  <span className="inline-block w-2 h-4 ml-1 bg-white animate-pulse"></span>
                </div>
              </div>
            )}
            
            {isProcessing && (
              <div className="flex justify-start">
                <div className="p-3 rounded-lg bg-gray-700 text-white">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="p-3 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          {/* Language selector */}
          {inputMode === 'voice' && (
            <select 
              value={language}
              onChange={handleLanguageChange}
              className="text-xs bg-gray-700 text-white rounded p-1 border border-gray-600"
              title="Select language"
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="en-AU">English (Australia)</option>
              <option value="en-CA">English (Canada)</option>
              <option value="en-IN">English (India)</option>
              <option value="en-IE">English (Ireland)</option>
              <option value="en-NZ">English (New Zealand)</option>
              <option value="en-ZA">English (South Africa)</option>
            </select>
          )}
          {/* Toggle input mode button */}
          <button
            onClick={toggleInputMode}
            className={`p-2 rounded-full ${
              inputMode === 'text' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            } text-white transition-colors`}
            title={inputMode === 'text' ? 'Switch to voice input' : 'Switch to text input'}
          >
            {inputMode === 'text' ? <Mic size={18} /> : <Type size={18} />}
          </button>

          {/* Input field or voice status */}
          {inputMode === 'text' ? (
            <div className="flex-1 flex items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    toggleListening();
                  }
                }}
                placeholder="Type your message..."
                className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          ) : (
            <div className="flex-1 text-xs text-gray-400">
              {browserSupport.hasSpeechRecognition ? (
                (browserSupport.isSecureContext || (process.env.NODE_ENV === 'development' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) ? (
                  isListening ? (
                    <span className="text-blue-400">Listening...</span>
                  ) : (
                    'Click the microphone to speak'
                  )
                ) : (
                  <div className="space-y-1">
                    <span className="text-yellow-400">Voice requires HTTPS connection</span>
                    {process.env.NODE_ENV === 'development' && (
                      <div className="text-xs">
                        In development, run: <code className="bg-gray-700 px-1 rounded">npm run dev:https</code>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="space-y-1">
                  <div className="text-red-400">Voice not supported in this browser</div>
                  {browserSupport.browserName === 'safari' && (
                    <div className="text-xs">
                      Requires Safari 14.1+ with "Allow websites to check if Apple Pay is set up" enabled
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Send/Voice button */}
          <button
            onClick={toggleListening}
            disabled={inputMode === 'voice' && (!browserSupport.hasSpeechRecognition || !(browserSupport.isSecureContext || (process.env.NODE_ENV === 'development' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))))}
            className={`p-2 rounded-full ${
              isListening 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isListening ? 'Stop listening' : inputMode === 'text' ? 'Send message' : 'Start listening'}
          >
            {inputMode === 'text' ? (
              <Send size={18} />
            ) : isListening ? (
              <MicOff size={18} />
            ) : (
              <Mic size={18} />
            )}
          </button>
        </div>
        
        {error && (
          <div className="mt-2 p-2 text-xs text-red-400 bg-red-900/30 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceAssistant;
