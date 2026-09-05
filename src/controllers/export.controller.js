import { TemporalAggregationService } from '../services/temporalAggregation.service.js';
import { SectorAnalyticsService } from '../services/sectorAnalytics.service.js';
import { LeadTimeAnalyticsService } from '../services/leadTimeAnalytics.service.js';
import { BacktestingService } from '../services/backtesting.service.js';
import { logger } from '../utils/logger.js';

function normalizeBucket(bucket) {
  if (!bucket || typeof bucket !== 'string') return null;
  return bucket.trim().replace(/\s+/, '+').toUpperCase();
}

export async function exportIndexData(req, res) {
  try {
    const { freq = 'daily', startDate, endDate, leadTimeBucket = 'T+7', dataEnvironment, dataMode, format = 'csv' } = req.query;
    const dataEnv = (dataEnvironment || dataMode || 'REAL').toUpperCase();
    const bucket = normalizeBucket(leadTimeBucket) || 'T+7';

    const data = await TemporalAggregationService.getAggregatedSeries({
      frequency: freq,
      startDate,
      endDate,
      leadTimeBucket: bucket,
      dataEnvironment: dataEnv,
    });

    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="airfare_index_${freq}_${timestamp}.json"`);
      res.status(200).json({
        success: true,
        meta: {
          frequency: freq,
          leadTimeBucket: bucket,
          dataEnvironment: dataEnv,
          exportedAt: new Date().toISOString(),
          recordCount: data.length,
          methodologyVersion: '1.0-laspeyres',
        },
        data,
      });
      return;
    }

    // CSV format
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="airfare_index_${freq}_${timestamp}.csv"`);

    let csv = 'period,frequency,leadTimeBucket,indexValue,baseIndex,routeCount,coveragePercent,dataEnvironment\n';
    data.forEach((row) => {
      csv += `${row.period},${row.frequency},${row.leadTimeBucket},${row.indexValue ?? ''},${row.baseIndex},${row.routeCount},${row.coveragePercent},${row.dataEnvironment}\n`;
    });

    res.status(200).send(csv);
  } catch (err) {
    logger.error('Error exporting index data:', { error: err.message });
    res.status(500).json({ status: 'error', message: 'Failed to export index data' });
  }
}

export async function exportHeatmapData(req, res) {
  try {
    const { date, startDate, endDate, leadTimeBucket = 'T+7', dataEnvironment, dataMode, format = 'csv' } = req.query;
    const dataEnv = (dataEnvironment || dataMode || 'REAL').toUpperCase();
    const bucket = normalizeBucket(leadTimeBucket) || 'T+7';

    const data = await SectorAnalyticsService.getHeatmapData({
      date,
      startDate,
      endDate,
      leadTimeBucket: bucket,
      dataEnvironment: dataEnv,
    });

    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="sector_heatmap_${timestamp}.json"`);
      res.status(200).json({
        success: true,
        meta: {
          dataEnvironment: dataEnv,
          leadTimeBucket: bucket,
          exportedAt: new Date().toISOString(),
          recordCount: data.length,
        },
        data,
      });
      return;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sector_heatmap_${timestamp}.csv"`);

    let csv = 'origin,destination,sector,value,baseValue,changePercent,priceRelative,weight,observationCount,leadTimeBucket,dataEnvironment\n';
    data.forEach((row) => {
      csv += `${row.origin},${row.destination},${row.sector},${row.value ?? ''},${row.baseValue ?? ''},${row.changePercent ?? ''},${row.priceRelative ?? ''},${row.weight},${row.observationCount},${row.leadTimeBucket},${row.dataEnvironment}\n`;
    });

    res.status(200).send(csv);
  } catch (err) {
    logger.error('Error exporting heatmap data:', { error: err.message });
    res.status(500).json({ status: 'error', message: 'Failed to export heatmap data' });
  }
}

export async function exportLeadTimeData(req, res) {
  try {
    const { date, routeKey, dataEnvironment, dataMode, format = 'csv' } = req.query;
    const dataEnv = (dataEnvironment || dataMode || 'REAL').toUpperCase();

    const report = await LeadTimeAnalyticsService.getLeadTimeElasticity({
      date,
      routeKey,
      dataEnvironment: dataEnv,
    });

    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="lead_time_elasticity_${timestamp}.json"`);
      res.status(200).json(report);
      return;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="lead_time_elasticity_${timestamp}.csv"`);

    let csv = 'bucket,days,label,medianFare,meanFare,minFare,maxFare,percentVsT1,observationCount,dataEnvironment\n';
    report.curve.forEach((row) => {
      csv += `${row.bucket},${row.days},"${row.label}",${row.medianFare ?? ''},${row.meanFare ?? ''},${row.minFare ?? ''},${row.maxFare ?? ''},${row.percentVsT1 ?? ''},${row.observationCount},${row.dataEnvironment}\n`;
    });

    res.status(200).send(csv);
  } catch (err) {
    logger.error('Error exporting lead time data:', { error: err.message });
    res.status(500).json({ status: 'error', message: 'Failed to export lead time data' });
  }
}
