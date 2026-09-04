import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { config } from '../src/config/env.js';
import { realisticScraperBatch } from './fixtures/realisticScraperPayload.js';
import { IngestionService } from '../src/services/ingestion.service.js';
import { DailyRouteAggregationService } from '../src/services/dailyRouteAggregation.service.js';
import { AirfareIndexService } from '../src/services/airfareIndex.service.js';

describe('Step 6: End-to-End Scraper Integration & Data Pipeline', () => {
  const validApiKey = config.scraperApiKey || 'dev-scraper-key-12345';

  it('A & B: POST /api/scraper/fares/batch accepts realistic scraper payload and authenticates with API key', async () => {
    // 1. Verify 401 Unauthorized if API key is invalid
    if (config.scraperApiKey) {
      const unauthorizedRes = await request(app)
        .post('/api/scraper/fares/batch')
        .set('X-SCRAPER-API-KEY', 'invalid-secret-key')
        .send({ observations: realisticScraperBatch });

      expect(unauthorizedRes.status).toBe(401);
      expect(unauthorizedRes.body.message).toContain('Unauthorized');
    }

    // 2. Transmit batch with valid API key
    const res = await request(app)
      .post('/api/scraper/fares/batch')
      .set('X-SCRAPER-API-KEY', validApiKey)
      .send({ observations: realisticScraperBatch });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.received).toBe(15);
    expect(res.body.rejected).toBe(0);
    expect(res.body.indexEligible).toBe(10);
  });

  it('C: Ingestion service handles normalization, validation, quality triage, and SHA-256 deduplication', async () => {
    const result = await IngestionService.ingestBatch(realisticScraperBatch);

    expect(result.success).toBe(true);
    expect(result.received).toBe(15);
    expect(result.indexEligible).toBe(10);
    expect(result.flagged).toBeGreaterThanOrEqual(5); // edge cases: international, roundtrip, non-INR, null price, etc.
  });

  it('D: DailyRouteAggregation processes normalized observations into exact lead-time median representative fares', () => {
    // Process observations into normalized models
    const processedObservations = realisticScraperBatch
      .map((rec) => IngestionService.processSingleRecord(rec).observation)
      .filter(Boolean);

    const aggregations = DailyRouteAggregationService.processObservations(
      processedObservations,
      '2026-09-04'
    );

    expect(aggregations).toBeDefined();
    expect(aggregations.length).toBeGreaterThan(0);

    // Verify DEL-BOM T+7 aggregation calculates median of [4800, 4800, 5200] -> 4800
    const delBomT7 = aggregations.find(
      (a) => a.routeKey === 'DEL-BOM' && a.leadTimeBucket === 'T+7'
    );
    expect(delBomT7).toBeDefined();
    expect(delBomT7.representativeFare).toBe(4800); // Median of 4800, 4800, 5200
    expect(delBomT7.minFare).toBe(4800);
    expect(delBomT7.maxFare).toBe(5200);
    expect(delBomT7.eligibleObservationCount).toBe(3);

    // Verify T+1, T+15, T+30, T+45 are also cleanly aggregated
    const delBomT1 = aggregations.find(
      (a) => a.routeKey === 'DEL-BOM' && a.leadTimeBucket === 'T+1'
    );
    expect(delBomT1).toBeDefined();
    expect(delBomT1.representativeFare).toBe(8500);

    const delCcuT30 = aggregations.find(
      (a) => a.routeKey === 'DEL-CCU' && a.leadTimeBucket === 'T+30'
    );
    expect(delCcuT30).toBeDefined();
    expect(delCcuT30.representativeFare).toBe(3900);
  });

  it('E: Statistical Index Engine calculates Laspeyres price index and route price relatives from aggregations', () => {
    // 1. Current Aggregations for 2026-09-04
    const currentAggregations = [
      { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4800 },
      { routeKey: 'DEL-BLR', leadTimeBucket: 'T+7', representativeFare: 5500 },
      { routeKey: 'BOM-BLR', leadTimeBucket: 'T+7', representativeFare: 6300 },
    ];

    // 2. Base Aggregations (Benchmark period)
    const baseAggregations = [
      { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4000 },
      { routeKey: 'DEL-BLR', leadTimeBucket: 'T+7', representativeFare: 5000 },
      { routeKey: 'BOM-BLR', leadTimeBucket: 'T+7', representativeFare: 6000 },
    ];

    // 3. Demo route weights
    const routeWeights = [
      { routeKey: 'DEL-BOM', origin: 'DEL', destination: 'BOM', weight: 0.50 },
      { routeKey: 'DEL-BLR', origin: 'DEL', destination: 'BLR', weight: 0.30 },
      { routeKey: 'BOM-BLR', origin: 'BOM', destination: 'BLR', weight: 0.20 },
    ];

    const indexDoc = AirfareIndexService.computeBucketIndex({
      indexDate: '2026-09-04',
      leadTimeBucket: 'T+7',
      currentAggregations,
      baseAggregations,
      routeWeights,
    });

    expect(indexDoc).toBeDefined();
    expect(indexDoc.indexCode).toBe('AIRFARE_T7');
    expect(indexDoc.indexValue).toBe(114.0); // Exactly 114.00
    expect(indexDoc.baseRelativeChangePercent).toBe(14.0);
    expect(indexDoc.weightCoverage).toBe(100.0);
    expect(indexDoc.routes.length).toBe(3);
  });

  it('F & G: Read APIs return successful responses with proper structures', async () => {
    // Test GET /api/index/latest
    const latestRes = await request(app).get('/api/index/latest');
    expect(latestRes.status).toBe(200);
    expect(latestRes.body.success).toBe(true);
    expect(Array.isArray(latestRes.body.data)).toBe(true);

    // Test GET /api/index/history
    const historyRes = await request(app).get(
      '/api/index/history?startDate=2026-09-01&endDate=2026-09-30&leadTimeBucket=T+7'
    );
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.success).toBe(true);
    expect(Array.isArray(historyRes.body.data)).toBe(true);
  });
});
