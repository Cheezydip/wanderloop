import { useState, useEffect } from 'react';
import { useTrip } from './context/TripContext';
import TopBar from './components/TopBar';
import ChatPanel from './features/chat/ChatPanel';
import MapPanel from './features/map/MapPanel';
import ItineraryPanel from './features/itinerary/ItineraryPanel';

/* ─── Empty State: Full-screen landing with glowing search ─── */
function EmptyState() {
  const { dispatch } = useTrip();
  const [inputValue, setInputValue] = useState('');

  const templates = [
    { text: 'A week in Tokyo for a food lover', icon: '🍱' },
    { text: '3 days in Kyoto sightseeing', icon: '⛩️' },
    { text: 'Adventure weekend in Hakone', icon: '🏔️' },
    { text: '5-day cultural deep dive in Osaka', icon: '🏯' },
  ];

  const handleSubmit = (prompt) => {
    const text = prompt || inputValue;
    if (!text.trim()) return;

    dispatch({ type: 'START_INTERVIEW', payload: text });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.06)_0%,transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.04)_0%,transparent_50%)]" />

      {/* Subtle grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="relative z-10 flex flex-col items-center max-w-2xl w-full px-6 scale-in">
        {/* Logo Mark */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent to-emerald-400 flex items-center justify-center shadow-xl glow-accent-strong mb-8">
          <svg className="w-9 h-9 text-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="text-4xl md:text-5xl font-extrabold text-center tracking-tight mb-3">
          <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            Where to next?
          </span>
        </h1>
        <p className="text-muted text-sm text-center mb-10 max-w-md leading-relaxed">
          Describe your dream trip and our AI will craft a map-anchored itinerary with optimized routes, curated stops, and smart lodging.
        </p>

        {/* Search Input with Glow Ring */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="w-full max-w-lg mb-8"
        >
          <div className="relative ring-pulse rounded-2xl">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="A week in Tokyo for a food lover..."
              className="w-full px-6 py-4 rounded-2xl text-sm text-white bg-[rgba(22,29,27,0.8)] border border-white/[0.1] focus:border-accent focus:outline-none placeholder-muted/60 font-sans backdrop-blur-xl transition-all-300"
              autoFocus
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-accent text-bg font-bold text-sm shadow-lg shadow-accent/20 disabled:opacity-30 disabled:shadow-none hover:bg-accent/85 transition-all-300 transform active:scale-95 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </form>

        {/* Template Chips */}
        <div className="flex flex-wrap justify-center gap-2.5">
          {templates.map((tmpl, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputValue(tmpl.text);
                handleSubmit(tmpl.text);
              }}
              className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-accent/30 text-xs text-muted hover:text-white transition-all-300 cursor-pointer"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <span className="text-base">{tmpl.icon}</span>
              <span className="font-medium">{tmpl.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { state, dispatch } = useTrip();
  const { activeTab, hasTrip, isInterviewMode } = state;
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch real/dynamic lodgings from the backend when stops change (distributed for each day)
  useEffect(() => {
    if (!hasTrip || !state.trip?.days || state.trip.days.length === 0) return;

    const fetchAllLodgings = async () => {
      try {
        const promises = state.trip.days.map(async (day) => {
          if (!day.stops || day.stops.length === 0) return [];
          
          // Calculate center coordinate for this day
          let dayLat = 0;
          let dayLng = 0;
          day.stops.forEach(s => {
            dayLat += s.lat;
            dayLng += s.lng;
          });
          const avgLat = dayLat / day.stops.length;
          const avgLng = dayLng / day.stops.length;

          // Fetch lodgings in a tighter 1500m radius for this day
          const response = await fetch(`/api/lodgings?lat=${avgLat}&lng=${avgLng}&radius=1500`);
          if (response.ok) {
            const data = await response.json();
            return data.map(item => ({ ...item, dayId: day.id }));
          }
          return [];
        });

        const results = await Promise.all(promises);
        const combined = results.flat();

        // De-duplicate same lodging name matches
        const seen = new Set();
        const unique = combined.filter(h => {
          const key = `${h.name.toLowerCase()}-${h.lat.toFixed(4)}`;
          const duplicate = seen.has(key);
          seen.add(key);
          return !duplicate;
        });

        dispatch({ type: 'SET_HOMESTAYS', payload: unique });
      } catch (err) {
        console.error('Failed to fetch distributed lodgings:', err);
      }
    };

    fetchAllLodgings();
  }, [state.trip?.id, hasTrip, dispatch]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg text-text">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {!hasTrip ? (
          /* ─── Empty State ─── */
          <EmptyState />
        ) : isMobile ? (
          /* Mobile View (Tabbed Single Column) */
          <div className="flex flex-1 flex-col overflow-hidden h-full">
            <div className="flex-1 overflow-hidden relative">
              {activeTab === 'chat' && <ChatPanel />}
              {activeTab === 'map' && <MapPanel />}
              {activeTab === 'plan' && <ItineraryPanel />}
            </div>

            {/* Mobile Tab Switcher */}
            <nav className="h-14 bg-panel border-t border-white/[0.06] flex items-center justify-around px-4 shrink-0 backdrop-blur-xl">
              {[
                { key: 'chat', label: 'Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
                { key: 'map', label: 'Map', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
                { key: 'plan', label: 'Plan', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: key })}
                  className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 text-[10px] font-bold transition-all-300 ${activeTab === key ? 'text-accent' : 'text-muted'
                    }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                  </svg>
                  {label}
                </button>
              ))}
            </nav>
          </div>
        ) : (
          /* Desktop View (Three Columns) */
          <div className="flex flex-1 overflow-hidden h-full">
            <div
              className="overflow-hidden flex-shrink-0"
              style={{
                width: state.showChat ? '320px' : '0px',
                opacity: state.showChat ? 1 : 0,
                pointerEvents: state.showChat ? 'auto' : 'none',
                transition: 'width 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
                borderRight: state.showChat ? '1px solid var(--border)' : 'none',
              }}
            >
              <ChatPanel />
            </div>

            <div className="flex-1 relative min-w-0">
              <MapPanel />

              {/* Interview Mode Dimming Overlay */}
              {isInterviewMode && (
                <div
                  className="absolute inset-0 z-30 bg-bg/80 backdrop-blur-sm flex items-center justify-center fade-in cursor-pointer"
                  onClick={() => dispatch({ type: 'SET_INTERVIEW_MODE', payload: false })}
                >
                  <div className="text-center scale-in" onClick={(e) => e.stopPropagation()}>
                    <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h3 className="text-white font-bold text-lg mb-1">Interview Mode</h3>
                    <p className="text-muted text-xs max-w-xs">
                      Answer questions in the chat panel to refine your itinerary. Click anywhere on the map to exit.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="slide-in-right">
              <ItineraryPanel />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
