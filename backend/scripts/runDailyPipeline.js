/**
 * SIH26056 Daily Pipeline CLI Execution Script.
 * 
 * Runs the end-to-end statistical pipeline (Daily Route Aggregation -> Airfare Price Index Calculation)
 * for a specified calendar collection date.
 * 
 * Usage:
 *   node scripts/runDailyPipeline.js --date=2026-09-04
 *   node scripts/runDailyPipeline.js --date=2026-09-04 --mode=REAL
 *   node scripts/runDailyPipeline.js --date=2026-09-04 --mode=DEMO
 */

import '../src/config/env.js';
import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { connectDB, disconnectDB, isDatabaseConnected } from '../src/config/database.js';
import { PipelineOrchestratorService } from '../src/services/pipelineOrchestrator.service.js';
import { getCalendarDateString } from '../src/utils/dateUtils.js';

async function main() {
  const args = process.argv.slice(2);
  let dateArg = null;
  let modeArg = 'REAL';

  for (const arg of args) {
    if (arg.startsWith('--date=')) {
      dateArg = arg.split('=')[1];
    } else if (arg === '-d' && args[args.indexOf(arg) + 1]) {
      dateArg = args[args.indexOf(arg) + 1];
    } else if (arg.startsWith('--mode=') || arg.startsWith('--env=')) {
      modeArg = arg.split('=')[1].toUpperCase();
    }
  }

  const targetDate = dateArg || new Date().toISOString().split('T')[0];
  const canonicalDate = getCalendarDateString(targetDate);

  if (!canonicalDate) {
    console.error(`❌ Invalid date format provided: "${targetDate}". Expected YYYY-MM-DD.`);
    process.exit(1);
  }

  console.log('===============================================================');
  console.log(' SIH26056: Airfare Price Index Daily Pipeline Execution');
  console.log('===============================================================');
  console.log(`Target Collection Date: ${canonicalDate}`);
  console.log(`Data Environment:       ${modeArg}`);
  console.log(`Database URI:           ${config.mongoUri}`);

  try {
    await connectDB();
    console.log(`✓ Database status:      ${isDatabaseConnected() ? 'Connected' : 'Degraded (In-Memory)'}`);

    console.log(`\nExecuting daily aggregation and index calculation...`);
    const startTime = Date.now();

    const summary = await PipelineOrchestratorService.runDailyPipeline({
      collectionDate: canonicalDate,
      dataEnvironment: modeArg,
    });

    const elapsedMs = Date.now() - startTime;

    console.log('\n---------------------------------------------------------------');
    console.log('✅ DAILY PIPELINE EXECUTION COMPLETED');
    console.log(`• Collection Date:       ${summary.collectionDate}`);
    console.log(`• Data Environment:      ${summary.dataEnvironment}`);
    console.log(`• Elapsed Time:          ${elapsedMs}ms`);
    console.log(`• Raw Observations Used: ${summary.aggregation.observationsUsed}`);
    console.log(`• Routes Processed:      ${summary.aggregation.routesProcessed}`);
    console.log(`• Buckets Processed:     ${summary.aggregation.bucketsProcessed}`);
    console.log(`• Aggregations Stored:   ${summary.aggregation.stored}`);
    console.log(`• Indices Calculated:    ${summary.index.bucketsCalculated}`);
    console.log(`• Average Coverage:      ${summary.index.averageCoverage}%`);
    console.log('\nCalculated Index Variants:');
    for (const idx of summary.index.indices) {
      console.log(
        `  - [${idx.leadTimeBucket}] ${idx.indexCode.padEnd(12)}: Index = ${idx.indexValue.toFixed(2)} (Coverage: ${idx.weightCoverage}%, Routes: ${idx.routeCount})`
      );
    }
    console.log('---------------------------------------------------------------');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ PIPELINE EXECUTION FAILED:', err.message);
    await disconnectDB();
    process.exit(1);
  }
}

main();
