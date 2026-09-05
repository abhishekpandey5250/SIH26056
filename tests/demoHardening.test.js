import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { IngestionService } from '../src/services/ingestion.service.js';
import { DailyRouteAggregationService } from '../src/services/dailyRouteAggregation.service.js';
import { AirfareIndexService, calculatePriceRelative } from '../src/services/airfareIndex.service.js';
import { PipelineOrchestratorService } from '../src/services/pipelineOrchestrator.service.js';
import { QualityFlag } from '../src/types/scraper.types.js';

describe('Phase G: Demo Hardening & Reliability Tests', () => {
  const fullScraperRecord = {
    source: 'IndiGo',
    scraped_at: '2026-09-04T06:22:33.793390+00:00',
    origin: 'DEL',
    destination: 'BOM',
    departure_date: '2026-09-11',
    return_date: null,
    trip_type: 'one-way',
    cabin_class: 'economy',
    passengers: 1,
    airline: 'IndiGo',
    flight_number: '6E-205',
    departure_time: '08:30',
    arrival_time: '10:45',
    duration: '2 hr 15 min',
    duration_minutes: 135,
    stops: 0,
    price: 5400,
    currency: 'INR',
    price_raw: '₹5,400',
    search_url: 'https://...',
    co2_emissions: '43 kg CO2',
  };

  it('1. Real scraper payload format is fully accepted and parsed', () => {
    const { observation, error } = IngestionService.processSingleRecord(fullScraperRecord);
    expect(error).toBeUndefined();
    expect(observation).toBeDefined();
    expect(observation.origin).toBe('DEL');
    expect(observation.destination).toBe('BOM');
    expect(observation.fare.observedFare).toBe(5400);
    expect(observation.durationMinutes).toBe(135);
    expect(observation.metadata.searchUrl).toBe('https://...');
    expect(observation.metadata.co2Emissions).toBe('43 kg CO2');
    expect(observation.quality.indexEligible).toBe(true);
  });

  it('2. Missing optional fields (duration, stops, return_date, co2) are accepted with sane defaults', () => {
    const minimalRecord = {
      source: 'Air India',
      scraped_at: '2026-09-04T06:00:00.000Z',
      origin: 'DEL',
      destination: 'BLR',
      departure_date: '2026-09-11',
      airline: 'Air India',
      price: 6000,
      currency: 'INR',
    };

    const { observation, error } = IngestionService.processSingleRecord(minimalRecord);
    expect(error).toBeUndefined();
    expect(observation).toBeDefined();
    expect(observation.tripType).toBe('one-way');
    expect(observation.cabinClass).toBe('economy');
    expect(observation.passengers).toBe(1);
    expect(observation.stops).toBe(0);
    expect(observation.quality.indexEligible).toBe(true);
  });

  it('3. Null price is preserved in raw storage, flagged PRICE_UNAVAILABLE, and disqualified from index', () => {
    const nullPriceRecord = { ...fullScraperRecord, price: null, price_raw: null };
    const { observation } = IngestionService.processSingleRecord(nullPriceRecord);
    expect(observation).toBeDefined();
    expect(observation.fare.observedFare).toBeNull();
    expect(observation.quality.flags).toContain(QualityFlag.PRICE_UNAVAILABLE);
    expect(observation.quality.indexEligible).toBe(false);
  });

  it('4. UNKNOWN currency is normalized to null, flagged UNKNOWN_CURRENCY, and disqualified from index', () => {
    const badCurrencyRecord = { ...fullScraperRecord, currency: 'UNKNOWN' };
    const { observation } = IngestionService.processSingleRecord(badCurrencyRecord);
    expect(observation).toBeDefined();
    expect(observation.fare.currency).toBeNull();
    expect(observation.quality.flags).toContain(QualityFlag.UNKNOWN_CURRENCY);
    expect(observation.quality.indexEligible).toBe(false);
  });

  it('5. N/A flight number is normalized to null, flagged MISSING_FLIGHT_NUMBER, but remains index eligible', () => {
    const naFlightRecord = { ...fullScraperRecord, flight_number: 'N/A' };
    const { observation } = IngestionService.processSingleRecord(naFlightRecord);
    expect(observation).toBeDefined();
    expect(observation.flightNumber).toBeNull();
    expect(observation.quality.flags).toContain(QualityFlag.MISSING_FLIGHT_NUMBER);
    expect(observation.quality.indexEligible).toBe(true);
  });

  it('6. Duplicate payload generates deterministic SHA-256 hash without double-counting', () => {
    const obs1 = IngestionService.processSingleRecord(fullScraperRecord).observation;
    const obs2 = IngestionService.processSingleRecord({ ...fullScraperRecord }).observation;
    expect(obs1.deduplicationHash).toBe(obs2.deduplicationHash);
  });

  it('7. Round-trip observations are preserved in raw storage but excluded from one-way index', () => {
    const rtRecord = { ...fullScraperRecord, trip_type: 'round-trip', return_date: '2026-09-20' };
    const { observation } = IngestionService.processSingleRecord(rtRecord);
    expect(observation.quality.flags).toContain(QualityFlag.ROUND_TRIP);
    expect(observation.quality.indexEligible).toBe(false);
  });

  it('8. International routes (e.g. DEL-DXB) are preserved in raw storage but excluded from domestic index', () => {
    const intlRecord = { ...fullScraperRecord, destination: 'DXB' };
    const { observation } = IngestionService.processSingleRecord(intlRecord);
    expect(observation.quality.flags).toContain(QualityFlag.INTERNATIONAL_ROUTE);
    expect(observation.quality.indexEligible).toBe(false);
  });

  it('9. Exact advance-purchase buckets (T+1, T+7, T+15, T+30, T+45) are preserved, non-exact offsets excluded', () => {
    const recs = [
      { ...fullScraperRecord, departure_date: '2026-09-05' }, // +1 -> T+1
      { ...fullScraperRecord, departure_date: '2026-09-11' }, // +7 -> T+7
      { ...fullScraperRecord, departure_date: '2026-09-19' }, // +15 -> T+15
      { ...fullScraperRecord, departure_date: '2026-10-04' }, // +30 -> T+30
      { ...fullScraperRecord, departure_date: '2026-10-19' }, // +45 -> T+45
      { ...fullScraperRecord, departure_date: '2026-09-10' }, // +6 -> Disqualified
    ];

    const observations = recs.map((r) => IngestionService.processSingleRecord(r).observation);
    const aggregations = DailyRouteAggregationService.processObservations(observations, '2026-09-04');

    expect(aggregations).toHaveLength(5);
    const bucketNames = aggregations.map((a) => a.leadTimeBucket);
    expect(bucketNames).toEqual(['T+1', 'T+7', 'T+15', 'T+30', 'T+45']);
  });

  it('10. Daily pipeline executes aggregation before index calculation and returns summary', async () => {
    const summary = await PipelineOrchestratorService.runDailyPipeline({
      collectionDate: '2026-09-04',
    });

    expect(summary.success).toBe(true);
    expect(summary.collectionDate).toBe('2026-09-04');
    expect(summary).toHaveProperty('aggregation');
    expect(summary).toHaveProperty('index');
  });

  it('11. Re-running pipeline on same collection date is idempotent', async () => {
    const run1 = await PipelineOrchestratorService.runDailyPipeline({ collectionDate: '2026-09-04' });
    const run2 = await PipelineOrchestratorService.runDailyPipeline({ collectionDate: '2026-09-04' });

    expect(run1.success).toBe(true);
    expect(run2.success).toBe(true);
    expect(run1.collectionDate).toBe(run2.collectionDate);
  });

  it('12 & 13. Missing route does not create fake index value, and partial route coverage renormalizes weights', () => {
    const routeWeights = [
      { routeKey: 'DEL-BOM', origin: 'DEL', destination: 'BOM', weight: 0.5 },
      { routeKey: 'DEL-BLR', origin: 'DEL', destination: 'BLR', weight: 0.3 },
      { routeKey: 'BOM-BLR', origin: 'BOM', destination: 'BLR', weight: 0.2 }, // Missing
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

    const indexDoc = AirfareIndexService.computeBucketIndex({
      indexDate: '2026-09-04',
      leadTimeBucket: 'T+7',
      currentAggregations,
      baseAggregations,
      routeWeights,
    });

    expect(indexDoc.weightCoverage).toBe(80.0);
    expect(indexDoc.routeCount).toBe(2);
    // Effective weights: 0.5 / 0.8 = 0.625, 0.3 / 0.8 = 0.375
    // Relative DEL-BOM: 4800/4000 * 100 = 120.0
    // Relative DEL-BLR: 5500/5000 * 100 = 110.0
    // Index: 0.625 * 120 + 0.375 * 110 = 75 + 41.25 = 116.25
    expect(indexDoc.indexValue).toBe(116.25);
  });

  it('14. Empty database / collection returns clean empty state without crashing', async () => {
    const res = await request(app).get('/api/index/latest');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('15. Backend health endpoint accurately reports database connectivity without crashing', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('database');
    expect(res.body).toHaveProperty('environment');
  });

  it('16. GET /api/scraper/status returns full telemetry and pipeline status', async () => {
    const res = await request(app).get('/api/scraper/status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('observationsStored');
    expect(res.body).toHaveProperty('pipeline');
    expect(res.body.pipeline).toHaveProperty('status');
  });
});
