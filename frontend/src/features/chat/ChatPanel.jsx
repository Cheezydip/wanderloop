/* eslint-disable react-hooks/purity */
import { useState, useRef, useEffect } from 'react';
import { useTrip } from '../../context/TripContext';
import { Smile, Zap, DollarSign, Landmark, RefreshCw, Home, Calendar, Compass } from 'lucide-react';

const PRESET_QUICK_REPLIES = [
  { text: 'Relaxed pace', icon: <Smile className="w-3 h-3 text-emerald-400" /> },
  { text: 'Packed & adventurous', icon: <Zap className="w-3 h-3 text-amber-400" /> },
  { text: 'Budget-focused', icon: <DollarSign className="w-3 h-3 text-teal-400" /> },
  { text: 'Add a museum', icon: <Landmark className="w-3 h-3 text-purple-400" /> },
  { text: 'Re-optimize routes', icon: <RefreshCw className="w-3 h-3 text-sky-400" /> },
  { text: 'Suggest cheaper lodging', icon: <Home className="w-3 h-3 text-rose-400" /> },
];

const INTERVIEW_FLOW = [
  {
    ai: "Great choice! How many days are you planning for?",
    chips: ["3–4 days", "5–7 days", "8–10 days", "2+ weeks"],
    key: "duration"
  },
  {
    ai: "What's your daily budget? Include lodging, food, and activities.",
    chips: ["$30–50 (budget)", "$50–80 (moderate)", "$80–120 (comfort)", "$120+ (luxury)"],
    key: "budget"
  },
  {
    ai: "What's your travel pace?",
    chips: ["Relaxed — 2–3 stops/day", "Balanced — 3–4 stops/day", "Packed — 5+ stops/day"],
    key: "pace"
  },
  {
    ai: "Who's traveling with you?",
    chips: ["Solo", "Partner", "Family with kids", "Group of friends"],
    key: "party"
  },
  {
    ai: "Any dietary preferences? This helps me pick the right food spots.",
    chips: ["No restrictions", "Vegetarian", "Vegan", "Halal", "Gluten-free"],
    key: "diet"
  },
  {
    ai: "Last one — what matters most on this trip?",
    chips: ["Food & local culture", "History & museums", "Nature & outdoor", "Nightlife & entertainment", "Photography spots"],
    key: "priority"
  }
];

function formatChatMessageContent(content) {
  if (!content) return '';
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return content.replace(/\*/g, '');
  }
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*/g, '')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

