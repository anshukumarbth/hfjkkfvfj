"""Analytics Service: Calculates MAE, RMSE, MBE, MAPE, distributions, and trading uncertainty metrics."""

import math
from typing import Dict, List, Optional
from collections import defaultdict
import numpy as np
from app.schemas.forecast import (
    AnalyticsMetrics,
    AnalyticsResponse,
    DailyAnalyticsBreakdown,
    DiurnalBreakdown,
    MatchedPeriodRecord,
)

try:
    import pandas as pd
except Exception:  # Handle environments where pandas C-extension is restricted by OS policy
    pd = None


class AnalyticsService:
    """Computes statistical accuracy and error metrics across matched wind generation periods."""

    @staticmethod
    def calculate_metrics(
        records: List[MatchedPeriodRecord],
        parameters_used: Optional[Dict[str, str]] = None,
    ) -> AnalyticsResponse:
        """Calculate comprehensive accuracy metrics adhering strictly to procurement analysis rules.
        
        Strict rules applied:
        - Never treat missing values as zero.
        - MAE = sum(|Forecast - Actual|) / n
        - RMSE = sqrt(sum((Forecast - Actual)^2) / n)
        - MBE = sum(Forecast - Actual) / n
        - MAPE = 100 * mean(|Forecast - Actual| / Actual), strictly excluding zero/invalid actuals.
        - Returns excluded_zero_actual_count.
        - Handles empty datasets cleanly with null metrics and zero counts.
        """
        params = parameters_used or {}
        total_periods = len(records)

        if not records:
            empty_summary = AnalyticsMetrics(
                total_delivery_periods=0,
                matched_periods_count=0,
                missing_actual_count=0,
                missing_forecast_count=0,
                excluded_zero_actual_count=0,
                mae=None,
                rmse=None,
                mbe=None,
                mape=None,
                min_signed_error_mw=None,
                max_signed_error_mw=None,
                total_actual_generation_mwh=None,
                total_forecast_generation_mwh=None,
                error_std_dev=None,
                percentiles=None,
            )
            return AnalyticsResponse(
                summary=empty_summary,
                daily_breakdown=[],
                diurnal_breakdown=[],
                parameters_used=params,
            )

        missing_actual_count = sum(1 for r in records if r.actual_mw is None)
        missing_forecast_count = sum(1 for r in records if r.forecast_mw is None)

        # Matched periods have both forecast_mw and actual_mw present
        matched_records = [
            r for r in records if r.forecast_mw is not None and r.actual_mw is not None
        ]
        matched_count = len(matched_records)

        mae: Optional[float] = None
        rmse: Optional[float] = None
        mbe: Optional[float] = None
        mape: Optional[float] = None
        min_signed: Optional[float] = None
        max_signed: Optional[float] = None
        std_dev: Optional[float] = None
        percentiles: Optional[Dict[str, float]] = None
        excluded_zero_actual_count: int = 0

        # Energy calculations (MW * 0.5 hours per settlement period)
        actual_vals = [r.actual_mw for r in records if r.actual_mw is not None]
        total_actual_mwh = round(sum(actual_vals) * 0.5, 2) if actual_vals else None

        forecast_vals = [r.forecast_mw for r in records if r.forecast_mw is not None]
        total_forecast_mwh = round(sum(forecast_vals) * 0.5, 2) if forecast_vals else None

        if matched_count > 0:
            errors = [r.forecast_mw - r.actual_mw for r in matched_records]
            abs_errors = [abs(e) for e in errors]

            # Formulas:
            # MAE = sum(|Forecast - Actual|) / n
            mae = round(sum(abs_errors) / matched_count, 2)

            # RMSE = sqrt(sum((Forecast - Actual)^2) / n)
            sum_sq = sum(e ** 2 for e in errors)
            rmse = round(math.sqrt(sum_sq / matched_count), 2)

            # MBE = sum(Forecast - Actual) / n
            mbe = round(sum(errors) / matched_count, 2)

            min_signed = round(min(errors), 2)
            max_signed = round(max(errors), 2)

            # Sample standard deviation (ddof=1)
            if matched_count > 1:
                mean_err = sum(errors) / matched_count
                variance = sum((e - mean_err) ** 2 for e in errors) / (matched_count - 1)
                std_dev = round(math.sqrt(variance), 2)
            else:
                std_dev = 0.0

            # Error distribution percentiles using numpy
            percentiles = {
                "p10": round(float(np.percentile(errors, 10)), 2),
                "p25": round(float(np.percentile(errors, 25)), 2),
                "p50": round(float(np.percentile(errors, 50)), 2),
                "p75": round(float(np.percentile(errors, 75)), 2),
                "p90": round(float(np.percentile(errors, 90)), 2),
            }

            # MAPE calculation: strictly exclude actual <= 0
            positive_actual_records = [r for r in matched_records if r.actual_mw > 0]
            excluded_zero_actual_count = sum(1 for r in matched_records if r.actual_mw <= 0)

            if positive_actual_records:
                pct_errors = [
                    abs(r.forecast_mw - r.actual_mw) / r.actual_mw
                    for r in positive_actual_records
                ]
                mape = round(100.0 * sum(pct_errors) / len(pct_errors), 2)

        summary = AnalyticsMetrics(
            total_delivery_periods=total_periods,
            matched_periods_count=matched_count,
            missing_actual_count=missing_actual_count,
            missing_forecast_count=missing_forecast_count,
            excluded_zero_actual_count=excluded_zero_actual_count,
            mae=mae,
            rmse=rmse,
            mbe=mbe,
            mape=mape,
            min_signed_error_mw=min_signed,
            max_signed_error_mw=max_signed,
            total_actual_generation_mwh=total_actual_mwh,
            total_forecast_generation_mwh=total_forecast_mwh,
            error_std_dev=std_dev,
            percentiles=percentiles,
        )

        # Compute Daily Breakdown
        daily_groups: Dict[str, List[MatchedPeriodRecord]] = defaultdict(list)
        for r in records:
            if r.settlement_date:
                daily_groups[r.settlement_date].append(r)

        daily_breakdown: List[DailyAnalyticsBreakdown] = []
        for day in sorted(daily_groups.keys()):
            day_records = daily_groups[day]
            day_matched = [r for r in day_records if r.forecast_mw is not None and r.actual_mw is not None]
            d_total = len(day_records)
            d_matched = len(day_matched)

            d_mae: Optional[float] = None
            d_rmse: Optional[float] = None
            d_mbe: Optional[float] = None
            d_mape: Optional[float] = None
            d_excluded_zero = 0

            if d_matched > 0:
                d_errors = [r.forecast_mw - r.actual_mw for r in day_matched]
                d_mae = round(sum(abs(e) for e in d_errors) / d_matched, 2)
                d_rmse = round(math.sqrt(sum(e ** 2 for e in d_errors) / d_matched), 2)
                d_mbe = round(sum(d_errors) / d_matched, 2)

                d_pos = [r for r in day_matched if r.actual_mw > 0]
                d_excluded_zero = sum(1 for r in day_matched if r.actual_mw <= 0)
                if d_pos:
                    d_pcts = [abs(r.forecast_mw - r.actual_mw) / r.actual_mw for r in d_pos]
                    d_mape = round(100.0 * sum(d_pcts) / len(d_pcts), 2)

            d_act = [r.actual_mw for r in day_records if r.actual_mw is not None]
            d_act_mwh = round(sum(d_act) * 0.5, 2) if d_act else None

            d_fc = [r.forecast_mw for r in day_records if r.forecast_mw is not None]
            d_fc_mwh = round(sum(d_fc) * 0.5, 2) if d_fc else None

            daily_breakdown.append(
                DailyAnalyticsBreakdown(
                    date=day,
                    total_periods=d_total,
                    matched_periods=d_matched,
                    mae=d_mae,
                    rmse=d_rmse,
                    mbe=d_mbe,
                    mape=d_mape,
                    excluded_zero_actual_count=d_excluded_zero,
                    total_actual_mwh=d_act_mwh,
                    total_forecast_mwh=d_fc_mwh,
                )
            )

        # Compute Diurnal (Settlement Period 1-48) Breakdown
        sp_groups: Dict[int, List[MatchedPeriodRecord]] = defaultdict(list)
        for r in matched_records:
            if r.settlement_period is not None:
                sp_groups[r.settlement_period].append(r)

        diurnal_breakdown: List[DiurnalBreakdown] = []
        for sp in sorted(sp_groups.keys()):
            sp_records = sp_groups[sp]
            sp_count = len(sp_records)
            if sp_count > 0:
                sp_errors = [r.forecast_mw - r.actual_mw for r in sp_records]
                sp_mae = round(sum(abs(e) for e in sp_errors) / sp_count, 2)
                sp_rmse = round(math.sqrt(sum(e ** 2 for e in sp_errors) / sp_count), 2)
                sp_mbe = round(sum(sp_errors) / sp_count, 2)

                diurnal_breakdown.append(
                    DiurnalBreakdown(
                        settlement_period=sp,
                        matched_count=sp_count,
                        mae=sp_mae,
                        rmse=sp_rmse,
                        mbe=sp_mbe,
                    )
                )

        return AnalyticsResponse(
            summary=summary,
            daily_breakdown=daily_breakdown,
            diurnal_breakdown=diurnal_breakdown,
            parameters_used=params,
        )
