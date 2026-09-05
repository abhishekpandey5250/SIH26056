import crypto from 'crypto';

/**
 * Computes a deterministic SHA-256 deduplication hash based on canonical flight identity fields.
 */
export function generateDeduplicationHash(fields = {}) {
  const source = (fields.source || 'ota_scraper').trim().toLowerCase();
  const origin = (fields.origin || '').trim().toUpperCase();
  const destination = (fields.destination || '').trim().toUpperCase();
  const departureDate = (fields.departureDate || '').trim();
  const airline = (fields.airline || '').trim().toUpperCase();
  const flightNumber = (fields.flightNumber || '').trim().toUpperCase();
  const departureTime = (fields.departureTime || '').trim().toUpperCase();
  const observedFare = fields.observedFare != null ? String(fields.observedFare) : 'NULL';
  const dataEnvironment = (fields.dataEnvironment || 'REAL').trim().toUpperCase();

  let scrapedAtStr = '';
  if (fields.scrapedAt instanceof Date) {
    scrapedAtStr = fields.scrapedAt.toISOString();
  } else if (typeof fields.scrapedAt === 'string') {
    scrapedAtStr = fields.scrapedAt.trim();
  }

  const canonicalString = [
    source,
    origin,
    destination,
    departureDate,
    airline,
    flightNumber,
    departureTime,
    observedFare,
    scrapedAtStr,
    dataEnvironment,
  ].join('|');

  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}
