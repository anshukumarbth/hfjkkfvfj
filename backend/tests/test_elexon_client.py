"""Unit tests for ElexonClient: parameter conflict handling, retries, and stream parsing."""

import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
from app.clients.elexon_client import (
    ElexonClient,
    ElexonParameterConflictError,
    ElexonTimeoutError,
    ElexonAPIError,
)


@pytest.mark.asyncio
async def test_filter_conflict_raises_error():
    """Verify that providing both settlement-date and publication-date filters raises ElexonParameterConflictError."""
    client = ElexonClient()
    with pytest.raises(ElexonParameterConflictError) as exc_info:
        await client.fetch_actual_wind_generation(
            settlement_date_from="2026-01-01",
            settlement_date_to="2026-01-02",
            publish_date_from="2026-01-01T00:00:00Z",
            publish_date_to="2026-01-02T00:00:00Z",
        )
    assert "settlementDate and publishDateTime filters cannot be used simultaneously" in str(exc_info.value)


@pytest.mark.asyncio
async def test_fetch_actual_wind_generation_filters_fuel_type():
    """Verify that only fuelType='WIND' records are retained from FUELHH stream."""
    mock_payload = [
        {"dataset": "FUELHH", "fuelType": "WIND", "generation": 5000, "startTime": "2026-01-01T00:00:00Z"},
        {"dataset": "FUELHH", "fuelType": "CCGT", "generation": 12000, "startTime": "2026-01-01T00:00:00Z"},
        {"dataset": "FUELHH", "fuelType": "wind", "generation": 5200, "startTime": "2026-01-01T00:30:00Z"},
        {"dataset": "FUELHH", "fuelType": "NUCLEAR", "generation": 4000, "startTime": "2026-01-01T00:00:00Z"},
    ]

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_payload
    mock_client.request.return_value = mock_resp

    client = ElexonClient(client=mock_client)
    records = await client.fetch_actual_wind_generation(settlement_date_from="2026-01-01")

    assert len(records) == 2
    assert all(r["fuelType"].upper() == "WIND" for r in records)


@pytest.mark.asyncio
async def test_fetch_forecast_wind_generation():
    """Verify WINDFOR stream request constructs proper publish datetime query."""
    mock_payload = [
        {"dataset": "WINDFOR", "publishTime": "2026-01-01T00:00:00Z", "startTime": "2026-01-01T12:00:00Z", "generation": 8000}
    ]

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_payload
    mock_client.request.return_value = mock_resp

    client = ElexonClient(client=mock_client)
    records = await client.fetch_forecast_wind_generation(
        publish_date_from="2026-01-01T00:00:00Z",
        publish_date_to="2026-01-01T04:00:00Z",
    )

    assert len(records) == 1
    assert records[0]["generation"] == 8000


@pytest.mark.asyncio
async def test_retry_on_transient_server_error():
    """Verify client retries on 503 Service Unavailable and succeeds on subsequent attempt."""
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    
    # First attempt: 503 error; Second attempt: 200 OK
    resp_503 = MagicMock(spec=httpx.Response)
    resp_503.status_code = 503
    resp_503.url = "https://data.elexon.co.uk/test"
    resp_503.text = "Service Unavailable"

    resp_200 = MagicMock(spec=httpx.Response)
    resp_200.status_code = 200
    resp_200.json.return_value = [{"dataset": "WINDFOR", "generation": 9000}]

    mock_client.request.side_effect = [resp_503, resp_200]

    client = ElexonClient(client=mock_client, max_retries=3, retry_backoff_factor=0.01)
    records = await client.fetch_forecast_wind_generation("2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z")

    assert len(records) == 1
    assert mock_client.request.call_count == 2


@pytest.mark.asyncio
async def test_timeout_raises_elexon_timeout_error():
    """Verify request timeout raises ElexonTimeoutError after max retries."""
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.request.side_effect = httpx.TimeoutException("Connection timed out")

    client = ElexonClient(client=mock_client, max_retries=2, retry_backoff_factor=0.01)
    with pytest.raises(ElexonTimeoutError):
        await client.fetch_actual_wind_generation(settlement_date_from="2026-01-01")

    assert mock_client.request.call_count == 2


@pytest.mark.asyncio
async def test_client_error_400_fails_fast():
    """Verify 400 Bad Request fails fast without retrying."""
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    resp_400 = MagicMock(spec=httpx.Response)
    resp_400.status_code = 400
    resp_400.url = "https://data.elexon.co.uk/test"
    resp_400.text = "Bad Request: invalid parameter format"
    mock_client.request.return_value = resp_400

    client = ElexonClient(client=mock_client, max_retries=3, retry_backoff_factor=0.01)
    with pytest.raises(ElexonAPIError) as exc_info:
        await client.fetch_actual_wind_generation(settlement_date_from="invalid-date")

    assert exc_info.value.status_code == 400
    # Should fail on first attempt without retrying
    assert mock_client.request.call_count == 1
