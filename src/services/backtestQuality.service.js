import { DEMO_ROUTE_WEIGHTS } from '../config/indexConfig.js';

export class BacktestQualityService {
  /**
   * Generates a comprehensive data quality and audit report for a backtesting run.
   */
  static generateQualityReport({
    dateList = [],
    ourIndexMap = new Map(),
    dgcaMap = new Map(),
    overlappingDays = 0,
    routeComparisons = [],
  }) {
    const totalDatesRequested = dateList.length;
    const missingOurDates = [];
    const missingDgcaDates = [];

    for (const date of dateList) {
      if (!ourIndexMap.has(date)) {
        missingOurDates.push(date);
      }
      if (!dgcaMap.has(date)) {
        missingDgcaDates.push(date);
      }
    }

    const allConfiguredRoutes = DEMO_ROUTE_WEIGHTS.map((rw) => rw.routeKey);
    const matchedRoutes = routeComparisons.map((rc) => rc.routeKey);
    const unmatchedRoutes = allConfiguredRoutes.filter((r) => !matchedRoutes.includes(r));

    const routeCoveragePercent = allConfiguredRoutes.length > 0
      ? Math.round((matchedRoutes.length / allConfiguredRoutes.length) * 10000) / 100
      : 0;

    const warnings = [];
    if (overlappingDays === 0) {
      warnings.push('Zero overlapping dates found between our Airfare Index and the DGCA reference dataset.');
    } else if (overlappingDays < 2) {
      warnings.push('Fewer than 2 overlapping observations: Correlation, MAPE, and statistical variance cannot be computed.');
    } else if (overlappingDays < 30 && totalDatesRequested >= 30) {
      warnings.push(`Incomplete 30-day window: ${overlappingDays} overlapping days available out of ${totalDatesRequested} requested.`);
    }

    if (unmatchedRoutes.length > 0) {
      warnings.push(`Missing DGCA reference benchmark fares for ${unmatchedRoutes.length} corridor(s): ${unmatchedRoutes.join(', ')}.`);
    }

    return {
      totalDatesRequested,
      overlappingDays,
      coveragePercentage: totalDatesRequested > 0
        ? Math.round((overlappingDays / totalDatesRequested) * 10000) / 100
        : 0,
      missingOurDates,
      missingDgcaDates,
      routeQuality: {
        configuredCorridors: allConfiguredRoutes.length,
        matchedCorridors: matchedRoutes.length,
        unmatchedCorridors: unmatchedRoutes,
        routeCoveragePercentage: routeCoveragePercent,
      },
      warnings,
    };
  }
}
