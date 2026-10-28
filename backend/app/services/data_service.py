"""Data Service: Handles data ingestion, timezone normalization, deduplication, and caching."""

from datetime import datetime, timezone, timedelta
import logging
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict
from dateutil import parser
from app.clients.elexon_client import ElexonClient

try:
    import pandas as pd
except Exception:  # Handle environments where pandas C-extension is restricted by OS policy
    pd = None

logger = logging.getLogger(__name__)


def parse_utc_timestamp(val: Any) -> Optional[datetime]:
    """Parse string or timestamp into timezone-aware UTC datetime."""
    if val is None or val == "":
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val.astimezone(timezone.utc)
    try:
        dt = parser.parse(str(val))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception as e:
        logger.warning("Failed to parse datetime '%s': %s", val, e)
        return None


def format_iso_utc(dt: datetime) -> str:
    """Format datetime as ISO 8601 UTC string (ending with Z)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def safe_float(val: Any) -> Optional[float]:
    """Convert value to float safely without treating missing values as zero."""
    if val is None or val == "":
        return None
    try:
        f = float(val)
        import math
        if math.isnan(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


class DataService:
    """Service responsible for retrieving, normalizing, deduplicating, and caching Elexon data."""

    def __init__(self, client: Optional[ElexonClient] = None, cache_ttl_seconds: int = 300):
        self.client = client or ElexonClient()
        self.cache_ttl = timedelta(seconds=cache_ttl_seconds)
        self._cache: Dict[str, Tuple[datetime, Any]] = {}

    def _get_from_cache(self, key: str) -> Optional[Any]:
        if key in self._cache:
            ts, val = self._cache[key]
            if datetime.now(timezone.utc) - ts < self.cache_ttl:
                return val
            del self._cache[key]
        return None

    def _set_in_cache(self, key: str, val: Any) -> None:
        self._cache[key] = (datetime.now(timezone.utc), val)

    async def get_actual_wind_records(
        self,
        start_date: str,
        end_date: str,
    ) -> List[Dict[str, Any]]:
        """Fetch and normalize actual wind generation records (FUELHH stream, fuelType=WIND).
        
        Performs deduplication and UTC normalization.
        Never converts missing or null values to zero.
        """
        cache_key = f"actuals_{start_date}_{end_date}"
        cached = self._get_from_cache(cache_key)
        if cached is not None:
            return cached

        dt_start = parse_utc_timestamp(start_date) or datetime(2026, 1, 1, tzinfo=timezone.utc)
        dt_end = parse_utc_timestamp(end_date) or datetime(2026, 1, 31, tzinfo=timezone.utc)
        if len(str(start_date).strip()) <= 10:
            dt_start = dt_start.replace(hour=0, minute=0, second=0, microsecond=0)
        if len(str(end_date).strip()) <= 10:
            dt_end = dt_end.replace(hour=23, minute=59, second=59, microsecond=999999)

        # Query Elexon FUELHH using settlement date filters formatted as YYYY-MM-DD
        s_from = str(start_date).strip()[:10]
        s_to = str(end_date).strip()[:10]
        raw_items = await self.client.fetch_actual_wind_generation(
            settlement_date_from=s_from,
            settlement_date_to=s_to,
        )

        if not raw_items:
            logger.warning("No actual wind records returned for %s to %s", start_date, end_date)
            return []

        # Parse and group by delivery startTime for deduplication
        grouped: Dict[datetime, List[Dict[str, Any]]] = defaultdict(list)
        for item in raw_items:
            st = parse_utc_timestamp(item.get("startTime"))
            if not st:
                continue
            if st < dt_start or st > dt_end:
                continue
            pub = parse_utc_timestamp(item.get("publishTime"))
            gen = safe_float(item.get("generation"))
            s_date = str(item.get("settlementDate")) if item.get("settlementDate") else None
            s_period = int(item["settlementPeriod"]) if item.get("settlementPeriod") is not None else None

            grouped[st].append({
                "start_time": st,
                "publish_time": pub,
                "settlement_date": s_date,
                "settlement_period": s_period,
                "fuel_type": "WIND",
                "generation_mw": gen,
            })

        # Deduplicate: if multiple records exist for the same startTime,
        # pick the one with the latest publishTime
        clean_records: List[Dict[str, Any]] = []
        for st in sorted(grouped.keys()):
            records_for_st = grouped[st]
            # Sort by publishTime descending (treat None publishTime as epoch)
            epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
            records_for_st.sort(key=lambda x: x["publish_time"] or epoch, reverse=True)
            clean_records.append(records_for_st[0])

        self._set_in_cache(cache_key, clean_records)
        return clean_records

    async def get_forecast_wind_records(
        self,
        start_date: str,
        end_date: str,
    ) -> List[Dict[str, Any]]:
        """Fetch and normalize wind forecasts (WINDFOR stream).
        
        For target deliveries between start_date and end_date, forecasts are published in advance.
        We query a window starting 3 days before start_date to capture day-ahead and multi-day ahead forecasts.
        """
        cache_key = f"forecasts_{start_date}_{end_date}"
        cached = self._get_from_cache(cache_key)
        if cached is not None:
            return cached

        # Parse delivery window bounds
        dt_start = parse_utc_timestamp(start_date) or datetime(2026, 1, 1, tzinfo=timezone.utc)
        dt_end = parse_utc_timestamp(end_date) or datetime(2026, 1, 31, tzinfo=timezone.utc)
        
        # If date strings were provided without time (e.g. YYYY-MM-DD), set full-day boundaries
        if len(str(start_date).strip()) <= 10:
            dt_start = dt_start.replace(hour=0, minute=0, second=0, microsecond=0)
        if len(str(end_date).strip()) <= 10:
            dt_end = dt_end.replace(hour=23, minute=59, second=59, microsecond=999999)

        # Calculate publication query window: from 5 days prior to end of end_date
        pub_from = dt_start - timedelta(days=5)
        pub_to = dt_end + timedelta(hours=4)

        raw_items = await self.client.fetch_forecast_wind_generation(
            publish_date_from=format_iso_utc(pub_from),
            publish_date_to=format_iso_utc(pub_to),
        )

        if not raw_items:
            logger.warning("No forecast wind records returned for publish window %s to %s", pub_from, pub_to)
            return []

        dt_range_start = dt_start
        dt_range_end = dt_end

        # Deduplicate by (start_time, publish_time)
        seen_keys = set()
        clean_forecasts: List[Dict[str, Any]] = []

        for item in raw_items:
            st = parse_utc_timestamp(item.get("startTime"))
            pub = parse_utc_timestamp(item.get("publishTime"))
            if not st or not pub:
                continue

            # Filter to delivery window
            if st < dt_range_start or st > dt_range_end:
                continue

            key = (st, pub)
            if key in seen_keys:
                continue
            seen_keys.add(key)

            gen = safe_float(item.get("generation"))
            clean_forecasts.append({
                "start_time": st,
                "publish_time": pub,
                "generation_mw": gen,
            })

        clean_forecasts.sort(key=lambda x: (x["start_time"], x["publish_time"]))
        self._set_in_cache(cache_key, clean_forecasts)
        return clean_forecasts
