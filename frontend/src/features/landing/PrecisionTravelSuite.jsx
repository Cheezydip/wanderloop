import React, { useState, useEffect, useRef } from 'react';

// Clock component for Global Chronometry
function Clock({ timezone, city, dateStr, onRemove }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time in the given timezone
  const formatterTime = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  
  const formattedParts = formatterTime.formatToParts(time);
  const hour = formattedParts.find(p => p.type === 'hour').value;
  const minute = formattedParts.find(p => p.type === 'minute').value;
  const ampm = formattedParts.find(p => p.type === 'dayPeriod').value;

  // Calculate progress for the SVG ring based on hour/minute (0 to 24)
  const hour24 = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(time));
  const progress = ((hour24 * 60 + parseInt(minute)) / (24 * 60)) * 283; // 283 is approx circumference of r=45

  return (
    <div className="landing-clock-item group relative text-center flex flex-col items-center justify-center p-4 border-l border-subtle first:border-l-0">
      <button 
        onClick={onRemove}
        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div className="relative w-32 h-32 mb-4">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray="283" strokeDashoffset={283 - progress} style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[10px] tracking-wider text-muted mb-1 uppercase">{city}</span>
          <span className="font-mono text-2xl font-bold">
            {hour}:{minute}<span className="text-[10px] ml-0.5">{ampm}</span>
          </span>
        </div>
      </div>
      <div className="font-mono text-[10px] text-muted">{dateStr}</div>
    </div>
  );
}

