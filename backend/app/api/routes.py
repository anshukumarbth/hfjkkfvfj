"""FastAPI API routes for UK Wind Forecast Analysis."""

from datetime import datetime, timezone
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from app.clients.elexon_client import (
    ElexonAPIError,
    ElexonClient,
    ElexonParameterConflictError,
    ElexonTimeoutError,
)
from app.core.config import settings
from app.schemas.forecast import (
    AnalyticsResponse,
    DateRangeSummary,
    ForecastDetailResponse,
    ForecastListResponse,
    HealthResponse,
)
from app.services.analytics_service import AnalyticsService
from app.services.data_service import DataService, parse_utc_timestamp
from app.services.forecast_service import ForecastService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Wind Forecast Analysis"])


# Dependency injection helpers
def get_data_service() -> DataService:
    return DataService()


def get_forecast_service(data_service: DataService = Depends(get_data_service)) -> ForecastService:
    return ForecastService(data_service=data_service)


def get_analytics_service() -> AnalyticsService:
    return AnalyticsService()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Backend Health Check",
    description="Returns application health status and verifies connectivity to Elexon BMRS API endpoints.",
)
async def health_check() -> HealthResponse:
    """Check backend service health and external Elexon stream API connectivity."""
    client = ElexonClient()
    elexon_status = await client.check_api_health()
    overall_status = "healthy"
    if any("unhealthy" in v or "unreachable" in v for v in elexon_status.values()):
        overall_status = "degraded"

    return HealthResponse(
        status=overall_status,
        service=settings.APP_NAME,
        version=settings.APP_VERSION,
        timestamp=datetime.now(timezone.utc),
        elexon_connectivity=elexon_status,
    )


@router.get(
    "/forecasts",
    response_model=ForecastListResponse,
    summary="Get Matched Wind Forecast and Actual Records",
    description=(
        "Fetch actual wind generation (FUELHH stream, fuelType=WIND) and wind forecasts (WINDFOR stream). "
        "Selects the latest eligible forecast published at or before the configured decision cutoff for each "
        "half-hourly settlement period, matches records by delivery startTime, and calculates signed & absolute errors. "
        "Defaults to January 2026 day-ahead purchasing decisions."
    ),
)
async def get_forecasts(
    start_date: str = Query(
        default=settings.DEFAULT_START_DATE,
        description="Delivery start date (YYYY-MM-DD or ISO 8601). Default: 2026-01-01",
        examples=["2026-01-01"],
    ),
    end_date: str = Query(
        default=settings.DEFAULT_END_DATE,
        description="Delivery end date (YYYY-MM-DD or ISO 8601). Default: 2026-01-31",
        examples=["2026-01-02", "2026-01-31"],
    ),
    decision_cutoff: Optional[str] = Query(
        default=None,
        description="Explicit purchasing decision cutoff datetime (ISO 8601 UTC). Forecasts published after this cutoff are excluded.",
        examples=["2026-01-01T12:00:00Z"],
    ),
    day_ahead_cutoff_hour: Optional[int] = Query(
        default=None,
        ge=0,
        le=23,
        description="Day-ahead wholesale gate closure cutoff hour in UTC (0-23). Default: 12 (12:00 UTC day-ahead).",
        examples=[11, 12, 17],
    ),
    lead_time_hours: Optional[float] = Query(
        default=None,
        ge=0.0,
        description="Rolling lead time in hours (e.g. 24.0 means forecast published >= 24h prior to delivery).",
        examples=[4.0, 24.0],
    ),
    forecast_service: ForecastService = Depends(get_forecast_service),
) -> ForecastListResponse:
    parsed_cutoff = parse_utc_timestamp(decision_cutoff) if decision_cutoff else None

    try:
        records = await forecast_service.get_matched_forecast_actual(
            start_date=start_date,
            end_date=end_date,
            decision_cutoff=parsed_cutoff,
            day_ahead_cutoff_hour=day_ahead_cutoff_hour,
            lead_time_hours=lead_time_hours,
        )
    except ElexonParameterConflictError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ElexonTimeoutError as e:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(e))
    except ElexonAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Elexon upstream returned {e.status_code}: {e.message}",
        )
    except Exception as e:
        logger.exception("Unexpected error in get_forecasts: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal error: {e}")

    total_count = len(records)
    matched_count = sum(1 for r in records if r.forecast_mw is not None and r.actual_mw is not None)
    missing_forecast = sum(1 for r in records if r.forecast_mw is None)
    missing_actual = sum(1 for r in records if r.actual_mw is None)

    mode = "explicit_cutoff" if parsed_cutoff else ("lead_time_hours" if lead_time_hours else "day_ahead_hour")
    val = (
        parsed_cutoff.isoformat()
        if parsed_cutoff
        else (f"{lead_time_hours}h" if lead_time_hours else f"{day_ahead_cutoff_hour or settings.DEFAULT_DAY_AHEAD_CUTOFF_HOUR}:00 UTC D-1")
    )

    return ForecastListResponse(
        records=records,
        total_records=total_count,
        matched_records=matched_count,
        missing_forecast_count=missing_forecast,
        missing_actual_count=missing_actual,
        date_range=DateRangeSummary(
            start_date=start_date,
            end_date=end_date,
            decision_cutoff_mode=mode,
            decision_cutoff_value=val,
        ),
    )


