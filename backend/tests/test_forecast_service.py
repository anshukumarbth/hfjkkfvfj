"""Unit tests for ForecastService: cutoff filtering, latest revision selection, and matching."""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock
from app.services.data_service import DataService
from app.services.forecast_service import ForecastService


@pytest.fixture
def mock_data_service(sample_raw_fuelhh, sample_raw_windfor):
    """DataService fixture with mocked Elexon client returning sample data."""
    mock_client = AsyncMock()
    mock_client.fetch_actual_wind_generation.return_value = sample_raw_fuelhh
    mock_client.fetch_forecast_wind_generation.return_value = sample_raw_windfor

    data_svc = DataService(client=mock_client)
    return data_svc


@pytest.mark.asyncio
async def test_decision_cutoff_selection_12_cutoff(mock_data_service):
    """Verify that with 12:00 UTC Day-Ahead cutoff, intraday forecast published at 16:00 is ignored,

    and the latest eligible forecast (11:30 publication) is selected.
    """
    svc = ForecastService(data_service=mock_data_service)
    records = await svc.get_matched_forecast_actual(
        start_date="2026-01-01",
        end_date="2026-01-01",
        day_ahead_cutoff_hour=12,
    )

    # Find record for delivery 2026-01-01T00:00:00Z
    dt1 = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    rec1 = next(r for r in records if r.start_time == dt1)

    # In sample_raw_windfor:
    # 2025-12-30T10:00:00Z -> 11500 MW
    # 2025-12-31T11:30:00Z -> 12000 MW (latest before 12:00 cutoff)
    # 2025-12-31T16:00:00Z -> 12200 MW (ineligible: published after 12:00 cutoff)
    assert rec1.forecast_mw == 12000.0
    assert rec1.forecast_publish_time == datetime(2025, 12, 31, 11, 30, tzinfo=timezone.utc)
    assert rec1.actual_mw == 12500.0
    assert rec1.signed_error_mw == -500.0  # 12000 - 12500
    assert rec1.absolute_error_mw == 500.0
    assert rec1.percentage_error == 4.0  # 100 * 500 / 12500


@pytest.mark.asyncio
async def test_decision_cutoff_selection_17_cutoff(mock_data_service):
    """Verify that when cutoff is extended to 17:00 UTC, the forecast published at 16:00 becomes eligible."""
    svc = ForecastService(data_service=mock_data_service)
    records = await svc.get_matched_forecast_actual(
        start_date="2026-01-01",
        end_date="2026-01-01",
        day_ahead_cutoff_hour=17,
    )

    dt1 = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    rec1 = next(r for r in records if r.start_time == dt1)

    assert rec1.forecast_mw == 12200.0
    assert rec1.forecast_publish_time == datetime(2025, 12, 31, 16, 0, tzinfo=timezone.utc)
    assert rec1.signed_error_mw == -300.0  # 12200 - 12500


@pytest.mark.asyncio
async def test_explicit_datetime_cutoff(mock_data_service):
    """Verify explicit decision_cutoff datetime overrides default day-ahead cutoff hour."""
    svc = ForecastService(data_service=mock_data_service)
    # Cutoff set to 2025-12-30T12:00:00Z (only the first forecast at 10:00 is eligible)
    cutoff = datetime(2025, 12, 30, 12, 0, tzinfo=timezone.utc)
    records = await svc.get_matched_forecast_actual(
        start_date="2026-01-01",
        end_date="2026-01-01",
        decision_cutoff=cutoff,
    )

    dt1 = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    rec1 = next(r for r in records if r.start_time == dt1)

    assert rec1.forecast_mw == 11500.0


@pytest.mark.asyncio
async def test_zero_actual_generation_handling(mock_data_service):
    """Verify that when actual generation is 0.0, signed and absolute errors are computed,

    but percentage_error is None (preventing division by zero).
    """
    svc = ForecastService(data_service=mock_data_service)
    records = await svc.get_matched_forecast_actual(
        start_date="2026-01-01",
        end_date="2026-01-01",
        day_ahead_cutoff_hour=12,
    )

    dt3 = datetime(2026, 1, 1, 1, 0, tzinfo=timezone.utc)
    rec3 = next(r for r in records if r.start_time == dt3)

    assert rec3.actual_mw == 0.0
    assert rec3.forecast_mw == 500.0
    assert rec3.signed_error_mw == 500.0
    assert rec3.absolute_error_mw == 500.0
    assert rec3.percentage_error is None


