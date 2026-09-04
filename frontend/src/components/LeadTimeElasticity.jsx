import React, { useState, useEffect } from 'react';
import { LineChart, Clock, Download, Info } from 'lucide-react';
import { getLeadTimeElasticity } from '../services/api.js';

export const LeadTimeElasticity = ({ dataMode }) => {
  const [elasticity, setElasticity] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const res = await getLeadTimeElasticity({ dataMode });
        if (isMounted) setElasticity(res);
      } catch (err) {
        console.error('Error loading lead time elasticity:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [dataMode]);

  const curve = elasticity?.curve || [];
  const validPoints = curve.filter((c) => c.medianFare !== null);

  const renderCurveSVG = () => {
    if (validPoints.length < 2) {
      return (
        <div className="h-40 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          Insufficient observations across lead-time horizons to render elasticity curve.
        </div>
      );
    }

    const fares = validPoints.map((p) => p.medianFare);
    const minFare = Math.floor(Math.min(...fares) * 0.9);
    const maxFare = Math.ceil(Math.max(...fares) * 1.1);
    const range = maxFare - minFare || 1;

    const width = 600;
    const height = 160;
    const padX = 45;
    const padY = 20;

    const getX = (idx) => padX + (idx / (validPoints.length - 1)) * (width - padX * 2);
    const getY = (val) => height - padY - ((val - minFare) / range) * (height - padY * 2);

    const pathData = validPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)},${getY(p.medianFare)}`)
      .join(' ');

    return (
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40 overflow-visible">
          {/* Background area fill */}
          <path
            d={`${pathData} L ${getX(validPoints.length - 1)},${height - padY} L ${getX(0)},${height - padY} Z`}
            fill="url(#elasticityGrad)"
            opacity="0.3"
          />
          <defs>
            <linearGradient id="elasticityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Curve stroke */}
          <path d={pathData} fill="none" stroke="#0284c7" strokeWidth="2.5" />

          {/* Points & Labels */}
          {validPoints.map((p, i) => (
            <g key={p.bucket}>
              <circle cx={getX(i)} cy={getY(p.medianFare)} r="4" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
              <text
                x={getX(i)}
                y={getY(p.medianFare) - 8}
                textAnchor="middle"
                className="text-[10px] font-mono fill-slate-700 font-bold"
              >
                ₹{p.medianFare.toLocaleString('en-IN')}
              </text>
              <text
                x={getX(i)}
                y={height - padY + 14}
                textAnchor="middle"
                className="text-[10px] font-bold fill-slate-600"
              >
                {p.bucket}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-6 gap-2">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-50 text-sky-700 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Observed Fare by Advance-Purchase Window (T+1 to T+45)
            </h3>
            <p className="text-xs text-slate-500">
              Cross-sectional median pricing curve across standard booking horizons
            </p>
          </div>
        </div>

        <a
          href={`/api/v1/export/lead-time?dataMode=${dataMode}&format=csv`}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
          download
        >
          <Download className="w-3.5 h-3.5 mr-1 text-slate-500" />
          <span>Export Curve CSV</span>
        </a>
      </div>

      {/* SVG Curve */}
      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 mb-4">
        {renderCurveSVG()}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {curve.map((c) => (
          <div key={c.bucket} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
            <div className="text-xs font-bold text-slate-900">{c.bucket}</div>
            <div className="text-[10px] text-slate-500">{c.label}</div>
            <div className="text-sm font-bold font-mono text-sky-900 mt-1">
              {c.medianFare ? `₹${c.medianFare.toLocaleString('en-IN')}` : 'N/A'}
            </div>
            {c.percentVsT1 !== null && (
              <div className={`text-[10px] font-mono mt-0.5 font-bold ${c.percentVsT1 < 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
                {c.percentVsT1 === 0 ? 'Surge Baseline' : `${c.percentVsT1}% vs T+1`}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Methodology Notice */}
      <div className="flex items-start space-x-2 text-xs bg-sky-50/70 p-3 rounded-lg border border-sky-200/80 text-sky-900">
        <Info className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
        <p className="text-[11px] leading-relaxed">
          <span className="font-bold">Descriptive Notice:</span> This curve represents observed market fares for departures $N$ days ahead. It is an empirical snapshot of booking horizon price differentials, <span className="underline">NOT a predictive forecast</span>.
        </p>
      </div>
    </div>
  );
};
