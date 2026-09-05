import { DailyRouteAggregation } from '../models/DailyRouteAggregation.js';
import { RouteBasketService } from './routeBasket.service.js';
import { DEFAULT_BASE_PERIOD } from '../config/indexConfig.js';
import { getCalendarDateString } from '../utils/dateUtils.js';
import { calculateMedian } from './dailyRouteAggregation.service.js';
import { isDatabaseConnected } from '../config/database.js';
import { logger } from '../utils/logger.js';

export class SectorAnalyticsService {
  /**
   * Computes sector-wise heatmap matrix data.
   */
  static async getHeatmapData({
    date,
    startDate,
    endDate,
    leadTimeBucket = 'T+7',
    dataEnvironment = 'REAL',
  }) {
    const dataEnv = (dataEnvironment || 'REAL').toUpperCase();
    const bucket = (leadTimeBucket || 'T+7').trim().replace(/\s+/, '+').toUpperCase();

    const envFilter = dataEnv === 'REAL'
      ? { $or: [{ dataEnvironment: 'REAL' }, { dataEnvironment: { $exists: false } }] }
      : { dataEnvironment: dataEnv };

    let aggregations = [];
    let baseAggregations = [];

    if (isDatabaseConnected()) {
      const query = { leadTimeBucket: bucket, ...envFilter };
      if (date) {
        query.collectionDate = getCalendarDateString(date);
      } else if (startDate || endDate) {
        query.collectionDate = {};
        if (startDate) query.collectionDate.$gte = getCalendarDateString(startDate);
        if (endDate) query.collectionDate.$lte = getCalendarDateString(endDate);
      }

      aggregations = await DailyRouteAggregation.find(query).lean();

      // Fetch base period aggregations for baseline comparisons
      baseAggregations = await DailyRouteAggregation.find({
        collectionDate: {
          $gte: DEFAULT_BASE_PERIOD.startDate,
          $lte: DEFAULT_BASE_PERIOD.endDate,
        },
        leadTimeBucket: bucket,
        ...envFilter,
      }).lean();
    }

    // Active route weights
    const basketInfo = await RouteBasketService.getActiveBasket({ dataEnvironment: dataEnv });
    const weightMap = new Map(basketInfo.routes.map((r) => [r.routeKey, r.weight]));

    // Compute base median fare per route
    const baseFaresByRoute = new Map();
    const baseGrouped = new Map();
    baseAggregations.forEach((b) => {
      if (!baseGrouped.has(b.routeKey)) baseGrouped.set(b.routeKey, []);
      baseGrouped.get(b.routeKey).push(b.representativeFare);
    });
    for (const [rKey, fList] of baseGrouped.entries()) {
      const med = calculateMedian(fList);
      if (med && med > 0) baseFaresByRoute.set(rKey, med);
    }

    // Group current aggregations by routeKey
    const currentGrouped = new Map();
    aggregations.forEach((agg) => {
      if (!currentGrouped.has(agg.routeKey)) {
        currentGrouped.set(agg.routeKey, {
          origin: agg.origin,
          destination: agg.destination,
          routeKey: agg.routeKey,
          fares: [],
          observationCounts: 0,
          minFares: [],
          maxFares: [],
        });
      }
      const g = currentGrouped.get(agg.routeKey);
      g.fares.push(agg.representativeFare);
      g.observationCounts += agg.observationCount || 0;
      g.minFares.push(agg.minFare);
      g.maxFares.push(agg.maxFare);
    });

    const sectors = [];
    for (const [routeKey, g] of currentGrouped.entries()) {
      const currentMedian = calculateMedian(g.fares);
      if (currentMedian === null || currentMedian <= 0) continue;

      const baseFare = baseFaresByRoute.get(routeKey) || null;
      const changePercent = baseFare ? Math.round(((currentMedian / baseFare) - 1) * 10000) / 100 : null;
      const priceRelative = baseFare ? Math.round((currentMedian / baseFare) * 10000) / 100 : null;
      const weight = weightMap.get(routeKey) || 0;

      sectors.push({
        origin: g.origin,
        destination: g.destination,
        sector: routeKey,
        value: currentMedian,
        baseValue: baseFare,
        changePercent,
        priceRelative,
        weight,
        observationCount: g.observationCounts,
        minFare: Math.min(...g.minFares),
        maxFare: Math.max(...g.maxFares),
        leadTimeBucket: bucket,
        dataEnvironment: dataEnv,
      });
    }

    // Sort by weight descending
    sectors.sort((a, b) => b.weight - a.weight);

    return sectors;
  }
}
