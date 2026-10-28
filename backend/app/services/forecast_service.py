"""Forecast Service: Handles decision cutoff filtering, latest forecast selection, and matching with actuals."""

from datetime import datetime, timezone, timedelta
import logging
from typing import Any, Dict, List, Optional, Tuple
from app.core.config import settings
from app.schemas.forecast import (
    ForecastCandidate,
    MatchedPeriodRecord,
    ForecastDetailResponse,
)
from app.services.data_service import DataService, parse_utc_timestamp

logger = logging.getLogger(__name__)


def compute_settlement_period_info(dt: datetime) -> Tuple[str, int]:
    """Compute GB Settlement Date and Settlement Period (1-48) from a UTC delivery startTime."""
    dt_utc = dt.astimezone(timezone.utc)
    settlement_date_str = dt_utc.strftime("%Y-%m-%d")
    # Each 30 minutes is 1 settlement period, starting with SP 1 at 00:00
    sp_index = (dt_utc.hour * 60 + dt_utc.minute) // 30 + 1
    return settlement_date_str, sp_index


def get_cutoff_for_start_time(
    start_time: datetime,
    decision_cutoff: Optional[datetime] = None,
    day_ahead_cutoff_hour: Optional[int] = None,
    lead_time_hours: Optional[float] = None,
) -> datetime:
    """Determine the effective decision cutoff timestamp for a given delivery start time.
    
    Priority:
    1. Explicit absolute decision_cutoff (e.g. 2026-01-15T12:00:00Z)
    2. Rolling lead_time_hours (e.g. 24.0 hours before delivery)
    3. Day-ahead gate closure cutoff: delivery on date D has cutoff at (D - 1 day) at day_ahead_cutoff_hour UTC.
    4. Default: fallback to configured day-ahead cutoff hour (default: 12:00 UTC day-ahead).
    """
    if decision_cutoff is not None:
        return decision_cutoff

    if lead_time_hours is not None:
        return start_time - timedelta(hours=lead_time_hours)

    cutoff_hour = (
        day_ahead_cutoff_hour if day_ahead_cutoff_hour is not None else settings.DEFAULT_DAY_AHEAD_CUTOFF_HOUR
    )
    # Day-ahead cutoff: previous calendar day at cutoff_hour:00:00 UTC
    delivery_date = start_time.date()
    day_ahead_date = delivery_date - timedelta(days=1)
    return datetime(
        day_ahead_date.year,
        day_ahead_date.month,
        day_ahead_date.day,
        cutoff_hour,
        0,
        0,
        tzinfo=timezone.utc,
    )


