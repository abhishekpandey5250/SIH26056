import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Scale,
  Ban,
  Globe2,
  DollarSign,
  Clock,
} from 'lucide-react';

export const DataQualityPanel = ({ currentIndex, aggregations = [], scraperStatus = null }) => {
  // Aggregate data quality numbers across today's aggregations & raw observations
  let totalObservations = scraperStatus?.observationsStored || 0;
  let eligibleObservations = scraperStatus?.indexEligible || 0;
  let flaggedObservations = scraperStatus?.flagged || 0;
  let duplicatesCount = scraperStatus?.duplicates || 0;

  let aggregationObsUsed = 0;
  let missingFlightNumberCount = 0;
  let roundTripCount = 0;
  let internationalCount = 0;
  let missingPriceCount = 0;
  let unknownCurrencyCount = 0;
  let supportedLeadTimeCount = 0;
  let unsupportedLeadTimeCount = 0;

  aggregations.forEach((agg) => {
    aggregationObsUsed += agg.eligibleObservationCount || 0;
    if (agg.quality) {
      flaggedObservations += agg.quality.flaggedObservationCount || 0;
    }
  });

  if (totalObservations === 0 && aggregationObsUsed > 0) {
    totalObservations = aggregationObsUsed;
    eligibleObservations = aggregationObsUsed;
  }

  const excludedObservations = Math.max(0, totalObservations - eligibleObservations);
  const basePeriod = currentIndex?.basePeriod;
  const methodologyVersion = currentIndex?.methodologyVersion || '1.0-prototype';
  const calculationVersion = currentIndex?.calculationVersion || '1.0.0';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex items-center space-x-2 pb-4 border-b border-slate-100 mb-4">
        <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Statistical Governance & Data Quality Control
          </h3>
          <p className="text-xs text-slate-500">
            Validation rules, triage metrics, and methodology version tracking
          </p>
        </div>
      </div>

      {/* Grid of Key Triage Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs mb-4">
        {/* Metric 1 */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-500 block text-[11px]">Total Raw Observations</span>
          <span className="font-semibold text-slate-800 font-mono mt-1 block">
            {totalObservations > 0 ? totalObservations.toLocaleString('en-IN') : 'N/A'}
          </span>
        </div>

        {/* Metric 2 */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-500 block text-[11px]">Index-Eligible Clean</span>
          <span className="font-semibold text-emerald-700 font-mono mt-1 block">
            {eligibleObservations > 0 ? eligibleObservations.toLocaleString('en-IN') : 'N/A'}
          </span>
        </div>

        {/* Metric 3 */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-500 block text-[11px]">Excluded Observations</span>
          <span className="font-semibold text-slate-600 font-mono mt-1 block">
            {totalObservations > 0 ? excludedObservations.toLocaleString('en-IN') : 'N/A'}
          </span>
        </div>

        {/* Metric 4 */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-500 block text-[11px]">Deduplicated Records</span>
          <span className="font-semibold text-indigo-600 font-mono mt-1 block">
            {duplicatesCount > 0 ? duplicatesCount.toLocaleString('en-IN') : '0'}
          </span>
        </div>

        {/* Metric 5 */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-500 block text-[11px]">Base Period Window</span>
          <span className="font-semibold text-slate-800 font-mono mt-1 block">
            {basePeriod ? `${basePeriod.startDate} → ${basePeriod.endDate}` : 'Configured'}
          </span>
        </div>

        {/* Metric 6 */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-500 block text-[11px]">Methodology Version</span>
          <span className="font-semibold text-slate-800 font-mono mt-1 block">
            {methodologyVersion} (v{calculationVersion})
          </span>
        </div>

        {/* Metric 7 */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-500 block text-[11px]">Supported Windows</span>
          <span className="font-semibold text-sky-700 font-mono mt-1 block">
            T+1, T+7, T+15, T+30, T+45
          </span>
        </div>

        {/* Metric 8 */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-500 block text-[11px]">Weight Normalization</span>
          <span className="font-semibold text-slate-800 font-mono mt-1 block">
            Dynamic (Laspeyres)
          </span>
        </div>
      </div>

      {/* Quality Standards Checklist */}
      <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
          <span>Strict exclusion of round-trips, international routes, and null fares</span>
        </div>
        <div className="flex items-center space-x-2">
          <Scale className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
          <span>Dynamic weight renormalization on partial city-pair coverage</span>
        </div>
      </div>
    </div>
  );
};
