import { RawObservation } from '../models/RawObservation.js';
import { DailyRouteAggregation } from '../models/DailyRouteAggregation.js';
import {
  getCalendarDateString,
  calculateLeadTimeDays,
  getLeadTimeBucket,
  SUPPORTED_LEAD_TIME_DAYS,
} from '../utils/dateUtils.js';
import { getCanonicalRouteId } from '../utils/airportCodes.js';
import { isDatabaseConnected } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Methodological Rationale:
 * Calculates the MEDIAN fare of a set of observed prices.
 * The median is chosen over the arithmetic mean because dynamic airfare pricing
 * frequently exhibits positive skew and sudden pricing spikes. The median provides
 * an empirically robust representative measure that resists outlier distortions.
 * 
 * @param {number[]} numbers Array of numeric fares
 * @returns {number|null} Median value
 */
export function calculateMedian(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return null;
  }

  const validNumbers = numbers.filter((n) => typeof n === 'number' && !isNaN(n));
  if (validNumbers.length === 0) return null;

  const sorted = [...validNumbers].sort((a, b) => a - b);
  const len = sorted.length;
  const mid = Math.floor(len / 2);

  if (len % 2 !== 0) {
    return sorted[mid];
  } else {
    const rawMedian = (sorted[mid - 1] + sorted[mid]) / 2;
    return Math.round(rawMedian * 100) / 100;
  }
}

/**
 * Returns an interpolated percentile from a numeric array.  This is used only
 * for the transparent IQR outlier rule below; fares are never imputed.
 */
export function calculatePercentile(numbers, percentile) {
  const validNumbers = Array.isArray(numbers)
    ? numbers.filter((n) => typeof n === 'number' && Number.isFinite(n)).sort((a, b) => a - b)
    : [];

  if (validNumbers.length === 0 || percentile < 0 || percentile > 1) return null;

  const position = (validNumbers.length - 1) * percentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const fraction = position - lowerIndex;

  return validNumbers[lowerIndex] + (validNumbers[upperIndex] - validNumbers[lowerIndex]) * fraction;
}

/**
 * Excludes only clearly extreme prices within the same route, collection date,
 * and advance-purchase bucket. Small samples are deliberately left untouched.
 */
export function filterFareOutliers(observations, options = {}) {
  const minimumSampleSize = options.outlierMinimumSampleSize ?? 4;
  const iqrMultiplier = options.outlierIqrMultiplier ?? 1.5;
  const candidates = (observations || []).filter((obs) => {
    const fare = obs?.fare?.observedFare;
    return typeof fare === 'number' && Number.isFinite(fare) && fare > 0;
  });

  if (candidates.length < minimumSampleSize) {
    return { includedObservations: candidates, outlierObservations: [], bounds: null };
  }

  const fares = candidates.map((obs) => obs.fare.observedFare);
  const firstQuartile = calculatePercentile(fares, 0.25);
  const thirdQuartile = calculatePercentile(fares, 0.75);
  const iqr = thirdQuartile - firstQuartile;

  // A zero IQR means the usual IQR rule cannot establish a non-arbitrary range.
  // Keep all observations rather than silently discarding a potentially valid fare.
  if (iqr <= 0) {
    return { includedObservations: candidates, outlierObservations: [], bounds: null };
  }

  const lowerBound = firstQuartile - iqrMultiplier * iqr;
  const upperBound = thirdQuartile + iqrMultiplier * iqr;
  const includedObservations = candidates.filter((obs) => {
    const fare = obs.fare.observedFare;
    return fare >= lowerBound && fare <= upperBound;
  });
  const outlierObservations = candidates.filter((obs) => !includedObservations.includes(obs));

  return {
    includedObservations,
    outlierObservations,
    bounds: { lowerBound, upperBound },
  };
}

/**
 * Checks whether an observation qualifies for daily representative fare aggregation.
 * Configurable parameters allow future expansion without hardcoding checks across files.
 * 
 * @param {object} obs RawObservation object
 * @param {object} options Configuration filters
 * @returns {boolean}
 */
