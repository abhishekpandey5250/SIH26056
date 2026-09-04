/**
 * SIH26056 Safe Demo Data Seeding Script.
 * 
 * Inserts a deterministic, clearly labeled DEMO dataset for evaluation and SIH demonstration.
 * 
 * Safety Rules:
 * - Requires --force flag or SEED_DEMO_DATA=true.
 * - Explicitly marks all generated records with dataEnvironment: 'DEMO' and source: 'DEMO'.
 * - Never runs in production without explicit confirmation.
 * 
 * Usage:
 *   SEED_DEMO_DATA=true node scripts/seedDemoData.js
 *   OR
 *   node scripts/seedDemoData.js --force
 */

import '../src/config/env.js';
import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { connectDB, disconnectDB, isDatabaseConnected } from '../src/config/database.js';
import { RawObservation } from '../src/models/RawObservation.js';
import { RouteWeight } from '../src/models/RouteWeight.js';
import { DailyRouteAggregation } from '../src/models/DailyRouteAggregation.js';
import { AirfareIndex } from '../src/models/AirfareIndex.js';
import { IngestionService } from '../src/services/ingestion.service.js';
import { PipelineOrchestratorService } from '../src/services/pipelineOrchestrator.service.js';
import { DEMO_ROUTE_WEIGHTS } from '../src/config/indexConfig.js';
import { logger } from '../src/utils/logger.js';

const isForce = process.argv.includes('--force') || process.env.SEED_DEMO_DATA === 'true';

if (!isForce && config.isProduction) {
  console.error('❌ SAFETY ABORT: Demo seeding cannot run in production without SEED_DEMO_DATA=true or --force');
  process.exit(1);
}

