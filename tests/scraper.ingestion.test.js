import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { config } from '../src/config/env.js';
import { IngestionService } from '../src/services/ingestion.service.js';
import { QualityFlag } from '../src/types/scraper.types.js';
import {
  validRecordIndigo,
  validRecordAirIndia,
  nullPriceRecord,
  unknownCurrencyRecord,
  missingFlightNumberRecord,
  internationalRouteRecord,
  roundTripRecord,
} from './fixtures/scraperData.js';

describe('Scraper Ingestion & Raw Observation Layer (JavaScript)', () => {
  const TEST_API_KEY = 'test_secret_key_123';

  beforeEach(() => {
    vi.restoreAllMocks();
    config.scraperApiKey = TEST_API_KEY;
  });

  describe('Single Record Normalization & Validation', () => {
    it('1. should normalize and validate a normal valid observation as index-eligible', () => {
      const { observation, error } = IngestionService.processSingleRecord(validRecordIndigo);

      expect(error).toBeUndefined();
      expect(observation).toBeDefined();
      expect(observation.origin).toBe('DEL');
      expect(observation.destination).toBe('LKO');
      expect(observation.fare.observedFare).toBe(7890);
      expect(observation.fare.currency).toBe('INR');
      expect(observation.flightNumber).toBe('6E 2134');
      expect(observation.quality.isValid).toBe(true);
      expect(observation.quality.indexEligible).toBe(true);
      expect(observation.quality.flags).toEqual([]);
      expect(observation.deduplicationHash).toBeDefined();
      expect(observation.rawPayload).toEqual(validRecordIndigo);
    });

    it('2. should mark records with price = null as valid database records but NOT index-eligible', () => {
      const { observation } = IngestionService.processSingleRecord(nullPriceRecord);

      expect(observation).toBeDefined();
      expect(observation.fare.observedFare).toBeNull();
      expect(observation.quality.isValid).toBe(true);
      expect(observation.quality.indexEligible).toBe(false);
      expect(observation.quality.flags).toContain(QualityFlag.PRICE_UNAVAILABLE);
    });

    it('3. should mark currency = UNKNOWN as valid database record but NOT index-eligible', () => {
      const { observation } = IngestionService.processSingleRecord(unknownCurrencyRecord);

      expect(observation).toBeDefined();
      expect(observation.fare.currency).toBeNull();
      expect(observation.quality.isValid).toBe(true);
      expect(observation.quality.indexEligible).toBe(false);
      expect(observation.quality.flags).toContain(QualityFlag.UNKNOWN_CURRENCY);
    });

    it('4. should normalize flight_number = N/A to null, flag MISSING_FLIGHT_NUMBER, but keep index-eligible', () => {
      const { observation } = IngestionService.processSingleRecord(missingFlightNumberRecord);

      expect(observation).toBeDefined();
      expect(observation.flightNumber).toBeNull();
      expect(observation.quality.isValid).toBe(true);
      expect(observation.quality.indexEligible).toBe(true);
      expect(observation.quality.flags).toContain(QualityFlag.MISSING_FLIGHT_NUMBER);
    });

    it('5. should preserve international routes in raw observation with INTERNATIONAL_ROUTE flag and indexEligible = false', () => {
      const { observation } = IngestionService.processSingleRecord(internationalRouteRecord);

      expect(observation).toBeDefined();
      expect(observation.destination).toBe('DXB');
      expect(observation.quality.isValid).toBe(true);
      expect(observation.quality.indexEligible).toBe(false);
      expect(observation.quality.flags).toContain(QualityFlag.INTERNATIONAL_ROUTE);
    });

    it('6. should preserve round-trip records without dividing fare, flag ROUND_TRIP and indexEligible = false', () => {
      const { observation } = IngestionService.processSingleRecord(roundTripRecord);

      expect(observation).toBeDefined();
      expect(observation.fare.observedFare).toBe(11500);
      expect(observation.tripType).toBe('round-trip');
      expect(observation.returnDate).toBe('2026-10-03');
      expect(observation.quality.isValid).toBe(true);
      expect(observation.quality.indexEligible).toBe(false);
      expect(observation.quality.flags).toContain(QualityFlag.ROUND_TRIP);
    });
  });

  describe('Batch Ingestion Endpoint (POST /api/scraper/fares/batch)', () => {
    it('7. should process a batch with a malformed record without failing the entire batch', async () => {
      const payload = {
        observations: [
          validRecordIndigo,
          'NOT_A_VALID_OBJECT_CORRUPTED_STRING',
          validRecordAirIndia,
        ],
      };

      const response = await request(app)
        .post('/api/scraper/fares/batch')
        .set('X-SCRAPER-API-KEY', TEST_API_KEY)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(3);
      expect(response.body.stored).toBe(2);
      expect(response.body.rejected).toBe(1);
      expect(response.body.indexEligible).toBe(2);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0].index).toBe(1);
    });

    it('8. should successfully process multiple valid records in an array', async () => {
      const payload = {
        observations: [validRecordIndigo, validRecordAirIndia],
      };

      const response = await request(app)
        .post('/api/scraper/fares/batch')
        .set('X-SCRAPER-API-KEY', TEST_API_KEY)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(2);
      expect(response.body.stored).toBe(2);
      expect(response.body.rejected).toBe(0);
      expect(response.body.indexEligible).toBe(2);
    });

    it('9. should handle duplicate records deterministically with identical hashes', async () => {
      const payload = {
        observations: [validRecordIndigo, validRecordIndigo],
      };

      const { observation: obs1 } = IngestionService.processSingleRecord(validRecordIndigo);
      const { observation: obs2 } = IngestionService.processSingleRecord(validRecordIndigo);

      expect(obs1.deduplicationHash).toBe(obs2.deduplicationHash);

      const response = await request(app)
        .post('/api/scraper/fares/batch')
        .set('X-SCRAPER-API-KEY', TEST_API_KEY)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(2);
    });

    it('10. should reject requests with an invalid API key with 401 Unauthorized', async () => {
      const response = await request(app)
        .post('/api/scraper/fares/batch')
        .set('X-SCRAPER-API-KEY', 'incorrect_wrong_key')
        .send({ observations: [validRecordIndigo] });

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Unauthorized');
    });

    it('11. should reject requests with a missing API key with 401 Unauthorized', async () => {
      const response = await request(app)
        .post('/api/scraper/fares/batch')
        .send({ observations: [validRecordIndigo] });

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });

    it('12. should return 400 Bad Request when observations batch is empty', async () => {
      const response = await request(app)
        .post('/api/scraper/fares/batch')
        .set('X-SCRAPER-API-KEY', TEST_API_KEY)
        .send({ observations: [] });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('cannot be empty');
    });

    it('13. should return 400 Bad Request when request body is malformed JSON', async () => {
      const response = await request(app)
        .post('/api/scraper/fares/batch')
        .set('X-SCRAPER-API-KEY', TEST_API_KEY)
        .set('Content-Type', 'application/json')
        .send('{ invalid json');

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Malformed JSON payload in request body');
    });

    it('14. should accurately calculate indexEligible and flagged metrics on a mixed batch', async () => {
      const mixedBatch = [
        validRecordIndigo,
        nullPriceRecord,
        unknownCurrencyRecord,
        missingFlightNumberRecord,
        internationalRouteRecord,
        roundTripRecord,
      ];

      const response = await request(app)
        .post('/api/scraper/fares/batch')
        .set('X-SCRAPER-API-KEY', TEST_API_KEY)
        .send({ observations: mixedBatch });

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(6);
      expect(response.body.rejected).toBe(0);
      expect(response.body.indexEligible).toBe(2);
      expect(response.body.flagged).toBe(5);
    });
  });
});