export function isObservationEligibleForAggregation(obs, options = {}) {
  const targetCabin = (options.targetCabin || 'economy').toLowerCase();
  const targetCurrency = (options.targetCurrency || 'INR').toUpperCase();
  const requireNonStop = options.requireNonStop === true;

  if (!obs) return false;

  // 1. Must be flagged as indexEligible by Step 2 validation engine
  if (obs.quality?.indexEligible !== true) {
    return false;
  }

  // 2. Must be one-way domestic observation
  if (obs.tripType && obs.tripType.toLowerCase() !== 'one-way') {
    return false;
  }

  // 3. Cabin class matching
  if (obs.cabinClass && obs.cabinClass.toLowerCase() !== targetCabin) {
    return false;
  }

  // CPI route medians must compare like-for-like itineraries. The production
  // pipeline accepts only explicitly identified non-stop observations.
  if (requireNonStop && obs.stops !== 0) {
    return false;
  }

  // 4. Currency matching
  if (obs.fare?.currency && obs.fare.currency.toUpperCase() !== targetCurrency) {
    return false;
  }

  // 5. Positive observed fare
  if (obs.fare?.observedFare == null || obs.fare.observedFare <= 0) {
    return false;
  }

  // 6. Valid route airports
  if (!obs.origin || !obs.destination || obs.origin === obs.destination) {
    return false;
  }

  return true;
}