async function seedDemoData() {
  console.log('===============================================================');
  console.log(' SIH26056: Demo Data Seeding & Statistical Verification');
  console.log('===============================================================');
  console.log(`Connecting to MongoDB: ${config.mongoUri}...`);

  await connectDB();

  const BASE_DATE = '2026-08-15';
  const CURRENT_DATE = '2026-09-04';

  const basePeriod = {
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    methodologyVersion: '1.0-prototype',
  };

  console.log(`\n1. Seeding Route Weights (Label: DEMO)...`);
  for (const rw of DEMO_ROUTE_WEIGHTS) {
    if (isDatabaseConnected()) {
      await RouteWeight.updateOne(
        { routeKey: rw.routeKey, effectiveFrom: '2026-01-01', methodologyVersion: '1.0-prototype' },
        { $set: { ...rw, effectiveFrom: '2026-01-01', methodologyVersion: '1.0-prototype' } },
        { upsert: true }
      );
    }
  }
  console.log(`✓ Seeded ${DEMO_ROUTE_WEIGHTS.length} domestic corridor weights.`);

  // Base Period Observations (Anchor Fares: DEL-BOM 4000, DEL-BLR 5000, BOM-BLR 6000)
  const baseFares = [
    { route: 'DEL-BOM', origin: 'DEL', dest: 'BOM', t1: 7000, t7: 4000, t15: 3500, t30: 3200, t45: 3000 },
    { route: 'DEL-BLR', origin: 'DEL', dest: 'BLR', t1: 8500, t7: 5000, t15: 4500, t30: 4200, t45: 4000 },
    { route: 'BOM-BLR', origin: 'BOM', dest: 'BLR', t1: 9000, t7: 6000, t15: 5500, t30: 5000, t45: 4800 },
    { route: 'DEL-CCU', origin: 'DEL', dest: 'CCU', t1: 6500, t7: 3500, t15: 3200, t30: 3000, t45: 2800 },
    { route: 'BLR-HYD', origin: 'BLR', dest: 'HYD', t1: 4500, t7: 2500, t15: 2200, t30: 2000, t45: 1900 },
    { route: 'MAA-DEL', origin: 'MAA', dest: 'DEL', t1: 9500, t7: 5500, t15: 5000, t30: 4800, t45: 4500 },
  ];

  const leadWindows = [
    { bucket: 'T+1', offset: 1, key: 't1' },
    { bucket: 'T+7', offset: 7, key: 't7' },
    { bucket: 'T+15', offset: 15, key: 't15' },
    { bucket: 'T+30', offset: 30, key: 't30' },
    { bucket: 'T+45', offset: 45, key: 't45' },
  ];

  const addDays = (baseDateStr, days) => {
    const d = new Date(`${baseDateStr}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  };

  console.log(`\n2. Generating Base Period Observations (${BASE_DATE}) [Environment: DEMO]...`);
  const baseRawRecords = [];
  for (const bf of baseFares) {
    for (const win of leadWindows) {
      baseRawRecords.push({
        source: 'DEMO',
        dataEnvironment: 'DEMO',
        scraped_at: `${BASE_DATE}T06:00:00.000Z`,
        origin: bf.origin,
        destination: bf.dest,
        departure_date: addDays(BASE_DATE, win.offset),
        airline: 'IndiGo',
        flight_number: '6E-DEMO',
        price: bf[win.key],
        currency: 'INR',
        cabin_class: 'economy',
        trip_type: 'one-way',
      });
    }
  }

  const baseIngestRes = await IngestionService.ingestBatch(baseRawRecords, { dataEnvironment: 'DEMO' });
  console.log(`✓ Ingested ${baseIngestRes.stored} Base Period observations (DEMO environment).`);

  console.log(`\n3. Running Pipeline for Base Period (${BASE_DATE}) [DEMO Mode]...`);
  await PipelineOrchestratorService.runDailyPipeline({
    collectionDate: BASE_DATE,
    dataEnvironment: 'DEMO',
    basePeriod,
  });
  console.log(`✓ Base Period aggregations and baseline indices generated (DEMO environment).`);

  // Current Observation Date (Target: DEL-BOM 4800 -> R=120, DEL-BLR 5500 -> R=110, BOM-BLR 6300 -> R=105 -> Index = 114.00)
  const currentFares = [
    { route: 'DEL-BOM', origin: 'DEL', dest: 'BOM', t1: 8400, t7: 4800, t15: 4200, t30: 3800, t45: 3500 },
    { route: 'DEL-BLR', origin: 'DEL', dest: 'BLR', t1: 9350, t7: 5500, t15: 4950, t30: 4620, t45: 4400 },
    { route: 'BOM-BLR', origin: 'BOM', dest: 'BLR', t1: 9450, t7: 6300, t15: 5775, t30: 5250, t45: 5040 },
    { route: 'DEL-CCU', origin: 'DEL', dest: 'CCU', t1: 7150, t7: 3850, t15: 3520, t30: 3300, t45: 3080 },
    { route: 'BLR-HYD', origin: 'BLR', dest: 'HYD', t1: 4950, t7: 2750, t15: 2420, t30: 2200, t45: 2090 },
    { route: 'MAA-DEL', origin: 'MAA', dest: 'DEL', t1: 10450, t7: 6050, t15: 5500, t30: 5280, t45: 4950 },
  ];

  console.log(`\n4. Generating Current Observations (${CURRENT_DATE}) [Environment: DEMO]...`);
  const currentRawRecords = [];
  for (const cf of currentFares) {
    for (const win of leadWindows) {
      currentRawRecords.push({
        source: 'DEMO',
        dataEnvironment: 'DEMO',
        scraped_at: `${CURRENT_DATE}T06:00:00.000Z`,
        origin: cf.origin,
        destination: cf.dest,
        departure_date: addDays(CURRENT_DATE, win.offset),
        airline: 'Air India',
        flight_number: 'AI-DEMO',
        price: cf[win.key],
        currency: 'INR',
        cabin_class: 'economy',
        trip_type: 'one-way',
      });
    }
  }

  const currentIngestRes = await IngestionService.ingestBatch(currentRawRecords, { dataEnvironment: 'DEMO' });
  console.log(`✓ Ingested ${currentIngestRes.stored} Current observations (DEMO environment).`);

  console.log(`\n5. Running Pipeline for Current Date (${CURRENT_DATE}) [DEMO Mode]...`);
  const pipelineRes = await PipelineOrchestratorService.runDailyPipeline({
    collectionDate: CURRENT_DATE,
    dataEnvironment: 'DEMO',
    basePeriod,
  });

  console.log('\n===============================================================');
  console.log('✅ DEMO SEEDING & PIPELINE COMPLETE (ISOLATED IN DEMO ENVIRONMENT)');
  console.log(`• Collection Date:    ${pipelineRes.collectionDate}`);
  console.log(`• Environment Tag:    ${pipelineRes.dataEnvironment}`);
  console.log(`• Routes Processed:   ${pipelineRes.aggregation.routesProcessed}`);
  console.log(`• Buckets Processed:  ${pipelineRes.aggregation.bucketsProcessed}`);
  console.log(`• Indices Calculated: ${pipelineRes.index.bucketsCalculated}`);
  console.log('\nCalculated DEMO Index Values:');
  for (const idx of pipelineRes.index.indices) {
    console.log(`  - [${idx.leadTimeBucket}] ${idx.indexCode}: ${idx.indexValue.toFixed(2)} (Coverage: ${idx.weightCoverage}%, Routes: ${idx.routeCount})`);
  }
  console.log('===============================================================');

  await disconnectDB();
}

seedDemoData().catch((err) => {
  console.error('❌ Error during demo seeding:', err);
  process.exit(1);
});
