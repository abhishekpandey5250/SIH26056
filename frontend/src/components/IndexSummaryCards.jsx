import React from 'react';
import { BarChart3, TrendingUp, ShieldCheck, MapPin, AlertTriangle } from 'lucide-react';

export const IndexSummaryCards = ({ currentIndex, isLoading }) => {
  const indexValue = currentIndex?.indexValue;
  const hasIndex = typeof indexValue === 'number';
  const dailyChange = currentIndex?.dailyChangePercent;
  const coverage = currentIndex?.weightCoverage;
  const hasCoverage = typeof coverage === 'number';
  const routeCount = currentIndex?.routeCount;
  const configuredRouteCount = currentIndex?.configuredRouteCount;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Current Index */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Current Index
          </span>
          <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
            <BarChart3 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
          {isLoading ? '...' : hasIndex ? indexValue.toFixed(2) : 'N/A'}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Fixed Base Index = 100.00
        </div>
      </div>

      {/* 2. Daily Change */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Daily Change
          </span>
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
          {isLoading ? (
            '...'
          ) : dailyChange != null ? (
            `${dailyChange > 0 ? '+' : ''}${dailyChange.toFixed(2)}%`
          ) : (
            'N/A'
          )}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Like-for-like window comparison
        </div>
      </div>

      {/* 3. Weight Coverage */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Weight Coverage
          </span>
          <div className={`p-1.5 rounded-lg ${hasCoverage && coverage < 100 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {hasCoverage && coverage < 100 ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
          {isLoading ? '...' : hasCoverage ? `${coverage.toFixed(1)}%` : 'N/A'}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {hasCoverage && coverage < 100 ? (
            <span className="text-amber-600 font-medium">Partial coverage (renormalized)</span>
          ) : (
            'Complete weight representation'
          )}
        </div>
      </div>

      {/* 4. Routes Included */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Routes Included
          </span>
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <MapPin className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
          {isLoading ? (
            '...'
          ) : routeCount != null ? (
            `${routeCount} / ${configuredRouteCount || routeCount}`
          ) : (
            'N/A'
          )}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Active city-pair corridors
        </div>
      </div>
    </div>
  );
};
