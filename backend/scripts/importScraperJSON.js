/**
 * Scraper Team JSON Importer & Ingestion Pipeline Runner.
 * 
 * Imports observation batches formatted as { "observations": [...] } into the production pipeline.
 * 
 * Architecture & Constraints:
 * 1. Strictly sets and preserves dataEnvironment = 'REAL'.
 * 2. Maps origin/destination pairs to the canonical 20-route production basket (bidirectional).
 * 3. Reverse directions (e.g. BOM-DEL) are mapped to the canonical routeId (DEL-BOM).
 * 4. Passes all observations through existing IngestionService, NormalizationService, ValidationService,
 *    DeduplicationService, RawObservation schema, and PipelineOrchestratorService.
 * 5. Does NOT bypass existing services or manually insert raw DB documents.
 * 6. Never fabricates missing values; never converts missing prices to zero.
 * 7. Outputs comprehensive triage diagnostic telemetry.
 * 
 * Usage:
 *   node backend/scripts/importScraperJSON.js <file.json>
 */

import '../src/config/env.js';
import fs from 'fs';
import path from 'path';
import { connectDB, disconnectDB, isDatabaseConnected } from '../src/config/database.js';
import { IngestionService } from '../src/services/ingestion.service.js';
import { PipelineOrchestratorService } from '../src/services/pipelineOrchestrator.service.js';
import { normalizeAirportCode, isDomesticIndianRoute, isIndianAirport } from '../src/utils/airportCodes.js';
import { getCalendarDateString } from '../src/utils/dateUtils.js';
import { normalizePrice, normalizeCurrency } from '../src/services/normalization.service.js';
import { PRODUCTION_20_ROUTES, PRODUCTION_20_ROUTE_WEIGHTS } from '../src/config/indexConfig.js';
import { logger } from '../src/utils/logger.js';

export { PRODUCTION_20_ROUTES, PRODUCTION_20_ROUTE_WEIGHTS };

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
 * Parses and validates the top-level structure of a Scraper JSON payload.
 * Accepts { "observations": [...] } or a top-level array [...].
 * 
 * @param {string} rawContent 
 * @returns {Array<object>} Array of raw observation objects
 */
export function parseScraperJSON(rawContent) {
  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    throw new Error('Empty or invalid scraper JSON content provided.');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(`Malformed JSON syntax: ${err.message}`);
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.observations)) {
    return parsed.observations;
  }

  throw new Error('Invalid Scraper JSON: Expected an object with an "observations" array or a top-level array.');
}

/**
 * Triage and categorization analysis across the raw scraper observation batch.
 * Checks against the 20-route production basket, currency, pricing, and routing rules.
 * 
 * @param {Array<object>} observations 
 * @param {object} options 
 * @returns {object} Triage analysis and mapped observations
 */