export default function PrecisionTravelSuite() {
  const [timezones, setTimezones] = useState([
    { id: 'Asia/Tokyo', city: 'Tokyo' },
    { id: 'Europe/London', city: 'London' },
    { id: 'America/New_York', city: 'NYC' }
  ]);
  const [destinations, setDestinations] = useState([
    { id: 'santorini', name: 'Santorini, Greece', region: 'Aegean Sea', img: '/images/santorini.png' },
    { id: 'kyoto', name: 'Kyoto, Japan', region: 'Kansai Region', img: '/images/kyoto.png' },
    { id: 'machu_picchu', name: 'Machu Picchu, Peru', region: 'Andes Mountains', img: '/images/machu_picchu.png' },
    { id: 'banff', name: 'Banff, Canada', region: 'Alberta', img: '/images/banff.png' }
  ]);
  const [isAddingTz, setIsAddingTz] = useState(false);
  const [isAddingDest, setIsAddingDest] = useState(false);
  const destInputRef = useRef(null);

  // Common TZs for the dropdown
  const commonTzs = [
    { id: 'Asia/Dubai', city: 'Dubai' },
    { id: 'Asia/Kolkata', city: 'New Delhi' },
    { id: 'Europe/Paris', city: 'Paris' },
    { id: 'America/Los_Angeles', city: 'Los Angeles' },
    { id: 'Australia/Sydney', city: 'Sydney' }
  ];

  const handleAddTz = (tz) => {
    if (timezones.length < 5 && !timezones.find(t => t.id === tz.id)) {
      setTimezones([...timezones, tz]);
    }
    setIsAddingTz(false);
  };

  const removeTz = (id) => {
    setTimezones(timezones.filter(t => t.id !== id));
  };

  const handleAddDest = async (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      const cityName = e.target.value.trim();
      if (destinations.length < 6) {
        const tempId = Date.now().toString();
        // Add optimistically without image
        setDestinations(prev => [...prev, {
          id: tempId,
          name: cityName,
          region: 'Planned Destination',
          img: '' 
        }]);
        setIsAddingDest(false);
        
        // Fetch image in background from Wikipedia
        try {
          let searchTerm = cityName.split(',')[0].trim();
          searchTerm = searchTerm.replace(/^(Trip to|Vacation in|Journey to|Visit to|Weekend in|Days in)\s+/i, '').trim();

          // Use 'titles' instead of 'generator=search' to avoid pulling random images for vague names
          const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(searchTerm)}&prop=pageimages&format=json&pithumbsize=400&origin=*`;
          const res = await fetch(url);
          const data = await res.json();
          const pages = data.query?.pages;
          if (pages) {
            const pageId = Object.keys(pages)[0];
            if (pages[pageId].thumbnail?.source) {
              const imgUrl = pages[pageId].thumbnail.source;
              setDestinations(prev => prev.map(d => d.id === tempId ? { ...d, img: imgUrl } : d));
            }
          }
        } catch (error) {
          console.error('Failed to fetch image from Wikipedia:', error);
        }
      } else {
        setIsAddingDest(false);
      }
    }
  };

  const removeDest = (id) => {
    setDestinations(destinations.filter(d => d.id !== id));
  };

  const todayStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());

  return (
    <section className="landing-section" id="landing-suite" style={{ background: 'var(--bg-deep)' }}>
      <div className="landing-section-inner">
        <div className="text-center mb-16">
          <h2 className="landing-section-title">Precision Travel Suite</h2>
          <p className="landing-section-desc max-w-2xl mx-auto">
            Advanced telemetry for your expeditions. Everything you need, unified in a single architecture.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Global Chronometry */}
          <div className="landing-glass-panel p-6 rounded-xl md:col-span-8 flex flex-col justify-between relative overflow-visible">
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-bold text-lg font-display">Global Chronometry</h3>
              {timezones.length < 5 && (
                <div className="relative">
                  <button 
                    onClick={() => setIsAddingTz(!isAddingTz)}
                    className="text-xs font-mono px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors border border-subtle flex items-center gap-1 text-accent cursor-pointer"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg> Add
                  </button>
                  {isAddingTz && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-surface-2 border border-subtle rounded-lg shadow-xl z-50 overflow-hidden backdrop-blur-xl">
                      {commonTzs.filter(tz => !timezones.find(t => t.id === tz.id)).map(tz => (
                        <button 
                          key={tz.id}
                          onClick={() => handleAddTz(tz)}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors font-mono text-muted hover:text-white cursor-pointer"
                        >
                          {tz.city}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 flex-grow relative z-10">
              {timezones.map(tz => (
                <Clock key={tz.id} timezone={tz.id} city={tz.city} dateStr={todayStr} onRemove={() => removeTz(tz.id)} />
              ))}
            </div>
          </div>

          {/* Trip Concepts (Destination Wishlist) */}
          <div className="landing-glass-panel p-6 rounded-xl md:col-span-4 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg font-display">Trip Concepts</h3>
                <p className="text-[10px] text-muted font-mono mt-1 uppercase tracking-wider">Curated travel goals</p>
              </div>
              {destinations.length < 6 && (
                <button 
                  onClick={() => setIsAddingDest(true)}
                  className="text-xs font-mono px-2 py-1 rounded hover:bg-white/10 transition-colors text-muted cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-3 flex-grow">
              {destinations.map(dest => (
                <div key={dest.id} className="relative rounded-lg overflow-hidden group aspect-[4/3] bg-surface-2 border border-subtle">
                  {dest.img ? (
                    <img src={dest.img} alt={dest.name} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-aurora-1/20 to-aurora-2/20" />
                  )}
                  {/* Black overlay + gradient to ensure text readability */}
                  <div className="absolute inset-0 bg-black/40 p-3 flex flex-col justify-end bg-gradient-to-t from-bg-deep via-bg-deep/50 to-transparent">
                    <div className="font-bold text-[11px] leading-tight text-white mb-0.5 relative z-10">{dest.name}</div>
                    <div className="text-[9px] text-accent font-mono uppercase tracking-wider relative z-10">{dest.region}</div>
                  </div>
                  <button 
                    onClick={() => removeDest(dest.id)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-md cursor-pointer z-20"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
              {isAddingDest && (
                <div className="relative rounded-lg overflow-hidden aspect-[4/3] bg-surface-3 border border-dashed border-subtle p-2 flex items-center justify-center">
                  <input 
                    ref={destInputRef}
                    autoFocus
                    type="text"
                    placeholder="City name..."
                    className="w-full bg-transparent border-b border-accent/50 text-[10px] font-mono text-white outline-none px-1 py-1"
                    onKeyDown={handleAddDest}
                    onBlur={() => setIsAddingDest(false)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Budget Intelligence */}
          <div className="landing-glass-panel p-6 rounded-xl md:col-span-4 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg mb-2 font-display">Budget Intelligence</h3>
              <p className="text-sm text-muted font-light mb-6">Budget tracking and split costs, seamlessly integrated.</p>
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                <div className="font-mono text-sm flex items-center gap-2 text-muted">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/></svg> Budget
                </div>
                <div className="font-mono font-bold text-lg">$3,450.00</div>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="bg-accent w-2/3 h-full rounded-full" />
              </div>
            </div>
          </div>

          {/* Smart Routes */}
          <div className="landing-glass-panel p-6 rounded-xl md:col-span-4 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg mb-2 font-display">Smart Routes</h3>
              <p className="text-sm text-muted font-light mb-6">Time-aware route optimization on complex daily itineraries.</p>
            </div>
            <div className="border border-subtle rounded-lg p-4 flex items-center justify-between bg-surface-2/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-accent-dim flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div>
                  <div className="font-bold text-sm">Optimization</div>
                  <div className="font-mono text-[10px] text-muted uppercase tracking-wider">Active</div>
                </div>
              </div>
              <div className="font-mono text-sm text-accent font-bold">-45 min</div>
            </div>
          </div>

          {/* Weather Intel */}
          <div className="landing-glass-panel p-6 rounded-xl md:col-span-4 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-bold text-lg font-display">Weather Intel</h3>
              <span className="font-mono text-[10px] text-muted bg-white/5 border border-subtle px-2 py-1 rounded uppercase tracking-wider">TOKYO</span>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="1.5"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <div>
                <div className="font-mono text-3xl font-bold">24°</div>
                <div className="text-xs text-muted">Clear Skies</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-subtle pt-4">
              <div>
                <div className="text-[9px] text-muted font-mono mb-1 uppercase tracking-wider">HUMIDITY</div>
                <div className="font-mono text-sm">62%</div>
              </div>
              <div>
                <div className="text-[9px] text-muted font-mono mb-1 uppercase tracking-wider">UV INDEX</div>
                <div className="font-mono text-sm">4 <span className="text-muted text-[10px] ml-1">Mod</span></div>
              </div>
            </div>
          </div>

          {/* Budget Breakdown */}
          <div className="landing-glass-panel p-6 rounded-xl md:col-span-12 flex flex-col md:flex-row gap-8 items-center">
            <div className="md:w-1/3 w-full">
              <h3 className="font-bold text-lg mb-2 font-display">Budget Breakdown</h3>
              <p className="text-sm text-muted font-light mb-4">Granular breakdown of your trip economics compared to targets.</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
                <span className="font-mono text-xs text-muted uppercase tracking-wider">On Track</span>
              </div>
            </div>
            
            <div className="md:w-2/3 w-full border border-subtle rounded-xl p-6 bg-surface-2/50">
              <div className="flex justify-between items-end font-mono mb-5">
                <span className="text-xs text-muted uppercase tracking-wider">Total Spend</span>
                <div className="text-right">
                  <span className="font-bold text-lg text-white">$1,850</span>
                  <span className="text-muted mx-1">/</span>
                  <span className="text-sm text-muted">$2,500</span>
                </div>
              </div>
              
              {/* Stacked Bar - Wanderloop colors (Teal/Amber/Rose/Lime) */}
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden flex mb-5 border border-subtle">
                <div className="h-full w-[45%]" style={{ background: 'var(--day-1)' }} title="Lodging" />
                <div className="h-full w-[30%]" style={{ background: 'var(--day-2)' }} title="Activities" />
                <div className="h-full w-[15%]" style={{ background: 'var(--day-3)' }} title="Food" />
                <div className="h-full w-[10%]" style={{ background: 'var(--day-4)' }} title="Transit" />
              </div>
              
              {/* Legend */}
              <div className="flex flex-wrap justify-between gap-2 text-[10px] font-mono text-muted uppercase tracking-wider">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: 'var(--day-1)' }} /> Lodging <span className="opacity-50">45%</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: 'var(--day-2)' }} /> Activities <span className="opacity-50">30%</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: 'var(--day-3)' }} /> Food <span className="opacity-50">15%</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: 'var(--day-4)' }} /> Transit <span className="opacity-50">10%</span></div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
