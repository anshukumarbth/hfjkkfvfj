import React from 'react';
import { motion } from 'motion/react';
import { Database, ShieldCheck, CheckCircle2, AlertTriangle, Layers, Clock } from 'lucide-react';
import { AnalyticsMetrics, ForecastListResponse, HealthResponse } from '@/types/forecast';
import { formatMWh } from '@/utils/formatters';

interface DataStatusProps {
  health: HealthResponse | null;
  forecastData: ForecastListResponse | null;
  summary: AnalyticsMetrics | null;
  isDemoMode: boolean;
}

export const DataStatus: React.FC<DataStatusProps> = ({
  health,
  forecastData,
  summary,
  isDemoMode,
}) => {
  const isHealthy = health?.status === 'healthy';
  const total = summary?.total_delivery_periods ?? forecastData?.total_records ?? 0;
  const matched = summary?.matched_periods_count ?? forecastData?.matched_records ?? 0;
  const missingFc = summary?.missing_forecast_count ?? forecastData?.missing_forecast_count ?? 0;
  const missingAct = summary?.missing_actual_count ?? forecastData?.missing_actual_count ?? 0;
  const excludedZero = summary?.excluded_zero_actual_count ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55 }}
      className="glass-panel p-6 bg-white border border-slate-200 shadow-sm"
    >
      <div className="flex items-center space-x-2 mb-4">
        <Database className="w-5 h-5 text-emerald-600" />
        <h3 className="text-base font-bold text-slate-900 tracking-tight">
          Data Quality & Elexon Ingestion Health
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Stream API Status */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-semibold uppercase">Stream Status</span>
            {isHealthy ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : isDemoMode ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">DEMO</span>
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            )}
          </div>
          <div className="text-lg font-bold text-slate-900 mb-1">
            {isHealthy ? 'Elexon Live Stream' : isDemoMode ? 'Simulated Data' : 'Degraded / Retrying'}
          </div>
          <p className="text-[11px] text-slate-500">
            {health ? `v${health.version} · ${health.status}` : 'API status confirmed via backend response'}
          </p>
        </div>

        {/* Matched Delivery Periods */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-semibold uppercase">Matched Periods</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg font-bold text-blue-700 font-mono mb-1">
            {matched} / {total}
          </div>
          <p className="text-[11px] text-slate-500">
            {total > 0 ? `${((matched / total) * 100).toFixed(1)}% complete settlement intervals` : 'No intervals'}
          </p>
        </div>

        {/* Missing Records Handling */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-semibold uppercase">Missing / Nulls</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono mb-1">
            {missingFc + missingAct}
          </div>
          <p className="text-[11px] text-slate-500">
            {missingFc} missing forecast · {missingAct} missing actual (never fabricated)
          </p>
        </div>

        {/* Zero Actual Outturn (MAPE Safe) */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-semibold uppercase">Zero Outturn (MAPE)</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-emerald-700 font-mono mb-1">
            {excludedZero} excluded
          </div>
          <p className="text-[11px] text-slate-500">
            Calm/curtailed periods excluded from MAPE to prevent division-by-zero
          </p>
        </div>
      </div>

      {/* Energy Procurement Volume Totals */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <span className="font-semibold text-slate-800 flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Cumulative Energy Delivered in January 2026 Window:</span>
          </span>
          <p className="text-slate-500 text-[11px]">
            Calculated as the half-hourly generation outturn sum (MW &times; 0.5 hours).
          </p>
        </div>

        <div className="flex items-center space-x-6 font-mono text-sm">
          <div>
            <span className="text-[10px] uppercase text-slate-500 block">Total Actual</span>
            <span className="font-bold text-emerald-700">
              {formatMWh(summary?.total_actual_generation_mwh)}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase text-slate-500 block">Total Forecast</span>
            <span className="font-bold text-sky-700">
              {formatMWh(summary?.total_forecast_generation_mwh)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
