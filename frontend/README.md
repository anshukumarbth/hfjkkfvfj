# Wind Intelligence — UK Wind Generation Forecast Dashboard

A responsive single-page analytics dashboard for UK electricity wholesale market procurement, built with **React**, **Vite**, **TypeScript**, **Tailwind CSS**, **Motion for React**, **Lucide Icons**, **Recharts**, and **Axios**.

Designed for power trading desks and risk analysts in Great Britain, this dashboard visualizes Day-Ahead wind generation forecasts against actual outturn (`FUELHH` and `WINDFOR` datasets from Elexon BMRS), applies gate closure decision cutoffs, monitors procurement uncertainty, and evaluates accuracy metrics for **January 2026**.

---

## Table of Contents
1. [Key Features](#1-key-features)
2. [Technology Stack](#2-technology-stack)
3. [Component Architecture](#3-component-architecture)
4. [Folder and File Structure](#4-folder-and-file-structure)
5. [Prerequisites](#5-prerequisites)
6. [Installation & Setup](#6-installation--setup)
7. [Environment Variable Configuration](#7-environment-variable-configuration)
8. [Connecting to the FastAPI Backend](#8-connecting-to-the-fastapi-backend)
9. [Running Locally](#9-running-locally)
10. [Backend Fetching Page Loader & Error States](#10-backend-fetching-page-loader--error-states)
11. [Production Build & Preview](#11-production-build--preview)
12. [Vercel Deployment Guide](#12-vercel-deployment-guide)
13. [Accessibility & Reduced Motion](#13-accessibility--reduced-motion)
14. [Troubleshooting Guide](#14-troubleshooting-guide)

---

## 1. Key Features

* **Real-Time BMRS Ingestion & Health Monitoring:** Live status badge verifying connectivity with the FastAPI backend and upstream Elexon BMRS stream endpoints.
* **Core Accuracy KPI Cards:** Mean Absolute Error (MAE), Root Mean Square Error (RMSE), Mean Bias Error (MBE), and Mean Absolute Percentage Error (MAPE) with financial trading tooltips and zero-actual exclusion tracking.
* **Interactive Generation Profile (Recharts):** High-performance dual-line chart comparing eligible wind forecasts against outturn actual generation, featuring custom glassmorphic tooltips, MW axis formatting, and date filters.
* **Signed Error Trajectory ($Forecast - Actual$):** Distinctly color-coded bar chart revealing overforecasting (cyan surplus) versus underforecasting (amber shortfall risk) across half-hourly settlement intervals.
* **Detailed Half-Hourly Settlement Table:** Searchable, sortable, and paginated table detailing delivery timestamps in UTC, publication times, forecast vs. actual MW, signed error, and MAPE.
* **Interactive Forecast Evolution Modal:** Click any settlement period row to inspect its entire chronological forecast revision trajectory (all forecasts published leading up to gate closure with lead times and eligibility flags).
* **Trading Decision Cutoff Selector:** Switch gate closure cutoffs on the fly (11:00 UTC EPEX, 12:00 UTC Day-Ahead Standard, 17:00 UTC Evening Update).
* **Enterprise Page Loader:** Full-screen initial loading screen featuring animated turbine graphics, elapsed time counter, rotating status updates, configurable timeout, and a one-click simulated demo mode if the backend is temporarily offline.

---

## 2. Technology Stack

* **Framework & Build Tool:** [React 18](https://react.dev/) with [Vite 6](https://vitejs.dev/)
* **Language:** [TypeScript 5.7](https://www.typescriptlang.org/) (Strict mode)
* **Styling & Theme:** [Tailwind CSS 3.4](https://tailwindcss.com/) with dark navy palette (`#070b14` canvas, `#0d1527` panels, cyan/electric/emerald accents)
* **Animations:** [Motion for React](https://motion.dev/) (`motion` package)
* **Data Visualization:** [Recharts 2.15](https://recharts.org/) (ResponsiveContainer, LineChart, BarChart)
* **Iconography:** [Lucide React](https://lucide.dev/)
* **HTTP Client:** [Axios 1.7](https://axios-http.com/)

---

## 3. Component Architecture

```
App
├── PageLoader (Full-screen overlay on initial load with elapsed timer & retry)
├── Sidebar (Collapsible navigation with active section highlighting)
└── Main Content Canvas
    ├── Header (Period badges, stream status, last updated, quick date filters, cutoff dropdown)
    ├── KPI Cards Section (MetricCard: MAE, RMSE, MBE, MAPE with trading tooltips)
    ├── Main Forecast Line Chart (ForecastChart: Forecast MW vs Actual MW)
    ├── Forecast Accuracy Analysis (ErrorChart: Signed Error trajectory, Over/Under breakdown)
    ├── Detailed Settlement Table (ForecastTable: Search, sort, pagination, click-to-modal)
    ├── Data Quality & Energy Totals (DataStatus: Stream health, matched intervals, MWh totals)
    ├── Trading Settings (Cutoff configurations & backend endpoint status)
    ├── ForecastDetailModal (Single-period forecast evolution & revision timeline)
    └── Footer (Elexon BMRS API attribution)
```

---

## 4. Folder and File Structure

```
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # Collapsible navigation sidebar
│   │   │   └── Header.tsx            # Top bar: status, filters, cutoff selector
│   │   ├── dashboard/
│   │   │   ├── MetricCard.tsx        # KPI cards (MAE, RMSE, MBE, MAPE) with tooltips
│   │   │   ├── ForecastChart.tsx     # Recharts Forecast vs Actual generation line chart
│   │   │   ├── ErrorChart.tsx        # Signed error bar chart & over/underforecasting analysis
│   │   │   ├── ForecastTable.tsx     # Half-hourly settlement records table with pagination
│   │   │   ├── ForecastDetailModal.tsx # Period revision evolution inspection modal
│   │   │   └── DataStatus.tsx        # Elexon stream quality and total energy delivered
│   │   └── ui/
│   │       ├── PageLoader.tsx        # Full-page initial loader with elapsed timer & retry
│   │       └── SectionSkeleton.tsx   # Shimmer skeletons for background refreshes
│   ├── services/
│   │   └── api.ts                    # Centralized Axios client with error handling & demo fallback
│   ├── hooks/
│   │   └── useForecastData.ts        # Custom hook: filters, state, timers, request cancellation
│   ├── types/
│   │   └── forecast.ts               # TypeScript interfaces matching backend Pydantic schemas
│   ├── utils/
│   │   └── formatters.ts             # Formatters for MW, MWh, percentages, and UTC timestamps
│   ├── App.tsx                       # Single-page dashboard assembly
│   ├── main.tsx                      # React root rendering
│   ├── vite-env.d.ts                 # Vite environment definitions
│   └── index.css                     # Tailwind directives, custom scrollbars & glassmorphism
├── .env.example                      # Template environment variable
├── .env                              # Active local environment
├── .gitignore
├── index.html                        # Application HTML shell with dark theme
├── package.json                      # Dependencies and build scripts
├── postcss.config.js                 # PostCSS configuration
├── tailwind.config.js                # Tailwind CSS palette and glow configurations
├── tsconfig.json                     # TypeScript compiler configuration
├── tsconfig.node.json                # Vite config TS options
├── vite.config.ts                    # Vite build configuration with @ alias
└── README.md                         # Frontend documentation
```

---

## 5. Prerequisites

* **Node.js:** v18.0.0 or higher (Tested on Node.js v24)
* **npm:** v9.0.0 or higher (Tested on npm v11)
* **Python 3.10+** (to run the companion FastAPI backend)

---

## 6. Installation & Setup

Navigate into the `frontend` directory:
```bash
cd frontend
```

Install dependencies:
```bash
npm install
```

---

## 7. Environment Variable Configuration

Create your local `.env` file from `.env.example`:
```bash
cp .env.example .env
```

Ensure `.env` contains:
```env
# URL of your local or remote FastAPI backend service
VITE_API_BASE_URL=http://127.0.0.1:8000
```

> [!NOTE]
> All Vite environment variables must begin with `VITE_` to be exposed to client-side code.

---

## 8. Connecting to the FastAPI Backend

The frontend communicates with the companion FastAPI backend running locally on `http://127.0.0.1:8000`.

### Endpoints Consumed
* `GET /api/health`: Verifies backend availability and upstream Elexon stream responsiveness.
* `GET /api/forecasts`: Queries matched half-hourly periods (`start_date`, `end_date`, `day_ahead_cutoff_hour`).
* `GET /api/analytics`: Retrieves summary statistics (MAE, RMSE, MBE, MAPE, distribution percentiles).
* `GET /api/forecasts/{start_time}`: Retrieves all published forecast revisions and outturn for a single period.

### Start the Backend Server First
From the repository root:
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Verify the backend is live at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

---

## 9. Running Locally

Start the Vite development server:
```bash
npm run dev
```

Open your browser to:
```
http://127.0.0.1:5173/
```

The application automatically connects to `http://127.0.0.1:8000`, loads live Elexon data for January 2026, and renders the dashboard.

---

## 10. Backend Fetching Page Loader & Error States

### Initial Loading Experience
When you first open the dashboard:
1. `PageLoader` displays a full-screen glassmorphic overlay with an animated wind turbine graphic.
2. It tracks **actual elapsed loading time** in seconds using high-resolution timestamps.
3. Status messages cycle through:
   * *"Connecting to backend API..."*
   * *"Fetching wind generation forecasts from Elexon BMRS..."*
   * *"Applying Day-Ahead decision cutoffs..."*
   * *"Calculating MAE, RMSE, MBE & MAPE metrics..."*
4. When `Promise.all` resolves, the loader smoothly fades out with Motion for React.

### Background Refresh Experience
Subsequent filter changes or clicks on the **Refresh** button do *not* block the entire screen. Instead, individual sections display shimmering skeletons (`SectionSkeleton.tsx`), allowing seamless analysis.

### Graceful Fallbacks & Demo Mode
If the backend is not running:
* The loader displays a clear connection error message with target URL details.
* A **Retry Connection** button triggers a clean retry.
* An **Explore with Demo Data** button switches the dashboard into an explicitly labeled simulated demo mode, allowing full UI exploration without blocking the user.

---

## 11. Production Build & Preview

### Build the Production Bundle
```bash
npm run build
```
This runs TypeScript validation (`tsc`) followed by the Vite production bundler, producing optimized assets in `dist/`.

### Preview the Production Build Locally
```bash
npm run preview
```
Runs a local static server to preview the production build at `http://127.0.0.1:4173/`.

---

## 12. Vercel Deployment Guide

To deploy this frontend to [Vercel](https://vercel.com/):

### Option A: Using Vercel CLI
```bash
npm install -g vercel
vercel
```

### Option B: Using GitHub Integration
1. Push the repository to GitHub.
2. In the Vercel Dashboard, import the repository.
3. Set the **Root Directory** to `frontend`.
4. Configure the **Environment Variable**:
   * Key: `VITE_API_BASE_URL`
   * Value: URL of your deployed FastAPI backend (e.g., `https://wind-api.yourdomain.com`).
5. Click **Deploy**.

---

## 13. Accessibility & Reduced Motion

* **Reduced Motion:** All animations respect the user's `prefers-reduced-motion` operating system setting.
* **Keyboard Navigation:** All interactive cards, modal buttons, and table rows are fully accessible via keyboard (`Enter` / `Space`).
* **Color Contrast:** Deep navy background (`#070b14`) paired with high-contrast text (`#f1f5f9`) and tailored accent colors (Cyan `#06b6d4`, Emerald `#10b981`, Amber `#f59e0b`, Rose `#f43f5e`) exceed WCAG 2.1 AA contrast ratios.

---

## 14. Troubleshooting Guide

| Issue | Cause | Solution |
|---|---|---|
| **Loader displays "Unable to reach backend"** | The FastAPI backend is not running on port 8000 | Start the backend using `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` in the `backend/` directory. |
| **CORS Error in Browser Console** | Backend does not permit origin `http://127.0.0.1:5173` | Ensure `backend/.env` contains `CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]`. |
| **Chart shows empty state** | Selected date range has no records | Use the quick date pills in the header (e.g., *Jan 1–2* or *Full Month*). |
| **Missing values displayed as "N/A"** | Period has no actual or forecast published prior to cutoff | This is expected behavior. The engine strictly avoids fabricating data or treating missing values as zero. |
