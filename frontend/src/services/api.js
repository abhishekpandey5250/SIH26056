import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 8000,
});

/**
 * Fetch backend and database health telemetry.
 */
export async function getHealth() {
  try {
    const response = await apiClient.get('/health');
    return response.data;
  } catch (error) {
    return {
      status: 'unreachable',
      database: 'disconnected',
      environment: 'unknown',
    };
  }
}

/**
 * Fetch scraper operational status and ingestion volume telemetry.
 */
export async function getScraperStatus(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.dataMode) queryParams.append('dataMode', params.dataMode);

    const queryString = queryParams.toString();
    const url = queryString ? `/scraper/status?${queryString}` : '/scraper/status';

    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    return {
      success: false,
      dataMode: 'REAL',
      lastScrapeAt: null,
      lastBatchReceivedAt: null,
      observationsReceived: 0,
      observationsStored: 0,
      duplicates: 0,
      rejected: 0,
      indexEligible: 0,
    };
  }
}

/**
 * Fetch pipeline diagnostic readiness telemetry.
 */
export async function getPipelineDiagnosticStatus(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.dataMode) queryParams.append('dataMode', params.dataMode);

    const queryString = queryParams.toString();
    const url = queryString ? `/index/pipeline/status?${queryString}` : '/index/pipeline/status';

    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    return {
      success: false,
      dataMode: 'REAL',
      readyForIndex: false,
      rawObservations: 0,
      eligibleObservations: 0,
      aggregationsAvailable: 0,
      indexRecordsAvailable: 0,
    };
  }
}

/**
 * Fetch latest Airfare Price Index values across all 5 advance-purchase buckets.
 */
export async function getLatestIndices(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.dataMode) queryParams.append('dataMode', params.dataMode);

    const queryString = queryParams.toString();
    const url = queryString ? `/index/latest?${queryString}` : '/index/latest';

    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching latest index values:', error);
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Fetch historical Airfare Price Index time series.
 */
export async function getIndexHistory(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.leadTimeBucket) queryParams.append('leadTimeBucket', params.leadTimeBucket);
    if (params.dataMode) queryParams.append('dataMode', params.dataMode);

    const queryString = queryParams.toString();
    const url = queryString ? `/index/history?${queryString}` : '/index/history';

    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching index history:', error);
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Fetch temporal aggregated index series (daily, weekly, monthly).
 */
export async function getTemporalIndexSeries(params = {}) {
  try {
    const freq = params.frequency || 'daily';
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.leadTimeBucket) queryParams.append('leadTimeBucket', params.leadTimeBucket);
    if (params.dataMode) queryParams.append('dataMode', params.dataMode);

    const queryString = queryParams.toString();
    const url = queryString ? `/v1/index/${freq}?${queryString}` : `/v1/index/${freq}`;

    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching temporal index series:', error);
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Fetch daily route aggregation records.
 */
export async function getAggregations(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.date) queryParams.append('date', params.date);
    if (params.route) queryParams.append('route', params.route);
    if (params.bucket) queryParams.append('bucket', params.bucket);
    if (params.origin) queryParams.append('origin', params.origin);
    if (params.destination) queryParams.append('destination', params.destination);
    if (params.dataMode) queryParams.append('dataMode', params.dataMode);

    const queryString = queryParams.toString();
    const url = queryString ? `/index/aggregations?${queryString}` : '/index/aggregations';

    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching aggregations:', error);
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Trigger full daily pipeline run (Aggregation + Index calculation).
 */
export async function runDailyPipeline(payload = {}) {
  try {
    const response = await apiClient.post('/index/pipeline', payload);
    return response.data;
  } catch (error) {
    console.error('Error executing daily pipeline:', error);
    throw error;
  }
}

/**
 * Fetch DGCA benchmark dataset availability and status.
 */
export async function getBacktestStatus(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.dataMode) queryParams.append('dataMode', params.dataMode);

    const queryString = queryParams.toString();
    const url = queryString ? `/backtest/status?${queryString}` : '/backtest/status';

    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching backtest status:', error);
    return {
      success: false,
      dgcaDatasetAvailable: false,
      dgcaRecordCount: 0,
      readyFor30DayBacktest: false,
    };
  }
}

/**
 * Execute 30-day (or custom date range) backtesting against DGCA benchmark data.
 */
export async function getBacktest30Day(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.leadTimeBucket) queryParams.append('leadTimeBucket', params.leadTimeBucket);
    if (params.dataMode) queryParams.append('dataMode', params.dataMode);

    const queryString = queryParams.toString();
    const url = queryString ? `/backtest/30-day?${queryString}` : '/backtest/30-day';

    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    console.error('Error executing backtest analysis:', error);
    return {
      success: false,
      error: error.message,
      overlappingDays: 0,
      timeSeries: [],
      metrics: {},
    };
  }
}

/**
 * Fetch active route basket and DGCA traffic weighting status.
 */
export async function getBasketStatus(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.dataMode) queryParams.append('dataMode', params.dataMode);

    const queryString = queryParams.toString();
    const url = queryString ? `/v1/index/basket?${queryString}` : '/v1/index/basket';

    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching basket status:', error);
    return {
      success: false,
      basketVersion: '1.0-provisional',
      validationStatus: 'PROVISIONAL / NOT DGCA-VALIDATED',
      isDgcaDerived: false,
      routes: [],
    };
  }
}

/**
 * Fetch sector-wise heatmap matrix data.
 */
export async function getSectorHeatmap(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.leadTimeBucket) queryParams.append('leadTimeBucket', params.leadTimeBucket);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.dataMode) queryParams.append('dataMode', params.dataMode);

    const queryString = queryParams.toString();
    const url = queryString ? `/v1/analytics/heatmap?${queryString}` : '/v1/analytics/heatmap';

    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching sector heatmap:', error);
    return { success: false, data: [] };
  }
}

/**
 * Fetch observed lead-time elasticity curve.
 */
export async function getLeadTimeElasticity(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.date) queryParams.append('date', params.date);
    if (params.routeKey) queryParams.append('routeKey', params.routeKey);
    if (params.dataMode) queryParams.append('dataMode', params.dataMode);

    const queryString = queryParams.toString();
    const url = queryString ? `/v1/analytics/lead-time?${queryString}` : '/v1/analytics/lead-time';

    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching lead time elasticity:', error);
    return { success: false, curve: [] };
  }
}

/**
 * Fetch comprehensive observability triage summary.
 */
export async function getObservabilityStatus(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.dataMode) queryParams.append('dataMode', params.dataMode);

    const queryString = queryParams.toString();
    const url = queryString ? `/v1/status?${queryString}` : '/v1/status';

    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching observability status:', error);
    return { success: false };
  }
}

export default apiClient;
