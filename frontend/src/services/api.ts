import axios, { AxiosError } from 'axios';
import {
  AnalyticsResponse,
  ForecastDetailResponse,
  ForecastListResponse,
  HealthResponse,
  QueryFilters,
} from '@/types/forecast';

const CUSTOM_URL_KEY = 'GRIDBRICKS_API_URL';

/**
 * Resolves the backend API base URL with graceful fallback for Vercel and production deployments.
 * Priority:
 * 1. User-configured override in localStorage (GRIDBRICKS_API_URL)
 * 2. Vite environment variable (VITE_API_BASE_URL)
 * 3. Localhost default (http://127.0.0.1:8000) when running on local machine
 * 4. Window origin fallback when deployed on cloud hosts like Vercel
 */
export function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const customUrl = localStorage.getItem(CUSTOM_URL_KEY);
      if (customUrl && customUrl.trim() !== '') {
        return customUrl.trim().replace(/\/+$/, '');
      }
    } catch {
      // localStorage may not be accessible in restricted environments
    }
  }

  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // On local machine, connect to local FastAPI server
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      return 'http://127.0.0.1:8000';
    }
    // On Vercel or cloud deployment, default to origin (for reverse proxies or same-domain routing)
    return window.location.origin.replace(/\/+$/, '');
  }

  return 'http://127.0.0.1:8000';
}

export function getStoredCustomApiUrl(): string | null {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem(CUSTOM_URL_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

export function setCustomApiBaseUrl(url: string): void {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    try {
      if (cleanUrl) {
        localStorage.setItem(CUSTOM_URL_KEY, cleanUrl);
      } else {
        localStorage.removeItem(CUSTOM_URL_KEY);
      }
    } catch (e) {
      console.warn('Failed to save custom API URL:', e);
    }
  }
  apiClient.defaults.baseURL = cleanUrl || resolveApiBaseUrl();
}

export function resetCustomApiBaseUrl(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(CUSTOM_URL_KEY);
    } catch (e) {
      console.warn('Failed to clear custom API URL:', e);
    }
  }
  apiClient.defaults.baseURL = resolveApiBaseUrl();
}

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 25000, // 25s timeout
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export class ApiError extends Error {
  statusCode?: number;
  isConnectionError: boolean;

  constructor(message: string, statusCode?: number, isConnectionError = false) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isConnectionError = isConnectionError;
  }
}

function handleAxiosError(error: unknown, context: string): never {
  const currentBase = apiClient.defaults.baseURL || resolveApiBaseUrl();
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{ detail?: string; error?: string }>;
    if (axiosErr.response) {
      const detail = axiosErr.response.data?.detail || axiosErr.response.data?.error || axiosErr.message;
      throw new ApiError(`${context}: ${detail}`, axiosErr.response.status);
    } else if (axiosErr.request) {
      throw new ApiError(
        `Unable to reach backend at ${currentBase}. Ensure the FastAPI server is running and accessible.`,
        undefined,
        true
      );
    }
  }
  throw new ApiError(`${context}: ${error instanceof Error ? error.message : String(error)}`);
}

/**
 * Health check endpoint
 */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  try {
    const res = await apiClient.get<HealthResponse>('/api/health', { signal });
    return res.data;
  } catch (error) {
    return handleAxiosError(error, 'Health check failed');
  }
}

/**
 * Fetch matched forecast and actual wind records
 */
export async function fetchForecasts(
  filters: QueryFilters,
  signal?: AbortSignal
): Promise<ForecastListResponse> {
  try {
    const params: Record<string, string | number> = {
      start_date: filters.startDate,
      end_date: filters.endDate,
      day_ahead_cutoff_hour: filters.dayAheadCutoffHour,
    };
    if (filters.decisionCutoff) {
      params.decision_cutoff = filters.decisionCutoff;
    }
    if (filters.leadTimeHours !== undefined) {
      params.lead_time_hours = filters.leadTimeHours;
    }

    const res = await apiClient.get<ForecastListResponse>('/api/forecasts', {
      params,
      signal,
    });
    return res.data;
  } catch (error) {
    return handleAxiosError(error, 'Failed to fetch forecasts');
  }
}

/**
 * Fetch aggregated accuracy and error metrics
 */
