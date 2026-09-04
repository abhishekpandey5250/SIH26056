import { AirfareIndex } from '../models/AirfareIndex.js';
import { RouteWeight } from '../models/RouteWeight.js';
import { DailyRouteAggregation } from '../models/DailyRouteAggregation.js';
import { calculateMedian } from './dailyRouteAggregation.service.js';
import {
  DEFAULT_BASE_PERIOD,
  DEMO_ROUTE_WEIGHTS,
  getIndexCodeForBucket,
} from '../config/indexConfig.js';
import {
  getCalendarDateString,
  SUPPORTED_LEAD_TIME_DAYS,
  LEAD_TIME_BUCKETS,
} from '../utils/dateUtils.js';
import { isDatabaseConnected } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Normalizes an array of route weights so their sum equals exactly 1.0.
 * 
 * @param {Array<{routeKey: string, weight: number}>} weights 
 * @returns {Array} Normalized weight objects
 */
export function normalizeWeights(weights) {
  if (!Array.isArray(weights) || weights.length === 0) {
    return [];
  }

  const validWeights = weights.filter((w) => w && typeof w.weight === 'number' && w.weight > 0);
  const totalWeight = validWeights.reduce((sum, w) => sum + w.weight, 0);

  if (totalWeight <= 0) {
    throw new Error('Total configured route weight must be strictly positive');
  }

  return validWeights.map((w) => ({
    ...w,
    weight: w.weight / totalWeight,
    rawWeight: w.weight,
  }));
}

/**
 * Calculates the route price relative: (currentFare / baseFare) * 100.
 * Never divides by zero.
 * 
 * @param {number} currentFare 
 * @param {number} baseFare 
 * @returns {number|null} Price relative value
 */
export function calculatePriceRelative(currentFare, baseFare) {
  if (
    typeof currentFare !== 'number' ||
    typeof baseFare !== 'number' ||
    isNaN(currentFare) ||
    isNaN(baseFare) ||
    baseFare <= 0 ||
    currentFare <= 0
  ) {
    return null;
  }

  return (currentFare / baseFare) * 100;
}

/**
 * Computes day-to-day percentage change between two like-for-like index values.
 * 
 * @param {number} currentIndex 
 * @param {number} previousIndex 
 * @returns {number|null}
 */
export function calculateDailyChange(currentIndex, previousIndex) {
  if (
    typeof currentIndex !== 'number' ||
    typeof previousIndex !== 'number' ||
    isNaN(currentIndex) ||
    isNaN(previousIndex) ||
    previousIndex <= 0
  ) {
    return null;
  }

  const rawChange = ((currentIndex / previousIndex) - 1) * 100;
  return Math.round(rawChange * 100) / 100;
}

