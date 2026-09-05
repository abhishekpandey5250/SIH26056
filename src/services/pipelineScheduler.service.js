import crypto from 'crypto';
import { PipelineRun } from '../models/PipelineRun.js';
import { PipelineOrchestratorService } from './pipelineOrchestrator.service.js';
import { getCalendarDateString } from '../utils/dateUtils.js';
import { isDatabaseConnected } from '../config/database.js';
import { logger } from '../utils/logger.js';

let isPipelineRunning = false;
let schedulerTimer = null;

export class PipelineSchedulerService {
  /**
   * Executes a tracked pipeline execution and records results in PipelineRun.
   */
  static async executeTrackedRun({
    collectionDate,
    dataEnvironment = 'REAL',
    cabinClass = 'economy',
    currency = 'INR',
  }) {
    if (isPipelineRunning) {
      throw new Error('Another pipeline execution is currently in progress. Please wait for it to complete.');
    }

    const canonicalDate = getCalendarDateString(collectionDate) || new Date().toISOString().split('T')[0];
    const dataEnv = (dataEnvironment || 'REAL').toUpperCase();
    const runId = `RUN-${canonicalDate}-${dataEnv}-${crypto.randomBytes(4).toString('hex')}`;
    const startTime = Date.now();

    isPipelineRunning = true;
    let runDoc = null;

    if (isDatabaseConnected()) {
      try {
        runDoc = await PipelineRun.create({
          runId,
          collectionDate: canonicalDate,
          dataEnvironment: dataEnv,
          status: 'RUNNING',
          startedAt: new Date(startTime),
        });
      } catch (err) {
        logger.warn('Could not initialize PipelineRun document in DB:', { error: err.message });
      }
    }

    try {
      logger.info(`[PipelineScheduler] Starting run ${runId} for ${canonicalDate} [${dataEnv}]...`);

      const summary = await PipelineOrchestratorService.runDailyPipeline({
        collectionDate: canonicalDate,
        dataEnvironment: dataEnv,
        cabinClass,
        currency,
      });

      const durationMs = Date.now() - startTime;

      if (runDoc && isDatabaseConnected()) {
        await PipelineRun.updateOne(
          { runId },
          {
            $set: {
              status: 'SUCCESS',
              completedAt: new Date(),
              durationMs,
              observationsIngested: summary.aggregation.observationsUsed,
              routesProcessed: summary.aggregation.routesProcessed,
              indexRecordsCreated: summary.index.bucketsCalculated,
              errors: [],
            },
          }
        );
      }

      isPipelineRunning = false;
      return {
        runId,
        ...summary,
        durationMs,
      };
    } catch (err) {
      isPipelineRunning = false;
      const durationMs = Date.now() - startTime;

      if (runDoc && isDatabaseConnected()) {
        await PipelineRun.updateOne(
          { runId },
          {
            $set: {
              status: 'FAILED',
              completedAt: new Date(),
              durationMs,
              errors: [err.message],
            },
          }
        );
      }

      logger.error(`[PipelineScheduler] Run ${runId} failed:`, { error: err.message });
      throw err;
    }
  }

  /**
   * Retrieves pipeline operational status.
   */
  static async getSchedulerStatus(options = {}) {
    const dataEnv = (options.dataEnvironment || options.dataMode || 'REAL').toUpperCase();
    const isEnabled = process.env.PIPELINE_ENABLED === 'true';

    let lastRun = null;
    if (isDatabaseConnected()) {
      try {
        lastRun = await PipelineRun.findOne({ dataEnvironment: dataEnv })
          .sort({ startedAt: -1 })
          .lean();
      } catch (err) {
        logger.warn('Error fetching last PipelineRun:', { error: err.message });
      }
    }

    return {
      success: true,
      schedulerEnabled: isEnabled,
      isCurrentlyRunning: isPipelineRunning,
      dataEnvironment: dataEnv,
      timezone: process.env.PIPELINE_TIMEZONE || 'Asia/Kolkata',
      schedule: process.env.PIPELINE_SCHEDULE || '0 2 * * * (02:00 IST Daily)',
      lastExecution: lastRun || null,
    };
  }

  /**
   * Retrieves recent pipeline run history.
   */
  static async getRunHistory(options = {}) {
    const limit = parseInt(options.limit || '10', 10);
    const dataEnv = (options.dataEnvironment || options.dataMode || 'REAL').toUpperCase();

    if (!isDatabaseConnected()) {
      return { success: true, count: 0, data: [] };
    }

    const runs = await PipelineRun.find({ dataEnvironment: dataEnv })
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();

    return {
      success: true,
      count: runs.length,
      data: runs,
    };
  }
}
