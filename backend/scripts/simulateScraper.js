/**
 * SIH26056 Local Scraper Integration Simulator Client.
 * 
 * Simulates a real-world scraper transmission sending a batch of flight fare
 * quotes to the backend ingestion endpoint.
 * 
 * Usage:
 *   SCRAPER_API_KEY="your-key" node scripts/simulateScraper.js
 */

import '../src/config/env.js';
import { config } from '../src/config/env.js';

const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${config.port || 5000}`;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || config.scraperApiKey || 'dev-scraper-key-12345';

async function runSimulator() {
  console.log('===============================================================');
  console.log(' SIH26056: Real-time Airfare Price Index Scraper Simulator');
  console.log('===============================================================');
  console.log(`Target Backend: ${API_BASE_URL}/api/scraper/fares/batch`);
  console.log(`Auth Header:    X-SCRAPER-API-KEY (Length: ${SCRAPER_API_KEY.length} chars)\n`);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Generate target departure dates for exact advance windows
  const addDays = (d, n) => {
    const target = new Date(d);
    target.setUTCDate(target.getUTCDate() + n);
    return target.toISOString().split('T')[0];
  };

  const sampleBatch = [
    {
      source: 'IndiGo_Direct',
      scraped_at: now.toISOString(),
      origin: 'DEL',
      destination: 'BOM',
      departure_date: addDays(now, 7), // T+7
      airline: 'IndiGo',
      flight_number: '6E-5012',
      departure_time: '07:15',
      arrival_time: '09:30',
      duration: '2 hr 15 min',
      duration_minutes: 135,
      stops: 0,
      price: 4850,
      currency: 'INR',
      cabin_class: 'economy',
      trip_type: 'one-way',
      search_url: 'https://www.goindigo.in',
    },
    {
      source: 'AirIndia_Direct',
      scraped_at: now.toISOString(),
      origin: 'DEL',
      destination: 'BLR',
      departure_date: addDays(now, 7), // T+7
      airline: 'Air India',
      flight_number: 'AI-506',
      departure_time: '09:45',
      arrival_time: '12:30',
      duration: '2 hr 45 min',
      duration_minutes: 165,
      stops: 0,
      price: 5400,
      currency: 'INR',
      cabin_class: 'economy',
      trip_type: 'one-way',
      search_url: 'https://www.airindia.com',
    },
    {
      source: 'Akasa_Direct',
      scraped_at: now.toISOString(),
      origin: 'BOM',
      destination: 'BLR',
      departure_date: addDays(now, 7), // T+7
      airline: 'Akasa Air',
      flight_number: 'QP-1102',
      departure_time: '14:20',
      arrival_time: '16:00',
      duration: '1 hr 40 min',
      duration_minutes: 100,
      stops: 0,
      price: 6100,
      currency: 'INR',
      cabin_class: 'economy',
      trip_type: 'one-way',
    },
    {
      source: 'SpiceJet_OTA',
      scraped_at: now.toISOString(),
      origin: 'DEL',
      destination: 'BOM',
      departure_date: addDays(now, 1), // T+1
      airline: 'SpiceJet',
      flight_number: 'SG-8194',
      departure_time: '06:00',
      arrival_time: '08:15',
      duration: '2 hr 15 min',
      duration_minutes: 135,
      stops: 0,
      price_raw: '₹8,200',
      price: 8200,
      currency: 'INR',
      cabin_class: 'economy',
      trip_type: 'one-way',
    },
    {
      source: 'MakeMyTrip',
      scraped_at: now.toISOString(),
      origin: 'DEL',
      destination: 'CCU',
      departure_date: addDays(now, 30), // T+30
      airline: 'IndiGo',
      flight_number: 'N/A', // Missing flight number test
      departure_time: '11:00',
      arrival_time: '13:10',
      duration: '2 hr 10 min',
      stops: 'non-stop',
      price: 3900,
      currency: 'INR',
      cabin_class: 'economy',
      trip_type: 'one-way',
    },
  ];

  console.log(`Transmitting batch of ${sampleBatch.length} simulated observations...`);

  try {
    const res = await fetch(`${API_BASE_URL}/api/scraper/fares/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SCRAPER-API-KEY': SCRAPER_API_KEY,
      },
      body: JSON.stringify({ observations: sampleBatch }),
    });

    const data = await res.json();

    console.log(`\nResponse Status: HTTP ${res.status}`);
    console.log('Result Payload:');
    console.log(JSON.stringify(data, null, 2));

    if (res.ok && data.success) {
      console.log('\n---------------------------------------------------------------');
      console.log('✅ BATCH INGESTION SUCCESSFUL');
      console.log(`• Total Received:    ${data.received}`);
      console.log(`• Newly Stored:      ${data.stored}`);
      console.log(`• Duplicates:        ${data.duplicates}`);
      console.log(`• Index-Eligible:    ${data.indexEligible}`);
      console.log(`• Flagged Records:   ${data.flagged}`);
      console.log(`• Rejected Records:  ${data.rejected}`);
      console.log('---------------------------------------------------------------');
    } else {
      console.error('\n❌ INGESTION FAILED:', data.message || 'Unknown error');
    }
  } catch (err) {
    console.error('\n❌ NETWORK ERROR: Unable to reach backend server.');
    console.error(`Reason: ${err.message}`);
    console.log('\nMake sure backend is running on http://localhost:5000 (`node src/server.js`)');
  }
}

runSimulator();
