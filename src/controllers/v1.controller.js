import { TemporalAggregationService } from '../services/temporalAggregation.service.js';
import { RouteBasketService } from '../services/routeBasket.service.js';
import { SectorAnalyticsService } from '../services/sectorAnalytics.service.js';
import { LeadTimeAnalyticsService } from '../services/leadTimeAnalytics.service.js';
import { BacktestingService } from '../services/backtesting.service.js';
import { PipelineSchedulerService } from '../services/pipelineScheduler.service.js';
import { ObservabilityService } from '../services/observability.service.js';
import { DailyRouteAggregationService } from '../services/dailyRouteAggregation.service.js';
import { logger } from '../utils/logger.js';

function normalizeBucket(bucket) {
  if (!bucket || typeof bucket !== 'string') return null;
  return bucket.trim().replace(/\s+/, '+').toUpperCase();
}

export async function getDailyIndexV1(req, res) {
  try {
    const { startDate, endDate, leadTimeBucket, dataEnvironment, dataMode } = req.query;
    const dataEnv = (dataEnvironment || dataMode || 'REAL').toUpperCase();
    const bucket = normalizeBucket(leadTimeBucket) || 'T+7';

    const data = await TemporalAggregationService.getAggregatedSeries({
      frequency: 'daily',
      startDate,
      endDate,
      leadTimeBucket: bucket,
      dataEnvironment: dataEnv,
    });

    res.status(200).json({
      success: true,
      meta: {
        frequency: 'daily',
        leadTimeBucket: bucket,
        dataEnvironment: dataEnv,
        generatedAt: new Date().toISOString(),
        recordCount: data.length,
        source: 'MoSPI SIH26056 Index Engine v1.0',
      },
      data,
    });
  } catch (err) {
    logger.error('v1 getDailyIndex error:', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getWeeklyIndexV1(req, res) {
  try {
    const { startDate, endDate, leadTimeBucket, dataEnvironment, dataMode } = req.query;
    const dataEnv = (dataEnvironment || dataMode || 'REAL').toUpperCase();
    const bucket = normalizeBucket(leadTimeBucket) || 'T+7';

    const data = await TemporalAggregationService.getAggregatedSeries({
      frequency: 'weekly',
      startDate,
      endDate,
      leadTimeBucket: bucket,
      dataEnvironment: dataEnv,
    });

    res.status(200).json({
      success: true,
      meta: {
        frequency: 'weekly',
        leadTimeBucket: bucket,
        dataEnvironment: dataEnv,
        generatedAt: new Date().toISOString(),
        recordCount: data.length,
        source: 'MoSPI SIH26056 Index Engine v1.0',
      },
      data,
    });
  } catch (err) {
    logger.error('v1 getWeeklyIndex error:', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getMonthlyIndexV1(req, res) {
  try {
    const { startDate, endDate, leadTimeBucket, dataEnvironment, dataMode } = req.query;
    const dataEnv = (dataEnvironment || dataMode || 'REAL').toUpperCase();
    const bucket = normalizeBucket(leadTimeBucket) || 'T+7';

    const data = await TemporalAggregationService.getAggregatedSeries({
      frequency: 'monthly',
      startDate,
      endDate,
      leadTimeBucket: bucket,
      dataEnvironment: dataEnv,
    });

    res.status(200).json({
      success: true,
      meta: {
        frequency: 'monthly',
        leadTimeBucket: bucket,
        dataEnvironment: dataEnv,
        generatedAt: new Date().toISOString(),
        recordCount: data.length,
        source: 'MoSPI SIH26056 Index Engine v1.0',
      },
      data,
    });
  } catch (err) {
    logger.error('v1 getMonthlyIndex error:', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getBasketV1(req, res) {
  try {
    const { dataEnvironment, dataMode } = req.query;
    const basket = await RouteBasketService.getBasketStatus({
      dataEnvironment: dataEnvironment || dataMode,
    });
    res.status(200).json(basket);
  } catch (err) {
    logger.error('v1 getBasket error:', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getRoutesV1(req, res) {
  try {
    const { date, leadTimeBucket, dataEnvironment, dataMode } = req.query;
    const bucket = normalizeBucket(leadTimeBucket);
    const data = await DailyRouteAggregationService.getAggregations({
      date,
      leadTimeBucket: bucket,
      dataEnvironment: dataEnvironment || dataMode,
    });
    res.status(200).json({
      success: true,
      meta: {
        recordCount: data.length,
        dataEnvironment: (dataEnvironment || dataMode || 'REAL').toUpperCase(),
        generatedAt: new Date().toISOString(),
      },
      data,
    });
  } catch (err) {
    logger.error('v1 getRoutes error:', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getHeatmapV1(req, res) {
  try {
    const { date, startDate, endDate, leadTimeBucket, dataEnvironment, dataMode } = req.query;
    const bucket = normalizeBucket(leadTimeBucket) || 'T+7';
    const data = await SectorAnalyticsService.getHeatmapData({
      date,
      startDate,
      endDate,
      leadTimeBucket: bucket,
      dataEnvironment: dataEnvironment || dataMode,
    });
    res.status(200).json({
      success: true,
      meta: {
        sectorCount: data.length,
        leadTimeBucket: bucket,
        dataEnvironment: (dataEnvironment || dataMode || 'REAL').toUpperCase(),
        generatedAt: new Date().toISOString(),
      },
      data,
    });
  } catch (err) {
    logger.error('v1 getHeatmap error:', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getLeadTimeV1(req, res) {
  try {
    const { date, routeKey, dataEnvironment, dataMode } = req.query;
    const report = await LeadTimeAnalyticsService.getLeadTimeElasticity({
      date,
      routeKey,
      dataEnvironment: dataEnvironment || dataMode,
    });
    res.status(200).json(report);
  } catch (err) {
    logger.error('v1 getLeadTime error:', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getStatusV1(req, res) {
  try {
    const { dataEnvironment, dataMode } = req.query;
    const summary = await ObservabilityService.getObservabilitySummary({
      dataEnvironment: dataEnvironment || dataMode,
    });
    res.status(200).json(summary);
  } catch (err) {
    logger.error('v1 getStatus error:', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}
