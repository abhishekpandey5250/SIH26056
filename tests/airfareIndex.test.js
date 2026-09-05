import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import {
  normalizeWeights,
  calculatePriceRelative,
  calculateDailyChange,
  AirfareIndexService,
} from '../src/services/airfareIndex.service.js';

describe('Step 4: Airfare Price Index Statistical Engine', () => {
  describe('1. Price Relative & Weight Normalization Mechanics', () => {
    it('1. Base period index calculation produces 100 when current fares equal base fares', () => {
      const routeWeights = [
        { routeKey: 'DEL-BOM', origin: 'DEL', destination: 'BOM', weight: 0.6 },
        { routeKey: 'DEL-BLR', origin: 'DEL', destination: 'BLR', weight: 0.4 },
      ];

      const currentAggregations = [
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 5000 },
        { routeKey: 'DEL-BLR', leadTimeBucket: 'T+7', representativeFare: 4000 },
      ];

      const baseAggregations = [
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 5000 },
        { routeKey: 'DEL-BLR', leadTimeBucket: 'T+7', representativeFare: 4000 },
      ];

      const result = AirfareIndexService.computeBucketIndex({
        indexDate: '2026-09-04',
        leadTimeBucket: 'T+7',
        currentAggregations,
        baseAggregations,
        routeWeights,
      });

      expect(result).toBeDefined();
      expect(result.indexValue).toBe(100.0);
      expect(result.baseRelativeChangePercent).toBe(0.0);
    });

    it('2. Current fare doubles → route price relative = 200', () => {
      const relative = calculatePriceRelative(8000, 4000);
      expect(relative).toBe(200.0);
    });

    it('3. Current fare falls by 10% → price relative = 90', () => {
      const relative = calculatePriceRelative(4500, 5000);
      expect(relative).toBe(90.0);
    });

    it('4. Manual Verification: DEL-BOM (0.50, 4000->4800=120), DEL-BLR (0.30, 5000->5500=110), BOM-BLR (0.20, 6000->6300=105) produces Index = 114.00', () => {
      const routeWeights = [
        { routeKey: 'DEL-BOM', origin: 'DEL', destination: 'BOM', weight: 0.50 },
        { routeKey: 'DEL-BLR', origin: 'DEL', destination: 'BLR', weight: 0.30 },
        { routeKey: 'BOM-BLR', origin: 'BOM', destination: 'BLR', weight: 0.20 },
      ];

      const currentAggregations = [
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4800 },
        { routeKey: 'DEL-BLR', leadTimeBucket: 'T+7', representativeFare: 5500 },
        { routeKey: 'BOM-BLR', leadTimeBucket: 'T+7', representativeFare: 6300 },
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
      // Price relatives: DEL-BOM=120, DEL-BLR=110, BOM-BLR=105
      // Weighted: 0.50*120 + 0.30*110 + 0.20*105 = 60 + 33 + 21 = 114.00
      expect(result.indexValue).toBe(114.0);
      expect(result.baseRelativeChangePercent).toBe(14.0);
      expect(result.weightCoverage).toBe(100.0);
      expect(result.routeCount).toBe(3);
    });

    it('5. Route weights normalize correctly when not summing to 1', () => {
      const unnormalized = [
        { routeKey: 'DEL-BOM', weight: 10 },
        { routeKey: 'DEL-BLR', weight: 20 },
        { routeKey: 'BOM-BLR', weight: 20 },
      ];
      const normalized = normalizeWeights(unnormalized);
      expect(normalized[0].weight).toBeCloseTo(0.2, 5);
      expect(normalized[1].weight).toBeCloseTo(0.4, 5);
      expect(normalized[2].weight).toBeCloseTo(0.4, 5);
      const sum = normalized.reduce((acc, w) => acc + w.weight, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('6. Weights that already sum to 1 remain unchanged', () => {
      const exactWeights = [
        { routeKey: 'DEL-BOM', weight: 0.5 },
        { routeKey: 'DEL-BLR', weight: 0.3 },
        { routeKey: 'BOM-BLR', weight: 0.2 },
      ];
      const normalized = normalizeWeights(exactWeights);
      expect(normalized[0].weight).toBe(0.5);
      expect(normalized[1].weight).toBe(0.3);
      expect(normalized[2].weight).toBe(0.2);
    });
  });

  describe('2. Missing Route Policy, Coverage & Renormalization', () => {
    it('7, 8, 21 & 22. Missing current route is excluded, remaining weights renormalized, and coverage calculated', () => {
      const routeWeights = [
        { routeKey: 'DEL-BOM', origin: 'DEL', destination: 'BOM', weight: 0.50 },
        { routeKey: 'DEL-BLR', origin: 'DEL', destination: 'BLR', weight: 0.30 },
        { routeKey: 'BOM-BLR', origin: 'BOM', destination: 'BLR', weight: 0.20 },
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
      // Included weight: 0.50 + 0.30 = 0.80
      // Coverage = 80.0%
      expect(result.weightCoverage).toBe(80.0);
      expect(result.routeCount).toBe(2);
      expect(result.configuredRouteCount).toBe(3);
      expect(result.availableRouteCount).toBe(2);

      // Renormalized effective weights:
      // DEL-BOM: 0.50 / 0.80 = 0.625
      // DEL-BLR: 0.30 / 0.80 = 0.375
      // Price relatives: DEL-BOM = 120, DEL-BLR = 110
      // Index = (0.625 * 120) + (0.375 * 110) = 75 + 41.25 = 116.25
      expect(result.indexValue).toBe(116.25);
      expect(result.routes[0].effectiveWeight).toBe(0.625);
      expect(result.routes[1].effectiveWeight).toBe(0.375);
    });

    it('9 & 10. Missing base fare or missing current fare cleanly excludes route without assigning zero', () => {
      const routeWeights = [
        { routeKey: 'DEL-BOM', origin: 'DEL', destination: 'BOM', weight: 0.6 },
        { routeKey: 'DEL-BLR', origin: 'DEL', destination: 'BLR', weight: 0.4 },
      ];

      const currentAggregations = [
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4800 },
        { routeKey: 'DEL-BLR', leadTimeBucket: 'T+7', representativeFare: 5500 },
      ];

      const baseAggregations = [
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4000 },
      ];

      const result = AirfareIndexService.computeBucketIndex({
        indexDate: '2026-09-04',
        leadTimeBucket: 'T+7',
        currentAggregations,
        baseAggregations,
        routeWeights,
      });

      expect(result).toBeDefined();
      expect(result.routeCount).toBe(1);
      expect(result.weightCoverage).toBe(60.0);
      expect(result.indexValue).toBe(120.0);
    });

    it('11 & 12. Zero base fare or negative fare does not cause division-by-zero or enter index', () => {
      expect(calculatePriceRelative(5000, 0)).toBeNull();
      expect(calculatePriceRelative(5000, -100)).toBeNull();
      expect(calculatePriceRelative(-500, 5000)).toBeNull();
    });
  });

  describe('3. Lead-Time Bucket Independence and Route Matching', () => {
    it('13, 14, 15, 16 & 19. T+1, T+7, T+15, T+30, T+45 calculations are independent and do not cross-match buckets', () => {
      const routeWeights = [
        { routeKey: 'DEL-BOM', origin: 'DEL', destination: 'BOM', weight: 1.0 },
      ];

      const currentAggregations = [
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+1', representativeFare: 9000 },
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4800 },
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+15', representativeFare: 4200 },
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+30', representativeFare: 3800 },
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+45', representativeFare: 3500 },
      ];

      const baseAggregations = [
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+1', representativeFare: 7500 },
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4000 },
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+15', representativeFare: 3500 },
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+30', representativeFare: 3200 },
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+45', representativeFare: 3000 },
      ];

      const indexT1 = AirfareIndexService.computeBucketIndex({
        indexDate: '2026-09-04',
        leadTimeBucket: 'T+1',
        currentAggregations,
        baseAggregations,
        routeWeights,
      });

      const indexT7 = AirfareIndexService.computeBucketIndex({
        indexDate: '2026-09-04',
        leadTimeBucket: 'T+7',
        currentAggregations,
        baseAggregations,
        routeWeights,
      });

      const indexT15 = AirfareIndexService.computeBucketIndex({
        indexDate: '2026-09-04',
        leadTimeBucket: 'T+15',
        currentAggregations,
        baseAggregations,
        routeWeights,
      });

      const indexT30 = AirfareIndexService.computeBucketIndex({
        indexDate: '2026-09-04',
        leadTimeBucket: 'T+30',
        currentAggregations,
        baseAggregations,
        routeWeights,
      });

      const indexT45 = AirfareIndexService.computeBucketIndex({
        indexDate: '2026-09-04',
        leadTimeBucket: 'T+45',
        currentAggregations,
        baseAggregations,
        routeWeights,
      });

      expect(indexT1.indexValue).toBe(120.0);
      expect(indexT1.indexCode).toBe('AIRFARE_T1');

      expect(indexT7.indexValue).toBe(120.0);
      expect(indexT7.indexCode).toBe('AIRFARE_T7');

      expect(indexT15.indexValue).toBe(120.0);
      expect(indexT15.indexCode).toBe('AIRFARE_T15');

      expect(indexT30.indexValue).toBe(118.75);
      expect(indexT30.indexCode).toBe('AIRFARE_T30');

      expect(indexT45.indexValue).toBe(116.67);
      expect(indexT45.indexCode).toBe('AIRFARE_T45');
    });

    it('17 & 18. Current route matches exact base-period route and does not cross-match different routes', () => {
      const routeWeights = [
        { routeKey: 'DEL-BOM', origin: 'DEL', destination: 'BOM', weight: 1.0 },
      ];

      const currentAggregations = [
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 5000 },
      ];

      const baseAggregations = [
        { routeKey: 'DEL-BLR', leadTimeBucket: 'T+7', representativeFare: 4000 },
      ];

      const result = AirfareIndexService.computeBucketIndex({
        indexDate: '2026-09-04',
        leadTimeBucket: 'T+7',
        currentAggregations,
        baseAggregations,
        routeWeights,
      });

      expect(result).toBeNull();
    });

    it('20. Base-period representative fare calculates median across multiple base dates', () => {
      const routeWeights = [
        { routeKey: 'DEL-BOM', origin: 'DEL', destination: 'BOM', weight: 1.0 },
      ];

      const currentAggregations = [
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4860 },
      ];

      const baseAggregations = [
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4000 },
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4100 },
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 3950 },
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4050 },
        { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4200 },
      ];

      const result = AirfareIndexService.computeBucketIndex({
        indexDate: '2026-09-04',
        leadTimeBucket: 'T+7',
        currentAggregations,
        baseAggregations,
        routeWeights,
      });

      expect(result).toBeDefined();
      expect(result.routes[0].baseFare).toBe(4050);
      expect(result.indexValue).toBe(120.0);
    });
  });

  describe('4. Day-to-Day Change Calculations', () => {
    it('23. Daily change percentage is correctly calculated against previous index of same bucket', () => {
      const change = calculateDailyChange(114, 110);
      expect(change).toBe(3.64);
    });

    it('24. No previous index returns null daily change', () => {
      const change = calculateDailyChange(114, null);
      expect(change).toBeNull();
    });
  });

  describe('5. Index Calculation & Query API Endpoints', () => {
    it('26. API rejects missing or invalid calculation dates with 400 Bad Request', async () => {
      const badReq1 = await request(app).post('/api/index/calculate').send({});
      expect(badReq1.status).toBe(400);
      expect(badReq1.body.message).toContain('valid calculation date');

      const badReq2 = await request(app).post('/api/index/calculate').send({ date: 'invalid' });
      expect(badReq2.status).toBe(400);
      expect(badReq2.body.message).toContain('Invalid date format');
    });

    it('27. API rejects invalid leadTimeBucket with 400 Bad Request', async () => {
      const badBucket = await request(app)
        .post('/api/index/calculate')
        .send({ date: '2026-09-04', leadTimeBucket: 'T+99' });

      expect(badBucket.status).toBe(400);
      expect(badBucket.body.message).toContain('Invalid leadTimeBucket');
    });

    it('28. GET /api/index/latest returns successful status and data array', async () => {
      const response = await request(app).get('/api/index/latest');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('29. GET /api/index/history returns successful time-series query with date filtering', async () => {
      const response = await request(app).get(
        '/api/index/history?startDate=2026-09-01&endDate=2026-09-30&leadTimeBucket=T+7'
      );
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
