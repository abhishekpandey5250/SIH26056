import { normalizeScraperRecord } from './normalization.service.js';
import { validateObservation } from './validation.service.js';
import { generateDeduplicationHash } from './deduplication.service.js';
import { RawObservation } from '../models/RawObservation.js';
import { isDatabaseConnected } from '../config/database.js';
import { logger } from '../utils/logger.js';

// In-memory telemetry accumulator for runtime monitoring
const ingestionTelemetry = {
  lastScrapeAt: null,
  lastBatchReceivedAt: null,
  lastBatchSize: 0,
  observationsReceived: 0,
  observationsStored: 0,
  duplicates: 0,
  rejected: 0,
  indexEligible: 0,
  flagged: 0,
  lastBatchStatus: 'IDLE',
};

export class IngestionService {
  /**
   * Processes a single raw record into a NormalizedObservation object.
   */
  static processSingleRecord(record, defaultDataEnvironment = null) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return {
        observation: null,
        error: 'Record must be a valid non-null JSON object',
      };
    }

    try {
      const normalized = normalizeScraperRecord(record);
      const dataEnvironment = (
        defaultDataEnvironment ||
        normalized.dataEnvironment ||
        'REAL'
      ).toUpperCase();

      const quality = validateObservation(normalized, record);

      const deduplicationHash = generateDeduplicationHash({
        source: normalized.source,
        origin: normalized.origin,
        destination: normalized.destination,
        departureDate: normalized.departureDate,
        airline: normalized.airline,
        flightNumber: normalized.flightNumber,
        departureTime: normalized.departureTime,
        observedFare: normalized.observedFare,
        scrapedAt: normalized.scrapedAt,
        dataEnvironment,
      });

      const observation = {
        source: normalized.source,
        dataEnvironment,
        scrapedAt: normalized.scrapedAt,
        origin: normalized.origin,
        destination: normalized.destination,
        departureDate: normalized.departureDate,
        returnDate: normalized.returnDate,
        tripType: normalized.tripType,
        cabinClass: normalized.cabinClass,
        passengers: normalized.passengers,
        airline: normalized.airline,
        flightNumber: normalized.flightNumber,
        departureTime: normalized.departureTime,
        arrivalTime: normalized.arrivalTime,
        durationMinutes: normalized.durationMinutes,
        stops: normalized.stops,
        fare: {
          observedFare: normalized.observedFare,
          currency: normalized.currency,
          priceRaw: normalized.priceRaw,
        },
        metadata: {
          searchUrl: normalized.searchUrl,
          co2Emissions: normalized.co2Emissions,
          emissionsVariation: normalized.emissionsVariation,
          rawText: normalized.rawText,
        },
        rawPayload: record,
        quality,
        deduplicationHash,
      };

      return { observation };
    } catch (err) {
      logger.error('Unexpected error during record processing:', { error: err.message });
      return {
        observation: null,
        error: `Failed to process record: ${err.message}`,
      };
    }
  }

  /**
   * Ingests a batch of raw scraper observations.
   */
  static async ingestBatch(records = [], options = {}) {
    const totalReceived = records.length;
    let rejectedCount = 0;
    let flaggedCount = 0;
    let indexEligibleCount = 0;
    const errors = [];
    const validObservations = [];
    let latestScrapeDate = null;

    const defaultDataEnv = (options.dataEnvironment || options.dataMode || 'REAL').toUpperCase();

    // Phase 1: In-memory normalization and validation
    records.forEach((record, index) => {
      const { observation, error } = this.processSingleRecord(record, defaultDataEnv);
      if (!observation) {
        rejectedCount++;
        errors.push({ index, reason: error || 'Malformed record' });
        return;
      }

      if (observation.scrapedAt) {
        if (!latestScrapeDate || observation.scrapedAt > latestScrapeDate) {
          latestScrapeDate = observation.scrapedAt;
        }
      }

      if (observation.quality.flags.length > 0) {
        flaggedCount++;
      }

      if (observation.quality.indexEligible) {
        indexEligibleCount++;
      }

      validObservations.push(observation);
    });

    // Phase 2: Database Persistence
    let storedCount = 0;
    let duplicateCount = 0;

    if (isDatabaseConnected() && validObservations.length > 0) {
      try {
        const bulkOps = validObservations.map((obs) => ({
          updateOne: {
            filter: { deduplicationHash: obs.deduplicationHash },
            update: { $setOnInsert: obs },
            upsert: true,
          },
        }));

        const result = await RawObservation.bulkWrite(bulkOps, { ordered: false });

        storedCount = result.upsertedCount;
        duplicateCount = result.matchedCount;

        logger.info(`Batch stored in MongoDB: ${storedCount} inserted, ${duplicateCount} duplicates skipped.`);
      } catch (err) {
        logger.error('Database write error during batch ingestion:', { error: err.message });
      }
    } else if (!isDatabaseConnected()) {
      storedCount = validObservations.length;
      logger.warn(`MongoDB is disconnected. Processed ${validObservations.length} observations in degraded mode.`);
    }

    // Update cumulative telemetry
    ingestionTelemetry.lastBatchReceivedAt = new Date().toISOString();
    ingestionTelemetry.lastBatchSize = totalReceived;
    ingestionTelemetry.lastBatchStatus = rejectedCount === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS';
    if (latestScrapeDate) {
      ingestionTelemetry.lastScrapeAt = latestScrapeDate.toISOString();
    }
    ingestionTelemetry.observationsReceived += totalReceived;
    ingestionTelemetry.observationsStored += storedCount;
    ingestionTelemetry.duplicates += duplicateCount;
    ingestionTelemetry.rejected += rejectedCount;
    ingestionTelemetry.indexEligible += indexEligibleCount;
    ingestionTelemetry.flagged += flaggedCount;

    return {
      success: true,
      received: totalReceived,
      stored: storedCount,
      duplicates: duplicateCount,
      rejected: rejectedCount,
      indexEligible: indexEligibleCount,
      flagged: flaggedCount,
      dataEnvironment: defaultDataEnv,
      ...(errors.length > 0 ? { errors } : {}),
    };
  }

  /**
   * Retrieves operational ingestion telemetry and database observation counts.
   */
  static async getIngestionStatus(options = {}) {
    const targetDataEnv = (options.dataEnvironment || options.dataMode || process.env.DATA_MODE || 'REAL').toUpperCase();
    let dbStoredCount = ingestionTelemetry.observationsStored;
    let dbEligibleCount = ingestionTelemetry.indexEligible;
    let latestCollectionDate = null;

    if (isDatabaseConnected()) {
      try {
        const filter = targetDataEnv === 'ALL' ? {} : { dataEnvironment: targetDataEnv };
        dbStoredCount = await RawObservation.countDocuments(filter);
        dbEligibleCount = await RawObservation.countDocuments({ ...filter, 'quality.indexEligible': true });

        const latestObs = await RawObservation.findOne(filter).sort({ scrapedAt: -1 }).select('scrapedAt').lean();
        if (latestObs && latestObs.scrapedAt) {
          latestCollectionDate = new Date(latestObs.scrapedAt).toISOString().split('T')[0];
        }
      } catch (err) {
        logger.warn('Could not query raw observation counts from MongoDB:', { error: err.message });
      }
    }

    return {
      success: true,
      dataMode: targetDataEnv,
      lastScrapeAt: ingestionTelemetry.lastScrapeAt,
      lastBatchReceivedAt: ingestionTelemetry.lastBatchReceivedAt,
      lastBatchSize: ingestionTelemetry.lastBatchSize,
      lastBatchStatus: ingestionTelemetry.lastBatchStatus,
      latestCollectionDate,
      observationsReceived: ingestionTelemetry.observationsReceived,
      observationsStored: dbStoredCount,
      duplicates: ingestionTelemetry.duplicates,
      rejected: ingestionTelemetry.rejected,
      indexEligible: dbEligibleCount,
      flagged: ingestionTelemetry.flagged,
    };
  }
}
