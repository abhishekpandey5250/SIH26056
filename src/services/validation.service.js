import { QualityFlag } from '../types/scraper.types.js';
import { isDomesticIndianRoute, isIndianAirport } from '../utils/airportCodes.js';

/**
 * Validates a normalized flight observation and assigns quality flags and index eligibility.
 */
export function validateObservation(normalized, rawRecord) {
  const flags = [];
  const validationErrors = [];

  // Check if raw record is fundamentally malformed
  if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) {
    return {
      isValid: false,
      indexEligible: false,
      flags: [QualityFlag.MALFORMED_RECORD],
      validationErrors: ['Input record is not a valid JSON object'],
    };
  }

  // 1. Airport / Route Validation
  if (!normalized.origin) {
    flags.push(QualityFlag.MISSING_ORIGIN);
    validationErrors.push('Origin airport code is missing or invalid');
  }

  if (!normalized.destination) {
    flags.push(QualityFlag.MISSING_DESTINATION);
    validationErrors.push('Destination airport code is missing or invalid');
  }

  if (normalized.origin && normalized.destination && normalized.origin === normalized.destination) {
    flags.push(QualityFlag.SAME_ORIGIN_DESTINATION);
    validationErrors.push('Origin and destination airport codes cannot be identical');
  }

  // Route Geographic Scope: Must be domestic Indian route for index eligibility
  if (normalized.origin && normalized.destination) {
    const isDomestic = isDomesticIndianRoute(normalized.origin, normalized.destination);
    if (!isDomestic) {
      flags.push(QualityFlag.INTERNATIONAL_ROUTE);
      if (!isIndianAirport(normalized.origin)) {
        validationErrors.push(`Origin ${normalized.origin} is not a recognized Indian domestic airport`);
      }
      if (!isIndianAirport(normalized.destination)) {
        validationErrors.push(`Destination ${normalized.destination} is not a recognized Indian domestic airport`);
      }
    }
  }

  // 2. Date & Timestamp Validation
  if (!normalized.departureDate) {
    flags.push(QualityFlag.INVALID_DEPARTURE_DATE);
    validationErrors.push('Departure date is missing or not in a recognizable date format');
  }

  if (!normalized.scrapedAt) {
    flags.push(QualityFlag.MISSING_SCRAPED_AT);
    validationErrors.push('Scraped timestamp is missing or invalid');
  }

  // 3. Pricing & Currency Validation
  if (normalized.observedFare === null || normalized.observedFare === undefined) {
    flags.push(QualityFlag.PRICE_UNAVAILABLE);
    validationErrors.push('Fare price is null or unavailable');
  } else if (normalized.observedFare <= 0) {
    flags.push(QualityFlag.INVALID_PRICE);
    validationErrors.push(`Observed fare must be positive, got ${normalized.observedFare}`);
  }

  if (!normalized.currency) {
    flags.push(QualityFlag.UNKNOWN_CURRENCY);
    validationErrors.push('Currency is unknown or missing');
  } else if (normalized.currency !== 'INR') {
    flags.push(QualityFlag.NON_INR_CURRENCY);
    validationErrors.push(`Currency is ${normalized.currency}, expected INR`);
  }

  // 4. Trip Type & Cabin Class Validation
  if (normalized.tripType === 'round-trip' || normalized.returnDate) {
    flags.push(QualityFlag.ROUND_TRIP);
  }

  if (normalized.cabinClass && normalized.cabinClass !== 'economy') {
    flags.push(QualityFlag.UNSUPPORTED_CABIN);
    validationErrors.push(`Cabin class ${normalized.cabinClass} is not supported for economy CPI index`);
  }

  // 5. Metadata Quality (Non-disqualifying for index eligibility)
  if (!normalized.flightNumber) {
    flags.push(QualityFlag.MISSING_FLIGHT_NUMBER);
  }

  if (!normalized.airline) {
    flags.push(QualityFlag.MISSING_AIRLINE);
  }

  if (normalized.stops === null || normalized.stops < 0) {
    flags.push(QualityFlag.INVALID_STOPS);
  }

  // Determine Record Validity: Can we store this in the database?
  const isValid = true;

  // Determine Index Eligibility:
  const disqualifyingFlags = new Set([
    QualityFlag.MISSING_ORIGIN,
    QualityFlag.MISSING_DESTINATION,
    QualityFlag.INVALID_AIRPORT_CODE,
    QualityFlag.INVALID_DEPARTURE_DATE,
    QualityFlag.PRICE_UNAVAILABLE,
    QualityFlag.INVALID_PRICE,
    QualityFlag.UNKNOWN_CURRENCY,
    QualityFlag.NON_INR_CURRENCY,
    QualityFlag.INTERNATIONAL_ROUTE,
    QualityFlag.SAME_ORIGIN_DESTINATION,
    QualityFlag.ROUND_TRIP,
    QualityFlag.UNSUPPORTED_CABIN,
    QualityFlag.MALFORMED_RECORD,
    QualityFlag.MISSING_SCRAPED_AT,
  ]);

  const hasDisqualifyingFlag = flags.some((flag) => disqualifyingFlags.has(flag));
  const indexEligible = isValid && !hasDisqualifyingFlag;

  return {
    isValid,
    indexEligible,
    flags,
    validationErrors,
  };
}
