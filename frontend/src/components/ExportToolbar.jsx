import React from 'react';
import { Download, FileText, Database, FileSpreadsheet } from 'lucide-react';

export const ExportToolbar = ({ dataMode, selectedBucket }) => {
  const bucket = selectedBucket || 'T+7';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-4 gap-2">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              National Statistical Data Export Center
            </h3>
            <p className="text-xs text-slate-500">
              Download auditable CSV and JSON datasets formatted for NSO, RBI, and researchers
            </p>
          </div>
        </div>

        <span className="text-xs font-mono text-slate-500">
          Environment: <span className="font-bold text-slate-900">{dataMode}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Daily Index */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-900">Daily Airfare Index</div>
            <div className="text-[10px] text-slate-500">Full daily time-series ({bucket})</div>
          </div>
          <div className="flex space-x-1.5">
            <a
              href={`/api/v1/export/index?freq=daily&leadTimeBucket=${bucket}&dataMode=${dataMode}&format=csv`}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              download
            >
              CSV
            </a>
            <a
              href={`/api/v1/export/index?freq=daily&leadTimeBucket=${bucket}&dataMode=${dataMode}&format=json`}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              download
            >
              JSON
            </a>
          </div>
        </div>

        {/* Weekly Index */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-900">Weekly Index (ISO)</div>
            <div className="text-[10px] text-slate-500">Aggregated calendar weeks</div>
          </div>
          <div className="flex space-x-1.5">
            <a
              href={`/api/v1/export/index?freq=weekly&leadTimeBucket=${bucket}&dataMode=${dataMode}&format=csv`}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              download
            >
              CSV
            </a>
            <a
              href={`/api/v1/export/index?freq=weekly&leadTimeBucket=${bucket}&dataMode=${dataMode}&format=json`}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              download
            >
              JSON
            </a>
          </div>
        </div>

        {/* Monthly Index */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-900">Monthly CPI Index</div>
            <div className="text-[10px] text-slate-500">Monthly macroeconomic series</div>
          </div>
          <div className="flex space-x-1.5">
            <a
              href={`/api/v1/export/index?freq=monthly&leadTimeBucket=${bucket}&dataMode=${dataMode}&format=csv`}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              download
            >
              CSV
            </a>
            <a
              href={`/api/v1/export/index?freq=monthly&leadTimeBucket=${bucket}&dataMode=${dataMode}&format=json`}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              download
            >
              JSON
            </a>
          </div>
        </div>

        {/* Sector Heatmap */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-900">Sector Heatmap</div>
            <div className="text-[10px] text-slate-500">Route-level median price matrix</div>
          </div>
          <div className="flex space-x-1.5">
            <a
              href={`/api/v1/export/heatmap?leadTimeBucket=${bucket}&dataMode=${dataMode}&format=csv`}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              download
            >
              CSV
            </a>
            <a
              href={`/api/v1/export/heatmap?leadTimeBucket=${bucket}&dataMode=${dataMode}&format=json`}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              download
            >
              JSON
            </a>
          </div>
        </div>

        {/* Lead Time Elasticity */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-900">Lead-Time Elasticity</div>
            <div className="text-[10px] text-slate-500">T+1 to T+45 observed fares</div>
          </div>
          <div className="flex space-x-1.5">
            <a
              href={`/api/v1/export/lead-time?dataMode=${dataMode}&format=csv`}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              download
            >
              CSV
            </a>
            <a
              href={`/api/v1/export/lead-time?dataMode=${dataMode}&format=json`}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              download
            >
              JSON
            </a>
          </div>
        </div>

        {/* Backtest Report */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-900">DGCA Backtest Report</div>
            <div className="text-[10px] text-slate-500">Normalized alignment time-series</div>
          </div>
          <div className="flex space-x-1.5">
            <a
              href={`/api/v1/export/backtest?leadTimeBucket=${bucket}&dataMode=${dataMode}&format=csv`}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              download
            >
              CSV
            </a>
            <a
              href={`/api/v1/export/backtest?leadTimeBucket=${bucket}&dataMode=${dataMode}&format=json`}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              download
            >
              JSON
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
