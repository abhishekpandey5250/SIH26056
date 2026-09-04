/**
 * Realistic Scraper Observation Batch Fixture for SIH26056 End-to-End Pipeline Testing.
 * Represents multi-airline, multi-route domestic observations covering all 5 lead-time windows
 * plus intentional edge cases (international, round-trip, null fare, duplicate, unknown currency).
 */
export const realisticScraperBatch = [
  // 1. DEL -> BOM (T+7, IndiGo) - Valid
  {
    source: 'IndiGo',
    scraped_at: '2026-09-04T06:00:00.000Z',
    origin: 'DEL',
    destination: 'BOM',
    departure_date: '2026-09-11', // +7 days
    airline: 'IndiGo',
    flight_number: '6E-205',
    departure_time: '08:30',
    arrival_time: '10:45',
    duration_minutes: 135,
    stops: 0,
    price: 4800,
    currency: 'INR',
    cabin_class: 'economy',
    trip_type: 'one-way',
  },

  // 2. DEL -> BOM (T+7, Air India) - Valid
  {
    source: 'Air India',
    scraped_at: '2026-09-04T06:00:00.000Z',
    origin: 'DEL',
    destination: 'BOM',
    departure_date: '2026-09-11', // +7 days
    airline: 'Air India',
    flight_number: 'AI-805',
    departure_time: '14:00',
    arrival_time: '16:15',
    duration_minutes: 135,
    stops: 0,
    price: 5200,
    currency: 'INR',
    cabin_class: 'economy',
    trip_type: 'one-way',
  },

  // 3. DEL -> BLR (T+7, Akasa Air) - Valid
  {
    source: 'Akasa Air',
    scraped_at: '2026-09-04T06:00:00.000Z',
    origin: 'DEL',
    destination: 'BLR',
    departure_date: '2026-09-11', // +7 days
    airline: 'Akasa Air',
    flight_number: 'QP-1321',
    departure_time: '09:15',
    arrival_time: '12:00',
    duration_minutes: 165,
    stops: 0,
    price: 5500,
    currency: 'INR',
    cabin_class: 'economy',
    trip_type: 'one-way',
  },

  // 4. BOM -> BLR (T+7, SpiceJet) - Valid
  {
    source: 'SpiceJet',
    scraped_at: '2026-09-04T06:00:00.000Z',
    origin: 'BOM',
    destination: 'BLR',
    departure_date: '2026-09-11', // +7 days
    airline: 'SpiceJet',
    flight_number: 'SG-415',
    departure_time: '18:45',
    arrival_time: '20:30',
    duration_minutes: 105,
    stops: 0,
    price: 6300,
    currency: 'INR',
    cabin_class: 'economy',
    trip_type: 'one-way',
  },

  // 5. DEL -> BOM (T+1, IndiGo) - Valid
  {
    source: 'IndiGo',
    scraped_at: '2026-09-04T06:00:00.000Z',
    origin: 'DEL',
    destination: 'BOM',
    departure_date: '2026-09-05', // +1 day
    airline: 'IndiGo',
    flight_number: '6E-5012',
    departure_time: '06:00',
    arrival_time: '08:15',
    duration_minutes: 135,
    stops: 0,
    price: 8500,
    currency: 'INR',
    cabin_class: 'economy',
    trip_type: 'one-way',
  },

  // 6. DEL -> BOM (T+15, Air India) - Valid
  {
    source: 'Air India',
    scraped_at: '2026-09-04T06:00:00.000Z',
    origin: 'DEL',
    destination: 'BOM',
    departure_date: '2026-09-19', // +15 days
    airline: 'Air India',
    flight_number: 'AI-665',
    departure_time: '11:30',
    arrival_time: '13:45',
    duration_minutes: 135,
    stops: 0,
    price: 4200,
    currency: 'INR',
    cabin_class: 'economy',
    trip_type: 'one-way',
  },

  // 7. DEL -> CCU (T+30, IndiGo) - Valid
  {
    source: 'IndiGo',
    scraped_at: '2026-09-04T06:00:00.000Z',
    origin: 'DEL',
    destination: 'CCU',
    departure_date: '2026-10-04', // +30 days
    airline: 'IndiGo',
    flight_number: '6E-291',
    departure_time: '07:00',
    arrival_time: '09:15',
    duration_minutes: 135,
    stops: 0,
    price: 3900,
    currency: 'INR',
    cabin_class: 'economy',
    trip_type: 'one-way',
  },

  // 8. BLR -> HYD (T+45, Akasa Air) - Valid
  {
    source: 'Akasa Air',
    scraped_at: '2026-09-04T06:00:00.000Z',
    origin: 'BLR',
    destination: 'HYD',
    departure_date: '2026-10-19', // +45 days
    airline: 'Akasa Air',
    flight_number: 'QP-1102',
    departure_time: '15:20',
    arrival_time: '16:30',
    duration_minutes: 70,
    stops: 0,
    price: 2800,
    currency: 'INR',
    cabin_class: 'economy',
    trip_type: 'one-way',
  },

  // 9. MAA -> DEL (T+7, MakeMyTrip) - Valid with missing flight number (N/A)
  {
    source: 'MakeMyTrip',
    scraped_at: '2026-09-04T06:00:00.000Z',
    origin: 'MAA',
    destination: 'DEL',
    departure_date: '2026-09-11', // +7 days
    airline: 'IndiGo',
    flight_number: 'N/A',
    price_raw: '₹6,100',
    currency: 'INR',
    duration: '2 hr 45 min',
    stops: 'non-stop',
  },

  // === Intentional Edge Cases & Flagged Records ===

  // 10. Missing Fare Price (Null price) -> Price unavailable flag
  {
    source: 'EaseMyTrip',
    scraped_at: '2026-09-04T06:00:00.000Z',
    origin: 'DEL',
    destination: 'BOM',
    departure_date: '2026-09-11',
    airline: 'IndiGo',
    flight_number: '6E-999',
    price: null,
    currency: 'INR',
  },

  // 11. Unknown Currency -> Currency unknown flag
  {
    source: 'IndiGo',
    scraped_at: '2026-09-04T06:00:00.000Z',
    origin: 'DEL',
    destination: 'BOM',
    departure_date: '2026-09-11',
    airline: 'IndiGo',
    flight_number: '6E-888',
    price: 5000,
    currency: 'UNKNOWN',
  },

  // 12. Round-Trip Quote -> Excluded from CPI index aggregation
  {
    source: 'MakeMyTrip',
    scraped_at: '2026-09-04T06:00:00.000Z',
    origin: 'DEL',
    destination: 'BOM',
    departure_date: '2026-09-11',
    return_date: '2026-09-20',
    trip_type: 'round-trip',
    airline: 'IndiGo',
    flight_number: '6E-777',
    price: 11000,
    currency: 'INR',
  },

  // 13. International Route (DEL -> DXB) -> Excluded from domestic CPI index
  {
    source: 'Air India',
    scraped_at: '2026-09-04T06:00:00.000Z',
    origin: 'DEL',
    destination: 'DXB',
    departure_date: '2026-09-11',
    airline: 'Air India',
    flight_number: 'AI-995',
    price: 18000,
    currency: 'INR',
  },

  // 14. Non-INR Currency (USD) -> Excluded from INR index
  {
    source: 'Expedia',
    scraped_at: '2026-09-04T06:00:00.000Z',
    origin: 'DEL',
    destination: 'BOM',
    departure_date: '2026-09-11',
    airline: 'IndiGo',
    flight_number: '6E-333',
    price: 75,
    currency: 'USD',
  },

  // 15. Exact Duplicate of Record 1 (Testing SHA-256 deduplication)
  {
    source: 'IndiGo',
    scraped_at: '2026-09-04T06:00:00.000Z',
    origin: 'DEL',
    destination: 'BOM',
    departure_date: '2026-09-11',
    airline: 'IndiGo',
    flight_number: '6E-205',
    departure_time: '08:30',
    arrival_time: '10:45',
    duration_minutes: 135,
    stops: 0,
    price: 4800,
    currency: 'INR',
    cabin_class: 'economy',
    trip_type: 'one-way',
  },
];
