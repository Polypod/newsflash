import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

export function useCastForecasts(options = {}) {
  const { region, countries, autoFetch = true } = options;

  const [forecasts, setForecasts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (region)    params.append('region', region);
      if (countries) params.append('countries', Array.isArray(countries) ? countries.join(',') : countries);

      const response = await api.get(`/conflicts/cast?${params.toString()}`);
      setForecasts(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch CAST forecasts:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [region, countries]);

  useEffect(() => {
    if (autoFetch) fetch();
  }, [autoFetch, fetch]);

  return { forecasts, isLoading, error, refetch: fetch };
}