export function analyzeAndFilterScraperBatch(observations = [], options = {}) {
  const defaultDataEnv = (options.dataEnvironment || options.dataMode || 'REAL').toUpperCase();

  let totalReceived = 0;
  let acceptedFor20Basket = 0;
  let invalidRouteCount = 0;
  let internationalRouteCount = 0;
  let invalidPriceCount = 0;
  let invalidCurrencyCount = 0;
  let roundTripCount = 0;
  let missingFlightNumberCount = 0;

  const routeCounts = {};
  PRODUCTION_20_ROUTES.forEach((r) => {
    routeCounts[r] = 0;
  });

  const scrapedDates = [];
  const departureDates = [];
  const processedObservations = [];
  const triageErrors = [];

  observations.forEach((raw, idx) => {
    totalReceived++;

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      triageErrors.push({ index: idx, reason: 'Record is not a valid JSON object' });
      return;
    }

    const origin = normalizeAirportCode(raw.origin);
    const destination = normalizeAirportCode(raw.destination);

    // 1. International Route Check
    if (origin && destination && (!isIndianAirport(origin) || !isIndianAirport(destination))) {
      internationalRouteCount++;
    }

    // 2. Route Basket Check (Must map to one of the 20 production corridors)
    const canonicalRoute = getCanonicalRouteId(origin, destination);
    if (!canonicalRoute) {
      invalidRouteCount++;
      triageErrors.push({
        index: idx,
        reason: `Route ${origin || 'UNKNOWN'}-${destination || 'UNKNOWN'} is not in the 20-route production basket`,
      });
      return;
    }

    // 3. Price Validation Check (Never convert missing to zero; never fabricate)
    const priceNum = normalizePrice(raw.price, raw.price_raw);
    if (priceNum === null || priceNum <= 0) {
      invalidPriceCount++;
    }

    // 4. Currency Check
    const currency = normalizeCurrency(raw.currency);
    if (!currency || currency !== 'INR') {
      invalidCurrencyCount++;
    }

    // 5. Round-Trip Check
    if (raw.trip_type === 'round-trip' || raw.return_date) {
      roundTripCount++;
    }

    // 6. Flight Number Check
    if (!raw.flight_number || ['N/A', 'NONE', 'NULL', 'UNKNOWN', '-'].includes(String(raw.flight_number).trim().toUpperCase())) {
      missingFlightNumberCount++;
    }

    // 7. Dates tracking
    if (raw.scraped_at) {
      const sDate = getCalendarDateString(raw.scraped_at);
      if (sDate) scrapedDates.push(sDate);
    }
    if (raw.departure_date) {
      const dDate = getCalendarDateString(raw.departure_date);
      if (dDate) departureDates.push(dDate);
    }

    // Map routeId & ensure REAL dataEnvironment
    const observationWithRouteId = {
      ...raw,
      routeId: canonicalRoute,
      dataEnvironment: defaultDataEnv,
    };

    acceptedFor20Basket++;
    routeCounts[canonicalRoute] = (routeCounts[canonicalRoute] || 0) + 1;
    processedObservations.push(observationWithRouteId);
  });

  scrapedDates.sort();
  departureDates.sort();

  return {
    totalReceived,
    acceptedFor20Basket,
    invalidRouteCount,
    internationalRouteCount,
    invalidPriceCount,
    invalidCurrencyCount,
    roundTripCount,
    missingFlightNumberCount,
    scrapedDateRange: {
      min: scrapedDates[0] || null,
      max: scrapedDates[scrapedDates.length - 1] || null,
    },
    departureDateRange: {
      min: departureDates[0] || null,
      max: departureDates[departureDates.length - 1] || null,
    },
    distinctRoutesCount: Object.values(routeCounts).filter((c) => c > 0).length,
    routeCounts,
    processedObservations,
    triageErrors,
  };
}

/**
 * Programmatic entry point to import scraper JSON payload.
 * Passes observations through the full existing ingestion and pipeline aggregation services.
 * 
 * @param {string|object} input JSON string or parsed object
 * @param {object} options
 * @returns {Promise<object>} Complete ingestion and pipeline execution summary
 */
