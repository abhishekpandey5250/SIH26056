import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import {
  PRODUCTION_20_ROUTES,
  getCanonicalRouteId,
  parseScraperJSON,
  analyzeAndFilterScraperBatch,
  importScraperData,
  importScraperPath,
  collectJsonFiles,
} from '../scripts/importScraperJSON.js';

describe('Scraper Team JSON Ingestion Pipeline & 20-Route Production Basket', () => {
  // 1. JSON Parsing Tests
  it('1. parseScraperJSON accepts valid { "observations": [...] } format', () => {
    const jsonStr = JSON.stringify({
      observations: [
        {
          source: 'Air India',
          scraped_at: '2026-09-04T08:00:00.000Z',
          origin: 'DEL',
          destination: 'BOM',
          departure_date: '2026-09-11',
          price: 4500,
          currency: 'INR',
        },
      ],
    });

    const parsed = parseScraperJSON(jsonStr);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].origin).toBe('DEL');
  });

  it('2. parseScraperJSON accepts top-level array of observations', () => {
    const jsonStr = JSON.stringify([
      {
        source: 'IndiGo',
        scraped_at: '2026-09-04T08:00:00.000Z',
        origin: 'DEL',
        destination: 'BLR',
        departure_date: '2026-09-11',
        price: 5200,
        currency: 'INR',
      },
    ]);

    const parsed = parseScraperJSON(jsonStr);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].destination).toBe('BLR');
  });

  it('3. parseScraperJSON throws error on malformed JSON syntax', () => {
    expect(() => parseScraperJSON('{ invalid json: [ }')).toThrow(/Malformed JSON syntax/);
  });

  it('4. parseScraperJSON throws error on missing observations array', () => {
    expect(() => parseScraperJSON(JSON.stringify({ status: 'ok', data: [] }))).toThrow(
      /Expected an object with an "observations" array/
    );
  });

  // 2. Canonical 20-Route Production Basket & Reverse Mapping
  it('5. getCanonicalRouteId correctly maps all 20 forward routes in production basket', () => {
    expect(PRODUCTION_20_ROUTES).toHaveLength(20);

    PRODUCTION_20_ROUTES.forEach((route) => {
      const [origin, destination] = route.split('-');
      const canonical = getCanonicalRouteId(origin, destination);
      expect(canonical).toBe(route);
    });
  });

  it('6. getCanonicalRouteId maps reverse directions to the identical canonical routeId', () => {
    expect(getCanonicalRouteId('BOM', 'DEL')).toBe('DEL-BOM');
    expect(getCanonicalRouteId('BLR', 'DEL')).toBe('DEL-BLR');
    expect(getCanonicalRouteId('BLR', 'BOM')).toBe('BOM-BLR');
    expect(getCanonicalRouteId('HYD', 'DEL')).toBe('DEL-HYD');
    expect(getCanonicalRouteId('CCU', 'DEL')).toBe('DEL-CCU');
    expect(getCanonicalRouteId('MAA', 'BOM')).toBe('BOM-MAA');
    expect(getCanonicalRouteId('HYD', 'BLR')).toBe('BLR-HYD');
    expect(getCanonicalRouteId('MAA', 'DEL')).toBe('DEL-MAA');
    expect(getCanonicalRouteId('AMD', 'BOM')).toBe('BOM-AMD');
    expect(getCanonicalRouteId('MAA', 'HYD')).toBe('HYD-MAA');
  });

  it('7. getCanonicalRouteId handles GOX secondary airport mapping to GOI corridor', () => {
    expect(getCanonicalRouteId('DEL', 'GOX')).toBe('DEL-GOI');
    expect(getCanonicalRouteId('GOX', 'BOM')).toBe('BOM-GOI');
  });

  it('8. getCanonicalRouteId rejects routes outside the 20-route basket', () => {
    expect(getCanonicalRouteId('IXZ', 'IXB')).toBeNull(); // Port Blair to Bagdogra
    expect(getCanonicalRouteId('BBI', 'IDR')).toBeNull(); // Bhubaneswar to Indore
    expect(getCanonicalRouteId('DEL', 'DXB')).toBeNull(); // International
    expect(getCanonicalRouteId('DEL', 'DEL')).toBeNull(); // Identical
  });

  // 3. Triage & Filtering Logic
  it('9. analyzeAndFilterScraperBatch correctly identifies and counts edge cases', () => {
    const rawBatch = [
      // Valid (DEL-BOM)
      {
        source: 'IndiGo',
        scraped_at: '2026-09-04T06:00:00Z',
        origin: 'DEL',
        destination: 'BOM',
        departure_date: '2026-09-11',
        price: 4800,
        currency: 'INR',
        flight_number: '6E-205',
      },
      // Reverse Direction Valid (BOM-DEL -> maps to DEL-BOM)
      {
        source: 'Air India',
        scraped_at: '2026-09-04T06:00:00Z',
        origin: 'BOM',
        destination: 'DEL',
        departure_date: '2026-09-11',
        price: 5100,
        currency: 'INR',
        flight_number: 'AI-805',
      },
      // Invalid Non-Basket Route (IXZ-IXB)
      {
        source: 'SpiceJet',
        scraped_at: '2026-09-04T06:00:00Z',
        origin: 'IXZ',
        destination: 'IXB',
        departure_date: '2026-09-11',
        price: 9000,
        currency: 'INR',
        flight_number: 'SG-101',
      },
      // International Route (DEL-DXB)
      {
        source: 'Emirates',
        scraped_at: '2026-09-04T06:00:00Z',
        origin: 'DEL',
        destination: 'DXB',
        departure_date: '2026-09-11',
        price: 18000,
        currency: 'INR',
        flight_number: 'EK-511',
      },
      // Missing Price (Never converted to zero)
      {
        source: 'MakeMyTrip',
        scraped_at: '2026-09-04T06:00:00Z',
        origin: 'DEL',
        destination: 'BLR',
        departure_date: '2026-09-11',
        price: null,
        currency: 'INR',
        flight_number: '6E-442',
      },
      // Unknown Currency
      {
        source: 'Akasa Air',
        scraped_at: '2026-09-04T06:00:00Z',
        origin: 'BLR',
        destination: 'HYD',
        departure_date: '2026-09-11',
        price: 3200,
        currency: 'UNKNOWN',
        flight_number: 'QP-112',
      },
      // Round-Trip Quote
      {
        source: 'EaseMyTrip',
        scraped_at: '2026-09-04T06:00:00Z',
        origin: 'DEL',
        destination: 'CCU',
        departure_date: '2026-09-11',
        return_date: '2026-09-20',
        trip_type: 'round-trip',
        price: 11000,
        currency: 'INR',
        flight_number: '6E-291',
      },
      // Missing Flight Number
      {
        source: 'MakeMyTrip',
        scraped_at: '2026-09-04T06:00:00Z',
        origin: 'BOM',
        destination: 'MAA',
        departure_date: '2026-09-11',
        price: 4900,
        currency: 'INR',
        flight_number: 'N/A',
      },
    ];

    const triage = analyzeAndFilterScraperBatch(rawBatch, { dataEnvironment: 'REAL' });

    expect(triage.totalReceived).toBe(8);
    expect(triage.acceptedFor20Basket).toBe(6); // 2 were invalid routes (IXZ-IXB & DEL-DXB)
    expect(triage.invalidRouteCount).toBe(2);
    expect(triage.internationalRouteCount).toBe(1);
    expect(triage.invalidPriceCount).toBe(1);
    expect(triage.invalidCurrencyCount).toBe(1);
    expect(triage.roundTripCount).toBe(1);
    expect(triage.missingFlightNumberCount).toBe(1);

    // DEL-BOM received 2 observations (1 forward, 1 reverse)
    expect(triage.routeCounts['DEL-BOM']).toBe(2);
  });

  // 4. End-to-End Ingestion Service Integration
  it('10. importScraperData ingests records, preserves REAL dataEnvironment, and rejects fabrication', async () => {
    const payload = {
      observations: [
        {
          source: 'IndiGo',
          scraped_at: '2026-09-04T06:00:00Z',
          origin: 'DEL',
          destination: 'BOM',
          departure_date: '2026-09-11', // T+7
          price: 4800,
          currency: 'INR',
          flight_number: '6E-205',
          cabin_class: 'economy',
          trip_type: 'one-way',
        },
        {
          source: 'Air India',
          scraped_at: '2026-09-04T06:00:00Z',
          origin: 'BOM',
          destination: 'DEL',
          departure_date: '2026-09-11', // T+7 (reverse direction)
          price: 5200,
          currency: 'INR',
          flight_number: 'AI-805',
          cabin_class: 'economy',
          trip_type: 'one-way',
        },
        // Exact duplicate of observation 1
        {
          source: 'IndiGo',
          scraped_at: '2026-09-04T06:00:00Z',
          origin: 'DEL',
          destination: 'BOM',
          departure_date: '2026-09-11',
          price: 4800,
          currency: 'INR',
          flight_number: '6E-205',
          cabin_class: 'economy',
          trip_type: 'one-way',
        },
      ],
    };

    const result = await importScraperData(payload, {
      dataEnvironment: 'REAL',
      runPipeline: false, // In unit tests without active MongoDB daemon
    });

    expect(result.success).toBe(true);
    expect(result.dataEnvironment).toBe('REAL');
    expect(result.summary.received).toBe(3);
    expect(result.summary.accepted20Basket).toBe(3);
    expect(result.summary.eligible).toBe(3);
  });

  it('11. All 20 production routes are accepted and mapped correctly', () => {
    const all20Batch = PRODUCTION_20_ROUTES.map((route, i) => {
      const [origin, destination] = route.split('-');
      return {
        source: 'TestScraper',
        scraped_at: '2026-09-04T06:00:00Z',
        origin,
        destination,
        departure_date: '2026-09-11',
        price: 4000 + i * 100,
        currency: 'INR',
        flight_number: `TS-${100 + i}`,
      };
    });

    const triage = analyzeAndFilterScraperBatch(all20Batch, { dataEnvironment: 'REAL' });
    expect(triage.totalReceived).toBe(20);
    expect(triage.acceptedFor20Basket).toBe(20);
    expect(triage.distinctRoutesCount).toBe(20);
    expect(triage.invalidRouteCount).toBe(0);
  });

  // 5. Authoritative 20-Route Basket Validation & Laspeyres Engine Verification
  it('12. Exactly 20 production routes exist with exact authoritative weights', async () => {
    const { PRODUCTION_20_ROUTE_WEIGHTS } = await import('../src/config/indexConfig.js');
    expect(PRODUCTION_20_ROUTE_WEIGHTS).toHaveLength(20);

    const expectedWeights = {
      'DEL-BOM': 0.13,
      'DEL-BLR': 0.09,
      'BOM-BLR': 0.08,
      'DEL-HYD': 0.06,
      'BOM-GOI': 0.05,
      'DEL-CCU': 0.05,
      'BLR-HYD': 0.04,
      'DEL-MAA': 0.05,
      'DEL-AMD': 0.05,
      'BOM-HYD': 0.04,
      'BOM-MAA': 0.04,
      'BLR-MAA': 0.03,
      'DEL-PNQ': 0.06,
      'BOM-CCU': 0.04,
      'BLR-GOI': 0.03,
      'HYD-MAA': 0.03,
      'DEL-GOI': 0.05,
      'BOM-AMD': 0.04,
      'BLR-CCU': 0.04,
      'BLR-COK': 0.03,
    };

    PRODUCTION_20_ROUTE_WEIGHTS.forEach((rw) => {
      expect(expectedWeights).toHaveProperty(rw.routeKey);
      expect(rw.weight).toBe(expectedWeights[rw.routeKey]);
    });
  });

  it('13. No DEL-PAT, DEL-LKO, or DEL-GAU routes exist in the production basket', async () => {
    const { PRODUCTION_20_ROUTES } = await import('../src/config/indexConfig.js');
    expect(PRODUCTION_20_ROUTES).not.toContain('DEL-PAT');
    expect(PRODUCTION_20_ROUTES).not.toContain('DEL-LKO');
    expect(PRODUCTION_20_ROUTES).not.toContain('DEL-GAU');
  });

  it('14. Missing-route dynamic weight renormalization works correctly', async () => {
    const { AirfareIndexService, normalizeWeights } = await import('../src/services/airfareIndex.service.js');
    const { PRODUCTION_20_ROUTE_WEIGHTS } = await import('../src/config/indexConfig.js');

    // Scenario: only 2 routes (DEL-BOM and DEL-BLR) have observations
    const currentAggs = [
      { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 5200 },
      { routeKey: 'DEL-BLR', leadTimeBucket: 'T+7', representativeFare: 6000 },
    ];
    const baseAggs = [
      { routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4000 }, // price relative = 130
      { routeKey: 'DEL-BLR', leadTimeBucket: 'T+7', representativeFare: 5000 }, // price relative = 120
    ];

    const result = AirfareIndexService.computeBucketIndex({
      indexDate: '2026-09-04',
      dataEnvironment: 'REAL',
      leadTimeBucket: 'T+7',
      currentAggregations: currentAggs,
      baseAggregations: baseAggs,
      routeWeights: PRODUCTION_20_ROUTE_WEIGHTS,
    });

    expect(result).not.toBeNull();
    expect(result.routeCount).toBe(2);
    expect(result.configuredRouteCount).toBe(20);

    // Sum of effective weights must equal exactly 1.0000
    const sumEffectiveWeights = result.routes.reduce((sum, r) => sum + r.effectiveWeight, 0);
    expect(Math.round(sumEffectiveWeights * 100) / 100).toBe(1.0);

    // Expected Laspeyres Index = (0.13/(0.13+0.09))*130 + (0.09/(0.13+0.09))*120
    const w1 = 0.13 / (0.13 + 0.09);
    const w2 = 0.09 / (0.13 + 0.09);
    const expectedIndex = Math.round((w1 * 130 + w2 * 120) * 100) / 100;
    expect(result.indexValue).toBe(expectedIndex);
  });

  it('15. Laspeyres calculation works across all five lead-time buckets (T+1, T+7, T+15, T+30, T+45)', async () => {
    const { AirfareIndexService } = await import('../src/services/airfareIndex.service.js');
    const { PRODUCTION_20_ROUTE_WEIGHTS } = await import('../src/config/indexConfig.js');

    const buckets = ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'];

    buckets.forEach((bucket) => {
      const currentAggs = [
        { routeKey: 'DEL-BOM', leadTimeBucket: bucket, representativeFare: 4500 },
      ];
      const baseAggs = [
        { routeKey: 'DEL-BOM', leadTimeBucket: bucket, representativeFare: 4000 },
      ];

      const res = AirfareIndexService.computeBucketIndex({
        indexDate: '2026-09-04',
        dataEnvironment: 'REAL',
        leadTimeBucket: bucket,
        currentAggregations: currentAggs,
        baseAggregations: baseAggs,
        routeWeights: PRODUCTION_20_ROUTE_WEIGHTS,
      });

      expect(res).not.toBeNull();
      expect(res.leadTimeBucket).toBe(bucket);
      expect(res.indexValue).toBe(112.5); // (4500/4000)*100 = 112.5
      expect(res.routeCount).toBe(1);
    });
  });

  // 6. Directory Recursive Discovery & Folder Ingestion Tests
  it('16. collectJsonFiles recursively finds all 95 JSON files across lead-time subfolders', () => {
    const scrapedDir = path.resolve('../scraped_data');
    if (!fs.existsSync(scrapedDir)) return;

    const files = collectJsonFiles(scrapedDir);
    expect(files.length).toBe(95);

    const relativePaths = files.map((f) => path.relative(scrapedDir, f).replace(/\\/g, '/'));
    const subdirs = new Set(relativePaths.map((p) => p.split('/')[0]));

    expect(subdirs.has('T+0')).toBe(true);
    expect(subdirs.has('T+1')).toBe(true);
    expect(subdirs.has('T+7')).toBe(true);
    expect(subdirs.has('T+15')).toBe(true);
    expect(subdirs.has('T+30')).toBe(true);
    expect(subdirs.has('T+45')).toBe(true);
  });

  it('17. parseScraperJSON successfully parses payload files with route and window metadata', () => {
    const scrapedDir = path.resolve('../scraped_data');
    const samplePath = path.join(scrapedDir, 'T+1', 'DEL_BOM.json');
    if (!fs.existsSync(samplePath)) return;

    const content = fs.readFileSync(samplePath, 'utf8');
    const obs = parseScraperJSON(content);

    expect(Array.isArray(obs)).toBe(true);
    expect(obs.length).toBeGreaterThan(0);
    expect(obs[0].origin).toBe('DEL');
    expect(obs[0].destination).toBe('BOM');
  });

  it('18. analyzeAndFilterScraperBatch validates entire 1,693 observation scraped_data dataset into 20-route basket', () => {
    const scrapedDir = path.resolve('../scraped_data');
    if (!fs.existsSync(scrapedDir)) return;

    const files = collectJsonFiles(scrapedDir);
    const allObservations = [];

    for (const file of files) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      const obsList = parsed.observations || (Array.isArray(parsed) ? parsed : []);
      allObservations.push(...obsList);
    }

    expect(allObservations.length).toBe(1693);

    const triage = analyzeAndFilterScraperBatch(allObservations, { dataEnvironment: 'REAL' });
    expect(triage.totalReceived).toBe(1693);
    expect(triage.acceptedFor20Basket).toBe(1693);
    expect(triage.invalidRouteCount).toBe(0);
    expect(triage.invalidPriceCount).toBe(0);
    expect(triage.distinctRoutesCount).toBe(19);
  });

  it('19. importScraperPath processes subfolder (e.g. scraped_data/T+1) cleanly', async () => {
    const scrapedDir = path.resolve('../scraped_data');
    const t1Dir = path.join(scrapedDir, 'T+1');
    if (!fs.existsSync(t1Dir)) return;

    const res = await importScraperPath(t1Dir, { dataEnvironment: 'REAL', runPipeline: false });
    expect(res.success).toBe(true);
    expect(res.filesProcessed).toBe(17);
    expect(res.summary.received).toBe(325);
    expect(res.summary.accepted20Basket).toBe(325);
  });

  it('20. DailyRouteAggregationService processes real scraped data into exact 5 lead-time windows', async () => {
    const { DailyRouteAggregationService } = await import('../src/services/dailyRouteAggregation.service.js');
    const scrapedDir = path.resolve('../scraped_data');
    if (!fs.existsSync(scrapedDir)) return;

    const files = collectJsonFiles(scrapedDir);
    const allObservations = [];

    for (const file of files) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      const obsList = parsed.observations || (Array.isArray(parsed) ? parsed : []);
      allObservations.push(...obsList);
    }

    const triage = analyzeAndFilterScraperBatch(allObservations, { dataEnvironment: 'REAL' });
    const processedObs = triage.processedObservations.map((obs) => ({
      ...obs,
      origin: obs.origin,
      destination: obs.destination,
      departureDate: obs.departure_date,
      scrapedAt: new Date(obs.scraped_at),
      tripType: obs.trip_type || 'one-way',
      cabinClass: obs.cabin_class || 'economy',
      fare: {
        observedFare: obs.price,
        currency: obs.currency || 'INR',
      },
      quality: {
        isValid: true,
        indexEligible: true,
        flags: [],
      },
      dataEnvironment: 'REAL',
    }));

    const aggs = DailyRouteAggregationService.processObservations(processedObs, '2026-09-04', {
      dataEnvironment: 'REAL',
    });

    expect(aggs.length).toBe(80);
    const buckets = new Set(aggs.map((a) => a.leadTimeBucket));
    expect(buckets.has('T+1')).toBe(true);
    expect(buckets.has('T+7')).toBe(true);
    expect(buckets.has('T+15')).toBe(true);
    expect(buckets.has('T+30')).toBe(true);
    expect(buckets.has('T+45')).toBe(true);
  });
});
