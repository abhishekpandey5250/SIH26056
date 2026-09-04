import { normalizeAirportCode } from '../utils/airportCodes.js';

/**
 * Parses numeric price from number, string ("₹7,890", "7890.50"), or returns null if unavailable.
 */
export function normalizePrice(price, priceRaw) {
  if (typeof price === 'number' && !isNaN(price)) {
    return price;
  }
  if (typeof price === 'string' && price.trim()) {
    const cleaned = price.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
  }
  if (priceRaw && typeof priceRaw === 'string') {
    const cleaned = priceRaw.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
  }
  return null;
}

/**
 * Normalizes currency string (e.g., "INR", "UNKNOWN" -> null).
 */
export function normalizeCurrency(currency) {
  if (typeof currency !== 'string') return null;
  const cleaned = currency.trim().toUpperCase();
  if (['UNKNOWN', 'N/A', 'NA', 'NULL', 'NONE', ''].includes(cleaned)) {
    return null;
  }
  return cleaned;
}

/**
 * Normalizes flight number (e.g. "N/A", "NONE" -> null).
 */
export function normalizeFlightNumber(flightNumber) {
  if (typeof flightNumber !== 'string') return null;
  const cleaned = flightNumber.trim().toUpperCase();
  if (['N/A', 'NA', 'NONE', 'NULL', 'UNKNOWN', '-'].includes(cleaned) || cleaned === '') {
    return null;
  }
  return flightNumber.trim();
}

/**
 * Parses duration string (e.g. "1 hr 10 min", "2h 30m", "70 min") into total minutes.
 */
export function normalizeDurationMinutes(durationMinutes, durationStr) {
  if (typeof durationMinutes === 'number' && !isNaN(durationMinutes)) {
    return durationMinutes;
  }
  if (typeof durationMinutes === 'string') {
    const parsed = parseInt(durationMinutes, 10);
    if (!isNaN(parsed)) return parsed;
  }
  if (typeof durationStr === 'string' && durationStr.trim()) {
    let total = 0;
    const hrMatch = durationStr.match(/(\d+)\s*(?:hr|hrs|h)/i);
    const minMatch = durationStr.match(/(\d+)\s*(?:min|mins|m)/i);
    if (hrMatch) total += parseInt(hrMatch[1], 10) * 60;
    if (minMatch) total += parseInt(minMatch[1], 10);
    if (total > 0) return total;
  }
  return null;
}

/**
 * Parses stops count safely.
 */
export function normalizeStops(stops) {
  if (typeof stops === 'number' && !isNaN(stops)) {
    return stops >= 0 ? stops : null;
  }
  if (typeof stops === 'string') {
    const cleaned = stops.toLowerCase().trim();
    if (cleaned.includes('non-stop') || cleaned.includes('direct') || cleaned === '0') return 0;
    const parsed = parseInt(cleaned, 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }
  return 0; // Default to 0 if unspecified
}

/**
 * Parses departure or return date into standard YYYY-MM-DD format if possible.
 */
export function normalizeDateString(dateStr) {
  if (typeof dateStr !== 'string' || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : trimmed;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
}

/**
 * Normalizes scraped_at timestamp into Date object.
 */
export function normalizeScrapedAt(scrapedAt) {
  if (scrapedAt instanceof Date && !isNaN(scrapedAt.getTime())) {
    return scrapedAt;
  }
  if (typeof scrapedAt === 'string' && scrapedAt.trim()) {
    const parsed = new Date(scrapedAt.trim());
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Transforms a raw scraper payload into canonical normalized fields.
 */
export function normalizeScraperRecord(record = {}) {
  const source = (typeof record.source === 'string' && record.source.trim()) || 'ota_scraper';
  const dataEnvironment = (
    typeof record.dataEnvironment === 'string'
      ? record.dataEnvironment
      : typeof record.data_environment === 'string'
      ? record.data_environment
      : 'REAL'
  ).trim().toUpperCase();

  const scrapedAt = normalizeScrapedAt(record.scraped_at);
  const origin = normalizeAirportCode(record.origin);
  const destination = normalizeAirportCode(record.destination);
  const departureDate = normalizeDateString(record.departure_date);
  const returnDate = normalizeDateString(record.return_date);
  const tripType = (typeof record.trip_type === 'string' && record.trip_type.trim().toLowerCase()) || (returnDate ? 'round-trip' : 'one-way');
  const cabinClass = (typeof record.cabin_class === 'string' && record.cabin_class.trim().toLowerCase()) || 'economy';

  const passengers = typeof record.passengers === 'number' && record.passengers > 0
    ? record.passengers
    : parseInt(String(record.passengers || '1'), 10) || 1;

  const airline = (typeof record.airline === 'string' && record.airline.trim()) || null;
  const flightNumber = normalizeFlightNumber(record.flight_number);
  const departureTime = (typeof record.departure_time === 'string' && record.departure_time.trim()) || null;
  const arrivalTime = (typeof record.arrival_time === 'string' && record.arrival_time.trim()) || null;
  const durationMinutes = normalizeDurationMinutes(record.duration_minutes, record.duration);
  const stops = normalizeStops(record.stops);

  const observedFare = normalizePrice(record.price, record.price_raw);
  const currency = normalizeCurrency(record.currency);
  const priceRaw = (typeof record.price_raw === 'string' && record.price_raw.trim()) || null;

  const searchUrl = (typeof record.search_url === 'string' && record.search_url.trim()) || null;
  const co2Emissions = (typeof record.co2_emissions === 'string' && record.co2_emissions.trim()) || null;
  const emissionsVariation = (typeof record.emissions_variation === 'string' && record.emissions_variation.trim()) || null;
  const rawText = (typeof record.raw_text === 'string' && record.raw_text.trim()) || null;

  return {
    source,
    dataEnvironment,
    scrapedAt,
    origin,
    destination,
    departureDate,
    returnDate,
    tripType,
    cabinClass,
    passengers,
    airline,
    flightNumber,
    departureTime,
    arrivalTime,
    durationMinutes,
    stops,
    observedFare,
    currency,
    priceRaw,
    searchUrl,
    co2Emissions,
    emissionsVariation,
    rawText,
  };
}