export async function importScraperData(input, options = {}) {
  const defaultDataEnv = (options.dataEnvironment || options.dataMode || 'REAL').toUpperCase();
  const shouldRunPipeline = options.runPipeline !== false;

  let rawObservations;
  if (typeof input === 'string') {
    rawObservations = parseScraperJSON(input);
  } else if (Array.isArray(input)) {
    rawObservations = input;
  } else if (input && typeof input === 'object' && Array.isArray(input.observations)) {
    rawObservations = input.observations;
  } else {
    throw new Error('Invalid input: Expected JSON string, observations array, or { observations: [...] } object.');
  }

  // 1. Triage analysis and 20-route basket mapping
  const triage = analyzeAndFilterScraperBatch(rawObservations, { dataEnvironment: defaultDataEnv });

  // 2. Ingest through standard IngestionService (Normalization, Validation, Quality Flags, Deduplication)
  const ingestionResult = await IngestionService.ingestBatch(triage.processedObservations, {
    dataEnvironment: defaultDataEnv,
  });

  // 3. Trigger Daily Pipeline for each distinct collection date in the batch
  const pipelineRuns = [];
  if (shouldRunPipeline && isDatabaseConnected()) {
    const uniqueCollectionDates = new Set();
    triage.processedObservations.forEach((obs) => {
      const d = getCalendarDateString(obs.scraped_at || obs.scrapedAt);
      if (d) uniqueCollectionDates.add(d);
    });

    for (const cDate of uniqueCollectionDates) {
      try {
        const pResult = await PipelineOrchestratorService.runDailyPipeline({
          collectionDate: cDate,
          dataEnvironment: defaultDataEnv,
        });
        pipelineRuns.push(pResult);
      } catch (err) {
        logger.warn(`Pipeline execution skipped or encountered error for date ${cDate}:`, { error: err.message });
      }
    }
  }

  return {
    success: true,
    dataEnvironment: defaultDataEnv,
    summary: {
      received: triage.totalReceived,
      accepted20Basket: triage.acceptedFor20Basket,
      stored: ingestionResult.stored,
      duplicate: ingestionResult.duplicates,
      rejected: ingestionResult.rejected,
      eligible: ingestionResult.indexEligible,
      flagged: ingestionResult.flagged,
      triageDetails: {
        invalidRoute: triage.invalidRouteCount,
        internationalRoute: triage.internationalRouteCount,
        invalidPrice: triage.invalidPriceCount,
        invalidCurrency: triage.invalidCurrencyCount,
        roundTrip: triage.roundTripCount,
        missingFlightNumber: triage.missingFlightNumberCount,
      },
      dateRange: {
        scraped: triage.scrapedDateRange,
        departure: triage.departureDateRange,
      },
      routeCoverage: {
        distinctRoutesCovered: triage.distinctRoutesCount,
        totalProductionBasketRoutes: PRODUCTION_20_ROUTES.length,
        routeCounts: triage.routeCounts,
      },
    },
    ingestionResult,
    pipelineRuns,
  };
}

/**
 * Recursively collects all .json files in a directory tree.
 * 
 * @param {string} dirPath 
 * @returns {string[]} Array of absolute file paths
 */
