import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common errors
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('authToken');
          window.location.href = '/login';
          break;
        case 403:
          // Forbidden
          console.error('Access forbidden');
          break;
        case 404:
          // Not found
          console.error('Resource not found');
          break;
        case 500:
          // Server error
          console.error('Server error');
          break;
        default:
          console.error('API error:', data?.message || error.message);
      }
    } else if (error.request) {
      // Network error
      console.error('Network error:', error.message);
    } else {
      // Other error
      console.error('Error:', error.message);
    }

    return Promise.reject(error);
  }
);

// API methods
export const apiService = {
  // Conflicts
  getConflicts: (params = {}) => api.get('/conflicts', { params }),
  getConflictById: (id) => api.get(`/conflicts/${id}`),

  // Energy
  getEnergyFacilities: (params = {}) => api.get('/energy/facilities', { params }),
  getEnergyFacilityById: (id) => api.get(`/energy/facilities/${id}`),
  getOilPrices: () => api.get('/energy/prices'),

  // Flights
  getActiveFlights: (params = {}) => api.get('/flights/active', { params }),
  getFlightById: (id) => api.get(`/flights/${id}`),

  // News
  getTrendingNews: (params = {}) => api.get('/news/trending', { params }),
  getNewsById: (id) => api.get(`/news/${id}`),

  // Analysis
  analyzeSituation: (data) => api.post('/analyze/situation', data),
  getAnalysisHistory: (params = {}) => api.get('/analyze/history', { params }),

  // Correlations
  getCorrelations: (params = {}) => api.get('/correlations', { params }),
  getCorrelationByEventId: (eventId) => api.get(`/correlations/events/${eventId}`),

  // Health
  healthCheck: () => api.get('/health'),
};

export default api;
