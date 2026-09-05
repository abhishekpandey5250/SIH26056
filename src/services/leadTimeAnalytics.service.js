import { DailyRouteAggregation } from '../models/DailyRouteAggregation.js';
import { getCalendarDateString } from '../utils/dateUtils.js';
import { calculateMedian } from './dailyRouteAggregation.service.js';
import { isDatabaseConnected } from '../config/database.js';
import { logger } from '../utils/logger.js';

export class LeadTimeAnalyticsService {
  /**
   * Computes descriptive lead-time elasticity metrics across exact advance purchase windows.
   */
  static async getLeadTimeElasticity({
    date,
    routeKey,
    dataEnvironment = 'REAL',
  }) {
    const dataEnv = (dataEnvironment || 'REAL').toUpperCase();
    const envFilter = dataEnv === 'REAL'
      ? { $or: [{ dataEnvironment: 'REAL' }, { dataEnvironment: { $exists: false } }] }
      : { dataEnvironment: dataEnv };

    const buckets = [
      { bucket: 'T+1', days: 1, label: 'Immediate Departure' },
      { bucket: 'T+7', days: 7, label: '1 Week Advance' },
      { bucket: 'T+15', days: 15, label: '2 Weeks Advance' },
      { bucket: 'T+30', days: 30, label: '1 Month Advance' },
      { bucket: 'T+45', days: 45, label: '1.5 Months Advance' },
    ];

    let aggregations = [];
    if (isDatabaseConnected()) {
      const query = { ...envFilter };
      if (date) query.collectionDate = getCalendarDateString(date);
      if (routeKey) query.routeKey = routeKey.toUpperCase();

      aggregations = await DailyRouteAggregation.find(query).lean();
    }

    const bucketDataMap = new Map();
    aggregations.forEach((agg) => {
      if (!bucketDataMap.has(agg.leadTimeBucket)) {
        bucketDataMap.set(agg.leadTimeBucket, {
          fares: [],
          observationCount: 0,
          routes: new Set(),
        });
      }
      const b = bucketDataMap.get(agg.leadTimeBucket);
      b.fares.push(agg.representativeFare);
      b.observationCount += agg.observationCount || 0;
      b.routes.add(agg.routeKey);
    });

    // Compute metrics per bucket
    const series = [];
    let t1MedianFare = null;

    for (const b of buckets) {
      const data = bucketDataMap.get(b.bucket);
      if (data && data.fares.length > 0) {
        const medianFare = calculateMedian(data.fares);
        const meanFare = Math.round((data.fares.reduce((s, v) => s + v, 0) / data.fares.length) * 100) / 100;
        const minFare = Math.min(...data.fares);
        const maxFare = Math.max(...data.fares);

        if (b.bucket === 'T+1') {
          t1MedianFare = medianFare;
        }

        series.push({
          bucket: b.bucket,
          days: b.days,
          label: b.label,
          medianFare,
          meanFare,
          minFare,
          maxFare,
          observationCount: data.observationCount,
          routeCoverageCount: data.routes.size,
          dataEnvironment: dataEnv,
        });
      } else {
        series.push({
          bucket: b.bucket,
          days: b.days,
          label: b.label,
          medianFare: null,
          meanFare: null,
          minFare: null,
          maxFare: null,
          observationCount: 0,
          routeCoverageCount: 0,
          dataEnvironment: dataEnv,
        });
      }
    }

    // Compute % discount / premium relative to T+1 immediate departure
    const enrichedSeries = series.map((s) => {
      let percentVsT1 = null;
      if (t1MedianFare && s.medianFare && t1MedianFare > 0) {
        percentVsT1 = Math.round(((s.medianFare - t1MedianFare) / t1MedianFare) * 10000) / 100;
      }
      return {
        ...s,
        percentVsT1,
      };
    });

    return {
      success: true,
      title: 'Observed Fare by Advance-Purchase Window',
      methodologyNote: 'Descriptive cross-sectional analysis of observed median airfares at fixed booking horizons. This is an empirical empirical curve and not a forecast.',
      dataEnvironment: dataEnv,
      selectedRoute: routeKey || 'ALL_CORRIDORS',
      curve: enrichedSeries,
    };
  }
}
