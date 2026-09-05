import { Router } from 'express';
import healthRoutes from './health.routes.js';
import scraperRoutes from './scraper.routes.js';
import aggregationRoutes from './aggregation.routes.js';
import backtestRoutes from './backtest.routes.js';
import v1Routes from './v1.routes.js';
import {
  getDailyIndexV1,
  getWeeklyIndexV1,
  getMonthlyIndexV1,
  getBasketV1,
  getHeatmapV1,
  getLeadTimeV1,
  getStatusV1,
} from '../controllers/v1.controller.js';
import { executeDailyPipeline } from '../controllers/indexEngine.controller.js';
import { PipelineSchedulerService } from '../services/pipelineScheduler.service.js';

const router = Router();

// Health check routes (/api/health)
router.use('/', healthRoutes);

// Scraper ingestion routes (/api/scraper/fares/batch)
router.use('/scraper', scraperRoutes);

// Index aggregation & pipeline routes (/api/index/*)
router.use('/index', aggregationRoutes);

// Direct temporal & basket index routes on /api/index/*
router.get('/index/daily', getDailyIndexV1);
router.get('/index/weekly', getWeeklyIndexV1);
router.get('/index/monthly', getMonthlyIndexV1);
router.get('/index/basket/status', getBasketV1);

// Direct analytics routes on /api/analytics/*
router.get('/analytics/heatmap', getHeatmapV1);
router.get('/analytics/lead-time', getLeadTimeV1);

// Direct pipeline automation routes on /api/pipeline/*
router.post('/pipeline/run', executeDailyPipeline);
router.get('/pipeline/status', async (req, res) => {
  const status = await PipelineSchedulerService.getSchedulerStatus(req.query);
  res.status(200).json(status);
});
router.get('/pipeline/history', async (req, res) => {
  const history = await PipelineSchedulerService.getRunHistory(req.query);
  res.status(200).json(history);
});

// Backtesting & DGCA validation routes (/api/backtest/*)
router.use('/backtest', backtestRoutes);

// Official Versioned API (/api/v1/*) for NSO/RBI Consumption
router.use('/v1', v1Routes);

export default router;
