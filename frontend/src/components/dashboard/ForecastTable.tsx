import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileSpreadsheet,
} from 'lucide-react';
import { MatchedPeriodRecord } from '@/types/forecast';
import {
  formatMWRaw,
  formatUTCDateTime,
  formatPercent,
} from '@/utils/formatters';

interface ForecastTableProps {
  records: MatchedPeriodRecord[];
  onSelectPeriod: (startTime: string) => void;
}

type SortField = 'startTime' | 'forecast' | 'actual' | 'signedError' | 'absError' | 'mape';
type SortOrder = 'asc' | 'desc';

export const ForecastTable: React.FC<ForecastTableProps> = ({ records, onSelectPeriod }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'over' | 'under' | 'missing'>('all');
  const [sortField, setSortField] = useState<SortField>('startTime');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Filter and sort logic
  const filteredAndSortedRecords = useMemo(() => {
    let result = records.filter((r) => {
      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        r.start_time.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.settlement_date && r.settlement_date.includes(searchQuery)) ||
        (r.settlement_period && String(r.settlement_period).includes(searchQuery));

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === 'missing') {
        return r.has_missing_data;
      }
      if (statusFilter === 'over') {
        return (r.signed_error_mw || 0) > 0;
      }
      if (statusFilter === 'under') {
        return (r.signed_error_mw || 0) < 0;
      }
      return true;
    });

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'startTime':
          comparison = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
          break;
        case 'forecast':
          comparison = (a.forecast_mw ?? -1) - (b.forecast_mw ?? -1);
          break;
        case 'actual':
          comparison = (a.actual_mw ?? -1) - (b.actual_mw ?? -1);
          break;
        case 'signedError':
          comparison = (a.signed_error_mw ?? -999999) - (b.signed_error_mw ?? -999999);
          break;
        case 'absError':
          comparison = (a.absolute_error_mw ?? -1) - (b.absolute_error_mw ?? -1);
          break;
        case 'mape':
          comparison = (a.percentage_error ?? -1) - (b.percentage_error ?? -1);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [records, searchQuery, statusFilter, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRecords.slice(start, start + pageSize);
  }, [filteredAndSortedRecords, currentPage, pageSize]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-panel p-6 bg-white border border-slate-200 shadow-sm"
    >
      {/* Table Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Detailed Half-Hourly Settlement Records
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare individual 30-minute delivery periods. Click any row to view its complete forecast revision history.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search time, date, SP..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-48 sm:w-56 transition-colors"
            />
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="bg-transparent text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Records</option>
              <option value="over">Over-forecast Only</option>
              <option value="under">Under-forecast Only</option>
              <option value="missing">Missing Data Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
              <th
                onClick={() => toggleSort('startTime')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Delivery Time (UTC)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3">Period</th>
              <th className="py-3 px-3">Publish Time (UTC)</th>
              <th
                onClick={() => toggleSort('forecast')}
                className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Forecast (MW)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('actual')}
                className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Actual (MW)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('signedError')}
                className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Signed Error</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('absError')}
                className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Absolute Error</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('mape')}
                className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>MAPE %</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3 text-center">Revisions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-xs">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                  No settlement periods match the current search or filters.
                </td>
              </tr>
            ) : (
              paginatedRecords.map((r, idx) => {
                const isOver = (r.signed_error_mw || 0) > 0;
                const isUnder = (r.signed_error_mw || 0) < 0;

                return (
                  <tr
                    key={idx}
                    onClick={() => onSelectPeriod(r.start_time)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {formatUTCDateTime(r.start_time)}
                    </td>

                    <td className="py-3 px-3 text-slate-500 font-sans whitespace-nowrap text-[11px]">
                      {r.settlement_period ? `SP ${r.settlement_period}` : '—'}
                    </td>

                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                      {r.forecast_publish_time ? formatUTCDateTime(r.forecast_publish_time) : '—'}
                    </td>

                    <td className="py-3 px-3 text-right text-sky-700 font-semibold">
                      {r.forecast_mw !== null ? `${formatMWRaw(r.forecast_mw)} MW` : (
                        <span className="text-slate-400 italic font-sans text-[11px]">Unavailable</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right text-emerald-700 font-semibold">
                      {r.actual_mw !== null ? `${formatMWRaw(r.actual_mw)} MW` : (
                        <span className="text-slate-400 italic font-sans text-[11px]">Unavailable</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-bold whitespace-nowrap">
                      {r.signed_error_mw !== null ? (
                        <span className={isOver ? 'text-sky-700' : isUnder ? 'text-amber-700' : 'text-slate-500'}>
                          {isOver ? `+${formatMWRaw(r.signed_error_mw)}` : formatMWRaw(r.signed_error_mw)} MW
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">N/A</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right text-slate-700">
                      {r.absolute_error_mw !== null ? `${formatMWRaw(r.absolute_error_mw)} MW` : 'N/A'}
                    </td>

                    <td className="py-3 px-3 text-right text-slate-700">
                      {formatPercent(r.percentage_error)}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] bg-slate-100 group-hover:bg-blue-50 text-slate-600 group-hover:text-blue-700 border border-slate-200 transition-colors">
                        <span>{r.forecast_candidates_count}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div>
          Showing {paginatedRecords.length} of {filteredAndSortedRecords.length} settlement periods
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
