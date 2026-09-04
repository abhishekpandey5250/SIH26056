import React from 'react';
import { useAirfareData } from '../hooks/useAirfareData.js';
import { Navbar } from '../components/Navbar.jsx';
import { StatusCard } from '../components/StatusCard.jsx';
import { PipelineStatusFlow } from '../components/PipelineStatusFlow.jsx';
import { BasketStatusCard } from '../components/BasketStatusCard.jsx';
import { IndexHero } from '../components/IndexHero.jsx';
import { LeadTimeSelector } from '../components/LeadTimeSelector.jsx';
import { IndexSummaryCards } from '../components/IndexSummaryCards.jsx';
import { IndexHistoryChart } from '../components/IndexHistoryChart.jsx';
import { LeadTimeComparison } from '../components/LeadTimeComparison.jsx';
import { LeadTimeElasticity } from '../components/LeadTimeElasticity.jsx';
import { SectorHeatmap } from '../components/SectorHeatmap.jsx';
import { RouteAnalytics } from '../components/RouteAnalytics.jsx';
import { RouteOverview } from '../components/RouteOverview.jsx';
import { BacktestingPanel } from '../components/BacktestingPanel.jsx';
import { ExportToolbar } from '../components/ExportToolbar.jsx';
import { DataQualityPanel } from '../components/DataQualityPanel.jsx';
import { DataSourcesPanel } from '../components/DataSourcesPanel.jsx';
import { MethodologyPanel } from '../components/MethodologyPanel.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { ErrorState } from '../components/ErrorState.jsx';

export const Dashboard = () => {
  const {
    dataMode,
    setDataMode,
    selectedBucket,
    setSelectedBucket,
    health,
    scraperStatus,
    diagnostics,
    latestIndices,
    currentIndex,
    historyData,
    aggregations,
    isLoading,
    isHistoryLoading,
    error,
    lastUpdated,
    refetchData,
  } = useAirfareData();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased">
      {/* 1. Header Navigation */}
      <Navbar
        health={health}
        dataMode={dataMode}
        onToggleDataMode={setDataMode}
        isLoading={isLoading}
        lastUpdated={lastUpdated}
        onRefresh={refetchData}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* System Infrastructure Telemetry Warning Banner (if degraded) */}
        <StatusCard health={health} />

        {/* Global Error Banner (if API fails) */}
        {error ? (
          <ErrorState message={error} onRetry={refetchData} />
        ) : (
          <>
            {/* 2. End-to-End Pipeline Architecture Flow */}
            <PipelineStatusFlow
              health={health}
              scraperStatus={scraperStatus}
              diagnostics={diagnostics}
              dataMode={dataMode}
            />

            {/* 3. Representative Route Basket & Traffic Weights */}
            <BasketStatusCard dataMode={dataMode} />

            {/* 4. Lead-Time Selector Tabs */}
            <LeadTimeSelector
              selectedBucket={selectedBucket}
              onSelectBucket={setSelectedBucket}
              latestIndices={latestIndices}
            />

            {/* 5. Primary Index Hero Card */}
            <IndexHero
              currentIndex={currentIndex}
              selectedBucket={selectedBucket}
              isLoading={isLoading}
            />

            {/* 6. Index Summary KPI Cards */}
            <IndexSummaryCards
              currentIndex={currentIndex}
              isLoading={isLoading}
            />

            {/* 7. Historical Index Chart */}
            <IndexHistoryChart
              historyData={historyData}
              selectedBucket={selectedBucket}
              isLoading={isHistoryLoading}
            />

            {/* 8. Lead-Time Windows Comparison */}
            <LeadTimeComparison
              latestIndices={latestIndices}
              selectedBucket={selectedBucket}
              onSelectBucket={setSelectedBucket}
            />

            {/* 9. Observed Fare by Advance-Purchase Window (Lead-Time Elasticity Curve) */}
            <LeadTimeElasticity dataMode={dataMode} />

            {/* 10. Sector-Wise Airfare Heatmap Matrix */}
            <SectorHeatmap
              dataMode={dataMode}
              selectedBucket={selectedBucket}
            />

            {/* 11. City-Pair Route Analytics Table */}
            <RouteAnalytics
              currentIndex={currentIndex}
              selectedBucket={selectedBucket}
            />

            {/* 12. Route Matrix Overview */}
            <RouteOverview
              currentIndex={currentIndex}
              selectedBucket={selectedBucket}
            />

            {/* 13. 30-Day Backtesting & DGCA Validation Engine */}
            <BacktestingPanel dataMode={dataMode} />

            {/* 14. National Statistical Data Export Center */}
            <ExportToolbar
              dataMode={dataMode}
              selectedBucket={selectedBucket}
            />

            {/* 15. Data Quality & Validation Panel */}
            <DataQualityPanel
              currentIndex={currentIndex}
              aggregations={aggregations}
              scraperStatus={scraperStatus}
            />

            {/* 16. Data Sources Panel */}
            <DataSourcesPanel
              aggregations={aggregations}
            />

            {/* 17. Methodology & Governance */}
            <MethodologyPanel />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <span>
            SIH26056: Real-time Airfare Price Index for India | MoSPI CPI Augmentation Prototype
          </span>
          <span className="mx-2 text-slate-300">•</span>
          <span className="font-mono text-slate-400">Laspeyres Fixed-Weight Model v1.0</span>
        </div>
      </footer>
    </div>
  );
};
