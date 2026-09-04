import React from 'react';
import { Calendar, Clock, Info } from 'lucide-react';

const BUCKETS = [
  { key: 'T+1', label: 'T+1', desc: '1 Day Ahead (Immediate)', days: 1 },
  { key: 'T+7', label: 'T+7', desc: '7 Days Ahead (1 Week)', days: 7 },
  { key: 'T+15', label: 'T+15', desc: '15 Days Ahead (2 Weeks)', days: 15 },
  { key: 'T+30', label: 'T+30', desc: '30 Days Ahead (1 Month)', days: 30 },
  { key: 'T+45', label: 'T+45', desc: '45 Days Ahead (1.5 Months)', days: 45 },
];

export const LeadTimeSelector = ({ selectedBucket, onSelectBucket, latestIndices = [] }) => {
  const indexMap = new Map();
  latestIndices.forEach((idx) => {
    indexMap.set(idx.leadTimeBucket, idx);
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-3 gap-2">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-sky-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Observed Advance-Purchase Windows
          </h3>
        </div>
        <div className="flex items-center space-x-1 text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
          <Info className="w-3 h-3 text-sky-500 flex-shrink-0" />
          <span>Observed fares for departures at exact lead times (Not forecasts)</span>
        </div>
      </div>

      {/* Tabs / Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {BUCKETS.map((b) => {
          const isSelected = selectedBucket === b.key;
          const idxData = indexMap.get(b.key);
          const hasValue = idxData?.indexValue != null;

          return (
            <button
              key={b.key}
              onClick={() => onSelectBucket(b.key)}
              className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'bg-sky-50 border-sky-500 text-sky-950 ring-1 ring-sky-500 shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`font-bold text-sm ${isSelected ? 'text-sky-700' : 'text-slate-800'}`}>
                  {b.label}
                </span>
                {hasValue ? (
                  <span className="text-xs font-mono font-semibold text-slate-900">
                    {idxData.indexValue.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono">N/A</span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 leading-tight">
                {b.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
