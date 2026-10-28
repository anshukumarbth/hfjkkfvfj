import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp, Wind, Zap } from 'lucide-react';
import { MatchedPeriodRecord } from '@/types/forecast';
import { formatMWRaw, formatShortDate, formatTimeOnly } from '@/utils/formatters';

interface ForecastChartProps {
  records: MatchedPeriodRecord[];
  isLoading?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

const CustomChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const forecast = payload.find((p) => p.dataKey === 'forecast')?.value;
    const actual = payload.find((p) => p.dataKey === 'actual')?.value;
    const diff = forecast !== undefined && actual !== undefined ? forecast - actual : null;

    return (
      <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xl text-xs min-w-[190px]">
        <div className="font-semibold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">
          {label}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sky-700">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-600" />
              <span className="text-slate-600 font-medium">Forecast:</span>
            </span>
            <span className="font-mono font-bold text-sky-700">
              {forecast !== undefined ? `${formatMWRaw(forecast)} MW` : 'N/A'}
            </span>
          </div>

          <div className="flex items-center justify-between text-emerald-700">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span className="text-slate-600 font-medium">Actual Outturn:</span>
            </span>
            <span className="font-mono font-bold text-emerald-700">
              {actual !== undefined ? `${formatMWRaw(actual)} MW` : 'N/A'}
            </span>
          </div>

          {diff !== null && (
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-slate-600">
              <span>Signed Difference:</span>
              <span
                className={`font-mono font-bold ${
                  diff > 0 ? 'text-sky-700' : diff < 0 ? 'text-amber-600' : 'text-slate-500'
                }`}
              >
                {diff > 0 ? `+${formatMWRaw(diff)}` : formatMWRaw(diff)} MW
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export const ForecastChart: React.FC<ForecastChartProps> = ({ records }) => {
  const chartData = useMemo(() => {
    return records.map((r) => {
      const dt = r.start_time;
      return {
        timestamp: `${formatShortDate(dt)} ${formatTimeOnly(dt)}`,
        forecast: r.forecast_mw ?? undefined,
        actual: r.actual_mw ?? undefined,
        error: r.signed_error_mw ?? undefined,
        sp: r.settlement_period,
      };
    });
  }, [records]);

  const hasData = chartData.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-panel p-6 bg-white border border-slate-200 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Wind Generation: Forecast vs. Actual Outturn
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Half-hourly National Grid generation profile in Megawatts (MW) across GB transmission system
          </p>
        </div>

        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-1 bg-sky-600 rounded-full" />
            <span className="text-slate-700 font-medium">Eligible Forecast</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-1 bg-emerald-600 rounded-full" />
            <span className="text-slate-700 font-medium">Actual Outturn</span>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="h-80 flex flex-col items-center justify-center text-slate-400 text-sm">
          <Wind className="w-10 h-10 text-slate-300 mb-2 animate-pulse" />
          <p>No delivery periods available for the selected filters.</p>
        </div>
      ) : (
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 15, left: 10, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              
              <XAxis
                dataKey="timestamp"
                stroke="#94a3b8"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickMargin={10}
                interval="preserveStartEnd"
                minTickGap={45}
              />
              
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                unit=" MW"
                domain={['auto', 'auto']}
                width={65}
              />

              <Tooltip content={<CustomChartTooltip />} />

              <Legend
                verticalAlign="top"
                align="right"
                height={30}
                iconType="plainline"
                formatter={(val) => (
                  <span className="text-xs text-slate-600 font-medium capitalize">
                    {val === 'forecast' ? 'Wind Forecast (MW)' : 'Actual Generation (MW)'}
                  </span>
                )}
              />

              {/* Forecast Line */}
              <Line
                type="monotone"
                dataKey="forecast"
                name="forecast"
                stroke="#0284c7"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 2 }}
                connectNulls={false}
              />

              {/* Actual Line */}
              <Line
                type="monotone"
                dataKey="actual"
                name="actual"
                stroke="#059669"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Chart Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center space-x-1.5">
          <Zap className="w-3.5 h-3.5 text-blue-600" />
          <span>Cutoff rule: Latest forecast published at or before Day-Ahead gate closure.</span>
        </span>
        <span>Timezone: All delivery times are strictly in UTC.</span>
      </div>
    </motion.div>
  );
};
