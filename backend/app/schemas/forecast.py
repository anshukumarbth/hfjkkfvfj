"""Pydantic schemas for UK Wind Generation Forecast and Actual Analysis."""

from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class RawFuelHHRecord(BaseModel):
    """Raw record from Elexon FUELHH stream."""
    dataset: str = "FUELHH"
    publishTime: datetime
    startTime: datetime
    settlementDate: Optional[str] = None
    settlementPeriod: Optional[int] = None
    fuelType: str
    generation: Optional[float] = None


class RawWindforRecord(BaseModel):
    """Raw record from Elexon WINDFOR stream."""
    dataset: str = "WINDFOR"
    publishTime: datetime
    startTime: datetime
    generation: Optional[float] = None


class ForecastCandidate(BaseModel):
    """Individual forecast revision published for a specific target delivery startTime."""
    publish_time: datetime = Field(..., description="Timestamp when this forecast was published by National Grid / BMRS")
    generation_mw: float = Field(..., description="Forecasted generation in MW")
    is_eligible: bool = Field(..., description="Whether this forecast was published at or before the decision cutoff")
    lead_time_hours: Optional[float] = Field(None, description="Hours between publication and delivery start time")


class MatchedPeriodRecord(BaseModel):
    """Single half-hourly settlement period with matched forecast and actual wind generation."""
    start_time: datetime = Field(..., description="Settlement period delivery start timestamp (UTC)")
    end_time: Optional[datetime] = Field(None, description="Settlement period delivery end timestamp (UTC)")
    settlement_date: Optional[str] = Field(None, description="GB Settlement date (YYYY-MM-DD)")
    settlement_period: Optional[int] = Field(None, description="GB Settlement Period index (1-48/50)")
    forecast_mw: Optional[float] = Field(None, description="Latest eligible wind forecast MW at decision cutoff (null if missing)")
    forecast_publish_time: Optional[datetime] = Field(None, description="Publication timestamp of the selected forecast")
    forecast_candidates_count: int = Field(0, description="Total number of forecasts published for this period")
    actual_mw: Optional[float] = Field(None, description="Outturn actual wind generation MW (null if missing)")
    actual_publish_time: Optional[datetime] = Field(None, description="Publication timestamp of actual outturn")
    signed_error_mw: Optional[float] = Field(None, description="Signed error (Forecast - Actual) in MW. Positive = over-forecast, Negative = under-forecast")
    absolute_error_mw: Optional[float] = Field(None, description="Absolute error |Forecast - Actual| in MW")
    percentage_error: Optional[float] = Field(None, description="Percentage error 100 * |Forecast - Actual| / Actual (null if Actual <= 0 or missing)")
    decision_cutoff_used: Optional[datetime] = Field(None, description="Decision cutoff timestamp applied for forecast selection")
    has_missing_data: bool = Field(False, description="True if either forecast or actual data is missing for this period")


class ForecastDetailResponse(BaseModel):
    """Comprehensive detail for a single settlement period delivery start time."""
    start_time: datetime
    end_time: Optional[datetime] = None
    settlement_date: Optional[str] = None
    settlement_period: Optional[int] = None
    selected_forecast_mw: Optional[float] = None
    selected_forecast_publish_time: Optional[datetime] = None
    decision_cutoff_used: Optional[datetime] = None
    actual_mw: Optional[float] = None
    actual_publish_time: Optional[datetime] = None
    signed_error_mw: Optional[float] = None
    absolute_error_mw: Optional[float] = None
    percentage_error: Optional[float] = None
    all_forecast_revisions: List[ForecastCandidate] = Field(default_factory=list, description="All forecasts published for this delivery time in chronological order")
    notes: Optional[str] = None


class DateRangeSummary(BaseModel):
    """Summary of queried date range."""
    start_date: str
    end_date: str
    decision_cutoff_mode: str
    decision_cutoff_value: Optional[str] = None


class ForecastListResponse(BaseModel):
    """List response for /api/forecasts endpoint."""
    records: List[MatchedPeriodRecord]
    total_records: int
    matched_records: int
    missing_forecast_count: int
    missing_actual_count: int
    date_range: DateRangeSummary


class AnalyticsMetrics(BaseModel):
    """Accuracy and error metrics across evaluated settlement periods."""
    total_delivery_periods: int = Field(..., description="Total half-hour delivery periods evaluated")
    matched_periods_count: int = Field(..., description="Number of periods with both forecast and actual available")
    missing_actual_count: int = Field(..., description="Periods missing actual generation outturn")
    missing_forecast_count: int = Field(..., description="Periods missing eligible forecast")
    excluded_zero_actual_count: int = Field(..., description="Periods where actual generation was zero or invalid, excluded from MAPE calculation")
    mae: Optional[float] = Field(None, description="Mean Absolute Error in MW (sum(|Forecast - Actual|) / n)")
    rmse: Optional[float] = Field(None, description="Root Mean Squared Error in MW (sqrt(sum((Forecast - Actual)^2) / n))")
    mbe: Optional[float] = Field(None, description="Mean Bias Error in MW (sum(Forecast - Actual) / n)")
    mape: Optional[float] = Field(None, description="Mean Absolute Percentage Error in % (100 * mean(|Forecast - Actual| / Actual)), excluding zero actuals")
    min_signed_error_mw: Optional[float] = Field(None, description="Minimum signed error observed (greatest under-forecast)")
    max_signed_error_mw: Optional[float] = Field(None, description="Maximum signed error observed (greatest over-forecast)")
    total_actual_generation_mwh: Optional[float] = Field(None, description="Total actual energy delivered in MWh (sum(MW * 0.5h))")
    total_forecast_generation_mwh: Optional[float] = Field(None, description="Total forecast energy in MWh (sum(MW * 0.5h))")
    error_std_dev: Optional[float] = Field(None, description="Standard deviation of signed forecast errors")
    percentiles: Optional[Dict[str, float]] = Field(None, description="Error percentiles: p10, p25, p50 (median), p75, p90")


class DailyAnalyticsBreakdown(BaseModel):
    """Daily aggregated accuracy metrics for trend analysis."""
    date: str
    total_periods: int
    matched_periods: int
    mae: Optional[float] = None
    rmse: Optional[float] = None
    mbe: Optional[float] = None
    mape: Optional[float] = None
    excluded_zero_actual_count: int = 0
    total_actual_mwh: Optional[float] = None
    total_forecast_mwh: Optional[float] = None


class DiurnalBreakdown(BaseModel):
    """Aggregated metrics by settlement period (1-48) to reveal time-of-day forecasting patterns."""
    settlement_period: int
    matched_count: int
    mae: Optional[float] = None
    rmse: Optional[float] = None
    mbe: Optional[float] = None


class AnalyticsResponse(BaseModel):
    """Full response schema for /api/analytics."""
    summary: AnalyticsMetrics
    daily_breakdown: List[DailyAnalyticsBreakdown]
    diurnal_breakdown: List[DiurnalBreakdown]
    parameters_used: Dict[str, str]


class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str
    service: str
    version: str
    timestamp: datetime
    elexon_connectivity: Dict[str, str]
