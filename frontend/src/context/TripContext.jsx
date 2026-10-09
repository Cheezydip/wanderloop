import { createContext, useContext, useReducer, useEffect } from 'react';
import { haversine } from '../utils/haversine';
import { mockTrip, mockHomestays, mockKyotoTrip, mockOsakaTrip, mockHakoneTrip } from '../data/mockTrip';
import { getTripCurrency, getDefaultBudgetLimit } from '../utils/currency';

const TRIP_STORAGE_KEY = 'wanderloop_active_trip';
const SESSION_ACTIVE_KEY = 'wanderloop_session_active';

function haversineKm(lat1, lon1, lat2, lon2) {
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || typeof lat2 !== 'number' || typeof lon2 !== 'number') return Infinity;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function sanitizeTripStopsDistance(trip) {
  if (!trip || !Array.isArray(trip.days)) return trip;

  let modified = false;
  const seenStops = [];

  const updatedDays = trip.days.map(day => {
    if (!Array.isArray(day.stops)) return day;

    const uniqueStops = [];
    for (const stop of day.stops) {
      if (!stop || !stop.name) continue;
      const sName = stop.name.toLowerCase().trim();
      const normName = sName.replace(/^(the|a|an)\s+/i, '').replace(/[^\w\s]/g, '').trim();

      const isDup = seenStops.some(prev => {
        const pName = prev.name.toLowerCase().trim();
        const pNorm = pName.replace(/^(the|a|an)\s+/i, '').replace(/[^\w\s]/g, '').trim();
        if (sName === pName || (normName.length >= 4 && normName === pNorm)) return true;
        if (typeof stop.lat === 'number' && typeof stop.lng === 'number' &&
            typeof prev.lat === 'number' && typeof prev.lng === 'number' &&
            stop.lat !== 0 && stop.lng !== 0 && prev.lat !== 0 && prev.lng !== 0) {
          const dist = haversineKm(stop.lat, stop.lng, prev.lat, prev.lng);
          if (dist < 0.08) return true;
        }
        return false;
      });

      if (!isDup) {
        seenStops.push(stop);
        uniqueStops.push(stop);
      } else {
        modified = true;
      }
    }

    const adjustedStops = uniqueStops.map((stop, idx) => {
      let newStop = { ...stop, order: idx + 1 };
      
      if (stop.name && typeof stop.name === 'string') {
        const sName = stop.name.toLowerCase().trim();
        if (sName.includes('fish road') || sName.includes('fish market') || sName.includes('heritage cafe')) {
          if (Math.abs((parseFloat(stop.lat) || 0) - 55.9496) > 0.005 || Math.abs((parseFloat(stop.lng) || 0) - (-3.1891)) > 0.005) {
            modified = true;
            newStop.lat = 55.9496;
            newStop.lng = -3.1891;
          }
        } else if (sName.includes('national museum')) {
          if (Math.abs((parseFloat(stop.lat) || 0) - 55.9469) > 0.005 || Math.abs((parseFloat(stop.lng) || 0) - (-3.1906)) > 0.005) {
            modified = true;
            newStop.lat = 55.9469;
            newStop.lng = -3.1906;
          }
        }
      }
      return newStop;
    });

    return {
      ...day,
      stops: adjustedStops
    };
  });

  if (modified) {
    return { ...trip, days: updatedDays };
  }

  return trip;
}

function loadInitialState(defaultState) {
  try {
    const saved = localStorage.getItem(TRIP_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Permanently purge any legacy mock Tokyo trip from storage
      if (parsed?.trip?.id === 'tokyo-exploration-3d' || parsed?.trip?.title === 'Tokyo Exploration') {
        localStorage.removeItem(TRIP_STORAGE_KEY);
        sessionStorage.removeItem(SESSION_ACTIVE_KEY);
        return defaultState;
      }

      if (parsed && parsed.trip) {
        const sanitizedTrip = sanitizeTripStopsDistance(parsed.trip);
        return {
          ...defaultState,
          ...parsed,
          trip: sanitizedTrip,
          // Visiting the site always lands on the main landing page
          hasTrip: false,
          showQuestionnaire: false,
          isInterviewMode: false,
          isGenerating: false,
          loadingPOIs: false,
          hoveredHomestayId: null,
          hoveredStopId: null,
          activeStopId: null,
          toast: null,
        };
      }
    }
  } catch (err) {
    console.error('Failed to restore trip state from localStorage:', err);
  }
  return defaultState;
}

