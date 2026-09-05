import { DGCATraffic } from '../models/DGCATraffic.js';
import { PRODUCTION_20_ROUTE_WEIGHTS, DEMO_ROUTE_WEIGHTS } from '../config/indexConfig.js';
import { normalizeWeights } from '../utils/weights.js';
import { isDatabaseConnected } from '../config/database.js';
import { logger } from '../utils/logger.js';

export class RouteBasketService {
  /**
   * Pure function: Computes normalized route weights from passenger traffic counts.
   */
  static calculateWeightsFromTraffic(trafficRecords = [], options = {}) {
    if (!Array.isArray(trafficRecords) || trafficRecords.length === 0) {
      return [];
    }

    const minTraffic = options.minTraffic || 0;
    const topN = options.topN || 0;
    const inclusions = new Set(options.includeRoutes ? options.includeRoutes.map((r) => r.toUpperCase()) : []);
    const exclusions = new Set(options.excludeRoutes ? options.excludeRoutes.map((r) => r.toUpperCase()) : []);

    // Filter eligible records
    let filtered = trafficRecords.filter((rec) => {
      if (!rec || typeof rec.passengers !== 'number' || rec.passengers <= 0) return false;
      const routeKey = (rec.route || `${rec.origin}-${rec.destination}`).toUpperCase();
      if (exclusions.has(routeKey)) return false;
      if (inclusions.size > 0 && !inclusions.has(routeKey)) return false;
      return rec.passengers >= minTraffic;
    });

    // Sort descending by traffic
    filtered.sort((a, b) => b.passengers - a.passengers);

    if (topN > 0 && filtered.length > topN) {
      filtered = filtered.slice(0, topN);
    }

    const totalPax = filtered.reduce((sum, r) => sum + r.passengers, 0);
    if (totalPax <= 0) return [];

    return filtered.map((r) => {
      const routeKey = (r.route || `${r.origin}-${r.destination}`).toUpperCase();
      const rawWeight = r.passengers / totalPax;
      return {
        routeKey,
        origin: r.origin,
        destination: r.destination,
        passengers: r.passengers,
        weight: Math.round(rawWeight * 10000) / 10000,
        rawWeight,
      };
    });
  }

  /**
   * Retrieves active route basket for calculations.
   * Default behavior: Uses authoritative hardcoded 20-route weights so that weights
   * remain strictly fixed across all environments and machines (e.g. DEL-BOM: 0.13 / 13%).
   */
  static async getActiveBasket(options = {}) {
    const dataEnv = (options.dataEnvironment || options.dataMode || 'REAL').toUpperCase();
    const period = options.period || null;

    // Optional dynamic override if explicitly requested
    if (options.useDynamicTrafficWeights && isDatabaseConnected()) {
      try {
        const query = { dataEnvironment: dataEnv };
        if (period) query.period = period;

        const trafficDocs = await DGCATraffic.find(query).lean();
        if (trafficDocs.length > 0) {
          const derivedWeights = this.calculateWeightsFromTraffic(trafficDocs, options);
          if (derivedWeights.length > 0) {
            return {
              basketVersion: '2.0-dgca-traffic',
              isDgcaDerived: true,
              validationStatus: 'DGCA_TRAFFIC_DERIVED',
              period: trafficDocs[0].period,
              routes: derivedWeights,
              dataEnvironment: dataEnv,
            };
          }
        }
      } catch (err) {
        logger.warn('Error querying DGCATraffic for dynamic weights:', { error: err.message });
      }
    }

    // Authoritative hardcoded 20-route production basket
    const baseRoutes = PRODUCTION_20_ROUTE_WEIGHTS.map((rw) => ({
      routeKey: rw.routeKey,
      origin: rw.origin,
      destination: rw.destination,
      weight: rw.weight,
      source: rw.source || 'DGCA_PRODUCTION_BASKET',
    }));

    // If DGCA traffic is present in MongoDB, attach passenger counts for telemetry display without altering weights
    if (isDatabaseConnected()) {
      try {
        const query = { dataEnvironment: dataEnv };
        if (period) query.period = period;
        const trafficDocs = await DGCATraffic.find(query).lean();
        if (trafficDocs && trafficDocs.length > 0) {
          const paxMap = new Map();
          trafficDocs.forEach((doc) => {
            const key = (doc.route || `${doc.origin}-${doc.destination}`).toUpperCase();
            paxMap.set(key, doc.passengers);
          });
          baseRoutes.forEach((r) => {
            if (paxMap.has(r.routeKey)) {
              r.passengers = paxMap.get(r.routeKey);
            }
          });
        }
      } catch (err) {
        logger.warn('Error querying DGCATraffic for passenger telemetry:', { error: err.message });
      }
    }

    return {
      basketVersion: '1.0-hardcoded',
      isDgcaDerived: false,
      validationStatus: dataEnv === 'DEMO' ? 'DEMO_DATASET' : 'PROVISIONAL / AUTHORITATIVE_HARDCODED',
      period: '2026-BASELINE',
      routes: baseRoutes,
      dataEnvironment: dataEnv,
    };
  }

  /**
   * Retrieves operational basket status and verification telemetry.
   */
  static async getBasketStatus(options = {}) {
    const basket = await this.getActiveBasket(options);
    const totalWeight = basket.routes.reduce((sum, r) => sum + r.weight, 0);

    return {
      success: true,
      dataEnvironment: basket.dataEnvironment,
      basketVersion: basket.basketVersion,
      validationStatus: basket.validationStatus,
      isDgcaDerived: basket.isDgcaDerived,
      period: basket.period,
      routeCount: basket.routes.length,
      weightSum: Math.round(totalWeight * 100) / 100,
      routes: basket.routes.map((r) => ({
        routeKey: r.routeKey,
        origin: r.origin,
        destination: r.destination,
        weight: r.weight,
        passengers: r.passengers || null,
      })),
    };
  }
}
