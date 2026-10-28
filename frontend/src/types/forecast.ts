/**
 * TypeScript interfaces matching backend FastAPI Pydantic response schemas
 */

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  version: string;
  timestamp: string;
  elexon_connectivity: Record<string, string>;
}

export interface MatchedPeriodRecord {
  start_time: string;
  end_time: string | null;
  settlement_date: string | null;
  settlement_period: number | null;
  forecast_mw: number | null;
  forecast_publish_time: string | null;
  forecast_candidates_count: number;
  actual_mw: number | null;
  actual_publish_time: string | null;
  signed_error_mw: number | null;
  absolute_error_mw: number | null;
  percentage_error: number | null;
  decision_cutoff_used: string | null;
  has_missing_data: boolean;
}

export interface DateRangeSummary {
  start_date: string;
  end_date: string;
  decision_cutoff_mode: string;
  decision_cutoff_value: string | null;
}

export interface ForecastListResponse {
  records: MatchedPeriodRecord[];
  total_records: number;
  matched_records: number;
  missing_forecast_count: number;
  missing_actual_count: number;
  date_range: DateRangeSummary;
}

export interface ForecastCandidate {
  publish_time: string;
  generation_mw: number;
  is_eligible: boolean;
  lead_time_hours: number | null;
}

export interface ForecastDetailResponse {
  start_time: string;
  end_time: string | null;
  settlement_date: string | null;
  settlement_period: number | null;
  selected_forecast_mw: number | null;
  selected_forecast_publish_time: string | null;
  decision_cutoff_used: string | null;
  actual_mw: number | null;
  actual_publish_time: string | null;
  signed_error_mw: number | null;
  absolute_error_mw: number | null;
  percentage_error: number | null;
  all_forecast_revisions: ForecastCandidate[];
  notes: string | null;
}

export interface AnalyticsMetrics {
  total_delivery_periods: number;
  matched_periods_count: number;
  missing_actual_count: number;
  missing_forecast_count: number;
  excluded_zero_actual_count: number;
  mae: number | null;
  rmse: number | null;
  mbe: number | null;
  mape: number | null;
  min_signed_error_mw: number | null;
  max_signed_error_mw: number | null;
  total_actual_generation_mwh: number | null;
  total_forecast_generation_mwh: number | null;
  error_std_dev: number | null;
  percentiles: {
    p10?: number;
    p25?: number;
    p50?: number;
    p75?: number;
    p90?: number;
  } | null;
}

export interface DailyAnalyticsBreakdown {
  date: string;
  total_periods: number;
  matched_periods: number;
  mae: number | null;
  rmse: number | null;
  mbe: number | null;
  mape: number | null;
  excluded_zero_actual_count: number;
  total_actual_mwh: number | null;
  total_forecast_mwh: number | null;
}

export interface DiurnalBreakdown {
  settlement_period: number;
  matched_count: number;
  mae: number | null;
  rmse: number | null;
  mbe: number | null;
}

export interface AnalyticsResponse {
  summary: AnalyticsMetrics;
  daily_breakdown: DailyAnalyticsBreakdown[];
  diurnal_breakdown: DiurnalBreakdown[];
  parameters_used: Record<string, string>;
}

export interface QueryFilters {
  startDate: string;
  endDate: string;
  dayAheadCutoffHour: number;
  decisionCutoff?: string;
  leadTimeHours?: number;
}