export const DEFAULT_BUDGET_ITEMS = [
  { name: 'Accommodation (3 nights)', amount: 12000, color: '#2dd4bf' },
  { name: 'Food & dining', amount: 6000, color: '#f59e0b' },
  { name: 'Activity entries', amount: 3000, color: '#f43f5e' },
  { name: 'Local transport', amount: 2000, color: '#84cc16' }
];

export function syncBudgetItems(trip, homestays, selectedHomestaysByDay, legacySelectedId) {
  if (!trip) return DEFAULT_BUDGET_ITEMS;

  const { code } = getTripCurrency(trip);
  const daysCount = Math.max((trip.days || []).length, 1);

  // Calculate sum of activity costEstimates from all stops
  let activityTotal = 0;
  if (trip.days) {
    trip.days.forEach(day => {
      (day.stops || []).forEach(stop => {
        activityTotal += Number(stop.costEstimate) || 0;
      });
    });
  }

  // Determine accommodation cost from selected hotels across all days
  let accomOverride = null;
  if (selectedHomestaysByDay && typeof selectedHomestaysByDay === 'object' && Array.isArray(homestays)) {
    let totalAccom = 0;
    let hasAnySelected = false;
    Object.values(selectedHomestaysByDay).flat().forEach(id => {
      const selected = homestays.find(h => h.id === id);
      if (selected && selected.pricePerNight) {
        totalAccom += selected.pricePerNight;
        hasAnySelected = true;
      }
    });
    if (hasAnySelected) {
      accomOverride = totalAccom;
    }
  }

  if (accomOverride === null && legacySelectedId && Array.isArray(homestays)) {
    const selected = homestays.find(h => h.id === legacySelectedId);
    if (selected && selected.pricePerNight) {
      accomOverride = selected.pricePerNight * daysCount;
    }
  }

  // If AI or user provided explicit budgetItems, update activity & accommodation entries
  if (Array.isArray(trip.budgetItems) && trip.budgetItems.length > 0) {
    let foundActivity = false;
    let foundAccom = false;
    const updated = trip.budgetItems.map(item => {
      const lower = item.name.toLowerCase();
      if (lower.includes('activity') || lower.includes('activities') || lower.includes('entries') || lower.includes('sightseeing')) {
        foundActivity = true;
        return { ...item, amount: activityTotal };
      }
      if (accomOverride !== null && (lower.includes('accommodation') || lower.includes('hotel') || lower.includes('lodging') || lower.includes('stay'))) {
        foundAccom = true;
        return { ...item, amount: accomOverride };
      }
      return item;
    });

    if (!foundActivity) {
      updated.push({ name: 'Activity entries', amount: activityTotal, color: '#f43f5e' });
    }
    if (!foundAccom && accomOverride !== null) {
      updated.push({ name: 'Accommodation', amount: accomOverride, color: '#2dd4bf' });
    }
    return updated;
  }

  // ─── Recalibrated baseline rates (budget-friendly traveler defaults) ───
  let accomPerNight = 2800;  // JPY default
  let foodPerDay = 1400;
  let transportPerDay = 500;

  if (code === 'INR') {
    accomPerNight = 1500;
    foodPerDay = 700;
    transportPerDay = 300;
  } else if (code === 'EUR') {
    accomPerNight = 60;
    foodPerDay = 30;
    transportPerDay = 10;
  } else if (code === 'GBP') {
    accomPerNight = 55;
    foodPerDay = 25;
    transportPerDay = 10;
  } else if (code === 'USD') {
    accomPerNight = 75;
    foodPerDay = 35;
    transportPerDay = 12;
  } else if (code === 'AUD') {
    accomPerNight = 95;
    foodPerDay = 40;
    transportPerDay = 15;
  } else if (code === 'CAD') {
    accomPerNight = 90;
    foodPerDay = 35;
    transportPerDay = 12;
  } else if (code === 'THB') {
    accomPerNight = 900;
    foodPerDay = 500;
    transportPerDay = 180;
  } else if (code === 'AED') {
    accomPerNight = 220;
    foodPerDay = 90;
    transportPerDay = 30;
  }

  const accomTotal = accomOverride !== null ? accomOverride : (accomPerNight * daysCount);
  const foodTotal = foodPerDay * daysCount;
  const transportTotal = transportPerDay * daysCount;

  return [
    { name: `Accommodation (${daysCount} night${daysCount > 1 ? 's' : ''})`, amount: accomTotal, color: '#2dd4bf' },
    { name: 'Food & dining', amount: foodTotal, color: '#f59e0b' },
    { name: 'Activity entries', amount: activityTotal, color: '#f43f5e' },
    { name: 'Local transport', amount: transportTotal, color: '#84cc16' }
  ];
}

