import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, XCircle, Wind } from 'lucide-react';
import { ForecastDetailResponse } from '@/types/forecast';
import { fetchForecastDetail } from '@/services/api';
import { formatMWRaw, formatUTCDateTime, formatPercent } from '@/utils/formatters';

interface ForecastDetailModalProps {
  startTime: string | null;
  dayAheadCutoffHour: number;
  onClose: () => void;
}

export const ForecastDetailModal: React.FC<ForecastDetailModalProps> = ({
  startTime,
  dayAheadCutoffHour,
  onClose,
}) => {
  const [detail, setDetail] = useState<ForecastDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startTime) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchForecastDetail(startTime, dayAheadCutoffHour)
      .then((data) => {
        if (isMounted) setDetail(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to fetch period details');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [startTime, dayAheadCutoffHour]);

  if (!startTime) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25 }}
          className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                <Wind className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Forecast Evolution & Revision History
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Target Delivery: {formatUTCDateTime(startTime)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="overflow-y-auto py-4 space-y-5 flex-1 pr-1">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                <span className="text-xs">Loading forecast evolution from Elexon...</span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {error}
              </div>
            ) : detail ? (
              <>
                {/* Summary Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                      Selected Forecast
                    </span>
                    <span className="text-lg font-bold font-mono text-sky-700">
                      {detail.selected_forecast_mw !== null ? `${formatMWRaw(detail.selected_forecast_mw)} MW` : 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                      Actual Outturn
                    </span>
                    <span className="text-lg font-bold font-mono text-emerald-700">
                      {detail.actual_mw !== null ? `${formatMWRaw(detail.actual_mw)} MW` : 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                      Signed Error
                    </span>
                    <span
                      className={`text-lg font-bold font-mono ${
                        (detail.signed_error_mw || 0) > 0
                          ? 'text-sky-700'
                          : (detail.signed_error_mw || 0) < 0
                          ? 'text-amber-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {detail.signed_error_mw !== null
                        ? `${detail.signed_error_mw > 0 ? '+' : ''}${formatMWRaw(detail.signed_error_mw)} MW`
                        : 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                      MAPE
                    </span>
                    <span className="text-lg font-bold font-mono text-slate-800">
                      {formatPercent(detail.percentage_error)}
                    </span>
                  </div>
                </div>

                {/* Revision Timeline Table */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-2.5 flex items-center justify-between">
                    <span>Forecast Revisions Published Leading Up to Delivery</span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {detail.all_forecast_revisions.length} revisions published
                    </span>
                  </h4>

                  <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3">Publication Time (UTC)</th>
                          <th className="py-2.5 px-3">Lead Time</th>
                          <th className="py-2.5 px-3 text-right">Forecast (MW)</th>
                          <th className="py-2.5 px-3 text-center">Cutoff Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {detail.all_forecast_revisions.map((rev, idx) => {
                          const isSelected =
                            detail.selected_forecast_publish_time &&
                            new Date(detail.selected_forecast_publish_time).getTime() ===
                              new Date(rev.publish_time).getTime();

                          return (
                            <tr
                              key={idx}
                              className={`transition-colors ${
                                isSelected
                                  ? 'bg-sky-50 text-sky-900 font-semibold'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <td className="py-2 px-3">
                                {formatUTCDateTime(rev.publish_time)}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {rev.lead_time_hours !== null ? `${rev.lead_time_hours}h prior` : '—'}
                              </td>
                              <td className="py-2 px-3 text-right font-medium">
                                {formatMWRaw(rev.generation_mw)} MW
                              </td>
                              <td className="py-2 px-3 text-center">
                                {isSelected ? (
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] bg-sky-100 text-sky-800 border border-sky-300">
                                    <CheckCircle2 className="w-3 h-3 text-sky-600" />
                                    <span>Selected</span>
                                  </span>
                                ) : rev.is_eligible ? (
                                  <span className="text-[10px] text-slate-500">
                                    Eligible (Superseded)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500">
                                    <XCircle className="w-3 h-3 text-slate-400" />
                                    <span>Post-Cutoff</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer notes */}
                {detail.notes && (
                  <p className="text-[11px] text-slate-500 italic">
                    {detail.notes}
                  </p>
                )}
              </>
            ) : null}
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
