import { AirfareIndexService } from '../services/airfareIndex.service.js';
import { PipelineOrchestratorService } from '../services/pipelineOrchestrator.service.js';
import { getCalendarDateString } from '../utils/dateUtils.js';
import { logger } from '../utils/logger.js';

const VALID_BUCKETS = new Set(['T+1', 'T+7', 'T+15', 'T+30', 'T+45']);

/**
 * Normalizes lead time bucket string (e.g. "t+7" or "T 7" -> "T+7").
 */
function normalizeBucketParam(bucket) {
  if (!bucket || typeof bucket !== 'string') return null;
  return bucket.trim().replace(/\s+/, '+').toUpperCase();
}

/**
 * Controller to trigger Airfare Price Index calculation.
 */
export async function calculateAirfareIndex(req, res) {
  const { date, leadTimeBucket, basePeriod, dataEnvironment, dataMode } = req.body || {};

  if (!date || typeof date !== 'string') {
    res.status(400).json({
      status: 'error',
      message: 'A valid calculation date string (YYYY-MM-DD) is required in the request body',
    });
    return;
  }

  const canonicalDate = getCalendarDateString(date);
  if (!canonicalDate) {
    res.status(400).json({
      status: 'error',
      message: `Invalid date format: "${date}". Expected format is YYYY-MM-DD`,
    });
    return;
  }

  const normalizedBucket = normalizeBucketParam(leadTimeBucket);
  if (leadTimeBucket && (!normalizedBucket || !VALID_BUCKETS.has(normalizedBucket))) {
    res.status(400).json({
      status: 'error',
      message: `Invalid leadTimeBucket: "${leadTimeBucket}". Supported buckets are: T+1, T+7, T+15, T+30, T+45`,
    });
    return;
  }

  try {
    const result = await AirfareIndexService.calculateAndPersistIndex(canonicalDate, {
      leadTimeBucket: normalizedBucket,
      basePeriod,
      dataEnvironment: dataEnvironment || dataMode || 'REAL',
    });

    res.status(200).json(result);
  } catch (err) {
    logger.error('Error during index calculation:', { error: err.message });
    res.status(500).json({
      status: 'error',
      message: `Failed to calculate Airfare Price Index: ${err.message}`,
    });
  }
}

/**
 * Controller to run full daily pipeline (aggregation + index calculation).
 */
export async function executeDailyPipeline(req, res) {
  const { date, collectionDate, cabinClass, currency, basePeriod, dataEnvironment, dataMode } = req.body || {};
  const targetDate = collectionDate || date;

  if (!targetDate || typeof targetDate !== 'string') {
    res.status(400).json({
      status: 'error',
      message: 'A valid collection date string (YYYY-MM-DD) is required in the request body',
    });
    return;
  }

  const canonicalDate = getCalendarDateString(targetDate);
  if (!canonicalDate) {
    res.status(400).json({
      status: 'error',
      message: `Invalid date format: "${targetDate}". Expected format is YYYY-MM-DD`,
    });
    return;
  }

  try {
    const summary = await PipelineOrchestratorService.runDailyPipeline({
      collectionDate: canonicalDate,
      cabinClass,
      currency,
      basePeriod,
      dataEnvironment: dataEnvironment || dataMode || 'REAL',
    });

    res.status(200).json(summary);
  } catch (err) {
    logger.error('Error executing daily pipeline:', { error: err.message });
    res.status(500).json({
      status: 'error',
      message: `Failed to execute daily pipeline: ${err.message}`,
    });
  }
}

/**
 * Controller to fetch the latest index values across all 5 advance-purchase buckets.
 */
export async function getLatestAirfareIndices(req, res) {
  try {
    const { dataEnvironment, dataMode } = req.query;
    const report = await AirfareIndexService.getLatestIndices({
      dataEnvironment: dataEnvironment || dataMode,
    });
    res.status(200).json(report);
  } catch (err) {
    logger.error('Error fetching latest index values:', { error: err.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch latest index values',
    });
  }
}

/**
 * Controller to query historical index time series.
 */
export async function getHistoricalAirfareIndices(req, res) {
  const { startDate, endDate, leadTimeBucket, dataEnvironment, dataMode } = req.query;
  const normalizedBucket = normalizeBucketParam(leadTimeBucket);

  if (leadTimeBucket && (!normalizedBucket || !VALID_BUCKETS.has(normalizedBucket))) {
    res.status(400).json({
      status: 'error',
      message: `Invalid leadTimeBucket query: "${leadTimeBucket}". Supported buckets are: T+1, T+7, T+15, T+30, T+45`,
    });
    return;
  }

  try {
    const report = await AirfareIndexService.getHistoricalIndices({
      startDate,
      endDate,
      leadTimeBucket: normalizedBucket,
      dataEnvironment: dataEnvironment || dataMode,
    });

    res.status(200).json(report);
  } catch (err) {
    logger.error('Error fetching historical index series:', { error: err.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch historical index series',
    });
  }
}

/**
 * Controller for pipeline readiness diagnostic check.
 */
export async function getPipelineDiagnosticStatus(req, res) {
  try {
    const { dataEnvironment, dataMode } = req.query;
    const diagnostics = await PipelineOrchestratorService.getDiagnosticStatus({
      dataEnvironment: dataEnvironment || dataMode,
    });
    res.status(200).json(diagnostics);
  } catch (err) {
    logger.error('Error fetching pipeline diagnostic status:', { error: err.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch pipeline diagnostic status',
    });
  }
}
