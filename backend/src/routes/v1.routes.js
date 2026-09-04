import { Router } from 'express';
import {
  getDailyIndexV1,
  getWeeklyIndexV1,
  getMonthlyIndexV1,
  getBasketV1,
  getRoutesV1,
  getHeatmapV1,
  getLeadTimeV1,
  getStatusV1,
} from '../controllers/v1.controller.js';
import {
  runBacktest,
  getBacktestStatus,
  exportBacktest,
} from '../controllers/backtest.controller.js';
import {
  exportIndexData,
  exportHeatmapData,
  exportLeadTimeData,
} from '../controllers/export.controller.js';
import { PipelineSchedulerService } from '../services/pipelineScheduler.service.js';

const router = Router();

// 1. Index Temporal Series
router.get('/index/daily', getDailyIndexV1);
router.get('/index/weekly', getWeeklyIndexV1);
router.get('/index/monthly', getMonthlyIndexV1);
router.get('/index/routes', getRoutesV1);
router.get('/index/basket', getBasketV1);
router.get('/basket', getBasketV1);

// 2. Advanced Analytics
router.get('/analytics/heatmap', getHeatmapV1);
router.get('/analytics/lead-time', getLeadTimeV1);

// 3. Validation & Backtesting
router.get('/backtest/30-day', runBacktest);
router.get('/backtest/status', getBacktestStatus);

// 4. Observability & Telemetry
router.get('/status', getStatusV1);
router.get('/pipeline/status', async (req, res) => {
  const status = await PipelineSchedulerService.getSchedulerStatus(req.query);
  res.status(200).json(status);
});
router.get('/pipeline/history', async (req, res) => {
  const history = await PipelineSchedulerService.getRunHistory(req.query);
  res.status(200).json(history);
});

// 5. Universal Exports
router.get('/export/index', exportIndexData);
router.get('/export/heatmap', exportHeatmapData);
router.get('/export/lead-time', exportLeadTimeData);
router.get('/export/backtest', exportBacktest);

export default router;
