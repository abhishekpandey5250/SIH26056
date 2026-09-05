/**
 * DGCA City-Pair Passenger Traffic Data Importer Script.
 * 
 * Imports official DGCA scheduled domestic passenger traffic statistics to derive representative route basket weights.
 * 
 * Usage:
 *   node scripts/importDGCATraffic.js ../data/dgca_traffic.csv
 *   node scripts/importDGCATraffic.js ../data/dgca_traffic.json --mode=REAL
 */

import '../src/config/env.js';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config/env.js';
import { connectDB, disconnectDB, isDatabaseConnected } from '../src/config/database.js';
import { DGCATraffic } from '../src/models/DGCATraffic.js';
import { normalizeAirportCode, isDomesticIndianRoute } from '../src/utils/airportCodes.js';
import { logger } from '../src/utils/logger.js';

/**
 * Parses raw CSV content for traffic statistics.
 */
export function parseTrafficCSV(content) {
  if (typeof content !== 'string' || !content.trim()) return [];

  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length < 2) return [];

  const rawHeaders = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const headerMap = {
    period: 'period',
    month: 'period',
    year: 'period',
    origin: 'origin',
    from: 'origin',
    destination: 'destination',
    dest: 'destination',
    to: 'destination',
    passengers: 'passengers',
    pax: 'passengers',
    passenger_count: 'passengers',
    traffic: 'passengers',
    traffictype: 'trafficType',
    traffic_type: 'trafficType',
    source: 'source',
    datasetname: 'datasetName',
    dataset_name: 'datasetName',
  };

  const headers = rawHeaders.map((h) => headerMap[h.toLowerCase()] || h);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const rawCols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (rawCols.length === headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = rawCols[idx];
      });
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Validates a single DGCA traffic observation.
 */
export function validateTrafficRecord(record = {}, defaultDataEnv = 'REAL', options = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { record: null, error: 'Record must be a valid JSON object' };
  }

  const period = (typeof record.period === 'string' && record.period.trim()) || options.period || '2026-Q1';
  const origin = normalizeAirportCode(record.origin || record.from);
  if (!origin) {
    return { record: null, error: `Invalid origin airport code: "${record.origin}".` };
  }

  const destination = normalizeAirportCode(record.destination || record.dest || record.to);
  if (!destination) {
    return { record: null, error: `Invalid destination airport code: "${record.destination}".` };
  }

  if (origin === destination) {
    return { record: null, error: `Origin and destination cannot be identical: ${origin}-${destination}.` };
  }

  if (!isDomesticIndianRoute(origin, destination)) {
    return { record: null, error: `Route ${origin}-${destination} is not a valid Indian domestic route.` };
  }

  let paxNum = typeof record.passengers === 'number' ? record.passengers : parseInt(String(record.passengers || '0').replace(/[^0-9]/g, ''), 10);
  if (isNaN(paxNum) || paxNum <= 0) {
    return { record: null, error: `Invalid passengers count: "${record.passengers}". Must be a positive integer.` };
  }

  const route = `${origin}-${destination}`;
  const trafficType = (typeof record.trafficType === 'string' && record.trafficType.trim()) || 'DOMESTIC_SCHEDULED';
  const source = (typeof record.source === 'string' && record.source.trim()) || 'DGCA_CITY_PAIR_TRAFFIC';
  const datasetName = (typeof record.datasetName === 'string' && record.datasetName.trim()) ||
    (typeof record.dataset_name === 'string' && record.dataset_name.trim()) ||
    'DGCA_TRAFFIC_STATISTICS';

  const dataEnvironment = (
    typeof record.dataEnvironment === 'string'
      ? record.dataEnvironment
      : defaultDataEnv
  ).trim().toUpperCase();

  return {
    record: {
      period,
      origin,
      destination,
      route,
      passengers: paxNum,
      trafficType,
      source,
      datasetName,
      dataEnvironment: dataEnvironment === 'DEMO' ? 'DEMO' : 'REAL',
    },
  };
}

/**
 * Bulk imports traffic records into MongoDB with deduplication.
 */
