import { useState, useEffect, useCallback } from 'react';
import { fetchHealth } from '../services/api.js';

export function useHealth(pollIntervalMs = 10000) {
  const [health, setHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkHealth = useCallback(async () => {
    const data = await fetchHealth();
    setHealth(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, pollIntervalMs);
    return () => clearInterval(interval);
  }, [checkHealth, pollIntervalMs]);

  return { health, isLoading, refetch: checkHealth };
}
