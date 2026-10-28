"""Unit tests for AnalyticsService: verification of all error formulas, zero handling, and empty states."""

import pytest
from app.schemas.forecast import MatchedPeriodRecord
from app.services.analytics_service import AnalyticsService


def test_calculate_metrics_formulas(sample_matched_records):
    """Verify MAE, RMSE, MBE, and MAPE formulas on deterministic sample records.
    
    Sample data breakdown:
    - Rec 1: Act=1000, Fc=1200, SignedErr=+200, AbsErr=200, %Err=20.0%
    - Rec 2: Act=2000, Fc=1900, SignedErr=-100, AbsErr=100, %Err=5.0%
    - Rec 3: Act=0,    Fc=300,  SignedErr=+300, AbsErr=300, %Err=None (zero actual)
    - Rec 4: Act=None, Fc=1500 (missing actual)
    - Rec 5: Act=800,  Fc=None (missing forecast)
    """
    response = AnalyticsService.calculate_metrics(sample_matched_records)
    summary = response.summary

    assert summary.total_delivery_periods == 5
    assert summary.matched_periods_count == 3
    assert summary.missing_actual_count == 1
    assert summary.missing_forecast_count == 1
    assert summary.excluded_zero_actual_count == 1

    # MAE = (200 + 100 + 300) / 3 = 600 / 3 = 200.0
    assert summary.mae == 200.0

    # RMSE = sqrt((200^2 + (-100)^2 + 300^2) / 3) = sqrt((40000 + 10000 + 90000) / 3) = sqrt(46666.67) = 216.02
    assert summary.rmse == 216.02

    # MBE = (200 + (-100) + 300) / 3 = 400 / 3 = 133.33
    assert summary.mbe == 133.33

    # MAPE = (20.0 + 5.0) / 2 = 12.5% (Record 3 is excluded because Actual == 0)
    assert summary.mape == 12.5

    # Signed min & max
    assert summary.min_signed_error_mw == -100.0
    assert summary.max_signed_error_mw == 300.0

    # Energy: Act sum = 1000 + 2000 + 0 + 800 = 3800 MW * 0.5h = 1900.0 MWh
    assert summary.total_actual_generation_mwh == 1900.0

    # Percentiles
    assert summary.percentiles is not None
    assert "p50" in summary.percentiles


def test_empty_dataset_returns_clean_nulls():
    """Verify empty dataset returns 0 counts and null metrics without errors."""
    response = AnalyticsService.calculate_metrics([])
    summary = response.summary

    assert summary.total_delivery_periods == 0
    assert summary.matched_periods_count == 0
    assert summary.mae is None
    assert summary.rmse is None
    assert summary.mbe is None
    assert summary.mape is None
    assert summary.excluded_zero_actual_count == 0
    assert response.daily_breakdown == []
    assert response.diurnal_breakdown == []


def test_all_zero_actuals_mape_handling(sample_matched_records):
    """Verify that if all actuals in matched periods are zero, MAPE is None and all are counted as excluded."""
    # Create records with only zero actual generation
    from datetime import datetime, timezone
    dt = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    records = [
        MatchedPeriodRecord(
            start_time=dt,
            forecast_mw=100.0,
            actual_mw=0.0,
            signed_error_mw=100.0,
            absolute_error_mw=100.0,
            percentage_error=None,
        ),
        MatchedPeriodRecord(
            start_time=dt,
            forecast_mw=200.0,
            actual_mw=0.0,
            signed_error_mw=200.0,
            absolute_error_mw=200.0,
            percentage_error=None,
        ),
    ]

    response = AnalyticsService.calculate_metrics(records)
    summary = response.summary

    assert summary.matched_periods_count == 2
    assert summary.mae == 150.0
    assert summary.rmse == 158.11
    assert summary.mbe == 150.0
    assert summary.mape is None
    assert summary.excluded_zero_actual_count == 2


def test_no_matched_periods_with_only_unmatched_records():
    """Verify metrics when only missing/unmatched periods exist."""
    from datetime import datetime, timezone
    dt = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    records = [
        MatchedPeriodRecord(
            start_time=dt,
            forecast_mw=100.0,
            actual_mw=None,
            signed_error_mw=None,
            absolute_error_mw=None,
        ),
        MatchedPeriodRecord(
            start_time=dt,
            forecast_mw=None,
            actual_mw=200.0,
            signed_error_mw=None,
            absolute_error_mw=None,
        ),
    ]

    response = AnalyticsService.calculate_metrics(records)
    summary = response.summary

    assert summary.total_delivery_periods == 2
    assert summary.matched_periods_count == 0
    assert summary.missing_actual_count == 1
    assert summary.missing_forecast_count == 1
    assert summary.mae is None
    assert summary.rmse is None
    assert summary.mbe is None
    assert summary.mape is None


def test_mixed_error_distribution_and_cumulative_energy():
    """Verify that both positive (overforecasting) and negative (underforecasting) errors

    are correctly tracked in MBE, min/max signed error, and energy (MW * 0.5h = MWh).
    """
    from datetime import datetime, timezone, timedelta
    base_dt = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    records = []

    # 48 periods overforecast (Forecast > Actual)
    for i in range(48):
        records.append(
            MatchedPeriodRecord(
                start_time=base_dt + timedelta(minutes=30 * i),
                settlement_date="2026-01-01",
                settlement_period=i + 1,
                forecast_mw=15000.0,
                actual_mw=12000.0,
                signed_error_mw=3000.0,
                absolute_error_mw=3000.0,
                percentage_error=25.0,
            )
        )

    # 48 periods underforecast (Forecast < Actual)
    for i in range(48, 96):
        records.append(
            MatchedPeriodRecord(
                start_time=base_dt + timedelta(minutes=30 * i),
                settlement_date="2026-01-02",
                settlement_period=(i % 48) + 1,
                forecast_mw=10000.0,
                actual_mw=14000.0,
                signed_error_mw=-4000.0,
                absolute_error_mw=4000.0,
                percentage_error=28.57,
            )
        )

    response = AnalyticsService.calculate_metrics(records)
    summary = response.summary

    assert summary.total_delivery_periods == 96
    assert summary.matched_periods_count == 96
    assert summary.missing_forecast_count == 0
    assert summary.missing_actual_count == 0

    # MAE = (48 * 3000 + 48 * 4000) / 96 = 3500.0
    assert summary.mae == 3500.0

    # MBE = (48 * 3000 + 48 * (-4000)) / 96 = (144000 - 192000) / 96 = -48000 / 96 = -500.0
    assert summary.mbe == -500.0

    # Signed error boundaries
    assert summary.min_signed_error_mw == -4000.0
    assert summary.max_signed_error_mw == 3000.0

    # Cumulative energy (MW * 0.5h = MWh)
    # Total Forecast MWh = (48 * 15000 + 48 * 10000) * 0.5 = (720000 + 480000) * 0.5 = 600,000 MWh
    # Total Actual MWh = (48 * 12000 + 48 * 14000) * 0.5 = (576000 + 672000) * 0.5 = 624,000 MWh
    assert summary.total_forecast_generation_mwh == 600000.0
    assert summary.total_actual_generation_mwh == 624000.0