export async function fetchAnalytics(
  filters: QueryFilters,
  signal?: AbortSignal
): Promise<AnalyticsResponse> {
  try {
    const params: Record<string, string | number> = {
      start_date: filters.startDate,
      end_date: filters.endDate,
      day_ahead_cutoff_hour: filters.dayAheadCutoffHour,
    };
    if (filters.decisionCutoff) {
      params.decision_cutoff = filters.decisionCutoff;
    }
    if (filters.leadTimeHours !== undefined) {
      params.lead_time_hours = filters.leadTimeHours;
    }

    const res = await apiClient.get<AnalyticsResponse>('/api/analytics', {
      params,
      signal,
    });
    return res.data;
  } catch (error) {
    return handleAxiosError(error, 'Failed to fetch analytics');
  }
}

/**
 * Fetch detailed forecast revision trajectory for a single settlement period
 */
export async function fetchForecastDetail(
  startTimeIso: string,
  dayAheadCutoffHour = 12,
  signal?: AbortSignal
): Promise<ForecastDetailResponse> {
  try {
    const encoded = encodeURIComponent(startTimeIso);
    const res = await apiClient.get<ForecastDetailResponse>(`/api/forecasts/${encoded}`, {
      params: { day_ahead_cutoff_hour: dayAheadCutoffHour },
      signal,
    });
    return res.data;
  } catch (error) {
    return handleAxiosError(error, `Failed to fetch forecast detail for ${startTimeIso}`);
  }
}

/**
 * Explicit demo dataset used ONLY when backend connection is unavailable,
 * clearly labeled as demo data.
 */
export function getDemoForecastData(): {
  forecasts: ForecastListResponse;
  analytics: AnalyticsResponse;
} {
  const records = [];
  const baseDate = new Date('2026-01-01T00:00:00Z');
  
  for (let i = 0; i < 48; i++) {
    const st = new Date(baseDate.getTime() + i * 30 * 60 * 1000).toISOString();
    const et = new Date(baseDate.getTime() + (i + 1) * 30 * 60 * 1000).toISOString();
    const act = Math.round(11000 + Math.sin(i / 6) * 4500 + Math.random() * 800);
    const err = Math.round((Math.sin(i / 5) * 1200) + (Math.random() * 600 - 300));
    const fc = act + err;
    const absErr = Math.abs(err);
    const pctErr = act > 0 ? Number(((absErr / act) * 100).toFixed(2)) : null;

    records.push({
      start_time: st,
      end_time: et,
      settlement_date: '2026-01-01',
      settlement_period: i + 1,
      forecast_mw: fc,
      forecast_publish_time: new Date('2025-12-31T11:30:00Z').toISOString(),
      forecast_candidates_count: 16,
      actual_mw: act,
      actual_publish_time: new Date(baseDate.getTime() + (i + 1) * 30 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
      signed_error_mw: err,
      absolute_error_mw: absErr,
      percentage_error: pctErr,
      decision_cutoff_used: '2025-12-31T12:00:00Z',
      has_missing_data: false,
    });
  }

  return {
    forecasts: {
      records,
      total_records: 48,
      matched_records: 48,
      missing_forecast_count: 0,
      missing_actual_count: 0,
      date_range: {
        start_date: '2026-01-01',
        end_date: '2026-01-01',
        decision_cutoff_mode: 'day_ahead_hour',
        decision_cutoff_value: '12:00 UTC D-1',
      },
    },
    analytics: {
      summary: {
        total_delivery_periods: 48,
        matched_periods_count: 48,
        missing_actual_count: 0,
        missing_forecast_count: 0,
        excluded_zero_actual_count: 0,
        mae: 845.2,
        rmse: 1042.8,
        mbe: 120.4,
        mape: 7.85,
        min_signed_error_mw: -1450.0,
        max_signed_error_mw: 1620.0,
        total_actual_generation_mwh: 275400.0,
        total_forecast_generation_mwh: 278290.0,
        error_std_dev: 520.1,
        percentiles: {
          p10: -920.0,
          p25: -340.0,
          p50: 110.0,
          p75: 640.0,
          p90: 1150.0,
        },
      },
      daily_breakdown: [
        {
          date: '2026-01-01',
          total_periods: 48,
          matched_periods: 48,
          mae: 845.2,
          rmse: 1042.8,
          mbe: 120.4,
          mape: 7.85,
          excluded_zero_actual_count: 0,
          total_actual_mwh: 275400.0,
          total_forecast_mwh: 278290.0,
        },
      ],
      diurnal_breakdown: [],
      parameters_used: {
        start_date: '2026-01-01',
        end_date: '2026-01-01',
        mode: 'DEMO',
      },
    },
  };
}
