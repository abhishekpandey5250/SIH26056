import React, { useState } from 'react';
import { LineChart, Calendar, HelpCircle, Activity } from 'lucide-react';

export const IndexHistoryChart = ({ historyData = [], selectedBucket, isLoading }) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const hasData = Array.isArray(historyData) && historyData.length > 0;

  // Chart dimensions & scaling calculations
  const width = 700;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 35, left: 45 };

  let points = [];
  let minVal = 90;
  let maxVal = 120;
  let basePathY = 0;
  let pathD = '';

  if (hasData) {
    const values = historyData.map((d) => d.indexValue);
    minVal = Math.min(...values, 95);
    maxVal = Math.max(...values, 105);
    const range = maxVal - minVal || 10;

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    points = historyData.map((d, index) => {
      const x =
        historyData.length === 1
          ? padding.left + chartW / 2
          : padding.left + (index / (historyData.length - 1)) * chartW;
      const y = padding.top + chartH - ((d.indexValue - minVal) / range) * chartH;
      return { ...d, x, y };
    });

    basePathY = padding.top + chartH - ((100 - minVal) / range) * chartH;

    pathD = points.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
    }, '');
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-4 gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
            <LineChart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Historical Price Index Trend ({selectedBucket})
            </h3>
            <p className="text-xs text-slate-500">
              Time-series tracking of fixed-weight Laspeyres index
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="flex items-center text-slate-500">
            <span className="w-3 h-0.5 bg-sky-600 mr-1.5"></span>
            {selectedBucket} Index
          </span>
          <span className="flex items-center text-slate-400 ml-2">
            <span className="w-3 h-0.5 border-t border-dashed border-slate-400 mr-1.5"></span>
            Base (100.0)
          </span>
        </div>
      </div>

      {/* Chart Canvas or Empty State */}
      {isLoading ? (
        <div className="h-60 flex items-center justify-center bg-slate-50 rounded-lg animate-pulse text-xs text-slate-400">
          Loading historical index time series...
        </div>
      ) : !hasData ? (
        <div className="h-60 flex flex-col items-center justify-center bg-slate-50/60 rounded-lg border border-dashed border-slate-200 p-6 text-center">
          <Activity className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-600">
            No historical index data available yet for {selectedBucket}
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Historical index data will appear after sufficient daily observations are collected and indexed.
          </p>
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible select-none"
          >
            {/* Gridlines */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={width - padding.right}
              y2={padding.top}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
            />
            <line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={width - padding.right}
              y2={height - padding.bottom}
              stroke="#e2e8f0"
            />

            {/* Base Period Reference Line (Y = 100) */}
            {basePathY >= padding.top && basePathY <= height - padding.bottom && (
              <>
                <line
                  x1={padding.left}
                  y1={basePathY}
                  x2={width - padding.right}
                  y2={basePathY}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />
                <text
                  x={width - padding.right + 4}
                  y={basePathY + 3}
                  className="text-[9px] fill-slate-400 font-mono font-medium"
                >
                  100.0
                </text>
              </>
            )}

            {/* Y Axis Min & Max Labels */}
            <text
              x={padding.left - 8}
              y={padding.top + 4}
              textAnchor="end"
              className="text-[9px] fill-slate-400 font-mono"
            >
              {maxVal.toFixed(0)}
            </text>
            <text
              x={padding.left - 8}
              y={height - padding.bottom}
              textAnchor="end"
              className="text-[9px] fill-slate-400 font-mono"
            >
              {minVal.toFixed(0)}
            </text>

            {/* Trend Line */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data Points */}
            {points.map((pt, i) => (
              <g key={i}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredPoint === i ? 5 : 3.5}
                  className={`${hoveredPoint === i ? 'fill-sky-700 stroke-white stroke-2' : 'fill-sky-600'} cursor-pointer transition-all`}
                  onMouseEnter={() => setHoveredPoint(i)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                {/* X Axis Date Label */}
                <text
                  x={pt.x}
                  y={height - 12}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-500 font-mono"
                >
                  {pt.indexDate.slice(5)}
                </text>
              </g>
            ))}
          </svg>

          {/* Hover Tooltip */}
          {hoveredPoint !== null && points[hoveredPoint] && (
            <div
              className="absolute bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
              style={{
                left: `${(points[hoveredPoint].x / width) * 100}%`,
                top: `${(points[hoveredPoint].y / height) * 100}%`,
              }}
            >
              <div className="font-bold font-mono">
                {points[hoveredPoint].indexValue.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-300">
                {points[hoveredPoint].indexDate}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
