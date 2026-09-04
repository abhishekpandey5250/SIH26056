import React from 'react';
import { Layers, ArrowRight } from 'lucide-react';

const BUCKETS = ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'];

export const LeadTimeComparison = ({ latestIndices = [], selectedBucket, onSelectBucket }) => {
  const indexMap = new Map();
  latestIndices.forEach((idx) => {
    indexMap.set(idx.leadTimeBucket, idx);
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Advance-Purchase Windows Comparison
            </h3>
            <p className="text-xs text-slate-500">
              Comparative view across all 5 standard CPI observation lead times
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-2.5 px-3">Lead-Time Window</th>
              <th className="py-2.5 px-3">Advance Notice</th>
              <th className="py-2.5 px-3 text-right">Latest Index</th>
              <th className="py-2.5 px-3 text-right">Daily Change</th>
              <th className="py-2.5 px-3 text-right">Weight Coverage</th>
              <th className="py-2.5 px-3 text-right">Routes Included</th>
              <th className="py-2.5 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {BUCKETS.map((bucket) => {
              const data = indexMap.get(bucket);
              const isSelected = selectedBucket === bucket;
              const hasData = data && typeof data.indexValue === 'number';

              const desc =
                bucket === 'T+1'
                  ? '1 Day'
                  : bucket === 'T+7'
                  ? '7 Days (1 Wk)'
                  : bucket === 'T+15'
                  ? '15 Days (2 Wks)'
                  : bucket === 'T+30'
                  ? '30 Days (1 Mo)'
                  : '45 Days (1.5 Mo)';

              return (
                <tr
                  key={bucket}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    isSelected ? 'bg-sky-50/50 font-medium' : ''
                  }`}
                >
                  <td className="py-3 px-3 font-bold text-slate-900 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                    <span>{bucket}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-500">{desc}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    {hasData ? data.indexValue.toFixed(2) : 'N/A'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {hasData && data.dailyChangePercent != null ? (
                      <span
                        className={
                          data.dailyChangePercent > 0
                            ? 'text-rose-600'
                            : data.dailyChangePercent < 0
                            ? 'text-emerald-600'
                            : 'text-slate-500'
                        }
                      >
                        {data.dailyChangePercent > 0 ? '+' : ''}
                        {data.dailyChangePercent.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-slate-400">N/A</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {hasData && data.weightCoverage != null ? (
                      <span className={data.weightCoverage < 100 ? 'text-amber-600' : 'text-slate-700'}>
                        {data.weightCoverage.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-400">N/A</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-600">
                    {hasData ? `${data.routeCount} / ${data.configuredRouteCount}` : 'N/A'}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => onSelectBucket(bucket)}
                      className={`px-2.5 py-1 text-[11px] rounded font-medium transition-colors ${
                        isSelected
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isSelected ? 'Active' : 'Select'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
