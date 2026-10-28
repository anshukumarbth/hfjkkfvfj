# UK Wind Generation Forecast Analysis — Backend Service

A production-grade Python backend service built with **FastAPI**, **Pydantic v2**, **HTTPX**, **Pandas / NumPy**, and **Pytest**. 

Designed for a UK electricity utility trading in the Great Britain Day-Ahead wholesale power market, this service ingests half-hourly wind generation forecasts (`WINDFOR`) and actual outturn generation (`FUELHH`) from the Elexon BMRS Insights API, enforces strict day-ahead decision cutoff rules, aligns delivery timestamps, and calculates comprehensive procurement uncertainty and error metrics for **January 2026**.

---

## Table of Contents
1. [Business Context](#1-business-context)
2. [Architecture Overview](#2-architecture-overview)
3. [Folder and File Structure](#3-folder-and-file-structure)
4. [Technology Stack](#4-technology-stack)
5. [Prerequisites and Installation](#5-prerequisites-and-installation)
6. [Environment Configuration (.env.example)](#6-environment-configuration-envexample)
7. [Running and Testing the Backend](#7-running-and-testing-the-backend)
8. [Forecast Selection Logic & Metric Formulas](#8-forecast-selection-logic--metric-formulas)
9. [API Endpoints Reference](#9-api-endpoints-reference)
10. [Error Handling, Edge Cases & Limitations](#10-error-handling-edge-cases--limitations)
11. [Connecting to a Future React Frontend](#11-connecting-to-a-future-react-frontend)
12. [AI Tools Documentation](#12-ai-tools-documentation)

---

## 1. Business Context

In the Great Britain (GB) electricity market, wind power generation is weather-dependent and volatile. Utility procurement desks face significant financial exposure if their wholesale power purchases do not match customer demand and renewable outturn:

* **Over-forecasting ($Forecast > Actual$):** The utility procures too much power in the Day-Ahead market and must sell the surplus back into the system at potentially discounted System Buy/Sell imbalance prices.
* **Under-forecasting ($Forecast < Actual$):** The utility procures too little power and is exposed to expensive short cash-out penalties to cover customer demand.

### Utility Objectives
1. **Decision Cutoff Enforcement:** At the time of day-ahead procurement gate closure (e.g., 12:00 UTC day-ahead), traders must only consider forecasts published *at or before* that exact cutoff. Forecasts published after gate closure were unavailable at trading time and must be excluded.
2. **Forecast Evolution:** Multiple revisions of wind forecasts are published over time for each 30-minute settlement period. The engine identifies the latest eligible revision while maintaining visibility into the revision trajectory.
3. **Accuracy & Uncertainty Analytics:** Quantitative assessment of MAE, RMSE, MBE, MAPE, error standard deviation, and diurnal biases across January 2026.

---

## 2. Architecture Overview

The backend uses a clean, decoupled layered architecture separating network clients, data ingestion, business domain rules, statistical calculations, and HTTP presentation:

```
┌────────────────────────────────────────────────────────┐
│               FastAPI HTTP Router                      │
│   GET /api/health           GET /api/forecasts         │
│   GET /api/analytics        GET /api/forecasts/{time}  │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                 Forecast Service                       │
│  - Evaluates decision cutoff (Day-Ahead / Lead Time)   │
│  - Selects latest eligible forecast revision           │
│  - Matches periods on UTC delivery startTime           │
│  - Computes period-level signed and absolute errors    │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
┌──────────────▼────────────┐ ┌───────────▼──────────────┐
│       Data Service        │ │    Analytics Service     │
│ - UTC normalization       │ │ - MAE, RMSE, MBE, MAPE   │
│ - Deduplication & caching │ │ - Exclude zero actuals   │
│ - FuelType WIND filter    │ │ - Diurnal & Daily trends │
│ - Never treats null as 0  │ │ - Distribution percentiles│
└──────────────┬────────────┘ └──────────────────────────┘
               │
┌──────────────▼─────────────────────────────────────────┐
│              Elexon BMRS Stream Client                 │
│ - Async HTTPX client with bounded exponential retries  │
│ - Resolves settlementDate vs publishDateTime conflict  │
│ - Timeout enforcement & upstream error wrapping        │
└────────────────────────────────────────────────────────┘
```

---

## 3. Folder and File Structure

```
backend/
├── app/
│   ├── __init__.py                 # Package declaration and version
│   ├── main.py                     # FastAPI app, CORS middleware, exception handlers
│   ├── core/
│   │   ├── __init__.py             # Exports settings instance
│   │   └── config.py               # Pydantic Settings (.env configuration, defaults)
│   ├── schemas/
│   │   ├── __init__.py             # Pydantic schemas exports
│   │   └── forecast.py             # Typed request/response models & OpenAPI documentation
│   ├── clients/
│   │   ├── __init__.py             # Client exports and custom exceptions
│   │   └── elexon_client.py        # Async HTTP client with bounded retries & conflict handling
│   ├── services/
│   │   ├── __init__.py             # Services exports
│   │   ├── data_service.py         # Data retrieval, UTC normalization, deduplication, cache
│   │   ├── forecast_service.py     # Decision cutoff logic & latest forecast selection
│   │   └── analytics_service.py    # MAE, RMSE, MBE, MAPE, percentiles, daily/diurnal breakdowns
│   └── api/
│       ├── __init__.py             # API router export
│       └── routes.py               # HTTP endpoints: /health, /forecasts, /analytics, /{start_time}
├── tests/
│   ├── __init__.py                 # Test package declaration
│   ├── conftest.py                 # Pytest fixtures, mock data generators, TestClient
│   ├── test_elexon_client.py       # Client unit tests: retries, timeouts, filter conflicts
│   ├── test_forecast_service.py    # Domain tests: cutoff selection, matching, missing data
│   ├── test_analytics_service.py   # Statistical tests: MAE, RMSE, MBE, MAPE, zero actuals
│   └── test_api_routes.py          # Route integration tests: 200/404/422 responses
├── requirements.txt                # Production and testing dependencies
├── .env.example                    # Template environment variables
├── .env                            # Active local configuration (git-ignored)
└── README.md                       # Complete backend documentation
```

---

## 4. Technology Stack

* **Language:** Python 3.10+ / Python 3.14
* **Web Framework:** [FastAPI](https://fastapi.tiangolo.com/) 0.115+
* **Validation & Settings:** [Pydantic v2](https://docs.pydantic.dev/) & [Pydantic-Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
* **HTTP Client:** [HTTPX](https://www.python-httpx.org/) 0.28+ (Async HTTP client with timeout and retry support)
* **Data & Analytics Engine:** [NumPy](https://numpy.org/) & [Pandas](https://pandas.pydata.org/) (vectorized metrics, percentiles, distribution aggregation)
* **ASGI Server:** [Uvicorn](https://www.uvicorn.org/) 0.30+
* **Testing Framework:** [Pytest](https://docs.pytest.org/) 8.3+ & [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)

---

## 5. Prerequisites and Installation

### Prerequisites
* Python 3.10 or higher installed on your machine.
* Git.

### Step 1: Navigate to the backend directory
```bash
cd backend
```

### Step 2: Create a virtual environment
* **Windows (PowerShell):**
  ```powershell
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  ```
* **macOS / Linux:**
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  ```

### Step 3: Install dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 6. Environment Configuration (`.env.example`)

Copy `.env.example` to create `.env`:
```bash
cp .env.example .env
```

| Variable | Default Value | Description |
|---|---|---|
| `ENVIRONMENT` | `development` | Deployment environment (`development`, `production`, `test`) |
| `HOST` | `0.0.0.0` | Bind address for Uvicorn |
| `PORT` | `8000` | Port for FastAPI server |
| `LOG_LEVEL` | `INFO` | Python logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `ELEXON_API_BASE_URL` | `https://data.elexon.co.uk/bmrs/api/v1` | Base URL for Elexon BMRS Insights API |
| `FUELHH_STREAM_URL` | `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream` | Stream endpoint for actual generation outturn |
| `WINDFOR_STREAM_URL` | `https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream` | Stream endpoint for wind generation forecasts |
| `DEFAULT_START_DATE` | `2026-01-01` | Default delivery start date for January 2026 scope |
| `DEFAULT_END_DATE` | `2026-01-31` | Default delivery end date for January 2026 scope |
| `DEFAULT_DAY_AHEAD_CUTOFF_HOUR` | `12` | Day-Ahead gate closure hour in UTC (12 = 12:00:00 UTC D-1) |
| `HTTP_TIMEOUT_SECONDS` | `30.0` | Timeout in seconds for upstream Elexon API requests |
| `MAX_RETRIES` | `3` | Maximum retry attempts for transient network or 5xx failures |
| `RETRY_BACKOFF_FACTOR` | `0.5` | Exponential backoff factor (delay = factor * 2^(attempt-1)) |
| `CORS_ORIGINS` | `["http://localhost:3000","http://localhost:5173"]` | Allowed CORS origins for future React frontend |

---

## 7. Running and Testing the Backend

### Start the Local Development Server
From the `backend` directory:
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Or directly using Python:
```bash
python -m app.main
```

The server starts on `http://127.0.0.1:8000`.
* **Interactive Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **ReDoc Documentation:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
* **Health Check:** [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### Running Pytest Test Suite
Run the full test suite from the repository root or backend directory:
```bash
python -m pytest backend/tests -v
```

All 23 tests execute and validate:
* Parameter conflict prevention (Settlement Date vs Publish Date).
* Fuel type filtering (`fuelType = 'WIND'`).
* Transient network retries and bounded backoff.
* Decision cutoff selection (12:00 vs 17:00 UTC vs explicit datetime).
* Timestamp matching on delivery `startTime`.
* Deduplication of identical and revised records.
* Formula accuracy: Signed Error, Absolute Error, MAE, RMSE, MBE, MAPE.
* Handling of zero actual generation (excluded from MAPE, counted accurately).
* Graceful handling of missing values (never fabricated or replaced with zero).
* Empty dataset resilience.

---

## 8. Forecast Selection Logic & Metric Formulas

### 8.1 The Decision Cutoff Selection Rule
For electricity delivery on calendar date $D$ starting at half-hour $T$, National Grid ESO issues multiple forecast updates over preceding days and hours.

For Day-Ahead wholesale market decisions:
1. The **Day-Ahead gate closure cutoff** is configured at hour $H$ (default: `12:00:00 UTC`) on day $D - 1$.
   $$\text{Cutoff}(D) = \text{datetime}(D - 1\text{ day}, \text{hour}=12, \text{minute}=0, \text{second}=0, \text{tz}=\text{UTC})$$
2. For each delivery period `startTime`, the engine queries all forecast candidates $C$:
   $$\text{Eligible Candidates} = \{ c \in C \mid c.\text{publishTime} \le \text{Cutoff} \}$$
3. The selected forecast is the **latest** eligible revision:
   $$c^* = \operatorname{argmax}_{c \in \text{Eligible}} (c.\text{publishTime})$$
4. If no forecast was published at or before the cutoff, the forecast is treated as **missing** (`None`). Data is **never fabricated**.

Alternatively, traders can specify:
* An explicit global cutoff datetime (e.g. `2026-01-15T11:00:00Z`).
* A rolling lead time (e.g. `lead_time_hours=24.0`, requiring forecasts published $\ge$ 24 hours prior to delivery).

### 8.2 Metric Formulas

| Metric | Formula | Procurement Trading Meaning |
|---|---|---|
| **Signed Error ($e_i$)** | $Forecast_i - Actual_i$ | Positive = Over-forecast (utility overbought). Negative = Under-forecast (utility underbought). |
| **Absolute Error ($|e_i|$)** | $|Forecast_i - Actual_i|$ | Volume of MW volume deviation regardless of direction. |
| **MAE** | $\frac{1}{n} \sum_{i=1}^n \|Forecast_i - Actual_i\|$ | Average half-hourly magnitude of MW imbalance risk. |
| **RMSE** | $\sqrt{\frac{1}{n} \sum_{i=1}^n (Forecast_i - Actual_i)^2}$ | Penalizes large forecasting errors heavily (crucial for extreme spike risk). |
| **MBE (Bias)** | $\frac{1}{n} \sum_{i=1}^n (Forecast_i - Actual_i)$ | Systematic over-prediction ($MBE > 0$) or under-prediction ($MBE < 0$). |
| **MAPE (%)** | $100 \times \frac{1}{m} \sum_{j \in \text{Valid}} \left\|\frac{Forecast_j - Actual_j}{Actual_j}\right\|$ | Percentage error relative to actual. **Strictly excludes $Actual \le 0$** and reports `excluded_zero_actual_count`. |

---

## 9. API Endpoints Reference

### 1. `GET /api/health`
Checks backend responsiveness and tests connectivity to Elexon stream endpoints.
* **Sample Response:**
```json
{
  "status": "healthy",
  "service": "UK Wind Forecast Analysis API",
  "version": "1.0.0",
  "timestamp": "2026-10-27T14:35:00Z",
  "elexon_connectivity": {
    "FUELHH": "available",
    "WINDFOR": "available"
  }
}
```

---

### 2. `GET /api/forecasts`
Returns half-hourly records for the requested date window with matched forecasts, actuals, and period-level errors.

* **Query Parameters:**
  * `start_date` *(string, optional)*: Default `2026-01-01`
  * `end_date` *(string, optional)*: Default `2026-01-31`
  * `decision_cutoff` *(string, optional)*: ISO 8601 UTC timestamp cutoff
  * `day_ahead_cutoff_hour` *(integer, optional)*: Day-ahead gate closure hour (0-23, default `12`)
  * `lead_time_hours` *(float, optional)*: Rolling lead time in hours

* **Sample Request:**
```http
GET /api/forecasts?start_date=2026-01-01&end_date=2026-01-02&day_ahead_cutoff_hour=12
```

* **Sample Response:**
```json
{
  "records": [
    {
      "start_time": "2026-01-01T00:00:00Z",
      "end_time": "2026-01-01T00:30:00Z",
      "settlement_date": "2026-01-01",
      "settlement_period": 1,
      "forecast_mw": 19563.0,
      "forecast_publish_time": "2025-12-31T11:30:00Z",
      "forecast_candidates_count": 24,
      "actual_mw": 13756.0,
      "actual_publish_time": "2026-01-01T00:30:00Z",
      "signed_error_mw": 5807.0,
      "absolute_error_mw": 5807.0,
      "percentage_error": 42.21,
      "decision_cutoff_used": "2025-12-31T12:00:00Z",
      "has_missing_data": false
    }
  ],
  "total_records": 96,
  "matched_records": 48,
  "missing_forecast_count": 48,
  "missing_actual_count": 0,
  "date_range": {
    "start_date": "2026-01-01",
    "end_date": "2026-01-02",
    "decision_cutoff_mode": "day_ahead_hour",
    "decision_cutoff_value": "12:00 UTC D-1"
  }
}
```

---

### 3. `GET /api/forecasts/{start_time}`
Returns comprehensive forecast analysis and the full chronological revision history for a single delivery period.

* **Path Parameter:**
  * `start_time` *(string)*: ISO 8601 UTC delivery timestamp (e.g., `2026-01-01T00:00:00Z`)

* **Sample Request:**
```http
GET /api/forecasts/2026-01-01T00:00:00Z?day_ahead_cutoff_hour=12
```

* **Sample Response:**
```json
{
  "start_time": "2026-01-01T00:00:00Z",
  "end_time": "2026-01-01T00:30:00Z",
  "settlement_date": "2026-01-01",
  "settlement_period": 1,
  "selected_forecast_mw": 19563.0,
  "selected_forecast_publish_time": "2025-12-31T11:30:00Z",
  "decision_cutoff_used": "2025-12-31T12:00:00Z",
  "actual_mw": 13756.0,
  "actual_publish_time": "2026-01-01T00:30:00Z",
  "signed_error_mw": 5807.0,
  "absolute_error_mw": 5807.0,
  "percentage_error": 42.21,
  "all_forecast_revisions": [
    {
      "publish_time": "2025-12-30T02:30:00Z",
      "generation_mw": 19028.0,
      "is_eligible": true,
      "lead_time_hours": 45.5
    },
    {
      "publish_time": "2025-12-31T11:30:00Z",
      "generation_mw": 19563.0,
      "is_eligible": true,
      "lead_time_hours": 12.5
    },
    {
      "publish_time": "2025-12-31T17:30:00Z",
      "generation_mw": 19410.0,
      "is_eligible": false,
      "lead_time_hours": 6.5
    }
  ],
  "notes": "Evaluated against decision cutoff 2025-12-31T12:00:00+00:00. 24 total forecast revisions published for this period."
}
```

---

### 4. `GET /api/analytics`
Calculates aggregated accuracy metrics, distribution percentiles, daily breakdown, and diurnal breakdown.

* **Sample Request:**
```http
GET /api/analytics?start_date=2026-01-01&end_date=2026-01-02&day_ahead_cutoff_hour=12
```

* **Sample Response:**
```json
{
  "summary": {
    "total_delivery_periods": 96,
    "matched_periods_count": 48,
    "missing_actual_count": 0,
    "missing_forecast_count": 48,
    "excluded_zero_actual_count": 0,
    "mae": 3750.79,
    "rmse": 3836.43,
    "mbe": 3750.79,
    "mape": 24.72,
    "min_signed_error_mw": 1847.0,
    "max_signed_error_mw": 5807.0,
    "total_actual_generation_mwh": 732985.0,
    "total_forecast_generation_mwh": 456797.5,
    "error_std_dev": 814.62,
    "percentiles": {
      "p10": 2824.4,
      "p25": 3242.75,
      "p50": 3767.5,
      "p75": 4104.0,
      "p90": 4711.2
    }
  },
  "daily_breakdown": [
    {
      "date": "2026-01-01",
      "total_periods": 48,
      "matched_periods": 48,
      "mae": 3750.79,
      "rmse": 3836.43,
      "mbe": 3750.79,
      "mape": 24.72,
      "excluded_zero_actual_count": 0,
      "total_actual_mwh": 732985.0,
      "total_forecast_mwh": 456797.5
    }
  ],
  "diurnal_breakdown": [
    {
      "settlement_period": 1,
      "matched_count": 1,
      "mae": 5807.0,
      "rmse": 5807.0,
      "mbe": 5807.0
    }
  ],
  "parameters_used": {
    "start_date": "2026-01-01",
    "end_date": "2026-01-02",
    "decision_cutoff": "None",
    "day_ahead_cutoff_hour": "12",
    "lead_time_hours": "None"
  }
}
```

---

## 10. Error Handling, Edge Cases & Limitations

### 1. Elexon Filter Conflict Resolution
* The Elexon `FUELHH` stream enforces strict mutual exclusivity: **`settlementDate` parameters and `publishDateTime` parameters cannot be provided simultaneously**.
* Providing both causes a 400 Bad Request error.
* `ElexonClient` explicitly validates query arguments before executing requests and raises `ElexonParameterConflictError` if mutually exclusive parameters are supplied.

### 2. Missing Data Integrity
* Missing actual or forecast values are **never treated as zero** and never fabricated.
* If a forecast was not published prior to cutoff, `forecast_mw` remains `null`.
* Period-level signed and absolute errors are computed **only when both forecast and actual are present**.

### 3. Zero Actual Generation
* During calm periods or curtailment, actual generation may drop to `0.0 MW`.
* Dividing by zero in MAPE yields undefined / infinite values.
* The calculation engine detects zero or negative actual generation, excludes those periods from the MAPE average, and reports `excluded_zero_actual_count`.

### 4. Duplicate Records
* Elexon streams can contain duplicate records for the same delivery period or multiple updates within a settlement window.
* Actuals are deduplicated on `startTime` keeping the latest published revision.
* Forecasts are deduplicated on `(startTime, publishTime)`.

### 5. Resilient Retries & Timeouts
* HTTP requests enforce a 30-second timeout.
* Transient errors (`502`, `503`, `504`, `429`, or connection resets) trigger bounded exponential backoff retries (up to 3 attempts).
* Client errors (`400`, `404`) fail fast without wasting retry cycles.

---

## 11. Connecting to a Future React Frontend

The backend is configured out of the box for frontend consumption:

### CORS Configuration
CORS middleware in `app/main.py` permits requests from common React development servers (`http://localhost:3000`, `http://localhost:5173`). Additional origins can be configured in `.env` via `CORS_ORIGINS`.

### TypeScript Interfaces for Frontend
```typescript
export interface MatchedPeriodRecord {
  start_time: string;
  end_time: string;
  settlement_date: string;
  settlement_period: number;
  forecast_mw: number | null;
  forecast_publish_time: string | null;
  forecast_candidates_count: number;
  actual_mw: number | null;
  actual_publish_time: string | null;
  signed_error_mw: number | null;
  absolute_error_mw: number | null;
  percentage_error: number | null;
  decision_cutoff_used: string | null;
  has_missing_data: boolean;
}

export interface AnalyticsSummary {
  total_delivery_periods: number;
  matched_periods_count: number;
  missing_actual_count: number;
  missing_forecast_count: number;
  excluded_zero_actual_count: number;
  mae: number | null;
  rmse: number | null;
  mbe: number | null;
  mape: number | null;
  min_signed_error_mw: number | null;
  max_signed_error_mw: number | null;
  total_actual_generation_mwh: number | null;
  total_forecast_generation_mwh: number | null;
  error_std_dev: number | null;
  percentiles: Record<string, number> | null;
}
```

### Sample React API Service Call
```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

export async function fetchJanuaryAnalytics(dayAheadHour: number = 12) {
  const response = await axios.get(`${API_BASE}/analytics`, {
    params: {
      start_date: '2026-01-01',
      end_date: '2026-01-31',
      day_ahead_cutoff_hour: dayAheadHour,
    },
  });
  return response.data;
}
```

---

## 12. AI Tools Documentation

In compliance with the assignment instructions, the following AI tools and workflows were utilized during engineering:
* **Tool:** Antigravity AI Coding Assistant (powered by Google DeepMind Gemini model).
* **Usage Scope:**
  * Live schema verification and parameter discovery of Elexon BMRS `FUELHH/stream` and `WINDFOR/stream` endpoints.
  * Identification and programmatic handling of the `settlementDate` vs `publishDateTime` filter exclusivity constraint.
  * Vectorized formula implementation (Signed Error, Absolute Error, MAE, RMSE, MBE, MAPE with zero exclusion).
  * Design of modular FastAPI architecture, Pydantic v2 schemas, and 23 Pytest unit/integration test cases.
  * Verification of live January 2026 UK wind data and revision history structures.
