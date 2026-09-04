import { AirfareIndex } from '../models/AirfareIndex.js';
import { getCalendarDateString } from '../utils/dateUtils.js';
import { calculateMedian } from './dailyRouteAggregation.service.js';
import { isDatabaseConnected } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Returns ISO week string (e.g. "2026-W32") for a YYYY-MM-DD date.
 */
export function getISOWeekString(dateStr) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (isNaN(d.getTime())) return null;
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const weekNr = 1 + Math.ceil((firstThursday - target) / 604800000);
  const year = d.getUTCFullYear();
  return `${year}-W${String(weekNr).padStart(2, '0')}`;
}

export class TemporalAggregationService {
  /**
   * Retrieves temporal aggregated index time-series (daily, weekly, or monthly).
   */
  static async getAggregatedSeries({
    frequency = 'daily',
    startDate,
    endDate,
    leadTimeBucket = 'T+7',
    dataEnvironment = 'REAL',
  }) {
    const dataEnv = (dataEnvironment || 'REAL').toUpperCase();
    const bucket = (leadTimeBucket || 'T+7').toUpperCase();
    const freq = frequency.toLowerCase();

    const query = {
      leadTimeBucket: bucket,
      dataEnvironment: dataEnv === 'REAL'
        ? { $or: [{ dataEnvironment: 'REAL' }, { dataEnvironment: { $exists: false } }] }
        : dataEnv,
    };

    if (startDate || endDate) {
      query.indexDate = {};
      if (startDate) query.indexDate.$gte = getCalendarDateString(startDate);
      if (endDate) query.indexDate.$lte = getCalendarDateString(endDate);
    }

    let dailyDocs = [];
    if (isDatabaseConnected()) {
      dailyDocs = await AirfareIndex.find(query).sort({ indexDate: 1 }).lean();
    }

    if (freq === 'daily') {
      return dailyDocs.map((doc) => ({
        period: doc.indexDate,
        date: doc.indexDate,
        frequency: 'daily',
        leadTimeBucket: doc.leadTimeBucket,
        indexValue: doc.indexValue,
        baseIndex: 100.0,
        dailyChangePercent: doc.dailyChangePercent,
        baseRelativeChangePercent: doc.baseRelativeChangePercent,
        routeCount: doc.routeCount,
        configuredRouteCount: doc.configuredRouteCount,
        eligibleRouteCount: doc.routeCount,
        missingRouteCount: (doc.configuredRouteCount || doc.routeCount) - doc.routeCount,
        coveragePercent: doc.weightCoverage,
        dataEnvironment: doc.dataEnvironment || dataEnv,
      }));
    }

    if (freq === 'weekly') {
      const weeklyGroups = new Map();
      for (const doc of dailyDocs) {
        const weekKey = getISOWeekString(doc.indexDate);
        if (!weekKey) continue;
        if (!weeklyGroups.has(weekKey)) {
          weeklyGroups.set(weekKey, {
            period: weekKey,
            frequency: 'weekly',
            leadTimeBucket: bucket,
            indexValues: [],
            routes: [],
            coverages: [],
            dates: [],
          });
        }
        const g = weeklyGroups.get(weekKey);
        g.indexValues.push(doc.indexValue);
        g.routes.push(doc.routeCount);
        g.coverages.push(doc.weightCoverage);
        g.dates.push(doc.indexDate);
      }

      return Array.from(weeklyGroups.values()).map((g) => {
        const medianVal = calculateMedian(g.indexValues);
        const meanRoute = Math.round(g.routes.reduce((s, v) => s + v, 0) / g.routes.length);
        const meanCov = Math.round((g.coverages.reduce((s, v) => s + v, 0) / g.coverages.length) * 10) / 10;
        return {
          period: g.period,
          startDate: g.dates[0],
          endDate: g.dates[g.dates.length - 1],
          frequency: 'weekly',
          leadTimeBucket: bucket,
          indexValue: medianVal,
          baseIndex: 100.0,
          sampleDays: g.indexValues.length,
          routeCount: meanRoute,
          eligibleRouteCount: meanRoute,
          missingRouteCount: 0,
          coveragePercent: meanCov,
          dataEnvironment: dataEnv,
        };
      });
    }

    if (freq === 'monthly') {
      const monthlyGroups = new Map();
      for (const doc of dailyDocs) {
        const monthKey = doc.indexDate.slice(0, 7);
        if (!monthlyGroups.has(monthKey)) {
          monthlyGroups.set(monthKey, {
            period: monthKey,
            frequency: 'monthly',
            leadTimeBucket: bucket,
            indexValues: [],
            routes: [],
            coverages: [],
            dates: [],
          });
        }
        const g = monthlyGroups.get(monthKey);
        g.indexValues.push(doc.indexValue);
        g.routes.push(doc.routeCount);
        g.coverages.push(doc.weightCoverage);
        g.dates.push(doc.indexDate);
      }

      return Array.from(monthlyGroups.values()).map((g) => {
        const medianVal = calculateMedian(g.indexValues);
        const meanRoute = Math.round(g.routes.reduce((s, v) => s + v, 0) / g.routes.length);
        const meanCov = Math.round((g.coverages.reduce((s, v) => s + v, 0) / g.coverages.length) * 10) / 10;
        return {
          period: g.period,
          startDate: g.dates[0],
          endDate: g.dates[g.dates.length - 1],
          frequency: 'monthly',
          leadTimeBucket: bucket,
          indexValue: medianVal,
          baseIndex: 100.0,
          sampleDays: g.indexValues.length,
          routeCount: meanRoute,
          eligibleRouteCount: meanRoute,
          missingRouteCount: 0,
          coveragePercent: meanCov,
          dataEnvironment: dataEnv,
        };
      });
    }

    return [];
  }
}
