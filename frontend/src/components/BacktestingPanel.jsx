import React, { useState, useEffect } from 'react';
import {
  Scale,
  Calendar,
  Download,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FileSpreadsheet,
  TrendingUp,
  RefreshCw,
  Info,
} from 'lucide-react';
import { getBacktestStatus, getBacktest30Day } from '../services/api.js';

export const BacktestingPanel = ({ dataMode }) => {
  const [status, setStatus] = useState(null);
  const [startDate, setStartDate] = useState('2026-08-01');
  const [endDate, setEndDate] = useState('2026-08-30');
  const [selectedBucket, setSelectedBucket] = useState('T+7');
  const [backtestData, setBacktestData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      setStatusLoading(true);
      const res = await getBacktestStatus({ dataMode });
      setStatus(res);
      if (res.earliestDgcaDate && res.latestDgcaDate) {
        setStartDate(res.earliestDgcaDate);
        setEndDate(res.latestDgcaDate);
      }
    } catch (err) {
      console.error('Error loading backtest status:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const runBacktest = async () => {
    if (!status?.dgcaDatasetAvailable) return;
    try {
      setIsLoading(true);
      const res = await getBacktest30Day({
        startDate,
        endDate,
        leadTimeBucket: selectedBucket,
        dataMode,
      });
      setBacktestData(res);
    } catch (err) {
      console.error('Error executing backtest:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [dataMode]);

  useEffect(() => {
    if (status?.dgcaDatasetAvailable) {
      runBacktest();
    } else {
      setBacktestData(null);
    }
  }, [status, selectedBucket]);

  const metrics = backtestData?.metrics || {};
  const quality = backtestData?.quality || {};
  const timeSeries = backtestData?.timeSeries || [];
  const routeComparisons = backtestData?.routeComparisons || [];

  // Dual-line SVG Chart generator
  const renderComparisonChart = () => {
    const validPoints = timeSeries.filter((d) => d.normalizedOurIndex !== null && d.normalizedDgcaIndex !== null);
    if (validPoints.length < 2) {
      return (
        <div className="h-48 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          Insufficient overlapping date points to render dual-series trend line.
        </div>
      );
    }

    const allValues = validPoints.flatMap((d) => [d.normalizedOurIndex, d.normalizedDgcaIndex]);
    const minVal = Math.floor(Math.min(...allValues) - 2);
    const maxVal = Math.ceil(Math.max(...allValues) + 2);
    const range = maxVal - minVal || 1;

    const width = 640;
    const height = 180;
    const padX = 40;
    const padY = 20;

    const getX = (idx) => padX + (idx / (validPoints.length - 1)) * (width - padX * 2);
    const getY = (val) => height - padY - ((val - minVal) / range) * (height - padY * 2);

    const ourPath = validPoints.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)},${getY(d.normalizedOurIndex)}`).join(' ');
    const dgcaPath = validPoints.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)},${getY(d.normalizedDgcaIndex)}`).join(' ');

    return (
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 overflow-visible">
          {/* Grid lines */}
          <line x1={padX} y1={getY(100)} x2={width - padX} y2={getY(100)} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth="1" />
          <text x={padX - 8} y={getY(100) + 3} textAnchor="end" className="text-[9px] fill-slate-400 font-mono">100.0</text>

          {/* DGCA Reference Line (Amber) */}
          <path d={dgcaPath} fill="none" stroke="#d97706" strokeWidth="2.5" strokeDasharray="5 3" />

          {/* Our Index Line (Sky/Indigo) */}
          <path d={ourPath} fill="none" stroke="#0284c7" strokeWidth="2.5" />

          {/* Points */}
          {validPoints.map((d, i) => (
            <g key={d.date}>
              <circle cx={getX(i)} cy={getY(d.normalizedOurIndex)} r="3" fill="#0284c7" />
              <circle cx={getX(i)} cy={getY(d.normalizedDgcaIndex)} r="3" fill="#d97706" />
            </g>
          ))}
        </svg>

        {/* Legend */}
        <div className="flex items-center justify-center space-x-6 mt-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-4 h-0.5 bg-sky-600 inline-block"></span>
            <span className="font-semibold text-slate-700">Our Normalized Airfare Index</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-4 h-0.5 bg-amber-600 inline-block border-b border-dashed border-amber-600"></span>
            <span className="font-semibold text-slate-700">DGCA Normalized Reference Benchmark</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 mb-6 gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              30-Day Backtesting & DGCA Validation Engine
            </h2>
            <p className="text-xs text-slate-500">
              Empirical statistical verification against official DGCA/MoCA tariff reference datasets
            </p>
          </div>
        </div>

        {/* Action / Refresh */}
        <button
          onClick={fetchStatus}
          disabled={statusLoading}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${statusLoading ? 'animate-spin text-sky-600' : ''}`} />
          <span>Check Benchmark Status</span>
        </button>
      </div>

      {/* Dataset State Check */}
      {!status?.dgcaDatasetAvailable ? (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-6 text-slate-800">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                DGCA Reference Dataset Not Loaded
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Backtesting framework is active, but official DGCA reference data has not been imported into the current environment. To maintain zero fake data integrity, backtesting metrics remain inactive until real benchmark data is loaded.
              </p>
              <div className="bg-white/90 rounded-lg p-3.5 border border-amber-200/80 font-mono text-[11px] text-slate-700 space-y-1">
                <div className="text-amber-900 font-semibold font-sans mb-1 text-xs">How to import official DGCA reference data:</div>
                <div>1. Place CSV or JSON file in <span className="text-indigo-600 font-bold">data/dgca_reference.csv</span></div>
                <div>2. Run importer: <span className="text-emerald-700 font-bold">node backend/scripts/importDGCAData.js data/dgca_reference.csv</span></div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="font-medium text-slate-600">Start:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="font-medium text-slate-600">End:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="font-medium text-slate-600">Lead Window:</span>
                <select
                  value={selectedBucket}
                  onChange={(e) => setSelectedBucket(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded font-semibold text-xs text-sky-900"
                >
                  <option value="T+1">T+1 (Immediate)</option>
                  <option value="T+7">T+7 (1-Week Benchmark)</option>
                  <option value="T+15">T+15 (2-Weeks)</option>
                  <option value="T+30">T+30 (1-Month)</option>
                  <option value="T+45">T+45 (1.5-Months)</option>
                </select>
              </div>

              <button
                onClick={runBacktest}
                disabled={isLoading}
                className="px-3.5 py-1 bg-sky-600 text-white rounded font-medium text-xs hover:bg-sky-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Calculating...' : 'Run Backtest'}
              </button>
            </div>

            {/* Export */}
            <a
              href={`/api/backtest/30-day/export?startDate=${startDate}&endDate=${endDate}&leadTimeBucket=${selectedBucket}&format=csv`}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
              download
            >
              <Download className="w-3.5 h-3.5 mr-1 text-slate-500" />
              <span>Export CSV</span>
            </a>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Overlapping Days</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {backtestData?.overlappingDays ?? 0} <span className="text-xs font-normal text-slate-500">/ {backtestData?.daysRequested ?? 0}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{backtestData?.coveragePercentage ?? 0}% Coverage</div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">MAE (Norm Index)</div>
              <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                {metrics.mae !== null ? `${metrics.mae}` : 'N/A'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Mean Absolute Error</div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">MAPE</div>
              <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                {metrics.mape !== null ? `${metrics.mape}%` : 'N/A'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Mean Abs % Error</div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">RMSE</div>
              <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                {metrics.rmse !== null ? `${metrics.rmse}` : 'N/A'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Root Mean Sq Error</div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Pearson r</div>
              <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                {metrics.correlation !== null ? `${metrics.correlation}` : 'N/A'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Correlation Coeff</div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Directional Agree</div>
              <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                {metrics.directionalAgreement !== null ? `${metrics.directionalAgreement}%` : 'N/A'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Trend Concordance</div>
            </div>
          </div>

          {/* Dual-Series Comparison Chart */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Base-Normalized Series Alignment ({startDate} to {endDate})
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">Base = 100.0 (First Overlapping Observation)</span>
            </div>
            {renderComparisonChart()}
          </div>

          {/* Route-Level Comparison Table (if route data exists) */}
          {routeComparisons.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                Route-Level Average Fare Comparison vs DGCA Benchmarks
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold">
                    <tr>
                      <th className="px-3 py-2">Route</th>
                      <th className="px-3 py-2">Matched Days</th>
                      <th className="px-3 py-2">Our Median Fare</th>
                      <th className="px-3 py-2">DGCA Mean Fare</th>
                      <th className="px-3 py-2">Abs Diff</th>
                      <th className="px-3 py-2">% Difference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {routeComparisons.map((rc) => (
                      <tr key={rc.routeKey} className="hover:bg-slate-50 font-mono">
                        <td className="px-3 py-2 font-bold font-sans text-slate-900">{rc.routeKey}</td>
                        <td className="px-3 py-2 text-slate-600">{rc.matchedObservations}</td>
                        <td className="px-3 py-2 text-slate-800">₹{rc.ourMeanFare.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-slate-800">₹{rc.dgcaMeanFare.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-slate-800">₹{rc.meanAbsoluteDiff.toLocaleString('en-IN')}</td>
                        <td className={`px-3 py-2 font-semibold ${rc.meanPercentDiff >= 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {rc.meanPercentDiff > 0 ? `+${rc.meanPercentDiff}%` : `${rc.meanPercentDiff}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Warnings and Quality Notes */}
          {quality.warnings && quality.warnings.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="font-bold text-slate-700 flex items-center">
                <Info className="w-3.5 h-3.5 mr-1 text-slate-500" />
                <span>Statistical Quality & Methodology Disclaimers:</span>
              </div>
              <ul className="list-disc list-inside text-slate-600 space-y-0.5 text-[11px]">
                {quality.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
