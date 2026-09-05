import { IngestionService } from '../services/ingestion.service.js';
import { PipelineOrchestratorService } from '../services/pipelineOrchestrator.service.js';
import { logger } from '../utils/logger.js';

export async function ingestFaresBatch(req, res) {
  let records = [];

  if (Array.isArray(req.body)) {
    records = req.body;
  } else if (req.body && typeof req.body === 'object' && Array.isArray(req.body.observations)) {
    records = req.body.observations;
  } else {
    res.status(400).json({
      status: 'error',
      message: 'Observations payload must be an array or an object containing an "observations" array',
    });
    return;
  }

  if (records.length === 0) {
    res.status(400).json({
      status: 'error',
      message: 'Observations batch cannot be empty',
    });
    return;
  }

  try {
    const result = await IngestionService.ingestBatch(records);
    res.status(200).json(result);
  } catch (err) {
    logger.error('Unexpected failure during batch ingestion:', { error: err.message });
    res.status(500).json({
      status: 'error',
      message: 'Internal error while processing fare observations batch',
    });
  }
}

/**
 * Returns operational ingestion monitoring and pipeline statistics.
 */
export async function getScraperStatus(req, res) {
  try {
    const ingestionStatus = await IngestionService.getIngestionStatus();
    const pipelineStatus = PipelineOrchestratorService.getPipelineStatus();

    res.status(200).json({
      ...ingestionStatus,
      pipeline: pipelineStatus,
    });
  } catch (err) {
    logger.error('Error fetching scraper operational status:', { error: err.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve scraper ingestion status',
    });
  }
}
