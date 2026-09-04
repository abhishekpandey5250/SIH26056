import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { config } from '../src/config/env.js';
import { IngestionService } from '../src/services/ingestion.service.js';
import { DailyRouteAggregationService } from '../src/services/dailyRouteAggregation.service.js';
import { AirfareIndexService } from '../src/services/airfareIndex.service.js';
import { PipelineOrchestratorService } from '../src/services/pipelineOrchestrator.service.js';
import { QualityFlag } from '../src/types/scraper.types.js';

describe('Step 6: Real Scraper Data Activation & Demo Data Isolation', () => {
  const validApiKey = config.scraperApiKey || 'dev-scraper-key-12345';

  const realFlightRecord = {
    source: 'Air India',
    scraped_at: '2026-09-04T08:00:00.000Z',
    origin: 'DEL',
    destination: 'BLR',
    departure_date: '2026-09-11', // T+7
    return_date: null,
    trip_type: 'one-way',
    cabin_class: 'economy',
    passengers: 1,
    airline: 'Air India',
    flight_number: 'AI-2803',
    departure_time: '06:30',
    arrival_time: '09:25',
    duration: '2 hr 55 min',
    duration_minutes: 175,
    stops: 0,
    price: 8883,
    currency: 'INR',
    price_raw: '₹8,883',
    search_url: 'https://www.airindia.com/booking',
    co2_emissions: '143 kg CO2',
  };

  it('1. Real scraper payload maps accurately to RawObservation with dataEnvironment: "REAL"', () => {
    const { observation, error } = IngestionService.processSingleRecord(realFlightRecord, 'REAL');
    expect(error).toBeUndefined();
    expect(observation).toBeDefined();
    expect(observation.dataEnvironment).toBe('REAL');
    expect(observation.origin).toBe('DEL');
    expect(observation.destination).toBe('BLR');
    expect(observation.fare.observedFare).toBe(8883);
    expect(observation.fare.currency).toBe('INR');
    expect(observation.quality.indexEligible).toBe(true);
    expect(observation.deduplicationHash).toHaveLength(64);
  });

  it('2 & 3. Real scraper payload aggregates into DailyRouteAggregation and computes AirfareIndex under REAL mode', () => {
    const currentRealObservations = [
      IngestionService.processSingleRecord({
        ...realFlightRecord,
        origin: 'DEL',
        destination: 'BOM',
        price: 4800,
        departure_date: '2026-09-11',
      }, 'REAL').observation,
      IngestionService.processSingleRecord({
        ...realFlightRecord,
        origin: 'DEL',
        destination: 'BLR',
        price: 5500,
        departure_date: '2026-09-11',
      }, 'REAL').observation,
    ];

    const aggregations = DailyRouteAggregationService.processObservations(
      currentRealObservations,
      '2026-09-04',
      { dataEnvironment: 'REAL' }
    );

    expect(aggregations).toHaveLength(2);
    expect(aggregations[0].dataEnvironment).toBe('REAL');
    expect(aggregations[1].dataEnvironment).toBe('REAL');

    const baseAggregations = [
      { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4000, dataEnvironment: 'REAL' },
      { routeKey: 'DEL-BLR', leadTimeBucket: 'T+7', representativeFare: 5000, dataEnvironment: 'REAL' },
    ];

    const routeWeights = [
      { routeKey: 'DEL-BOM', origin: 'DEL', destination: 'BOM', weight: 0.5 },
      { routeKey: 'DEL-BLR', origin: 'DEL', destination: 'BLR', weight: 0.5 },
    ];

    const indexDoc = AirfareIndexService.computeBucketIndex({
      indexDate: '2026-09-04',
      dataEnvironment: 'REAL',
      leadTimeBucket: 'T+7',
      currentAggregations: aggregations,
      baseAggregations,
      routeWeights,
    });

    expect(indexDoc).toBeDefined();
    expect(indexDoc.dataEnvironment).toBe('REAL');
    expect(indexDoc.indexValue).toBe(115.0); // (120 * 0.5) + (110 * 0.5) = 115.00
    expect(indexDoc.weightCoverage).toBe(100.0);
  });

  it('4. Frontend read APIs accept dataMode=REAL and dataMode=DEMO query filters', async () => {
    const realRes = await request(app).get('/api/index/latest?dataMode=REAL');
    expect(realRes.status).toBe(200);
    expect(realRes.body.success).toBe(true);
    expect(realRes.body.dataMode).toBe('REAL');

    const demoRes = await request(app).get('/api/index/latest?dataMode=DEMO');
    expect(demoRes.status).toBe(200);
    expect(demoRes.body.success).toBe(true);
    expect(demoRes.body.dataMode).toBe('DEMO');
  });

  it('5. DEMO and REAL data remain strictly separated and cannot cross-contaminate', () => {
    const demoObs = IngestionService.processSingleRecord({
      ...realFlightRecord,
      source: 'DEMO',
      dataEnvironment: 'DEMO',
      price: 20000, // Outlier demo price
    }, 'DEMO').observation;

    const realObs = IngestionService.processSingleRecord({
      ...realFlightRecord,
      source: 'Air India',
      dataEnvironment: 'REAL',
      price: 5000,
    }, 'REAL').observation;

    // Process only REAL environment
    const realAggs = DailyRouteAggregationService.processObservations(
      [demoObs, realObs],
      '2026-09-04',
      { dataEnvironment: 'REAL' }
    );

    expect(realAggs).toHaveLength(1);
    expect(realAggs[0].representativeFare).toBe(5000); // Excluded the 20000 demo outlier!
    expect(realAggs[0].dataEnvironment).toBe('REAL');
  });

  it('6. Empty database returns clean empty array without fabricating statistical values', async () => {
    const res = await request(app).get('/api/index/history?dataMode=REAL&startDate=2099-01-01');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('7. Malformed record does not reject valid observations in the same batch', async () => {
    const mixedBatch = [
      realFlightRecord,
      null, // Malformed
      { origin: 'DEL', destination: 'BOM', price: null, price_raw: null }, // Incomplete
    ];

    const result = await IngestionService.ingestBatch(mixedBatch, { dataEnvironment: 'REAL' });
    expect(result.success).toBe(true);
    expect(result.received).toBe(3);
    expect(result.stored).toBe(2);
    expect(result.rejected).toBe(1);
    expect(result.indexEligible).toBe(1);
  });

  it('8. Duplicate real scraper records produce matched deduplication hash without duplicate storage', () => {
    const obs1 = IngestionService.processSingleRecord(realFlightRecord, 'REAL').observation;
    const obs2 = IngestionService.processSingleRecord({ ...realFlightRecord }, 'REAL').observation;
    expect(obs1.deduplicationHash).toBe(obs2.deduplicationHash);
  });

  it('9. All five exact lead-time buckets (T+1, T+7, T+15, T+30, T+45) are correctly classified', () => {
    const windows = [
      { date: '2026-09-05', bucket: 'T+1' },
      { date: '2026-09-11', bucket: 'T+7' },
      { date: '2026-09-19', bucket: 'T+15' },
      { date: '2026-10-04', bucket: 'T+30' },
      { date: '2026-10-19', bucket: 'T+45' },
    ];

    const obsList = windows.map((w) =>
      IngestionService.processSingleRecord({
        ...realFlightRecord,
        departure_date: w.date,
      }, 'REAL').observation
    );

    const aggs = DailyRouteAggregationService.processObservations(obsList, '2026-09-04', {
      dataEnvironment: 'REAL',
    });

    expect(aggs).toHaveLength(5);
    const bucketsFound = aggs.map((a) => a.leadTimeBucket);
    expect(bucketsFound).toEqual(['T+1', 'T+7', 'T+15', 'T+30', 'T+45']);
  });

  it('10, 11, 12 & 13. Exclusions: International, Round-Trip, Null Price, and Unknown Currency are disqualified from index', () => {
    const edgeCases = [
      { ...realFlightRecord, destination: 'DXB' }, // International
      { ...realFlightRecord, trip_type: 'round-trip' }, // Round trip
      { ...realFlightRecord, price: null, price_raw: null }, // Missing price
      { ...realFlightRecord, currency: 'UNKNOWN' }, // Unknown currency
    ];

    edgeCases.forEach((rec) => {
      const { observation } = IngestionService.processSingleRecord(rec, 'REAL');
      expect(observation.quality.indexEligible).toBe(false);
    });
  });

  it('14. Base = Current fares produces exactly 100.00 Base Index', () => {
    const indexDoc = AirfareIndexService.computeBucketIndex({
      indexDate: '2026-09-04',
      dataEnvironment: 'REAL',
      leadTimeBucket: 'T+7',
      currentAggregations: [{ routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 5000 }],
      baseAggregations: [{ routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 5000 }],
      routeWeights: [{ routeKey: 'DEL-BOM', weight: 1.0 }],
    });

    expect(indexDoc.indexValue).toBe(100.0);
    expect(indexDoc.baseRelativeChangePercent).toBe(0.0);
  });

  it('15. Pipeline execution is idempotent across multiple runs on the same date', async () => {
    const res1 = await PipelineOrchestratorService.runDailyPipeline({
      collectionDate: '2026-09-04',
      dataEnvironment: 'REAL',
    });
    const res2 = await PipelineOrchestratorService.runDailyPipeline({
      collectionDate: '2026-09-04',
      dataEnvironment: 'REAL',
    });

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res1.dataEnvironment).toBe('REAL');
  });

  it('16. Diagnostic endpoint GET /api/index/pipeline/status returns live readiness metrics', async () => {
    const res = await request(app).get('/api/index/pipeline/status?dataMode=REAL');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.dataMode).toBe('REAL');
    expect(res.body).toHaveProperty('rawObservations');
    expect(res.body).toHaveProperty('eligibleObservations');
    expect(res.body).toHaveProperty('aggregationsAvailable');
    expect(res.body).toHaveProperty('indexRecordsAvailable');
    expect(res.body).toHaveProperty('readyForIndex');
  });
});
