"""HTTP client for Elexon BMRS API with timeouts, bounded retries, and parameter conflict resolution."""

import asyncio
import logging
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


class ElexonClientError(Exception):
    """Base exception for Elexon client errors."""
    pass


class ElexonParameterConflictError(ElexonClientError):
    """Raised when mutually exclusive query parameters (settlement-date vs publication-date) are provided."""
    pass


class ElexonAPIError(ElexonClientError):
    """Raised when Elexon API responds with an HTTP error status code."""
    def __init__(self, status_code: int, message: str, url: str):
        super().__init__(f"Elexon API error {status_code} for {url}: {message}")
        self.status_code = status_code
        self.message = message
        self.url = url


class ElexonTimeoutError(ElexonClientError):
    """Raised when requests to Elexon API exceed the configured timeout after retries."""
    pass


class ElexonClient:
    """Async HTTP client for querying Elexon BMRS stream endpoints."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        fuelhh_url: Optional[str] = None,
        windfor_url: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        max_retries: Optional[int] = None,
        retry_backoff_factor: Optional[float] = None,
        client: Optional[httpx.AsyncClient] = None,
    ):
        self.base_url = base_url or settings.ELEXON_API_BASE_URL
        self.fuelhh_url = fuelhh_url or settings.FUELHH_STREAM_URL
        self.windfor_url = windfor_url or settings.WINDFOR_STREAM_URL
        self.timeout = timeout_seconds if timeout_seconds is not None else settings.HTTP_TIMEOUT_SECONDS
        self.max_retries = max_retries if max_retries is not None else settings.MAX_RETRIES
        self.retry_backoff_factor = (
            retry_backoff_factor if retry_backoff_factor is not None else settings.RETRY_BACKOFF_FACTOR
        )
        self._external_client = client

    async def _execute_with_retry(
        self,
        client: httpx.AsyncClient,
        method: str,
        url: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Execute an HTTP request with bounded retries and exponential backoff.
        
        Retries on connection errors, timeouts, rate limiting (429), and 5xx server errors.
        Fails fast on permanent 4xx client errors (e.g. 400 Bad Request, 404 Not Found).
        """
        last_exception: Optional[Exception] = None
        
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.debug("Requesting %s (attempt %d/%d) with params: %s", url, attempt, self.max_retries, params)
                response = await client.request(
                    method=method,
                    url=url,
                    params=params,
                    timeout=self.timeout,
                    headers={"Accept": "application/json", "User-Agent": "UKWindForecastUtility/1.0"},
                )
                
                # Check for rate limiting or server errors that warrant a retry
                if response.status_code in (429, 502, 503, 504):
                    logger.warning(
                        "Received status %d from %s (attempt %d/%d). Retrying...",
                        response.status_code,
                        url,
                        attempt,
                        self.max_retries,
                    )
                    if attempt == self.max_retries:
                        raise ElexonAPIError(response.status_code, response.text, str(response.url))
                    await asyncio.sleep(self.retry_backoff_factor * (2 ** (attempt - 1)))
                    continue
                
                # Raise for other non-success HTTP status codes (e.g., 400, 404, 500)
                if response.status_code >= 400:
                    raise ElexonAPIError(response.status_code, response.text, str(response.url))
                
                data = response.json()
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict) and "data" in data and isinstance(data["data"], list):
                    return data["data"]
                elif isinstance(data, dict):
                    # Handle single record response
                    return [data]
                return []
                
            except (httpx.TimeoutException, TimeoutError) as e:
                logger.warning("Timeout requesting %s (attempt %d/%d): %s", url, attempt, self.max_retries, e)
                last_exception = ElexonTimeoutError(f"Request timed out after {self.timeout}s to {url}: {e}")
                if attempt < self.max_retries:
                    await asyncio.sleep(self.retry_backoff_factor * (2 ** (attempt - 1)))
                else:
                    raise last_exception from e
            except httpx.RequestError as e:
                logger.warning("Network error requesting %s (attempt %d/%d): %s", url, attempt, self.max_retries, e)
                last_exception = ElexonClientError(f"Network error communicating with Elexon API: {e}")
                if attempt < self.max_retries:
                    await asyncio.sleep(self.retry_backoff_factor * (2 ** (attempt - 1)))
                else:
                    raise last_exception from e
            except ElexonAPIError:
                raise
            except Exception as e:
                logger.error("Unexpected error parsing response from %s: %s", url, e)
                raise ElexonClientError(f"Failed to process response from Elexon API: {e}") from e

        if last_exception:
            raise last_exception
        raise ElexonClientError(f"Failed to execute request to {url} after {self.max_retries} attempts")

    async def fetch_actual_wind_generation(
        self,
        settlement_date_from: Optional[str] = None,
        settlement_date_to: Optional[str] = None,
        publish_date_from: Optional[str] = None,
        publish_date_to: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch actual half-hourly generation outturn from FUELHH stream and filter for WIND.
        
        Handles the Elexon API filter constraint:
        Settlement Date fields and Publish Date fields are strictly mutually exclusive.
        Passing both simultaneously causes the API to reject the query.
        """
        has_settlement = bool(settlement_date_from or settlement_date_to)
        has_publish = bool(publish_date_from or publish_date_to)

        if has_settlement and has_publish:
            raise ElexonParameterConflictError(
                "Elexon API Filter Conflict: settlementDate and publishDateTime filters cannot be used simultaneously. "
                "Specify either settlementDateFrom/To OR publishDateTimeFrom/To, not both."
            )

        params: Dict[str, Any] = {}
        if has_settlement:
            if settlement_date_from:
                params["settlementDateFrom"] = settlement_date_from
            if settlement_date_to:
                params["settlementDateTo"] = settlement_date_to
        elif has_publish:
            if publish_date_from:
                params["publishDateTimeFrom"] = publish_date_from
            if publish_date_to:
                params["publishDateTimeTo"] = publish_date_to

        async def _call(client: httpx.AsyncClient) -> List[Dict[str, Any]]:
            raw_records = await self._execute_with_retry(
                client=client,
                method="GET",
                url=self.fuelhh_url,
                params=params,
            )
            # Filter strictly for wind generation records
            wind_records = [
                rec for rec in raw_records
                if rec.get("fuelType") and str(rec.get("fuelType")).strip().upper() == "WIND"
            ]
            logger.info(
                "Fetched %d total FUELHH records, filtered to %d WIND records (params: %s)",
                len(raw_records),
                len(wind_records),
                params,
            )
            return wind_records

        if self._external_client:
            return await _call(self._external_client)
        async with httpx.AsyncClient() as client:
            return await _call(client)

    async def fetch_forecast_wind_generation(
        self,
        publish_date_from: Optional[str] = None,
        publish_date_to: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch wind generation forecasts from WINDFOR stream using publish time window.
        
        The WINDFOR stream endpoint filters strictly by publication datetime:
        publishDateTimeFrom / publishDateTimeTo (ISO 8601 UTC).
        """
        params: Dict[str, Any] = {}
        if publish_date_from:
            params["publishDateTimeFrom"] = publish_date_from
        if publish_date_to:
            params["publishDateTimeTo"] = publish_date_to

        async def _call(client: httpx.AsyncClient) -> List[Dict[str, Any]]:
            raw_records = await self._execute_with_retry(
                client=client,
                method="GET",
                url=self.windfor_url,
                params=params,
            )
            logger.info(
                "Fetched %d WINDFOR forecast records (params: %s)",
                len(raw_records),
                params,
            )
            return raw_records

        if self._external_client:
            return await _call(self._external_client)
        async with httpx.AsyncClient() as client:
            return await _call(client)

    async def check_api_health(self) -> Dict[str, str]:
        """Perform a lightweight ping to verify Elexon API responsiveness."""
        async def _check(client: httpx.AsyncClient) -> Dict[str, str]:
            status = {}
            for name, url in [("FUELHH", self.fuelhh_url), ("WINDFOR", self.windfor_url)]:
                try:
                    resp = await client.request(
                        method="HEAD",
                        url=url,
                        timeout=5.0,
                    )
                    status[name] = "available" if resp.status_code < 500 else f"unhealthy ({resp.status_code})"
                except Exception as e:
                    status[name] = f"unreachable ({type(e).__name__})"
            return status

        if self._external_client:
            return await _check(self._external_client)
        async with httpx.AsyncClient() as client:
            return await _check(client)
