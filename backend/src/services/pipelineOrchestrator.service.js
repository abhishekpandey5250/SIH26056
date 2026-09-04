import { DailyRouteAggregationService } from './dailyRouteAggregation.service.js';
import { AirfareIndexService } from './airfareIndex.service.js';
import { RawObservation } from '../models/RawObservation.js';
import { DailyRouteAggregation } from '../models/DailyRouteAggregation.js';
import { AirfareIndex } from '../models/AirfareIndex.js';
import { getCalendarDateString } from '../utils/dateUtils.js';
import { DEFAULT_BASE_PERIOD } from '../config/indexConfig.js';
import { isDatabaseConnected } from '../config/database.js';
import { logger } from '../utils/logger.js';

// In-memory runtime telemetry for pipeline execution tracking
const pipelineTelemetry = {
  lastPipelineRunAt: null,
  lastSuccessfulDate: null,
  lastAggregation: null,
  lastIndexCalculation: null,
  dataEnvironment: 'REAL',
  routesProcessed: 0,
  bucketsProcessed: 0,
  indicesCalculated: 0,
  averageCoverage: 0,
  status: 'READY',
  lastError: null,
};

export class PipelineOrchestratorService {
  /**
   * Executes the full daily statistical pipeline for a given collection date:
   * Raw Observations -> Daily Route Aggregation -> Airfare Price Index Calculation.
   * 
   * @param {object} params
   * @param {string} params.collectionDate 'YYYY-MM-DD'
   * @param {string} [params.dataEnvironment='REAL'] 'REAL' or 'DEMO'
   * @param {string} [params.cabinClass='economy']
   * @param {string} [params.currency='INR']
   * @param {object} [params.basePeriod]
   * @returns {Promise<object>} Structured execution summary
   */
  static async runDailyPipeline({
    collectionDate,
    dataEnvironment = 'REAL',
    cabinClass = 'economy',
    currency = 'INR',
    basePeriod = DEFAULT_BASE_PERIOD,
  }) {
    const canonicalDate = getCalendarDateString(collectionDate);
    if (!canonicalDate) {
      throw new Error(
        `Invalid collection date format: "${collectionDate}". Expected YYYY-MM-DD.`
      );
    }

    const dataEnv = (dataEnvironment || 'REAL').toUpperCase();

    pipelineTelemetry.status = 'PROCESSING';
    pipelineTelemetry.dataEnvironment = dataEnv;
    pipelineTelemetry.lastPipelineRunAt = new Date().toISOString();

    try {
      logger.info(`[PipelineOrchestrator] Initiating daily pipeline for date: ${canonicalDate} [${dataEnv}]...`);

      // Step 1: Run Daily Route Aggregation Engine
      const aggregationResult = await DailyRouteAggregationService.aggregateForDate(canonicalDate, {
        targetCabin: cabinClass,
        targetCurrency: currency,
        dataEnvironment: dataEnv,
      });

      // Step 2: Run Statistical Airfare Price Index Engine across all lead-time buckets
      const indexResult = await AirfareIndexService.calculateAndPersistIndex(canonicalDate, {
        basePeriod,
        dataEnvironment: dataEnv,
      });

      // Step 3: Compute Summary Telemetry
      const routesProcessed = aggregationResult.routesCovered ? aggregationResult.routesCovered.length : 0;
      const bucketsProcessed = aggregationResult.bucketsCovered ? aggregationResult.bucketsCovered.length : 0;
      const observationsUsed = aggregationResult.rawObservationsCount || 0;
      const bucketsCalculated = indexResult.indicesCalculated || 0;

      const indices = (indexResult.data || []).map((idx) => ({
        indexCode: idx.indexCode,
        leadTimeBucket: idx.leadTimeBucket,
        indexValue: idx.indexValue,
        dailyChangePercent: idx.dailyChangePercent,
        weightCoverage: idx.weightCoverage,
        routeCount: idx.routeCount,
      }));

      const avgCoverage =
        indices.length > 0
          ? Math.round(
              (indices.reduce((sum, idx) => sum + (idx.weightCoverage || 0), 0) / indices.length) * 10
            ) / 10
          : 0;

      // Update telemetry
      pipelineTelemetry.status = 'READY';
      pipelineTelemetry.lastSuccessfulDate = canonicalDate;
      pipelineTelemetry.lastAggregation = new Date().toISOString();
      pipelineTelemetry.lastIndexCalculation = new Date().toISOString();
      pipelineTelemetry.routesProcessed = routesProcessed;
      pipelineTelemetry.bucketsProcessed = bucketsProcessed;
      pipelineTelemetry.indicesCalculated = bucketsCalculated;
      pipelineTelemetry.averageCoverage = avgCoverage;
      pipelineTelemetry.lastError = null;

      logger.info(
        `[PipelineOrchestrator] Completed pipeline for ${canonicalDate} [${dataEnv}]: ${routesProcessed} routes, ${bucketsProcessed} buckets, ${bucketsCalculated} indices.`
      );

      return {
        success: true,
        collectionDate: canonicalDate,
        dataEnvironment: dataEnv,
        aggregation: {
          routesProcessed,
          bucketsProcessed,
          observationsUsed,
          aggregationsProduced: aggregationResult.aggregationsProduced || 0,
          stored: aggregationResult.stored || 0,
          routesCovered: aggregationResult.routesCovered || [],
          bucketsCovered: aggregationResult.bucketsCovered || [],
        },
        index: {
          bucketsCalculated,
          stored: indexResult.stored || 0,
          averageCoverage: avgCoverage,
          indices,
        },
      };
    } catch (err) {
      pipelineTelemetry.status = 'ERROR';
      pipelineTelemetry.lastError = err.message;
      logger.error(`[PipelineOrchestrator] Pipeline failed for ${canonicalDate} [${dataEnv}]:`, { error: err.message });
      throw err;
    }
  }