@router.get(
    "/analytics",
    response_model=AnalyticsResponse,
    summary="Calculate Forecast Accuracy & Uncertainty Analytics",
    description=(
        "Calculates accuracy and error metrics (MAE, RMSE, MBE, MAPE, percentiles, and daily/diurnal breakdowns). "
        "Strictly excludes zero/invalid actual generation from MAPE and reports excluded count. "
        "Handles missing values without fabricating zeros."
    ),
)
async def get_analytics(
    start_date: str = Query(
        default=settings.DEFAULT_START_DATE,
        description="Delivery start date (YYYY-MM-DD or ISO 8601). Default: 2026-01-01",
        examples=["2026-01-01"],
    ),
    end_date: str = Query(
        default=settings.DEFAULT_END_DATE,
        description="Delivery end date (YYYY-MM-DD or ISO 8601). Default: 2026-01-31",
        examples=["2026-01-02", "2026-01-31"],
    ),
    decision_cutoff: Optional[str] = Query(
        default=None,
        description="Explicit decision cutoff datetime (ISO 8601 UTC).",
        examples=["2026-01-01T12:00:00Z"],
    ),
    day_ahead_cutoff_hour: Optional[int] = Query(
        default=None,
        ge=0,
        le=23,
        description="Day-ahead gate closure cutoff hour in UTC (0-23). Default: 12.",
        examples=[11, 12, 17],
    ),
    lead_time_hours: Optional[float] = Query(
        default=None,
        ge=0.0,
        description="Rolling lead time in hours.",
        examples=[4.0, 24.0],
    ),
    forecast_service: ForecastService = Depends(get_forecast_service),
    analytics_service: AnalyticsService = Depends(get_analytics_service),
) -> AnalyticsResponse:
    parsed_cutoff = parse_utc_timestamp(decision_cutoff) if decision_cutoff else None

    try:
        records = await forecast_service.get_matched_forecast_actual(
            start_date=start_date,
            end_date=end_date,
            decision_cutoff=parsed_cutoff,
            day_ahead_cutoff_hour=day_ahead_cutoff_hour,
            lead_time_hours=lead_time_hours,
        )
    except ElexonParameterConflictError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ElexonTimeoutError as e:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(e))
    except ElexonAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Elexon upstream returned {e.status_code}: {e.message}",
        )
    except Exception as e:
        logger.exception("Unexpected error in get_analytics: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal error: {e}")

    params_used = {
        "start_date": start_date,
        "end_date": end_date,
        "decision_cutoff": str(parsed_cutoff) if parsed_cutoff else "None",
        "day_ahead_cutoff_hour": str(day_ahead_cutoff_hour or settings.DEFAULT_DAY_AHEAD_CUTOFF_HOUR),
        "lead_time_hours": str(lead_time_hours) if lead_time_hours is not None else "None",
    }

    return analytics_service.calculate_metrics(records, parameters_used=params_used)


@router.get(
    "/forecasts/{start_time:path}",
    response_model=ForecastDetailResponse,
    summary="Get Detailed Period Forecast and Revision History",
    description=(
        "Retrieve in-depth forecast details for a specific half-hourly delivery startTime (e.g. 2026-01-01T12:00:00Z). "
        "Includes the selected eligible forecast, outturn actual generation, error metrics, and the complete chronological "
        "history of all forecast revisions published for this delivery window."
    ),
)
async def get_forecast_detail(
    start_time: str = Path(
        ...,
        description="Delivery start timestamp in ISO 8601 format (e.g. 2026-01-01T12:00:00Z)",
        examples=["2026-01-01T12:00:00Z"],
    ),
    decision_cutoff: Optional[str] = Query(
        default=None,
        description="Optional explicit purchasing decision cutoff datetime (ISO 8601 UTC).",
    ),
    day_ahead_cutoff_hour: Optional[int] = Query(
        default=None,
        ge=0,
        le=23,
        description="Day-ahead gate closure cutoff hour in UTC (0-23). Default: 12.",
    ),
    forecast_service: ForecastService = Depends(get_forecast_service),
) -> ForecastDetailResponse:
    parsed_cutoff = parse_utc_timestamp(decision_cutoff) if decision_cutoff else None

    try:
        detail = await forecast_service.get_forecast_detail(
            start_time_iso=start_time,
            decision_cutoff=parsed_cutoff,
            day_ahead_cutoff_hour=day_ahead_cutoff_hour,
        )
    except ElexonParameterConflictError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ElexonTimeoutError as e:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(e))
    except ElexonAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Elexon upstream returned {e.status_code}: {e.message}",
        )
    except Exception as e:
        logger.exception("Unexpected error in get_forecast_detail: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal error: {e}")

    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No delivery period or wind generation data found for delivery startTime '{start_time}'.",
        )

    return detail