export class AirfareIndexService {
  /**
   * Pure statistical calculation for a single lead-time bucket.
   * 
   * @param {object} params
   * @param {string} params.indexDate YYYY-MM-DD
   * @param {string} [params.dataEnvironment='REAL']
   * @param {string} params.leadTimeBucket e.g. 'T+7'
   * @param {Array} params.currentAggregations DailyRouteAggregation records for current date
   * @param {Array} params.baseAggregations DailyRouteAggregation records for base period
   * @param {Array} params.routeWeights Configured route weights
   * @param {object} params.basePeriod { startDate, endDate }
   * @param {number|null} params.previousIndexValue
   * @returns {object|null}
   */
  static computeBucketIndex({
    indexDate,
    dataEnvironment = 'REAL',
    leadTimeBucket,
    currentAggregations = [],
    baseAggregations = [],
    routeWeights = [],
    basePeriod = DEFAULT_BASE_PERIOD,
    previousIndexValue = null,
  }) {
    const bucket = leadTimeBucket;
    const indexCode = getIndexCodeForBucket(bucket);
    const leadTimeDays = Object.keys(LEAD_TIME_BUCKETS).find((d) => LEAD_TIME_BUCKETS[d] === bucket);
    const dataEnv = (dataEnvironment || 'REAL').toUpperCase();

    // 1. Filter current aggregations for this bucket
    const currentBucketFares = new Map();
    currentAggregations
      .filter((agg) => agg.leadTimeBucket === bucket && agg.representativeFare > 0)
      .forEach((agg) => {
        currentBucketFares.set(agg.routeKey, agg.representativeFare);
      });

    // 2. Aggregate base-period representative fares by route (using median over base dates)
    const baseFaresByRoute = new Map();
    const baseGrouped = new Map();

    baseAggregations
      .filter((agg) => agg.leadTimeBucket === bucket && agg.representativeFare > 0)
      .forEach((agg) => {
        if (!baseGrouped.has(agg.routeKey)) {
          baseGrouped.set(agg.routeKey, []);
        }
        baseGrouped.get(agg.routeKey).push(agg.representativeFare);
      });

    for (const [routeKey, fareList] of baseGrouped.entries()) {
      const baseMedian = calculateMedian(fareList);
      if (baseMedian && baseMedian > 0) {
        baseFaresByRoute.set(routeKey, baseMedian);
      }
    }

    // 3. Normalize configured route weights
    const normalizedConfigWeights = normalizeWeights(
      routeWeights.length > 0 ? routeWeights : DEMO_ROUTE_WEIGHTS
    );

    const configuredRouteCount = normalizedConfigWeights.length;
    const totalConfiguredWeight = normalizedConfigWeights.reduce((sum, w) => sum + w.weight, 0);

    // 4. Missing Route Policy:
    // Identify routes with BOTH valid current price and valid base price
    const includedRoutes = [];
    let includedWeightSum = 0;
    let availableRouteCount = 0;

    for (const rw of normalizedConfigWeights) {
      const currentFare = currentBucketFares.get(rw.routeKey);
      const baseFare = baseFaresByRoute.get(rw.routeKey);

      if (currentFare != null && currentFare > 0) {
        availableRouteCount++;
      }

      if (currentFare != null && currentFare > 0 && baseFare != null && baseFare > 0) {
        const priceRelative = calculatePriceRelative(currentFare, baseFare);
        if (priceRelative !== null) {
          includedRoutes.push({
            routeKey: rw.routeKey,
            origin: rw.origin || rw.routeKey.split('-')[0],
            destination: rw.destination || rw.routeKey.split('-')[1],
            configuredWeight: rw.weight,
            baseFare,
            currentFare,
            priceRelative,
          });
          includedWeightSum += rw.weight;
        }
      }
    }

    // If zero routes qualify, no valid index can be produced
    if (includedRoutes.length === 0 || includedWeightSum <= 0) {
      logger.warn(`No eligible routes with valid base & current fares for ${bucket} on ${indexDate} [${dataEnv}].`);
      return null;
    }

    // 5. Weight Renormalization among included routes
    const routeDetails = includedRoutes.map((r) => {
      const effectiveWeight = r.configuredWeight / includedWeightSum;
      return {
        routeKey: r.routeKey,
        origin: r.origin,
        destination: r.destination,
        configuredWeight: Math.round(r.configuredWeight * 10000) / 10000,
        effectiveWeight: Math.round(effectiveWeight * 10000) / 10000,
        baseFare: r.baseFare,
        currentFare: r.currentFare,
        priceRelative: Math.round(r.priceRelative * 100) / 100,
        _rawEffectiveWeight: effectiveWeight,
      };
    });

    // 6. Calculate Laspeyres Price Index: Index = Σ ( effectiveWeight * priceRelative )
    const rawIndexValue = routeDetails.reduce(
      (sum, r) => sum + r._rawEffectiveWeight * r.priceRelative,
      0
    );
    const indexValue = Math.round(rawIndexValue * 100) / 100;

    // Clean internal properties before returning document
    const cleanRouteDetails = routeDetails.map(({ _rawEffectiveWeight, ...rest }) => rest);

    // 7. Coverage & Relative Changes
    const weightCoverage = Math.round((includedWeightSum / totalConfiguredWeight) * 10000) / 100;
    const baseRelativeChangePercent = Math.round((indexValue - 100) * 100) / 100;
    const dailyChangePercent = calculateDailyChange(indexValue, previousIndexValue);

    return {
      indexDate,
      dataEnvironment: dataEnv,
      indexCode,
      leadTimeBucket: bucket,
      leadTimeDays: parseInt(leadTimeDays || '7', 10),
      indexValue,
      previousIndexValue: previousIndexValue || null,
      dailyChangePercent,
      baseRelativeChangePercent,
      basePeriod: {
        startDate: basePeriod.startDate,
        endDate: basePeriod.endDate,
      },
      routeCount: cleanRouteDetails.length,
      configuredRouteCount,
      availableRouteCount,
      weightCoverage,
      routes: cleanRouteDetails,
      methodologyVersion: basePeriod.methodologyVersion || '1.0-prototype',
      calculationVersion: '1.0.0',
    };
  }

