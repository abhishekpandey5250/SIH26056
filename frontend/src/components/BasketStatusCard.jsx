import React, { useState, useEffect } from 'react';
import { Layers, ShieldCheck, AlertCircle, Info, Sparkles, Database } from 'lucide-react';
import { getBasketStatus } from '../services/api.js';

export const BasketStatusCard = ({ dataMode }) => {
  const [basket, setBasket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const res = await getBasketStatus({ dataMode });
        if (isMounted) setBasket(res);
      } catch (err) {
        console.error('Error loading basket status:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [dataMode]);

  const isDgca = basket?.isDgcaDerived;
  const isDemo = dataMode === 'DEMO';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-4 gap-2">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">
                Representative Route Basket & Traffic Weights
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  isDgca
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : isDemo
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {basket?.validationStatus || 'PROVISIONAL / NOT DGCA-VALIDATED'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              City-pair basket composition and fixed weights ({basket?.period || '2026-BASELINE'})
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-600 font-mono">
          <span className="text-slate-400">Total Weight:</span>{' '}
          <span className="font-bold text-slate-900">{basket?.weightSum ?? 1.0}</span>
          <span className="mx-2 text-slate-300">|</span>
          <span className="text-slate-400">Corridors:</span>{' '}
          <span className="font-bold text-slate-900">{basket?.routeCount ?? 0}</span>
        </div>
      </div>

      {/* Grid of Corridor Weights */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {(basket?.routes || []).map((r) => (
          <div key={r.routeKey} className="bg-slate-50/70 p-3 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">{r.routeKey}</span>
              <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold">
                {Math.round(r.weight * 100)}%
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">
              {r.origin} ➔ {r.destination}
            </div>
            {r.passengers && (
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                {r.passengers.toLocaleString('en-IN')} pax
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Rationale & Transparency Note */}
      <div className="flex items-start space-x-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-600">
        <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
        <p className="text-[11px] leading-relaxed">
          {isDgca
            ? 'Weights are derived directly from DGCA published city-pair passenger volume.'
            : isDemo
            ? 'Demonstration corridor weights loaded for hackathon evaluation.'
            : 'Provisional baseline weights active. To activate official DGCA weights, import passenger traffic statistics via scripts/importDGCATraffic.js.'}
        </p>
      </div>
    </div>
  );
};
