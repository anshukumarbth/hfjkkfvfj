# UK Wind Generation Forecast Analysis — Full Stack Platform

A production-grade energy analytics platform designed for UK electricity utility trading and procurement desks operating in the **Great Britain Day-Ahead wholesale power market**.

This platform evaluates half-hourly wind generation forecasts (`WINDFOR`) against actual metered outturn (`FUELHH`) from the **Elexon BMRS Insights API**, enforces strict day-ahead decision cutoff rules, aligns settlement timestamps, calculates forecast error metrics (MAE, RMSE, MBE, MAPE, percentiles), and visualizes procurement risks across **January 2026**.

---

## Architecture Overview

```
                      ┌───────────────────────────────────────────────┐
                      │                 User Browser                  │
                      └───────────────┬───────────────────────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            │ Port 5173 (Host)                                  │ Port 8000 (Host)
            ▼                                                   ▼
┌───────────────────────────────┐                   ┌───────────────────────────────┐
│     gridbricks-frontend       │                   │      gridbricks-backend       │
│  (Nginx 1.27 + Vite React)    │                   │  (Python 3.11 + FastAPI ASGI) │
│                               │                   │                               │
│  • Static React SPA Assets    │                   │  • Elexon BMRS API Ingestion  │
│  • Poppins Light Theme        │                   │  • Decision Cutoff Engine     │
│  • Health Check: /healthz     │                   │  • Statistical Metrics Engine │
│  • Nginx Proxy: /api/*  ──────┼──(bridge network)─┼─►• Health Check: /api/health  │
└───────────────────────────────┘                   └───────────────┬───────────────┘
                                                                    │
                                                                    ▼ HTTPS
                                                    ┌───────────────────────────────┐
                                                    │   Elexon BMRS Insights API    │
                                                    │   • FUELHH (Actual Outturn)   │
                                                    │   • WINDFOR (Day-Ahead Fcst)  │
                                                    └───────────────────────────────┘
```

The system comprises two containerized services orchestrated via **Docker Compose**:

1. **`gridbricks-backend` (FastAPI + Python 3.11-slim):**
   - High-throughput asynchronous API ingesting live/historical BMRS data streams.
   - Enforces day-ahead decision cutoffs (e.g. 12:00 UTC day-ahead gate closure).
   - Computes statistical error and procurement risk metrics (MAE, RMSE, MBE, MAPE, P10–P90 percentiles).
   - Runs as a dedicated non-root user (`appuser:10001`) with automated Docker health checks.

2. **`gridbricks-frontend` (React 18 + Vite + Tailwind CSS + Alpine Nginx):**
   - Multi-stage build (Node.js 20 builder $\to$ Alpine Nginx 1.27 web server).
   - Light theme with Poppins typography, interactive Recharts graphs, and responsive tables.
   - Nginx handles gzip compression, asset caching, SPA routing, `/healthz` monitoring, and optional internal reverse proxying to `/api/`.

---

## Directory Structure

```
gridbricks/
├── docker-compose.yml             # Root multi-container orchestration definition
├── .dockerignore                  # Root Docker build ignore rules
├── .env.example                   # Master environment template for Compose
├── README.md                      # Master platform documentation (this file)
│
├── backend/                       # Python FastAPI Backend
│   ├── Dockerfile                 # Production Python 3.11-slim container
│   ├── .dockerignore              # Backend-specific ignore rules
│   ├── .env.example               # Backend standalone environment template
│   ├── requirements.txt           # Python dependencies (FastAPI, Pydantic, HTTPX, etc.)
│   ├── README.md                  # Comprehensive backend engineering documentation
│   ├── app/
│   │   ├── main.py                # FastAPI ASGI application & middleware
│   │   ├── api/routes.py          # API route definitions & dependency injection
│   │   ├── clients/elexon_client.py # Async HTTPX client for Elexon BMRS streams
│   │   ├── core/config.py         # Pydantic Settings & CORS configuration
│   │   ├── schemas/forecast.py    # Pydantic v2 validation models & responses
│   │   └── services/              # Ingestion, cutoff filtering, & analytics logic
│   └── tests/                     # 23 automated Pytest unit and integration tests
│
└── frontend/                      # React + Vite Frontend
    ├── Dockerfile                 # Multi-stage Dockerfile (Node.js 20 -> Nginx Alpine)
    ├── nginx.conf                 # Production Nginx server & reverse-proxy config
    ├── .dockerignore              # Frontend-specific ignore rules
    ├── .env.example               # Frontend standalone environment template
    ├── package.json               # Node.js dependencies & scripts
    ├── vite.config.ts             # Vite bundler configuration
    ├── tailwind.config.js         # Tailwind styling with Poppins font family
    ├── README.md                  # Comprehensive frontend UI/UX documentation
    └── src/                       # React components, services, and hooks
```

