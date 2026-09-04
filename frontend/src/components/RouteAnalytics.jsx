import React, { useState } from 'react';
import { Plane, Search, ArrowUpDown, Filter, AlertCircle } from 'lucide-react';

export const RouteAnalytics = ({ currentIndex, selectedBucket }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const routes = currentIndex?.routes || [];

  const filteredRoutes = routes.filter((r) => {
    const term = searchTerm.trim().toUpperCase();
    if (!term) return true;
    return (
      r.routeKey.includes(term) ||
      (r.origin && r.origin.includes(term)) ||
      (r.destination && r.destination.includes(term))
    );
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-4 gap-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <Plane className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              City-Pair Route Contribution Breakdown ({selectedBucket})
            </h3>
            <p className="text-xs text-slate-500">
              Route-level base fares, observed medians, price relatives, and effective weights
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search route (e.g. DEL-BOM)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-slate-50/50"
          />
        </div>
      </div>

      {/* Table / Empty state */}
      {routes.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200 text-center">
          <AlertCircle className="w-6 h-6 text-slate-400 mb-2" />
          <p className="text-xs font-semibold text-slate-700">
            No route observations available for {selectedBucket}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Route price relatives will populate once daily aggregations are processed.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">City-Pair Route</th>
                <th className="py-2.5 px-3 text-right">Current Fare (P_t)</th>
                <th className="py-2.5 px-3 text-right">Base Fare (P_0)</th>
                <th className="py-2.5 px-3 text-right">Price Relative (R)</th>
                <th className="py-2.5 px-3 text-right">Config Weight (w)</th>
                <th className="py-2.5 px-3 text-right">Effective Weight (w*)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRoutes.map((r) => {
                const relativeDiff = r.priceRelative - 100;
                return (
                  <tr key={r.routeKey} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 font-mono">
                      {r.origin} → {r.destination}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                      ₹{r.currentFare.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      ₹{r.baseFare.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] ${
                          relativeDiff > 0
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : relativeDiff < 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {r.priceRelative.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      {(r.configuredWeight * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                      {(r.effectiveWeight * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
