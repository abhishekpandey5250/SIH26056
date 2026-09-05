/**
 * List of recognized IATA airport codes for Indian domestic commercial aviation.
 */
export const INDIAN_DOMESTIC_AIRPORTS = new Set([
  'DEL', 'BOM', 'BLR', 'HYD', 'MAA', 'CCU', 'AMD', 'PNQ', 'COK', 'GOI',
  'GOX', 'GAU', 'LKO', 'JAI', 'PAT', 'BBI', 'IXC', 'IXB', 'TRV', 'SXR',
  'IDR', 'NAG', 'VNS', 'ATQ', 'VTZ', 'CJB', 'IXM', 'IXR', 'IXZ', 'BDQ',
  'UDR', 'GAY', 'DED', 'RPR', 'IMF', 'DMU', 'AJL', 'IXA', 'SHL', 'TEZ',
  'IXS', 'RJA', 'TIR', 'VGA', 'HBX', 'IXG', 'IXE', 'MYQ', 'KLH', 'IXJ',
  'IXL', 'BHO', 'JLR', 'GWL', 'KNU', 'IXU', 'NDC', 'JDH', 'JSA', 'BKB',
  'KUU', 'DHM', 'STV', 'HDO', 'PYG', 'CNN', 'TRZ', 'TCR', 'BEK', 'AYJ',
  'HSS',
]);

/**
 * Normalizes airport code string by trimming and uppercasing.
 */
export function normalizeAirportCode(code) {
  if (!code || typeof code !== 'string') return null;
  const cleaned = code.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(cleaned) ? cleaned : cleaned || null;
}

/**
 * Checks if an airport code belongs to the known Indian domestic airports.
 */
export function isIndianAirport(code) {
  if (!code) return false;
  const normalized = normalizeAirportCode(code);
  return normalized ? INDIAN_DOMESTIC_AIRPORTS.has(normalized) : false;
}

import { PRODUCTION_20_ROUTES } from '../config/indexConfig.js';

const PRODUCTION_20_ROUTES_SET = new Set(PRODUCTION_20_ROUTES);

/**
 * Maps an origin-destination pair to its canonical routeId in the 20-route production basket.
 * Maps both forward and reverse directions (e.g., BOM-DEL -> DEL-BOM).
 * Supports GOX alias mapping to GOI.
 * 
 * @param {string} origin 
 * @param {string} destination 
 * @returns {string|null} Canonical routeId or null if not in 20-route production basket
 */
export function getCanonicalRouteId(origin, destination) {
  if (!origin || !destination) return null;

  let o = normalizeAirportCode(origin);
  let d = normalizeAirportCode(destination);
  if (!o || !d || o === d) return null;

  // Normalize Goa secondary code (GOX -> GOI for corridor grouping)
  if (o === 'GOX') o = 'GOI';
  if (d === 'GOX') d = 'GOI';

  const forward = `${o}-${d}`;
  const reverse = `${d}-${o}`;

  if (PRODUCTION_20_ROUTES_SET.has(forward)) {
    return forward;
  }
  if (PRODUCTION_20_ROUTES_SET.has(reverse)) {
    return reverse;
  }

  return null;
}

/**
 * Checks if both origin and destination represent an Indian domestic route.
 */
export function isDomesticIndianRoute(origin, destination) {
  return isIndianAirport(origin) && isIndianAirport(destination);
}


