import React from 'react';
import { Database, Radio, Building2 } from 'lucide-react';

export const DataSourcesPanel = ({ aggregations = [] }) => {
  // Aggregate source breakdown counts across daily aggregations
  const sourceTotals = new Map();

  aggregations.forEach((agg) => {
    if (agg.sourceBreakdown) {
      const breakdown =
        agg.sourceBreakdown instanceof Map
          ? agg.sourceBreakdown
          : Object.entries(agg.sourceBreakdown);

      for (const [airline, count] of breakdown) {
        sourceTotals.set(airline, (sourceTotals.get(airline) || 0) + count);
      }
    }
  });

  const sourcesList = Array.from(sourceTotals.entries());

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex items-center space-x-2 pb-4 border-b border-slate-100 mb-4">
        <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
          <Database className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Carrier & Portal Source Distribution
          </h3>
          <p className="text-xs text-slate-500">
            Real observation counts aggregated by scheduled airline and aggregator portals
          </p>
        </div>
      </div>

      {sourcesList.length === 0 ? (
        <div className="py-8 flex flex-col items-center justify-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400">
          <Radio className="w-6 h-6 text-slate-300 mb-1" />
          <span>No source breakdown records available in current aggregation batch.</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sourcesList.map(([airline, count]) => (
            <div
              key={airline}
              className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-sky-600" />
                <span className="font-semibold text-xs text-slate-800">{airline}</span>
              </div>
              <span className="font-mono font-bold text-xs text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
