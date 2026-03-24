import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Initial state
const initialState = {
  conflicts: [],
  energyFacilities: [],
  flights: [],
  correlations: [],
  newsArticles: [],
  castForecasts: [],
  analysis: null,
  threatLevel: 'low',
  isLoading: false,
  error: null,
  lastUpdate: null,
};

// Action types
const ActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_CONFLICTS: 'SET_CONFLICTS',
  SET_ENERGY_FACILITIES: 'SET_ENERGY_FACILITIES',
  SET_FLIGHTS: 'SET_FLIGHTS',
  SET_CORRELATIONS: 'SET_CORRELATIONS',
  SET_NEWS_ARTICLES: 'SET_NEWS_ARTICLES',
  SET_CAST_FORECASTS: 'SET_CAST_FORECASTS',
  SET_ANALYSIS: 'SET_ANALYSIS',
  SET_THREAT_LEVEL: 'SET_THREAT_LEVEL',
  UPDATE_CONFLICT: 'UPDATE_CONFLICT',
  UPDATE_ENERGY_FACILITY: 'UPDATE_ENERGY_FACILITY',
  UPDATE_FLIGHT: 'UPDATE_FLIGHT',
  ADD_CORRELATION: 'ADD_CORRELATION',
  CLEAR_DATA: 'CLEAR_DATA',
};

// Reducer
function dataReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return { ...state, isLoading: action.payload };

    case ActionTypes.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };

    case ActionTypes.SET_CONFLICTS:
      return { ...state, conflicts: action.payload, lastUpdate: new Date().toISOString() };

    case ActionTypes.SET_ENERGY_FACILITIES:
      return { ...state, energyFacilities: action.payload, lastUpdate: new Date().toISOString() };

    case ActionTypes.SET_FLIGHTS:
      return { ...state, flights: action.payload, lastUpdate: new Date().toISOString() };

    case ActionTypes.SET_CORRELATIONS:
      return { ...state, correlations: action.payload, lastUpdate: new Date().toISOString() };

    case ActionTypes.SET_NEWS_ARTICLES:
      return { ...state, newsArticles: action.payload, lastUpdate: new Date().toISOString() };

    case ActionTypes.SET_CAST_FORECASTS:
      return { ...state, castForecasts: action.payload, lastUpdate: new Date().toISOString() };

    case ActionTypes.SET_ANALYSIS:
      return { ...state, analysis: action.payload, lastUpdate: new Date().toISOString() };

    case ActionTypes.SET_THREAT_LEVEL:
      return { ...state, threatLevel: action.payload };

    case ActionTypes.UPDATE_CONFLICT:
      return {
        ...state,
        conflicts: state.conflicts.map((conflict) =>
          conflict.id === action.payload.id ? { ...conflict, ...action.payload } : conflict
        ),
        lastUpdate: new Date().toISOString(),
      };

    case ActionTypes.UPDATE_ENERGY_FACILITY:
      return {
        ...state,
        energyFacilities: state.energyFacilities.map((facility) =>
          facility.id === action.payload.id ? { ...facility, ...action.payload } : facility
        ),
        lastUpdate: new Date().toISOString(),
      };

    case ActionTypes.UPDATE_FLIGHT:
      return {
        ...state,
        flights: state.flights.map((flight) =>
          flight.id === action.payload.id ? { ...flight, ...action.payload } : flight
        ),
        lastUpdate: new Date().toISOString(),
      };

    case ActionTypes.ADD_CORRELATION:
      return {
        ...state,
        correlations: [...state.correlations, action.payload],
        lastUpdate: new Date().toISOString(),
      };

    case ActionTypes.CLEAR_DATA:
      return initialState;

    default:
      return state;
  }
}

// Create context
const DataContext = createContext(null);

// Provider component
export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(dataReducer, initialState);

  // Actions
  const setLoading = useCallback((isLoading) => {
    dispatch({ type: ActionTypes.SET_LOADING, payload: isLoading });
  }, []);

  const setError = useCallback((error) => {
    dispatch({ type: ActionTypes.SET_ERROR, payload: error });
  }, []);

  const setConflicts = useCallback((conflicts) => {
    dispatch({ type: ActionTypes.SET_CONFLICTS, payload: conflicts });
  }, []);

  const setEnergyFacilities = useCallback((facilities) => {
    dispatch({ type: ActionTypes.SET_ENERGY_FACILITIES, payload: facilities });
  }, []);

  const setFlights = useCallback((flights) => {
    dispatch({ type: ActionTypes.SET_FLIGHTS, payload: flights });
  }, []);

  const setCorrelations = useCallback((correlations) => {
    dispatch({ type: ActionTypes.SET_CORRELATIONS, payload: correlations });
  }, []);

  const setNewsArticles = useCallback((articles) => {
    dispatch({ type: ActionTypes.SET_NEWS_ARTICLES, payload: articles });
  }, []);

  const setCastForecasts = useCallback((forecasts) => {
    dispatch({ type: ActionTypes.SET_CAST_FORECASTS, payload: forecasts });
  }, []);

  const setAnalysis = useCallback((analysis) => {
    dispatch({ type: ActionTypes.SET_ANALYSIS, payload: analysis });
  }, []);

  const setThreatLevel = useCallback((level) => {
    dispatch({ type: ActionTypes.SET_THREAT_LEVEL, payload: level });
  }, []);

  const updateConflict = useCallback((conflict) => {
    dispatch({ type: ActionTypes.UPDATE_CONFLICT, payload: conflict });
  }, []);

  const updateEnergyFacility = useCallback((facility) => {
    dispatch({ type: ActionTypes.UPDATE_ENERGY_FACILITY, payload: facility });
  }, []);

  const updateFlight = useCallback((flight) => {
    dispatch({ type: ActionTypes.UPDATE_FLIGHT, payload: flight });
  }, []);

  const addCorrelation = useCallback((correlation) => {
    dispatch({ type: ActionTypes.ADD_CORRELATION, payload: correlation });
  }, []);

  const clearData = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_DATA });
  }, []);

  const value = {
    ...state,
    setLoading,
    setError,
    setConflicts,
    setEnergyFacilities,
    setFlights,
    setCorrelations,
    setNewsArticles,
    setCastForecasts,
    setAnalysis,
    setThreatLevel,
    updateConflict,
    updateEnergyFacility,
    updateFlight,
    addCorrelation,
    clearData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// Hook to use data context
export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

export default DataContext;
