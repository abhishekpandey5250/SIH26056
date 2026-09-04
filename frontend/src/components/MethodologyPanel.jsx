import React from 'react';
import { BookOpen, Calculator, Info, CheckCircle2 } from 'lucide-react';

export const MethodologyPanel = () => {
  return (
    <div className="bg-slate-900 text-white rounded-xl border border-slate-800 shadow-md p-6 mb-8">
      <div className="flex items-center space-x-2 pb-4 border-b border-slate-800 mb-4">
        <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-lg">
          <BookOpen className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-100">
            Statistical Methodology & Consumer Price Index (CPI) Augmentation
          </h3>
          <p className="text-xs text-slate-400">
            Mathematical formulation according to fixed-weight Laspeyres index standards
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
        {/* Box 1: Core Formulation */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/60">
          <span className="text-sky-400 font-bold uppercase tracking-wider text-[11px] block mb-2">
            1. Fixed-Weight Laspeyres Index
          </span>
          <p className="text-slate-300 leading-relaxed">
            For each advance-purchase window separately:
          </p>
          <div className="bg-slate-950 p-2.5 rounded font-mono text-[11px] text-sky-300 my-2 border border-slate-800">
            Index(t, b) = 100 × Σ [ w*(r) × (P(r,t,b) / P(r,0,b)) ]
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Where <span className="text-slate-200 font-mono">w*(r)</span> is the normalized effective weight among available routes and <span className="text-slate-200 font-mono">P(r,0,b)</span> is the fixed base-period median representative fare.
          </p>
        </div>

        {/* Box 2: Advance-Purchase Buckets */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/60">
          <span className="text-sky-400 font-bold uppercase tracking-wider text-[11px] block mb-2">
            2. Advance-Purchase Windows
          </span>
          <p className="text-slate-300 leading-relaxed mb-2">
            Calculated on exact calendar-day boundaries:
          </p>
          <ul className="space-y-1 text-[11px] text-slate-300 font-mono">
            <li>• <span className="text-sky-300 font-bold">T+1</span>: 1 Day Ahead (Immediate)</li>
            <li>• <span className="text-sky-300 font-bold">T+7</span>: 7 Days Ahead (1 Week)</li>
            <li>• <span className="text-sky-300 font-bold">T+15</span>: 15 Days Ahead (2 Weeks)</li>
            <li>• <span className="text-sky-300 font-bold">T+30</span>: 30 Days Ahead (1 Month)</li>
            <li>• <span className="text-sky-300 font-bold">T+45</span>: 45 Days Ahead (1.5 Months)</li>
          </ul>
          <div className="mt-2 text-[10px] text-amber-300 bg-amber-950/40 p-1.5 rounded border border-amber-800/50">
            ⚠️ T+7/T+15/T+30/T+45 represent observed advance-purchase fare levels, NOT future price predictions.
          </div>
        </div>

        {/* Box 3: Verification Benchmark Example */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/60">
          <span className="text-sky-400 font-bold uppercase tracking-wider text-[11px] block mb-2">
            3. Verification Benchmark Case
          </span>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            Statistical verification benchmark:
          </p>
          <div className="bg-slate-950 p-2 rounded font-mono text-[10px] text-slate-300 my-1.5 border border-slate-800 space-y-0.5">
            <div>DEL-BOM (w=0.50): ₹4,800/₹4,000 → R=120.0</div>
            <div>DEL-BLR (w=0.30): ₹5,500/₹5,000 → R=110.0</div>
            <div>BOM-BLR (w=0.20): ₹6,300/₹6,000 → R=105.0</div>
            <div className="text-emerald-400 pt-1 font-bold border-t border-slate-800">
              Composite Index = 114.00 (+14.0% vs Base)
            </div>
          </div>
          <p className="text-slate-400 text-[10px]">
            *Official production releases import calibrated DGCA city-pair passenger traffic weights.
          </p>
        </div>
      </div>
    </div>
  );
};