export default function ChatPanel() {
  const { state, dispatch } = useTrip();
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const [isMicRecording, setIsMicRecording] = useState(false);
  const isSendingRef = useRef(false);
  const recognitionRef = useRef(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.trip?.messages?.length, isTyping, isMicRecording]);

  // Main API Caller for Chat
  const sendMessageToAI = async (updatedMessages, currentTrip) => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    setIsTyping(true);

    let success = false;
    let attempt = 0;

    while (!success && attempt < 5) {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
            currentTrip: currentTrip
          })
        });

        if (!response.ok) {
          throw new Error('API server returned an error');
        }

        const data = await response.json();
        
        // Dispatch Assistant Response with sanitized message
        const sanitizedMessage = (data.message || '').replace(/\*/g, '');
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: sanitizedMessage,
            timestamp: new Date().toISOString()
          }
        });

        // Update Itinerary State if returned
        if (data.trip) {
          dispatch({ type: 'SET_TRIP', payload: data.trip });
          dispatch({ type: 'SET_INTERVIEW_MODE', payload: false });
          dispatch({ type: 'SET_ACTIVE_TAB', payload: 'map' });
        } 
        
        if (data.mapCenter) {
          // Update map center to focus exactly on the AI's desired destination
          dispatch({ type: 'SET_MAP_CENTER', payload: data.mapCenter });
        }

        // If Interview complete or trip loaded, turn off interview mode
        if (data.isComplete || data.trip) {
          dispatch({ type: 'SET_INTERVIEW_MODE', payload: false });
          dispatch({ type: 'SET_ACTIVE_TAB', payload: 'map' });
        }
        
        success = true;
      } catch (error) {
        console.error('NIM Chat error:', error);
        attempt++;
        if (attempt >= 5) {
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              id: `ai-err-${Date.now()}`,
              role: 'assistant',
              content: 'Sorry, I couldn\'t connect to the AI planning service. Please try sending your request again.',
              timestamp: new Date().toISOString()
            }
          });
        } else {
          // Wait 1.5 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }
    setIsTyping(false);
    isSendingRef.current = false;
  };

  // Watch for entering interview mode with only user's initial prompt
  useEffect(() => {
    if (!state.isInterviewMode) return;

    const messages = state.trip?.messages || [];
    if (messages.length === 1 && messages[0].role === 'user' && !isSendingRef.current) {
      sendMessageToAI(messages, null);
    }
  }, [state.isInterviewMode, state.trip?.messages?.length]);

  const toggleMic = () => {
    if (isMicRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsMicRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsMicRecording(true);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setInputValue(transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsMicRecording(false);
      };

      recognition.onend = () => {
        setIsMicRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } else {
      alert('Speech recognition is not supported in this browser. Please type your message.');
    }
  };

  const handleSendMessage = (text) => {
    if (!text.trim() || isTyping || isSendingRef.current) return;

    // Clean user message text of any star signs/asterisks
    const cleanedText = text.replace(/\*/g, '');

    // Append User Message
    const userMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: cleanedText,
      timestamp: new Date().toISOString()
    };
    dispatch({ type: 'ADD_MESSAGE', payload: userMessage });
    setInputValue('');

    // Send history + new message to AI
    const updatedMessages = [...(state.trip?.messages || []), userMessage];
    sendMessageToAI(updatedMessages, state.trip);
  };

  return (
    <div
      className="flex flex-col h-full w-full md:w-[320px] shrink-0 overflow-hidden"
      style={{
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        color: 'var(--text)',
        transition: 'background 0.6s cubic-bezier(0.16, 1, 0.3, 1), border 0.6s cubic-bezier(0.16, 1, 0.3, 1), color 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Panel Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
          transition: 'background 0.6s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <h2 className="font-bold text-xs flex items-center gap-2 tracking-wide" style={{ color: 'var(--text)' }}>
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent-border)'
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--accent)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          AI Planner
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--accent)' }}></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: 'var(--accent)' }}></span>
          </span>
          <span className="text-[9px] font-mono font-medium" style={{ color: 'var(--accent)' }}>Live</span>
        </div>
      </div>

      {/* Interview Mode Banner */}
      {state.isInterviewMode && (
        <div
          className="px-4 py-2.5 flex items-center gap-2 fade-in"
          style={{
            background: 'var(--accent-dim)',
            borderBottom: '1px solid var(--accent-border)'
          }}
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--accent)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] font-medium" style={{ color: 'var(--accent)' }}>Answer questions below to refine your trip</span>
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {(state.trip?.messages || []).map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} fade-in`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {/* Role label */}
              {!isUser && (
                <span className="text-[8px] font-mono uppercase tracking-widest mb-1 ml-1" style={{ color: 'var(--accent)' }}>
                  Wanderloop AI
                </span>
              )}
              <div
                className="max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed"
                dangerouslySetInnerHTML={{ __html: formatChatMessageContent(msg.content) }}
                style={
                  isUser
                    ? {
                        background: 'var(--accent-dim)',
                        border: '1px solid var(--accent-border)',
                        color: 'var(--text)',
                        borderRadius: '12px 12px 2px 12px',
                        whiteSpace: 'pre-wrap'
                      }
                    : {
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        borderRadius: '12px 12px 12px 2px',
                        whiteSpace: 'pre-wrap'
                      }
                }
              />
              <span className="text-[8px] mt-1 px-1 font-mono" style={{ color: 'var(--muted)' }}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {/* Typing Indicator — Shimmer Card */}
        {isTyping && (
          <div className="flex flex-col items-start fade-in">
            <span className="text-[8px] font-mono uppercase tracking-widest mb-1 ml-1" style={{ color: 'var(--accent)' }}>
              Wanderloop AI
            </span>
            <div
              className="max-w-[88%] rounded-2xl px-4 py-3.5 space-y-2"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '12px 12px 12px 2px'
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '300ms' }}></span>
                </div>
                <span className="text-[9px] font-mono" style={{ color: 'var(--muted)' }}>Planning route...</span>
              </div>
              <div className="space-y-1.5">
                <div className="h-2 w-full shimmer rounded animate-pulse bg-white/[0.05]"></div>
                <div className="h-2 w-3/4 shimmer rounded animate-pulse bg-white/[0.05]"></div>
                <div className="h-2 w-1/2 shimmer rounded animate-pulse bg-white/[0.05]"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Mic Recording Overlay */}
      {isMicRecording && (
        <div className="px-4 py-2 bg-rose-500/10 border-t border-rose-500/20 text-[10px] text-rose-500 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            <span>Listening... say "Suggest cheaper lodging"</span>
          </div>
          <button onClick={() => setIsMicRecording(false)} className="hover:underline font-bold">Cancel</button>
        </div>
      )}

      {/* Quick Reply Chips */}
      <div
        className="px-3 py-2.5 border-t overflow-x-auto whitespace-nowrap flex items-center gap-1.5 no-scrollbar"
        style={{
          background: 'var(--surface-2)',
          borderTop: '1px solid var(--border)'
        }}
      >
        {(state.isInterviewMode
          ? [
              { text: '3 days', icon: <Calendar className="w-3 h-3 text-sky-400" /> },
              { text: '5 days', icon: <Calendar className="w-3 h-3 text-sky-400" /> },
              { text: 'Relaxed pace', icon: <Smile className="w-3 h-3 text-emerald-400" /> },
              { text: 'Adventure focused', icon: <Zap className="w-3 h-3 text-amber-400" /> },
              { text: 'Budget friendly', icon: <DollarSign className="w-3 h-3 text-teal-400" /> },
              { text: 'Kyoto Sightseeing', icon: <Compass className="w-3 h-3 text-purple-400" /> }
            ]
          : PRESET_QUICK_REPLIES
        ).map((reply, idx) => (
          <button
            key={idx}
            disabled={isTyping}
            onClick={() => handleSendMessage(reply.text)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[9px] font-medium cursor-pointer shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'var(--surface-3)',
              border: '1px solid var(--border)',
              color: 'var(--muted)'
            }}
            onMouseEnter={(e) => {
              if (isTyping) return;
              e.currentTarget.style.borderColor = 'var(--accent-border)';
              e.currentTarget.style.color = 'var(--text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--muted)';
            }}
          >
            <span>{reply.icon}</span>
            <span>{reply.text}</span>
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputValue);
        }}
        className="p-3 border-t flex gap-2 items-center"
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)'
        }}
      >
        <div className="flex-1 relative">
          <textarea
            rows={1}
            disabled={isTyping}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(inputValue);
              }
            }}
            placeholder={state.isInterviewMode ? "Type your answer..." : "Ask AI to edit or optimize..."}
            className="w-full pl-3.5 pr-9 py-2.5 rounded-xl text-xs focus:outline-none placeholder-muted/50 font-sans resize-none max-h-32 min-h-[38px] overflow-y-auto block leading-normal disabled:opacity-50"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)'
            }}
            ref={(el) => {
              if (el) {
                el.style.height = 'auto';
                el.style.height = `${Math.min(Math.max(el.scrollHeight, 38), 128)}px`;
              }
            }}
          />
          <button
            type="button"
            disabled={isTyping}
            onClick={toggleMic}
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer p-1 rounded ${
              isMicRecording ? 'text-rose-500 animate-pulse bg-rose-500/10' : 'text-muted hover:text-text'
            }`}
            title="Voice input"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        </div>
        <button
          type="submit"
          disabled={!inputValue.trim() || isTyping}
          className="p-2.5 rounded-xl shadow-md disabled:opacity-30 disabled:shadow-none hover:bg-accent/85 transition-all transform active:scale-95 flex items-center justify-center shrink-0 cursor-pointer"
          style={{
            background: 'var(--accent)',
            color: 'var(--bg)'
          }}
        >
          <svg className="w-4 h-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}
