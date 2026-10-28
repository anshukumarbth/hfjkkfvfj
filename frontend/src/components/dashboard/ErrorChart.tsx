import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import { BarChart3, ArrowUpRight, ArrowDownRight, Info, AlertTriangle, ShieldCheck } from 'lucide-react';
import { AnalyticsMetrics, MatchedPeriodRecord } from '@/types/forecast';
import { formatMWRaw, formatShortDate, formatTimeOnly } from '@/utils/formatters';

interface ErrorChartProps {
  records: MatchedPeriodRecord[];
  summary: AnalyticsMetrics | null;
}

interface CustomErrorTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      timestamp: string;
      error: number;
      actual: number | null;
      forecast: number | null;
      sp: number | null;
    };
  }>;
}

const CustomErrorTooltip: React.FC<CustomErrorTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    const isOver = item.error > 0;
    const isUnder = item.error < 0;

    return (
      <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xl text-xs min-w-[210px]">
        <div className="font-semibold text-slate-800 mb-1.5 pb-1 border-b border-slate-100">
          {item.timestamp} (SP {item.sp || '—'})
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Signed Error:</span>
            <span
              className={`font-mono font-bold ${
                isOver ? 'text-sky-700' : isUnder ? 'text-amber-700' : 'text-slate-600'
              }`}
            >
              {item.error > 0 ? `+${formatMWRaw(item.error)}` : formatMWRaw(item.error)} MW
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-500">
            <span>Absolute Error:</span>
            <span className="font-mono text-slate-800 font-semibold">
              {formatMWRaw(Math.abs(item.error))} MW
            </span>
          </div>

          <div className="pt-1.5 mt-1 border-t border-slate-100 text-[11px]">
            {isOver ? (
              <span className="text-sky-700 font-medium flex items-center space-x-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Over-forecast (Surplus volume)</span>
              </span>
            ) : isUnder ? (
              <span className="text-amber-700 font-medium flex items-center space-x-1">
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>Under-forecast (Shortfall risk)</span>
              </span>
            ) : (
              <span className="text-emerald-700 font-medium">Exact Match (0 MW)</span>
            )}
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const ErrorChart: React.FC<ErrorChartProps> = ({ records, summary }) => {
  const chartData = useMemo(() => {
    return records
      .filter((r) => r.signed_error_mw !== null)
      .map((r) => {
        const dt = r.start_time;
        return {
          timestamp: `${formatShortDate(dt)} ${formatTimeOnly(dt)}`,
          error: r.signed_error_mw as number,
          actual: r.actual_mw,
          forecast: r.forecast_mw,
          sp: r.settlement_period,
        };
      });
  }, [records]);

  const overforecastCount = chartData.filter((d) => d.error > 0).length;
  const underforecastCount = chartData.filter((d) => d.error < 0).length;
  const exactCount = chartData.filter((d) => d.error === 0).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="glass-panel p-6 bg-white border border-slate-200 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Forecast Error Trajectory (Signed Error = Forecast − Actual)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Half-hourly procurement deviations. Blue bars indicate over-forecasts; Amber bars indicate under-forecasts.
          </p>
        </div>

        {/* Over/Under count pills */}
        <div className="flex items-center space-x-3 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-sky-50 border border-sky-200 text-sky-700 font-semibold">
            Over: {overforecastCount}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 font-semibold">
            Under: {underforecastCount}
          </span>
          {exactCount > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
              Exact: {exactCount}
            </span>
          )}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
          No matched error data available.
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 15, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1.5} />
              
              <XAxis
                dataKey="timestamp"
                stroke="#94a3b8"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickMargin={8}
                interval="preserveStartEnd"
                minTickGap={45}
              />
              
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                unit=" MW"
                width={60}
              />

              <Tooltip content={<CustomErrorTooltip />} />

              <Bar dataKey="error" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.error >= 0 ? '#0284c7' : '#d97706'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Explanatory Cards Grid */}
      <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Signed Error Explanation */}
        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start space-x-2.5">
          <Info className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-slate-800 mb-1">Signed Error ($Forecast - Actual$)</h4>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Preserves direction. When positive, the utility bought excess wind power day-ahead. When negative, the utility had a procurement deficit.
            </p>
          </div>
        </div>

        {/* Absolute Error & MAE */}
        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-slate-800 mb-1">Absolute Error ($|Forecast - Actual|$)</h4>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Measures error magnitude regardless of direction. Average of absolute errors is MAE ({summary?.mae ? `${summary.mae} MW` : '—'}), indicating total volume exposure.
            </p>
          </div>
        </div>

        {/* Percentiles & Standard Deviation */}
        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start space-x-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-slate-800 mb-1">Uncertainty Distribution</h4>
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-700 mt-1 font-mono">
              <span>P10: {summary?.percentiles?.p10 ?? '—'} MW</span>
              <span>P50: {summary?.percentiles?.p50 ?? '—'} MW</span>
              <span>P90: {summary?.percentiles?.p90 ?? '—'} MW</span>
              <span>Std Dev: {summary?.error_std_dev ?? '—'} MW</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
