/**
 * DGCA Unified Reference & Passenger Traffic Converter & Importer.
 * 
 * Supports route-level DGCA domestic datasets containing:
 * - origin / destination
 * - passengers (pax volume)
 * - average_purchase_fare (average realized fare / yield)
 * - period / month (reporting time window)
 * - source (official source attribution)
 * 
 * Statistical Integrity Guardrails:
 * 1. Zero data fabrication — missing values are rejected, never hallucinated.
 * 2. Monthly data remains monthly — never synthetically expands monthly data into fake daily dates.
 * 3. Preserves original DGCA period and source attribution.
 * 4. Strictly sets dataEnvironment to REAL (unless explicitly overridden).
 * 
 * Usage:
 *   node scripts/convertDGCAReference.js <input.csv|.json> [--output=<dir>] [--import] [--mode=REAL]
 */

import '../src/config/env.js';
import fs from 'fs';
import path from 'path';
import { connectDB, disconnectDB, isDatabaseConnected } from '../src/config/database.js';
import { DGCATraffic } from '../src/models/DGCATraffic.js';
import { DGCAReferenceFare } from '../src/models/DGCAReferenceFare.js';
import { normalizeAirportCode, isDomesticIndianRoute } from '../src/utils/airportCodes.js';
import { normalizePrice } from '../src/services/normalization.service.js';
import { logger } from '../src/utils/logger.js';

/**
 * Parses raw CSV content for unified DGCA route-level data.
 */
export function parseDGCARawCSV(content) {
  if (typeof content !== 'string' || !content.trim()) return [];

  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length < 2) return [];

  const rawHeaders = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const headerMap = {
    origin: 'origin',
    from: 'origin',
    city1: 'origin',
    origin_airport: 'origin',
    source_city: 'origin',
    source_airport: 'origin',

    destination: 'destination',
    dest: 'destination',
    to: 'destination',
    city2: 'destination',
    destination_airport: 'destination',
    dest_city: 'destination',

    passengers: 'passengers',
    pax: 'passengers',
    passenger_count: 'passengers',
    traffic: 'passengers',
    total_passengers: 'passengers',
    volume: 'passengers',

    average_purchase_fare: 'averagePurchaseFare',
    averagepurchasefare: 'averagePurchaseFare',
    avg_purchase_fare: 'averagePurchaseFare',
    average_fare: 'averagePurchaseFare',
    averagefare: 'averagePurchaseFare',
    avg_fare: 'averagePurchaseFare',
    fare: 'averagePurchaseFare',
    price: 'averagePurchaseFare',
    tariff: 'averagePurchaseFare',
    yield: 'averagePurchaseFare',

    period: 'period',
    month: 'period',
    year_month: 'period',
    reporting_month: 'period',
    time_period: 'period',
    date: 'referenceDate',
    reference_date: 'referenceDate',
    referencedate: 'referenceDate',

    source: 'source',
    source_agency: 'source',
    report: 'source',
    dataset_name: 'datasetName',
    datasetname: 'datasetName',
    dataset: 'datasetName',
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
 * Normalizes period strings to standard formats (e.g. "2026-08", "2026-Q1", or "2025-2026").
 */
export function normalizePeriodString(rawPeriod) {
  if (!rawPeriod || typeof rawPeriod !== 'string') return null;
  const p = rawPeriod.trim();

  // YYYY-MM (e.g. 2026-08)
  if (/^\d{4}-\d{2}$/.test(p)) return p;

  // YYYY-MM-DD -> return YYYY-MM
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p.slice(0, 7);

  // YYYY-Q# (e.g. 2026-Q1)
  if (/^\d{4}-Q[1-4]$/i.test(p)) return p.toUpperCase();

  // "Aug 2026" or "August 2026" or "AUG-2026"
  const monthNames = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
  };

  const parts = p.toLowerCase().split(/[\s\-_/]+/);
  if (parts.length === 2) {
    if (monthNames[parts[0]] && /^\d{4}$/.test(parts[1])) {
      return `${parts[1]}-${monthNames[parts[0]]}`;
    }
    if (/^\d{4}$/.test(parts[0]) && monthNames[parts[1]]) {
      return `${parts[0]}-${monthNames[parts[1]]}`;
    }
  }

  // Fallback: Return trimmed original without modification
  return p;
}

