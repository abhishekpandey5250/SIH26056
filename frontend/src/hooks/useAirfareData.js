import { useState, useEffect, useCallback } from 'react';
import {
  getHealth,
  getScraperStatus,
  getPipelineDiagnosticStatus,
  getLatestIndices,
  getIndexHistory,
  getAggregations,
} from '../services/api.js';

export function useAirfareData(pollIntervalMs = 45000) {
  const [dataMode, setDataMode] = useState('REAL'); // 'REAL' or 'DEMO'
  const [selectedBucket, setSelectedBucket] = useState('T+7');
  const [health, setHealth] = useState(null);
  const [scraperStatus, setScraperStatus] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [latestIndices, setLatestIndices] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [aggregations, setAggregations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch core telemetry, scraper status, diagnostics, and latest index records
  const fetchCoreData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [healthRes, scraperRes, diagRes, latestRes] = await Promise.all([
        getHealth(),
        getScraperStatus({ dataMode }),
        getPipelineDiagnosticStatus({ dataMode }),
        getLatestIndices({ dataMode }),
      ]);

      setHealth(healthRes);
      setScraperStatus(scraperRes);
      setDiagnostics(diagRes);

      if (latestRes.success && Array.isArray(latestRes.data)) {
        setLatestIndices(latestRes.data);
      } else {
        setLatestIndices([]);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load airfare index data:', err);
      setError('Unable to communicate with the backend index service.');
    } finally {
      setIsLoading(false);
    }
  }, [dataMode]);

  // Fetch historical index records and aggregations for selected lead-time bucket
  const fetchBucketDetails = useCallback(async (bucket) => {
    try {
      setIsHistoryLoading(true);
      const [histRes, aggRes] = await Promise.all([
        getIndexHistory({ leadTimeBucket: bucket, dataMode }),
        getAggregations({ bucket, dataMode }),
      ]);

      if (histRes.success && Array.isArray(histRes.data)) {
        setHistoryData(histRes.data);
      } else {
        setHistoryData([]);
      }

      if (aggRes.success && Array.isArray(aggRes.data)) {
        setAggregations(aggRes.data);
      } else {
        setAggregations([]);
      }
    } catch (err) {
      console.error(`Error loading details for ${bucket}:`, err);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [dataMode]);

  // Initial load and periodic polling
  useEffect(() => {
    fetchCoreData();
    const interval = setInterval(fetchCoreData, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchCoreData, pollIntervalMs]);

  // When selectedBucket or dataMode changes, fetch corresponding history & aggregations
  useEffect(() => {
    fetchBucketDetails(selectedBucket);
  }, [selectedBucket, dataMode, fetchBucketDetails]);

  // Current active index record for the selected bucket
  const currentIndex = latestIndices.find((idx) => idx.leadTimeBucket === selectedBucket) || null;

  return {
    dataMode,
    setDataMode,
    selectedBucket,
    setSelectedBucket,
    health,
    scraperStatus,
    diagnostics,
    latestIndices,
    currentIndex,
    historyData,
    aggregations,
    isLoading,
    isHistoryLoading,
    error,
    lastUpdated,
    refetchData: fetchCoreData,
  };
}