@pytest.mark.asyncio
async def test_missing_data_never_fabricated(mock_data_service):
    """Verify that missing actual or missing forecast values remain None and are never replaced with zero."""
    svc = ForecastService(data_service=mock_data_service)
    records = await svc.get_matched_forecast_actual(
        start_date="2026-01-01",
        end_date="2026-01-01",
        day_ahead_cutoff_hour=12,
    )

    # Delivery 2026-01-01T01:30:00Z: FUELHH has generation=None
    dt4 = datetime(2026, 1, 1, 1, 30, tzinfo=timezone.utc)
    rec4 = next((r for r in records if r.start_time == dt4), None)
    if rec4:
        assert rec4.actual_mw is None
        assert rec4.signed_error_mw is None
        assert rec4.has_missing_data is True

    # Delivery 2026-01-01T02:00:00Z: has forecast in WINDFOR but no actual in FUELHH
    dt5 = datetime(2026, 1, 1, 2, 0, tzinfo=timezone.utc)
    rec5 = next((r for r in records if r.start_time == dt5), None)
    assert rec5 is not None
    assert rec5.forecast_mw == 14000.0
    assert rec5.actual_mw is None
    assert rec5.signed_error_mw is None
    assert rec5.has_missing_data is True


@pytest.mark.asyncio
async def test_forecast_detail_evolution(mock_data_service):
    """Verify single period detail returns all forecast revisions with eligibility flags."""
    svc = ForecastService(data_service=mock_data_service)
    detail = await svc.get_forecast_detail(
        start_time_iso="2026-01-01T00:00:00Z",
        day_ahead_cutoff_hour=12,
    )

    assert detail is not None
    assert detail.start_time == datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    assert detail.selected_forecast_mw == 12000.0
    assert detail.actual_mw == 12500.0
    assert detail.signed_error_mw == -500.0
    # Should have 3 revisions (11500, 12000, 12200 - duplicate 12000 was deduplicated)
    assert len(detail.all_forecast_revisions) == 3
    # First two are eligible, last (published at 16:00) is ineligible
    assert detail.all_forecast_revisions[0].is_eligible is True
    assert detail.all_forecast_revisions[1].is_eligible is True
    assert detail.all_forecast_revisions[2].is_eligible is False


@pytest.mark.asyncio
async def test_hourly_forecast_aligns_to_both_half_hours(mock_data_service):
    """Verify that forecast matching prioritizes exact half-hour start_time when present,

    and accurately falls back to the hourly forecast window for unpopulated half-hour periods.
    """
    svc = ForecastService(data_service=mock_data_service)
    records = await svc.get_matched_forecast_actual(
        start_date="2026-01-01",
        end_date="2026-01-01",
        day_ahead_cutoff_hour=12,
    )

    # 1. Period with exact half-hour forecast (SP 2: 00:30:00Z)
    dt2 = datetime(2026, 1, 1, 0, 30, tzinfo=timezone.utc)
    rec2 = next((r for r in records if r.start_time == dt2), None)
    assert rec2 is not None, "SP 2 (00:30) record must exist"
    assert rec2.forecast_mw == 13500.0  # Exact match from fixture
    assert rec2.actual_mw == 13000.0
    assert rec2.signed_error_mw == 500.0  # 13500 - 13000

    # 2. Period where only an hourly forecast exists (02:00:00Z in WINDFOR, no 02:30:00Z)
    # The second half-hour (SP 6: 02:30:00Z) must fall back to the 02:00:00Z hourly forecast
    dt6 = datetime(2026, 1, 1, 2, 30, tzinfo=timezone.utc)
    rec6 = next((r for r in records if r.start_time == dt6), None)
    assert rec6 is not None, "SP 6 (02:30) record must exist via hourly window expansion"
    assert rec6.forecast_mw == 14000.0  # Successfully aligned to 02:00:00Z forecast
    assert rec6.forecast_candidates_count > 0

