/**
 * Application constants
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws',
  TIMEOUT: 30000,
};

// Mapbox Configuration
export const MAPBOX_CONFIG = {
  TOKEN: import.meta.env.VITE_MAPBOX_TOKEN || '',
  STYLE: 'mapbox://styles/mapbox/light-v11',
  DEFAULT_CENTER: [0, 20],
  DEFAULT_ZOOM: 2,
  MIN_ZOOM: 1,
  MAX_ZOOM: 20,
};

// Threat Levels
export const THREAT_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const THREAT_LEVEL_COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

export const THREAT_LEVEL_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

// Event Types
export const EVENT_TYPES = {
  CONFLICT: 'conflict',
  DIPLOMATIC: 'diplomatic',
  TRADE: 'trade',
  MILITARY: 'military',
  CYBER: 'cyber',
};

export const EVENT_TYPE_COLORS = {
  conflict: '#ef4444',
  diplomatic: '#3b82f6',
  trade: '#10b981',
  military: '#f59e0b',
  cyber: '#8b5cf6',
};

// Facility Types
export const FACILITY_TYPES = {
  OIL_REFINERY: 'oil_refinery',
  POWER_PLANT: 'power_plant',
  NATURAL_GAS: 'natural_gas',
  NUCLEAR: 'nuclear',
  RENEWABLE: 'renewable',
};

export const FACILITY_TYPE_COLORS = {
  oil_refinery: '#f59e0b',
  power_plant: '#3b82f6',
  natural_gas: '#10b981',
  nuclear: '#ef4444',
  renewable: '#8b5cf6',
};

export const FACILITY_TYPE_LABELS = {
  oil_refinery: 'Oil Refinery',
  power_plant: 'Power Plant',
  natural_gas: 'Natural Gas',
  nuclear: 'Nuclear',
  renewable: 'Renewable',
};

// Data Sources
export const DATA_SOURCES = {
  ACLED: 'acled',
  EIA: 'eia',
  AVIATIONSTACK: 'aviationstack',
  NEWS: 'news',
  TELEGRAM: 'telegram',
};

export const DATA_SOURCE_LABELS = {
  acled: 'ACLED Conflicts',
  eia: 'EIA Energy',
  aviationstack: 'AviationStack Flights',
  news: 'News Sources',
  telegram: 'Telegram OSINT',
};

// Regions
export const REGIONS = {
  MIDDLE_EAST: 'middle-east',
  EUROPE: 'europe',
  ASIA_PACIFIC: 'asia-pacific',
  AMERICAS: 'americas',
  AFRICA: 'africa',
  GLOBAL: 'global',
};

export const REGION_LABELS = {
  'middle-east': 'Middle East',
  europe: 'Europe',
  'asia-pacific': 'Asia Pacific',
  americas: 'Americas',
  africa: 'Africa',
  global: 'Global',
};

// Time Ranges
export const TIME_RANGES = {
  '1H': '1h',
  '6H': '6h',
  '24H': '24h',
  '7D': '7d',
  '30D': '30d',
  '90D': '90d',
  '1Y': '1y',
  CUSTOM: 'custom',
};

export const TIME_RANGE_LABELS = {
  '1h': 'Last Hour',
  '6h': 'Last 6 Hours',
  '24h': 'Last 24 Hours',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
  '1y': 'Last Year',
  custom: 'Custom Range',
};

// WebSocket Channels
export const WS_CHANNELS = {
  THREAT_ALERTS: 'threat-alerts',
  CONFLICTS: 'conflicts',
  ENERGY: 'energy',
  FLIGHTS: 'flights',
  NEWS: 'news',
};

// WebSocket Events
export const WS_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  THREAT_ALERT: 'threat-alert',
  DATA_UPDATE: 'data:update',
  ANALYSIS_COMPLETE: 'analysis:complete',
};

// Cache Keys
export const CACHE_KEYS = {
  CONFLICTS: 'conflicts',
  ENERGY_FACILITIES: 'energy_facilities',
  FLIGHTS: 'flights',
  NEWS: 'news',
  ANALYSIS: 'analysis',
};

// Cache TTL (in seconds)
export const CACHE_TTL = {
  CONFLICTS: 3600, // 1 hour
  ENERGY_FACILITIES: 86400, // 24 hours
  FLIGHTS: 300, // 5 minutes
  NEWS: 1800, // 30 minutes
  ANALYSIS: 86400, // 24 hours
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// Map Layers
export const MAP_LAYERS = {
  CONFLICTS: 'conflicts',
  ENERGY: 'energy',
  FLIGHTS: 'flights',
  CORRELATIONS: 'correlations',
};

export const MAP_LAYER_COLORS = {
  conflicts: '#ef4444',
  energy: '#f59e0b',
  flights: '#8b5cf6',
  correlations: '#3b82f6',
};

// Analysis Configuration
export const ANALYSIS_CONFIG = {
  MAX_ARTICLES: 20,
  MAX_EVENTS: 50,
  MAX_CORRELATIONS: 100,
  DEFAULT_THREAT_THRESHOLD: 'medium',
};

// Cost Configuration
export const COST_CONFIG = {
  MONTHLY_BUDGET: 5000,
  DAILY_BUDGET: 5000 / 30,
  COST_PER_ANALYSIS: 0.23,
  MAX_TOKENS_PER_ANALYSIS: 13300,
};

// Severity Multipliers
export const SEVERITY_MULTIPLIERS = {
  low: 0.3,
  medium: 0.6,
  high: 0.8,
  critical: 1.0,
};

// Correlation Thresholds
export const CORRELATION_THRESHOLDS = {
  LOW: 0.3,
  MEDIUM: 0.5,
  HIGH: 0.7,
  CRITICAL: 0.9,
};

// Distance Thresholds (in kilometers)
export const DISTANCE_THRESHOLDS = {
  NEARBY: 50,
  MODERATE: 100,
  FAR: 200,
  VERY_FAR: 500,
};

// Update Intervals (in milliseconds)
export const UPDATE_INTERVALS = {
  FLIGHTS: 5 * 60 * 1000, // 5 minutes
  CONFLICTS: 60 * 60 * 1000, // 1 hour
  ENERGY: 24 * 60 * 60 * 1000, // 24 hours
  NEWS: 30 * 60 * 1000, // 30 minutes
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  API_ERROR: 'API error. Please try again later.',
  AUTH_ERROR: 'Authentication error. Please log in again.',
  NOT_FOUND: 'Resource not found.',
  VALIDATION_ERROR: 'Validation error. Please check your input.',
  TIMEOUT_ERROR: 'Request timeout. Please try again.',
  UNKNOWN_ERROR: 'An unknown error occurred.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  DATA_LOADED: 'Data loaded successfully.',
  ANALYSIS_COMPLETE: 'Analysis completed successfully.',
  SETTINGS_SAVED: 'Settings saved successfully.',
  CONNECTION_ESTABLISHED: 'Connection established.',
};

// Loading States
export const LOADING_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
};