const initialState = {
  trip: null,
  homestays: [],
  selectedHomestaysByDay: {}, // e.g. { 'day-1': ['lodging-1', 'lodging-2'], 'day-2': ['lodging-3'] }
  selectedHomestayId: null,
  hoveredHomestayId: null,
  activeTab: 'map',
  mapCenter: null, // { lat, lng, zoom }

  // ─── Interaction States ───
  hoveredStopId: null,
  activeStopId: null,
  isGenerating: false,
  isInterviewMode: false,
  hasTrip: false, // false = show Empty State
  showQuestionnaire: false, // true = show questionnaire page
  questionnairePrompt: '', // original prompt from landing page
  mapLayer: 'stops', // 'stops' | 'homestays'
  activeHomestayOnMapId: null, // for homestay popover on map
  highlightedDayId: null, // for legend-based day filtering
  showChat: true, // toggled via map control on desktop
  showHomestays: true, // toggled via map control
  nearbyPOIs: [], // nearby cafes, restaurants, shops for active stop
  loadingPOIs: false, // loading state for nearby POIs
  routesData: {}, // OSRM route data mapped by dayId
  budgetItems: DEFAULT_BUDGET_ITEMS,
  toast: null, // { type: 'warning' | 'info', message: string }
};

function tripReducer(state, action) {
  switch (action.type) {
    case 'SET_TOAST':
      return {
        ...state,
        toast: action.payload
      };

    case 'SET_MAP_CENTER':
      return {
        ...state,
        mapCenter: action.payload
      };

    case 'SET_TRIP': {
      const sanitizedPayload = sanitizeTripStopsDistance(action.payload);
      const newTrip = {
        ...sanitizedPayload,
        messages: sanitizedPayload.messages || state.trip?.messages || []
      };
      const newItems = syncBudgetItems(newTrip, state.homestays, state.selectedHomestaysByDay, state.selectedHomestayId);
      const computedTotal = newItems.reduce((acc, i) => acc + i.amount, 0);
      if (!newTrip.budget || newTrip.budget === 25000 && getTripCurrency(newTrip).code !== 'JPY') {
        newTrip.budget = computedTotal > 0 ? Math.ceil(computedTotal * 1.15) : getDefaultBudgetLimit(getTripCurrency(newTrip).code);
      }
      return {
        ...state,
        trip: newTrip,
        budgetItems: newItems,
        hasTrip: true,
        isInterviewMode: false,
        homestays: [], // Clear lodgings from previous itinerary so fresh location-specific lodgings fetch
        selectedHomestaysByDay: {},
        selectedHomestayId: null,
        hoveredHomestayId: null,
        activeHomestayOnMapId: null,
        nearbyPOIs: [],
        activeStopId: null,
        hoveredStopId: null,
        highlightedDayId: null,
        routesData: {},
        mapCenter: null
      };
    }
      
    case 'ADD_DAY': {
      if (!state.trip) return state;
      const DAY_COLOR_PALETTE = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9'];
      
      const newDaysList = [...(state.trip.days || [])];
      const insertAfterId = action.payload?.insertAfterId;
      
      let insertIndex = newDaysList.length;
      if (insertAfterId) {
        const foundIndex = newDaysList.findIndex(d => d.id === insertAfterId);
        if (foundIndex !== -1) {
          insertIndex = foundIndex + 1;
        }
      }
      
      const blankDay = {
        id: `day-manual-${Date.now()}`,
        stops: []
      };
      
      newDaysList.splice(insertIndex, 0, blankDay);
      
      const reindexedDays = newDaysList.map((d, index) => ({
        ...d,
        dayNumber: index + 1,
        colorHue: DAY_COLOR_PALETTE[index % DAY_COLOR_PALETTE.length]
      }));

      return {
        ...state,
        trip: {
          ...state.trip,
          days: reindexedDays
        }
      };
    }

    case 'REMOVE_DAY': {
      if (!state.trip || !state.trip.days) return state;
      const dayIdToRemove = action.payload;
      const newDays = state.trip.days.filter(d => d.id !== dayIdToRemove);
      
      // Re-index remaining days (keep original id to preserve routes)
      const reindexedDays = newDays.map((d, index) => ({
        ...d,
        dayNumber: index + 1
      }));
      
      // Clear route data for removed day
      const updatedRoutes = { ...state.routesData };
      delete updatedRoutes[dayIdToRemove];

      return {
        ...state,
        trip: {
          ...state.trip,
          days: reindexedDays
        },
        routesData: updatedRoutes,
        highlightedDayId: state.highlightedDayId === dayIdToRemove ? null : state.highlightedDayId,
        toast: { type: 'info', message: 'Day removed.' }
      };
    }

    case 'ADD_STOP': {
      const updatedDays = state.trip.days.map((day) => {
        if (day.id === action.payload.dayId) {
          const newStops = [...day.stops, action.payload.stop].map((stop, idx) => ({
            ...stop,
            order: idx + 1,
          }));
          return { ...day, stops: newStops };
        }
        return day;
      });
      const updatedTrip = { ...state.trip, days: updatedDays };
      const newItems = syncBudgetItems(updatedTrip, state.homestays, state.selectedHomestaysByDay, state.selectedHomestayId);
      const newTotalSpend = newItems.reduce((acc, i) => acc + i.amount, 0);
      const budgetLimit = updatedTrip.budget || 25000;

      let newToast = state.toast;
      if (newTotalSpend > budgetLimit) {
        const sym = getTripCurrency(updatedTrip).symbol;
        const exceeded = newTotalSpend - budgetLimit;
        newToast = {
          type: 'warning',
          message: `Stop added! Budget exceeded by ${sym}${exceeded.toLocaleString()}`
        };
      }

      return {
        ...state,
        trip: updatedTrip,
        budgetItems: newItems,
        toast: newToast,
      };
    }
      
    case 'REMOVE_STOP': {
      const updatedDays = state.trip.days.map((day) => {
        if (day.id === action.payload.dayId) {
          const newStops = day.stops
            .filter((stop) => stop.id !== action.payload.stopId)
            .map((stop, idx) => ({ ...stop, order: idx + 1 }));
          return { ...day, stops: newStops };
        }
        return day;
      });
      const updatedTrip = { ...state.trip, days: updatedDays };
      const newItems = syncBudgetItems(updatedTrip, state.homestays, state.selectedHomestaysByDay, state.selectedHomestayId);
      return {
        ...state,
        trip: updatedTrip,
        budgetItems: newItems,
      };
    }
      
    case 'REORDER_STOPS':
      return {
        ...state,
        trip: {
          ...state.trip,
          days: state.trip.days.map((day) => {
            if (day.id === action.payload.dayId) {
              const reorderedStops = action.payload.stops.map((stop, idx) => ({
                ...stop,
                order: idx + 1,
              }));
              return { ...day, stops: reorderedStops };
            }
            return day;
          }),
        },
      };
      
    case 'ADD_MESSAGE':
      return {
        ...state,
        trip: {
          ...state.trip,
          messages: [...state.trip.messages, action.payload],
        },
      };
      
    case 'SELECT_HOMESTAY': {
      let dayId = null;
      let homestayId = null;

      if (typeof action.payload === 'object' && action.payload !== null) {
        dayId = action.payload.dayId;
        homestayId = action.payload.homestayId;
      } else {
        homestayId = action.payload;
      }

      if (!homestayId) {
        const newMap = {};
        const newBudgetItems = syncBudgetItems(state.trip, state.homestays, newMap, null);
        return {
          ...state,
          selectedHomestaysByDay: newMap,
          selectedHomestayId: null,
          budgetItems: newBudgetItems,
        };
      }

      if (!dayId) {
        const home = state.homestays?.find(h => h.id === homestayId);
        if (home && home.dayId) {
          dayId = home.dayId;
        } else if (state.highlightedDayId) {
          dayId = state.highlightedDayId;
        } else if (state.trip?.days && state.trip.days.length > 0) {
          dayId = state.trip.days[0].id;
        } else {
          dayId = 'day-1';
        }
      }

      const currentDayList = state.selectedHomestaysByDay?.[dayId] || [];
      const isAlreadySelected = currentDayList.includes(homestayId);

      const updatedDayList = isAlreadySelected
        ? currentDayList.filter(id => id !== homestayId)
        : [...currentDayList, homestayId];

      const newSelectedMap = {
        ...(state.selectedHomestaysByDay || {}),
        [dayId]: updatedDayList
      };

      const lastSelectedId = updatedDayList[updatedDayList.length - 1] || null;
      const newBudgetItems = syncBudgetItems(state.trip, state.homestays, newSelectedMap, lastSelectedId);
      const newTotal = newBudgetItems.reduce((acc, i) => acc + i.amount, 0);
      const budgetLimit = state.trip?.budget || 25000;
      let toast = state.toast;
      if (newTotal > budgetLimit) {
        const sym = getTripCurrency(state.trip).symbol;
        const exceeded = newTotal - budgetLimit;
        toast = { type: 'warning', message: `Hotel selected! Budget exceeded by ${sym}${exceeded.toLocaleString()}` };
      }

      return {
        ...state,
        selectedHomestaysByDay: newSelectedMap,
        selectedHomestayId: lastSelectedId,
        budgetItems: newBudgetItems,
        toast,
      };
    }
      
    case 'HOVER_HOMESTAY':
      return { ...state, hoveredHomestayId: action.payload };
      
    case 'SET_HOMESTAYS':
      return { ...state, homestays: action.payload };
      
    case 'SET_NEARBY_POIS':
      return { ...state, nearbyPOIs: action.payload };
      
    case 'SET_LOADING_POIS':
      return { ...state, loadingPOIs: action.payload };
      
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
      
    case 'SET_BUDGET':
      return {
        ...state,
        trip: {
          ...state.trip,
          budget: action.payload,
        },
      };

    case 'SET_ROUTE_DATA':
      return {
        ...state,
        routesData: {
          ...state.routesData,
          [action.payload.dayId]: action.payload.routeData,
        },
      };

    case 'SET_BUDGET_ITEMS':
      return { ...state, budgetItems: action.payload };

    // ─── New Interaction Actions ───
    case 'HOVER_STOP':
      return { ...state, hoveredStopId: action.payload };

    case 'SELECT_STOP': {
      const stopId = action.payload;
      let highlightedDayId = state.highlightedDayId;
      if (stopId) {
        const targetDay = state.trip.days.find(d => d.stops.some(s => s.id === stopId));
        if (targetDay) {
          highlightedDayId = targetDay.id;
        }
      }
      return {
        ...state,
        activeStopId: stopId,
        highlightedDayId
      };
    }

    case 'SET_MAP_LAYER':
      return {
        ...state,
        mapLayer: action.payload,
      };

    case 'SELECT_HOMESTAY_ON_MAP':
      return { ...state, activeHomestayOnMapId: action.payload };

    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload };

    case 'SET_INTERVIEW_MODE':
      return { ...state, isInterviewMode: action.payload };

    case 'START_INTERVIEW':
      return {
        ...state,
        hasTrip: true,
        isInterviewMode: true,
        showChat: true,
        trip: {
          id: `trip-${Date.now()}`,
          title: action.payload || 'New Trip',
          messages: [
            {
              id: `u-${Date.now()}`,
              role: 'user',
              content: action.payload || '',
              timestamp: new Date().toISOString()
            }
          ],
          days: [],
          budget: 25000
        },
        budgetItems: []
      };

    case 'START_QUESTIONNAIRE':
      return {
        ...state,
        showQuestionnaire: true,
        questionnairePrompt: action.payload || '',
      };

    case 'COMPLETE_QUESTIONNAIRE': {
      // Combine original prompt with questionnaire answers into enriched prompt
      const enrichedPrompt = action.payload;
      return {
        ...state,
        showQuestionnaire: false,
        questionnairePrompt: '',
      };
    }

    case 'ACTIVATE_SESSION':
    case 'NAVIGATE_TO_MAIN_PAGE': {
      try {
        sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
      } catch (err) {}

      return {
        ...state,
        hasTrip: false,
        showQuestionnaire: false,
        isInterviewMode: false,
      };
    }

    case 'RESUME_ACTIVE_TRIP': {
      if (!state.trip || !state.trip.days || state.trip.days.length === 0) return state;
      return {
        ...state,
        hasTrip: true,
        showQuestionnaire: false,
        isInterviewMode: false,
      };
    }

    case 'START_NEW_TRIP':
      try {
        localStorage.removeItem(TRIP_STORAGE_KEY);
        sessionStorage.removeItem(SESSION_ACTIVE_KEY);
      } catch (err) {}
      return {
        ...state,
        hasTrip: false,
        showQuestionnaire: false,
        questionnairePrompt: '',
        trip: null,
        activeStopId: null,
        hoveredStopId: null,
        selectedHomestaysByDay: {},
        selectedHomestayId: null,
        hoveredHomestayId: null,
        activeHomestayOnMapId: null,
        isGenerating: false,
        isInterviewMode: false,
        mapLayer: 'stops',
        routesData: {},
        budgetItems: DEFAULT_BUDGET_ITEMS,
      };

    case 'RESTORE_TRIP': {
      const loadedTrip = sanitizeTripStopsDistance(action.payload.trip);
      const selectedHomestaysByDay = action.payload.selectedHomestaysByDay || {};
      const selectedHomestayId = action.payload.selectedHomestayId || null;
      const budgetItems = action.payload.budgetItems || syncBudgetItems(loadedTrip, state.homestays, selectedHomestaysByDay, selectedHomestayId);

      return {
        ...state,
        trip: loadedTrip,
        hasTrip: true,
        showQuestionnaire: false,
        questionnairePrompt: '',
        isInterviewMode: false,
        isGenerating: false,
        selectedHomestaysByDay,
        selectedHomestayId,
        budgetItems,
      };
    }

    case 'LOAD_TRIP': {
      const prompt = (action.payload || '').toLowerCase();
      let selectedTrip = mockTrip;

      if (prompt.includes('kyoto')) {
        selectedTrip = mockKyotoTrip;
      } else if (prompt.includes('osaka')) {
        selectedTrip = mockOsakaTrip;
      } else if (prompt.includes('hakone')) {
        selectedTrip = mockHakoneTrip;
      }

      return {
        ...state,
        trip: selectedTrip,
        hasTrip: true,
        isGenerating: false,
        isInterviewMode: false,
        homestays: [],
        selectedHomestaysByDay: {},
        selectedHomestayId: null,
        hoveredHomestayId: null,
        activeHomestayOnMapId: null,
        nearbyPOIs: [],
        activeStopId: null,
        hoveredStopId: null,
        highlightedDayId: null,
        routesData: {},
        budgetItems: syncBudgetItems(selectedTrip, [], {}, null),
      };
    }

    case 'COMPLETE_INTERVIEW': {
      const prompt = (action.payload.prompt || '').toLowerCase();
      let selectedTrip = mockTrip;

      if (prompt.includes('kyoto')) {
        selectedTrip = mockKyotoTrip;
      } else if (prompt.includes('osaka')) {
        selectedTrip = mockOsakaTrip;
      } else if (prompt.includes('hakone')) {
        selectedTrip = mockHakoneTrip;
      }

      const currentMessages = state.trip?.messages || [];
      const finalMessage = {
        id: `ai-welcome-${Date.now()}`,
        role: 'assistant',
        content: `I've planned your custom ${selectedTrip.title} based on your preferences: Pace is ${action.payload.answers.pace}, focusing on ${action.payload.answers.priority}, with a daily budget limit of ${action.payload.answers.budget}. Check the map for the optimized route and lodging options!`,
        timestamp: new Date().toISOString()
      };

      return {
        ...state,
        trip: {
          ...selectedTrip,
          messages: [...currentMessages, finalMessage]
        },
        hasTrip: true,
        isGenerating: false,
        isInterviewMode: false,
        homestays: [],
        selectedHomestaysByDay: {},
        selectedHomestayId: null,
        hoveredHomestayId: null,
        activeHomestayOnMapId: null,
        nearbyPOIs: [],
        activeStopId: null,
        hoveredStopId: null,
        highlightedDayId: null,
        routesData: {},
      };
    }
      
    case 'HIGHLIGHT_DAY':
      return {
        ...state,
        highlightedDayId: state.highlightedDayId === action.payload ? null : action.payload,
      };

    case 'TOGGLE_CHAT':
      return {
        ...state,
        showChat: !state.showChat,
      };

    case 'TOGGLE_HOMESTAYS':
      return {
        ...state,
        showHomestays: !state.showHomestays,
      };

    case 'SET_SHOW_CHAT':
      return {
        ...state,
        showChat: action.payload,
      };

    default:
      return state;
  }
}