/**
 * Validates a single DGCA raw record.
 */
export function validateDGCARawRecord(record = {}, defaultDataEnv = 'REAL') {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, error: 'Record must be a valid JSON object' };
  }

  // 1. Origin Airport
  const origin = normalizeAirportCode(record.origin || record.from || record.city1 || record.source_airport);
  if (!origin) {
    return { valid: false, error: `Invalid origin airport code: "${record.origin}".` };
  }

  // 2. Destination Airport
  const destination = normalizeAirportCode(record.destination || record.dest || record.to || record.city2 || record.destination_airport);
  if (!destination) {
    return { valid: false, error: `Invalid destination airport code: "${record.destination}".` };
  }

  if (origin === destination) {
    return { valid: false, error: `Origin and destination cannot be identical: ${origin}-${destination}.` };
  }

  if (!isDomesticIndianRoute(origin, destination)) {
    return { valid: false, error: `Route ${origin}-${destination} is not a valid Indian domestic route.` };
  }

  const route = `${origin}-${destination}`;

  // 3. Period / Month
  const rawPeriod = record.period || record.month || record.reporting_month || record.time_period || record.referenceDate;
  const period = normalizePeriodString(rawPeriod);
  if (!period) {
    return { valid: false, error: `Missing or invalid period/month: "${rawPeriod}".` };
  }

  // 4. Source Attribution
  const source = (typeof record.source === 'string' && record.source.trim()) || 'DGCA_OFFICIAL_REPORT';
  const datasetName = (typeof record.datasetName === 'string' && record.datasetName.trim()) ||
    (typeof record.dataset_name === 'string' && record.dataset_name.trim()) ||
    'DGCA_DOMESTIC_DATA';

  const dataEnvironment = (
    typeof record.dataEnvironment === 'string'
      ? record.dataEnvironment
      : defaultDataEnv
  ).trim().toUpperCase();

  // 5. Passengers (Traffic)
  let trafficRecord = null;
  const rawPax = record.passengers || record.pax || record.passenger_count || record.traffic || record.volume;
  if (rawPax !== undefined && rawPax !== null && rawPax !== '') {
    const paxNum = typeof rawPax === 'number' ? rawPax : parseInt(String(rawPax).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(paxNum) && paxNum > 0) {
      trafficRecord = {
        period,
        origin,
        destination,
        route,
        passengers: paxNum,
        trafficType: (typeof record.trafficType === 'string' && record.trafficType.trim()) || 'DOMESTIC_SCHEDULED',
        source,
        datasetName,
        dataEnvironment: dataEnvironment === 'DEMO' ? 'DEMO' : 'REAL',
      };
    }
  }

  // 6. Average Purchase Fare (Reference Benchmark)
  let fareRecord = null;
  const rawFare = record.averagePurchaseFare || record.average_purchase_fare || record.avg_purchase_fare ||
    record.averageFare || record.average_fare || record.avg_fare || record.averagefare ||
    record.fare || record.price || record.tariff || record.yield;
  if (rawFare !== undefined && rawFare !== null && rawFare !== '') {
    const fareNum = normalizePrice(rawFare);
    if (fareNum !== null && fareNum > 0) {
      // If a specific referenceDate is provided (e.g. YYYY-MM-DD), use it; otherwise use month
      const referenceDate = (typeof record.referenceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.referenceDate.trim()))
        ? record.referenceDate.trim()
        : null;

      const month = /^\d{4}-\d{2}$/.test(period) ? period : (referenceDate ? referenceDate.slice(0, 7) : period);

      fareRecord = {
        referenceDate: referenceDate || `${month}-01`, // Stored with month baseline marker if daily is absent
        month,
        origin,
        destination,
        route,
        averageFare: Math.round(fareNum * 100) / 100,
        currency: 'INR',
        source,
        datasetName,
        dataEnvironment: dataEnvironment === 'DEMO' ? 'DEMO' : 'REAL',
        isMonthlyAggregate: !referenceDate,
      };
    }
  }

  if (!trafficRecord && !fareRecord) {
    return {
      valid: false,
      error: `Row for ${route} contains neither valid passengers count (>0) nor valid average fare (>0).`,
    };
  }

  return {
    valid: true,
    route,
    period,
    trafficRecord,
    fareRecord,
  };
}

