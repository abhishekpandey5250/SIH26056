import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { IngestionService } from '../src/services/ingestion.service.js';
import { DailyRouteAggregationService } from '../src/services/dailyRouteAggregation.service.js';
import { AirfareIndexService, calculatePriceRelative } from '../src/services/airfareIndex.service.js';
import { PipelineOrchestratorService } from '../src/services/pipelineOrchestrator.service.js';
import { QualityFlag } from '../src/types/scraper.types.js';

describe('Step 5 & 6: Real Scraper Data Pipeline & Imperfection Triage', () => {
  describe('1. Real Scraper Imperfection Handling & Triage Rules', () => {
    it('1. Valid one-way domestic INR fare is clean and index-eligible', () => {
      const record = {
        source: 'Air India',
        scraped_at: '2026-09-03T17:42:13.631477+00:00',
        origin: 'DEL',
        destination: 'BLR',
        departure_date: '2026-09-10', // +7 days
        return_date: null,
        trip_type: 'one-way',
        cabin_class: 'economy',
        airline: 'Air India',
        flight_number: 'AI-2803',
        price: 8883,
        currency: 'INR',
      };

      const { observation } = IngestionService.processSingleRecord(record);
      expect(observation).toBeDefined();
      expect(observation.origin).toBe('DEL');
      expect(observation.destination).toBe('BLR');
      expect(observation.fare.observedFare).toBe(8883);
      expect(observation.quality.isValid).toBe(true);
      expect(observation.quality.indexEligible).toBe(true);
      expect(observation.quality.flags).toHaveLength(0);
    });

    it('2. CASE 1: flight_number = "N/A" is normalized to null, flagged MISSING_FLIGHT_NUMBER, but remains index-eligible', () => {
      const record = {
        source: 'Google Flights',
        scraped_at: '2026-09-03T17:42:13.631477+00:00',
        origin: 'DEL',
        destination: 'BOM',
        departure_date: '2026-09-10',
        airline: 'IndiGo',
        flight_number: 'N/A',
        price_raw: '₹5,400',
        currency: 'INR',
      };

      const { observation } = IngestionService.processSingleRecord(record);
      expect(observation).toBeDefined();
      expect(observation.flightNumber).toBeNull();
      expect(observation.quality.flags).toContain(QualityFlag.MISSING_FLIGHT_NUMBER);
      expect(observation.quality.indexEligible).toBe(true); // Non-disqualifying metadata flag
    });

    it('3. CASE 2: price = null is preserved in raw storage with PRICE_UNAVAILABLE and indexEligible = false', () => {
      const record = {
        source: 'MakeMyTrip',
        scraped_at: '2026-09-03T17:42:13.631477+00:00',
        origin: 'DEL',
        destination: 'BOM',
        departure_date: '2026-09-10',
        airline: 'IndiGo',
        flight_number: '6E-205',
        price: null,
        currency: 'INR',
      };

      const { observation } = IngestionService.processSingleRecord(record);
      expect(observation).toBeDefined();
      expect(observation.fare.observedFare).toBeNull();
      expect(observation.quality.flags).toContain(QualityFlag.PRICE_UNAVAILABLE);
      expect(observation.quality.indexEligible).toBe(false);
    });

    it('4. CASE 3: currency = "UNKNOWN" is normalized and flagged UNKNOWN_CURRENCY with indexEligible = false', () => {
      const record = {
        source: 'EaseMyTrip',
        scraped_at: '2026-09-03T17:42:13.631477+00:00',
        origin: 'DEL',
        destination: 'BOM',
        departure_date: '2026-09-10',
        airline: 'IndiGo',
        flight_number: '6E-205',
        price: 5400,
        currency: 'UNKNOWN',
      };

      const { observation } = IngestionService.processSingleRecord(record);
      expect(observation).toBeDefined();
      expect(observation.fare.currency).toBeNull();
      expect(observation.quality.flags).toContain(QualityFlag.UNKNOWN_CURRENCY);
      expect(observation.quality.indexEligible).toBe(false);
    });

    it('5. CASE 4: trip_type = "round-trip" is preserved, flagged ROUND_TRIP, and excluded from one-way CPI index', () => {
      const record = {
        source: 'IndiGo',
        scraped_at: '2026-09-03T17:42:13.631477+00:00',
        origin: 'DEL',
        destination: 'BOM',
        departure_date: '2026-09-10',
        return_date: '2026-09-20',
        trip_type: 'round-trip',
        price: 11000,
        currency: 'INR',
      };

      const { observation } = IngestionService.processSingleRecord(record);
      expect(observation).toBeDefined();
      expect(observation.tripType).toBe('round-trip');
      expect(observation.quality.flags).toContain(QualityFlag.ROUND_TRIP);
      expect(observation.quality.indexEligible).toBe(false);
    });

    it('6. CASE 5: International route (DEL-DXB) is preserved, flagged INTERNATIONAL_ROUTE, and excluded from domestic index', () => {
      const record = {
        source: 'Air India',
        scraped_at: '2026-09-03T17:42:13.631477+00:00',
        origin: 'DEL',
        destination: 'DXB',
        departure_date: '2026-09-10',
        price: 18000,
        currency: 'INR',
      };

      const { observation } = IngestionService.processSingleRecord(record);
      expect(observation).toBeDefined();
      expect(observation.quality.flags).toContain(QualityFlag.INTERNATIONAL_ROUTE);
      expect(observation.quality.indexEligible).toBe(false);
    });

    it('7. CASE 6: Duplicate observation produces identical deterministic SHA-256 deduplication hash', () => {
      const record = {
        source: 'IndiGo',
        scraped_at: '2026-09-03T17:42:13.631477+00:00',
        origin: 'DEL',
        destination: 'BOM',
        departure_date: '2026-09-10',
        airline: 'IndiGo',
        flight_number: '6E-205',
        departure_time: '08:30',
        price: 5400,
        currency: 'INR',
      };

      const obs1 = IngestionService.processSingleRecord(record).observation;
      const obs2 = IngestionService.processSingleRecord({ ...record }).observation;

      expect(obs1.deduplicationHash).toBe(obs2.deduplicationHash);
      expect(obs1.deduplicationHash).toHaveLength(64); // SHA-256 hex string
    });

    it('8 & 9. CASE 7: Multiple flights on same route with multiple airlines or same price are aggregated with median', () => {
      const records = [
        {
          source: 'IndiGo',
          scraped_at: '2026-09-03T06:00:00.000Z',
          origin: 'DEL',
          destination: 'BOM',
          departure_date: '2026-09-10', // T+7
          airline: 'IndiGo',
          flight_number: '6E-101',
          departure_time: '06:00',
          price: 5000,
          currency: 'INR',
        },
        {
          source: 'Air India',
          scraped_at: '2026-09-03T06:00:00.000Z',
          origin: 'DEL',
          destination: 'BOM',
          departure_date: '2026-09-10', // T+7
          airline: 'Air India',
          flight_number: 'AI-202',
          departure_time: '09:00',
          price: 5000, // Same price on different airline flight
          currency: 'INR',
        },
        {
          source: 'Akasa Air',
          scraped_at: '2026-09-03T06:00:00.000Z',
          origin: 'DEL',
          destination: 'BOM',
          departure_date: '2026-09-10', // T+7
          airline: 'Akasa Air',
          flight_number: 'QP-303',
          departure_time: '14:00',
          price: 6500,
          currency: 'INR',
        },
      ];

      const observations = records.map((r) => IngestionService.processSingleRecord(r).observation);
      const aggregations = DailyRouteAggregationService.processObservations(observations, '2026-09-03');

      expect(aggregations).toHaveLength(1);
      const delBom = aggregations[0];
      expect(delBom.routeKey).toBe('DEL-BOM');
      expect(delBom.leadTimeBucket).toBe('T+7');
      expect(delBom.eligibleObservationCount).toBe(3);
      // Median of [5000, 5000, 6500] -> 5000
      expect(delBom.representativeFare).toBe(5000);
      expect(delBom.sourceBreakdown).toEqual({
        IndiGo: 1,
        'Air India': 1,
        'Akasa Air': 1,
      });
    });
  });

  describe('2. Lead-Time Buckets & Mathematical Index Properties', () => {
    it('10. Exact lead times (T+1, T+7, T+15, T+30, T+45) are aggregated independently, non-matching offsets excluded', () => {
      const records = [
        { origin: 'DEL', destination: 'BOM', scraped_at: '2026-09-01T00:00:00.000Z', departure_date: '2026-09-02', price: 9000, currency: 'INR' }, // +1 -> T+1
        { origin: 'DEL', destination: 'BOM', scraped_at: '2026-09-01T00:00:00.000Z', departure_date: '2026-09-08', price: 5000, currency: 'INR' }, // +7 -> T+7
        { origin: 'DEL', destination: 'BOM', scraped_at: '2026-09-01T00:00:00.000Z', departure_date: '2026-09-16', price: 4200, currency: 'INR' }, // +15 -> T+15
        { origin: 'DEL', destination: 'BOM', scraped_at: '2026-09-01T00:00:00.000Z', departure_date: '2026-10-01', price: 3800, currency: 'INR' }, // +30 -> T+30
        { origin: 'DEL', destination: 'BOM', scraped_at: '2026-09-01T00:00:00.000Z', departure_date: '2026-10-16', price: 3500, currency: 'INR' }, // +45 -> T+45
        { origin: 'DEL', destination: 'BOM', scraped_at: '2026-09-01T00:00:00.000Z', departure_date: '2026-09-07', price: 5100, currency: 'INR' }, // +6 -> Non-standard, excluded
      ];

      const observations = records.map((r) => IngestionService.processSingleRecord(r).observation);
      const aggregations = DailyRouteAggregationService.processObservations(observations, '2026-09-01');

      expect(aggregations).toHaveLength(5);
      const buckets = aggregations.map((a) => a.leadTimeBucket);
      expect(buckets).toContain('T+1');
      expect(buckets).toContain('T+7');
      expect(buckets).toContain('T+15');
      expect(buckets).toContain('T+30');
      expect(buckets).toContain('T+45');
    });

    it('11 & 12. Missing route in current period or missing base fare excludes route and renormalizes weights', () => {
      const routeWeights = [
        { routeKey: 'DEL-BOM', origin: 'DEL', destination: 'BOM', weight: 0.5 },
        { routeKey: 'DEL-BLR', origin: 'DEL', destination: 'BLR', weight: 0.3 },
        { routeKey: 'BOM-BLR', origin: 'BOM', destination: 'BLR', weight: 0.2 }, // Missing in current
      ];

      const currentAggregations = [
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4800 },
        { routeKey: 'DEL-BLR', leadTimeBucket: 'T+7', representativeFare: 5500 },
      ];

      const baseAggregations = [
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4000 },
        { routeKey: 'DEL-BLR', leadTimeBucket: 'T+7', representativeFare: 5000 },
        { routeKey: 'BOM-BLR', leadTimeBucket: 'T+7', representativeFare: 6000 },
      ];

      const result = AirfareIndexService.computeBucketIndex({
        indexDate: '2026-09-04',
        leadTimeBucket: 'T+7',
        currentAggregations,
        baseAggregations,
        routeWeights,
      });

      expect(result).toBeDefined();
      expect(result.weightCoverage).toBe(80.0);
      expect(result.routeCount).toBe(2);
      expect(result.routes[0].effectiveWeight).toBe(0.625);
      expect(result.routes[1].effectiveWeight).toBe(0.375);
    });

    it('13. Base = Current fares produces Index = 100.00 and base-relative change = 0.0%', () => {
      const currentAggregations = [
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4000 },
      ];
      const baseAggregations = [
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4000 },
      ];
      const routeWeights = [
        { routeKey: 'DEL-BOM', weight: 1.0 },
      ];

      const indexDoc = AirfareIndexService.computeBucketIndex({
        indexDate: '2026-09-04',
        leadTimeBucket: 'T+7',
        currentAggregations,
        baseAggregations,
        routeWeights,
      });

      expect(indexDoc.indexValue).toBe(100.0);
      expect(indexDoc.baseRelativeChangePercent).toBe(0.0);
    });

    it('14. Price increase (4000 -> 4800) increases index to 120.00 (+20.0%)', () => {
      const relative = calculatePriceRelative(4800, 4000);
      expect(relative).toBe(120.0);
    });

    it('15. Price decrease (5000 -> 4500) decreases index to 90.00 (-10.0%)', () => {
      const relative = calculatePriceRelative(4500, 5000);
      expect(relative).toBe(90.0);
    });
  });

  describe('3. Operational Scraper Telemetry & Pipeline Orchestrator APIs', () => {
    it('16. GET /api/scraper/status returns telemetry structure with ingestion metrics', async () => {
      const res = await request(app).get('/api/scraper/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('observationsReceived');
      expect(res.body).toHaveProperty('observationsStored');
      expect(res.body).toHaveProperty('duplicates');
      expect(res.body).toHaveProperty('indexEligible');
    });

    it('17. POST /api/index/pipeline validates date and triggers daily pipeline', async () => {
      // 1. Invalid date check
      const badRes = await request(app).post('/api/index/pipeline').send({ date: 'invalid' });
      expect(badRes.status).toBe(400);

      // 2. Valid date execution
      const goodRes = await request(app).post('/api/index/pipeline').send({ date: '2026-09-04' });
      expect(goodRes.status).toBe(200);
      expect(goodRes.body.success).toBe(true);
      expect(goodRes.body.collectionDate).toBe('2026-09-04');
      expect(goodRes.body).toHaveProperty('aggregation');
      expect(goodRes.body).toHaveProperty('index');
    });
  });
});
