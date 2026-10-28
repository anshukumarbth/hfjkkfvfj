import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AnalyticsResponse,
  ForecastListResponse,
  HealthResponse,
  QueryFilters,
} from '@/types/forecast';
import {
  fetchAnalytics,
  fetchForecasts,
  fetchHealth,
  getDemoForecastData,
  ApiError,
} from '@/services/api';

export function useForecastData() {
  const [filters, setFilters] = useState<QueryFilters>({
    startDate: '2026-01-01',
    endDate: '2026-01-02',
    dayAheadCutoffHour: 12,
  });

  const [forecastData, setForecastData] = useState<ForecastListResponse | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnectionError, setIsConnectionError] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const loadData = useCallback(async (currentFilters: QueryFilters, isBackground = false) => {
    // Cancel in-flight requests to prevent stale responses
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!isBackground) {
      setIsInitialLoading(true);
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
      
      // Start elapsed timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } else {
      setIsRefreshing(true);
    }

    setError(null);
    setIsConnectionError(false);

    try {
      // Parallel fetch of health, forecasts, and analytics
      const [healthRes, forecastsRes, analyticsRes] = await Promise.all([
        fetchHealth(controller.signal).catch(() => null),
        fetchForecasts(currentFilters, controller.signal),
        fetchAnalytics(currentFilters, controller.signal),
      ]);

      if (controller.signal.aborted) return;

      setHealth(healthRes);
      setForecastData(forecastsRes);
      setAnalyticsData(analyticsRes);
      setLastUpdated(new Date());
      setIsDemoMode(false);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;

      const isConnErr = err instanceof ApiError && err.isConnectionError;
      setIsConnectionError(isConnErr);
      const errMsg = err instanceof Error ? err.message : 'An unexpected error occurred while communicating with backend';
      setError(errMsg);
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData(filters, false);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [filters, loadData]);

  const updateFilters = useCallback((newFilters: Partial<QueryFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const refresh = useCallback(() => {
    loadData(filters, true);
  }, [filters, loadData]);

  const enableDemoMode = useCallback(() => {
    const demo = getDemoForecastData();
    setForecastData(demo.forecasts);
    setAnalyticsData(demo.analytics);
    setHealth({
      status: 'degraded',
      service: 'UK Wind Forecast Analysis (DEMO)',
      version: '1.0.0-demo',
      timestamp: new Date().toISOString(),
      elexon_connectivity: { FUELHH: 'demo-simulated', WINDFOR: 'demo-simulated' },
    });
    setIsDemoMode(true);
    setError(null);
    setIsConnectionError(false);
    setIsInitialLoading(false);
    setLastUpdated(new Date());
  }, []);

  return {
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
  };
}