const TripContext = createContext(undefined);

export function TripProvider({ children }) {
  const [state, dispatch] = useReducer(tripReducer, initialState, loadInitialState);

  // Sync active trip state to localStorage and sessionStorage
  useEffect(() => {
    if (state.hasTrip && state.trip) {
      // Guard: NEVER persist mock Tokyo trip to storage
      if (state.trip.id === 'tokyo-exploration-3d' || state.trip.title === 'Tokyo Exploration') {
        return;
      }
      try {
        sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
        const stateToPersist = {
          trip: state.trip,
          hasTrip: state.hasTrip,
          selectedHomestaysByDay: state.selectedHomestaysByDay || {},
          selectedHomestayId: state.selectedHomestayId || null,
          budgetItems: state.budgetItems || [],
          mapLayer: state.mapLayer || 'stops',
          activeTab: state.activeTab || 'map',
          showChat: state.showChat !== false,
          showHomestays: state.showHomestays !== false,
          highlightedDayId: state.highlightedDayId || null,
          showQuestionnaire: state.showQuestionnaire || false,
          questionnairePrompt: state.questionnairePrompt || '',
          isInterviewMode: state.isInterviewMode || false,
        };
        localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(stateToPersist));
      } catch (err) {
        console.error('Failed to save trip state to localStorage:', err);
      }
    } else {
      try {
        localStorage.removeItem(TRIP_STORAGE_KEY);
        sessionStorage.removeItem(SESSION_ACTIVE_KEY);
      } catch (err) {
        console.error('Failed to remove trip state from localStorage/sessionStorage:', err);
      }
    }
  }, [
    state.hasTrip,
    state.trip,
    state.selectedHomestaysByDay,
    state.selectedHomestayId,
    state.budgetItems,
    state.mapLayer,
    state.activeTab,
    state.showChat,
    state.showHomestays,
    state.highlightedDayId,
    state.showQuestionnaire,
    state.questionnairePrompt,
    state.isInterviewMode,
  ]);

  return (
    <TripContext.Provider value={{ state, dispatch }}>
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error('useTrip must be used within a TripProvider');
  }
  return context;
}
