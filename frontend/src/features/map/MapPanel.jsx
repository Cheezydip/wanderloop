/* eslint-disable */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTrip } from '../../context/TripContext';
import { getDayColorHex } from '../../utils/colors';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Tokyo bounding box
const BOUNDS = { minLat: 35.61, maxLat: 35.73, minLng: 139.68, maxLng: 139.83 };
const SVG_W = 500;
const SVG_H = 400;

export default function MapPanel() {
  const { state, dispatch } = useTrip();
  const mapContainerRef = useRef(null);
  const [mapError, setMapError] = useState(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const popupRef = useRef(null);

  const [routesData, setRoutesData] = useState({});
  const [nearbyPOIs, setNearbyPOIs] = useState([]);

  // SVG panning state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: SVG_W, h: SVG_H });
  const [zoomLevel, setZoomLevel] = useState(1);

  const useMockMap = mapError !== null;

  const mapLayer = state.mapLayer; // 'stops' | 'homestays'

  // Handle stop click on the map
  const handleMapStopClick = useCallback((stopId) => {
    dispatch({ type: 'SELECT_STOP', payload: state.activeStopId === stopId ? null : stopId });
  }, [state.activeStopId, dispatch]);

  const handleMapStopHover = useCallback((stopId) => {
    dispatch({ type: 'HOVER_STOP', payload: stopId });
  }, [dispatch]);

  // Handle homestay click on the map
  const handleMapHomestayClick = useCallback((homestayId) => {
    dispatch({
      type: 'SELECT_HOMESTAY_ON_MAP',
      payload: state.activeHomestayOnMapId === homestayId ? null : homestayId,
    });
  }, [state.activeHomestayOnMapId, dispatch]);

  // Track hovered/selected homestay for drawing commute lines
  const activeHomestayId = state.hoveredHomestayId || state.selectedHomestayId;
  const activeHomestay = state.homestays.find(h => h.id === activeHomestayId);

  // Homestay selected on map (for popover)
  const activeHomestayOnMap = state.homestays.find(h => h.id === state.activeHomestayOnMapId);

  // Calculate dynamic bounds for SVG mockup
  const bounds = useMemo(() => {
    let minLat = 35.61, maxLat = 35.73, minLng = 139.68, maxLng = 139.83; // default Tokyo

    let allStops = [];
    if (state.trip && state.trip.days) {
      state.trip.days.forEach(day => {
        if (day.stops) {
          day.stops.forEach(s => {
            allStops.push(s);
          });
        }
      });
    }

    if (allStops.length > 0) {
      minLat = Math.min(...allStops.map(s => s.lat));
      maxLat = Math.max(...allStops.map(s => s.lat));
      minLng = Math.min(...allStops.map(s => s.lng));
      maxLng = Math.max(...allStops.map(s => s.lng));

      // Add padding (e.g. 15%) so pins aren't on the absolute edge
      const latPad = (maxLat - minLat) * 0.15 || 0.02;
      const lngPad = (maxLng - minLng) * 0.15 || 0.02;

      minLat -= latPad;
      maxLat += latPad;
      minLng -= lngPad;
      maxLng += lngPad;
    }

    return { minLat, maxLat, minLng, maxLng };
  }, [state.trip]);

  // Convert lat/lng to SVG coordinates
  const mapCoordsToSvg = useCallback((lat, lng) => {
    const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * SVG_W;
    const y = SVG_H - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * SVG_H;
    return { x, y };
  }, [bounds]);

  // Find the active stop data
  const activeStop = useMemo(() => {
    if (!state.activeStopId) return null;
    for (const day of state.trip.days) {
      const stop = day.stops.find(s => s.id === state.activeStopId);
      if (stop) return { ...stop, dayColorHue: day.colorHue };
    }
    return null;
  }, [state.activeStopId, state.trip.days]);

  // Pan map to active stop — fit the whole active day in view
  useEffect(() => {
    if (!activeStop) return;
    if (useMockMap) {
      // Find the day this stop belongs to
      const activeDay = state.trip.days.find(d => d.stops.some(s => s.id === activeStop.id));

      if (activeDay && activeDay.stops.length > 1) {
        // Fit all stops of the active day in the viewBox with padding
        const xs = activeDay.stops.map(s => mapCoordsToSvg(s.lat, s.lng).x);
        const ys = activeDay.stops.map(s => mapCoordsToSvg(s.lat, s.lng).y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const padX = Math.max((maxX - minX) * 0.25, 40);
        const padY = Math.max((maxY - minY) * 0.25, 40);
        const vx = Math.max(0, minX - padX);
        const vy = Math.max(0, minY - padY);
        const vw = Math.min(SVG_W - vx, (maxX - minX) + padX * 2);
        const vh = Math.min(SVG_H - vy, (maxY - minY) + padY * 2);
        setViewBox({ x: vx, y: vy, w: vw, h: vh });
        setZoomLevel(SVG_W / vw);
      } else {
        // Single stop — gentle 1.6x zoom, centred on stop
        const { x, y } = mapCoordsToSvg(activeStop.lat, activeStop.lng);
        const zW = SVG_W / 1.6;
        const zH = SVG_H / 1.6;
        setViewBox({
          x: Math.max(0, Math.min(x - zW / 2, SVG_W - zW)),
          y: Math.max(0, Math.min(y - zH / 2, SVG_H - zH)),
          w: zW,
          h: zH,
        });
        setZoomLevel(1.6);
      }
    } else if (mapRef.current) {
      mapRef.current.easeTo({
        center: [activeStop.lng, activeStop.lat],
        zoom: 14,
        duration: 800
      });
    }
  }, [activeStop, useMockMap, mapCoordsToSvg, state.trip.days]);

  // Pan map to active homestay on map
  useEffect(() => {
    if (!activeHomestayOnMap) return;
    if (useMockMap) {
      const { x, y } = mapCoordsToSvg(activeHomestayOnMap.lat, activeHomestayOnMap.lng);
      const zW = SVG_W / 2;
      const zH = SVG_H / 2;
      setViewBox({
        x: Math.max(0, Math.min(x - zW / 2, SVG_W - zW)),
        y: Math.max(0, Math.min(y - zH / 2, SVG_H - zH)),
        w: zW,
        h: zH,
      });
      setZoomLevel(2);
    } else if (mapRef.current) {
      mapRef.current.easeTo({
        center: [activeHomestayOnMap.lng, activeHomestayOnMap.lat],
        zoom: 13,
        duration: 800
      });
    }
  }, [activeHomestayOnMap, useMockMap, mapCoordsToSvg]);

  // Zoom controls
  const handleZoomIn = () => {
    if (!useMockMap && mapRef.current) {
      mapRef.current.zoomIn();
      return;
    }
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
    if (!useMockMap && mapRef.current) {
      mapRef.current.zoomOut();
      return;
    }
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

  // Fit bounds helper for live map
  const fitTripBounds = useCallback((map) => {
    if (!map) return;
    
    let allCoordinates = [];
    if (mapLayer === 'stops') {
      state.trip.days.forEach(day => {
        day.stops.forEach(s => {
          allCoordinates.push([s.lng, s.lat]);
        });
      });
    } else {
      state.homestays.forEach(h => {
        allCoordinates.push([h.lng, h.lat]);
      });
    }

    if (allCoordinates.length === 0) return;

    const bounds = allCoordinates.reduce(
      (b, coord) => b.extend(coord),
      new maplibregl.LngLatBounds(allCoordinates[0], allCoordinates[0])
    );

    map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
  }, [state.trip, state.homestays, mapLayer]);

  const handleFitTrip = () => {
    if (!useMockMap && mapRef.current) {
      fitTripBounds(mapRef.current);
      return;
    }
    setViewBox({ x: 0, y: 0, w: SVG_W, h: SVG_H });
    setZoomLevel(1);
    dispatch({ type: 'SELECT_STOP', payload: null });
    dispatch({ type: 'SELECT_HOMESTAY_ON_MAP', payload: null });
    setNearbyPOIs([]);
  };

  // Compute center of gravity for a day's stops
  const getDayCog = useCallback((dayId) => {
    const day = state.trip.days.find(d => d.id === dayId);
    if (!day || day.stops.length === 0) return null;
    const avgLat = day.stops.reduce((s, st) => s + st.lat, 0) / day.stops.length;
    const avgLng = day.stops.reduce((s, st) => s + st.lng, 0) / day.stops.length;
    return mapCoordsToSvg(avgLat, avgLng);
  }, [state.trip.days, mapCoordsToSvg]);

  const getDayCogLatLng = useCallback((dayId) => {
    const day = state.trip.days.find(d => d.id === dayId);
    if (!day || day.stops.length === 0) return null;
    const avgLat = day.stops.reduce((s, st) => s + st.lat, 0) / day.stops.length;
    const avgLng = day.stops.reduce((s, st) => s + st.lng, 0) / day.stops.length;
    return [avgLng, avgLat];
  }, [state.trip.days]);

  // Fetch routes from backend OpenRouteService Directions proxy
  useEffect(() => {
    if (useMockMap) return;
    
    const fetchRoutes = async () => {
      const newRoutes = {};
      for (const day of state.trip.days) {
        if (day.stops.length < 2) continue;
        
        const coords = day.stops.map(s => [s.lng, s.lat]);
        try {
          const response = await fetch('/api/route', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              coordinates: coords,
              profile: 'foot-walking'
            })
          });
          if (response.ok) {
            const data = await response.json();
            newRoutes[day.id] = data;
          }
        } catch (error) {
          console.error(`Failed to fetch route for day ${day.id}:`, error);
        }
      }
      setRoutesData(newRoutes);
    };

    if (state.trip?.days) {
      fetchRoutes();
    }
  }, [state.trip.days, useMockMap]);

  // Show Nearby Places helper
  const handleShowNearbyPlaces = async (stop) => {
    try {
      const response = await fetch(`/api/poi?lat=${stop.lat}&lng=${stop.lng}&radius=500`);
      if (response.ok) {
        const pois = await response.json();
        setNearbyPOIs(pois);
        
        // Auto center map to the stop
        if (mapRef.current) {
          mapRef.current.easeTo({
            center: [stop.lng, stop.lat],
            zoom: 15,
            duration: 500
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch nearby POIs:', err);
    }
  };

  // MapLibre Live initialization
  useEffect(() => {
    if (useMockMap || !mapContainerRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://tiles.openfreemap.org/styles/dark',
        center: [139.75, 35.68],
        zoom: 11,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on('error', (e) => {
        console.error('MapLibre error:', e);
        setMapError('Failed to load MapLibre style. Using local interactive canvas.');
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      return () => {
        map.remove();
      };
    } catch (err) {
      console.error('MapLibre init error:', err);
      setMapError(err instanceof Error ? err.message : 'MapLibre initialization failed');
    }
  }, [useMockMap]);

  // Auto-fit bounds on load/trip change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || useMockMap) return;

    const fitOnLoad = () => {
      fitTripBounds(map);
    };

    if (map.loaded()) {
      fitTripBounds(map);
    } else {
      map.on('load', fitOnLoad);
    }

    return () => {
      map.off('load', fitOnLoad);
    };
  }, [state.trip, mapLayer, useMockMap, fitTripBounds]);

  // Handle external map panning events (e.g. from geocoding in ChatPanel)
  useEffect(() => {
    const handlePan = (e) => {
      if (mapRef.current && !useMockMap) {
        mapRef.current.easeTo({
          center: [e.detail.lng, e.detail.lat],
          zoom: 14,
          duration: 800
        });
      }
    };
    window.addEventListener('map-pan-to', handlePan);
    return () => window.removeEventListener('map-pan-to', handlePan);
  }, [useMockMap]);

  // Handle nearby places trigger from the sidebar ItineraryPanel
  useEffect(() => {
    const handleTrigger = (e) => {
      handleShowNearbyPlaces(e.detail);
    };
    window.addEventListener('show-nearby-places', handleTrigger);
    return () => window.removeEventListener('show-nearby-places', handleTrigger);
  }, []);

  // Synchronize state with MapLibre layers & markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || useMockMap) return;

    const syncMapData = () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }

      state.trip.days.forEach(day => {
        const layerId = `route-day-${day.id}`;
        const sourceId = `route-source-day-${day.id}`;
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
        
        const commuteLayerId = `commute-day-${day.id}`;
        const commuteSourceId = `commute-source-day-${day.id}`;
        if (map.getLayer(commuteLayerId)) map.removeLayer(commuteLayerId);
        if (map.getSource(commuteSourceId)) map.removeSource(commuteSourceId);
      });

      if (mapLayer === 'stops') {
        // Find which day the active stop belongs to
        let activeDayId = null;
        if (state.activeStopId) {
          for (const day of state.trip.days) {
            if (day.stops.some(s => s.id === state.activeStopId)) {
              activeDayId = day.id;
              break;
            }
          }
        }

        state.trip.days.forEach(day => {
          const routeGeoJSON = routesData[day.id];
          if (!routeGeoJSON) return;

          const sourceId = `route-source-day-${day.id}`;
          const layerId = `route-day-${day.id}`;
          const color = getDayColorHex(day.colorHue);
          
          // Active day = bright + wide, inactive days = dimmed + thin
          const isActive = !activeDayId || day.id === activeDayId;
          const lineWidth = isActive ? 5 : 2;
          const lineOpacity = isActive ? 0.95 : 0.25;

          map.addSource(sourceId, {
            type: 'geojson',
            data: routeGeoJSON
          });

          map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': color,
              'line-width': lineWidth,
              'line-opacity': lineOpacity
            }
          });
        });
      }

      if (mapLayer === 'stops') {
        state.trip.days.forEach(day => {
          day.stops.forEach((stop, idx) => {
            const el = document.createElement('div');
            el.className = 'custom-stop-marker flex items-center justify-center cursor-pointer transition-all duration-300 font-sans';
            
            const color = getDayColorHex(day.colorHue);
            el.style.backgroundColor = color;
            el.style.color = '#0e1513';
            el.style.width = '24px';
            el.style.height = '24px';
            el.style.borderRadius = '50%';
            el.style.fontWeight = 'bold';
            el.style.fontSize = '12px';
            el.style.border = '2px solid white';
            el.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
            el.innerText = `${idx + 1}`;

            if (state.activeStopId === stop.id) {
              el.classList.add('pulse-glow', 'scale-110');
              el.style.border = `2px solid ${color}`;
              el.style.boxShadow = `0 0 15px ${color}`;
            }

            el.addEventListener('click', (e) => {
              e.stopPropagation();
              handleMapStopClick(stop.id);
            });

            el.addEventListener('mouseenter', () => {
              handleMapStopHover(stop.id);
            });
            el.addEventListener('mouseleave', () => {
              handleMapStopHover(null);
            });

            const marker = new maplibregl.Marker({ element: el })
              .setLngLat([stop.lng, stop.lat])
              .addTo(map);

            markersRef.current.push(marker);
          });
        });
      }

      if (mapLayer === 'stops' && state.activeStopId) {
        const stop = activeStop;
        if (stop) {
          const dayColor = getDayColorHex(stop.dayColorHue);
          const popupContent = document.createElement('div');
          popupContent.className = 'glass-panel rounded-2xl p-3.5 min-w-[220px] max-w-[280px] shadow-2xl border border-white/[0.1] relative text-left font-sans';
          
          popupContent.innerHTML = `
            <div class="flex items-center gap-2 mb-2">
              <span class="px-1.5 py-0.5 rounded text-[8px] font-bold font-mono border" style="background-color: ${dayColor}15; border-color: ${dayColor}30; color: ${dayColor};">
                STOP
              </span>
              <span class="text-[9px] text-muted font-mono">${stop.timeEstimate || 'No time set'}</span>
            </div>
            
            <h4 class="font-bold text-xs text-white mb-1.5 leading-snug">${stop.name}</h4>
            
            <div class="flex items-center gap-3 mb-2.5 font-mono text-[9px]">
              <span class="text-white flex items-center gap-0.5">
                💰 Cost: ${stop.costEstimate === 0 ? 'Free' : `¥${stop.costEstimate.toLocaleString()}`}
              </span>
            </div>

            <div class="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2 mb-2.5">
              <span class="text-[7px] text-muted font-bold uppercase tracking-widest block mb-0.5">Why Picked</span>
              <p class="text-[8px] text-muted leading-relaxed">${stop.rationale}</p>
            </div>

            <div class="flex gap-1.5 font-sans">
              <button class="nearby-btn flex-1 py-1.5 rounded-lg text-[9px] font-bold bg-accent text-bg hover:bg-accent/80 transition-all transform active:scale-95 cursor-pointer">
                🔍 Nearby Places
              </button>
              <button class="delete-btn py-1.5 px-2.5 rounded-lg text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all transform active:scale-95 cursor-pointer">
                🗑️ Delete
              </button>
            </div>

            <button class="close-btn absolute top-2 right-2 w-5 h-5 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-muted hover:text-white transition-colors cursor-pointer">
              <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          `;

          const day = state.trip.days.find(d => d.stops.some(s => s.id === stop.id));
          const dayId = day ? day.id : null;

          popupContent.querySelector('.nearby-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            handleShowNearbyPlaces(stop);
          });

          popupContent.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (dayId) {
              dispatch({ type: 'REMOVE_STOP', payload: { dayId, stopId: stop.id } });
              dispatch({ type: 'SELECT_STOP', payload: null });
            }
          });

          popupContent.querySelector('.close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            dispatch({ type: 'SELECT_STOP', payload: null });
          });

          const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 15 })
            .setLngLat([stop.lng, stop.lat])
            .setDOMContent(popupContent)
            .addTo(map);

          popupRef.current = popup;
        }
      }

      if (mapLayer === 'homestays') {
        state.homestays.forEach(home => {
          const el = document.createElement('div');
          el.className = 'custom-homestay-marker cursor-pointer transition-all duration-300';
          
          const isSelected = state.selectedHomestayId === home.id;
          const isHovered = state.hoveredHomestayId === home.id;
          const isHighlighted = isSelected || isHovered;

          el.innerHTML = `
            <div class="w-8 h-8 rounded-lg bg-[#161d1b] border border-accent/40 flex items-center justify-center text-accent shadow-lg hover:border-accent hover:scale-105 transition-all duration-200 ${
              isHighlighted ? 'glow-accent-strong scale-110 border-accent bg-accent-dim' : ''
            }">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
          `;

          el.addEventListener('click', (e) => {
            e.stopPropagation();
            handleMapHomestayClick(home.id);
          });

          el.addEventListener('mouseenter', () => {
            dispatch({ type: 'HOVER_HOMESTAY', payload: home.id });
          });
          el.addEventListener('mouseleave', () => {
            dispatch({ type: 'HOVER_HOMESTAY', payload: null });
          });

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([home.lng, home.lat])
            .addTo(map);

          markersRef.current.push(marker);
        });
      }

      if (activeHomestay) {
        state.trip.days.forEach(day => {
          const cog = getDayCogLatLng(day.id);
          if (!cog) return;

          const sourceId = `commute-source-day-${day.id}`;
          const layerId = `commute-day-${day.id}`;

          const geojson = {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [activeHomestay.lng, activeHomestay.lat],
                cog
              ]
            }
          };

          map.addSource(sourceId, {
            type: 'geojson',
            data: geojson
          });

          map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': '#2dd4bf',
              'line-width': 2,
              'line-dasharray': [3, 3]
            }
          });
        });
      }

      if (mapLayer === 'homestays' && activeHomestayOnMap) {
        const home = activeHomestayOnMap;
        const isSelected = state.selectedHomestayId === home.id;
        const popupContent = document.createElement('div');
        popupContent.className = 'glass-panel rounded-2xl p-3.5 min-w-[220px] max-w-[280px] shadow-2xl border border-white/[0.1] relative text-left font-sans';
        
        popupContent.innerHTML = `
          <div class="h-14 rounded-xl mb-2.5 flex items-center justify-center bg-gradient-to-br from-accent/20 via-accent/5 to-transparent">
            <span class="text-2xl">🏠</span>
          </div>

          <div class="flex items-start justify-between mb-1.5">
            <h4 class="font-bold text-xs text-white leading-snug">${home.name}</h4>
            <div class="flex items-center gap-0.5 text-[9px] font-mono text-amber-400 shrink-0 ml-2">
              <span>★</span>
              <span>${home.rating}</span>
              <span class="text-muted">(${home.reviewCount})</span>
            </div>
          </div>

          <div class="flex items-center gap-3 mb-2.5 font-mono">
            <span class="text-sm font-bold text-white">
              ¥${home.pricePerNight.toLocaleString()}
              <span class="text-[8px] text-muted font-normal"> /night</span>
            </span>
            <span class="text-[9px] text-accent flex items-center gap-0.5 font-sans">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              ${home.avgCommuteMinutes}min avg
            </span>
          </div>

          <div class="flex flex-wrap gap-1 mb-2.5">
            ${home.amenities.slice(0, 4).map(amenity => `
              <span class="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.05] text-[7px] text-muted font-mono">
                ${amenity}
              </span>
            `).join('')}
          </div>

          <div class="bg-accent/5 border border-accent/10 rounded-lg p-2 mb-2.5">
            <span class="text-[7px] text-accent font-bold uppercase tracking-widest block mb-0.5">Route Fit</span>
            <p class="text-[8px] text-accent/70 leading-relaxed">${home.rationale}</p>
          </div>

          <button class="select-btn w-full py-2 rounded-lg text-[10px] font-bold transition-all transform active:scale-95 cursor-pointer ${
            isSelected
              ? 'bg-accent text-bg hover:bg-accent/80'
              : 'bg-white/[0.05] text-white hover:bg-white/[0.1] border border-white/[0.08]'
          }">
            ${isSelected ? '✓ Selected as Lodging' : 'Choose This Homestay'}
          </button>

          <button class="close-btn absolute top-2 right-2 w-5 h-5 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-muted hover:text-white transition-colors cursor-pointer">
            <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        `;

        popupContent.querySelector('.select-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          dispatch({ type: 'SELECT_HOMESTAY', payload: isSelected ? null : home.id });
        });
        popupContent.querySelector('.close-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          dispatch({ type: 'SELECT_HOMESTAY_ON_MAP', payload: null });
        });

        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 25 })
          .setLngLat([home.lng, home.lat])
          .setDOMContent(popupContent)
          .addTo(map);

        popupRef.current = popup;
      }

      if (nearbyPOIs.length > 0) {
        nearbyPOIs.forEach((poi) => {
          const el = document.createElement('div');
          el.className = 'custom-poi-marker cursor-pointer transition-all duration-300';
          
          let icon = '📍';
          let bgColor = 'rgba(255,255,255,0.1)';
          let borderColor = 'rgba(255,255,255,0.4)';
          let color = '#fff';

          if (poi.category === 'food') {
            icon = '🍱';
            bgColor = 'rgba(251, 191, 36, 0.15)';
            borderColor = 'rgba(251, 191, 36, 0.4)';
            color = '#fbbf24';
          } else if (poi.category === 'cafe') {
            icon = '☕';
            bgColor = 'rgba(163, 230, 53, 0.15)';
            borderColor = 'rgba(163, 230, 53, 0.4)';
            color = '#a3e635';
          } else if (poi.category === 'sight') {
            icon = '🏛️';
            bgColor = 'rgba(192, 132, 252, 0.15)';
            borderColor = 'rgba(192, 132, 252, 0.4)';
            color = '#c084fc';
          }

          el.innerHTML = `
            <div class="w-8 h-8 rounded-full border flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-200"
                 style="background-color: ${bgColor}; border-color: ${borderColor}; color: ${color};">
              <span class="text-xs">${icon}</span>
            </div>
          `;

          el.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const popupContent = document.createElement('div');
            popupContent.className = 'glass-panel rounded-2xl p-3.5 min-w-[200px] max-w-[250px] shadow-2xl border border-white/[0.1] relative text-left font-sans';
            popupContent.innerHTML = `
              <div class="flex items-center gap-1.5 mb-1.5 text-[8px] text-muted font-mono uppercase tracking-wide">
                <span>${poi.category}</span>
                <span>•</span>
                <span class="text-amber-400">★ ${poi.rating}</span>
                <span>(${poi.reviewsCount})</span>
              </div>
              <h4 class="font-bold text-xs text-white mb-1.5 leading-snug">${poi.name}</h4>
              <p class="text-[9px] text-muted mb-2">${poi.address}</p>
              
              <button class="add-poi-btn w-full py-1.5 rounded-lg text-[9px] font-bold bg-accent text-bg hover:bg-accent/80 transition-all transform active:scale-95 cursor-pointer">
                ➕ Add to Itinerary
              </button>
              
              <button class="close-btn absolute top-2 right-2 w-4 h-4 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-muted hover:text-white transition-colors cursor-pointer">
                <svg class="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            `;

            popupContent.querySelector('.add-poi-btn').addEventListener('click', (ev) => {
              ev.stopPropagation();
              let targetDayId = 'day-1';
              if (state.activeStopId) {
                const activeDay = state.trip.days.find(d => d.stops.some(s => s.id === state.activeStopId));
                if (activeDay) targetDayId = activeDay.id;
              }
              
              const newStop = {
                id: `stop-poi-${Date.now()}`,
                name: poi.name,
                lat: poi.lat,
                lng: poi.lng,
                timeEstimate: '01:00 PM - 02:00 PM',
                costEstimate: 0,
                rationale: `Added from nearby recommendations near your itinerary stops. Rated ${poi.rating} stars with ${poi.reviewsCount} reviews.`,
              };

              dispatch({
                type: 'ADD_STOP',
                payload: {
                  dayId: targetDayId,
                  stop: newStop
                }
              });
              
              setNearbyPOIs([]);
              dispatch({ type: 'SELECT_STOP', payload: newStop.id });
            });

            popupContent.querySelector('.close-btn').addEventListener('click', (ev) => {
              ev.stopPropagation();
              if (popupRef.current) {
                popupRef.current.remove();
                popupRef.current = null;
              }
            });

            const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 15 })
              .setLngLat([poi.lng, poi.lat])
              .setDOMContent(popupContent)
              .addTo(map);

            popupRef.current = popup;
          });

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([poi.lng, poi.lat])
            .addTo(map);
          markersRef.current.push(marker);
        });
      }
    };

    if (map.loaded()) {
      syncMapData();
    } else {
      map.on('load', syncMapData);
    }

    const onMapClick = () => {
      dispatch({ type: 'SELECT_STOP', payload: null });
      dispatch({ type: 'SELECT_HOMESTAY_ON_MAP', payload: null });
      setNearbyPOIs([]);
    };
    map.on('click', onMapClick);

    return () => {
      map.off('click', onMapClick);
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (popupRef.current) popupRef.current.remove();
    };
  }, [
    state.trip, 
    mapLayer, 
    routesData, 
    nearbyPOIs, 
    state.selectedHomestayId, 
    state.hoveredHomestayId, 
    state.activeStopId, 
    activeHomestay, 
    activeHomestayOnMap, 
    activeStop, 
    useMockMap,
    getDayCogLatLng,
    dispatch
  ]);

  // Helper declarations moved to top of component

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

            {/* ═══════════════════════════════════════════
                STOPS LAYER — Day routes + Stop pins
                ═══════════════════════════════════════════ */}
            {mapLayer === 'stops' && (
              <g className="fade-in">
                {/* Day Route Polylines */}
                {(() => {
                  // Find which day the active stop belongs to
                  let activeDayId = null;
                  if (state.activeStopId) {
                    for (const day of state.trip.days) {
                      if (day.stops.some(s => s.id === state.activeStopId)) {
                        activeDayId = day.id;
                        break;
                      }
                    }
                  }

                  return state.trip.days.map((day) => {
                    if (day.stops.length < 2) return null;
                    const color = getDayColorHex(day.colorHue);
                    const pathData = day.stops
                      .map((stop, idx) => {
                        const { x, y } = mapCoordsToSvg(stop.lat, stop.lng);
                        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ');

                    const isActiveDayRoute = !activeDayId || day.id === activeDayId;
                    const mainOpacity = isActiveDayRoute ? 0.75 : 0.12;
                    const glowOpacity = isActiveDayRoute ? 0.18 : 0.04;
                    const dashOpacity = isActiveDayRoute ? 0.9 : 0;
                    const strokeW = isActiveDayRoute ? 3 : 1.5;

                    return (
                      <g key={day.id} style={{ transition: 'opacity 0.4s ease' }}>
                        {/* Glow path */}
                        <path d={pathData} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity={glowOpacity} />
                        {/* Main path */}
                        <path d={pathData} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" opacity={mainOpacity} />
                        {/* Animated dash overlay — only shown for active day */}
                        {isActiveDayRoute && (
                          <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8,6" opacity={dashOpacity} style={{ animation: 'dash 20s linear infinite' }} />
                        )}
                      </g>
                    );
                  });
                })()}

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
                        {isPulsing && <circle r="14" fill={color} opacity="0.15" className="animate-ping" />}
                        <circle r={isPulsing ? '9' : '7'} fill={color} opacity={isPulsing ? 0.35 : 0.2} style={{ transition: 'all 0.3s ease' }} />
                        <circle r={isPulsing ? '6.5' : '5.5'} fill={color} style={{ transition: 'all 0.3s ease' }} />
                        <circle r={isPulsing ? '4.5' : '3.5'} fill="#0e1513" style={{ transition: 'all 0.3s ease' }} />
                        <text y="2.5" textAnchor="middle" fill={color} fontSize={isPulsing ? '7' : '6'} fontWeight="bold" fontFamily="JetBrains Mono, monospace" style={{ transition: 'all 0.3s ease' }}>
                          {stop.order}
                        </text>
                        <title>{stop.name}</title>
                      </g>
                    );
                  });
                })}
              </g>
            )}

            {/* ═══════════════════════════════════════════
                HOMESTAYS LAYER — Homestay pins + commute lines + radius rings
                ═══════════════════════════════════════════ */}
            {mapLayer === 'homestays' && (
              <g className="fade-in">
                {/* Ghost day routes (dimmed, for spatial context) */}
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
                    <path key={day.id} d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.12" strokeDasharray="4,6" />
                  );
                })}

                {/* Ghost stop pins (dimmed) */}
                {state.trip.days.map((day) => {
                  const color = getDayColorHex(day.colorHue);
                  return day.stops.map((stop) => {
                    const { x, y } = mapCoordsToSvg(stop.lat, stop.lng);
                    return (
                      <g key={stop.id} transform={`translate(${x}, ${y})`}>
                        <circle r="4" fill={color} opacity="0.12" />
                        <circle r="2.5" fill={color} opacity="0.2" />
                      </g>
                    );
                  });
                })}

                {/* Day Center-of-Gravity markers */}
                {state.trip.days.map((day) => {
                  const cog = getDayCog(day.id);
                  if (!cog) return null;
                  const color = getDayColorHex(day.colorHue);
                  return (
                    <g key={`cog-${day.id}`}>
                      <circle cx={cog.x} cy={cog.y} r="18" fill="none" stroke={color} strokeWidth="0.8" strokeDasharray="3,3" opacity="0.2" />
                      <circle cx={cog.x} cy={cog.y} r="3" fill={color} opacity="0.25" />
                      <text x={cog.x} y={cog.y - 22} textAnchor="middle" fill={color} fontSize="5" fontWeight="bold" fontFamily="JetBrains Mono, monospace" opacity="0.4">
                        D{day.dayNumber} CENTER
                      </text>
                    </g>
                  );
                })}

                {/* Commute Lines from active homestay to day COGs */}
                {activeHomestayOnMap && state.trip.days.map((day) => {
                  const cog = getDayCog(day.id);
                  if (!cog) return null;
                  const homePos = mapCoordsToSvg(activeHomestayOnMap.lat, activeHomestayOnMap.lng);
                  const color = getDayColorHex(day.colorHue);

                  return (
                    <g key={`commute-h-${day.id}`} className="fade-in">
                      <line x1={homePos.x} y1={homePos.y} x2={cog.x} y2={cog.y} stroke={color} strokeWidth="1.5" strokeDasharray="4,4" opacity="0.45" style={{ animation: 'dash 3s linear infinite' }} />
                    </g>
                  );
                })}

                {/* Also show commute lines when hovered from itinerary panel */}
                {activeHomestay && !activeHomestayOnMap && state.trip.days.map((day) => {
                  const cog = getDayCog(day.id);
                  if (!cog) return null;
                  const homePos = mapCoordsToSvg(activeHomestay.lat, activeHomestay.lng);

                  return (
                    <g key={`commute-it-${day.id}`} className="fade-in">
                      <line x1={homePos.x} y1={homePos.y} x2={cog.x} y2={cog.y} stroke="#2dd4bf" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.5" style={{ animation: 'dash 3s linear infinite' }} />
                      <circle cx={cog.x} cy={cog.y} r="3" fill="none" stroke="#2dd4bf" strokeWidth="1" opacity="0.3" />
                    </g>
                  );
                })}

                {/* Homestay Pins (prominently displayed) */}
                {state.homestays.map((home) => {
                  const { x, y } = mapCoordsToSvg(home.lat, home.lng);
                  const isSelected = state.selectedHomestayId === home.id;
                  const isHovered = state.hoveredHomestayId === home.id;
                  const isActiveOnMap = state.activeHomestayOnMapId === home.id;
                  const isHighlighted = isSelected || isHovered || isActiveOnMap;

                  return (
                    <g
                      key={home.id}
                      className="cursor-pointer"
                      transform={`translate(${x}, ${y})`}
                      onClick={() => handleMapHomestayClick(home.id)}
                      onMouseEnter={() => dispatch({ type: 'HOVER_HOMESTAY', payload: home.id })}
                      onMouseLeave={() => dispatch({ type: 'HOVER_HOMESTAY', payload: null })}
                    >
                      {/* Proximity ring */}
                      <circle r="28" fill="none" stroke="#2dd4bf" strokeWidth="0.5" strokeDasharray="2,3" opacity={isHighlighted ? 0.3 : 0.1} style={{ transition: 'all 0.3s ease' }} />

                      {/* Pulse glow */}
                      {isHighlighted && (
                        <circle r="20" fill="#2dd4bf" opacity="0.08" className="animate-pulse" />
                      )}

                      {/* Outer circle */}
                      <circle
                        r={isHighlighted ? 14 : 10}
                        fill={isActiveOnMap ? 'rgba(45,212,191,0.2)' : isSelected ? 'rgba(45,212,191,0.15)' : 'rgba(22,29,27,0.7)'}
                        stroke={isHighlighted ? '#2dd4bf' : 'rgba(255,255,255,0.1)'}
                        strokeWidth={isHighlighted ? 1.5 : 0.8}
                        style={{ transition: 'all 0.3s ease' }}
                      />

                      {/* House shape */}
                      <path
                        d="M-6 3 L-6 -1 L0 -7 L6 -1 L6 3 Z"
                        fill={isHighlighted ? '#2dd4bf' : '#9aa3b2'}
                        opacity={isHighlighted ? 1 : 0.5}
                        style={{ transition: 'all 0.3s ease' }}
                      />
                      {/* Door */}
                      <rect x="-1.5" y="-1" width="3" height="4" fill={isHighlighted ? '#0e1513' : '#0b1a1a'} opacity="0.6" rx="0.5" />

                      {/* Rating badge */}
                      <g transform="translate(10, -10)">
                        <rect x="-8" y="-5" width="16" height="10" rx="4" fill="rgba(22,29,27,0.85)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                        <text textAnchor="middle" y="2" fill="#fbbf24" fontSize="5" fontWeight="bold" fontFamily="JetBrains Mono, monospace">
                          ★{home.rating}
                        </text>
                      </g>

                      {/* Name label (visible when highlighted) */}
                      {isHighlighted && (
                        <g transform="translate(0, 20)">
                          <rect x="-35" y="-6" width="70" height="12" rx="4" fill="rgba(22,29,27,0.9)" stroke="rgba(45,212,191,0.2)" strokeWidth="0.5" />
                          <text textAnchor="middle" y="2" fill="#e7e9ee" fontSize="4.5" fontWeight="600" fontFamily="Sora, sans-serif">
                            {home.name}
                          </text>
                        </g>
                      )}

                      <title>{home.name} — ★{home.rating} — ¥{home.pricePerNight.toLocaleString()}/night</title>
                    </g>
                  );
                })}
              </g>
            )}

            {/* ═══════════════════════════════════════════
                STOPS LAYER — Homestay pins (ghost, for reference)
                ═══════════════════════════════════════════ */}
            {mapLayer === 'stops' && (
              <g>
                {/* Commute Lines from itinerary panel homestay hover */}
                {activeHomestay && state.trip.days.map((day) => {
                  const cog = getDayCog(day.id);
                  if (!cog) return null;
                  const homePos = mapCoordsToSvg(activeHomestay.lat, activeHomestay.lng);

                  return (
                    <g key={`commute-${day.id}`} className="fade-in">
                      <line x1={homePos.x} y1={homePos.y} x2={cog.x} y2={cog.y} stroke="#2dd4bf" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.5" style={{ animation: 'dash 3s linear infinite' }} />
                      <circle cx={cog.x} cy={cog.y} r="3" fill="none" stroke="#2dd4bf" strokeWidth="1" opacity="0.3" />
                    </g>
                  );
                })}

                {/* Small homestay pins in stops view */}
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
              </g>
            )}
          </svg>

          {/* ─── Stop Popover (Glassmorphic) ─── */}
          {activeStop && mapLayer === 'stops' && useMockMap && (() => {
            const { x, y } = mapCoordsToSvg(activeStop.lat, activeStop.lng);
            const color = getDayColorHex(activeStop.dayColorHue);
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
                  <div
                    className="h-16 rounded-xl mb-2.5 flex items-end p-2"
                    style={{ background: `linear-gradient(135deg, ${color}30, ${color}10, rgba(14,21,19,0.8))` }}
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
                  <div className="bg-accent/5 border border-accent/10 rounded-lg p-2">
                    <span className="text-[7px] text-accent font-bold uppercase tracking-widest block mb-0.5">Why this?</span>
                    <p className="text-[9px] text-accent/70 leading-relaxed">{activeStop.rationale}</p>
                  </div>
                  <button
                    onClick={() => dispatch({ type: 'SELECT_STOP', payload: null })}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-muted hover:text-white transition-colors cursor-pointer"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="w-3 h-3 rotate-45 mx-auto -mt-1.5" style={{ background: 'rgba(22, 29, 27, 0.7)', borderRight: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
            );
          })()}

          {/* ─── Homestay Popover (Glassmorphic) ─── */}
          {activeHomestayOnMap && mapLayer === 'homestays' && useMockMap && (() => {
            const home = activeHomestayOnMap;
            const { x, y } = mapCoordsToSvg(home.lat, home.lng);
            const pctX = ((x - viewBox.x) / viewBox.w) * 100;
            const pctY = ((y - viewBox.y) / viewBox.h) * 100;
            const isSelected = state.selectedHomestayId === home.id;

            return (
              <div
                className="absolute z-30 scale-in pointer-events-auto"
                style={{
                  left: `${Math.min(Math.max(pctX, 18), 72)}%`,
                  top: `${Math.min(Math.max(pctY - 12, 5), 55)}%`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <div className="glass-panel rounded-2xl p-3.5 min-w-[220px] max-w-[280px] shadow-2xl border border-white/[0.1]">
                  {/* Gradient header with house icon */}
                  <div className="h-14 rounded-xl mb-2.5 flex items-center justify-center bg-gradient-to-br from-accent/20 via-accent/5 to-transparent">
                    <span className="text-2xl">🏠</span>
                  </div>

                  {/* Name & Rating */}
                  <div className="flex items-start justify-between mb-1.5">
                    <h4 className="font-bold text-xs text-white">{home.name}</h4>
                    <div className="flex items-center gap-0.5 text-[9px] font-mono text-amber-400 shrink-0 ml-2">
                      <span>★</span>
                      <span>{home.rating}</span>
                      <span className="text-muted">({home.reviewCount})</span>
                    </div>
                  </div>

                  {/* Price & Commute */}
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className="font-mono text-sm font-bold text-white">
                      ¥{home.pricePerNight.toLocaleString()}
                      <span className="text-[8px] text-muted font-normal"> /night</span>
                    </span>
                    <span className="text-[9px] text-accent font-mono flex items-center gap-0.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      {home.avgCommuteMinutes}min avg
                    </span>
                  </div>

                  {/* Amenities */}
                  <div className="flex flex-wrap gap-1 mb-2.5">
                    {home.amenities.slice(0, 4).map((amenity, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.05] text-[7px] text-muted font-mono">
                        {amenity}
                      </span>
                    ))}
                  </div>

                  {/* AI Rationale */}
                  <div className="bg-accent/5 border border-accent/10 rounded-lg p-2 mb-2.5">
                    <span className="text-[7px] text-accent font-bold uppercase tracking-widest block mb-0.5">Route Fit</span>
                    <p className="text-[8px] text-accent/70 leading-relaxed">{home.rationale}</p>
                  </div>

                  {/* Select button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: 'SELECT_HOMESTAY', payload: isSelected ? null : home.id });
                    }}
                    className={`w-full py-2 rounded-lg text-[10px] font-bold transition-all transform active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'bg-accent text-bg hover:bg-accent/80'
                        : 'bg-white/[0.05] text-white hover:bg-white/[0.1] border border-white/[0.08]'
                    }`}
                  >
                    {isSelected ? '✓ Selected as Lodging' : 'Choose This Homestay'}
                  </button>

                  {/* Close */}
                  <button
                    onClick={() => dispatch({ type: 'SELECT_HOMESTAY_ON_MAP', payload: null })}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-muted hover:text-white transition-colors cursor-pointer"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {/* Arrow */}
                <div className="w-3 h-3 rotate-45 mx-auto -mt-1.5" style={{ background: 'rgba(22, 29, 27, 0.7)', borderRight: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
            );
          })()}

          {/* Map Status Overlay */}
          <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl glass-panel text-center max-w-sm mx-auto z-20 border border-white/[0.08]">
            <h4 className="font-bold text-[10px] text-white mb-0.5 flex items-center justify-center gap-1.5 font-sans">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent"></span>
              </span>
              OpenFreeMap Live Vector Tiles
            </h4>
            <p className="text-[9px] text-muted leading-relaxed font-sans">
              Connected. Displaying street-level travel coordinates and routing.
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MAP HUD — Tab Switcher (Stops / Homestays)
          ═══════════════════════════════════════════ */}
      <div className="absolute top-3 left-3 z-20 glass-panel rounded-xl p-2 shadow-xl border border-white/[0.06]">
        {/* Tab Bar */}
        <div className="flex gap-1 mb-1.5">
          <button
            onClick={() => dispatch({ type: 'SET_MAP_LAYER', payload: 'stops' })}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all-300 cursor-pointer ${
              mapLayer === 'stops'
                ? 'bg-accent/15 border border-accent/25 text-accent shadow-sm'
                : 'bg-white/[0.02] border border-transparent text-muted hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Stops
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_MAP_LAYER', payload: 'homestays' })}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all-300 cursor-pointer ${
              mapLayer === 'homestays'
                ? 'bg-accent/15 border border-accent/25 text-accent shadow-sm'
                : 'bg-white/[0.02] border border-transparent text-muted hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Homestays
            <span className="px-1 py-0.5 rounded bg-white/[0.06] text-[7px] font-mono text-muted">
              {state.homestays.length}
            </span>
          </button>
        </div>

        {/* Day chips (visible in stops mode) */}
        {mapLayer === 'stops' && (
          <div className="flex gap-1 fade-in">
            {state.trip.days.map((day) => {
              const color = getDayColorHex(day.colorHue);
              return (
                <span
                  key={day.id}
                  className="px-1.5 py-0.5 rounded text-[7px] font-bold font-mono border cursor-pointer transition-all-300"
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
        )}

        {/* Homestay summary (visible in homestays mode) */}
        {mapLayer === 'homestays' && (
          <div className="flex items-center gap-2 text-[8px] text-muted font-mono fade-in px-0.5">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
              {state.selectedHomestayId ? 'Selected' : 'Click to explore'}
            </span>
            {state.selectedHomestayId && (
              <span className="text-accent font-semibold">
                {state.homestays.find(h => h.id === state.selectedHomestayId)?.name}
              </span>
            )}
          </div>
        )}
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
