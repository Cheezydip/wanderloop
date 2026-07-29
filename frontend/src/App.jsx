import { useState, useEffect } from 'react';
import { useTrip } from './context/TripContext';
import TopBar from './components/TopBar';
import ChatPanel from './features/chat/ChatPanel';
import MapPanel from './features/map/MapPanel';
import ItineraryPanel from './features/itinerary/ItineraryPanel';
import LandingPage from './features/landing/LandingPage';
import QuestionnairePage from './features/questionnaire/QuestionnairePage';
import AuthModal from './components/AuthModal';

export default function App() {
  const { state, dispatch } = useTrip();
  const { activeTab, hasTrip, isInterviewMode, showQuestionnaire } = state;
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);


  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Stable fingerprint of trip stops to avoid re-fetching lodgings on every minor state change
  const tripStopsFingerprint = state.trip?.days
    ?.map(d => `${d.id}:${(d.stops || []).map(s => `${(parseFloat(s?.lat) || 0).toFixed(3)},${(parseFloat(s?.lng) || 0).toFixed(3)}`).join('|')}`)
    .join('_') || '';

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

          // Fetch lodgings in a 5000m radius for this day (wide enough for rural/mountain regions)
          const response = await fetch(`/api/lodgings?lat=${avgLat}&lng=${avgLng}&radius=5000`);
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
  }, [tripStopsFingerprint, hasTrip, dispatch]);

  // Auto-dismiss toast notifications after 4 seconds
  useEffect(() => {
    if (state.toast) {
      const timer = setTimeout(() => {
        dispatch({ type: 'SET_TOAST', payload: null });
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [state.toast, dispatch]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg text-text relative">
      {/* Floating Toast Notification */}
      {state.toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-rose-500 text-white font-semibold text-xs shadow-2xl scale-in border border-rose-400/40">
          <span>{state.toast.message}</span>
          <button
            onClick={() => dispatch({ type: 'SET_TOAST', payload: null })}
            className="ml-2 text-white/80 hover:text-white font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Bar */}
      {hasTrip && <TopBar />}

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {showQuestionnaire ? (
          /* ─── Questionnaire Page ─── */
          <QuestionnairePage />
        ) : !hasTrip ? (
          /* ─── Landing Page ─── */
          <LandingPage />
        ) : isMobile ? (
          /* Mobile View (Tabbed Single Column) */
          <div className="flex flex-1 flex-col overflow-hidden h-full">
            <div className="flex-1 overflow-hidden relative">
              {activeTab === 'chat' && <ChatPanel />}
              <div style={{ display: activeTab === 'map' ? 'block' : 'none', width: '100%', height: '100%' }}>
                <MapPanel />
              </div>
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

      {/* Authentication Modal (Login / Sign Up) */}
      <AuthModal />
    </div>
  );
}