export function collectJsonFiles(dirPath) {
  const results = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Reads a JSON file or directory from disk and imports its scraper observations.
 * Supports passing single JSON files or directory trees (e.g. scraped_data/).
 * 
 * @param {string} targetPath File or Directory path
 * @param {object} options 
 * @returns {Promise<object>}
 */
export async function importScraperPath(targetPath, options = {}) {
  const resolvedPath = path.resolve(targetPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Scraper payload path not found at: ${resolvedPath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (stat.isDirectory()) {
    const jsonFiles = collectJsonFiles(resolvedPath);
    if (jsonFiles.length === 0) {
      throw new Error(`No .json files found in directory: ${resolvedPath}`);
    }
    const allObservations = [];
    let filesParsed = 0;
    for (const file of jsonFiles) {
      const rawContent = fs.readFileSync(file, 'utf8');
      try {
        const obs = parseScraperJSON(rawContent);
        allObservations.push(...obs);
        filesParsed++;
      } catch (err) {
        logger.warn(`Skipping unparseable JSON file ${file}: ${err.message}`);
      }
    }
    const result = await importScraperData(allObservations, options);
    result.filesProcessed = filesParsed;
    result.totalFilesFound = jsonFiles.length;
    return result;
  } else {
    const rawContent = fs.readFileSync(resolvedPath, 'utf8');
    const result = await importScraperData(rawContent, options);
    result.filesProcessed = 1;
    result.totalFilesFound = 1;
    return result;
  }
}

export const importScraperFile = importScraperPath;

// CLI Execution Entry Point
async function main() {
  const args = process.argv.slice(2);
  const pathArg = args.find((a) => !a.startsWith('--'));
  const modeArg = (args.find((a) => a.startsWith('--mode=')) || '--mode=REAL').split('=')[1].toUpperCase();

  if (!pathArg) {
    console.log('================================================================================');
    console.log(' SIH26056: Scraper Team JSON Ingestion CLI');
    console.log('================================================================================');
    console.log('Usage:');
    console.log('  node backend/scripts/importScraperJSON.js <file_or_directory> [--mode=REAL|DEMO]');
    console.log('  Examples:');
    console.log('    node backend/scripts/importScraperJSON.js scraped_data');
    console.log('    node backend/scripts/importScraperJSON.js scraped_data/T+1');
    console.log('    node backend/scripts/importScraperJSON.js scraped_data/T+1/DEL_BOM.json');
    console.log('================================================================================');
    process.exit(0);
  }

  console.log('================================================================================');
  console.log(' SIH26056: SCRAPER JSON INGESTION & PIPELINE RUNNER');
  console.log('================================================================================');
  console.log(`Source Target:     ${pathArg}`);
  console.log(`Data Environment:  ${modeArg}`);

  try {
    await connectDB();
    console.log(`Database Status:   ${isDatabaseConnected() ? 'Connected' : 'Degraded (In-Memory)'}`);

    const result = await importScraperPath(pathArg, { dataEnvironment: modeArg });
    const s = result.summary;

    console.log('\n--------------------------------------------------------------------------------');
    console.log('✅ INGESTION & TRIAGE SUMMARY');
    console.log('--------------------------------------------------------------------------------');
    if (result.totalFilesFound > 1) {
      console.log(`• JSON Files Processed:           ${result.filesProcessed} / ${result.totalFilesFound}`);
    }
    console.log(`• Total Observations Received:    ${s.received}`);
    console.log(`• Accepted for 20-Route Basket:   ${s.accepted20Basket}`);
    console.log(`• Successfully Stored (DB):       ${s.stored}`);
    console.log(`• Exact Duplicates Skipped:       ${s.duplicate}`);
    console.log(`• Malformed / Rejected:           ${s.rejected}`);
    console.log(`• Index-Eligible Observations:    ${s.eligible}`);
    console.log(`• Flagged Observations:           ${s.flagged}`);
    console.log('\n📊 Triage Breakdown:');
    console.log(`  - Invalid / Non-Basket Routes:  ${s.triageDetails.invalidRoute}`);
    console.log(`  - International Routes:         ${s.triageDetails.internationalRoute}`);
    console.log(`  - Invalid / Missing Prices:     ${s.triageDetails.invalidPrice}`);
    console.log(`  - Non-INR / Unknown Currency:   ${s.triageDetails.invalidCurrency}`);
    console.log(`  - Round-Trip Quotes:            ${s.triageDetails.roundTrip}`);
    console.log(`  - Missing Flight Numbers:       ${s.triageDetails.missingFlightNumber}`);
    console.log('\n📅 Date Ranges:');
    console.log(`  - Scraped At Range:             ${s.dateRange.scraped.min || 'N/A'} ➔ ${s.dateRange.scraped.max || 'N/A'}`);
    console.log(`  - Departure Date Range:         ${s.dateRange.departure.min || 'N/A'} ➔ ${s.dateRange.departure.max || 'N/A'}`);
    console.log('\n✈️  20-Route Production Basket Coverage:');
    console.log(`  - Corridors Represented:        ${s.routeCoverage.distinctRoutesCovered} / ${s.routeCoverage.totalProductionBasketRoutes}`);
    console.log('  - Route Observation Counts:');
    PRODUCTION_20_ROUTES.forEach((r) => {
      const count = s.routeCoverage.routeCounts[r] || 0;
      if (count > 0) {
        console.log(`    * ${r.padEnd(8)}: ${count} observations`);
      }
    });

    if (result.pipelineRuns.length > 0) {
      console.log('\n⚡ Pipeline Execution Runs:');
      result.pipelineRuns.forEach((p) => {
        console.log(`  - Date: ${p.collectionDate} | Routes: ${p.aggregation.routesProcessed} | Buckets: ${p.aggregation.bucketsProcessed} | Coverage: ${p.index.averageCoverage}%`);
      });
    }

    console.log('--------------------------------------------------------------------------------');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ IMPORT FAILED:', err.message);
    await disconnectDB();
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('importScraperJSON.js')) {
  main();
}
