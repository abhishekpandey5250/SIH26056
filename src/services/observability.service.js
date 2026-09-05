import { RawObservation } from '../models/RawObservation.js';
import { DailyRouteAggregation } from '../models/DailyRouteAggregation.js';
import { AirfareIndex } from '../models/AirfareIndex.js';
import { RouteBasketService } from './routeBasket.service.js';
import { isDatabaseConnected } from '../config/database.js';
import { logger } from '../utils/logger.js';

export class ObservabilityService {
  /**
   * Computes comprehensive data observability metrics and quality scores.
   */
  static async getObservabilitySummary(options = {}) {
    const dataEnv = (options.dataEnvironment || options.dataMode || 'REAL').toUpperCase();
    const envFilter = dataEnv === 'REAL'
      ? { $or: [{ dataEnvironment: 'REAL' }, { dataEnvironment: { $exists: false } }] }
      : { dataEnvironment: dataEnv };

    let totalRaw = 0;
    let eligibleRaw = 0;
    let flaggedRaw = 0;
    let internationalCount = 0;
    let roundTripCount = 0;
    let missingPriceCount = 0;
    let unknownCurrencyCount = 0;
    let totalAggs = 0;
    let totalIndices = 0;
    let distinctRoutesObserved = 0;

    if (isDatabaseConnected()) {
      try {
        totalRaw = await RawObservation.countDocuments(envFilter);
        eligibleRaw = await RawObservation.countDocuments({ ...envFilter, 'quality.indexEligible': true });
        flaggedRaw = await RawObservation.countDocuments({ ...envFilter, 'quality.flags.0': { $exists: true } });
        internationalCount = await RawObservation.countDocuments({ ...envFilter, 'quality.flags': 'INTERNATIONAL_ROUTE' });
        roundTripCount = await RawObservation.countDocuments({ ...envFilter, 'quality.flags': 'ROUND_TRIP' });
        missingPriceCount = await RawObservation.countDocuments({ ...envFilter, 'quality.flags': 'PRICE_UNAVAILABLE' });
        unknownCurrencyCount = await RawObservation.countDocuments({ ...envFilter, 'quality.flags': 'UNKNOWN_CURRENCY' });

        totalAggs = await DailyRouteAggregation.countDocuments(envFilter);
        totalIndices = await AirfareIndex.countDocuments(envFilter);

        const routes = await DailyRouteAggregation.distinct('routeKey', envFilter);
        distinctRoutesObserved = (routes || []).length;
      } catch (err) {
        logger.warn('Error fetching observability summary from MongoDB:', { error: err.message });
      }
    }

    const basket = await RouteBasketService.getActiveBasket({ dataEnvironment: dataEnv });
    const configuredCorridors = basket.routes.length;
    const routeCoveragePct = configuredCorridors > 0
      ? Math.round((distinctRoutesObserved / configuredCorridors) * 10000) / 100
      : 0;

    let qualityScore = null;
    let qualityRationale = 'Quality score unavailable: zero raw observations recorded.';

    if (totalRaw > 0) {
      const eligibilityRate = eligibleRaw / totalRaw;
      const coverageRate = Math.min(distinctRoutesObserved / Math.max(configuredCorridors, 1), 1.0);
      const rawScore = eligibilityRate * 60 + coverageRate * 40;
      qualityScore = Math.round(rawScore * 10) / 10;
      qualityRationale = `Calculated from ${Math.round(eligibilityRate * 100)}% observation eligibility rate (60% weight) and ${Math.round(coverageRate * 100)}% route coverage rate (40% weight).`;
    }

    return {
      success: true,
      dataEnvironment: dataEnv,
      dataQualityIndex: qualityScore,
      qualityScoreRationale: qualityRationale,
      observations: {
        totalReceived: totalRaw,
        indexEligible: eligibleRaw,
        flaggedWithAnomalies: flaggedRaw,
        triageBreakdown: {
          internationalExcluded: internationalCount,
          roundTripsExcluded: roundTripCount,
          missingPricesExcluded: missingPriceCount,
          unknownCurrenciesExcluded: unknownCurrencyCount,
        },
      },
      coverage: {
        configuredCorridors,
        activeObservedCorridors: distinctRoutesObserved,
        routeCoveragePercentage: routeCoveragePct,
        aggregationsStored: totalAggs,
        indexRecordsStored: totalIndices,
      },
    };
  }
}
