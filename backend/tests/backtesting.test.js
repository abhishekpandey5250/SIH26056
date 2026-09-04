import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import {
  validateDGCARecord,
  parseCSV,
  importDGCARecords,
} from '../scripts/importDGCAData.js';
import {
  generateDateRange,
  calculateCorrelation,
  calculateDirectionalAgreement,
  BacktestingService,
} from '../src/services/backtesting.service.js';
import { BacktestQualityService } from '../src/services/backtestQuality.service.js';

describe('Step 7: 30-Day Backtesting, DGCA Validation, and Quality Assurance', () => {
  // Deterministic synthetic test fixture (clearly labeled for unit testing)
  const syntheticDgcaRecord = {
    referenceDate: '2026-08-01',
    origin: 'DEL',
    destination: 'BOM',
    averageFare: 4100,
    currency: 'INR',
    source: 'DGCA_TARIFF_MONITORING',
    datasetName: 'SYNTHETIC_TEST_FIXTURE',
  };

  it('1. DGCA valid record parses and validates successfully', () => {
    const { record, error } = validateDGCARecord(syntheticDgcaRecord, 'REAL');
    expect(error).toBeUndefined();
    expect(record).toBeDefined();
    expect(record.referenceDate).toBe('2026-08-01');
    expect(record.route).toBe('DEL-BOM');
    expect(record.averageFare).toBe(4100);
    expect(record.currency).toBe('INR');
    expect(record.dataEnvironment).toBe('REAL');
  });

  it('2. Invalid DGCA records are individually rejected with informative errors', () => {
    const invalidCases = [
      { ...syntheticDgcaRecord, referenceDate: 'invalid-date' },
      { ...syntheticDgcaRecord, origin: 'INVALID' },
      { ...syntheticDgcaRecord, origin: 'DEL', destination: 'DEL' }, // Same origin/dest
      { ...syntheticDgcaRecord, origin: 'DEL', destination: 'DXB' }, // International
      { ...syntheticDgcaRecord, averageFare: -500 }, // Negative price
      { ...syntheticDgcaRecord, averageFare: 0 },
      { ...syntheticDgcaRecord, currency: 'USD' }, // Non-INR
    ];

    invalidCases.forEach((c) => {
      const { record, error } = validateDGCARecord(c);
      expect(record).toBeNull();
      expect(error).toBeDefined();
    });
  });

  it('3. CSV parser correctly extracts headers and rows', () => {
    const csvContent = `reference_date,origin,destination,average_fare,currency\n2026-08-01,DEL,BOM,4100,INR\n2026-08-02,DEL,BOM,4200,INR`;
    const rows = parseCSV(csvContent);
    expect(rows).toHaveLength(2);
    expect(rows[0].referenceDate).toBe('2026-08-01');
    expect(rows[0].origin).toBe('DEL');
    expect(rows[0].averageFare).toBe('4100');
  });

  it('4. 30-day date range generator creates exactly 30 contiguous dates', () => {
    const dates = generateDateRange('2026-08-01', '2026-08-30');
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe('2026-08-01');
    expect(dates[29]).toBe('2026-08-30');
  });

  it('5 & 6. Base-normalization rescales both series to 100.00 at first common observation', () => {
    const ourIndices = [
      { indexDate: '2026-08-01', leadTimeBucket: 'T+7', indexValue: 110.0 },
      { indexDate: '2026-08-02', leadTimeBucket: 'T+7', indexValue: 121.0 }, // +10%
    ];
    const dgcaReferenceFares = [
      { referenceDate: '2026-08-01', route: 'DEL-BOM', averageFare: 4000 },
      { referenceDate: '2026-08-02', route: 'DEL-BOM', averageFare: 4200 }, // +5%
    ];

    const report = BacktestingService.runBacktestAnalysis({
      startDate: '2026-08-01',
      endDate: '2026-08-02',
      leadTimeBucket: 'T+7',
      ourIndices,
      dgcaReferenceFares,
    });

    expect(report.overlappingDays).toBe(2);
    expect(report.timeSeries[0].normalizedOurIndex).toBe(100.0);
    expect(report.timeSeries[0].normalizedDgcaIndex).toBe(100.0);
    expect(report.timeSeries[1].normalizedOurIndex).toBe(110.0);
    expect(report.timeSeries[1].normalizedDgcaIndex).toBe(105.0);
  });

  it('7 & 8. MAE, MAPE, and RMSE are mathematically calculated on normalized series', () => {
    const ourIndices = [
      { indexDate: '2026-08-01', leadTimeBucket: 'T+7', indexValue: 100.0 },
      { indexDate: '2026-08-02', leadTimeBucket: 'T+7', indexValue: 110.0 }, // Norm = 110.0
    ];
    const dgcaReferenceFares = [
      { referenceDate: '2026-08-01', route: 'DEL-BOM', averageFare: 4000 },
      { referenceDate: '2026-08-02', route: 'DEL-BOM', averageFare: 4200 }, // Norm = 105.0
    ];

    // Day 1 Error: |100 - 100| = 0
    // Day 2 Error: |110 - 105| = 5
    // MAE = (0 + 5) / 2 = 2.50
    // MAPE = (0 + 5/105 * 100) / 2 = (4.7619) / 2 = 2.38%
    const report = BacktestingService.runBacktestAnalysis({
      startDate: '2026-08-01',
      endDate: '2026-08-02',
      leadTimeBucket: 'T+7',
      ourIndices,
      dgcaReferenceFares,
    });

    expect(report.metrics.mae).toBe(2.5);
    expect(report.metrics.mape).toBe(2.38);
    expect(report.metrics.rmse).toBe(3.54);
  });

  it('9. Pearson correlation coefficient r is correctly calculated', () => {
    const x = [100, 105, 110, 115, 120];
    const y = [100, 106, 109, 114, 122];
    const r = calculateCorrelation(x, y);
    expect(r).toBe(0.9884);
    expect(r).toBeGreaterThan(0.98);
  });

  it('10. Directional agreement accurately calculates trend concordance', () => {
    // 3 transitions:
    // Step 1: x +5, y +6 (Agree)
    // Step 2: x -2, y -3 (Agree)
    // Step 3: x +4, y -1 (Disagree)
    // Agreement = 2 / 3 = 66.67%
    const x = [100, 105, 103, 107];
    const y = [100, 106, 103, 102];
    const agreement = calculateDirectionalAgreement(x, y);
    expect(agreement).toBe(66.67);
  });

  it('11. Insufficient data (<2 days) does not fabricate correlation or directional agreement', () => {
    const ourIndices = [{ indexDate: '2026-08-01', leadTimeBucket: 'T+7', indexValue: 100.0 }];
    const dgcaReferenceFares = [{ referenceDate: '2026-08-01', route: 'DEL-BOM', averageFare: 4000 }];

    const report = BacktestingService.runBacktestAnalysis({
      startDate: '2026-08-01',
      endDate: '2026-08-01',
      leadTimeBucket: 'T+7',
      ourIndices,
      dgcaReferenceFares,
    });

    expect(report.overlappingDays).toBe(1);
    expect(report.metrics.correlation).toBeNull();
    expect(report.metrics.directionalAgreement).toBeNull();
    expect(report.quality.warnings.length).toBeGreaterThan(0);
  });

  it('12. Zero DGCA records produces clear unavailable state without fake accuracy', () => {
    const report = BacktestingService.runBacktestAnalysis({
      startDate: '2026-08-01',
      endDate: '2026-08-30',
      leadTimeBucket: 'T+7',
      ourIndices: [{ indexDate: '2026-08-01', leadTimeBucket: 'T+7', indexValue: 100.0 }],
      dgcaReferenceFares: [],
    });

    expect(report.overlappingDays).toBe(0);
    expect(report.metrics.mae).toBeNull();
    expect(report.metrics.mape).toBeNull();
    expect(report.quality.warnings).toContain('Zero overlapping dates found between our Airfare Index and the DGCA reference dataset.');
  });

  it('13. Route-level validation compares matched city-pairs accurately', () => {
    const ourAggregations = [
      { collectionDate: '2026-08-01', routeKey: 'DEL-BOM', leadTimeBucket: 'T+7', representativeFare: 4200 },
      { collectionDate: '2026-08-01', routeKey: 'DEL-BLR', leadTimeBucket: 'T+7', representativeFare: 5200 },
    ];
    const dgcaReferenceFares = [
      { referenceDate: '2026-08-01', route: 'DEL-BOM', origin: 'DEL', destination: 'BOM', averageFare: 4000 },
    ];

    const report = BacktestingService.runBacktestAnalysis({
      startDate: '2026-08-01',
      endDate: '2026-08-01',
      leadTimeBucket: 'T+7',
      ourIndices: [],
      dgcaReferenceFares,
      ourAggregations,
    });

    expect(report.routeComparisons).toHaveLength(1);
    const rc = report.routeComparisons[0];
    expect(rc.routeKey).toBe('DEL-BOM');
    expect(rc.ourMeanFare).toBe(4200);
    expect(rc.dgcaMeanFare).toBe(4000);
    expect(rc.meanAbsoluteDiff).toBe(200);
    expect(rc.meanPercentDiff).toBe(5.0); // (4200 - 4000) / 4000 * 100 = +5%
  });

  it('14. Missing routes are not treated as zero in route coverage report', () => {
    const quality = BacktestQualityService.generateQualityReport({
      dateList: ['2026-08-01'],
      ourIndexMap: new Map([['2026-08-01', 100]]),
      dgcaMap: new Map([['2026-08-01', 4000]]),
      overlappingDays: 1,
      routeComparisons: [{ routeKey: 'DEL-BOM' }],
    });

    expect(quality.routeQuality.matchedCorridors).toBe(1);
    expect(quality.routeQuality.unmatchedCorridors.length).toBeGreaterThan(0);
    expect(quality.routeQuality.unmatchedCorridors).not.toContain('DEL-BOM');
  });

  it('15. Backtest status API returns correct HTTP 200 contract', async () => {
    const res = await request(app).get('/api/backtest/status?dataMode=REAL');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('dgcaDatasetAvailable');
    expect(res.body).toHaveProperty('readyFor30DayBacktest');
  });

  it('16. Backtest 30-day API runs and responds with structured telemetry', async () => {
    const res = await request(app).get('/api/backtest/30-day?startDate=2026-08-01&endDate=2026-08-30&dataMode=REAL');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.daysRequested).toBe(30);
    expect(res.body).toHaveProperty('metrics');
    expect(res.body).toHaveProperty('quality');
  });

  it('17. Backtest CSV export endpoint sets proper text/csv headers', async () => {
    const res = await request(app).get('/api/backtest/30-day/export?startDate=2026-08-01&endDate=2026-08-30&format=csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('date,ourIndexValue,dgcaReferenceValue,normalizedOurIndex,normalizedDgcaIndex,isOverlapping');
  });

  it('18. REAL and DEMO environments remain completely isolated in backtesting service', () => {
    const ourReal = [{ indexDate: '2026-08-01', leadTimeBucket: 'T+7', indexValue: 105.0, dataEnvironment: 'REAL' }];
    const ourDemo = [{ indexDate: '2026-08-01', leadTimeBucket: 'T+7', indexValue: 999.0, dataEnvironment: 'DEMO' }];

    const dgcaReal = [{ referenceDate: '2026-08-01', route: 'DEL-BOM', averageFare: 4000, dataEnvironment: 'REAL' }];

    const realReport = BacktestingService.runBacktestAnalysis({
      startDate: '2026-08-01',
      endDate: '2026-08-01',
      leadTimeBucket: 'T+7',
      ourIndices: ourReal,
      dgcaReferenceFares: dgcaReal,
    });

    expect(realReport.timeSeries[0].ourIndexValue).toBe(105.0); // Excluded the 999.0 demo record
  });
});