  /**
   * Orchestrates the calculation of all (or specific) lead-time indices for a given date,
   * querying MongoDB for dependencies and persisting the resulting AirfareIndex documents.
   * 
   * @param {string} date YYYY-MM-DD
   * @param {object} options
   * @returns {Promise<object>}
   */
  static async calculateAndPersistIndex(date, options = {}) {
    const canonicalDate = getCalendarDateString(date);
    if (!canonicalDate) {
      throw new Error(`Invalid calculation date format: "${date}". Expected YYYY-MM-DD.`);
    }

    const dataEnvironment = (options.dataEnvironment || options.dataMode || 'REAL').toUpperCase();
    const targetBucket = options.leadTimeBucket ? options.leadTimeBucket.toUpperCase() : null;
    const basePeriod = options.basePeriod || DEFAULT_BASE_PERIOD;

    logger.info(`Starting Airfare Price Index calculation for ${canonicalDate} [${dataEnvironment}]...`);

    let routeWeights = [];
    let currentAggregations = [];
    let baseAggregations = [];
    const previousIndexMap = new Map();

    if (isDatabaseConnected()) {
      // 1. Fetch configured route weights from DB (or fallback to DEMO weights)
      routeWeights = await RouteWeight.find({}).lean();
      if (routeWeights.length === 0) {
        logger.info('No custom RouteWeight records found in DB. Utilizing default DEMO route weights.');
        routeWeights = [...DEMO_ROUTE_WEIGHTS];
      }

      // Query filter for dataEnvironment
      const envFilter = dataEnvironment === 'REAL'
        ? { $or: [{ dataEnvironment: 'REAL' }, { dataEnvironment: { $exists: false } }] }
        : { dataEnvironment };

      // 2. Fetch current daily route aggregations
      currentAggregations = await DailyRouteAggregation.find({
        collectionDate: canonicalDate,
        ...envFilter,
      }).lean();

      // 3. Fetch base-period daily route aggregations
      baseAggregations = await DailyRouteAggregation.find({
        collectionDate: {
          $gte: basePeriod.startDate,
          $lte: basePeriod.endDate,
        },
        ...envFilter,
      }).lean();

      // If no historical base-period aggregations exist, use current aggregations as initial baseline anchor
      if (baseAggregations.length === 0 && currentAggregations.length > 0) {
        logger.info(`No historical base aggregations found in [${basePeriod.startDate}..${basePeriod.endDate}]. Using current date (${canonicalDate}) as baseline anchor.`);
        baseAggregations = currentAggregations;
      }

      // 4. Fetch previous day's index values for like-for-like daily change calculations
      const previousIndices = await AirfareIndex.find({
        indexDate: { $lt: canonicalDate },
        ...envFilter,
      })
        .sort({ indexDate: -1 })
        .lean();

      for (const prev of previousIndices) {
        if (!previousIndexMap.has(prev.leadTimeBucket)) {
          previousIndexMap.set(prev.leadTimeBucket, prev.indexValue);
        }
      }
    } else {
      routeWeights = [...DEMO_ROUTE_WEIGHTS];
    }

    const bucketsToCalculate = targetBucket
      ? [targetBucket]
      : ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'];

    const calculatedIndices = [];

    for (const bucket of bucketsToCalculate) {
      const prevVal = previousIndexMap.get(bucket) || null;
      const indexDoc = this.computeBucketIndex({
        indexDate: canonicalDate,
        dataEnvironment,
        leadTimeBucket: bucket,
        currentAggregations,
        baseAggregations,
        routeWeights,
        basePeriod,
        previousIndexValue: prevVal,
      });

      if (indexDoc) {
        calculatedIndices.push(indexDoc);
      }
    }

    // 5. Persist to MongoDB with idempotent upserts
    let storedCount = 0;
    if (isDatabaseConnected() && calculatedIndices.length > 0) {
      const bulkOps = calculatedIndices.map((doc) => ({
        updateOne: {
          filter: {
            indexDate: doc.indexDate,
            indexCode: doc.indexCode,
            dataEnvironment: doc.dataEnvironment,
          },
          update: { $set: doc },
          upsert: true,
        },
      }));

      const writeResult = await AirfareIndex.bulkWrite(bulkOps, { ordered: false });
      storedCount = writeResult.upsertedCount + writeResult.modifiedCount;
      logger.info(`Persisted ${storedCount} AirfareIndex documents for ${canonicalDate} [${dataEnvironment}].`);
    } else if (!isDatabaseConnected()) {
      storedCount = calculatedIndices.length;
    }

    return {
      success: true,
      indexDate: canonicalDate,
      dataEnvironment,
      indicesCalculated: calculatedIndices.length,
      stored: storedCount,
      data: calculatedIndices,
    };
  }

