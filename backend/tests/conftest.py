"""Pytest configuration and mock data fixtures for UK Wind Forecast Analysis backend."""

import pytest
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.forecast import MatchedPeriodRecord


@pytest.fixture
def api_client():
    """FastAPI TestClient fixture."""
    return TestClient(app)


@pytest.fixture
def sample_raw_fuelhh() -> List[Dict[str, Any]]:
    """Sample raw responses from Elexon FUELHH stream including WIND, CCGT, duplicates, and missing values."""
    return [
        # Normal wind record period 1
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T00:35:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 1,
            "fuelType": "WIND",
            "generation": 12500.0,
        },
        # Non-wind record (should be filtered out)
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T00:35:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 1,
            "fuelType": "CCGT",
            "generation": 18000.0,
        },
        # Normal wind record period 2
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T01:05:00Z",
            "startTime": "2026-01-01T00:30:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 2,
            "fuelType": "WIND",
            "generation": 13000.0,
        },
        # Duplicate record for period 2 with earlier publishTime (should be discarded)
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T00:55:00Z",
            "startTime": "2026-01-01T00:30:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 2,
            "fuelType": "WIND",
            "generation": 12900.0,
        },
        # Zero actual generation record period 3
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T01:35:00Z",
            "startTime": "2026-01-01T01:00:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 3,
            "fuelType": "WIND",
            "generation": 0.0,
        },
        # Missing generation value (None) period 4
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T02:05:00Z",
            "startTime": "2026-01-01T01:30:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 4,
            "fuelType": "WIND",
            "generation": None,
        },
    ]


@pytest.fixture
def sample_raw_windfor() -> List[Dict[str, Any]]:
    """Sample raw responses from Elexon WINDFOR stream with multiple revisions per delivery period."""
    return [
        # For delivery 2026-01-01T00:00:00Z (SP 1):
        # 1. Early forecast published on 2025-12-30T10:00:00Z (eligible for all day-ahead cutoffs)
        {
            "dataset": "WINDFOR",
            "publishTime": "2025-12-30T10:00:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "generation": 11500.0,
        },
        # 2. Day-ahead forecast published on 2025-12-31T11:30:00Z (eligible for 12:00 cutoff)
        {
            "dataset": "WINDFOR",
            "publishTime": "2025-12-31T11:30:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "generation": 12000.0,
        },
        # 3. Intraday forecast published on 2025-12-31T16:00:00Z (ineligible for 12:00 cutoff, but eligible for 17:00 cutoff)
        {
            "dataset": "WINDFOR",
            "publishTime": "2025-12-31T16:00:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "generation": 12200.0,
        },
        # 4. Duplicate forecast identical to #2 (should be deduplicated)
        {
            "dataset": "WINDFOR",
            "publishTime": "2025-12-31T11:30:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "generation": 12000.0,
        },

        # For delivery 2026-01-01T00:30:00Z (SP 2):
        {
            "dataset": "WINDFOR",
            "publishTime": "2025-12-31T11:30:00Z",
            "startTime": "2026-01-01T00:30:00Z",
            "generation": 13500.0,
        },

        # For delivery 2026-01-01T01:00:00Z (SP 3) - test zero actual with non-zero forecast:
        {
            "dataset": "WINDFOR",
            "publishTime": "2025-12-31T11:30:00Z",
            "startTime": "2026-01-01T01:00:00Z",
            "generation": 500.0,
        },

        # For delivery 2026-01-01T02:00:00Z (SP 5) - has forecast but actual is missing in sample_raw_fuelhh:
        {
            "dataset": "WINDFOR",
            "publishTime": "2025-12-31T11:30:00Z",
            "startTime": "2026-01-01T02:00:00Z",
            "generation": 14000.0,
        },
    ]


