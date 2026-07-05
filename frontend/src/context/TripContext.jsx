import { createContext, useContext, useReducer } from 'react';
import { mockTrip, mockHomestays } from '../data/mockTrip';

const initialState = {
  trip: mockTrip,
  homestays: mockHomestays,
  selectedHomestayId: null,
  hoveredHomestayId: null,
  activeTab: 'map',

  // ─── Interaction States ───
  hoveredStopId: null,
  activeStopId: null,
  isGenerating: false,
  isInterviewMode: false,
  hasTrip: true, // false = show Empty State
};

function tripReducer(state, action) {
  switch (action.type) {
    case 'SET_TRIP':
      return { ...state, trip: action.payload, hasTrip: true };
      
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
      return { ...state, selectedHomestayId: action.payload };
      
    case 'HOVER_HOMESTAY':
      return { ...state, hoveredHomestayId: action.payload };
      
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

    // ─── New Interaction Actions ───
    case 'HOVER_STOP':
      return { ...state, hoveredStopId: action.payload };

    case 'SELECT_STOP':
      return { ...state, activeStopId: action.payload };

    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload };

    case 'SET_INTERVIEW_MODE':
      return { ...state, isInterviewMode: action.payload };

    case 'START_NEW_TRIP':
      return {
        ...state,
        hasTrip: false,
        trip: { ...state.trip, messages: [], days: [] },
        activeStopId: null,
        hoveredStopId: null,
        selectedHomestayId: null,
        hoveredHomestayId: null,
        isGenerating: false,
        isInterviewMode: false,
      };

    case 'LOAD_TRIP':
      return {
        ...state,
        trip: mockTrip,
        hasTrip: true,
        isGenerating: false,
        isInterviewMode: false,
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
