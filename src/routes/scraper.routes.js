import { Router } from 'express';
import { ingestFaresBatch, getScraperStatus } from '../controllers/scraper.controller.js';
import { requireScraperApiKey } from '../middleware/auth.middleware.js';

const router = Router();

// POST /api/scraper/fares/batch - Ingest batch of flight fare observations (Authenticated)
router.post('/fares/batch', requireScraperApiKey, ingestFaresBatch);

// GET /api/scraper/status - Ingestion monitoring and volume telemetry
router.get('/status', getScraperStatus);

export default router;
