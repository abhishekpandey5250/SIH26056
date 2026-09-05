import { Router } from 'express';
import {
  triggerDailyAggregation,
  getDailyAggregations,
} from '../controllers/aggregation.controller.js';
import {
  calculateAirfareIndex,
  executeDailyPipeline,
  getLatestAirfareIndices,
  getHistoricalAirfareIndices,
  getPipelineDiagnosticStatus,
} from '../controllers/indexEngine.controller.js';

const router = Router();

// 1. Route Aggregation Endpoints
// POST /api/index/aggregate - Trigger daily aggregation for a calendar date
router.post('/aggregate', triggerDailyAggregation);

// GET /api/index/aggregations - Retrieve stored daily route aggregations
router.get('/aggregations', getDailyAggregations);

// 2. Statistical Index Engine Endpoints
// POST /api/index/calculate - Trigger Airfare Price Index calculation for date/bucket
router.post('/calculate', calculateAirfareIndex);

// POST /api/index/pipeline - Execute full daily statistical pipeline (Aggregation + Index)
router.post('/pipeline', executeDailyPipeline);

// GET /api/index/pipeline/status - Diagnostic readiness and collection counts
router.get('/pipeline/status', getPipelineDiagnosticStatus);

// GET /api/index/latest - Get latest index across all 5 lead-time windows
router.get('/latest', getLatestAirfareIndices);

// GET /api/index/history - Get historical index time-series
router.get('/history', getHistoricalAirfareIndices);

export default router;
