import React from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, ShieldCheck, AlertCircle } from 'lucide-react';

export const IndexHero = ({ currentIndex, selectedBucket, isLoading }) => {
  const indexValue = currentIndex?.indexValue;
  const hasIndex = typeof indexValue === 'number';
  const dailyChange = currentIndex?.dailyChangePercent;
  const baseRelative = currentIndex?.baseRelativeChangePercent;
  const indexDate = currentIndex?.indexDate || 'No date recorded';

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 rounded-2xl border border-slate-800 text-white p-6 sm:p-8 shadow-lg mb-6 relative overflow-hidden">
      {/* Background visual texture */}
      <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
              {selectedBucket} Observed Advance-Purchase Index
            </span>
            <span className="text-xs text-slate-400 flex items-center">
              <Calendar className="w-3.5 h-3.5 mr-1" />
              {indexDate}
            </span>
          </div>

          <h2 className="text-sm font-medium text-slate-300">
            National Composite Airfare Price Index ({selectedBucket})
          </h2>

          <div className="flex items-baseline space-x-4 mt-3">
            {isLoading ? (
              <div className="h-14 w-40 bg-slate-800 rounded-lg animate-pulse"></div>
            ) : hasIndex ? (
              <div className="text-4xl sm:text-5xl font-extrabold tracking-tight font-mono text-white">
                {indexValue.toFixed(2)}
              </div>
            ) : (
              <div className="text-4xl sm:text-5xl font-extrabold tracking-tight font-mono text-slate-500">
                N/A
              </div>
            )}

            <div className="text-xs text-slate-400 border-l border-slate-700 pl-3">
              <div className="text-slate-300 font-medium">Base Period = 100.00</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {currentIndex?.basePeriod
                  ? `${currentIndex.basePeriod.startDate} to ${currentIndex.basePeriod.endDate}`
                  : 'Benchmark fixed period'}
              </div>
            </div>
          </div>
        </div>

        {/* Change Indicators */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
          {/* Day-to-Day Change */}
          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 min-w-[140px]">
            <div className="text-[11px] text-slate-400 font-medium">Day-to-Day Change</div>
            <div className="mt-1 flex items-center space-x-1 font-mono font-bold text-sm">
              {dailyChange != null ? (
                dailyChange > 0 ? (
                  <>
                    <TrendingUp className="w-4 h-4 text-rose-400" />
                    <span className="text-rose-400">+{dailyChange.toFixed(2)}%</span>
                  </>
                ) : dailyChange < 0 ? (
                  <>
                    <TrendingDown className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">{dailyChange.toFixed(2)}%</span>
                  </>
                ) : (
                  <>
                    <Minus className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">0.00%</span>
                  </>
                )
              ) : (
                <span className="text-slate-500">N/A</span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">vs previous observation</div>
          </div>

          {/* Deviation from Base */}
          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 min-w-[150px]">
            <div className="text-[11px] text-slate-400 font-medium">Base-Relative Level</div>
            <div className="mt-1 font-mono font-bold text-sm">
              {baseRelative != null ? (
                baseRelative > 0 ? (
                  <span className="text-amber-300">+{baseRelative.toFixed(2)}% vs Base</span>
                ) : baseRelative < 0 ? (
                  <span className="text-sky-300">{baseRelative.toFixed(2)}% vs Base</span>
                ) : (
                  <span className="text-slate-300">Par (100.0)</span>
                )
              ) : (
                <span className="text-slate-500">N/A</span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Laspeyres fixed-weight</div>
          </div>
        </div>
      </div>
    </div>
  );
};
