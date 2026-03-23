import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import api from '../services/api';

export function useSituationalAwareness() {
  const [data, setData] = useState(null);
  const [threatLevel, setThreatLevel] = useState('low');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
  const { isConnected, lastMessage, subscribe } = useWebSocket(wsUrl);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    const { type, payload } = lastMessage;

    switch (type) {
      case 'threat-alert':
        setThreatLevel(payload.severity);
        setData((prev) => ({
          ...prev,
          events: [...(prev?.events || []), payload.event],
          lastUpdate: new Date().toISOString(),
        }));
        break;

      case 'analysis:complete':
        setData(payload);
        setIsLoading(false);
        break;

      case 'data:update':
        // Handle real-time data updates
        if (payload.channel === 'conflicts') {
          setData((prev) => ({
            ...prev,
            conflicts: payload.data,
          }));
        } else if (payload.channel === 'energy') {
          setData((prev) => ({
            ...prev,
            energy: payload.data,
          }));
        } else if (payload.channel === 'flights') {
          setData((prev) => ({
            ...prev,
            flights: payload.data,
          }));
        }
        break;

      default:
        break;
    }
  }, [lastMessage]);

  // Subscribe to channels on connect
  useEffect(() => {
    if (isConnected) {
      subscribe('threat-alerts');
      subscribe('conflicts');
      subscribe('energy');
      subscribe('flights');
    }
  }, [isConnected, subscribe]);

  // Trigger analysis
  const triggerAnalysis = useCallback(async (query) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/analyze/situation', {
        query,
        include_infrastructure: true,
        threat_level_threshold: 'medium',
      });

      setData(response.data);
      setThreatLevel(response.data.threat_level || 'low');
      return response.data;
    } catch (err) {
      setError(err.message || 'Analysis failed');
      console.error('Analysis request failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const [conflictsRes, energyRes, flightsRes] = await Promise.all([
        api.get('/conflicts?limit=100'),
        api.get('/energy/facilities?limit=100'),
        api.get('/flights/active?limit=100'),
      ]);

      setData((prev) => ({
        ...prev,
        conflicts: conflictsRes.data.data || [],
        energy: energyRes.data.data || [],
        flights: flightsRes.data.data || [],
      }));
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    threatLevel,
    isLoading,
    error,
    isConnected,
    triggerAnalysis,
    fetchData,
  };
}
