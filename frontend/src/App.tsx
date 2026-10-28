import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Wind,
  Target,
  Compass,
  Percent,
  Sliders,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useForecastData } from '@/hooks/useForecastData';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ForecastChart } from '@/components/dashboard/ForecastChart';
import { ErrorChart } from '@/components/dashboard/ErrorChart';
import { ForecastTable } from '@/components/dashboard/ForecastTable';
import { DataStatus } from '@/components/dashboard/DataStatus';
import { ForecastDetailModal } from '@/components/dashboard/ForecastDetailModal';
import { PageLoader } from '@/components/ui/PageLoader';
import { SectionSkeleton } from '@/components/ui/SectionSkeleton';
import { formatMW, formatPercent } from '@/utils/formatters';

export function App() {
  const {
    filters,
    updateFilters,
    forecastData,
    analyticsData,
    health,
    isInitialLoading,
    isRefreshing,
    error,
    isConnectionError,
    isDemoMode,
    lastUpdated,
    elapsedSeconds,
    refresh,
    enableDemoMode,
  } = useForecastData();

  const [activeSection, setActiveSection] = useState('dashboard');
  const [selectedPeriodStartTime, setSelectedPeriodStartTime] = useState<string | null>(null);

  const handleNavigate = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const summary = analyticsData?.summary ?? null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col antialiased font-sans">
      {/* Full Page Initial Loader */}
      <AnimatePresence>
        {isInitialLoading && (
          <PageLoader
            elapsedSeconds={elapsedSeconds}
            error={error}
            isConnectionError={isConnectionError}
            onRetry={refresh}
            onEnableDemo={enableDemoMode}
          />
        )}
      </AnimatePresence>

      {/* Main Layout Container */}
      <div className="flex flex-1">
        {/* Navigation Sidebar */}
        <Sidebar activeSection={activeSection} onNavigate={handleNavigate} />

        {/* Main Dashboard Canvas */}
        <main className="flex-1 lg:pl-64 transition-all duration-300 flex flex-col min-h-screen">
          <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 space-y-8">
            {/* Top Header */}
            <Header
              health={health}
              lastUpdated={lastUpdated}
              isRefreshing={isRefreshing}
              isDemoMode={isDemoMode}
              filters={filters}
              onRefresh={refresh}
              onFilterChange={updateFilters}
            />

            {/* Error Banner */}
            {error && !isInitialLoading && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
                <span>{error}</span>
                <button
                  onClick={refresh}
                  className="px-3 py-1 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* SECTION 1: KPI Summary Cards */}
            <section id="dashboard" className="scroll-mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-500">
                  Core Accuracy & Imbalance KPI Metrics
                </h2>
                <span className="text-xs text-slate-500 font-mono">
                  {summary ? `${summary.matched_periods_count} matched half-hours` : '—'}
                </span>
              </div>

              {isRefreshing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SectionSkeleton key={i} height="h-28" rows={2} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* MAE Card */}
                  <MetricCard
                    title="Mean Absolute Error (MAE)"
                    value={summary?.mae !== null && summary?.mae !== undefined ? formatMW(summary.mae) : '—'}
                    subValue="Average half-hour volume error"
                    icon={Wind}
                    accentColor="cyan"
                    tooltipText="MAE = sum(|Forecast - Actual|) / n. Measures the average magnitude of MW forecasting errors, indicating wholesale power imbalance volume."
                    delayIndex={0}
                  />

                  {/* RMSE Card */}
                  <MetricCard
                    title="Root Mean Square Error"
                    value={summary?.rmse !== null && summary?.rmse !== undefined ? formatMW(summary.rmse) : '—'}
                    subValue="Penalizes large outlier errors"
                    icon={Target}
                    accentColor="electric"
                    tooltipText="RMSE = sqrt(sum((Forecast - Actual)^2) / n). Heavily penalizes large forecasting misses, critical for assessing risk of extreme cash-out price spikes."
                    delayIndex={1}
                  />

                  {/* MBE Card */}
                  <MetricCard
                    title="Mean Bias Error (MBE)"
                    value={
                      summary?.mbe !== null && summary?.mbe !== undefined
                        ? `${summary.mbe > 0 ? '+' : ''}${formatMW(summary.mbe)}`
                        : '—'
                    }
                    subValue={
                      (summary?.mbe || 0) > 0
                        ? 'Systemic Over-forecast bias'
                        : (summary?.mbe || 0) < 0
                        ? 'Systemic Under-forecast bias'
                        : 'Neutral bias'
                    }
                    icon={Compass}
                    accentColor={(summary?.mbe || 0) >= 0 ? 'emerald' : 'amber'}
                    tooltipText="MBE = sum(Forecast - Actual) / n. Identifies whether forecasts consistently over-estimate (> 0) or under-estimate (< 0) actual wind generation."
                    delayIndex={2}
                  />

                  {/* MAPE Card */}
                  <MetricCard
                    title="Mean Absolute Percentage Error"
                    value={summary?.mape !== null && summary?.mape !== undefined ? formatPercent(summary.mape) : '—'}
                    subValue={`${summary?.excluded_zero_actual_count ?? 0} zero actuals excluded`}
                    icon={Percent}
                    accentColor="emerald"
                    tooltipText="MAPE = 100 * mean(|Forecast - Actual| / Actual). Percentage deviation relative to actual output. Calm/zero periods are strictly excluded to avoid division-by-zero."
                    delayIndex={3}
                  />
                </div>
              )}
            </section>

            {/* SECTION 2: Main Forecast Recharts Line Chart */}
            <section id="forecast-chart" className="scroll-mt-6">
              {isRefreshing ? (
                <SectionSkeleton height="h-96" rows={6} />
              ) : (
                <ForecastChart records={forecastData?.records ?? []} />
              )}
            </section>

            {/* SECTION 3: Accuracy Analysis & Signed Error Trajectory */}
            <section id="accuracy-metrics" className="scroll-mt-6">
              {isRefreshing ? (
                <SectionSkeleton height="h-72" rows={4} />
              ) : (
                <ErrorChart
                  records={forecastData?.records ?? []}
                  summary={summary}
                />
              )}
            </section>

            {/* SECTION 4: Detailed Settlement Period Table */}
            <section id="data-explorer" className="scroll-mt-6">
              <ForecastTable
                records={forecastData?.records ?? []}
                onSelectPeriod={(st) => setSelectedPeriodStartTime(st)}
              />
            </section>

            {/* SECTION 5: Data Quality & Energy Totals */}
            <section className="scroll-mt-6">
              <DataStatus
                health={health}
                forecastData={forecastData}
                summary={summary}
                isDemoMode={isDemoMode}
              />
            </section>

            {/* SECTION 6: Settings & Cutoff Configuration */}
            <section id="settings" className="scroll-mt-6 glass-panel p-6 bg-white border border-slate-200">
              <div className="flex items-center space-x-2 mb-4">
                <Sliders className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Trading Settings & Decision Parameters
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700">
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-600 mb-1 font-semibold">
                      Day-Ahead Gate Closure Cutoff Hour (UTC)
                    </label>
                    <select
                      value={filters.dayAheadCutoffHour}
                      onChange={(e) => updateFilters({ dayAheadCutoffHour: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-blue-700 font-mono text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value={11}>11:00 UTC D-1 (EPEX SPOT UK Day-Ahead Gate)</option>
                      <option value={12}>12:00 UTC D-1 (Nord Pool UK Day-Ahead Auction)</option>
                      <option value={17}>17:00 UTC D-1 (Evening Position Balancing)</option>
                      <option value={23}>23:00 UTC D-1 (Pre-midnight final day-ahead update)</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Forecasts published after this cutoff timestamp are strictly excluded from Day-Ahead purchasing decisions.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-600 mb-1 font-semibold">
                      FastAPI Backend Endpoint URL
                    </label>
                    <input
                      type="text"
                      disabled
                      value={import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}
                      className="w-full bg-slate-100 border border-slate-200 text-slate-500 font-mono text-xs rounded-lg p-2.5 cursor-not-allowed"
                    />
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] text-emerald-600">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Configured via environment variable <code>VITE_API_BASE_URL</code></span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Footer */}
          <footer className="border-t border-slate-200 bg-white py-6 px-4 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Wind className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-slate-700">Wind Intelligence Platform</span>
                <span>· UK Electricity Procurement Analytics</span>
              </div>
              <div className="flex items-center space-x-4">
                <a
                  href="https://data.elexon.co.uk/bmrs/api/v1/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-blue-600 transition-colors flex items-center space-x-1"
                >
                  <span>Elexon BMRS API</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span>January 2026 Scope</span>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Period Detail & Revision History Modal */}
      <ForecastDetailModal
        startTime={selectedPeriodStartTime}
        dayAheadCutoffHour={filters.dayAheadCutoffHour}
        onClose={() => setSelectedPeriodStartTime(null)}
      />
    </div>
  );
}
