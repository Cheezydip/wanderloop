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
        dispatch({ type: 'SET_MAP_LAYER', payload: 'homestays' });
        aiText = "I've switched the map to the **Homestays** layer so you can view all lodging options in the area! You will see house markers plotted on the map. I recommend 'Asakusa Zen Ryokan' (¥6,200/night) as it is the most budget-friendly option and has the lowest average travel time to your itinerary stops.";
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
    <div className="flex flex-col h-full bg-[rgba(22,29,27,0.4)] border-r border-white/[0.06] w-full md:w-[320px] shrink-0 overflow-hidden">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between bg-[rgba(22,29,27,0.3)]">
        <h2 className="font-bold text-xs flex items-center gap-2 text-white tracking-wide">
          <div className="w-6 h-6 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          AI Planner
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent"></span>
          </span>
          <span className="text-[9px] text-accent font-mono font-medium">Live</span>
        </div>
      </div>

      {/* Interview Mode Banner */}
      {state.isInterviewMode && (
        <div className="px-4 py-2.5 bg-accent/5 border-b border-accent/10 flex items-center gap-2 fade-in">
          <svg className="w-3.5 h-3.5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] text-accent font-medium">Answer questions below to refine your trip</span>
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
                <span className="text-[8px] text-accent font-mono uppercase tracking-widest mb-1 ml-1">
                  Wanderloop AI
                </span>
              )}
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-accent/15 text-accent border border-accent/20 rounded-tr-sm'
                    : 'bg-[rgba(22,29,27,0.8)] border border-white/[0.06] text-text rounded-tl-sm'
                }`}
              >
                {msg.content}
              </div>
              <span className="text-[8px] text-muted/60 mt-1 px-1 font-mono">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {/* Typing Indicator — Shimmer Card */}
        {isTyping && (
          <div className="flex flex-col items-start fade-in">
            <span className="text-[8px] text-accent font-mono uppercase tracking-widest mb-1 ml-1">
              Wanderloop AI
            </span>
            <div className="max-w-[88%] bg-[rgba(22,29,27,0.8)] border border-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-3.5 space-y-2">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span className="text-[9px] text-accent/60 font-mono">Planning route...</span>
              </div>
              <div className="space-y-1.5">
                <div className="h-2 w-full shimmer-bar rounded"></div>
                <div className="h-2 w-3/4 shimmer-bar rounded"></div>
                <div className="h-2 w-1/2 shimmer-bar rounded"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reply Chips */}
      <div className="px-3 py-2.5 border-t border-white/[0.04] bg-[rgba(22,29,27,0.2)] overflow-x-auto whitespace-nowrap flex items-center gap-1.5 no-scrollbar">
        {PRESET_QUICK_REPLIES.map((reply, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(reply.text)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-accent/20 border border-white/[0.05] rounded-full text-[9px] text-muted hover:text-white transition-all-300 font-medium cursor-pointer shrink-0"
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
        className="p-3 border-t border-white/[0.06] bg-[rgba(22,29,27,0.4)] flex gap-2 items-center"
      >
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask AI to edit or optimize..."
            className="w-full pl-3.5 pr-9 py-2.5 rounded-xl text-xs text-white glass-input focus:outline-none placeholder-muted/50 font-sans"
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted/50 hover:text-accent transition-colors cursor-pointer"
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
          className="p-2.5 rounded-xl bg-accent text-bg shadow-md disabled:opacity-30 disabled:shadow-none hover:bg-accent/85 transition-all-300 transform active:scale-95 flex items-center justify-center shrink-0 cursor-pointer"
        >
          <svg className="w-4 h-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}
