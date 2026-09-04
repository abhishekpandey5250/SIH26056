import React from 'react';
import {
  Radio,
  DownloadCloud,
  Layers,
  Cpu,
  LayoutDashboard,
  ArrowRight,
  Clock,
  Sparkles,
  Database,
} from 'lucide-react';

export const PipelineStatusFlow = ({ health, scraperStatus, diagnostics, dataMode }) => {
  const isDbConnected = health?.database === 'connected';
  const isBackendOnline = health?.status === 'healthy' || health?.status === 'degraded';

  const pipeline = scraperStatus?.pipeline || {};
  const observationsStored = diagnostics?.rawObservations ?? scraperStatus?.observationsStored ?? 0;
  const indexEligible = diagnostics?.eligibleObservations ?? scraperStatus?.indexEligible ?? 0;
  const indicesCalculated = diagnostics?.indexRecordsAvailable ?? pipeline.indicesCalculated ?? 0;
  const lastPipelineRun = pipeline.lastPipelineRunAt;

  const formatTimestamp = (ts) => {
    if (!ts) return 'Standby';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return ts;
    }
  };

  const isDemo = dataMode === 'DEMO';

  const stages = [
    {
      id: 'scraper',
      label: 'Scraper Portals',
      subtext: isDemo ? 'Deterministic Simulator' : 'IndiGo / AI / OTAs',
      icon: isDemo ? Sparkles : Radio,
      status: 'READY',
      badge: isDemo ? 'DEMO ENVIRONMENT' : 'LIVE CRAWLERS',
      badgeColor: isDemo
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      id: 'ingestion',
      label: 'Ingestion Layer',
      subtext: `${observationsStored} stored (${indexEligible} clean)`,
      icon: DownloadCloud,
      status: isBackendOnline ? 'READY' : 'OFFLINE',
      badge: isBackendOnline ? 'Auth & Triage' : 'Offline',
      badgeColor: isBackendOnline
        ? 'bg-sky-50 text-sky-700 border-sky-200'
        : 'bg-rose-50 text-rose-700 border-rose-200',
    },
    {
      id: 'aggregation',
      label: 'Route Aggregation',
      subtext: 'Median representative fares',
      icon: Layers,
      status: isDbConnected ? 'READY' : 'DEGRADED',
      badge: isDbConnected ? 'T+1 to T+45' : 'In-Memory',
      badgeColor: isDbConnected
        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
        : 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      id: 'index',
      label: 'Index Engine',
      subtext: 'Laspeyres fixed-weight',
      icon: Cpu,
      status: isBackendOnline ? 'READY' : 'OFFLINE',
      badge: indicesCalculated > 0 ? `${indicesCalculated} variants` : 'Idempotent',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    {
      id: 'dashboard',
      label: 'Real-time Portal',
      subtext: isDemo ? 'Evaluating Demo Dataset' : 'MoSPI Live Ingestion',
      icon: isDemo ? Sparkles : LayoutDashboard,
      status: 'LIVE',
      badge: isDemo ? 'Demo Mode' : 'Live Dashboard',
      badgeColor: isDemo
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-4 gap-2">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-lg ${isDemo ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'}`}>
            {isDemo ? <Sparkles className="w-4 h-4" /> : <Database className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                End-to-End Pipeline Architecture Status
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isDemo
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}
              >
                {isDemo ? 'ENVIRONMENT: DEMO DATASET' : 'ENVIRONMENT: LIVE REAL DATA'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Autonomous ingestion, triage, aggregation, and index calculation workflow
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Last Pipeline Run: {formatTimestamp(lastPipelineRun)}</span>
        </div>
      </div>

      {/* Pipeline Stages Flow */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
        {stages.map((st, i) => {
          const Icon = st.icon;
          return (
            <div key={st.id} className="relative flex flex-col justify-between">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 bg-white text-slate-700 rounded border border-slate-200 shadow-2xs">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${st.badgeColor}`}
                  >
                    {st.badge}
                  </span>
                </div>

                <div className="font-bold text-xs text-slate-900">{st.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">{st.subtext}</div>
              </div>

              {/* Arrow Connector on desktop */}
              {i < stages.length - 1 && (
                <div className="hidden md:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 text-slate-300">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
