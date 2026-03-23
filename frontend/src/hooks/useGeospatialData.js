import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

export function useGeospatialData(filters = {}) {
  const [conflicts, setConflicts] = useState([]);
  const [energyFacilities, setEnergyFacilities] = useState([]);
  const [flights, setFlights] = useState([]);
  const [correlations, setCorrelations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchConflicts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.region) params.append('region', filters.region);
      if (filters.threatLevel) params.append('severity', filters.threatLevel);
      if (filters.timeRange) params.append('timeRange', filters.timeRange);
      params.append('limit', '1000');

      const response = await api.get(`/conflicts?${params.toString()}`);
      setConflicts(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch conflicts:', err);
      setError(err.message);
    }
  }, [filters]);

  const fetchEnergyFacilities = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.region) params.append('region', filters.region);
      params.append('limit', '1000');

      const response = await api.get(`/energy/facilities?${params.toString()}`);
      setEnergyFacilities(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch energy facilities:', err);
      setError(err.message);
    }
  }, [filters]);

  const fetchFlights = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.region) params.append('region', filters.region);
      params.append('limit', '500');

      const response = await api.get(`/flights/active?${params.toString()}`);
      setFlights(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch flights:', err);
      setError(err.message);
    }
  }, [filters]);

  const fetchCorrelations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.region) params.append('region', filters.region);
      if (filters.threatLevel) params.append('threatLevel', filters.threatLevel);
      params.append('limit', '100');

      const response = await api.get(`/correlations?${params.toString()}`);
      setCorrelations(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch correlations:', err);
      setError(err.message);
    }
  }, [filters]);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchConflicts(),
        fetchEnergyFacilities(),
        fetchFlights(),
        fetchCorrelations(),
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchConflicts, fetchEnergyFacilities, fetchFlights, fetchCorrelations]);

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return {
    conflicts,
    energyFacilities,
    flights,
    correlations,
    isLoading,
    error,
    fetchAllData,
    fetchConflicts,
    fetchEnergyFacilities,
    fetchFlights,
    fetchCorrelations,
  };
}
