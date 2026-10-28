"""Integration tests for FastAPI endpoints (/api/health, /api/forecasts, /api/analytics, /api/forecasts/{start_time})."""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.api.routes import get_data_service
from app.services.data_service import DataService


@pytest.fixture
def mock_data_svc(sample_raw_fuelhh, sample_raw_windfor):
    """DataService fixture with mocked Elexon client."""
    mock_client = AsyncMock()
    mock_client.fetch_actual_wind_generation.return_value = sample_raw_fuelhh
    mock_client.fetch_forecast_wind_generation.return_value = sample_raw_windfor
    return DataService(client=mock_client)


def test_root_endpoint(api_client: TestClient):
    """Verify root / endpoint returns operational status and links."""
    resp = api_client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "online"
    assert "endpoints" in data


def test_health_endpoint(api_client: TestClient):
    """Verify /api/health endpoint returns health status and connectivity."""
    with patch("app.clients.elexon_client.ElexonClient.check_api_health", new_callable=AsyncMock) as mock_ping:
        mock_ping.return_value = {"FUELHH": "available", "WINDFOR": "available"}
        resp = api_client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "elexon_connectivity" in data
        assert data["elexon_connectivity"]["FUELHH"] == "available"


def test_get_forecasts_endpoint(api_client: TestClient, mock_data_svc):
    """Verify /api/forecasts returns matched list with accurate counts."""
    from app.main import app
    app.dependency_overrides[get_data_service] = lambda: mock_data_svc

    resp = api_client.get("/api/forecasts?start_date=2026-01-01&end_date=2026-01-01&day_ahead_cutoff_hour=12")
    assert resp.status_code == 200
    data = resp.json()

    assert "records" in data
    assert data["total_records"] > 0
    assert "date_range" in data

    # Verify fields in first record
    rec = data["records"][0]
    assert "start_time" in rec
    assert "forecast_mw" in rec
    assert "actual_mw" in rec
    assert "signed_error_mw" in rec
    assert "absolute_error_mw" in rec

    app.dependency_overrides.clear()


def test_get_forecasts_invalid_cutoff_hour(api_client: TestClient):
    """Verify validation error when day_ahead_cutoff_hour is outside 0-23."""
    resp = api_client.get("/api/forecasts?day_ahead_cutoff_hour=25")
    assert resp.status_code == 422
    data = resp.json()
    assert "detail" in data


def test_get_forecast_detail_success(api_client: TestClient, mock_data_svc):
    """Verify /api/forecasts/{start_time} returns single period detail and all revisions."""
    from app.main import app
    app.dependency_overrides[get_data_service] = lambda: mock_data_svc

    resp = api_client.get("/api/forecasts/2026-01-01T00:00:00Z?day_ahead_cutoff_hour=12")
    assert resp.status_code == 200
    data = resp.json()

    assert data["start_time"] == "2026-01-01T00:00:00Z"
    assert data["selected_forecast_mw"] == 12000.0
    assert data["actual_mw"] == 12500.0
    assert data["signed_error_mw"] == -500.0
    assert len(data["all_forecast_revisions"]) > 0

    app.dependency_overrides.clear()


def test_get_forecast_detail_not_found(api_client: TestClient, mock_data_svc):
    """Verify /api/forecasts/{start_time} returns 404 for non-existent delivery period."""
    from app.main import app
    app.dependency_overrides[get_data_service] = lambda: mock_data_svc

    resp = api_client.get("/api/forecasts/2099-01-01T00:00:00Z")
    assert resp.status_code == 404

    app.dependency_overrides.clear()


def test_get_analytics_endpoint(api_client: TestClient, mock_data_svc):
    """Verify /api/analytics returns statistical summary, daily breakdown, and diurnal breakdown."""
    from app.main import app
    app.dependency_overrides[get_data_service] = lambda: mock_data_svc

    resp = api_client.get("/api/analytics?start_date=2026-01-01&end_date=2026-01-01&day_ahead_cutoff_hour=12")
    assert resp.status_code == 200
    data = resp.json()

    assert "summary" in data
    summary = data["summary"]
    assert "mae" in summary
    assert "rmse" in summary
    assert "mbe" in summary
    assert "mape" in summary
    assert "excluded_zero_actual_count" in summary
    assert summary["matched_periods_count"] > 0

    assert "daily_breakdown" in data
    assert "diurnal_breakdown" in data
    assert "parameters_used" in data

    app.dependency_overrides.clear()