  /**
   * Retrieves operational status and telemetry for the statistical pipeline.
   */
  static getPipelineStatus() {
    return {
      status: pipelineTelemetry.status,
      dataEnvironment: pipelineTelemetry.dataEnvironment,
      lastPipelineRunAt: pipelineTelemetry.lastPipelineRunAt,
      lastSuccessfulDate: pipelineTelemetry.lastSuccessfulDate,
      lastAggregation: pipelineTelemetry.lastAggregation,
      lastIndexCalculation: pipelineTelemetry.lastIndexCalculation,
      routesProcessed: pipelineTelemetry.routesProcessed,
      bucketsProcessed: pipelineTelemetry.bucketsProcessed,
      indicesCalculated: pipelineTelemetry.indicesCalculated,
      averageCoverage: pipelineTelemetry.averageCoverage,
      lastError: pipelineTelemetry.lastError,
    };
  }

  /**
   * Evaluates readiness and diagnostic counts across database collections.
   */
  static async getDiagnosticStatus(options = {}) {
    const dataMode = (options.dataEnvironment || options.dataMode || process.env.DATA_MODE || 'REAL').toUpperCase();
    
    let rawObservations = 0;
    let eligibleObservations = 0;
    let aggregationsAvailable = 0;
    let indexRecordsAvailable = 0;
    let latestCollectionDate = null;
    let bucketsAvailable = [];
    let routesAvailable = 0;

    if (isDatabaseConnected()) {
      try {
        const envFilter = dataMode === 'REAL'
          ? { $or: [{ dataEnvironment: 'REAL' }, { dataEnvironment: { $exists: false } }] }
          : { dataEnvironment: dataMode };

        rawObservations = await RawObservation.countDocuments(envFilter);
        eligibleObservations = await RawObservation.countDocuments({ ...envFilter, 'quality.indexEligible': true });
        aggregationsAvailable = await DailyRouteAggregation.countDocuments(envFilter);
        indexRecordsAvailable = await AirfareIndex.countDocuments(envFilter);

        const distinctBuckets = await DailyRouteAggregation.distinct('leadTimeBucket', envFilter);
        bucketsAvailable = distinctBuckets || [];

        const distinctRoutes = await DailyRouteAggregation.distinct('routeKey', envFilter);
        routesAvailable = (distinctRoutes || []).length;

        const latestAgg = await DailyRouteAggregation.findOne(envFilter).sort({ collectionDate: -1 }).select('collectionDate').lean();
        if (latestAgg && latestAgg.collectionDate) {
          latestCollectionDate = latestAgg.collectionDate;
        } else {
          const latestObs = await RawObservation.findOne(envFilter).sort({ scrapedAt: -1 }).select('scrapedAt').lean();
          if (latestObs && latestObs.scrapedAt) {
            latestCollectionDate = new Date(latestObs.scrapedAt).toISOString().split('T')[0];
          }
        }
      } catch (err) {
        logger.warn('Diagnostic check database query error:', { error: err.message });
      }
    }

    const readyForIndex = eligibleObservations > 0 && aggregationsAvailable > 0;

    return {
      success: true,
      dataMode,
      latestCollectionDate,
      rawObservations,
      eligibleObservations,
      aggregationsAvailable,
      indexRecordsAvailable,
      bucketsAvailable,
      routesAvailable,
      readyForIndex,
      databaseStatus: isDatabaseConnected() ? 'connected' : 'disconnected',
    };
  }
}
