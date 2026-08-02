import { useState, useMemo } from 'react';
import {
  getAllStopsFromTrip,
  buildGoogleMapsUrl,
  buildAppleMapsUrl,
  generateGPX,
  generateKML,
  downloadFile,
  copyToClipboard
} from '../utils/exportUtils';
import { Hotel, Bus, Footprints, Car, Compass } from 'lucide-react';

export default function ExportModal({
  trip,
  homestays = [],
  selectedHomestaysByDay = {},
  selectedHomestayId = null,
  isOpen,
  onClose
}) {
  const [selectedDay, setSelectedDay] = useState('all'); // 'all' or day.id
  const [travelMode, setTravelMode] = useState('transit'); // 'transit', 'walking', 'driving'
  const [includedHotels, setIncludedHotels] = useState({});
  const [copied, setCopied] = useState(false);

  // Build a list of selected hotel entries with day context
  const selectedHotelEntries = useMemo(() => {
    if (!trip || !Array.isArray(trip.days) || !Array.isArray(homestays) || homestays.length === 0) return [];
    const entries = [];
    trip.days.forEach(day => {
      const dayHotelIds = selectedHomestaysByDay?.[day.id] || [];
      let dayHotels = [];
      if (Array.isArray(dayHotelIds) && dayHotelIds.length > 0) {
        dayHotels = homestays.filter(h => dayHotelIds.includes(h.id));
      } else if (selectedHomestayId) {
        const found = homestays.find(h => h.id === selectedHomestayId);
        if (found) dayHotels = [found];
      }

      dayHotels.forEach(hotel => {
        entries.push({
          key: `hotel-${day.id}-${hotel.id}`,
          dayId: day.id,
          dayNumber: day.dayNumber,
          hotel
        });
      });
    });
    return entries;
  }, [trip, homestays, selectedHomestaysByDay, selectedHomestayId]);

  // Filter hotel entries based on currently selected day scope ('all' vs specific day)
  const filteredHotelEntries = useMemo(() => {
    if (selectedDay === 'all') {
      return selectedHotelEntries;
    }
    return selectedHotelEntries.filter(entry => entry.dayId === selectedDay);
  }, [selectedHotelEntries, selectedDay]);

  if (!isOpen || !trip) return null;

  const allStops = getAllStopsFromTrip(
    trip,
    homestays,
    selectedHomestaysByDay,
    selectedHomestayId,
    includedHotels
  );
  const days = trip.days || [];

  // Determine active stops for current selection
  let activeStops = allStops;
  let activeTitle = 'All Days (Full Trip)';
  if (selectedDay !== 'all') {
    const day = days.find(d => d.id === selectedDay);
    if (day) {
      activeStops = allStops.filter(s => s.dayId === day.id);
      activeTitle = `Day ${day.dayNumber}`;
    }
  }

  const googleMapsUrl = buildGoogleMapsUrl(activeStops, travelMode, trip?.title, trip?.destination);
  const appleMapsUrl = buildAppleMapsUrl(activeStops, trip?.title);

  const handleCopyLink = async () => {
    const success = await copyToClipboard(googleMapsUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleDownloadGPX = () => {
    const gpxContent = generateGPX(trip, homestays, selectedHomestaysByDay, selectedHomestayId, includedHotels);
    const filename = `${(trip.title || 'wanderloop_trip').toLowerCase().replace(/\s+/g, '_')}_all_days.gpx`;
    downloadFile(gpxContent, filename, 'application/gpx+xml');
  };

  const handleDownloadKML = () => {
    const kmlContent = generateKML(trip, homestays, selectedHomestaysByDay, selectedHomestayId, includedHotels);
    const filename = `${(trip.title || 'wanderloop_trip').toLowerCase().replace(/\s+/g, '_')}_all_days.kml`;
    downloadFile(kmlContent, filename, 'application/vnd.google-earth.kml+xml');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto no-scrollbar"
        style={{
          background: 'var(--surface, #14171d)',
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          color: 'var(--text, #f3f4f6)'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors"
          style={{
            background: 'var(--surface-2, rgba(255,255,255,0.05))',
            color: 'var(--muted, #9ca3af)',
            border: 'none'
          }}
          aria-label="Close modal"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>

        {/* Saved Success Badge */}
        <div className="flex items-center gap-2 mb-2 text-emerald-400 font-semibold text-xs tracking-wide uppercase">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Itinerary Saved & Ready to Export
        </div>

        {/* Title & Metadata */}
        <h2 className="text-xl font-bold tracking-tight mb-1" style={{ color: 'var(--text)' }}>
          {trip.title || 'Your Wanderloop Trip'}
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--muted, #9ca3af)' }}>
          {days.length} Days • {allStops.length} Stops Total • Ready for navigation
        </p>

        {/* Hotel Lodging Export Checkboxes */}
        {filteredHotelEntries.length > 0 && (
          <div className="mb-5 p-3.5 rounded-xl border space-y-2.5 transition-all" style={{ background: 'var(--surface-2, rgba(255,255,255,0.02))', borderColor: 'var(--border, rgba(255,255,255,0.06))' }}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                <Hotel className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {selectedDay === 'all'
                    ? `Hotel Lodging Starting Points (${filteredHotelEntries.length})`
                    : `Day ${days.find(d => d.id === selectedDay)?.dayNumber || ''} Hotel Starting Point`}
                </span>
              </label>
              {filteredHotelEntries.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const allChecked = filteredHotelEntries.every(e => includedHotels[e.key] !== false);
                    const nextState = { ...includedHotels };
                    filteredHotelEntries.forEach(e => {
                      nextState[e.key] = !allChecked;
                    });
                    setIncludedHotels(nextState);
                  }}
                  className="text-[10px] font-medium text-amber-400 hover:underline cursor-pointer"
                >
                  {filteredHotelEntries.every(e => includedHotels[e.key] !== false) ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 no-scrollbar">
              {filteredHotelEntries.map(entry => {
                const isChecked = includedHotels[entry.key] !== false;
                return (
                  <div
                    key={entry.key}
                    className="p-2.5 rounded-xl border flex items-center justify-between transition-all"
                    style={{
                      background: isChecked ? 'rgba(245, 158, 11, 0.08)' : 'var(--surface-3, rgba(255,255,255,0.03))',
                      borderColor: isChecked ? 'rgba(245, 158, 11, 0.25)' : 'var(--border, rgba(255,255,255,0.06))'
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Hotel className={`w-4 h-4 shrink-0 inline ${isChecked ? 'text-amber-400' : 'text-stone-500'}`} />
                      <div className="min-w-0">
                        <div className={`text-xs font-bold truncate ${isChecked ? 'text-amber-400' : 'text-stone-400'}`}>
                          {selectedDay === 'all' && <span className="font-mono text-[10px] font-normal text-muted mr-1">[Day {entry.dayNumber}]</span>}
                          {entry.hotel.name}
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--muted)' }}>
                          Included as route origin for Day {entry.dayNumber}
                        </div>
                      </div>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer shrink-0 ml-2" style={{ color: 'var(--text)' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setIncludedHotels(prev => ({
                            ...prev,
                            [entry.key]: !isChecked
                          }));
                        }}
                        className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                      />
                      <span className="text-[10px]">{isChecked ? 'Included' : 'Include'}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Route Scope Selection (All Days vs Per-Day) ─── */}
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
            1. Select Route Scope
          </label>
          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl" style={{ background: 'var(--surface-2, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
            <button
              onClick={() => setSelectedDay('all')}
              className="flex-1 min-w-[110px] py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center"
              style={{
                background: selectedDay === 'all' ? 'var(--accent, #2dd4bf)' : 'transparent',
                color: selectedDay === 'all' ? 'var(--bg, #090a0f)' : 'var(--text)'
              }}
            >
              All Days ({allStops.length} stops)
            </button>
            {days.map(day => {
              const count = (day.stops || []).length;
              return (
                <button
                  key={day.id}
                  onClick={() => setSelectedDay(day.id)}
                  className="py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center"
                  style={{
                    background: selectedDay === day.id ? 'var(--accent, #2dd4bf)' : 'transparent',
                    color: selectedDay === day.id ? 'var(--bg, #090a0f)' : 'var(--text)'
                  }}
                >
                  Day {day.dayNumber} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Travel Mode Selection ─── */}
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
            2. Choose Travel Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'transit', label: 'Public Transit', icon: <Bus className="w-3.5 h-3.5" /> },
              { id: 'walking', label: 'Walking', icon: <Footprints className="w-3.5 h-3.5" /> },
              { id: 'driving', label: 'Driving', icon: <Car className="w-3.5 h-3.5" /> }
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => setTravelMode(mode.id)}
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium cursor-pointer transition-all border"
                style={{
                  background: travelMode === mode.id ? 'var(--accent-dim, rgba(45,212,191,0.15))' : 'var(--surface-2, rgba(255,255,255,0.02))',
                  borderColor: travelMode === mode.id ? 'var(--accent, #2dd4bf)' : 'var(--border, rgba(255,255,255,0.06))',
                  color: travelMode === mode.id ? 'var(--accent, #2dd4bf)' : 'var(--muted)'
                }}
              >
                <span>{mode.icon}</span>
                <span>{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── Primary Actions: Open Map Apps ─── */}
        <div className="space-y-2.5 mb-6">
          {/* Google Maps Button */}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 w-full py-3 px-4 rounded-xl font-bold text-sm no-underline shadow-lg transition-transform active:scale-[0.99] cursor-pointer"
            style={{
              background: '#4285F4',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(66, 133, 244, 0.35)'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            Open {activeTitle} in Google Maps
          </a>

          <div className="grid grid-cols-2 gap-2">
            {/* Apple Maps Button */}
            <a
              href={appleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-semibold text-xs no-underline border transition-colors cursor-pointer"
              style={{
                background: 'var(--surface-2, rgba(255,255,255,0.03))',
                borderColor: 'var(--border, rgba(255,255,255,0.08))',
                color: 'var(--text)'
              }}
            >
              <Compass className="w-3.5 h-3.5" /> Apple Maps
            </a>

            {/* Copy Link Button */}
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-semibold text-xs border cursor-pointer transition-all"
              style={{
                background: copied ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-2, rgba(255,255,255,0.03))',
                borderColor: copied ? '#10b981' : 'var(--border, rgba(255,255,255,0.08))',
                color: copied ? '#10b981' : 'var(--text)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              {copied ? 'Link Copied! ✓' : 'Copy Maps Link'}
            </button>
          </div>
        </div>

        {/* ─── Offline Map Files (All Days Included) ─── */}
        <div className="pt-4 border-t" style={{ borderColor: 'var(--border, rgba(255,255,255,0.08))' }}>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--muted)' }}>
            Offline Navigation Files (All {days.length} Days)
          </label>

          <div className="grid grid-cols-2 gap-2">
            {/* GPX Download */}
            <button
              onClick={handleDownloadGPX}
              className="flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-all hover:border-emerald-500/40"
              style={{
                background: 'var(--surface-2, rgba(255,255,255,0.02))',
                borderColor: 'var(--border, rgba(255,255,255,0.06))'
              }}
            >
              <div>
                <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Download .GPX</div>
                <div className="text-[10px]" style={{ color: 'var(--muted)' }}>OsmAnd, Maps.me, Organic Maps</div>
              </div>
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>

            {/* KML Download */}
            <button
              onClick={handleDownloadKML}
              className="flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-all hover:border-blue-500/40"
              style={{
                background: 'var(--surface-2, rgba(255,255,255,0.02))',
                borderColor: 'var(--border, rgba(255,255,255,0.06))'
              }}
            >
              <div>
                <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Download .KML</div>
                <div className="text-[10px]" style={{ color: 'var(--muted)' }}>Google Earth & My Maps</div>
              </div>
              <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-4 text-center text-[10px]" style={{ color: 'var(--muted, #9ca3af)' }}>
          Tip: On mobile devices, Google Maps links launch directly inside the Google Maps app.
        </div>
      </div>
    </div>
  );
}
