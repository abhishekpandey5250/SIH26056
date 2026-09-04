import { describe, it, expect } from 'vitest';
import {
  parseDGCARawCSV,
  normalizePeriodString,
  validateDGCARawRecord,
  convertDGCARawRecords,
} from '../scripts/convertDGCAReference.js';

describe('DGCA Unified Reference & Passenger Traffic Converter Utility', () => {
  it('1. parseDGCARawCSV parses comma-separated content with various header aliases', () => {
    const csvContent = `
origin,destination,passengers,average_purchase_fare,period,source
DEL,BOM,150000,4250,2026-08,DGCA_REPORT
DEL,BLR,120000,5100,2026-08,DGCA_REPORT
`;
    const rows = parseDGCARawCSV(csvContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      origin: 'DEL',
      destination: 'BOM',
      passengers: '150000',
      averagePurchaseFare: '4250',
      period: '2026-08',
      source: 'DGCA_REPORT',
    });
  });

  it('2. normalizePeriodString normalizes YYYY-MM, YYYY-Q#, and month names', () => {
    expect(normalizePeriodString('2026-08')).toBe('2026-08');
    expect(normalizePeriodString('2026-08-15')).toBe('2026-08');
    expect(normalizePeriodString('2026-q1')).toBe('2026-Q1');
    expect(normalizePeriodString('Aug 2026')).toBe('2026-08');
    expect(normalizePeriodString('August 2026')).toBe('2026-08');
    expect(normalizePeriodString('2026-August')).toBe('2026-08');
    expect(normalizePeriodString(null)).toBeNull();
  });

  it('3. validateDGCARawRecord accepts valid domestic route with passengers and fare', () => {
    const raw = {
      origin: 'del',
      destination: 'bom',
      passengers: 185000,
      average_purchase_fare: 4320.5,
      period: '2026-08',
      source: 'DGCA_DOMESTIC_REPORT',
    };

    const result = validateDGCARawRecord(raw, 'REAL');
    expect(result.valid).toBe(true);
    expect(result.route).toBe('DEL-BOM');
    expect(result.period).toBe('2026-08');

    // Traffic record check
    expect(result.trafficRecord).toBeDefined();
    expect(result.trafficRecord.passengers).toBe(185000);
    expect(result.trafficRecord.dataEnvironment).toBe('REAL');

    // Reference fare check (preserves monthly aggregate)
    expect(result.fareRecord).toBeDefined();
    expect(result.fareRecord.averageFare).toBe(4320.5);
    expect(result.fareRecord.month).toBe('2026-08');
    expect(result.fareRecord.dataEnvironment).toBe('REAL');
    expect(result.fareRecord.isMonthlyAggregate).toBe(true);
  });

  it('4. validateDGCARawRecord accepts row with only passengers (yields trafficRecord only)', () => {
    const raw = {
      from: 'BOM',
      to: 'BLR',
      pax: '95000',
      period: '2026-Q2',
    };

    const result = validateDGCARawRecord(raw, 'REAL');
    expect(result.valid).toBe(true);
    expect(result.trafficRecord).toBeDefined();
    expect(result.trafficRecord.passengers).toBe(95000);
    expect(result.fareRecord).toBeNull();
  });

  it('5. validateDGCARawRecord accepts row with only fare (yields fareRecord only)', () => {
    const raw = {
      city1: 'DEL',
      city2: 'MAA',
      avg_fare: '4890.00',
      month: '2026-07',
    };

    const result = validateDGCARawRecord(raw, 'REAL');
    expect(result.valid).toBe(true);
    expect(result.trafficRecord).toBeNull();
    expect(result.fareRecord).toBeDefined();
    expect(result.fareRecord.averageFare).toBe(4890);
  });

  it('6. validateDGCARawRecord rejects invalid international airport codes', () => {
    const raw = {
      origin: 'DEL',
      destination: 'DXB', // Dubai - International
      passengers: 50000,
      period: '2026-08',
    };

    const result = validateDGCARawRecord(raw, 'REAL');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not a valid Indian domestic route');
  });

  it('7. validateDGCARawRecord rejects identical origin and destination', () => {
    const raw = {
      origin: 'DEL',
      destination: 'DEL',
      passengers: 50000,
      period: '2026-08',
    };

    const result = validateDGCARawRecord(raw, 'REAL');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be identical');
  });

  it('8. validateDGCARawRecord rejects rows with zero or negative numbers without fabricating values', () => {
    const raw = {
      origin: 'DEL',
      destination: 'BOM',
      passengers: 0,
      average_purchase_fare: -100,
      period: '2026-08',
    };

    const result = validateDGCARawRecord(raw, 'REAL');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('contains neither valid passengers count');
  });

  it('9. convertDGCARawRecords segregates rows and provides honest summary', () => {
    const rows = [
      { origin: 'DEL', destination: 'BOM', passengers: 150000, average_purchase_fare: 4200, period: '2026-08' },
      { origin: 'DEL', destination: 'BLR', passengers: 120000, average_purchase_fare: 5100, period: '2026-08' },
      { origin: 'DEL', destination: 'LHR', passengers: 80000, period: '2026-08' }, // Invalid international
      { origin: 'BOM', destination: 'HYD', passengers: -50, period: '2026-08' }, // Invalid passengers
    ];

    const summary = convertDGCARawRecords(rows, { dataEnvironment: 'REAL' });
    expect(summary.totalReceived).toBe(4);
    expect(summary.validTrafficCount).toBe(2);
    expect(summary.validFareCount).toBe(2);
    expect(summary.rejectedCount).toBe(2);
    expect(summary.dataEnvironment).toBe('REAL');
    expect(summary.rejectedRows).toHaveLength(2);
  });
});
