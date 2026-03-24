import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

/**
 * useUCDPData — fetches UCDP GED events and active conflict context.
 *
 * GED events: georeferenced, source-cited violence data (1989–2024, v25.1).
 * Context: dyadic armed conflicts (which actors are at war) for the given year.
 */
export function useUCDPData(options = {}) {
  const { startDate, endDate, countryId, typeOfViolence, autoFetch = true } = options;

  const [events, setEvents] = useState([]);
  const [context, setContext] = useState({ dyadic: [], nonstate: [], onesided: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const evtParams = new URLSearchParams();
      if (startDate)       evtParams.append('startDate', startDate);
      if (endDate)         evtParams.append('endDate', endDate);
      if (countryId)       evtParams.append('countryId', Array.isArray(countryId) ? countryId.join(',') : countryId);
      if (typeOfViolence)  evtParams.append('typeOfViolence', typeOfViolence);

      const [evtRes, ctxRes] = await Promise.all([
        api.get(`/conflicts/ucdp-events?${evtParams.toString()}`),
        api.get('/conflicts/ucdp-context'),
      ]);

      setEvents(evtRes.data.data || []);
      setContext(ctxRes.data.data || { dyadic: [], nonstate: [], onesided: [] });
    } catch (err) {
      console.error('Failed to fetch UCDP data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, countryId, typeOfViolence]);

  useEffect(() => {
    if (autoFetch) fetch();
  }, [autoFetch, fetch]);

  return { events, context, isLoading, error, refetch: fetch };
}
