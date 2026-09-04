import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import {
  calculateLeadTimeDays,
  getLeadTimeBucket,
  getCalendarDateString,
} from '../src/utils/dateUtils.js';
import {
  calculateMedian,
  isObservationEligibleForAggregation,
  DailyRouteAggregationService,
} from '../src/services/dailyRouteAggregation.service.js';

describe('Step 3: Route + Advance-Purchase Lead-Time Aggregation Engine', () => {
  describe('1. Exact Lead-Time Calculation and Window Mapping', () => {
    it('1. leadTimeDays = 1 → T+1', () => {
      const days = calculateLeadTimeDays('2026-09-05', '2026-09-04');
      expect(days).toBe(1);
      expect(getLeadTimeBucket(days)).toBe('T+1');
    });

    it('2. leadTimeDays = 7 → T+7', () => {
      const days = calculateLeadTimeDays('2026-09-11', '2026-09-04');
      expect(days).toBe(7);
      expect(getLeadTimeBucket(days)).toBe('T+7');
    });

    it('3. leadTimeDays = 15 → T+15', () => {
      const days = calculateLeadTimeDays('2026-09-19', '2026-09-04');
      expect(days).toBe(15);
      expect(getLeadTimeBucket(days)).toBe('T+15');
    });

    it('4. leadTimeDays = 30 → T+30', () => {
      const days = calculateLeadTimeDays('2026-10-04', '2026-09-04');
      expect(days).toBe(30);
      expect(getLeadTimeBucket(days)).toBe('T+30');
    });

    it('5. leadTimeDays = 45 → T+45', () => {
      const days = calculateLeadTimeDays('2026-10-19', '2026-09-04');
      expect(days).toBe(45);
      expect(getLeadTimeBucket(days)).toBe('T+45');
    });

    it('6. leadTimeDays = 6 does NOT become T+7', () => {
      const days = calculateLeadTimeDays('2026-09-10', '2026-09-04');
      expect(days).toBe(6);
      expect(getLeadTimeBucket(days)).toBeNull();
    });

    it('7. leadTimeDays = 8 does NOT become T+7', () => {
      const days = calculateLeadTimeDays('2026-09-12', '2026-09-04');
      expect(days).toBe(8);
      expect(getLeadTimeBucket(days)).toBeNull();
    });

    it('8. leadTimeDays = 14 does NOT become T+15', () => {
      const days = calculateLeadTimeDays('2026-09-18', '2026-09-04');
      expect(days).toBe(14);
      expect(getLeadTimeBucket(days)).toBeNull();
    });

    it('9. leadTimeDays = 16 does NOT become T+15', () => {
      const days = calculateLeadTimeDays('2026-09-20', '2026-09-04');
      expect(days).toBe(16);
      expect(getLeadTimeBucket(days)).toBeNull();
    });
  });

  describe('2. Methodology: Representative Median and Statistical Metrics', () => {
    it('16. median calculation is correct for odd and even number of fares', () => {
      // Odd count: [4700, 4800, 4950, 5100, 5300] -> 4950
      const oddFares = [4800, 5100, 4950, 5300, 4700];
      expect(calculateMedian(oddFares)).toBe(4950);

      // Even count: [4000, 5000, 6000, 7000] -> (5000 + 6000) / 2 = 5500
      const evenFares = [6000, 4000, 7000, 5000];
      expect(calculateMedian(evenFares)).toBe(5500);

      // Single item
      expect(calculateMedian([4500])).toBe(4500);

      // Empty or invalid
      expect(calculateMedian([])).toBeNull();
      expect(calculateMedian(null)).toBeNull();
    });

    it('17 & 18. minFare and maxFare calculation is accurate', () => {
      const observations = [
        {
          scrapedAt: '2026-09-04T06:00:00Z',
          departureDate: '2026-09-11', // T+7
          origin: 'DEL',
          destination: 'BOM',
          tripType: 'one-way',
          cabinClass: 'economy',
          fare: { observedFare: 4800, currency: 'INR' },
          quality: { indexEligible: true, flags: [] },
          airline: 'IndiGo',
        },
        {
          scrapedAt: '2026-09-04T08:00:00Z',
          departureDate: '2026-09-11', // T+7
          origin: 'DEL',
          destination: 'BOM',
          tripType: 'one-way',
          cabinClass: 'economy',
          fare: { observedFare: 7200, currency: 'INR' },
          quality: { indexEligible: true, flags: [] },
          airline: 'Air India',
        },
        {
          scrapedAt: '2026-09-04T10:00:00Z',
          departureDate: '2026-09-11', // T+7
          origin: 'DEL',
          destination: 'BOM',
          tripType: 'one-way',
          cabinClass: 'economy',
          fare: { observedFare: 5500, currency: 'INR' },
          quality: { indexEligible: true, flags: [] },
          airline: 'SpiceJet',
        },
      ];

      const result = DailyRouteAggregationService.processObservations(
        observations,
        '2026-09-04'
      );

      expect(result).toHaveLength(1);
      const agg = result[0];
      expect(agg.representativeFare).toBe(5500); // Median of [4800, 5500, 7200]
      expect(agg.minFare).toBe(4800);
      expect(agg.maxFare).toBe(7200);
      expect(agg.eligibleObservationCount).toBe(3);
      expect(agg.observationCount).toBe(3);
    });
  });

  describe('3. Observation Eligibility & Exclusion Rules', () => {
    it('10. indexEligible = false observations are excluded', () => {
      const obs = {
        origin: 'DEL',
        destination: 'BOM',
        tripType: 'one-way',
        cabinClass: 'economy',
        fare: { observedFare: 5000, currency: 'INR' },
        quality: { indexEligible: false, flags: ['PRICE_UNAVAILABLE'] },
      };
      expect(isObservationEligibleForAggregation(obs)).toBe(false);
    });

    it('11. round-trip observations are excluded', () => {
      const obs = {
        origin: 'DEL',
        destination: 'BOM',
        tripType: 'round-trip',
        cabinClass: 'economy',
        fare: { observedFare: 10000, currency: 'INR' },
        quality: { indexEligible: true, flags: [] },
      };
      expect(isObservationEligibleForAggregation(obs)).toBe(false);
    });

    it('12. international observations (or invalid routes) are excluded', () => {
      const obs = {
        origin: 'DEL',
        destination: 'DEL', // Same origin & destination
        tripType: 'one-way',
        cabinClass: 'economy',
        fare: { observedFare: 5000, currency: 'INR' },
        quality: { indexEligible: true, flags: [] },
      };
      expect(isObservationEligibleForAggregation(obs)).toBe(false);
    });

    it('13. null-price observations are excluded', () => {
      const obs = {
        origin: 'DEL',
        destination: 'BOM',
        tripType: 'one-way',
        cabinClass: 'economy',
        fare: { observedFare: null, currency: 'INR' },
        quality: { indexEligible: true, flags: [] },
      };
      expect(isObservationEligibleForAggregation(obs)).toBe(false);
    });

    it('14. non-INR observations are excluded', () => {
      const obs = {
        origin: 'DEL',
        destination: 'BOM',
        tripType: 'one-way',
        cabinClass: 'economy',
        fare: { observedFare: 65, currency: 'USD' },
        quality: { indexEligible: true, flags: [] },
      };
      expect(isObservationEligibleForAggregation(obs)).toBe(false);
    });

    it('15. non-economy observations are excluded', () => {
      const obs = {
        origin: 'DEL',
        destination: 'BOM',
        tripType: 'one-way',
        cabinClass: 'business',
        fare: { observedFare: 25000, currency: 'INR' },
        quality: { indexEligible: true, flags: [] },
      };
      expect(isObservationEligibleForAggregation(obs)).toBe(false);
    });
  });

  describe('4. Multi-Route and Multi-Bucket Aggregation', () => {
    it('19, 20, 21 & 25. should aggregate multiple routes and lead-time buckets independently with accurate counts and source breakdowns', () => {
      const rawRecords = [
        // DEL-BOM T+7 (2 records)
        {
          scrapedAt: '2026-09-04T06:00:00Z',
          departureDate: '2026-09-11', // T+7
          origin: 'DEL',
          destination: 'BOM',
          tripType: 'one-way',
          cabinClass: 'economy',
          fare: { observedFare: 5000, currency: 'INR' },
          quality: { indexEligible: true, flags: [] },
          airline: 'IndiGo',
        },
        {
          scrapedAt: '2026-09-04T07:00:00Z',
          departureDate: '2026-09-11', // T+7
          origin: 'DEL',
          destination: 'BOM',
          tripType: 'one-way',
          cabinClass: 'economy',
          fare: { observedFare: 6000, currency: 'INR' },
          quality: { indexEligible: true, flags: [] },
          airline: 'Air India',
        },
        // DEL-BOM T+1 (1 record)
        {
          scrapedAt: '2026-09-04T08:00:00Z',
          departureDate: '2026-09-05', // T+1
          origin: 'DEL',
          destination: 'BOM',
          tripType: 'one-way',
          cabinClass: 'economy',
          fare: { observedFare: 8500, currency: 'INR' },
          quality: { indexEligible: true, flags: [] },
          airline: 'IndiGo',
        },
        // BLR-HYD T+15 (1 record)
        {
          scrapedAt: '2026-09-04T09:00:00Z',
          departureDate: '2026-09-19', // T+15
          origin: 'BLR',
          destination: 'HYD',
          tripType: 'one-way',
          cabinClass: 'economy',
          fare: { observedFare: 3200, currency: 'INR' },
          quality: { indexEligible: true, flags: [] },
          airline: 'SpiceJet',
        },
        // Ineligible record in DEL-BOM T+7 group (price null)
        {
          scrapedAt: '2026-09-04T10:00:00Z',
          departureDate: '2026-09-11', // T+7
          origin: 'DEL',
          destination: 'BOM',
          tripType: 'one-way',
          cabinClass: 'economy',
          fare: { observedFare: null, currency: 'INR' },
          quality: { indexEligible: false, flags: ['PRICE_UNAVAILABLE'] },
          airline: 'Vistara',
        },
      ];

      const aggregations = DailyRouteAggregationService.processObservations(
        rawRecords,
        '2026-09-04'
      );

      // We expect 3 distinct aggregations:
      // 1. DEL-BOM T+7
      // 2. DEL-BOM T+1
      // 3. BLR-HYD T+15
      expect(aggregations).toHaveLength(3);

      const delBomT7 = aggregations.find(
        (a) => a.routeKey === 'DEL-BOM' && a.leadTimeBucket === 'T+7'
      );
      expect(delBomT7).toBeDefined();
      expect(delBomT7.representativeFare).toBe(5500); // Median of [5000, 6000]
      expect(delBomT7.observationCount).toBe(3); // 2 eligible + 1 ineligible
      expect(delBomT7.eligibleObservationCount).toBe(2);
      expect(delBomT7.quality.ineligibleObservationCount).toBe(1);
      expect(delBomT7.sourceBreakdown).toEqual({
        IndiGo: 1,
        'Air India': 1,
      });

      const delBomT1 = aggregations.find(
        (a) => a.routeKey === 'DEL-BOM' && a.leadTimeBucket === 'T+1'
      );
      expect(delBomT1).toBeDefined();
      expect(delBomT1.representativeFare).toBe(8500);
      expect(delBomT1.observationCount).toBe(1);
      expect(delBomT1.eligibleObservationCount).toBe(1);

      const blrHydT15 = aggregations.find(
        (a) => a.routeKey === 'BLR-HYD' && a.leadTimeBucket === 'T+15'
      );
      expect(blrHydT15).toBeDefined();
      expect(blrHydT15.representativeFare).toBe(3200);
    });

    it('23. no eligible observations produce NO fake fare or empty aggregation document', () => {
      const recordsWithNoEligible = [
        {
          scrapedAt: '2026-09-04T06:00:00Z',
          departureDate: '2026-09-11',
          origin: 'DEL',
          destination: 'BOM',
          tripType: 'round-trip', // Ineligible
          fare: { observedFare: 12000, currency: 'INR' },
          quality: { indexEligible: false, flags: ['ROUND_TRIP'] },
        },
      ];

      const aggregations = DailyRouteAggregationService.processObservations(
        recordsWithNoEligible,
        '2026-09-04'
      );

      // Should produce 0 documents
      expect(aggregations).toHaveLength(0);
    });

    it('24. date and timezone handling extracts canonical calendar date consistently', () => {
      // Testing across various ISO timestamps with different UTC offsets
      expect(getCalendarDateString('2026-09-04T00:00:00.000Z')).toBe('2026-09-04');
      expect(getCalendarDateString('2026-09-04T23:59:59.999Z')).toBe('2026-09-04');
      expect(getCalendarDateString('2026-09-04T06:22:33.793390+05:30')).toBe('2026-09-04');
    });
  });

  describe('5. Aggregation API Endpoints', () => {
    it('28. POST /api/index/aggregate validates input date and triggers aggregation', async () => {
      // Test missing date
      const badReq1 = await request(app).post('/api/index/aggregate').send({});
      expect(badReq1.status).toBe(400);
      expect(badReq1.body.message).toContain('valid date string');

      // Test invalid date format
      const badReq2 = await request(app)
        .post('/api/index/aggregate')
        .send({ date: 'not-a-date' });
      expect(badReq2.status).toBe(400);
      expect(badReq2.body.message).toContain('Invalid date format');

      // Test valid date request (runs in degraded memory mode when DB offline)
      const goodReq = await request(app)
        .post('/api/index/aggregate')
        .send({ date: '2026-09-04' });
      expect(goodReq.status).toBe(200);
      expect(goodReq.body.success).toBe(true);
      expect(goodReq.body.collectionDate).toBe('2026-09-04');
    });

    it('GET /api/index/aggregations returns list of aggregations', async () => {
      const response = await request(app).get('/api/index/aggregations?date=2026-09-04');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