  /**
   * Retrieves the latest available index values across all 5 advance-purchase buckets.
   */
  static async getLatestIndices(options = {}) {
    const dataEnvironment = (options.dataEnvironment || options.dataMode || process.env.DATA_MODE || 'REAL').toUpperCase();

    if (!isDatabaseConnected()) {
      return { success: true, dataMode: dataEnvironment, count: 0, data: [] };
    }

    const envFilter = dataEnvironment === 'REAL'
      ? { $or: [{ dataEnvironment: 'REAL' }, { dataEnvironment: { $exists: false } }] }
      : { dataEnvironment };

    const buckets = ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'];
    const results = [];

    for (const bucket of buckets) {
      const latest = await AirfareIndex.findOne({ leadTimeBucket: bucket, ...envFilter })
        .sort({ indexDate: -1 })
        .lean();
      if (latest) {
        results.push(latest);
      }
    }

    return {
      success: true,
      dataMode: dataEnvironment,
      count: results.length,
      data: results,
    };
  }

  /**
   * Retrieves historical index time-series with date range filtering.
   */
  static async getHistoricalIndices(filter = {}) {
    const dataEnvironment = (filter.dataEnvironment || filter.dataMode || process.env.DATA_MODE || 'REAL').toUpperCase();

    if (!isDatabaseConnected()) {
      return { success: true, dataMode: dataEnvironment, count: 0, data: [] };
    }

    const envFilter = dataEnvironment === 'REAL'
      ? { $or: [{ dataEnvironment: 'REAL' }, { dataEnvironment: { $exists: false } }] }
      : { dataEnvironment };

    const query = { ...envFilter };
    if (filter.leadTimeBucket) {
      query.leadTimeBucket = filter.leadTimeBucket.toUpperCase();
    }
    if (filter.startDate || filter.endDate) {
      query.indexDate = {};
      if (filter.startDate) query.indexDate.$gte = getCalendarDateString(filter.startDate);
      if (filter.endDate) query.indexDate.$lte = getCalendarDateString(filter.endDate);
    }

    const history = await AirfareIndex.find(query)
      .sort({ indexDate: 1, leadTimeDays: 1 })
      .lean();

    return {
      success: true,
      dataMode: dataEnvironment,
      count: history.length,
      data: history,
    };
  }
}
