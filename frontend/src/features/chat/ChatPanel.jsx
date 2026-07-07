/* eslint-disable react-hooks/purity */
import { useState, useRef, useEffect } from 'react';
import { useTrip } from '../../context/TripContext';

const PRESET_QUICK_REPLIES = [
  { text: 'Relaxed pace', icon: '🧘' },
  { text: 'Packed & adventurous', icon: '⚡' },
  { text: 'Budget-focused', icon: '💰' },
  { text: 'Add a museum', icon: '🏛️' },
  { text: 'Re-optimize routes', icon: '🔄' },
  { text: 'Suggest cheaper lodging', icon: '🏠' },
];

export default function ChatPanel() {
  const { state, dispatch } = useTrip();
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.trip.messages, isTyping]);

  const handleSendMessage = (text) => {
    if (!text.trim()) return;

    // Append User Message
    const userMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    dispatch({ type: 'ADD_MESSAGE', payload: userMessage });
    setInputValue('');

    const lowerText = text.toLowerCase();
    const isSearch = lowerText.startsWith('/search') || lowerText.startsWith('search ') || lowerText.startsWith('/find') || lowerText.startsWith('find ');

    // Trigger AI response
    setIsTyping(true);

    if (isSearch) {
      const searchQuery = text
        .replace(/^\/(search|find)\s+/i, '')
        .replace(/^(search|find)\s+/i, '')
        .trim();

      fetch(`/api/geocode?text=${encodeURIComponent(searchQuery)}`)
        .then(res => {
          if (!res.ok) throw new Error('Geocoding service unavailable');
          return res.json();
        })
        .then(data => {
          setIsTyping(false);
          if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            const [lng, lat] = feature.geometry.coordinates;
            const label = feature.properties.label;

            // Dispatch map pan event to center the map live
            window.dispatchEvent(new CustomEvent('map-pan-to', { detail: { lat, lng } }));

            dispatch({
              type: 'ADD_MESSAGE',
              payload: {
                id: `ai-${Date.now()}`,
                role: 'assistant',
                content: `I found **${label}** at coordinates \`[${lat.toFixed(4)}, ${lng.toFixed(4)}]\` and centered the map on it!`,
                timestamp: new Date().toISOString()
              }
            });
          } else {
            dispatch({
              type: 'ADD_MESSAGE',
              payload: {
                id: `ai-${Date.now()}`,
                role: 'assistant',
                content: `Sorry, I couldn't find any location matches for "${searchQuery}". Could you try being more specific?`,
                timestamp: new Date().toISOString()
              }
            });
          }
        })
        .catch(err => {
          console.error('Geocoding chat error:', err);
          setIsTyping(false);
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              id: `ai-${Date.now()}`,
              role: 'assistant',
              content: `Sorry, I ran into an error searching for "${searchQuery}". Please check your connection or try again.`,
              timestamp: new Date().toISOString()
            }
          });
        });
      return;
    }

    setTimeout(() => {
      let aiText = "I've processed your edit request. The itinerary has been updated — check the map for the optimized route. How else can I refine your trip?";
      
      if (lowerText.includes('cheaper') || lowerText.includes('lodging') || lowerText.includes('budget') || lowerText.includes('homestay') || lowerText.includes('hotel') || lowerText.includes('hostel')) {
        // Toggle homestays overlay visible
        if (!state.showHomestays) {
          dispatch({ type: 'TOGGLE_HOMESTAYS' });
        }
        aiText = "I've toggled the **Homestays** overlay on the map so you can view all lodging options in the area! You will see house markers plotted on the map. I recommend 'Asakusa Zen Ryokan' (¥6,200/night) as it is the most budget-friendly option and has the lowest average travel time to your itinerary stops.";
      } else if (lowerText.includes('museum') || lowerText.includes('day 3')) {
        aiText = "Day 3 already features teamLab Planets TOKYO, a world-class digital art museum! If you'd like to swap Odaiba Seaside Park for another museum, like the Mori Art Museum in Roppongi, just let me know and I'll re-optimize the route.";
      } else if (lowerText.includes('relaxed') || lowerText.includes('pace')) {
        aiText = "I've adjusted the pace for a more relaxed experience. I recommend extending the duration at each stop on Day 2 and removing Takeshita Street to allow for a slower, more meditative experience at Meiji Shrine. The map has been updated.";
      } else if (lowerText.includes('re-optimize') || lowerText.includes('optimize')) {
        aiText = "Routes recalculated! I've minimized transit time by reordering stops based on geographic proximity. Day 1 is now perfectly aligned: Senso-ji → Nakamise → Tokyo Skytree for maximum walkability.";
      } else if (lowerText.includes('packed') || lowerText.includes('adventurous')) {
        aiText = "I've packed your schedule with maximum experiences! Each day now has 4-5 stops with tight transit windows. I've also added some hidden local gems that most tourists miss.";
      }

      const aiMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: aiText,
        timestamp: new Date().toISOString()
      };
      
      dispatch({ type: 'ADD_MESSAGE', payload: aiMessage });
      setIsTyping(false);
    }, 2000);
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
        {state.trip.messages.map((msg, idx) => {
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
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed`}
                style={
                  isUser
                    ? {
                        background: 'var(--accent-dim)',
                        border: '1px solid var(--accent-border)',
                        color: 'var(--accent)',
                        borderRadius: '12px 12px 2px 12px'
                      }
                    : {
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        borderRadius: '12px 12px 12px 2px'
                      }
                }
              >
                {msg.content}
              </div>
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
                <div className="h-2 w-full shimmer rounded"></div>
                <div className="h-2 w-3/4 shimmer rounded"></div>
                <div className="h-2 w-1/2 shimmer rounded"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reply Chips */}
      <div
        className="px-3 py-2.5 border-t overflow-x-auto whitespace-nowrap flex items-center gap-1.5 no-scrollbar"
        style={{
          background: 'var(--surface-2)',
          borderTop: '1px solid var(--border)'
        }}
      >
        {PRESET_QUICK_REPLIES.map((reply, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(reply.text)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[9px] font-medium cursor-pointer shrink-0 transition-all"
            style={{
              background: 'var(--surface-3)',
              border: '1px solid var(--border)',
              color: 'var(--muted)'
            }}
            onMouseEnter={(e) => {
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
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask AI to edit or optimize..."
            className="w-full pl-3.5 pr-9 py-2.5 rounded-xl text-xs focus:outline-none placeholder-muted/50 font-sans"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)'
            }}
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
            style={{ color: 'var(--muted)' }}
            title="Voice input"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        </div>
        <button
          type="submit"
          disabled={!inputValue.trim()}
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
