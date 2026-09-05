import { DailyRouteAggregationService } from '../services/dailyRouteAggregation.service.js';
import { getCalendarDateString } from '../utils/dateUtils.js';
import { logger } from '../utils/logger.js';

/**
 * Controller to trigger daily route aggregation for a specific date.
 */
export async function triggerDailyAggregation(req, res) {
  const { date, cabinClass, currency } = req.body || {};

  if (!date || typeof date !== 'string') {
    res.status(400).json({
      status: 'error',
      message: 'A valid date string (YYYY-MM-DD) is required in the request body',
    });
    return;
  }

  const canonicalDate = getCalendarDateString(date);
  if (!canonicalDate) {
    res.status(400).json({
      status: 'error',
      message: `Invalid date format: "${date}". Expected format is YYYY-MM-DD`,
    });
    return;
  }

  try {
    const report = await DailyRouteAggregationService.aggregateForDate(canonicalDate, {
      targetCabin: cabinClass,
      targetCurrency: currency,
    });

    res.status(200).json(report);
  } catch (err) {
    logger.error('Error during daily route aggregation execution:', { error: err.message });
    res.status(500).json({
      status: 'error',
      message: `Failed to execute daily aggregation: ${err.message}`,
    });
  }
}

/**
 * Controller to query stored daily route aggregations.
 */
export async function getDailyAggregations(req, res) {
  try {
    const { date, route, bucket, origin, destination } = req.query;

    const filter = {
      date,
      routeKey: route,
      leadTimeBucket: bucket,
      origin,
      destination,
    };

    const aggregations = await DailyRouteAggregationService.getAggregations(filter);

    res.status(200).json({
      success: true,
      count: aggregations.length,
      data: aggregations,
    });
  } catch (err) {
    logger.error('Error retrieving daily route aggregations:', { error: err.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve daily aggregations',
    });
  }
}