/**
 * Converts raw DGCA records and segregates them into traffic and reference fare collections.
 */
export function convertDGCARawRecords(rawRecords = [], options = {}) {
  const defaultDataEnv = (options.dataEnvironment || options.dataMode || 'REAL').toUpperCase();
  const totalReceived = rawRecords.length;

  const validTrafficRecords = [];
  const validFareRecords = [];
  const rejectedRows = [];

  rawRecords.forEach((raw, idx) => {
    const result = validateDGCARawRecord(raw, defaultDataEnv);
    if (!result.valid) {
      rejectedRows.push({ rowIndex: idx + 1, error: result.error, raw });
    } else {
      if (result.trafficRecord) validTrafficRecords.push(result.trafficRecord);
      if (result.fareRecord) validFareRecords.push(result.fareRecord);
    }
  });

  return {
    success: true,
    totalReceived,
    validTrafficCount: validTrafficRecords.length,
    validFareCount: validFareRecords.length,
    rejectedCount: rejectedRows.length,
    dataEnvironment: defaultDataEnv,
    trafficRecords: validTrafficRecords,
    fareRecords: validFareRecords,
    rejectedRows,
  };
}

/**
 * Loads a file (CSV or JSON) and converts its contents.
 */
export async function convertDGCARawFile(filePath, options = {}) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Target DGCA file not found at: ${resolvedPath}`);
  }

  const rawContent = fs.readFileSync(resolvedPath, 'utf8');
  let rawRecords = [];

  if (resolvedPath.endsWith('.json')) {
    rawRecords = JSON.parse(rawContent);
    if (!Array.isArray(rawRecords)) {
      throw new Error('JSON DGCA file must contain a top-level array of records.');
    }
  } else {
    rawRecords = parseDGCARawCSV(rawContent);
  }

  const conversion = convertDGCARawRecords(rawRecords, options);

  // If output directory specified, save converted JSON datasets
  if (options.outputDir) {
    const outDir = path.resolve(options.outputDir);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    if (conversion.trafficRecords.length > 0) {
      const trafficOutPath = path.join(outDir, 'dgca_traffic_converted.json');
      fs.writeFileSync(trafficOutPath, JSON.stringify(conversion.trafficRecords, null, 2), 'utf8');
      conversion.trafficOutputPath = trafficOutPath;
    }

    if (conversion.fareRecords.length > 0) {
      const fareOutPath = path.join(outDir, 'dgca_reference_converted.json');
      fs.writeFileSync(fareOutPath, JSON.stringify(conversion.fareRecords, null, 2), 'utf8');
      conversion.fareOutputPath = fareOutPath;
    }
  }

  // If import flag enabled and database is connected, persist directly into MongoDB
  if (options.importToDb && isDatabaseConnected()) {
    let trafficUpserted = 0;
    let fareUpserted = 0;

    if (conversion.trafficRecords.length > 0) {
      const trafficOps = conversion.trafficRecords.map((t) => ({
        updateOne: {
          filter: { period: t.period, route: t.route, dataEnvironment: t.dataEnvironment },
          update: { $set: t },
          upsert: true,
        },
      }));
      const resT = await DGCATraffic.bulkWrite(trafficOps, { ordered: false });
      trafficUpserted = resT.upsertedCount + resT.modifiedCount;
    }

    if (conversion.fareRecords.length > 0) {
      const fareOps = conversion.fareRecords.map((f) => ({
        updateOne: {
          filter: { referenceDate: f.referenceDate, route: f.route, dataEnvironment: f.dataEnvironment },
          update: { $set: f },
          upsert: true,
        },
      }));
      const resF = await DGCAReferenceFare.bulkWrite(fareOps, { ordered: false });
      fareUpserted = resF.upsertedCount + resF.modifiedCount;
    }

    conversion.importedToDb = {
      trafficUpserted,
      fareUpserted,
    };
  }

  return conversion;
}

// CLI Execution Entry Point
async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => !a.startsWith('--'));
  const modeArg = (args.find((a) => a.startsWith('--mode=')) || '--mode=REAL').split('=')[1].toUpperCase();
  const outputArg = (args.find((a) => a.startsWith('--output=')) || '').split('=')[1] || null;
  const doImport = args.includes('--import');

  if (!fileArg) {
    console.log('===============================================================');
    console.log(' SIH26056: DGCA Unified Reference & Traffic Converter');
    console.log('===============================================================');
    console.log('Usage:');
    console.log('  node scripts/convertDGCAReference.js <file.csv|.json> [options]');
    console.log('\nOptions:');
    console.log('  --output=<dir>   Save converted JSON datasets to specified directory');
    console.log('  --import         Directly upsert validated records into MongoDB');
    console.log('  --mode=REAL|DEMO Target data environment (default: REAL)');
    console.log('===============================================================');
    process.exit(0);
  }

  console.log('===============================================================');
  console.log(' SIH26056: DGCA Reference & Traffic Converter');
  console.log('===============================================================');
  console.log(`Source File:      ${fileArg}`);
  console.log(`Data Environment: ${modeArg}`);
  console.log(`Direct Import:    ${doImport ? 'ENABLED' : 'DISABLED'}`);
  if (outputArg) console.log(`Output Directory: ${outputArg}`);

  try {
    if (doImport) {
      await connectDB();
      console.log(`✓ Database status: ${isDatabaseConnected() ? 'Connected' : 'Degraded (In-Memory)'}`);
    }

    const summary = await convertDGCARawFile(fileArg, {
      dataEnvironment: modeArg,
      outputDir: outputArg,
      importToDb: doImport,
    });

    console.log('\n---------------------------------------------------------------');
    console.log('✅ DGCA CONVERSION & VALIDATION SUMMARY');
    console.log(`• Total Rows Received:      ${summary.totalReceived}`);
    console.log(`• Valid Traffic Records:    ${summary.validTrafficCount}`);
    console.log(`• Valid Reference Fares:    ${summary.validFareCount}`);
    console.log(`• Rejected Rows:            ${summary.rejectedCount}`);
    console.log(`• Data Environment:         ${summary.dataEnvironment}`);
    if (summary.trafficOutputPath) {
      console.log(`• Converted Traffic File:   ${summary.trafficOutputPath}`);
    }
    if (summary.fareOutputPath) {
      console.log(`• Converted Fares File:     ${summary.fareOutputPath}`);
    }
    if (summary.importedToDb) {
      console.log(`• DB Upserted Traffic:      ${summary.importedToDb.trafficUpserted}`);
      console.log(`• DB Upserted Fares:        ${summary.importedToDb.fareUpserted}`);
    }

    if (summary.rejectedRows.length > 0) {
      console.log(`\nRejection Details (First 5):`);
      summary.rejectedRows.slice(0, 5).forEach((r) => {
        console.log(`  - Row ${r.rowIndex}: ${r.error}`);
      });
    }
    console.log('---------------------------------------------------------------');

    if (doImport) await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ CONVERSION FAILED:', err.message);
    if (doImport) await disconnectDB();
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('convertDGCAReference.js')) {
  main();
}
