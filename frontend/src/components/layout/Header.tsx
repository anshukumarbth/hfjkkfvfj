import React from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Activity, Calendar, ShieldCheck, AlertTriangle } from 'lucide-react';
import { HealthResponse, QueryFilters } from '@/types/forecast';
import { formatTimeOnly } from '@/utils/formatters';

interface HeaderProps {
  health: HealthResponse | null;
  lastUpdated: Date | null;
  isRefreshing: boolean;
  isDemoMode: boolean;
  filters: QueryFilters;
  onRefresh: () => void;
  onFilterChange: (filters: Partial<QueryFilters>) => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  lastUpdated,
  isRefreshing,
  isDemoMode,
  filters,
  onRefresh,
  onFilterChange,
}) => {
  const isHealthy = health?.status === 'healthy';
  const isDegraded = health?.status === 'degraded';

  return (
    <header className="glass-panel p-5 mb-6 bg-white border border-slate-200 shadow-sm">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        {/* Title and Scope */}
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              UK Wind Generation Forecast Analysis
            </h1>
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Calendar className="w-3 h-3 text-blue-600" />
              <span>January 2026</span>
            </span>

            {isDemoMode && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>Simulated Demo Mode</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Day-Ahead wholesale market electricity procurement & uncertainty metrics from Elexon BMRS
          </p>
        </div>

        {/* Status Indicators & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Elexon Stream API Status Indicator */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500">Elexon Stream:</span>
            {isHealthy ? (
              <span className="flex items-center space-x-1 text-emerald-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Connected</span>
              </span>
            ) : isDegraded ? (
              <span className="flex items-center space-x-1 text-amber-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Degraded</span>
              </span>
            ) : isDemoMode ? (
              <span className="text-blue-600 font-semibold">Demo Mode</span>
            ) : (
              <span className="flex items-center space-x-1 text-rose-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Offline</span>
              </span>
            )}
          </div>

          {/* Last updated timestamp */}
          {lastUpdated && (
            <div className="text-xs text-slate-500 font-mono hidden md:block">
              Updated: {formatTimeOnly(lastUpdated.toISOString())} UTC
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium transition-all ${
              isRefreshing ? 'opacity-70 cursor-not-allowed' : 'hover:border-slate-300'
            }`}
            title="Refresh latest forecasts & actuals"
          >
            <motion.div
              animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
            </motion.div>
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Filter Quick-Bar */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500 font-medium">Delivery Range:</span>
          {[
            { label: 'Jan 1–2', start: '2026-01-01', end: '2026-01-02' },
            { label: 'Jan 1–7 (Week 1)', start: '2026-01-01', end: '2026-01-07' },
            { label: 'Jan 1–14 (Fortnight)', start: '2026-01-01', end: '2026-01-14' },
            { label: 'Full Month (Jan 1–31)', start: '2026-01-01', end: '2026-01-31' },
          ].map((preset) => {
            const isSelected = filters.startDate === preset.start && filters.endDate === preset.end;
            return (
              <button
                key={preset.label}
                onClick={() => onFilterChange({ startDate: preset.start, endDate: preset.end })}
                className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-200/80'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Day-Ahead Gate Closure Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-slate-500 font-medium flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Decision Cutoff:</span>
          </span>
          <select
            value={filters.dayAheadCutoffHour}
            onChange={(e) => onFilterChange({ dayAheadCutoffHour: Number(e.target.value) })}
            className="bg-slate-50 text-slate-800 border border-slate-300 rounded-md px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value={11}>11:00 UTC D-1 (EPEX Gate Closure)</option>
            <option value={12}>12:00 UTC D-1 (Day-Ahead Standard)</option>
            <option value={17}>17:00 UTC D-1 (Evening Update)</option>
            <option value={23}>23:00 UTC D-1 (Late Night Gate)</option>
          </select>
        </div>
      </div>
    </header>
  );
};
