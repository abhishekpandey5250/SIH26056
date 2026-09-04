import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to authenticate scraper requests using the X-SCRAPER-API-KEY header.
 */
export function requireScraperApiKey(req, res, next) {
  const providedKey = req.header('X-SCRAPER-API-KEY') || req.header('x-scraper-api-key');
  const configuredKey = config.scraperApiKey;

  if (configuredKey) {
    if (!providedKey || providedKey !== configuredKey) {
      logger.warn(`Unauthorized scraper API attempt from IP: ${req.ip}`);
      res.status(401).json({
        status: 'error',
        message: 'Unauthorized: Invalid or missing Scraper API Key',
      });
      return;
    }
  } else {
    logger.warn('SCRAPER_API_KEY is not configured in environment variables. Running in permissive auth mode.');
  }

  next();
}
