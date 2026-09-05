import './env.js';

/**
 * Configurable Base Period Configuration for Prototype.
 * The base period represents the benchmark period against which subsequent
 * airfare price movements are measured (Base Index = 100.0).
 * 
 * Supports environment overrides:
 * - INDEX_BASE_START_DATE (e.g. '2026-08-01')
 * - INDEX_BASE_END_DATE   (e.g. '2026-08-31')
 * - INDEX_BASE_DATE       (sets both start and end date to a single anchor day)
 */
const envBaseStart = process.env.INDEX_BASE_START_DATE || process.env.INDEX_BASE_DATE || '2026-08-01';
const envBaseEnd = process.env.INDEX_BASE_END_DATE || process.env.INDEX_BASE_DATE || '2026-08-31';

export const DEFAULT_BASE_PERIOD = Object.freeze({
  startDate: envBaseStart,
  endDate: envBaseEnd,
  methodologyVersion: '1.0-prototype',
});

/**
 * Lead-Time Index Variant Identifier Map.
 */
export const INDEX_CODE_MAP = Object.freeze({
  'T+1': 'AIRFARE_T1',
  'T+7': 'AIRFARE_T7',
  'T+15': 'AIRFARE_T15',
  'T+30': 'AIRFARE_T30',
  'T+45': 'AIRFARE_T45',
});

export function getIndexCodeForBucket(bucket) {
  return INDEX_CODE_MAP[bucket] || `AIRFARE_${bucket.replace('+', '')}`;
}

/**
 * Authoritative 20-Route Production Basket & Normalized Weights for Indian Domestic Aviation.
 * Fixed weights derived from official DGCA scheduled domestic passenger volume.
 */
export const PRODUCTION_20_ROUTE_WEIGHTS = Object.freeze([
  { routeKey: 'DEL-BOM', origin: 'DEL', destination: 'BOM', weight: 0.13, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'DEL-BLR', origin: 'DEL', destination: 'BLR', weight: 0.09, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'BOM-BLR', origin: 'BOM', destination: 'BLR', weight: 0.08, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'DEL-HYD', origin: 'DEL', destination: 'HYD', weight: 0.06, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'BOM-GOI', origin: 'BOM', destination: 'GOI', weight: 0.05, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'DEL-CCU', origin: 'DEL', destination: 'CCU', weight: 0.05, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'BLR-HYD', origin: 'BLR', destination: 'HYD', weight: 0.04, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'DEL-MAA', origin: 'DEL', destination: 'MAA', weight: 0.05, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'DEL-AMD', origin: 'DEL', destination: 'AMD', weight: 0.05, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'BOM-HYD', origin: 'BOM', destination: 'HYD', weight: 0.04, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'BOM-MAA', origin: 'BOM', destination: 'MAA', weight: 0.04, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'BLR-MAA', origin: 'BLR', destination: 'MAA', weight: 0.03, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'DEL-PNQ', origin: 'DEL', destination: 'PNQ', weight: 0.06, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'BOM-CCU', origin: 'BOM', destination: 'CCU', weight: 0.04, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'BLR-GOI', origin: 'BLR', destination: 'GOI', weight: 0.03, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'HYD-MAA', origin: 'HYD', destination: 'MAA', weight: 0.03, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'DEL-GOI', origin: 'DEL', destination: 'GOI', weight: 0.05, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'BOM-AMD', origin: 'BOM', destination: 'AMD', weight: 0.04, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'BLR-CCU', origin: 'BLR', destination: 'CCU', weight: 0.04, source: 'DGCA_PRODUCTION_BASKET' },
  { routeKey: 'BLR-COK', origin: 'BLR', destination: 'COK', weight: 0.03, source: 'DGCA_PRODUCTION_BASKET' },
]);



export const PRODUCTION_20_ROUTES = Object.freeze(
  PRODUCTION_20_ROUTE_WEIGHTS.map((rw) => rw.routeKey)
);

export const DEMO_ROUTE_WEIGHTS = PRODUCTION_20_ROUTE_WEIGHTS;
