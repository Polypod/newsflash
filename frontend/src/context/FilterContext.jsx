import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Initial state
const initialState = {
  region: null,
  threatLevel: null,
  timeRange: null,
  dataSource: null,
  bbox: null,
  startDate: null,
  endDate: null,
};

// Action types
const ActionTypes = {
  SET_REGION: 'SET_REGION',
  SET_THREAT_LEVEL: 'SET_THREAT_LEVEL',
  SET_TIME_RANGE: 'SET_TIME_RANGE',
  SET_DATA_SOURCE: 'SET_DATA_SOURCE',
  SET_BBOX: 'SET_BBOX',
  SET_START_DATE: 'SET_START_DATE',
  SET_END_DATE: 'SET_END_DATE',
  SET_FILTERS: 'SET_FILTERS',
  CLEAR_FILTERS: 'CLEAR_FILTERS',
};

// Reducer
function filterReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_REGION:
      return { ...state, region: action.payload };

    case ActionTypes.SET_THREAT_LEVEL:
      return { ...state, threatLevel: action.payload };

    case ActionTypes.SET_TIME_RANGE:
      return { ...state, timeRange: action.payload };

    case ActionTypes.SET_DATA_SOURCE:
      return { ...state, dataSource: action.payload };

    case ActionTypes.SET_BBOX:
      return { ...state, bbox: action.payload };

    case ActionTypes.SET_START_DATE:
      return { ...state, startDate: action.payload };

    case ActionTypes.SET_END_DATE:
      return { ...state, endDate: action.payload };

    case ActionTypes.SET_FILTERS:
      return { ...state, ...action.payload };

    case ActionTypes.CLEAR_FILTERS:
      return initialState;

    default:
      return state;
  }
}

// Create context
const FilterContext = createContext(null);

// Provider component
export function FilterProvider({ children }) {
  const [state, dispatch] = useReducer(filterReducer, initialState);

  // Actions
  const setRegion = useCallback((region) => {
    dispatch({ type: ActionTypes.SET_REGION, payload: region });
  }, []);

  const setThreatLevel = useCallback((threatLevel) => {
    dispatch({ type: ActionTypes.SET_THREAT_LEVEL, payload: threatLevel });
  }, []);

  const setTimeRange = useCallback((timeRange) => {
    dispatch({ type: ActionTypes.SET_TIME_RANGE, payload: timeRange });
  }, []);

  const setDataSource = useCallback((dataSource) => {
    dispatch({ type: ActionTypes.SET_DATA_SOURCE, payload: dataSource });
  }, []);

  const setBbox = useCallback((bbox) => {
    dispatch({ type: ActionTypes.SET_BBOX, payload: bbox });
  }, []);

  const setStartDate = useCallback((startDate) => {
    dispatch({ type: ActionTypes.SET_START_DATE, payload: startDate });
  }, []);

  const setEndDate = useCallback((endDate) => {
    dispatch({ type: ActionTypes.SET_END_DATE, payload: endDate });
  }, []);

  const setFilters = useCallback((filters) => {
    dispatch({ type: ActionTypes.SET_FILTERS, payload: filters });
  }, []);

  const clearFilters = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_FILTERS });
  }, []);

  // Helper to get query params
  const getQueryParams = useCallback(() => {
    const params = new URLSearchParams();

    if (state.region) params.append('region', state.region);
    if (state.threatLevel) params.append('severity', state.threatLevel);
    if (state.timeRange) params.append('timeRange', state.timeRange);
    if (state.dataSource) params.append('source', state.dataSource);
    if (state.bbox) params.append('bbox', state.bbox);
    if (state.startDate) params.append('startDate', state.startDate);
    if (state.endDate) params.append('endDate', state.endDate);

    return params.toString();
  }, [state]);

  const value = {
    ...state,
    setRegion,
    setThreatLevel,
    setTimeRange,
    setDataSource,
    setBbox,
    setStartDate,
    setEndDate,
    setFilters,
    clearFilters,
    getQueryParams,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

// Hook to use filter context
export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}

export default FilterContext;