export async function importTrafficRecords(rawRecords = [], options = {}) {
  const defaultDataEnv = (options.dataEnvironment || options.dataMode || 'REAL').toUpperCase();
  const totalReceived = rawRecords.length;
  let rejectedCount = 0;
  const errors = [];
  const validRecords = [];

  rawRecords.forEach((raw, idx) => {
    const { record, error } = validateTrafficRecord(raw, defaultDataEnv, options);
    if (!record) {
      rejectedCount++;
      errors.push({ index: idx, error });
    } else {
      validRecords.push(record);
    }
  });

  let importedCount = 0;
  let duplicateCount = 0;

  if (isDatabaseConnected() && validRecords.length > 0) {
    const bulkOps = validRecords.map((r) => ({
      updateOne: {
        filter: {
          period: r.period,
          route: r.route,
          dataEnvironment: r.dataEnvironment,
        },
        update: { $set: r },
        upsert: true,
      },
    }));

    const result = await DGCATraffic.bulkWrite(bulkOps, { ordered: false });
    importedCount = result.upsertedCount + result.modifiedCount;
    duplicateCount = result.matchedCount;
  } else if (!isDatabaseConnected()) {
    importedCount = validRecords.length;
  }

  return {
    success: true,
    received: totalReceived,
    imported: importedCount,
    duplicates: duplicateCount,
    rejected: rejectedCount,
    dataEnvironment: defaultDataEnv,
    errors,
    validRecords,
  };
}

/**
 * Loads a file from disk and imports traffic records.
 */
export async function importTrafficFile(filePath, options = {}) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Traffic data file not found at: ${resolvedPath}`);
  }

  const rawContent = fs.readFileSync(resolvedPath, 'utf8');
  let rawRecords = [];

  if (resolvedPath.endsWith('.json')) {
    rawRecords = JSON.parse(rawContent);
    if (!Array.isArray(rawRecords)) {
      throw new Error('JSON traffic file must contain an array of records.');
    }
  } else {
    rawRecords = parseTrafficCSV(rawContent);
  }

  return await importTrafficRecords(rawRecords, options);
}

// CLI Execution Entry Point
async function main() {
  const args = process.argv.slice(2);
  const fileArg =
    args.find((a) => a.startsWith('--file='))?.split('=')[1] ||
    args.find((a) => !a.startsWith('--'));
  const periodArg = args.find((a) => a.startsWith('--period='))?.split('=')[1] || null;
  const modeArg = (args.find((a) => a.startsWith('--mode=')) || '--mode=REAL').split('=')[1].toUpperCase();

  if (!fileArg) {
    console.log('Usage:');
    console.log('  node scripts/importDGCATraffic.js <filePath.csv|.json> [--mode=REAL|DEMO] [--period=2026-Q1]');
    console.log('  node scripts/importDGCATraffic.js --file=<filePath> [--mode=REAL|DEMO] [--period=2026-Q1]');
    process.exit(0);
  }

  console.log('===============================================================');
  console.log(' SIH26056: DGCA Passenger Traffic Data Importer');
  console.log('===============================================================');
  console.log(`Target File:      ${fileArg}`);
  console.log(`Data Environment: ${modeArg}`);
  if (periodArg) {
    console.log(`Target Period:    ${periodArg}`);
  }

  try {
    await connectDB();
    console.log(`✓ Database status: ${isDatabaseConnected() ? 'Connected' : 'Degraded (In-Memory)'}`);

    const summary = await importTrafficFile(fileArg, {
      dataEnvironment: modeArg,
      ...(periodArg ? { period: periodArg } : {}),
    });

    console.log('\n---------------------------------------------------------------');
    console.log('✅ DGCA TRAFFIC IMPORT SUMMARY');
    console.log(`• Records Received:   ${summary.received}`);
    console.log(`• Records Imported:   ${summary.imported}`);
    console.log(`• Duplicate Matched:  ${summary.duplicates}`);
    console.log(`• Records Rejected:   ${summary.rejected}`);
    console.log(`• Data Environment:   ${summary.dataEnvironment}`);
    console.log('---------------------------------------------------------------');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ IMPORT FAILED:', err.message);
    await disconnectDB();
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('importDGCATraffic.js')) {
  main();
}
