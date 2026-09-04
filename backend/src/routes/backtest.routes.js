import { Router } from 'express';
import {
  runBacktest,
  getBacktestStatus,
  exportBacktest,
} from '../controllers/backtest.controller.js';

const router = Router();

// GET /api/backtest/status - Dataset availability & overlapping range readiness
router.get('/status', getBacktestStatus);

// GET /api/backtest/30-day - 30-day (or customized) backtest comparison
router.get('/30-day', runBacktest);

// GET /api/backtest - General date-range backtest
router.get('/', runBacktest);

// GET /api/backtest/30-day/export & /export - Export backtest time-series as CSV or JSON
router.get('/30-day/export', exportBacktest);
router.get('/export', exportBacktest);

export default router;
