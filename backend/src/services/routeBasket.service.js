import { DGCATraffic } from '../models/DGCATraffic.js';
import { DEMO_ROUTE_WEIGHTS } from '../config/indexConfig.js';
import { normalizeWeights } from './airfareIndex.service.js';
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
   */
  static async getActiveBasket(options = {}) {
    const dataEnv = (options.dataEnvironment || options.dataMode || 'REAL').toUpperCase();
    const period = options.period || null;

    if (isDatabaseConnected()) {
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
        logger.warn('Error querying DGCATraffic:', { error: err.message });
      }
    }

    // Fallback: Provisional basket when no DGCA traffic data has been loaded
    const normalizedProvisional = normalizeWeights(DEMO_ROUTE_WEIGHTS);
    return {
      basketVersion: '1.0-provisional',
      isDgcaDerived: false,
      validationStatus: dataEnv === 'DEMO' ? 'DEMO_DATASET' : 'PROVISIONAL / NOT DGCA-VALIDATED',
      period: '2026-BASELINE',
      routes: normalizedProvisional,
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
