import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import {
  validateTrafficRecord,
  parseTrafficCSV,
} from '../scripts/importDGCATraffic.js';
import { RouteBasketService } from '../src/services/routeBasket.service.js';
import {
  getISOWeekString,
  TemporalAggregationService,
} from '../src/services/temporalAggregation.service.js';
import { SectorAnalyticsService } from '../src/services/sectorAnalytics.service.js';
import { LeadTimeAnalyticsService } from '../src/services/leadTimeAnalytics.service.js';
import { ObservabilityService } from '../src/services/observability.service.js';

describe('Step 8: Final Feature Completion — DGCA Traffic Basket, Temporal Indices, Heatmap, Analytics & API v1', () => {
  // Synthetic test fixture for unit testing
  const syntheticTrafficRecord = {
    period: '2026-Q1',
    origin: 'DEL',
    destination: 'BOM',
    passengers: 450000,
    trafficType: 'DOMESTIC_SCHEDULED',
  };

  it('1. DGCA traffic record validates and normalizes correctly', () => {
    const { record, error } = validateTrafficRecord(syntheticTrafficRecord, 'REAL');
    expect(error).toBeUndefined();
    expect(record).toBeDefined();
    expect(record.period).toBe('2026-Q1');
    expect(record.route).toBe('DEL-BOM');
    expect(record.passengers).toBe(450000);
    expect(record.dataEnvironment).toBe('REAL');
  });

  it('2. Invalid traffic records (negative pax, same origin/dest, invalid codes) are rejected', () => {
    const invalid = [
      { ...syntheticTrafficRecord, passengers: -10 },
      { ...syntheticTrafficRecord, origin: 'DEL', destination: 'DEL' },
      { ...syntheticTrafficRecord, destination: 'INVALID' },
    ];
    invalid.forEach((c) => {
      const { record, error } = validateTrafficRecord(c);
      expect(record).toBeNull();
      expect(error).toBeDefined();
    });
  });

  it('3. Route weights are accurately derived from passenger traffic volumes', () => {
    const trafficData = [
      { route: 'DEL-BOM', origin: 'DEL', destination: 'BOM', passengers: 500000 },
      { route: 'DEL-BLR', origin: 'DEL', destination: 'BLR', passengers: 300000 },
      { route: 'BOM-BLR', origin: 'BOM', destination: 'BLR', passengers: 200000 },
    ];
    // Total = 1,000,000. Weights: DEL-BOM: 0.50, DEL-BLR: 0.30, BOM-BLR: 0.20
    const weights = RouteBasketService.calculateWeightsFromTraffic(trafficData);
    expect(weights).toHaveLength(3);
    expect(weights[0].routeKey).toBe('DEL-BOM');
    expect(weights[0].weight).toBe(0.5);
    expect(weights[1].routeKey).toBe('DEL-BLR');
    expect(weights[1].weight).toBe(0.3);
    expect(weights[2].routeKey).toBe('BOM-BLR');
    expect(weights[2].weight).toBe(0.2);
  });

  it('4. Provisional basket operates with explicit PROVISIONAL label when DGCA traffic is absent', async () => {
    const basket = await RouteBasketService.getActiveBasket({ dataEnvironment: 'REAL' });
    expect(basket).toBeDefined();
    expect(basket.routes.length).toBeGreaterThan(0);
    const delBom = basket.routes.find((r) => r.routeKey === 'DEL-BOM');
    expect(delBom).toBeDefined();
    expect(delBom.weight).toBe(0.13);
    if (!basket.isDgcaDerived) {
      expect(basket.validationStatus).toContain('PROVISIONAL');
    }
  });

  it('5. ISO week string utility produces accurate calendar week identifiers', () => {
    expect(getISOWeekString('2026-08-05')).toBe('2026-W32');
    expect(getISOWeekString('2026-08-15')).toBe('2026-W33');
  });

  it('6. Versioned API /api/v1/index/daily returns standardized envelope metadata', async () => {
    const res = await request(app).get('/api/v1/index/daily?dataMode=REAL');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta).toHaveProperty('frequency', 'daily');
    expect(res.body.meta).toHaveProperty('dataEnvironment', 'REAL');
    expect(res.body).toHaveProperty('data');
  });

  it('7. Versioned API /api/v1/index/weekly and /monthly return structured temporal series', async () => {
    const weeklyRes = await request(app).get('/api/v1/index/weekly?dataMode=REAL');
    expect(weeklyRes.status).toBe(200);
    expect(weeklyRes.body.meta.frequency).toBe('weekly');

    const monthlyRes = await request(app).get('/api/v1/index/monthly?dataMode=REAL');
    expect(monthlyRes.status).toBe(200);
    expect(monthlyRes.body.meta.frequency).toBe('monthly');
  });

  it('8. Versioned API /api/v1/index/basket reports active basket status and weight sum', async () => {
    const res = await request(app).get('/api/v1/index/basket?dataMode=REAL');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('basketVersion');
    expect(res.body).toHaveProperty('validationStatus');
    expect(res.body).toHaveProperty('weightSum');
    const delBom = res.body.routes.find((r) => r.routeKey === 'DEL-BOM');
    expect(delBom).toBeDefined();
    expect(delBom.weight).toBe(0.13);
  });

  it('9. Sector Heatmap API /api/v1/analytics/heatmap computes sector-level price metrics', async () => {
    const res = await request(app).get('/api/v1/analytics/heatmap?leadTimeBucket=T+7&dataMode=REAL');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta).toHaveProperty('leadTimeBucket', 'T+7');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('10. Lead-time elasticity analytics /api/v1/analytics/lead-time provides descriptive stats for T+1..T+45', async () => {
    const res = await request(app).get('/api/v1/analytics/lead-time?dataMode=REAL');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.curve).toHaveLength(5);
    expect(res.body.curve[0].bucket).toBe('T+1');
    expect(res.body.curve[4].bucket).toBe('T+45');
    expect(res.body.methodologyNote).toContain('not a forecast');
  });

  it('11. Observability API /api/v1/status returns comprehensive quality and triage metrics', async () => {
    const res = await request(app).get('/api/v1/status?dataMode=REAL');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('observations');
    expect(res.body).toHaveProperty('coverage');
  });

  it('12. Universal CSV export endpoints produce valid CSV attachments with audit headers', async () => {
    const dailyCsv = await request(app).get('/api/v1/export/index?freq=daily&format=csv');
    expect(dailyCsv.status).toBe(200);
    expect(dailyCsv.headers['content-type']).toContain('text/csv');
    expect(dailyCsv.text).toContain('period,frequency,leadTimeBucket,indexValue');

    const heatmapCsv = await request(app).get('/api/v1/export/heatmap?format=csv');
    expect(heatmapCsv.status).toBe(200);
    expect(heatmapCsv.headers['content-type']).toContain('text/csv');

    const leadTimeCsv = await request(app).get('/api/v1/export/lead-time?format=csv');
    expect(leadTimeCsv.status).toBe(200);
    expect(leadTimeCsv.headers['content-type']).toContain('text/csv');
  });

  it('13. Universal JSON export endpoints return structured metadata attachments', async () => {
    const res = await request(app).get('/api/v1/export/index?freq=monthly&format=json');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta).toHaveProperty('exportedAt');
  });

  it('14. Pipeline scheduler status endpoint reports automation state', async () => {
    const res = await request(app).get('/api/v1/pipeline/status?dataMode=REAL');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('schedulerEnabled');
  });
});
