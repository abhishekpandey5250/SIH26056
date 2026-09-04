import React from 'react';
import { Network, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const RouteOverview = ({ currentIndex, selectedBucket }) => {
  const routes = currentIndex?.routes || [];

  if (routes.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex items-center space-x-2 pb-4 border-b border-slate-100 mb-4">
        <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
          <Network className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Route Matrix Overview ({selectedBucket})
          </h3>
          <p className="text-xs text-slate-500">
            Visual status of monitored domestic trunk corridors
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {routes.map((r) => {
          const diff = r.priceRelative - 100;
          const isHigher = diff > 0;
          const isLower = diff < 0;

          return (
            <div
              key={r.routeKey}
              className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900 font-mono">
                  {r.origin} ✈ {r.destination}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  w*: {(r.effectiveWeight * 100).toFixed(0)}%
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xs font-mono font-bold text-slate-800">
                  ₹{r.currentFare.toLocaleString('en-IN')}
                </span>
                <div className="flex items-center space-x-0.5 text-xs font-mono font-semibold">
                  {isHigher ? (
                    <>
                      <TrendingUp className="w-3 h-3 text-rose-500" />
                      <span className="text-rose-600">+{diff.toFixed(1)}%</span>
                    </>
                  ) : isLower ? (
                    <>
                      <TrendingDown className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-600">{diff.toFixed(1)}%</span>
                    </>
                  ) : (
                    <>
                      <Minus className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-500">0.0%</span>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-1 text-[10px] text-slate-400">
                Base: ₹{r.baseFare.toLocaleString('en-IN')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