export class DailyRouteAggregationService {
  /**
   * Performs in-memory aggregation on an array of RawObservation documents/objects.
   * 
   * @param {Array} observations Raw observations
   * @param {string} targetDate YYYY-MM-DD
   * @param {object} options
   * @returns {Array} List of calculated DailyRouteAggregation payload objects
   */
  static processObservations(observations, targetDate, options = {}) {
    const canonicalTargetDate = getCalendarDateString(targetDate);
    if (!canonicalTargetDate) {
      throw new Error(`Invalid aggregation date provided: ${targetDate}`);
    }

    const defaultDataEnv = (options.dataEnvironment || options.dataMode || 'REAL').toUpperCase();

    // Groups map: `${routeKey}__${leadTimeBucket}__${dataEnv}` -> group data
    const groups = new Map();

    for (const obs of observations) {
      const scrapedDateStr = getCalendarDateString(obs.scrapedAt);
      if (scrapedDateStr !== canonicalTargetDate) {
        // Skip observations not scraped on target date
        continue;
      }

      const departureDateStr = getCalendarDateString(obs.departureDate);
      if (!departureDateStr) continue;

      const leadTimeDays = calculateLeadTimeDays(departureDateStr, scrapedDateStr);
      if (leadTimeDays === null) continue;

      // Exact bucket lookup (no fuzzy windows allowed)
      const leadTimeBucket = getLeadTimeBucket(leadTimeDays);
      if (!leadTimeBucket) {
        // Outside the exact supported prototype windows (T+1, T+7, T+15, T+30, T+45)
        continue;
      }

      const origin = (obs.origin || '').trim().toUpperCase();
      const destination = (obs.destination || '').trim().toUpperCase();
      if (!origin || !destination || origin === destination) continue;

      const obsDataEnv = (obs.dataEnvironment || defaultDataEnv).toUpperCase();

      // If options specify an explicit dataEnvironment, filter out non-matching environments
      if (options.dataEnvironment && obsDataEnv !== defaultDataEnv) {
        continue;
      }

      const rawRouteKey = `${origin}-${destination}`;
      const canonicalRoute = obs.routeId || obs.routeKey || getCanonicalRouteId(origin, destination) || rawRouteKey;
      const routeKey = canonicalRoute;
      const groupOrigin = canonicalRoute.split('-')[0] || origin;
      const groupDestination = canonicalRoute.split('-')[1] || destination;
      const groupKey = `${routeKey}__${leadTimeBucket}__${obsDataEnv}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          collectionDate: canonicalTargetDate,
          dataEnvironment: obsDataEnv,
          origin: groupOrigin,
          destination: groupDestination,
          routeKey,
          leadTimeBucket,
          leadTimeDays,
          allObservations: [],
          eligibleObservations: [],
        });
      }

      const group = groups.get(groupKey);
      group.allObservations.push(obs);

      if (isObservationEligibleForAggregation(obs, options)) {
        group.eligibleObservations.push(obs);
      }
    }

    const aggregatedResults = [];

    // Calculate metrics for each non-empty group
    for (const group of groups.values()) {
      const totalCount = group.allObservations.length;
      const eligibleCount = group.eligibleObservations.length;

      // Missing Data Policy: If ZERO eligible observations exist, DO NOT create fake fare or zero document.
      if (eligibleCount === 0) {
        logger.info(
          `Skipping aggregation for ${group.routeKey} [${group.leadTimeBucket}] (${group.dataEnvironment}) on ${canonicalTargetDate}: 0 eligible observations.`
        );
        continue;
      }

      const { includedObservations, outlierObservations } = options.enableOutlierFilter === false
        ? { includedObservations: group.eligibleObservations, outlierObservations: [] }
        : filterFareOutliers(group.eligibleObservations, options);

      // An outlier filter must never turn a qualifying group into a fabricated
      // zero-price group. If all observations are removed, omit the aggregation.
      if (includedObservations.length === 0) {
        continue;
      }

      const includedFares = includedObservations
        .map((o) => o.fare?.observedFare)
        .filter((f) => typeof f === 'number');

      const representativeFare = calculateMedian(includedFares);
      const minFare = Math.min(...includedFares);
      const maxFare = Math.max(...includedFares);

      // Source / Airline breakdown calculation
      const sourceBreakdown = {};
      for (const obs of includedObservations) {
        const sourceName = obs.airline || obs.source || 'Unknown';
        sourceBreakdown[sourceName] = (sourceBreakdown[sourceName] || 0) + 1;
      }

      // Quality metrics
      const flaggedCount = group.allObservations.filter(
        (o) => o.quality?.flags && o.quality.flags.length > 0
      ).length;
      const ineligibleCount = totalCount - eligibleCount;

      aggregatedResults.push({
        collectionDate: group.collectionDate,
        dataEnvironment: group.dataEnvironment,
        origin: group.origin,
        destination: group.destination,
        routeKey: group.routeKey,
        leadTimeBucket: group.leadTimeBucket,
        leadTimeDays: group.leadTimeDays,
        representativeFare,
        currency: options.targetCurrency || 'INR',
        cabinClass: options.targetCabin || 'economy',
        observationCount: totalCount,
        eligibleObservationCount: eligibleCount,
        includedObservationCount: includedObservations.length,
        minFare,
        maxFare,
        quality: {
          flaggedObservationCount: flaggedCount,
          ineligibleObservationCount: ineligibleCount,
          outlierObservationCount: outlierObservations.length,
        },
        sourceBreakdown,
        calculationVersion: '1.0.0',
      });
    }

    return aggregatedResults;
  }

  /**
   * Executes daily route aggregation for a specific date against MongoDB.
   * 
   * @param {string} date YYYY-MM-DD
   * @param {object} options
   * @returns {Promise<object>} Execution report
   */
  static async aggregateForDate(date, options = {}) {
    const canonicalDate = getCalendarDateString(date);
    if (!canonicalDate) {
      throw new Error(`Invalid date format provided for aggregation: "${date}". Expected YYYY-MM-DD.`);
    }

    const dataEnvironment = (options.dataEnvironment || options.dataMode || 'REAL').toUpperCase();

    logger.info(`Starting DailyRouteAggregation for collection date: ${canonicalDate} [${dataEnvironment}]...`);

    let rawObservations = [];

    if (isDatabaseConnected()) {
      // Query raw observations scraped on that calendar date
      const startOfDay = new Date(`${canonicalDate}T00:00:00.000Z`);
      const endOfDay = new Date(`${canonicalDate}T23:59:59.999Z`);

      const query = {
        scrapedAt: { $gte: startOfDay, $lte: endOfDay },
      };

      if (dataEnvironment === 'REAL') {
        query.$or = [{ dataEnvironment: 'REAL' }, { dataEnvironment: { $exists: false } }];
      } else {
        query.dataEnvironment = dataEnvironment;
      }

      rawObservations = await RawObservation.find(query).lean();
    }

    const aggregatedPayloads = this.processObservations(rawObservations, canonicalDate, {
      ...options,
      dataEnvironment,
      requireNonStop: options.requireNonStop ?? true,
    });

    let storedCount = 0;
    let duplicateUpsertCount = 0;

    if (isDatabaseConnected()) {
      // Rebuilding a date must also remove any previous aggregation that no
      // longer qualifies (for example, a route containing only connections).
      const existingAggregationFilter = { collectionDate: canonicalDate };
      if (dataEnvironment === 'REAL') {
        existingAggregationFilter.$or = [{ dataEnvironment: 'REAL' }, { dataEnvironment: { $exists: false } }];
      } else {
        existingAggregationFilter.dataEnvironment = dataEnvironment;
      }
      await DailyRouteAggregation.deleteMany(existingAggregationFilter);
    }

    if (isDatabaseConnected() && aggregatedPayloads.length > 0) {
      const bulkOps = aggregatedPayloads.map((agg) => ({
        updateOne: {
          filter: {
            collectionDate: agg.collectionDate,
            routeKey: agg.routeKey,
            leadTimeBucket: agg.leadTimeBucket,
            dataEnvironment: agg.dataEnvironment,
          },
          update: { $set: agg },
          upsert: true,
        },
      }));

      const writeResult = await DailyRouteAggregation.bulkWrite(bulkOps, { ordered: false });
      storedCount = writeResult.upsertedCount + writeResult.modifiedCount;
      duplicateUpsertCount = writeResult.matchedCount;

      logger.info(
        `DailyRouteAggregation stored: ${writeResult.upsertedCount} inserted, ${writeResult.modifiedCount} updated, ${writeResult.matchedCount} matched.`
      );
    } else if (!isDatabaseConnected()) {
      storedCount = aggregatedPayloads.length;
      logger.warn(`MongoDB is disconnected. Generated ${aggregatedPayloads.length} aggregations in degraded mode.`);
    }

    // Extract unique routes and buckets covered
    const distinctRoutes = new Set(aggregatedPayloads.map((a) => a.routeKey));
    const distinctBuckets = new Set(aggregatedPayloads.map((a) => a.leadTimeBucket));

    return {
      success: true,
      collectionDate: canonicalDate,
      dataEnvironment,
      rawObservationsCount: rawObservations.length,
      aggregationsProduced: aggregatedPayloads.length,
      routesCovered: Array.from(distinctRoutes),
      bucketsCovered: Array.from(distinctBuckets),
      stored: storedCount,
      results: aggregatedPayloads,
    };
  }

  /**
   * Retrieves stored daily aggregations matching query filters.
   */
  static async getAggregations(filter = {}) {
    if (!isDatabaseConnected()) {
      return [];
    }

    const query = {};
    if (filter.date) query.collectionDate = getCalendarDateString(filter.date);
    if (filter.routeKey) query.routeKey = filter.routeKey.toUpperCase();
    if (filter.leadTimeBucket) query.leadTimeBucket = filter.leadTimeBucket.toUpperCase();
    if (filter.origin) query.origin = filter.origin.toUpperCase();
    if (filter.destination) query.destination = filter.destination.toUpperCase();

    const dataEnv = (filter.dataEnvironment || filter.dataMode || 'REAL').toUpperCase();
    if (dataEnv === 'REAL') {
      query.$or = [{ dataEnvironment: 'REAL' }, { dataEnvironment: { $exists: false } }];
    } else if (dataEnv !== 'ALL') {
      query.dataEnvironment = dataEnv;
    }

    return await DailyRouteAggregation.find(query).sort({ collectionDate: -1, routeKey: 1, leadTimeDays: 1 }).lean();
  }
}
