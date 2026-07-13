import { createContext, useContext, useReducer } from 'react';
import { mockTrip, mockHomestays, mockKyotoTrip, mockOsakaTrip, mockHakoneTrip } from '../data/mockTrip';

export const DEFAULT_BUDGET_ITEMS = [
  { name: 'Accommodation (3 nights)', amount: 12000, color: '#2dd4bf' },
  { name: 'Food & dining', amount: 6000, color: '#f59e0b' },
  { name: 'Activity entries', amount: 3000, color: '#f43f5e' },
  { name: 'Local transport', amount: 2000, color: '#84cc16' }
];

const initialState = {
  trip: null,
  homestays: [],
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
  mapLayer: 'stops', // 'stops' | 'homestays'
  activeHomestayOnMapId: null, // for homestay popover on map
  highlightedDayId: null, // for legend-based day filtering
  showChat: true, // toggled via map control on desktop
  showHomestays: true, // toggled via map control
  nearbyPOIs: [], // nearby cafes, restaurants, shops for active stop
  loadingPOIs: false, // loading state for nearby POIs
  routesData: {}, // OSRM route data mapped by dayId
  budgetItems: DEFAULT_BUDGET_ITEMS,
};

function tripReducer(state, action) {
  switch (action.type) {
    case 'SET_MAP_CENTER':
      return {
        ...state,
        mapCenter: action.payload
      };

    case 'SET_TRIP':
      return {
        ...state,
        trip: {
          ...action.payload,
          messages: action.payload.messages || state.trip?.messages || []
        },
        hasTrip: true,
        mapCenter: null
      };
      
    case 'ADD_STOP':
      return {
        ...state,
        trip: {
          ...state.trip,
          days: state.trip.days.map((day) => {
            if (day.id === action.payload.dayId) {
              const newStops = [...day.stops, action.payload.stop].map((stop, idx) => ({
                ...stop,
                order: idx + 1,
              }));
              return { ...day, stops: newStops };
            }
            return day;
          }),
        },
      };
      
    case 'REMOVE_STOP':
      return {
        ...state,
        trip: {
          ...state.trip,
          days: state.trip.days.map((day) => {
            if (day.id === action.payload.dayId) {
              const newStops = day.stops
                .filter((stop) => stop.id !== action.payload.stopId)
                .map((stop, idx) => ({ ...stop, order: idx + 1 }));
              return { ...day, stops: newStops };
            }
            return day;
          }),
        },
      };
      
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
      
    case 'SELECT_HOMESTAY':
      return {
        ...state,
        selectedHomestayId: action.payload,
      };
      
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

    case 'START_NEW_TRIP':
      return {
        ...state,
        hasTrip: false,
        trip: { ...state.trip, messages: [], days: [] },
        activeStopId: null,
        hoveredStopId: null,
        selectedHomestayId: null,
        hoveredHomestayId: null,
        activeHomestayOnMapId: null,
        isGenerating: false,
        isInterviewMode: false,
        mapLayer: 'stops',
        routesData: {},
        budgetItems: [],
      };

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
        routesData: {},
        budgetItems: DEFAULT_BUDGET_ITEMS,
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

      const currentMessages = state.trip.messages;
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
        routesData: {},
        budgetItems: DEFAULT_BUDGET_ITEMS
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
  const [state, dispatch] = useReducer(tripReducer, initialState);
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
