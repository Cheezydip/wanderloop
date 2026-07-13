/* eslint-disable */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTrip } from '../../context/TripContext';
import { useTheme } from '../../context/ThemeContext';
import { getDayColorHex } from '../../utils/colors';
import { haversine, getTravelLabel } from '../../utils/haversine';
import { fetchRoute } from '../../utils/routeService';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Tokyo bounding box
const BOUNDS = { minLat: 35.61, maxLat: 35.73, minLng: 139.68, maxLng: 139.83 };
const SVG_W = 500;
const SVG_H = 400;

const getCartoStyle = (theme) => {
  const isLight = theme === 'sunset';
  const styleType = isLight ? 'light_all' : 'dark_all';
  return {
    version: 8,
    sources: {
      'carto-raster-tiles': {
        type: 'raster',
        tiles: [
          `https://a.basemaps.cartocdn.com/${styleType}/{z}/{x}/{y}.png`,
          `https://b.basemaps.cartocdn.com/${styleType}/{z}/{x}/{y}.png`,
          `https://c.basemaps.cartocdn.com/${styleType}/{z}/{x}/{y}.png`,
          `https://d.basemaps.cartocdn.com/${styleType}/{z}/{x}/{y}.png`
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors, © CARTO'
      }
    },
    layers: [
      {
        id: 'carto-raster-layer',
        type: 'raster',
        source: 'carto-raster-tiles',
        minzoom: 0,
        maxzoom: 20
      }
    ]
  };
};

export default function MapPanel() {
  const { state, dispatch } = useTrip();
  const { theme } = useTheme();
  const mapContainerRef = useRef(null);
  const [mapError, setMapError] = useState(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const popupRef = useRef(null);
  const syncMapDataRef = useRef(null);
  const activePOIPopupRef = useRef(false);

  const [styleTrigger, setStyleTrigger] = useState(0);
  const routesData = state.routesData;
  const [closedPopupStopId, setClosedPopupStopId] = useState(null);
  const [closedPopupHomestayId, setClosedPopupHomestayId] = useState(null);
  const [activePoiOnMap, setActivePoiOnMap] = useState(null);

  // Reset closed popup states when selections change
  useEffect(() => {
    setClosedPopupStopId(null);
    setActivePoiOnMap(null);
  }, [state.activeStopId]);

  useEffect(() => {
    setClosedPopupHomestayId(null);
  }, [state.activeHomestayOnMapId]);
  // Using state.nearbyPOIs from global context

  // SVG panning state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: SVG_W, h: SVG_H });
  const [zoomLevel, setZoomLevel] = useState(1);

  const useMockMap = mapError !== null;

  const mapLayer = state.mapLayer; // 'stops' | 'homestays'
  const highlightedDayId = state.highlightedDayId;

  // Handle stop click on the map
  const handleMapStopClick = useCallback((stopId) => {
    if (state.activeStopId === stopId && closedPopupStopId === stopId) {
      setClosedPopupStopId(null);
    } else {
      dispatch({ type: 'SELECT_STOP', payload: state.activeStopId === stopId ? null : stopId });
    }
  }, [state.activeStopId, closedPopupStopId, dispatch]);

  const handleMapStopHover = useCallback((stopId) => {
    dispatch({ type: 'HOVER_STOP', payload: stopId });
  }, [dispatch]);

  // Handle homestay click on the map
  const handleMapHomestayClick = useCallback((homestayId) => {
    if (state.activeHomestayOnMapId === homestayId && closedPopupHomestayId === homestayId) {
      setClosedPopupHomestayId(null);
    } else {
      const nextId = state.selectedHomestayId === homestayId ? null : homestayId;
      dispatch({
        type: 'SELECT_HOMESTAY',
        payload: nextId,
      });
      dispatch({
        type: 'SELECT_HOMESTAY_ON_MAP',
        payload: state.activeHomestayOnMapId === homestayId ? null : homestayId,
      });
    }
  }, [state.selectedHomestayId, state.activeHomestayOnMapId, closedPopupHomestayId, dispatch]);

  // Toggle AI chat panel visibility
  const handleToggleChat = useCallback(() => {
    if (window.innerWidth <= 768) {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: state.activeTab === 'chat' ? 'map' : 'chat' });
    } else {
      dispatch({ type: 'TOGGLE_CHAT' });
    }
  }, [state.activeTab, dispatch]);

  // Toggle homestay pin visibility on the map
  const handleToggleHomestays = useCallback(() => {
    dispatch({ type: 'TOGGLE_HOMESTAYS' });
  }, [dispatch]);

  // Track hovered/selected homestay for drawing commute lines
  const activeHomestayId = state.hoveredHomestayId || state.selectedHomestayId;
  const activeHomestay = state.homestays.find(h => h.id === activeHomestayId);

  // Homestay selected on map (for popover)
  const activeHomestayOnMap = state.homestays.find(h => h.id === state.activeHomestayOnMapId);

  // Compute which homestays should be visible based on the active day context
  const visibleHomestays = useMemo(() => {
    // Determine which day to filter by: explicit highlight takes priority,
    // then fall back to the day of the currently selected stop
    let filterDayId = highlightedDayId;
    if (!filterDayId && state.activeStopId) {
      const dayOfStop = state.trip.days.find(d => d.stops.some(s => s.id === state.activeStopId));
      if (dayOfStop) filterDayId = dayOfStop.id;
    }

    if (!filterDayId) return []; // no day selected → hide all homestays

    const day = state.trip.days.find(d => d.id === filterDayId);
    if (!day || !day.stops || day.stops.length === 0) return state.homestays;

    return state.homestays.filter(h =>
      day.stops.some(stop => haversine(h.lat, h.lng, stop.lat, stop.lng) <= 5)
    );
  }, [state.homestays, state.trip.days, highlightedDayId, state.activeStopId]);

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
      if (stop) return { ...stop, dayColorHue: day.colorHue, dayId: day.id };
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
      const currentZoom = mapRef.current.getZoom();
      mapRef.current.easeTo({
        center: [activeStop.lng, activeStop.lat],
        zoom: Math.max(currentZoom, 14),
        offset: [0, -100],
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
      const currentZoom = mapRef.current.getZoom();
      mapRef.current.easeTo({
        center: [activeHomestayOnMap.lng, activeHomestayOnMap.lat],
        zoom: Math.max(currentZoom, 13),
        offset: [0, -120],
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
    dispatch({ type: 'HIGHLIGHT_DAY', payload: null }); // reset highlight
    dispatch({ type: 'SET_NEARBY_POIS', payload: [] });
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

  // Legend click handler
  const handleLegendClick = useCallback((dayId) => {
    dispatch({ type: 'HIGHLIGHT_DAY', payload: dayId });
  }, [dispatch]);



  // Show Nearby Places helper (dispatches to global context)
  const handleShowNearbyPlaces = useCallback(async (stop) => {
    dispatch({ type: 'SET_LOADING_POIS', payload: true });
    try {
      const response = await fetch(`/api/poi?lat=${stop.lat}&lng=${stop.lng}&radius=500`);
      if (response.ok) {
        const pois = await response.json();
        dispatch({ type: 'SET_NEARBY_POIS', payload: pois });
        
        if (mapRef.current) {
          const currentZoom = mapRef.current.getZoom();
          mapRef.current.easeTo({
            center: [stop.lng, stop.lat],
            zoom: Math.max(currentZoom, 15),
            offset: [0, -100],
            duration: 500
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch nearby POIs:', err);
    } finally {
      dispatch({ type: 'SET_LOADING_POIS', payload: false });
    }
  }, [dispatch]);

  // Fetch nearby POIs automatically when activeStop changes
  useEffect(() => {
    if (state.activeStopId) {
      const stop = state.trip.days
        .flatMap(d => d.stops)
        .find(s => s.id === state.activeStopId);
      if (stop) {
        handleShowNearbyPlaces(stop);
      }
    } else {
      dispatch({ type: 'SET_NEARBY_POIS', payload: [] });
    }
  }, [state.activeStopId, state.trip.days, handleShowNearbyPlaces, dispatch]);

  // Fetch real routes from OSRM whenever stops or day configuration changes
  useEffect(() => {
    if (useMockMap || !state.trip?.days) return;

    state.trip.days.forEach(async (day) => {
      if (day.stops.length < 2) {
        if (state.routesData[day.id]) {
          dispatch({ type: 'SET_ROUTE_DATA', payload: { dayId: day.id, routeData: null } });
        }
        return;
      }

      const currentCoords = day.stops.map(s => [s.lng, s.lat]);
      const existingRoute = state.routesData[day.id];
      if (existingRoute && existingRoute.coordinatesKey === JSON.stringify(currentCoords)) {
        return;
      }

      try {
        const routeGeoJSON = await fetchRoute(currentCoords, 'foot-walking');
        if (routeGeoJSON) {
          routeGeoJSON.coordinatesKey = JSON.stringify(currentCoords);
          dispatch({ type: 'SET_ROUTE_DATA', payload: { dayId: day.id, routeData: routeGeoJSON } });
        }
      } catch (err) {
        console.error(`Failed to fetch route for day ${day.id}:`, err);
      }
    });
  }, [state.trip?.days, useMockMap, dispatch]);

  // MapLibre Live initialization
  useEffect(() => {
    if (useMockMap || !mapContainerRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: getCartoStyle(theme),
        center: [139.75, 35.68],
        zoom: 11,
        attributionControl: false,
      });

      mapRef.current = map;

      // Handle dynamic resizing (e.g. ChatPanel width transitions or window resizes)
      const resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.resize();
        }
      });
      if (mapContainerRef.current) {
        resizeObserver.observe(mapContainerRef.current);
      }

      map.on('error', (e) => {
        console.error('MapLibre error:', e);
        setMapError('Failed to load MapLibre style. Using local interactive canvas.');
      });

      const onMapClick = () => {
        dispatch({ type: 'SELECT_STOP', payload: null });
        dispatch({ type: 'SELECT_HOMESTAY_ON_MAP', payload: null });
        dispatch({ type: 'SET_NEARBY_POIS', payload: [] });
      };
      map.on('click', onMapClick);

      const onStyleLoad = () => {
        if (syncMapDataRef.current) {
          syncMapDataRef.current();
        }
      };
      map.on('style.load', onStyleLoad);

      const onMapLoad = () => {
        if (syncMapDataRef.current) {
          syncMapDataRef.current();
        }
      };
      map.on('load', onMapLoad);

      return () => {
        resizeObserver.disconnect();
        map.off('click', onMapClick);
        map.off('style.load', onStyleLoad);
        map.off('load', onMapLoad);
        map.remove();
      };
    } catch (err) {
      console.error('MapLibre init error:', err);
      setMapError(err instanceof Error ? err.message : 'MapLibre initialization failed');
    }
  }, [useMockMap, dispatch]);

  // Update map style dynamically on theme changes
  useEffect(() => {
    if (mapRef.current && !useMockMap) {
      const map = mapRef.current;
      map.setStyle(getCartoStyle(theme));
      // After setStyle, all sources/layers are wiped. Force re-sync by
      // updating routesData identity so the syncMapData effect re-fires.
      map.once('styledata', () => {
        setStyleTrigger(prev => prev + 1);
      });
    }
  }, [theme, useMockMap]);

  // Auto-fit bounds on load/trip change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || useMockMap) return;

    // Skip auto-fitting bounds if the user has an active selection (stop or homestay)
    if (state.activeStopId || state.activeHomestayOnMapId || state.selectedHomestayId) {
      return;
    }

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
  }, [state.trip, mapLayer, useMockMap, fitTripBounds, state.activeStopId, state.activeHomestayOnMapId, state.selectedHomestayId]);

  // Handle AI-triggered map center changes
  useEffect(() => {
    if (!state.mapCenter) return;
    const { lat, lng, zoom } = state.mapCenter;
    
    if (useMockMap) {
      const { x, y } = mapCoordsToSvg(lat, lng);
      // For mock map, adjust viewBox center based on zoom
      const factor = zoom ? Math.pow(1.5, zoom - 11) : 1;
      const zW = SVG_W / factor;
      const zH = SVG_H / factor;
      setViewBox({
        x: Math.max(0, Math.min(x - zW / 2, SVG_W - zW)),
        y: Math.max(0, Math.min(y - zH / 2, SVG_H - zH)),
        w: zW,
        h: zH,
      });
      setZoomLevel(factor);
    } else if (mapRef.current) {
      mapRef.current.easeTo({
        center: [lng, lat],
        zoom: zoom || 12,
        duration: 1000
      });
    }
  }, [state.mapCenter, useMockMap, mapCoordsToSvg]);

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

  // Handle external POI popup trigger (from itinerary panel list click or map marker click)
  useEffect(() => {
    const handleShowPoi = (e) => {
      const poi = e.detail;
      if (useMockMap) {
        setActivePoiOnMap(poi);
        return;
      }
      if (mapRef.current) {
        const currentZoom = mapRef.current.getZoom();
        mapRef.current.easeTo({
          center: [poi.lng, poi.lat],
          zoom: Math.max(currentZoom, 15),
          offset: [0, -100],
          duration: 800
        });

        const popupContent = document.createElement('div');
        popupContent.style.cssText = 'font-family: "Sora", "Inter", system-ui, sans-serif;';
        popupContent.innerHTML = `
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; min-width: 200px; box-shadow: 0 8px 30px rgba(0,0,0,0.4); position: relative;">
            <button class="poi-close-btn" style="position: absolute; top: 8px; right: 8px; background: none; border: none; cursor: pointer; font-size: 14px; font-family: inherit; padding: 4px; pointer-events: auto !important; z-index: 99;">✕</button>
            <div class="popup-meta" style="font-size: 11px; font-family: 'JetBrains Mono', monospace; margin-bottom: 4px;">${poi.category} · ★ ${poi.rating} (${poi.reviewsCount || 0})</div>
            <div class="popup-title" style="font-size: 13px; font-weight: 700; margin-bottom: 4px; padding-right: 15px;">${poi.name}</div>
            <div class="popup-desc" style="font-size: 11px; margin-bottom: 8px;">${poi.address}</div>
            <button class="add-poi-btn" style="width: 100%; padding: 6px 0; background: var(--accent); color: var(--bg); border: none; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit;">➕ Add to Itinerary</button>
          </div>
        `;

        // Prevent clicks/mousedown inside the popup from propagating to the map
        popupContent.addEventListener('click', (ev) => ev.stopPropagation());
        popupContent.addEventListener('mousedown', (ev) => ev.stopPropagation());

        const handleClose = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          activePOIPopupRef.current = false;
          popup.remove();
        };

        const closeBtn = popupContent.querySelector('.poi-close-btn');
        closeBtn.addEventListener('click', handleClose);
        closeBtn.addEventListener('mousedown', handleClose);

        popupContent.querySelector('.add-poi-btn').addEventListener('click', (ev) => {
          ev.stopPropagation();
          activePOIPopupRef.current = false; // Reset ref so stop popup can open
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
            rationale: `Added from nearby recommendations. Rated ${poi.rating} stars.`,
          };

          dispatch({ type: 'ADD_STOP', payload: { dayId: targetDayId, stop: newStop } });
          dispatch({ type: 'SET_NEARBY_POIS', payload: [] });
          dispatch({ type: 'SELECT_STOP', payload: newStop.id });
        });

        if (popupRef.current) popupRef.current.remove();
        
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 15 })
          .setLngLat([poi.lng, poi.lat])
          .setDOMContent(popupContent)
          .addTo(mapRef.current);
          
        popupRef.current = popup;
        activePOIPopupRef.current = true;

        popup.on('close', () => {
          activePOIPopupRef.current = false;
        });
      }
    };
    window.addEventListener('show-poi-popup', handleShowPoi);
    return () => window.removeEventListener('show-poi-popup', handleShowPoi);
  }, [useMockMap, state.activeStopId, state.trip.days, dispatch]);

  // Synchronize state with MapLibre layers & markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || useMockMap) return;

    const syncMapData = () => {
      try {
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        if (state.nearbyPOIs.length === 0 && activePOIPopupRef.current) {
          activePOIPopupRef.current = false;
          if (popupRef.current) {
            popupRef.current.remove();
            popupRef.current = null;
          }
        }

        if (popupRef.current && !activePOIPopupRef.current) {
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

        // Always render routes and stops
        const isActiveDay = (dayId) => !highlightedDayId || dayId === highlightedDayId;

        state.trip.days.forEach(day => {
          let routeGeoJSON = routesData[day.id];
          
          if (!routeGeoJSON && day.stops.length >= 2) {
            routeGeoJSON = {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: day.stops.map(s => [s.lng, s.lat])
              }
            };
          }

          if (!routeGeoJSON) return;

          const sourceId = `route-source-day-${day.id}`;
          const layerId = `route-day-${day.id}`;
          const color = getDayColorHex(day.colorHue);
          
          const active = isActiveDay(day.id);
          const lineWidth = active ? 5 : 2;
          const lineOpacity = active ? 0.95 : 0.15;

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

        state.trip.days.forEach((day, dayIdx) => {
          const isActiveDayForMarkers = !highlightedDayId || day.id === highlightedDayId;

          day.stops.forEach((stop, idx) => {
            const el = document.createElement('div');
            el.className = 'stop-marker';
            
            const color = getDayColorHex(day.colorHue);
            el.style.backgroundColor = color;
            el.style.color = '#0a0c10';
            el.innerText = `${idx + 1}`;

            // Dim if not active day
            if (!isActiveDayForMarkers) {
              el.style.opacity = '0.2';
              el.style.animation = 'none';
            }

            // Highlight active stop without overwriting MapLibre's transform
            if (state.activeStopId === stop.id) {
              el.style.outline = `2px solid ${color}`;
              el.style.outlineOffset = '2px';
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

            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
              .setLngLat([stop.lng, stop.lat])
              .addTo(map);

            markersRef.current.push(marker);
          });

          // Travel-time labels between consecutive stops
          if (day.stops.length >= 2 && isActiveDayForMarkers) {
            for (let i = 0; i < day.stops.length - 1; i++) {
              const s1 = day.stops[i];
              const s2 = day.stops[i + 1];
              const midLat = (s1.lat + s2.lat) / 2;
              const midLng = (s1.lng + s2.lng) / 2;

              let travelTime = '';
              const routeData = routesData[day.id];
              if (routeData && routeData.features && routeData.features[0] && routeData.features[0].properties.legs && routeData.features[0].properties.legs[i]) {
                const leg = routeData.features[0].properties.legs[i];
                const distance = leg.distance;
                const duration = leg.duration;
                const mins = Math.round(duration / 60);
                if (distance < 1000) {
                  travelTime = `${Math.round(distance)}m (${mins}min)`;
                } else {
                  travelTime = `${(distance / 1000).toFixed(1)}km (${mins}min)`;
                }
              } else {
                const dist = haversine(s1.lat, s1.lng, s2.lat, s2.lng);
                travelTime = getTravelLabel(dist);
              }

              const labelEl = document.createElement('div');
              labelEl.className = 'route-time-label';
              labelEl.textContent = travelTime;

              const labelMarker = new maplibregl.Marker({
                element: labelEl,
                anchor: 'center',
              })
                .setLngLat([midLng, midLat])
                .addTo(map);

              markersRef.current.push(labelMarker);
            }
          }
        });

        // Active stop popup
        if (state.activeStopId && !activePOIPopupRef.current && closedPopupStopId !== state.activeStopId) {
          const stop = activeStop;
          if (stop) {
            const dayColor = getDayColorHex(stop.dayColorHue);
            const popupContent = document.createElement('div');
            popupContent.style.cssText = 'font-family: "Sora", "Inter", system-ui, sans-serif;';
            
            popupContent.innerHTML = `
              <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.4); min-width: 220px; max-width: 280px; position: relative;">
                <button class="popup-close-btn" style="position: absolute; top: 10px; right: 10px; background: none; border: none; cursor: pointer; font-size: 14px; z-index: 99; font-family: inherit; padding: 4px; pointer-events: auto !important;">✕</button>
                <div style="height: 3px; background: ${dayColor}; border-radius: 2px 2px 0 0;"></div>
                <div style="padding: 14px 16px;">
                  <div class="popup-title" style="font-size: 14px; font-weight: 700; margin-bottom: 4px; padding-right: 18px;">${stop.name}</div>
                  <div class="popup-meta" style="display: flex; gap: 8px; font-size: 11px; font-family: 'JetBrains Mono', monospace; margin-bottom: 8px;">
                    <span>${stop.timeEstimate || ''}</span>
                    ${stop.costEstimate > 0 ? `<span>·</span><span>¥${stop.costEstimate.toLocaleString()}</span>` : '<span>·</span><span>Free</span>'}
                  </div>
                  <div class="popup-desc" style="font-size: 12px; line-height: 1.5; padding-top: 8px; border-top: 1px solid var(--border);">${stop.rationale}</div>
                  <div style="display: flex; gap: 6px; margin-top: 10px;">
                    <button class="nearby-btn" style="flex: 1; padding: 6px 0; background: var(--accent); color: var(--bg); border: none; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit;">🔍 Nearby</button>
                    <button class="delete-btn" style="padding: 6px 10px; background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit;">🗑️</button>
                  </div>
                </div>
              </div>
            `;

            // Prevent clicks/mousedown inside the popup from propagating to the map
            popupContent.addEventListener('click', (ev) => ev.stopPropagation());
            popupContent.addEventListener('mousedown', (ev) => ev.stopPropagation());

            const dayId = stop.dayId;

            const handleClose = (e) => {
              e.preventDefault();
              e.stopPropagation();
              setClosedPopupStopId(state.activeStopId);
              if (popupRef.current) {
                popupRef.current.remove();
                popupRef.current = null;
              }
            };

            const closeBtn = popupContent.querySelector('.popup-close-btn');
            closeBtn.addEventListener('click', handleClose);
            closeBtn.addEventListener('mousedown', handleClose);

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

            const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 25 })
              .setLngLat([stop.lng, stop.lat])
              .setDOMContent(popupContent)
              .addTo(map);

            popupRef.current = popup;
          }
        }

        // Render homestays overlay if showHomestays is true
        if (state.showHomestays) {
          visibleHomestays.forEach(home => {
            const el = document.createElement('div');
            el.className = 'custom-homestay-marker cursor-pointer transition-all duration-300';
            
            const isSelected = state.selectedHomestayId === home.id;
            const isHovered = state.hoveredHomestayId === home.id;
            const isHighlighted = isSelected || isHovered;

            el.innerHTML = `
              <div class="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg relative" style="background: ${isHighlighted ? 'var(--accent)' : 'var(--surface)'}; border: 1.5px solid ${isHighlighted ? 'var(--accent)' : 'var(--border)'}; color: ${isHighlighted ? 'var(--bg)' : 'var(--accent)'}; transition: all 0.3s; transform: ${isHighlighted ? 'scale(1.25)' : 'scale(1)'};">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                ${isHighlighted ? `<div class="absolute -inset-1 rounded-lg border border-accent animate-ping opacity-60" style="pointer-events: none;"></div>` : ''}
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

            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
              .setLngLat([home.lng, home.lat])
              .addTo(map);

            markersRef.current.push(marker);
          });
        }

        // Homestay popover on map
        if (state.showHomestays && activeHomestayOnMap && closedPopupHomestayId !== state.activeHomestayOnMapId) {
          const home = activeHomestayOnMap;
          const isSelected = state.selectedHomestayId === home.id;
          const popupContent = document.createElement('div');
          popupContent.style.cssText = 'font-family: "Sora", "Inter", system-ui, sans-serif;';
          
          popupContent.innerHTML = `
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.4); min-width: 220px; max-width: 280px; position: relative;">
              <button class="homestay-close-btn" style="position: absolute; top: 10px; right: 10px; background: none; border: none; cursor: pointer; font-size: 14px; z-index: 99; font-family: inherit; padding: 4px; pointer-events: auto !important;">✕</button>
              <div style="height: 3px; background: var(--warm); border-radius: 2px 2px 0 0;"></div>
              <div style="padding: 14px 16px;">
                <div class="popup-title" style="font-size: 14px; font-weight: 700; margin-bottom: 4px;">${home.name}</div>
                <div class="popup-meta" style="display: flex; gap: 8px; font-size: 11px; font-family: 'JetBrains Mono', monospace; margin-bottom: 8px;">
                  <span>★ ${home.rating}</span>
                  <span>·</span>
                  <span>¥${home.pricePerNight.toLocaleString()}/night</span>
                  <span>·</span>
                  <span>${home.avgCommuteMinutes}min avg</span>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;">
                  ${home.amenities.slice(0, 4).map(a => `<span class="popup-meta" style="padding: 2px 6px; border-radius: 4px; background: var(--surface-2); font-size: 9px; font-family: 'JetBrains Mono', monospace;">${a}</span>`).join('')}
                </div>
                <div class="popup-desc" style="font-size: 12px; line-height: 1.5; padding-top: 8px; border-top: 1px solid var(--border);">${home.rationale}</div>
                <button class="select-btn" style="display: block; width: 100%; padding: 8px 0; margin-top: 10px; background: ${isSelected ? 'var(--accent)' : 'var(--surface-2)'}; color: ${isSelected ? 'var(--bg)' : 'var(--text)'}; border: 1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;">${isSelected ? '✓ Selected as Lodging' : 'Choose This Homestay'}</button>
              </div>
            </div>
          `;

          // Prevent clicks/mousedown inside the popup from propagating to the map
          popupContent.addEventListener('click', (ev) => ev.stopPropagation());
          popupContent.addEventListener('mousedown', (ev) => ev.stopPropagation());

          const handleClose = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setClosedPopupHomestayId(state.activeHomestayOnMapId);
            if (popupRef.current) {
              popupRef.current.remove();
              popupRef.current = null;
            }
          };

          const closeBtn = popupContent.querySelector('.homestay-close-btn');
          closeBtn.addEventListener('click', handleClose);
          closeBtn.addEventListener('mousedown', handleClose);

          popupContent.querySelector('.select-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            dispatch({ type: 'SELECT_HOMESTAY', payload: isSelected ? null : home.id });
          });

          const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 25 })
            .setLngLat([home.lng, home.lat])
            .setDOMContent(popupContent)
            .addTo(map);

          popupRef.current = popup;
        }

        // Nearby POI markers
        // Nearby POI markers
        if (state.nearbyPOIs.length > 0) {
          state.nearbyPOIs.forEach((poi) => {
            const el = document.createElement('div');
            el.className = 'custom-poi-marker cursor-pointer';
            
            let icon = '📍';
            if (poi.category === 'food') icon = '🍱';
            else if (poi.category === 'cafe') icon = '☕';
            else if (poi.category === 'sight') icon = '🏛️';

            el.innerHTML = `
              <div style="width: 30px; height: 30px; border-radius: 50%; background: var(--surface); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); cursor: pointer;">
                ${icon}
              </div>
            `;

            el.addEventListener('click', (e) => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('show-poi-popup', { detail: poi }));
            });

            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
              .setLngLat([poi.lng, poi.lat])
              .addTo(map);
            markersRef.current.push(marker);
          });
        }
        console.log('[DEBUG] syncMapData finished. markersRef count:', markersRef.current.length, 'stop-marker DOM count:', document.querySelectorAll('.stop-marker').length);
      } catch (err) {
        console.error('syncMapData inner error:', err);
      }
    };

    syncMapDataRef.current = syncMapData;

    if (map && map.isStyleLoaded()) {
      syncMapData();
    } else if (map) {
      map.once('styledata', () => {
        if (mapRef.current) {
          syncMapData();
        }
      });
    }

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };
  }, [
    state.trip, 
    state.showHomestays,
    highlightedDayId,
    routesData, 
    state.nearbyPOIs, 
    state.selectedHomestayId, 
    state.hoveredHomestayId, 
    state.activeStopId, 
    activeHomestay, 
    activeHomestayOnMap, 
    activeStop, 
    visibleHomestays,
    useMockMap,
    getDayCogLatLng,
    dispatch,
    styleTrigger,
    closedPopupStopId,
    closedPopupHomestayId
  ]);

  return (
    <div className="flex-1 h-full relative flex flex-col min-w-0 map-crosshair" style={{ background: 'var(--bg)' }}>
      {/* Mapbox Live Container */}
      {!useMockMap && (
        <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-10" />
      )}

      {/* SVG Interactive Mockup Map */}
      {useMockMap && (
        <div className="w-full h-full absolute inset-0 flex items-center justify-center overflow-hidden z-10 select-none" style={{ background: 'var(--bg)' }}>
          {/* Ambient gradient */}
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, var(--accent-dim) 0%, transparent 60%)' }} />
          
          {/* Subtle Grid overlay */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(rgba(128,128,128,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.02) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

          {/* SVG Elements */}
          <svg
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            className="w-full h-full max-w-5xl z-10 p-2"
            style={{ transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            {/* Water features */}
            <defs>
              <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.06" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
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

            {/* ═══════════════════════════════════════════
                STOPS LAYER — Day routes + Stop pins + Travel labels
                ═══════════════════════════════════════════ */}
            {/* Stops Layer — always visible */}
            <g className="fade-in">
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

                const isActiveDayRoute = !highlightedDayId || day.id === highlightedDayId;
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
                    {/* Animated dash overlay */}
                    {isActiveDayRoute && (
                      <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8,6" opacity={dashOpacity} style={{ animation: 'dash 20s linear infinite' }} />
                    )}
                  </g>
                );
              })}

              {/* Travel-time labels between consecutive stops */}
              {state.trip.days.map((day) => {
                const isActive = !highlightedDayId || day.id === highlightedDayId;
                if (!isActive || day.stops.length < 2) return null;

                return day.stops.slice(0, -1).map((s1, i) => {
                  const s2 = day.stops[i + 1];
                  const p1 = mapCoordsToSvg(s1.lat, s1.lng);
                  const p2 = mapCoordsToSvg(s2.lat, s2.lng);
                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2;

                  let label = '';
                  const routeData = routesData[day.id];
                  if (routeData && routeData.features && routeData.features[0] && routeData.features[0].properties.legs && routeData.features[0].properties.legs[i]) {
                    const leg = routeData.features[0].properties.legs[i];
                    const distance = leg.distance;
                    const duration = leg.duration;
                    const mins = Math.round(duration / 60);
                    if (distance < 1000) {
                      label = `${Math.round(distance)}m (${mins}min)`;
                    } else {
                      label = `${(distance / 1000).toFixed(1)}km (${mins}min)`;
                    }
                  } else {
                    const dist = haversine(s1.lat, s1.lng, s2.lat, s2.lng);
                    label = getTravelLabel(dist);
                  }

                  return (
                    <foreignObject
                      key={`label-${day.id}-${i}`}
                      x={midX - 40}
                      y={midY - 10}
                      width="80"
                      height="20"
                      style={{ pointerEvents: 'none' }}
                    >
                      <div
                        xmlns="http://www.w3.org/1999/xhtml"
                        className="route-time-label"
                        style={{ textAlign: 'center', fontSize: '9px' }}
                      >
                        {label}
                      </div>
                    </foreignObject>
                  );
                });
              })}

              {/* Stop Pins */}
              {state.trip.days.map((day) => {
                const color = getDayColorHex(day.colorHue);
                const isActiveDayPins = !highlightedDayId || day.id === highlightedDayId;

                return day.stops.map((stop) => {
                  const { x, y } = mapCoordsToSvg(stop.lat, stop.lng);
                  const isHovered = state.hoveredStopId === stop.id;
                  const isActive = state.activeStopId === stop.id;
                  const isPulsing = isHovered || isActive;
                  const pinOpacity = isActiveDayPins ? 1 : 0.2;

                  return (
                    <g
                      key={stop.id}
                      className="cursor-pointer"
                      transform={`translate(${x}, ${y})`}
                      onClick={() => handleMapStopClick(stop.id)}
                      onMouseEnter={() => handleMapStopHover(stop.id)}
                      onMouseLeave={() => handleMapStopHover(null)}
                      opacity={pinOpacity}
                      style={{ transition: 'opacity 0.3s ease' }}
                    >
                      {isPulsing && <circle r="14" fill={color} opacity="0.15" className="animate-ping" />}
                      <circle r={isPulsing ? '9' : '7'} fill={color} opacity={isPulsing ? 0.35 : 0.2} style={{ transition: 'all 0.3s ease' }} />
                      <circle r={isPulsing ? '6.5' : '5.5'} fill={color} style={{ transition: 'all 0.3s ease' }} />
                      <circle r={isPulsing ? '4.5' : '3.5'} fill="var(--bg, #0a0c10)" style={{ transition: 'all 0.3s ease' }} />
                      <text y="2.5" textAnchor="middle" fill={color} fontSize={isPulsing ? '7' : '6'} fontWeight="bold" fontFamily="JetBrains Mono, monospace" style={{ transition: 'all 0.3s ease' }}>
                        {stop.order}
                      </text>
                      <title>{stop.name}</title>
                    </g>
                  );
                });
              })}
            </g>

            {/* Homestays Overlay — visible if state.showHomestays is true */}
            {state.showHomestays && (
              <g className="fade-in">
                {visibleHomestays.map((home) => {
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
                      <circle r="28" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="2,3" opacity={isHighlighted ? 0.3 : 0.1} style={{ transition: 'all 0.3s ease' }} />
                      {isHighlighted && (
                        <circle r="20" fill="var(--accent)" opacity="0.08" className="animate-pulse" />
                      )}
                      <circle
                        r={isHighlighted ? 14 : 10}
                        fill={isActiveOnMap ? 'var(--accent-dim)' : isSelected ? 'var(--accent-dim)' : 'var(--surface)'}
                        stroke={isHighlighted ? 'var(--accent)' : 'var(--border)'}
                        strokeWidth={isHighlighted ? 1.5 : 0.8}
                        style={{ transition: 'all 0.3s ease' }}
                      />
                      <path
                        d="M-6 3 L-6 -1 L0 -7 L6 -1 L6 3 Z"
                        fill={isHighlighted ? 'var(--accent)' : 'var(--muted)'}
                        opacity={isHighlighted ? 1 : 0.5}
                        style={{ transition: 'all 0.3s ease' }}
                      />
                      <rect x="-1.5" y="-1" width="3" height="4" fill="var(--bg)" opacity="0.6" rx="0.5" />
                      <g transform="translate(10, -10)">
                        <rect x="-8" y="-5" width="16" height="10" rx="4" fill="var(--surface)" stroke="var(--border)" strokeWidth="0.5" />
                        <text textAnchor="middle" y="2" fill="var(--warm)" fontSize="5" fontWeight="bold" fontFamily="JetBrains Mono, monospace">
                          ★{home.rating}
                        </text>
                      </g>
                      {isHighlighted && (
                        <g transform="translate(0, 20)">
                          <rect x="-35" y="-6" width="70" height="12" rx="4" fill="var(--surface)" stroke="var(--accent-border)" strokeWidth="0.5" />
                          <text textAnchor="middle" y="2" fill="var(--text)" fontSize="4.5" fontWeight="600" fontFamily="Sora, sans-serif">
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

            {/* POI Overlay — visible if state.nearbyPOIs.length > 0 */}
            {state.nearbyPOIs.length > 0 && (
              <g className="fade-in">
                {state.nearbyPOIs.map((poi) => {
                  const { x, y } = mapCoordsToSvg(poi.lat, poi.lng);
                  let icon = '📍';
                  if (poi.category === 'food') icon = '🍱';
                  else if (poi.category === 'cafe') icon = '☕';
                  else if (poi.category === 'sight') icon = '🏛️';

                  return (
                    <g
                      key={poi.id}
                      className="cursor-pointer"
                      transform={`translate(${x}, ${y})`}
                      onClick={() => {
                        dispatch({ type: 'SELECT_STOP', payload: null });
                        setActivePoiOnMap(poi);
                      }}
                    >
                      <circle r="12" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
                      <text textAnchor="middle" y="3.5" fontSize="8">
                        {icon}
                      </text>
                      <title>{poi.name} — Rating: {poi.rating}★</title>
                    </g>
                  );
                })}
              </g>
            )}
          </svg>

          {/* ─── Stop Popover (SVG mode) ─── */}
          {activeStop && useMockMap && closedPopupStopId !== activeStop.id && (() => {
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
                <div className="rounded-xl overflow-hidden shadow-2xl min-w-[200px] max-w-[260px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  {/* Accent bar */}
                  <div style={{ height: '3px', background: color }} />
                  <div className="p-3.5">
                    <h4 className="font-bold text-xs mb-1" style={{ color: 'var(--text)' }}>{activeStop.name}</h4>
                    <div className="flex items-center gap-2 text-[9px] font-mono mb-2" style={{ color: 'var(--muted)' }}>
                      <span>{activeStop.timeEstimate}</span>
                      <span>·</span>
                      <span style={{ color }}>
                        {activeStop.costEstimate === 0 ? 'Free' : `¥${activeStop.costEstimate.toLocaleString()}`}
                      </span>
                    </div>
                    <div className="rounded-lg p-2" style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
                      <span className="text-[7px] font-bold uppercase tracking-widest block mb-0.5" style={{ color: 'var(--accent)' }}>Why this?</span>
                      <p className="text-[9px] leading-relaxed" style={{ color: 'var(--muted)' }}>{activeStop.rationale}</p>
                    </div>
                    <button
                      onClick={() => setClosedPopupStopId(activeStop.id)}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="w-3 h-3 rotate-45 mx-auto -mt-1.5" style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />
              </div>
            );
          })()}

          {/* ─── Homestay Popover (SVG mode) ─── */}
          {activeHomestayOnMap && state.showHomestays && useMockMap && closedPopupHomestayId !== activeHomestayOnMap.id && (() => {
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
                <div className="rounded-xl overflow-hidden shadow-2xl min-w-[220px] max-w-[280px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ height: '3px', background: 'var(--warm)' }} />
                  <div className="p-3.5">
                    <div className="flex items-start justify-between mb-1.5">
                      <h4 className="font-bold text-xs" style={{ color: 'var(--text)' }}>{home.name}</h4>
                      <div className="flex items-center gap-0.5 text-[9px] font-mono shrink-0 ml-2" style={{ color: 'var(--warm)' }}>
                        <span>★</span>
                        <span>{home.rating}</span>
                        <span style={{ color: 'var(--muted)' }}>({home.reviewCount})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mb-2.5">
                      <span className="font-mono text-sm font-bold" style={{ color: 'var(--text)' }}>
                        ¥{home.pricePerNight.toLocaleString()}
                        <span className="text-[8px] font-normal" style={{ color: 'var(--muted)' }}> /night</span>
                      </span>
                      <span className="text-[9px] font-mono flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>
                        {home.avgCommuteMinutes}min avg
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2.5">
                      {home.amenities.slice(0, 4).map((amenity, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded text-[7px] font-mono" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                          {amenity}
                        </span>
                      ))}
                    </div>
                    <div className="rounded-lg p-2 mb-2.5" style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}>
                      <span className="text-[7px] font-bold uppercase tracking-widest block mb-0.5" style={{ color: 'var(--accent)' }}>Route Fit</span>
                      <p className="text-[8px] leading-relaxed" style={{ color: 'var(--muted)' }}>{home.rationale}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: 'SELECT_HOMESTAY', payload: isSelected ? null : home.id });
                      }}
                      className="w-full py-2 rounded-lg text-[10px] font-bold cursor-pointer"
                      style={{
                        background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                        color: isSelected ? 'var(--bg)' : 'var(--text)',
                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {isSelected ? '✓ Selected as Lodging' : 'Choose This Homestay'}
                    </button>
                    <button
                      onClick={() => setClosedPopupHomestayId(home.id)}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="w-3 h-3 rotate-45 mx-auto -mt-1.5" style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />
              </div>
            );
          })()}

          {/* ─── POI Popover (SVG mode) ─── */}
          {activePoiOnMap && useMockMap && (() => {
            const poi = activePoiOnMap;
            const { x, y } = mapCoordsToSvg(poi.lat, poi.lng);
            const pctX = ((x - viewBox.x) / viewBox.w) * 100;
            const pctY = ((y - viewBox.y) / viewBox.h) * 100;
            
            let icon = '📍';
            if (poi.category === 'food') icon = '🍱';
            else if (poi.category === 'cafe') icon = '☕';
            else if (poi.category === 'sight') icon = '🏛️';

            return (
              <div
                className="absolute z-30 scale-in pointer-events-auto"
                style={{
                  left: `${Math.min(Math.max(pctX, 15), 75)}%`,
                  top: `${Math.min(Math.max(pctY - 15, 5), 60)}%`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <div className="rounded-xl overflow-hidden shadow-2xl min-w-[200px] max-w-[260px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ height: '3px', background: 'var(--accent)' }} />
                  <div className="p-3.5">
                    <div className="popup-meta" style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', marginBottom: '4px' }}>
                      {poi.category} · ★ {poi.rating}
                    </div>
                    <h4 className="font-bold text-xs mb-1" style={{ color: 'var(--text)' }}>
                      {icon} {poi.name}
                    </h4>
                    <div className="popup-desc mb-2.5" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {poi.address || poi.vicinity || 'Located nearby this stop.'}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
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
                          rationale: `Added from nearby recommendations. Rated ${poi.rating} stars.`,
                        };
                        dispatch({ type: 'ADD_STOP', payload: { dayId: targetDayId, stop: newStop } });
                        dispatch({ type: 'SET_NEARBY_POIS', payload: [] });
                        dispatch({ type: 'SELECT_STOP', payload: newStop.id });
                        setActivePoiOnMap(null);
                      }}
                      className="w-full py-2 bg-accent text-bg rounded-lg text-[10px] font-bold cursor-pointer"
                    >
                      ➕ Add to Itinerary
                    </button>
                    <button
                      onClick={() => setActivePoiOnMap(null)}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="w-3 h-3 rotate-45 mx-auto -mt-1.5" style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />
              </div>
            );
          })()}

          {/* Map Status Overlay */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 p-3 rounded-xl text-center max-w-sm z-20" style={{ background: 'var(--panel)', backdropFilter: 'blur(20px)', border: '1px solid var(--border)' }}>
            <h4 className="font-bold text-[10px] mb-0.5 flex items-center justify-center gap-1.5 font-sans" style={{ color: 'var(--text)' }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--accent)' }}></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: 'var(--accent)' }}></span>
              </span>
              Interactive Map Canvas
            </h4>
            <p className="text-[9px] leading-relaxed font-sans" style={{ color: 'var(--muted)' }}>
              Displaying travel coordinates and routing.
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          DAY LEGEND — Bottom-left (always visible if days present)
          ═══════════════════════════════════════════ */}
      {state.trip.days.length > 0 && (
        <div className="map-legend">
          {state.trip.days.map((day) => {
            const color = getDayColorHex(day.colorHue);
            const isDimmed = highlightedDayId !== null && day.id !== highlightedDayId;
            return (
              <div
                key={day.id}
                className={`legend-item ${isDimmed ? 'dimmed' : ''}`}
                onClick={() => handleLegendClick(day.id)}
                tabIndex={0}
                role="button"
                aria-label={`Day ${day.dayNumber}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLegendClick(day.id); }
                }}
              >
                <div className="legend-dot" style={{ background: color }} />
                <span style={{ color: 'var(--text)' }}>Day {day.dayNumber}</span>
              </div>
            );
          })}
        </div>
      )}
      
      {/* ═══════════════════════════════════════════
          MAP CONTROLS — Right side column
          ═══════════════════════════════════════════ */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5">
        {/* Toggle AI chat */}
        <button
          onClick={handleToggleChat}
          className={`map-ctrl ${state.showChat ? 'active' : ''}`}
          aria-label="Toggle AI chat"
        >
          <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
            <path
              d="M3 4h12a1 1 0 011 1v7a1 1 0 01-1 1H6l-3 3V5a1 1 0 011-1z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Toggle Homestays */}
        <button
          onClick={handleToggleHomestays}
          className={`map-ctrl ${state.showHomestays ? 'active' : ''}`}
          aria-label="Toggle homestays"
        >
          <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
            <path
              d="M3 9.5L9 4l6 5.5V15a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7 16v-5h4v5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Zoom In */}
        <button onClick={handleZoomIn} className="map-ctrl" aria-label="Zoom in">
          <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
            <path d="M9 4v10M4 9h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Zoom Out */}
        <button onClick={handleZoomOut} className="map-ctrl" aria-label="Zoom out">
          <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
            <path d="M4 9h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Fit Trip bounds */}
        <button onClick={handleFitTrip} className="map-ctrl" aria-label="Fit trip bounds">
          <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
            <rect x="3" y="3" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M3 7h12M7 3v12" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
