/**
 * DGCA Reference Data Importer Script.
 * 
 * Imports official DGCA benchmark tariff reports and monthly reference fares from CSV or JSON files.
 * 
 * Usage:
 *   node scripts/importDGCAData.js ../data/dgca_reference.csv
 *   node scripts/importDGCAData.js ../data/dgca_reference.json --mode=REAL
 */

import '../src/config/env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../src/config/env.js';
import { connectDB, disconnectDB, isDatabaseConnected } from '../src/config/database.js';
import { DGCAReferenceFare } from '../src/models/DGCAReferenceFare.js';
import { normalizeAirportCode, isDomesticIndianRoute } from '../src/utils/airportCodes.js';
import { getCalendarDateString } from '../src/utils/dateUtils.js';
import { normalizePrice, normalizeCurrency } from '../src/services/normalization.service.js';
import { logger } from '../src/utils/logger.js';

/**
 * Parses raw CSV content into an array of row objects.
 */
export function parseCSV(content) {
  if (typeof content !== 'string' || !content.trim()) return [];

  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length < 2) return [];

  const rawHeaders = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const headerMap = {
    referencedate: 'referenceDate',
    reference_date: 'referenceDate',
    date: 'referenceDate',
    origin: 'origin',
    from: 'origin',
    destination: 'destination',
    dest: 'destination',
    to: 'destination',
    averagefare: 'averageFare',
    average_fare: 'averageFare',
    avg_fare: 'averageFare',
    fare: 'averageFare',
    price: 'averageFare',
    currency: 'currency',
    source: 'source',
    datasetname: 'datasetName',
    dataset_name: 'datasetName',
    month: 'month',
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
 * Validates and transforms a single DGCA raw record into canonical benchmark structure.
 */
export function validateDGCARecord(record = {}, defaultDataEnv = 'REAL') {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { record: null, error: 'Record must be a valid JSON object' };
  }

  const rawDate = record.referenceDate || record.reference_date || record.date;
  const canonicalDate = getCalendarDateString(rawDate);
  if (!canonicalDate) {
    return { record: null, error: `Invalid referenceDate format: "${rawDate}". Expected YYYY-MM-DD.` };
  }

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

  const fareNum = normalizePrice(record.averageFare || record.average_fare || record.price || record.fare);
  if (fareNum === null || fareNum <= 0) {
    return { record: null, error: `Invalid averageFare: "${record.averageFare}". Must be a strictly positive number.` };
  }

  const currency = normalizeCurrency(record.currency || 'INR');
  if (currency && currency !== 'INR') {
    return { record: null, error: `Invalid currency "${currency}". DGCA benchmark must be in INR.` };
  }

  const route = `${origin}-${destination}`;
  const month = (typeof record.month === 'string' && /^\d{4}-\d{2}$/.test(record.month.trim()))
    ? record.month.trim()
    : canonicalDate.slice(0, 7);

  const source = (typeof record.source === 'string' && record.source.trim()) || 'DGCA_MONTHLY_REPORT';
  const datasetName = (typeof record.datasetName === 'string' && record.datasetName.trim()) ||
    (typeof record.dataset_name === 'string' && record.dataset_name.trim()) ||
    'DGCA_BENCHMARK';

  const dataEnvironment = (
    typeof record.dataEnvironment === 'string'
      ? record.dataEnvironment
      : defaultDataEnv
  ).trim().toUpperCase();

  return {
    record: {
      referenceDate: canonicalDate,
      month,
      origin,
      destination,
      route,
      averageFare: Math.round(fareNum * 100) / 100,
      currency: 'INR',
      source,
      datasetName,
      dataEnvironment: dataEnvironment === 'DEMO' ? 'DEMO' : 'REAL',
    },
  };
}

/**
 * Programmatic importer function that validates, deduplicates, and saves records.
 */
export async function importDGCARecords(rawRecords = [], options = {}) {
  const defaultDataEnv = (options.dataEnvironment || options.dataMode || 'REAL').toUpperCase();
  const totalReceived = rawRecords.length;
  let rejectedCount = 0;
  const errors = [];
  const validRecords = [];

  rawRecords.forEach((raw, idx) => {
    const { record, error } = validateDGCARecord(raw, defaultDataEnv);
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
          referenceDate: r.referenceDate,
          route: r.route,
          dataEnvironment: r.dataEnvironment,
        },
        update: { $set: r },
        upsert: true,
      },
    }));

    const result = await DGCAReferenceFare.bulkWrite(bulkOps, { ordered: false });
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
 * Loads a file (CSV or JSON) from disk and imports its records.
 */
export async function importDGCAFile(filePath, options = {}) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`DGCA file not found at: ${resolvedPath}`);
  }

  const rawContent = fs.readFileSync(resolvedPath, 'utf8');
  let rawRecords = [];

  if (resolvedPath.endsWith('.json')) {
    rawRecords = JSON.parse(rawContent);
    if (!Array.isArray(rawRecords)) {
      throw new Error('JSON DGCA file must contain a top-level array of records.');
    }
  } else {
    rawRecords = parseCSV(rawContent);
  }

  return await importDGCARecords(rawRecords, options);
}

// CLI Execution Entry Point
async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => !a.startsWith('--'));
  const modeArg = (args.find((a) => a.startsWith('--mode=')) || '--mode=REAL').split('=')[1].toUpperCase();

  if (!fileArg) {
    console.log('Usage: node scripts/importDGCAData.js <filePath.csv|.json> [--mode=REAL|DEMO]');
    process.exit(0);
  }

  console.log('===============================================================');
  console.log(' SIH26056: DGCA Official Reference Data Importer');
  console.log('===============================================================');
  console.log(`Target File:      ${fileArg}`);
  console.log(`Data Environment: ${modeArg}`);

  try {
    await connectDB();
    console.log(`✓ Database status: ${isDatabaseConnected() ? 'Connected' : 'Degraded (In-Memory)'}`);

    const summary = await importDGCAFile(fileArg, { dataEnvironment: modeArg });

    console.log('\n---------------------------------------------------------------');
    console.log('✅ DGCA DATA IMPORT SUMMARY');
    console.log(`• Records Received:   ${summary.received}`);
    console.log(`• Records Imported:   ${summary.imported}`);
    console.log(`• Duplicate Matched:  ${summary.duplicates}`);
    console.log(`• Records Rejected:   ${summary.rejected}`);
    console.log(`• Data Environment:   ${summary.dataEnvironment}`);
    if (summary.errors.length > 0) {
      console.log(`\nRejection Details (First 5):`);
      summary.errors.slice(0, 5).forEach((e) => {
        console.log(`  - Row ${e.index + 1}: ${e.error}`);
      });
    }
    console.log('---------------------------------------------------------------');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ IMPORT FAILED:', err.message);
    await disconnectDB();
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('importDGCAData.js')) {
  main();
}