class ForecastService:
    """Business logic for selecting the latest eligible forecast and matching with actual generation."""

    def __init__(self, data_service: Optional[DataService] = None):
        self.data_service = data_service or DataService()

    async def get_matched_forecast_actual(
        self,
        start_date: str,
        end_date: str,
        decision_cutoff: Optional[datetime] = None,
        day_ahead_cutoff_hour: Optional[int] = None,
        lead_time_hours: Optional[float] = None,
    ) -> List[MatchedPeriodRecord]:
        """Fetch actuals and forecasts, select the latest eligible forecast per period, and match by delivery startTime.
        
        Strict rules applied:
        - Never fabricate missing actuals or forecasts.
        - Never treat missing values as zero.
        - Only consider forecasts published at or before the configured decision cutoff.
        - Pick the latest eligible forecast (maximum publishTime <= cutoff).
        - Correctly compute Signed Error (Forecast - Actual) and Absolute Error.
        - If actual is <= 0 or missing, percentage_error is None.
        """
        # Fetch data in parallel or sequentially
        actual_records = await self.data_service.get_actual_wind_records(start_date, end_date)
        forecast_records = await self.data_service.get_forecast_wind_records(start_date, end_date)

        # Index actuals by delivery start_time
        actuals_by_start: Dict[datetime, Dict[str, Any]] = {}
        for rec in actual_records:
            st = rec["start_time"]
            actuals_by_start[st] = rec

        # Group all forecast candidates by delivery start_time
        forecasts_by_start: Dict[datetime, List[Dict[str, Any]]] = {}
        for rec in forecast_records:
            st = rec["start_time"]
            forecasts_by_start.setdefault(st, []).append(rec)

        # Union of all delivery startTimes present in actuals and forecasts.
        # Since WINDFOR stream is published hourly (00:00, 01:00, etc.) whereas GB settlement
        # periods are half-hourly, expand each hourly forecast start_time to include both half-hours.
        all_half_hours = set(actuals_by_start.keys())
        for f_st in forecasts_by_start.keys():
            all_half_hours.add(f_st)
            if f_st.minute == 0:
                all_half_hours.add(f_st + timedelta(minutes=30))
        all_start_times = sorted(all_half_hours)

        results: List[MatchedPeriodRecord] = []

        for st in all_start_times:
            actual_rec = actuals_by_start.get(st)

            # Retrieve forecast candidates: check exact half-hour start_time first;
            # if none exist (hourly WINDFOR stream), retrieve candidates for the corresponding hour window
            candidates = forecasts_by_start.get(st)
            if not candidates and st.minute != 0:
                hourly_st = st.replace(minute=0, second=0, microsecond=0)
                candidates = forecasts_by_start.get(hourly_st, [])
            elif not candidates:
                candidates = []

            # Compute settlement date and period if not present in actual_rec
            if actual_rec and actual_rec.get("settlement_date"):
                settlement_date = actual_rec["settlement_date"]
                settlement_period = actual_rec.get("settlement_period")
            else:
                settlement_date, settlement_period = compute_settlement_period_info(st)

            # Determine decision cutoff for this delivery start time
            cutoff = get_cutoff_for_start_time(
                start_time=st,
                decision_cutoff=decision_cutoff,
                day_ahead_cutoff_hour=day_ahead_cutoff_hour,
                lead_time_hours=lead_time_hours,
            )

            # Filter candidates published at or before the cutoff
            eligible_candidates = [
                c for c in candidates
                if c["publish_time"] <= cutoff and c.get("generation_mw") is not None
            ]

            selected_forecast: Optional[Dict[str, Any]] = None
            if eligible_candidates:
                # Select the latest eligible forecast (highest publish_time)
                eligible_candidates.sort(key=lambda x: x["publish_time"])
                selected_forecast = eligible_candidates[-1]

            forecast_mw: Optional[float] = (
                selected_forecast["generation_mw"] if selected_forecast else None
            )
            forecast_publish_time: Optional[datetime] = (
                selected_forecast["publish_time"] if selected_forecast else None
            )

            actual_mw: Optional[float] = (
                actual_rec["generation_mw"] if actual_rec and actual_rec.get("generation_mw") is not None else None
            )
            actual_publish_time: Optional[datetime] = (
                actual_rec.get("publish_time") if actual_rec else None
            )

            # Error calculations
            signed_error: Optional[float] = None
            absolute_error: Optional[float] = None
            percentage_error: Optional[float] = None

            if forecast_mw is not None and actual_mw is not None:
                # Formula: Signed Error = Forecast - Actual
                signed_error = round(forecast_mw - actual_mw, 2)
                # Formula: Absolute Error = |Forecast - Actual|
                absolute_error = round(abs(signed_error), 2)
                # Formula: Percentage Error = 100 * |Forecast - Actual| / Actual (only when Actual > 0)
                if actual_mw > 0:
                    percentage_error = round(100.0 * absolute_error / actual_mw, 2)

            has_missing = (forecast_mw is None) or (actual_mw is None)

            record = MatchedPeriodRecord(
                start_time=st,
                end_time=st + timedelta(minutes=30),
                settlement_date=settlement_date,
                settlement_period=settlement_period,
                forecast_mw=forecast_mw,
                forecast_publish_time=forecast_publish_time,
                forecast_candidates_count=len(candidates),
                actual_mw=actual_mw,
                actual_publish_time=actual_publish_time,
                signed_error_mw=signed_error,
                absolute_error_mw=absolute_error,
                percentage_error=percentage_error,
                decision_cutoff_used=cutoff,
                has_missing_data=has_missing,
            )
            results.append(record)

        return results

    async def get_forecast_detail(
        self,
        start_time_iso: str,
        decision_cutoff: Optional[datetime] = None,
        day_ahead_cutoff_hour: Optional[int] = None,
    ) -> Optional[ForecastDetailResponse]:
        """Get in-depth analysis and forecast revision history for a single delivery period."""
        st = parse_utc_timestamp(start_time_iso)
        if not st:
            return None

        # Fetch range spanning 2 days around the target date to ensure all forecasts are captured
        date_str = st.strftime("%Y-%m-%d")
        matched_records = await self.get_matched_forecast_actual(
            start_date=date_str,
            end_date=date_str,
            decision_cutoff=decision_cutoff,
            day_ahead_cutoff_hour=day_ahead_cutoff_hour,
        )

        target_record = next((r for r in matched_records if r.start_time == st), None)
        if not target_record:
            return None

        # Retrieve all forecast candidates published for this period to display forecast evolution
        all_forecasts = await self.data_service.get_forecast_wind_records(
            start_date=date_str,
            end_date=date_str,
        )
        hourly_st = st.replace(minute=0, second=0, microsecond=0)
        candidates_for_st = [
            f for f in all_forecasts
            if (f["start_time"] == st or (st.minute != 0 and f["start_time"] == hourly_st))
            and f.get("generation_mw") is not None
        ]
        candidates_for_st.sort(key=lambda x: x["publish_time"])

        cutoff = target_record.decision_cutoff_used
        revisions: List[ForecastCandidate] = []
        for c in candidates_for_st:
            pub_time = c["publish_time"]
            is_elig = (pub_time <= cutoff) if cutoff else True
            lead_hours = round((st - pub_time).total_seconds() / 3600.0, 2)
            revisions.append(
                ForecastCandidate(
                    publish_time=pub_time,
                    generation_mw=c["generation_mw"],
                    is_eligible=is_elig,
                    lead_time_hours=lead_hours,
                )
            )

        return ForecastDetailResponse(
            start_time=target_record.start_time,
            end_time=target_record.end_time,
            settlement_date=target_record.settlement_date,
            settlement_period=target_record.settlement_period,
            selected_forecast_mw=target_record.forecast_mw,
            selected_forecast_publish_time=target_record.forecast_publish_time,
            decision_cutoff_used=target_record.decision_cutoff_used,
            actual_mw=target_record.actual_mw,
            actual_publish_time=target_record.actual_publish_time,
            signed_error_mw=target_record.signed_error_mw,
            absolute_error_mw=target_record.absolute_error_mw,
            percentage_error=target_record.percentage_error,
            all_forecast_revisions=revisions,
            notes=(
                f"Evaluated against decision cutoff {cutoff.isoformat() if cutoff else 'None'}. "
                f"{len(revisions)} total forecast revisions published for this period."
            ),
        )
