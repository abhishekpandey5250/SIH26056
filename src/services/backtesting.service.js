import { DGCAReferenceFare } from '../models/DGCAReferenceFare.js';
import { AirfareIndex } from '../models/AirfareIndex.js';
import { DailyRouteAggregation } from '../models/DailyRouteAggregation.js';
import { BacktestQualityService } from './backtestQuality.service.js';
import { getCalendarDateString } from '../utils/dateUtils.js';
import { calculateMedian } from './dailyRouteAggregation.service.js';
import { isDatabaseConnected } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Generates an inclusive list of YYYY-MM-DD date strings between start and end dates.
 */
export function generateDateRange(startDateStr, endDateStr) {
  const start = new Date(`${getCalendarDateString(startDateStr)}T00:00:00.000Z`);
  const end = new Date(`${getCalendarDateString(endDateStr)}T00:00:00.000Z`);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [];
  }

  const dates = [];
  const curr = new Date(start);
  while (curr <= end) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Computes Pearson correlation coefficient between two equal-length numerical arrays.
 */
export function calculateCorrelation(xList, yList) {
  if (!Array.isArray(xList) || !Array.isArray(yList) || xList.length !== yList.length || xList.length < 2) {
    return null;
  }

  const n = xList.length;
  const meanX = xList.reduce((sum, v) => sum + v, 0) / n;
  const meanY = yList.reduce((sum, v) => sum + v, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xList[i] - meanX;
    const dy = yList[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const denominator = Math.sqrt(denX * denY);
  if (denominator === 0 || isNaN(denominator)) {
    return null; // Zero variance in one or both series
  }

  const r = num / denominator;
  return Math.round(r * 10000) / 10000;
}

/**
 * Computes Directional Agreement (% of times day-to-day deltas move in the same sign direction).
 */
export function calculateDirectionalAgreement(xList, yList) {
  if (!Array.isArray(xList) || !Array.isArray(yList) || xList.length < 2 || xList.length !== yList.length) {
    return null;
  }

  let evaluatedSteps = 0;
  let matchingSteps = 0;

  for (let i = 1; i < xList.length; i++) {
    const deltaX = xList[i] - xList[i - 1];
    const deltaY = yList[i] - yList[i - 1];

    if (deltaX !== 0 || deltaY !== 0) {
      evaluatedSteps++;
      const signX = Math.sign(deltaX);
      const signY = Math.sign(deltaY);
      if (signX === signY) {
        matchingSteps++;
      }
    }
  }

  if (evaluatedSteps === 0) return null;
  return Math.round((matchingSteps / evaluatedSteps) * 10000) / 100;
}

export class BacktestingService {
  /**
   * Pure statistical backtest calculation given arrays of stored records.
   */
  static runBacktestAnalysis({
    startDate,
    endDate,
    leadTimeBucket = 'T+7',
    ourIndices = [],
    dgcaReferenceFares = [],
    ourAggregations = [],
  }) {
    const dateList = generateDateRange(startDate, endDate);
    if (dateList.length === 0) {
      throw new Error(`Invalid date range provided: "${startDate}" to "${endDate}".`);
    }

    // 1. Build daily map of our index values
    const ourIndexMap = new Map();
    ourIndices
      .filter((idx) => idx.leadTimeBucket === leadTimeBucket && typeof idx.indexValue === 'number')
      .forEach((idx) => {
        ourIndexMap.set(idx.indexDate, idx.indexValue);
      });

    // 2. Build daily map of DGCA reference benchmark fares (grouped by date)
    const dgcaByDate = new Map();
    dgcaReferenceFares.forEach((rf) => {
      if (!dgcaByDate.has(rf.referenceDate)) {
        dgcaByDate.set(rf.referenceDate, []);
      }
      dgcaByDate.get(rf.referenceDate).push(rf);
    });

    const dgcaDailyFareMap = new Map();
    for (const [date, fareList] of dgcaByDate.entries()) {
      const numericFares = fareList.map((f) => f.averageFare).filter((v) => typeof v === 'number' && v > 0);
      const medianFare = calculateMedian(numericFares);
      if (medianFare !== null) {
        dgcaDailyFareMap.set(date, medianFare);
      }
    }

    // 3. Find Overlapping Observations
    const overlappingDates = [];
    const ourRawValues = [];
    const dgcaRawValues = [];

    for (const date of dateList) {
      if (ourIndexMap.has(date) && dgcaDailyFareMap.has(date)) {
        overlappingDates.push(date);
        ourRawValues.push(ourIndexMap.get(date));
        dgcaRawValues.push(dgcaDailyFareMap.get(date));
      }
    }

    const overlappingDays = overlappingDates.length;

    // 4. Series Normalization to First Overlapping Common Base (Section 6)
    let normalizedOurSeries = [];
    let normalizedDgcaSeries = [];
    let mae = null;
    let mape = null;
    let rmse = null;
    let correlation = null;
    let directionalAgreement = null;

    if (overlappingDays > 0) {
      const baseOur = ourRawValues[0];
      const baseDgca = dgcaRawValues[0];

      normalizedOurSeries = ourRawValues.map((v) => Math.round((v / baseOur) * 10000) / 100);
      normalizedDgcaSeries = dgcaRawValues.map((v) => Math.round((v / baseDgca) * 10000) / 100);

      // MAE & MAPE & RMSE calculations on normalized series
      let totalAbsError = 0;
      let totalAbsPercentError = 0;
      let totalSqError = 0;

      for (let i = 0; i < overlappingDays; i++) {
        const error = Math.abs(normalizedOurSeries[i] - normalizedDgcaSeries[i]);
        totalAbsError += error;
        totalAbsPercentError += (error / normalizedDgcaSeries[i]) * 100;
        totalSqError += error * error;
      }

      mae = Math.round((totalAbsError / overlappingDays) * 100) / 100;
      mape = Math.round((totalAbsPercentError / overlappingDays) * 100) / 100;
      rmse = Math.round(Math.sqrt(totalSqError / overlappingDays) * 100) / 100;

      if (overlappingDays >= 2) {
        correlation = calculateCorrelation(normalizedOurSeries, normalizedDgcaSeries);
        directionalAgreement = calculateDirectionalAgreement(normalizedOurSeries, normalizedDgcaSeries);
      }
    }

    // 5. Route-Level Validation Comparison
    const ourAggRouteMap = new Map(); // `${date}__${routeKey}` -> representativeFare
    ourAggregations
      .filter((agg) => agg.leadTimeBucket === leadTimeBucket)
      .forEach((agg) => {
        ourAggRouteMap.set(`${agg.collectionDate}__${agg.routeKey}`, agg.representativeFare);
      });

    const routeComparisonMap = new Map(); // routeKey -> { totalDiff, count, ourSum, dgcaSum }
    for (const dgcaRec of dgcaReferenceFares) {
      const key = `${dgcaRec.referenceDate}__${dgcaRec.route}`;
      if (ourAggRouteMap.has(key)) {
        const ourFare = ourAggRouteMap.get(key);
        const dgcaFare = dgcaRec.averageFare;
        const absDiff = Math.abs(ourFare - dgcaFare);
        const pctDiff = ((ourFare - dgcaFare) / dgcaFare) * 100;

        if (!routeComparisonMap.has(dgcaRec.route)) {
          routeComparisonMap.set(dgcaRec.route, {
            routeKey: dgcaRec.route,
            origin: dgcaRec.origin,
            destination: dgcaRec.destination,
            observationsCount: 0,
            ourFareSum: 0,
            dgcaFareSum: 0,
            totalAbsDiff: 0,
            totalPctDiff: 0,
          });
        }

        const stats = routeComparisonMap.get(dgcaRec.route);
        stats.observationsCount++;
        stats.ourFareSum += ourFare;
        stats.dgcaFareSum += dgcaFare;
        stats.totalAbsDiff += absDiff;
        stats.totalPctDiff += pctDiff;
      }
    }

    const routeComparisons = Array.from(routeComparisonMap.values()).map((r) => ({
      routeKey: r.routeKey,
      origin: r.origin,
      destination: r.destination,
      matchedObservations: r.observationsCount,
      ourMeanFare: Math.round((r.ourFareSum / r.observationsCount) * 100) / 100,
      dgcaMeanFare: Math.round((r.dgcaFareSum / r.observationsCount) * 100) / 100,
      meanAbsoluteDiff: Math.round((r.totalAbsDiff / r.observationsCount) * 100) / 100,
      meanPercentDiff: Math.round((r.totalPctDiff / r.observationsCount) * 100) / 100,
    }));

    // 6. Generate Data Quality Report
    const qualityReport = BacktestQualityService.generateQualityReport({
      dateList,
      ourIndexMap,
      dgcaMap: dgcaDailyFareMap,
      overlappingDays,
      routeComparisons,
    });

    // Time-series alignment table for charts and exports
    const timeSeries = dateList.map((d) => {
      const ourIdx = ourIndexMap.has(d) ? ourIndexMap.get(d) : null;
      const dgcaFare = dgcaDailyFareMap.has(d) ? dgcaDailyFareMap.get(d) : null;
      const overlapIdx = overlappingDates.indexOf(d);

      return {
        date: d,
        ourIndexValue: ourIdx,
        dgcaReferenceValue: dgcaFare,
        normalizedOurIndex: overlapIdx >= 0 ? normalizedOurSeries[overlapIdx] : null,
        normalizedDgcaIndex: overlapIdx >= 0 ? normalizedDgcaSeries[overlapIdx] : null,
        isOverlapping: overlapIdx >= 0,
      };
    });

    return {
      success: true,
      startDate: dateList[0],
      endDate: dateList[dateList.length - 1],
      leadTimeBucket,
      daysRequested: dateList.length,
      daysWithOurIndex: ourIndexMap.size,
      daysWithDGCAReference: dgcaDailyFareMap.size,
      overlappingDays,
      coveragePercentage: qualityReport.coveragePercentage,
      metrics: {
        mae,
        mape,
        rmse,
        correlation,
        directionalAgreement,
        metricExplanations: {
          mae: mae !== null ? 'Mean Absolute Error on base-normalized index scale.' : 'MAE unavailable: zero overlapping days.',
          mape: mape !== null ? 'Mean Absolute Percentage Error vs DGCA normalized benchmark.' : 'MAPE unavailable: zero overlapping days.',
          correlation: correlation !== null ? 'Pearson correlation coefficient r.' : 'Correlation unavailable: fewer than 2 overlapping days with non-zero variance.',
          directionalAgreement: directionalAgreement !== null ? 'Percentage of day-to-day changes moving in identical direction.' : 'Directional agreement unavailable: fewer than 2 changes.',
        },
      },
      routeComparisons,
      timeSeries,
      quality: qualityReport,
    };
  }

  /**
   * Executes backtesting against MongoDB collections for a date range.
   */
  static async executeBacktest({
    startDate,
    endDate,
    leadTimeBucket = 'T+7',
    dataEnvironment = 'REAL',
  }) {
    const canonicalStart = getCalendarDateString(startDate);
    const canonicalEnd = getCalendarDateString(endDate);

    if (!canonicalStart || !canonicalEnd) {
      throw new Error('Valid startDate and endDate (YYYY-MM-DD) are required.');
    }

    const dataEnv = (dataEnvironment || 'REAL').toUpperCase();
    const envFilter = dataEnv === 'REAL'
      ? { $or: [{ dataEnvironment: 'REAL' }, { dataEnvironment: { $exists: false } }] }
      : { dataEnvironment: dataEnv };

    let ourIndices = [];
    let dgcaFares = [];
    let ourAggregations = [];

    if (isDatabaseConnected()) {
      ourIndices = await AirfareIndex.find({
        indexDate: { $gte: canonicalStart, $lte: canonicalEnd },
        leadTimeBucket,
        ...envFilter,
      }).lean();

      dgcaFares = await DGCAReferenceFare.find({
        referenceDate: { $gte: canonicalStart, $lte: canonicalEnd },
        ...envFilter,
      }).lean();

      ourAggregations = await DailyRouteAggregation.find({
        collectionDate: { $gte: canonicalStart, $lte: canonicalEnd },
        leadTimeBucket,
        ...envFilter,
      }).lean();
    }

    const report = this.runBacktestAnalysis({
      startDate: canonicalStart,
      endDate: canonicalEnd,
      leadTimeBucket,
      ourIndices,
      dgcaReferenceFares: dgcaFares,
      ourAggregations,
    });

    report.dataEnvironment = dataEnv;
    return report;
  }

  /**
   * Retrieves operational status of DGCA benchmark dataset and index coverage.
   */
  static async getBacktestStatus(options = {}) {
    const dataEnv = (options.dataEnvironment || options.dataMode || 'REAL').toUpperCase();
    const envFilter = dataEnv === 'REAL'
      ? { $or: [{ dataEnvironment: 'REAL' }, { dataEnvironment: { $exists: false } }] }
      : { dataEnvironment: dataEnv };

    let dgcaCount = 0;
    let earliestDgcaDate = null;
    let latestDgcaDate = null;
    let ourIndexCount = 0;
    let earliestOurDate = null;
    let latestOurDate = null;

    if (isDatabaseConnected()) {
      try {
        dgcaCount = await DGCAReferenceFare.countDocuments(envFilter);
        if (dgcaCount > 0) {
          const firstDgca = await DGCAReferenceFare.findOne(envFilter).sort({ referenceDate: 1 }).select('referenceDate').lean();
          const lastDgca = await DGCAReferenceFare.findOne(envFilter).sort({ referenceDate: -1 }).select('referenceDate').lean();
          earliestDgcaDate = firstDgca?.referenceDate || null;
          latestDgcaDate = lastDgca?.referenceDate || null;
        }

        ourIndexCount = await AirfareIndex.countDocuments(envFilter);
        if (ourIndexCount > 0) {
          const firstOur = await AirfareIndex.findOne(envFilter).sort({ indexDate: 1 }).select('indexDate').lean();
          const lastOur = await AirfareIndex.findOne(envFilter).sort({ indexDate: -1 }).select('indexDate').lean();
          earliestOurDate = firstOur?.indexDate || null;
          latestOurDate = lastOur?.indexDate || null;
        }
      } catch (err) {
        logger.warn('Error fetching backtest status telemetry from MongoDB:', { error: err.message });
      }
    }

    const dgcaAvailable = dgcaCount > 0;
    let readyFor30DayBacktest = false;

    if (earliestDgcaDate && latestDgcaDate && earliestOurDate && latestOurDate) {
      const overlapStart = earliestDgcaDate > earliestOurDate ? earliestDgcaDate : earliestOurDate;
      const overlapEnd = latestDgcaDate < latestOurDate ? latestDgcaDate : latestOurDate;

      if (overlapStart <= overlapEnd) {
        const overlapDays = generateDateRange(overlapStart, overlapEnd).length;
        readyFor30DayBacktest = overlapDays >= 30;
      }
    }

    return {
      success: true,
      dataEnvironment: dataEnv,
      dgcaDatasetAvailable: dgcaAvailable,
      dgcaRecordCount: dgcaCount,
      earliestDgcaDate,
      latestDgcaDate,
      ourIndexRecordCount: ourIndexCount,
      earliestOurDate,
      latestOurDate,
      readyFor30DayBacktest,
      databaseStatus: isDatabaseConnected() ? 'connected' : 'disconnected',
    };
  }
}
