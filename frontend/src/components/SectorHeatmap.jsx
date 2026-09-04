import React, { useState, useEffect } from 'react';
import { Grid, TrendingUp, TrendingDown, ArrowRight, Download, Info } from 'lucide-react';
import { getSectorHeatmap } from '../services/api.js';

export const SectorHeatmap = ({ dataMode, selectedBucket }) => {
  const [sectors, setSectors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const res = await getSectorHeatmap({
          leadTimeBucket: selectedBucket,
          dataMode,
        });
        if (isMounted) setSectors(res.data || []);
      } catch (err) {
        console.error('Error loading sector heatmap:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [selectedBucket, dataMode]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-6 gap-2">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-50 text-sky-700 rounded-lg">
            <Grid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Sector-Wise Airfare Heatmap Matrix ({selectedBucket})
            </h3>
            <p className="text-xs text-slate-500">
              Corridor price movement, base relatives, and observation density
            </p>
          </div>
        </div>

        <a
          href={`/api/v1/export/heatmap?leadTimeBucket=${selectedBucket}&dataMode=${dataMode}&format=csv`}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
          download
        >
          <Download className="w-3.5 h-3.5 mr-1 text-slate-500" />
          <span>Export Heatmap CSV</span>
        </a>
      </div>

      {sectors.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          No sector observation records found for {selectedBucket} under current {dataMode} environment.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectors.map((s) => {
            const hasChange = s.changePercent !== null;
            const isSurge = hasChange && s.changePercent > 0;
            const isDrop = hasChange && s.changePercent < 0;

            const cardBg = isSurge
              ? 'bg-rose-50/50 border-rose-200'
              : isDrop
              ? 'bg-emerald-50/50 border-emerald-200'
              : 'bg-slate-50/70 border-slate-200';

            return (
              <div key={s.sector} className={`p-4 rounded-xl border ${cardBg} transition-all`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-slate-900">{s.sector}</span>
                  <span className="text-[10px] font-mono text-slate-500 bg-white/80 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                    Weight: {Math.round(s.weight * 100)}%
                  </span>
                </div>

                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <div className="text-xs text-slate-500">Median Fare</div>
                    <div className="text-lg font-bold text-slate-900 font-mono">
                      ₹{s.value.toLocaleString('en-IN')}
                    </div>
                  </div>

                  {hasChange && (
                    <div className="text-right">
                      <div className="text-xs text-slate-500">vs Base ({s.baseValue ? `₹${s.baseValue}` : 'N/A'})</div>
                      <div className={`text-xs font-bold font-mono inline-flex items-center ${isSurge ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {isSurge ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                        {s.changePercent > 0 ? `+${s.changePercent}%` : `${s.changePercent}%`}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Range: ₹{s.minFare} – ₹{s.maxFare}</span>
                  <span>{s.observationCount} obs</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
