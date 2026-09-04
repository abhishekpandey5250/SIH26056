import { BacktestingService } from '../services/backtesting.service.js';
import { getCalendarDateString } from '../utils/dateUtils.js';
import { logger } from '../utils/logger.js';

/**
 * Controller to execute 30-day (or custom date range) backtesting against DGCA reference benchmarks.
 */
export async function runBacktest(req, res) {
  try {
    const { startDate, endDate, leadTimeBucket, dataEnvironment, dataMode } = req.query;

    const dataEnv = (dataEnvironment || dataMode || 'REAL').toUpperCase();
    const bucket = (leadTimeBucket || 'T+7').toUpperCase();

    // Default 30-day window if omitted
    const end = endDate ? getCalendarDateString(endDate) : '2026-08-30';
    const start = startDate ? getCalendarDateString(startDate) : '2026-08-01';

    if (!start || !end) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid startDate or endDate provided. Expected YYYY-MM-DD format.',
      });
      return;
    }

    const report = await BacktestingService.executeBacktest({
      startDate: start,
      endDate: end,
      leadTimeBucket: bucket,
      dataEnvironment: dataEnv,
    });

    res.status(200).json(report);
  } catch (err) {
    logger.error('Error running backtest:', { error: err.message });
    res.status(500).json({
      status: 'error',
      message: `Failed to execute backtest: ${err.message}`,
    });
  }
}

/**
 * Controller to fetch DGCA benchmark availability and readiness status.
 */
export async function getBacktestStatus(req, res) {
  try {
    const { dataEnvironment, dataMode } = req.query;
    const status = await BacktestingService.getBacktestStatus({
      dataEnvironment: dataEnvironment || dataMode,
    });
    res.status(200).json(status);
  } catch (err) {
    logger.error('Error fetching backtest status:', { error: err.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch backtest status',
    });
  }
}

/**
 * Controller to export backtest results in CSV or JSON format.
 */
export async function exportBacktest(req, res) {
  try {
    const { startDate, endDate, leadTimeBucket, dataEnvironment, dataMode, format } = req.query;

    const dataEnv = (dataEnvironment || dataMode || 'REAL').toUpperCase();
    const bucket = (leadTimeBucket || 'T+7').toUpperCase();
    const start = startDate ? getCalendarDateString(startDate) : '2026-08-01';
    const end = endDate ? getCalendarDateString(endDate) : '2026-08-30';

    const report = await BacktestingService.executeBacktest({
      startDate: start,
      endDate: end,
      leadTimeBucket: bucket,
      dataEnvironment: dataEnv,
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="backtest_${start}_${end}.csv"`);

      let csv = 'date,ourIndexValue,dgcaReferenceValue,normalizedOurIndex,normalizedDgcaIndex,isOverlapping\n';
      report.timeSeries.forEach((row) => {
        csv += `${row.date},${row.ourIndexValue ?? ''},${row.dgcaReferenceValue ?? ''},${row.normalizedOurIndex ?? ''},${row.normalizedDgcaIndex ?? ''},${row.isOverlapping}\n`;
      });

      res.status(200).send(csv);
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="backtest_${start}_${end}.json"`);
    res.status(200).json(report);
  } catch (err) {
    logger.error('Error exporting backtest report:', { error: err.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to export backtest report',
    });
  }
}