---

## Prerequisites

Before starting, ensure the following are installed on your host machine:

* **Docker Engine** (v24.0+) or **Docker Desktop** (v4.20+)
* **Docker Compose** (v2.20+) — verified via `docker compose version`
* Optional for local non-Docker development:
  * Python 3.10+
  * Node.js 20+ and npm 10+

---

## Quick Start (Docker Compose)

The easiest way to build, configure, and launch the entire stack is with Docker Compose:

### 1. Clone & Configure Environment
```bash
# Navigate to the project root
cd gridbricks

# Copy the master environment template (optional - default values are preconfigured)
cp .env.example .env
```

### 2. Build and Launch Containers
```bash
# Build images and start all services in detached mode
docker compose up -d --build
```

### 3. Verify Container Status
```bash
# Check service status and health checks
docker compose ps
```

You should see both containers running with status `healthy`:
```
NAME                  IMAGE                        COMMAND                  SERVICE    STATUS
gridbricks-backend    gridbricks-backend:latest    "uvicorn app.main:ap…"   backend    Up (healthy)
gridbricks-frontend   gridbricks-frontend:latest   "nginx -g 'daemon of…"   frontend   Up (healthy)
```

### 4. Access the Application
* **Frontend Web Dashboard:** [http://localhost:5173](http://localhost:5173)
* **Backend API Documentation (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
* **Backend Alternative Docs (ReDoc):** [http://localhost:8000/redoc](http://localhost:8000/redoc)
* **Backend Health Endpoint:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## Environment Variables Reference

All environment variables can be customized in the root `.env` file or overridden at runtime:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `FRONTEND_PORT` | `5173` | Host port mapped to the Nginx frontend container |
| `BACKEND_PORT` | `8000` | Host port mapped to the FastAPI backend container |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend API base URL baked into frontend SPA client |
| `ENVIRONMENT` | `production` | Backend runtime environment (`production` / `development`) |
| `LOG_LEVEL` | `INFO` | Backend logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `ELEXON_API_BASE_URL`| `https://data.elexon.co.uk/bmrs/api/v1` | Base URL for Elexon BMRS Insights API |
| `FUELHH_STREAM_URL` | `.../datasets/FUELHH/stream` | Stream endpoint for half-hourly actual wind generation |
| `WINDFOR_STREAM_URL` | `.../datasets/WINDFOR/stream` | Stream endpoint for day-ahead wind forecasts |
| `DEFAULT_START_DATE`| `2026-01-01` | Default start date for procurement analysis window |
| `DEFAULT_END_DATE` | `2026-01-31` | Default end date for procurement analysis window |
| `DEFAULT_DAY_AHEAD_CUTOFF_HOUR` | `12` | Cutoff hour in UTC (e.g. 12 = 12:00 UTC day-ahead gate closure) |
| `HTTP_TIMEOUT_SECONDS` | `30.0` | Timeout in seconds for upstream Elexon HTTP requests |
| `MAX_RETRIES` | `3` | Maximum automatic retries for transient upstream failures |
| `RETRY_BACKOFF_FACTOR` | `0.5` | Exponential backoff factor between upstream retries |
| `CORS_ORIGINS` | `["http://localhost:5173", ...]` | Allowed origins for cross-origin resource sharing |

---

## Verification & Health Monitoring

### 1. Validate Docker Compose Syntax
To validate the Compose configuration without launching containers:
```bash
docker compose config
```
This prints the resolved YAML schema with all substituted environment variables.

### 2. Service Health Checks
Both services implement automated Docker `HEALTHCHECK` instructions:

* **Backend Health Check:**
  * Container runs: `curl -f http://localhost:8000/api/health || exit 1`
  * Interval: every 30 seconds
  * Start period: 15 seconds grace period on initial startup
  * Host check:
    ```bash
    curl -s http://localhost:8000/api/health
    ```
    Expected output:
    ```json
    {
      "status": "healthy",
      "service": "UK Wind Forecast Analysis API",
      "version": "1.0.0",
      "timestamp": "...",
      "elexon_connectivity": {
        "fuelhh_stream": "reachable",
        "windfor_stream": "reachable"
      }
    }
    ```

* **Frontend Health Check:**
  * Container runs: `wget --no-verbose --tries=1 --spider http://localhost:80/healthz || exit 1`
  * Host check:
    ```bash
    curl -i http://localhost:5173/healthz
    ```
    Expected response: `HTTP/1.1 200 OK` with payload `OK`.

---

## Daily Operations & CLI Cheat Sheet

### View Container Logs
```bash
# Follow combined logs in real-time
docker compose logs -f

# Follow backend logs only
docker compose logs -f backend

# Follow frontend access & error logs
docker compose logs -f frontend

# Tail last 100 lines
docker compose logs --tail=100 backend
```

### Stopping & Restarting Services
```bash
# Stop containers without removing them
docker compose stop

# Start stopped containers
docker compose start

# Restart a specific service (e.g., after env variable change)
docker compose restart backend

# Stop containers and remove networks
docker compose down

# Stop containers, remove networks, and delete associated volumes
docker compose down -v
```

### Rebuilding Containers
```bash
# Rebuild without Docker cache (recommended after major dependency updates)
docker compose build --no-cache

# Rebuild and restart in one command
docker compose up -d --build
```

### Executing Commands Inside Containers
```bash
# Open interactive shell in backend container
docker compose exec -it backend /bin/bash

# Run backend test suite inside container
docker compose exec backend pytest

# Open interactive shell in frontend container
docker compose exec -it frontend /bin/sh

# Test Nginx configuration inside frontend container
docker compose exec frontend nginx -t
```

---

## Frontend-Backend Connectivity & CORS Architecture

### How Browser-to-Backend Communication Works
1. **Direct Communication (Default):**
   - The React SPA runs inside the user's browser client.
   - By default, API calls are dispatched to `http://localhost:8000` as defined by `VITE_API_BASE_URL`.
   - FastAPI's `CORSMiddleware` validates incoming `Origin` headers against `CORS_ORIGINS`.
   - Pre-flight `OPTIONS` requests and JSON responses are allowed seamlessly.

2. **Nginx Reverse-Proxy (Alternative Zero-CORS Setup):**
   - The frontend's `nginx.conf` includes a preconfigured reverse proxy rule:
     ```nginx
     location /api/ {
         proxy_pass http://backend:8000/api/;
     }
     ```
   - Setting `VITE_API_BASE_URL=/api` routes all API requests through Nginx port `5173`. Nginx proxies them to the backend container over the internal Docker network `gridbricks-network`, avoiding CORS altogether.

---

## Local Development (Without Docker)

For active feature development outside containers:

### 1. Run Python Backend
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Run backend unit and integration tests:
```bash
cd backend
python -m pytest
```
*(All 23 test cases cover Elexon ingestion, cutoff filtering, metric formulas, and API endpoints).*

### 2. Run React Frontend
```bash
cd frontend
npm install
npm run dev
```
Access the Vite development server at [http://127.0.0.1:5173](http://127.0.0.1:5173).

---

## Troubleshooting Guide

### 1. Port Already In Use (`bind: address already in use`)
* **Symptom:** Docker fails with `Bind for 0.0.0.0:8000 failed: port is already allocated` or `0.0.0.0:5173`.
* **Cause:** A local dev server (e.g. Uvicorn or Vite) is already running on the host.
* **Solution:**
  * Stop host processes, or
  * Change the host port mapping in `.env`:
    ```ini
    BACKEND_PORT=8001
    FRONTEND_PORT=5174
    ```
    Then restart with `docker compose up -d`.

### 2. Backend Container Shows `unhealthy`
* **Symptom:** `docker compose ps` reports `gridbricks-backend ... (unhealthy)`.
* **Diagnosis:** Inspect container logs:
  ```bash
  docker compose logs backend
  ```
* **Common Causes:**
  * Port mismatch: Verify `PORT=8000` is set in the backend environment.
  * Dependency error: Run `docker compose exec backend curl -v http://localhost:8000/api/health` to view the specific exception.

### 3. Frontend Shows `Connection Error` to Backend
* **Symptom:** Dashboard shows "Failed to fetch forecasts" or network connection errors.
* **Diagnosis:**
  * Check if backend is reachable from your browser: Open [http://localhost:8000/api/health](http://localhost:8000/api/health).
  * Check browser Developer Tools Console for CORS errors (`blocked by CORS policy`).
  * Ensure `CORS_ORIGINS` in `.env` includes the exact URL in your browser address bar (e.g., `"http://localhost:5173"`).

### 4. Elexon BMRS External Upstream Timeout
* **Symptom:** Backend logs show `ElexonTimeoutError` or `/api/health` reports `elexon_connectivity: unreachable`.
* **Cause:** Elexon BMRS API may be experiencing maintenance or temporary network latency.
* **Resolution:**
  * The backend automatically retries requests up to 3 times with exponential backoff.
  * Increase `HTTP_TIMEOUT_SECONDS=45.0` in `.env` if your external connection is high latency.

### 5. Clearing Stale Docker Cache
* **Symptom:** Changes to `nginx.conf` or `requirements.txt` are not reflected in new containers.
* **Solution:**
  ```bash
  docker compose down -v
  docker compose build --no-cache
  docker compose up -d
  ```

---

## License

Internal proprietary utility analytics platform. All rights reserved.
