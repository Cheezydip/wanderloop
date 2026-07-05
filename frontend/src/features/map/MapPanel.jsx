import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTrip } from '../../context/TripContext';
import { getDayColorHex } from '../../utils/colors';
import mapboxgl from 'mapbox-gl';

// Helper to check if token is valid Mapbox token
const isTokenValid = (token) => {
  return token && token.trim() !== '' && !token.includes('placeholder');
};

// Tokyo bounding box
const BOUNDS = { minLat: 35.61, maxLat: 35.73, minLng: 139.68, maxLng: 139.83 };
const SVG_W = 500;
const SVG_H = 400;

export default function MapPanel() {
  const { state, dispatch } = useTrip();
  const mapContainerRef = useRef(null);
  const [mapError, setMapError] = useState(null);
  const mapRef = useRef(null);

  // SVG panning state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: SVG_W, h: SVG_H });
  const [zoomLevel, setZoomLevel] = useState(1);

  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  const useMockMap = !isTokenValid(token) || mapError !== null;

  // Track hovered/selected homestay for drawing commute lines
  const activeHomestayId = state.hoveredHomestayId || state.selectedHomestayId;
  const activeHomestay = state.homestays.find(h => h.id === activeHomestayId);

  // Convert lat/lng to SVG coordinates
  const mapCoordsToSvg = useCallback((lat, lng) => {
    const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * SVG_W;
    const y = SVG_H - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * SVG_H;
    return { x, y };
  }, []);

  // Find the active stop data
  const activeStop = useMemo(() => {
    if (!state.activeStopId) return null;
    for (const day of state.trip.days) {
      const stop = day.stops.find(s => s.id === state.activeStopId);
      if (stop) return { ...stop, dayColorHue: day.colorHue };
    }
    return null;
  }, [state.activeStopId, state.trip.days]);

  // Pan map to active stop
  useEffect(() => {
    if (!activeStop || !useMockMap) return;
    const { x, y } = mapCoordsToSvg(activeStop.lat, activeStop.lng);
    const zW = SVG_W / 2.5;
    const zH = SVG_H / 2.5;
    setViewBox({
      x: Math.max(0, Math.min(x - zW / 2, SVG_W - zW)),
      y: Math.max(0, Math.min(y - zH / 2, SVG_H - zH)),
      w: zW,
      h: zH,
    });
    setZoomLevel(2.5);
  }, [activeStop, useMockMap, mapCoordsToSvg]);

  // Zoom controls
  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel * 1.5, 4);
    const cx = viewBox.x + viewBox.w / 2;
    const cy = viewBox.y + viewBox.h / 2;
    const nw = SVG_W / newZoom;
    const nh = SVG_H / newZoom;
    setViewBox({
      x: Math.max(0, Math.min(cx - nw / 2, SVG_W - nw)),
      y: Math.max(0, Math.min(cy - nh / 2, SVG_H - nh)),
      w: nw,
      h: nh,
    });
    setZoomLevel(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel / 1.5, 1);
    const cx = viewBox.x + viewBox.w / 2;
    const cy = viewBox.y + viewBox.h / 2;
    const nw = SVG_W / newZoom;
    const nh = SVG_H / newZoom;
    setViewBox({
      x: Math.max(0, Math.min(cx - nw / 2, SVG_W - nw)),
      y: Math.max(0, Math.min(cy - nh / 2, SVG_H - nh)),
      w: nw,
      h: nh,
    });
    setZoomLevel(newZoom);
  };

  const handleFitTrip = () => {
    setViewBox({ x: 0, y: 0, w: SVG_W, h: SVG_H });
    setZoomLevel(1);
    dispatch({ type: 'SELECT_STOP', payload: null });
  };

  // Compute center of gravity for a day's stops
  const getDayCog = useCallback((dayId) => {
    const day = state.trip.days.find(d => d.id === dayId);
    if (!day || day.stops.length === 0) return null;
    const avgLat = day.stops.reduce((s, st) => s + st.lat, 0) / day.stops.length;
    const avgLng = day.stops.reduce((s, st) => s + st.lng, 0) / day.stops.length;
    return mapCoordsToSvg(avgLat, avgLng);
  }, [state.trip.days, mapCoordsToSvg]);

  // Mapbox Live initialization
  useEffect(() => {
    if (useMockMap || !mapContainerRef.current) return;

    try {
      mapboxgl.accessToken = token;
      
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [139.75, 35.68],
        zoom: 11,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError('Failed to load Mapbox style. Using local interactive canvas.');
      });

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      return () => {
        map.remove();
      };
    } catch (err) {
      console.error('Mapbox init error:', err);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapError(err instanceof Error ? err.message : 'Mapbox initialization failed');
    }
  }, [useMockMap, token]);

  // Handle stop click on the map
  const handleMapStopClick = (stopId) => {
    dispatch({ type: 'SELECT_STOP', payload: state.activeStopId === stopId ? null : stopId });
  };

  const handleMapStopHover = (stopId) => {
    dispatch({ type: 'HOVER_STOP', payload: stopId });
  };

  return (
    <div className="flex-1 h-full relative bg-bg flex flex-col min-w-0">
      {/* Mapbox Live Container */}
      {!useMockMap && (
        <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-10" />
      )}

      {/* SVG Interactive Mockup Map */}
      {useMockMap && (
        <div className="w-full h-full absolute inset-0 bg-[#0b100e] flex items-center justify-center overflow-hidden z-10 select-none">
          {/* Ambient gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.03)_0%,transparent_60%)]" />
          
          {/* Subtle Grid overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:30px_30px]" />

          {/* SVG Elements */}
          <svg
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            className="w-full h-full max-w-5xl z-10 p-2"
            style={{ transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            {/* Tokyo Bay water */}
            <defs>
              <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0e2a2a" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0b1a1a" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* Mock Sumida River */}
            <path
              d="M 450 0 C 420 80, 390 120, 380 180 C 370 240, 390 320, 350 400"
              fill="none"
              stroke="url(#waterGrad)"
              strokeWidth="42"
              strokeLinecap="round"
              className="opacity-50"
            />
            <path
              d="M 450 0 C 420 80, 390 120, 380 180 C 370 240, 390 320, 350 400"
              fill="none"
              stroke="#0b1a1a"
              strokeWidth="38"
              strokeLinecap="round"
              className="opacity-60"
            />

            {/* Mock Tokyo Bay */}
            <path
              d="M 350 400 C 340 370, 380 340, 420 340 C 470 340, 480 360, 500 350 L 500 400 Z"
              fill="url(#waterGrad)"
              className="opacity-40"
            />

            {/* Day Route Polylines */}
            {state.trip.days.map((day) => {
              if (day.stops.length < 2) return null;
              const color = getDayColorHex(day.colorHue);
              const pathData = day.stops
                .map((stop, idx) => {
                  const { x, y } = mapCoordsToSvg(stop.lat, stop.lng);
                  return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                })
                .join(' ');

              return (
                <g key={day.id}>
                  {/* Glow path */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={color}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.1"
                  />
                  {/* Main path */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.6"
                  />
                  {/* Animated dash overlay */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="8,6"
                    opacity="0.8"
                    style={{
                      animation: 'dash 20s linear infinite',
                    }}
                  />
                </g>
              );
            })}

            {/* Commute Lines (Homestay to center of gravity) */}
            {activeHomestay && state.trip.days.map((day) => {
              const cog = getDayCog(day.id);
              if (!cog) return null;
              const homePos = mapCoordsToSvg(activeHomestay.lat, activeHomestay.lng);

              return (
                <g key={`commute-${day.id}`} className="fade-in">
                  <line
                    x1={homePos.x}
                    y1={homePos.y}
                    x2={cog.x}
                    y2={cog.y}
                    stroke="#2dd4bf"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                    opacity="0.5"
                    style={{ animation: 'dash 3s linear infinite' }}
                  />
                  {/* Center of gravity marker */}
                  <circle cx={cog.x} cy={cog.y} r="3" fill="none" stroke="#2dd4bf" strokeWidth="1" opacity="0.3" />
                </g>
              );
            })}

            {/* Stop Pins */}
            {state.trip.days.map((day) => {
              const color = getDayColorHex(day.colorHue);
              return day.stops.map((stop) => {
                const { x, y } = mapCoordsToSvg(stop.lat, stop.lng);
                const isHovered = state.hoveredStopId === stop.id;
                const isActive = state.activeStopId === stop.id;
                const isPulsing = isHovered || isActive;

                return (
                  <g
                    key={stop.id}
                    className="cursor-pointer"
                    transform={`translate(${x}, ${y})`}
                    onClick={() => handleMapStopClick(stop.id)}
                    onMouseEnter={() => handleMapStopHover(stop.id)}
                    onMouseLeave={() => handleMapStopHover(null)}
                  >
                    {/* Glow ring */}
                    {isPulsing && (
                      <circle r="14" fill={color} opacity="0.15" className="animate-ping" />
                    )}
                    {/* Outer ring */}
                    <circle
                      r={isPulsing ? '9' : '7'}
                      fill={color}
                      opacity={isPulsing ? 0.35 : 0.2}
                      style={{ transition: 'all 0.3s ease' }}
                    />
                    {/* Main circle */}
                    <circle
                      r={isPulsing ? '6.5' : '5.5'}
                      fill={color}
                      style={{ transition: 'all 0.3s ease' }}
                    />
                    {/* Inner dark circle */}
                    <circle
                      r={isPulsing ? '4.5' : '3.5'}
                      fill="#0e1513"
                      style={{ transition: 'all 0.3s ease' }}
                    />
                    {/* Number */}
                    <text
                      y="2.5"
                      textAnchor="middle"
                      fill={color}
                      fontSize={isPulsing ? '7' : '6'}
                      fontWeight="bold"
                      fontFamily="JetBrains Mono, monospace"
                      style={{ transition: 'all 0.3s ease' }}
                    >
                      {stop.order}
                    </text>
                    <title>{stop.name}</title>
                  </g>
                );
              });
            })}

            {/* Homestay Pins (House Icons) */}
            {state.homestays.map((home) => {
              const { x, y } = mapCoordsToSvg(home.lat, home.lng);
              const isSelected = state.selectedHomestayId === home.id;
              const isHovered = state.hoveredHomestayId === home.id;
              const isHighlighted = isSelected || isHovered;

              return (
                <g key={home.id} className="cursor-pointer" transform={`translate(${x}, ${y})`}>
                  {isHighlighted && (
                    <circle r="16" fill="#2dd4bf" opacity="0.1" className="animate-pulse" />
                  )}
                  <circle
                    r={isHighlighted ? 12 : 8}
                    fill={isSelected ? 'rgba(45,212,191,0.15)' : 'rgba(30,41,59,0.4)'}
                    stroke={isHighlighted ? '#2dd4bf' : '#1e293b'}
                    strokeWidth="1"
                    style={{ transition: 'all 0.3s ease' }}
                  />
                  {/* House shape */}
                  <path
                    d="M-5 2 L-5 -2 L0 -6 L5 -2 L5 2 Z"
                    fill={isHighlighted ? '#2dd4bf' : '#9aa3b2'}
                    opacity={isHighlighted ? 1 : 0.6}
                    style={{ transition: 'all 0.3s ease' }}
                  />
                  <title>{home.name}</title>
                </g>
              );
            })}
          </svg>

          {/* ─── Stop Popover (Glassmorphic) ─── */}
          {activeStop && useMockMap && (() => {
            const { x, y } = mapCoordsToSvg(activeStop.lat, activeStop.lng);
            const color = getDayColorHex(activeStop.dayColorHue);
            // Convert SVG coords to percentage of container
            const pctX = ((x - viewBox.x) / viewBox.w) * 100;
            const pctY = ((y - viewBox.y) / viewBox.h) * 100;

            return (
              <div
                className="absolute z-30 scale-in pointer-events-auto"
                style={{
                  left: `${Math.min(Math.max(pctX, 15), 75)}%`,
                  top: `${Math.min(Math.max(pctY - 15, 5), 60)}%`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <div className="glass-panel rounded-2xl p-3.5 min-w-[200px] max-w-[260px] shadow-2xl border border-white/[0.1]">
                  {/* Gradient header bar (simulated photo) */}
                  <div
                    className="h-16 rounded-xl mb-2.5 flex items-end p-2"
                    style={{
                      background: `linear-gradient(135deg, ${color}30, ${color}10, rgba(14,21,19,0.8))`,
                    }}
                  >
                    <span className="text-[8px] font-mono uppercase tracking-widest" style={{ color }}>
                      Day {activeStop.dayColorHue}
                    </span>
                  </div>

                  <h4 className="font-bold text-xs text-white mb-0.5">{activeStop.name}</h4>
                  
                  <div className="flex items-center gap-2 text-[9px] font-mono text-muted mb-2">
                    <span>{activeStop.timeEstimate}</span>
                    <span>·</span>
                    <span style={{ color }}>
                      {activeStop.costEstimate === 0 ? 'Free' : `¥${activeStop.costEstimate.toLocaleString()}`}
                    </span>
                  </div>

                  {/* AI Reasoning */}
                  <div className="bg-accent/5 border border-accent/10 rounded-lg p-2">
                    <span className="text-[7px] text-accent font-bold uppercase tracking-widest block mb-0.5">
                      Why this?
                    </span>
                    <p className="text-[9px] text-accent/70 leading-relaxed">
                      {activeStop.rationale}
                    </p>
                  </div>

                  {/* Close */}
                  <button
                    onClick={() => dispatch({ type: 'SELECT_STOP', payload: null })}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-muted hover:text-white transition-colors cursor-pointer"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {/* Arrow */}
                <div
                  className="w-3 h-3 rotate-45 mx-auto -mt-1.5"
                  style={{ background: 'rgba(22, 29, 27, 0.7)', borderRight: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>
            );
          })()}

          {/* Dev Mode Notification Overlay */}
          <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl glass-panel text-center max-w-sm mx-auto z-20 border border-white/[0.08]">
            <h4 className="font-bold text-[10px] text-white mb-0.5 flex items-center justify-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent"></span>
              </span>
              Interactive Map Canvas
            </h4>
            <p className="text-[9px] text-muted leading-relaxed">
              Local demo mode. Add <code className="bg-white/[0.06] px-1 py-0.5 rounded font-mono text-accent/70">VITE_MAPBOX_TOKEN</code> for live tiles.
            </p>
          </div>
        </div>
      )}

      {/* Map HUD Control Panel overlay */}
      <div className="absolute top-3 left-3 z-20 glass-panel rounded-xl p-2.5 flex flex-col gap-1.5 shadow-xl border border-white/[0.06]">
        <span className="text-[8px] text-muted uppercase tracking-[0.15em] font-mono">Layers</span>
        <div className="flex gap-1.5">
          {state.trip.days.map((day) => {
            const color = getDayColorHex(day.colorHue);
            return (
              <span
                key={day.id}
                className="px-1.5 py-0.5 rounded text-[8px] font-bold font-mono border cursor-pointer transition-all-300"
                style={{
                  backgroundColor: `${color}15`,
                  borderColor: `${color}30`,
                  color: color,
                }}
              >
                D{day.dayNumber}
              </span>
            );
          })}
        </div>
      </div>
      
      {/* Map controls bottom right */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 rounded-lg glass-panel flex items-center justify-center border border-white/[0.08] hover:bg-white/[0.08] text-white font-mono text-xs shadow-lg transition-all-300 cursor-pointer"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 rounded-lg glass-panel flex items-center justify-center border border-white/[0.08] hover:bg-white/[0.08] text-white font-mono text-xs shadow-lg transition-all-300 cursor-pointer"
        >
          −
        </button>
        <button
          onClick={handleFitTrip}
          className="px-2 py-1.5 rounded-lg glass-panel flex items-center justify-center border border-white/[0.08] hover:bg-white/[0.08] text-[9px] text-white font-semibold shadow-lg transition-all-300 cursor-pointer"
        >
          Fit
        </button>
      </div>
    </div>
  );
}
