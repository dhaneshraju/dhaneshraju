import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Trash2, Mic, Send, Keyboard, MicOff, Bot, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import llmService from '../services/llmService';
import DocumentUpload from './DocumentUpload';

const VoiceAssistant = ({ isActive, isOpen, onClose, inputMode, onInputModeChange }) => {
  // State management
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState([]);
  const [status, setStatus] = useState('inactive');
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  
  // Refs
  const queryListRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastFinalTranscriptRef = useRef('');
  const textAreaRef = useRef(null);

  // Clear the silence timer
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // Handle speech recognition results
  const handleResult = useCallback((event) => {
    let interimTranscript = '';
    let newFinalTranscript = '';

    // Reset the silence timer on new results
    clearSilenceTimer();

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0]?.transcript || '';
      
      if (result.isFinal) {
        newFinalTranscript += text + ' ';
      } else {
        interimTranscript += text;
      }
    }

    // Update the UI with interim results
    if (interimTranscript) {
      setTranscript(interimTranscript);
    }

    // Process final results
    if (newFinalTranscript) {
      const updatedTranscript = newFinalTranscript.trim();
      lastFinalTranscriptRef.current = updatedTranscript;
      
      // Start a timer to detect end of speech
      silenceTimerRef.current = setTimeout(() => {
        if (lastFinalTranscriptRef.current) {
          const query = lastFinalTranscriptRef.current;
          // Add user message to conversation
          setConversation(prev => [...prev, { role: 'user', content: query }]);
          
          // Process with LLM
          (async () => {
            try {
              const response = await llmService(query);
              if (response.success) {
                setConversation(prev => [
                  ...prev, 
                  { 
                    role: 'assistant', 
                    content: response.response,
                    source: response.source || 'openai'
                  }
                ]);
              }
            } catch (error) {
              console.error('Error processing query:', error);
            }
          })();
          
          // Clear the current query
          setTranscript('');
          lastFinalTranscriptRef.current = '';
        }
      }, 1500); // 1.5 seconds of silence
    }
  }, [clearSilenceTimer]);

  // Handle voice input
  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window)) {
      console.error('Speech recognition not supported');
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = handleResult;
    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
      setStatus('error');
    };

    recognition.onend = () => {
      if (isListening) {
        recognition.start();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setStatus('listening');
  }, [handleResult, isListening]);

  // Process voice input when final transcript is received
  useEffect(() => {
    const processVoiceQuery = async () => {
      if (!transcript || isProcessing) return;
      
      const query = transcript.trim();
      if (!query) return;
      
      // Add user query to conversation
      const userMessage = { role: 'user', content: query };
      setConversation(prev => [...prev, userMessage]);
      setTranscript('');
      
      try {
        setIsProcessing(true);
        const response = await llmService(query);
        
        if (response.success) {
          // Add assistant response to conversation
          const assistantMessage = { 
            role: 'assistant', 
            content: response.response,
            source: response.source || 'openai'
          };
          setConversation(prev => [...prev, assistantMessage]);
        } else {
          console.error('Error from LLM service:', response.error);
        }
      } catch (error) {
        console.error('Error processing query:', error);
      } finally {
        setIsProcessing(false);
      }
    };
    
    if (transcript && !isListening) {
      processVoiceQuery();
    }
  }, [transcript, isListening, isProcessing]);

  // Toggle listening based on isActive prop
  useEffect(() => {
    if (isActive && !isListening) {
      startListening();
    } else if (!isActive && isListening) {
      setIsListening(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  }, [isActive, isListening, startListening]);

  // Auto-scroll to bottom when conversation updates
  useEffect(() => {
    if (queryListRef.current) {
      queryListRef.current.scrollTop = queryListRef.current.scrollHeight;
    }
  }, [conversation, isProcessing]);

  // Handle text input submission
  const handleTextSubmit = async (e) => {
    e.preventDefault();
    const query = textInput.trim();
    if (!query || isProcessing) return;
    
    // Add user message to conversation
    const userMessage = { role: 'user', content: query };
    setConversation(prev => [...prev, userMessage]);
    setTextInput('');
    
    try {
      setIsProcessing(true);
      const response = await llmService(query);
      
      if (response.success) {
        // Add assistant response to conversation
        const assistantMessage = { 
          role: 'assistant', 
          content: response.response,
          source: response.source || 'openai'
        };
        setConversation(prev => [...prev, assistantMessage]);
      } else {
        console.error('Error from LLM service:', response.error);
      }
    } catch (error) {
      console.error('Error processing query:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  if (transcript && !isListening) {
    processVoiceQuery();
  }
}, [transcript, isListening, isProcessing]);

// Toggle listening based on isActive prop
useEffect(() => {
  if (isActive && !isListening) {
    startListening();
  } else if (!isActive && isListening) {
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }
}, [isActive, isListening, startListening]);

// Auto-scroll to bottom when conversation updates
useEffect(() => {
  if (queryListRef.current) {
    queryListRef.current.scrollTop = queryListRef.current.scrollHeight;
  }
}, [conversation, isProcessing]);

// Handle text input submission
const handleTextSubmit = async (e) => {
  e.preventDefault();
  const query = textInput.trim();
  if (!query || isProcessing) return;
  
  // Add user message to conversation
  const userMessage = { role: 'user', content: query };
  setConversation(prev => [...prev, userMessage]);
  setTextInput('');
  
  try {
    setIsProcessing(true);
    const response = await llmService(query);
    
    if (response.success) {
      // Add assistant response to conversation
      const assistantMessage = { 
        role: 'assistant', 
        content: response.response,
        source: response.source || 'openai'
      };
      setConversation(prev => [...prev, assistantMessage]);
    } else {
      console.error('Error from LLM service:', response.error);
    }
  } catch (error) {
    console.error('Error processing query:', error);
  } finally {
    setIsProcessing(false);
  }
};

if (!isOpen) {
  return null;
}

return (
  <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 flex justify-between items-center">
    <div className="flex items-center space-x-2">
      <Bot className="w-5 h-5" />
      <h3 className="font-medium">Portfolio Assistant</h3>
    </div>
    <div className="flex items-center space-x-2">
      <button
        onClick={() => setShowDocumentUpload(!showDocumentUpload)}
        className={`p-1 rounded-full ${showDocumentUpload ? 'bg-blue-700' : 'hover:bg-blue-700'} transition-colors`}
        title={showDocumentUpload ? 'Hide documents' : 'Manage documents'}
      >
        <FileText className="w-4 h-4" />
      </button>
      <button
        onClick={onClose}
        className="p-1 rounded-full hover:bg-blue-700 transition-colors"
        title="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
    <div className="voice-assistant-debug">
      <div className="debug-header">
        <div className="status-indicator">
          <span className="status" data-status={status}>
            {status}
          </span>
          <span className="text-xs opacity-70">
            {isListening ? '🎤 Listening...' : '🔇 Inactive'}
          </span>
        </div>
        <button 
          onClick={onClose}
          className="close-button"
          title="Minimize"
        >
          <X size={16} />
        </button>
      </div>
      
      <div className="debug-content">
        <div className="debug-actions">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setConversation([]);
            }}
            className="debug-button"
            title="Clear history"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Bot size={14} className="text-purple-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-medium text-cyan-300">
                          {message.role === 'user' ? 'You' : 'Dhanesh'}
                        </span>
                        {message.source === 'mock' && (
                          <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded">
                            Mock Data
                          </span>
                        )}
                      </div>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Loading indicator */}
              {isProcessing && (
                <div className="flex items-center justify-start p-3">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
              
              {/* Current listening/typing indicator */}
              {(isListening || (inputMode === 'text' && transcript)) && (
                <div className="p-3 bg-white/5 rounded-lg border-l-2 border-yellow-400/80">
                  <p className="text-yellow-300 text-xs font-medium mb-1">
                    {inputMode === 'voice' ? 'Listening...' : 'Typing...'}
                  </p>
                  <p className="text-white/90 text-sm">
                    {transcript || '...'}
                    {inputMode === 'voice' && (
                      <span className="inline-flex items-center ml-1">
                        <span className="pulse-animation">
                          <Mic size={12} className="inline-block" />
                        </span>
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Input Area */}
        <div className="input-area">
          <div className="flex items-center justify-between px-2 py-2">
            <span className="text-xs text-white/60">
              {inputMode === 'voice' ? 'Voice mode' : 'Text mode'}
            </span>
            <button
              onClick={() => onInputModeChange(inputMode === 'voice' ? 'text' : 'voice')}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Switch to {inputMode === 'voice' ? 'text' : 'voice'}
            </button>
          </div>
          
          {inputMode === 'text' ? (
            <form onSubmit={handleTextSubmit}>
              <textarea
                ref={textAreaRef}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white/90 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent resize-none"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your query here..."
                rows="1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleTextSubmit(e);
                  }
                }}
              />
              <div className="flex justify-end items-center mt-2">
                <button 
                  type="submit" 
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!textInput.trim()}
                >
                  <Send size={14} />
                  Send
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-white/60 mb-2">
                Use the microphone button in the top right corner
              </p>
              <p className="text-xs text-white/40">
                Or switch to text input above
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;
