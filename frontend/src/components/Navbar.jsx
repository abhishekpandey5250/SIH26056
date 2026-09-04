import React from 'react';
import { Plane, Activity, RefreshCw, Database, Sparkles } from 'lucide-react';

export const Navbar = ({ health, dataMode, onToggleDataMode, isLoading, lastUpdated, onRefresh }) => {
  const isHealthy = health?.status === 'healthy';
  const isDegraded = health?.status === 'degraded';

  const formatTime = (date) => {
    if (!date) return 'Waiting for update';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Context */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-600 rounded-lg shadow-sm">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base sm:text-lg tracking-tight">AIRFARE PRICE INDEX</span>
                <span className="text-[11px] font-semibold text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-700/60">
                  MoSPI CPI Prototype
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Real-time domestic airfare monitoring for India | Problem Statement SIH26056
              </p>
            </div>
          </div>

          {/* Right Status & Controls */}
          <div className="flex items-center space-x-3">
            {/* Mode Switcher Pill (REAL vs DEMO) */}
            <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => onToggleDataMode && onToggleDataMode('REAL')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded font-medium transition-all ${
                  dataMode === 'REAL'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View live scraper data ingested from airlines"
              >
                <Database className="w-3 h-3" />
                <span>LIVE SCRAPER DATA</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleDataMode && onToggleDataMode('DEMO')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded font-medium transition-all ${
                  dataMode === 'DEMO'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View deterministic evaluation demo dataset"
              >
                <Sparkles className="w-3 h-3" />
                <span>DEMO DATASET</span>
              </button>
            </div>

            {/* Telemetry Status */}
            <div className="hidden lg:flex items-center space-x-2 text-xs bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Backend:</span>
              {isHealthy ? (
                <span className="inline-flex items-center text-emerald-400 font-medium">
                  <span className="w-2 h-2 mr-1 bg-emerald-500 rounded-full animate-ping"></span>
                  Connected
                </span>
              ) : isDegraded ? (
                <span className="inline-flex items-center text-amber-400 font-medium">
                  <span className="w-2 h-2 mr-1 bg-amber-500 rounded-full"></span>
                  Degraded
                </span>
              ) : (
                <span className="inline-flex items-center text-rose-400 font-medium">
                  <span className="w-2 h-2 mr-1 bg-rose-500 rounded-full"></span>
                  Offline
                </span>
              )}
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Updated:</span>
              <span className="text-slate-200 font-mono">{formatTime(lastUpdated)}</span>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
              title="Refresh telemetry and latest index data"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