@pytest.fixture
def sample_matched_records() -> List[MatchedPeriodRecord]:
    """Pre-built matched period records for formula verification."""
    dt1 = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    dt2 = datetime(2026, 1, 1, 0, 30, tzinfo=timezone.utc)
    dt3 = datetime(2026, 1, 1, 1, 0, tzinfo=timezone.utc)
    dt4 = datetime(2026, 1, 1, 1, 30, tzinfo=timezone.utc)
    dt5 = datetime(2026, 1, 1, 2, 0, tzinfo=timezone.utc)

    return [
        # Record 1: Over-forecast (+200 MW). Actual: 1000, Forecast: 1200. Error: +200, Abs: 200, %: 20%
        MatchedPeriodRecord(
            start_time=dt1,
            end_time=dt1 + timedelta(minutes=30),
            settlement_date="2026-01-01",
            settlement_period=1,
            forecast_mw=1200.0,
            forecast_publish_time=datetime(2025, 12, 31, 11, 0, tzinfo=timezone.utc),
            actual_mw=1000.0,
            actual_publish_time=datetime(2026, 1, 1, 0, 35, tzinfo=timezone.utc),
            signed_error_mw=200.0,
            absolute_error_mw=200.0,
            percentage_error=20.0,
            decision_cutoff_used=datetime(2025, 12, 31, 12, 0, tzinfo=timezone.utc),
            has_missing_data=False,
        ),
        # Record 2: Under-forecast (-100 MW). Actual: 2000, Forecast: 1900. Error: -100, Abs: 100, %: 5%
        MatchedPeriodRecord(
            start_time=dt2,
            end_time=dt2 + timedelta(minutes=30),
            settlement_date="2026-01-01",
            settlement_period=2,
            forecast_mw=1900.0,
            forecast_publish_time=datetime(2025, 12, 31, 11, 0, tzinfo=timezone.utc),
            actual_mw=2000.0,
            actual_publish_time=datetime(2026, 1, 1, 1, 5, tzinfo=timezone.utc),
            signed_error_mw=-100.0,
            absolute_error_mw=100.0,
            percentage_error=5.0,
            decision_cutoff_used=datetime(2025, 12, 31, 12, 0, tzinfo=timezone.utc),
            has_missing_data=False,
        ),
        # Record 3: Zero actual generation. Actual: 0, Forecast: 300. Error: +300, Abs: 300. %: None (excluded from MAPE)
        MatchedPeriodRecord(
            start_time=dt3,
            end_time=dt3 + timedelta(minutes=30),
            settlement_date="2026-01-01",
            settlement_period=3,
            forecast_mw=300.0,
            forecast_publish_time=datetime(2025, 12, 31, 11, 0, tzinfo=timezone.utc),
            actual_mw=0.0,
            actual_publish_time=datetime(2026, 1, 1, 1, 35, tzinfo=timezone.utc),
            signed_error_mw=300.0,
            absolute_error_mw=300.0,
            percentage_error=None,
            decision_cutoff_used=datetime(2025, 12, 31, 12, 0, tzinfo=timezone.utc),
            has_missing_data=False,
        ),
        # Record 4: Missing actual (None). Forecast: 1500. Errors: None.
        MatchedPeriodRecord(
            start_time=dt4,
            end_time=dt4 + timedelta(minutes=30),
            settlement_date="2026-01-01",
            settlement_period=4,
            forecast_mw=1500.0,
            forecast_publish_time=datetime(2025, 12, 31, 11, 0, tzinfo=timezone.utc),
            actual_mw=None,
            actual_publish_time=None,
            signed_error_mw=None,
            absolute_error_mw=None,
            percentage_error=None,
            decision_cutoff_used=datetime(2025, 12, 31, 12, 0, tzinfo=timezone.utc),
            has_missing_data=True,
        ),
        # Record 5: Missing forecast (None). Actual: 800. Errors: None.
        MatchedPeriodRecord(
            start_time=dt5,
            end_time=dt5 + timedelta(minutes=30),
            settlement_date="2026-01-01",
            settlement_period=5,
            forecast_mw=None,
            forecast_publish_time=None,
            actual_mw=800.0,
            actual_publish_time=datetime(2026, 1, 1, 2, 35, tzinfo=timezone.utc),
            signed_error_mw=None,
            absolute_error_mw=None,
            percentage_error=None,
            decision_cutoff_used=datetime(2025, 12, 31, 12, 0, tzinfo=timezone.utc),
            has_missing_data=True,
        ),
    ]
