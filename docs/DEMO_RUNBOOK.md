# SIH26056: Real-time Airfare Price Index for India
## Live Demonstration & Presentation Runbook

This runbook provides the exact step-by-step commands and procedures to run and demonstrate the entire **Real-time Airfare Price Index system** during Smart India Hackathon (SIH 2026) jury evaluation.

---

### 1. Presentation Day Quick Command Reference

#### A. STARTING THE PLATFORM
```bash
# Terminal 1: Start Backend (Port 5000)
cd backend
npm start

# Terminal 2: Start Frontend (Port 5173)
cd frontend
npm run dev
```
*Access the dashboard at `http://localhost:5173`.*

---

#### B. DEMO MODE (Deterministic Evaluator Dataset)
Runs the deterministic, verifiable demo dataset across all 6 corridors and all 5 advance-purchase windows:
```bash
# Seed demo dataset and execute complete statistical pipeline
cd backend
SEED_DEMO_DATA=true node scripts/seedDemoData.js
```

---

#### C. DGCA PASSENGER TRAFFIC BASKET IMPORT
Import verified DGCA passenger volume statistics to activate official traffic weighting:
```bash
# Import passenger traffic CSV
cd backend
node scripts/importDGCATraffic.js --file=./data/dgca_traffic_sample.csv --period=2026-Q1

# Or query active basket status via REST API:
curl http://localhost:5000/api/v1/basket
```

---

#### D. REAL SCRAPER INGESTION
Ingest real scraper observations from airlines and OTAs:
```bash
# Ingest live scraper payload batch using your configured scraper API key
curl -X POST http://localhost:5000/api/scraper/fares/batch \
  -H "Content-Type: application/json" \
  -H "X-SCRAPER-API-KEY: dev-scraper-key-12345" \
  -d '{
    "observations": [
      {
        "source": "Air India",
        "scraped_at": "2026-09-04T08:00:00.000Z",
        "origin": "DEL",
        "destination": "BLR",
        "departure_date": "2026-09-11",
        "airline": "Air India",
        "flight_number": "AI-2803",
        "price": 8883,
        "currency": "INR"
      }
    ]
  }'
```

---

#### E. AUTOMATED PIPELINE EXECUTION & STATUS
Executes end-to-end aggregation, weighting, and index calculation with execution audit logging:
```bash
# Trigger pipeline execution via REST API
curl -X POST http://localhost:5000/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{ "collectionDate": "2026-09-04", "dataEnvironment": "REAL" }'

# Check pipeline execution history & telemetry
curl http://localhost:5000/api/pipeline/history?dataEnvironment=REAL
```

---

#### F. DATA EXPORTS FOR NSO / RBI / RESEARCHERS
Stream auditable CSV and JSON datasets directly from the backend:
```bash
# Daily Airfare Index CSV
curl -O "http://localhost:5000/api/v1/export/index?freq=daily&leadTimeBucket=T+7&dataMode=DEMO&format=csv"

# Weekly ISO-8601 Airfare Index JSON
curl -O "http://localhost:5000/api/v1/export/index?freq=weekly&leadTimeBucket=T+7&dataMode=DEMO&format=json"

# Sector Heatmap CSV
curl -O "http://localhost:5000/api/v1/export/heatmap?leadTimeBucket=T+7&dataMode=DEMO&format=csv"

# Advance-Purchase Pricing Curve CSV
curl -O "http://localhost:5000/api/v1/export/lead-time?dataMode=DEMO&format=csv"
```

---

### 2. Live Demonstration Walkthrough for Judges

#### Stage 1: System Health & Zero Fake Data Transparency
1. Open the dashboard at `http://localhost:5173`.
2. Point to the **Mode Switcher** in the top navigation:
   - **`LIVE SCRAPER DATA`** (Emerald badge): Shows live real scraper data ingested from airlines. If no live data is present, the UI gracefully displays `N/A` without inventing fake numbers.
   - **`DEMO DATASET`** (Amber badge): Shows deterministic prototype evaluation dataset.
3. Show the **Backend & Database Connectivity indicator** (`Connected` / `Degraded In-Memory`).

#### Stage 2: Representative Route Basket & Traffic Weights
1. Point to the **"Representative Route Basket & Traffic Weights"** panel.
2. Explain the validation badge:
   - Displays `DGCA-VALIDATED` when official passenger traffic has been imported via `importDGCATraffic.js`.
   - Displays `PROVISIONAL / NOT DGCA-VALIDATED` with clear transparency note when baseline weighting is active.
3. Show that route weights sum exactly to $1.0000$ ($100.0\%$).

#### Stage 3: Ingest Scraper Batch & Show Fault-Tolerant Triage
1. Transmit a scraper batch (or run `SCRAPER_API_KEY="dev-scraper-key-12345" node scripts/simulateScraper.js`).
2. Refresh the dashboard:
   - Point out the **"Pipeline Status & Diagnostic Flow"** counter updating in real time.
   - Show the **Data Quality & Triage Panel** detailing valid observations vs disqualified records (e.g. international routes `DEL-DXB`, round-trips, null fares).
   - Point out that disqualified records are persisted with exclusion reasons for auditability but excluded from CPI calculations.

#### Stage 4: Advance-Purchase Window Comparison (T+1 to T+45) & Pricing Curve
1. Toggle between the lead-time tabs:
   - **`T+1`**: Immediate departure airfares (reflecting surge demand).
   - **`T+7`**: 1-week advance purchase benchmark (Index = 114.00, +14.0% vs Base).
   - **`T+15`, `T+30`, `T+45`**: Extended advance booking horizons.
2. Scroll to the **"Observed Fare by Advance-Purchase Window"** curve.
3. **Key Methodological Point for Judges**:
   *Explain that T+1 to T+45 represent observed empirical snapshots of prices quoted today for departures $N$ days ahead — NOT predictive machine learning forecasts.*

#### Stage 5: Sector-Wise Heatmap Matrix & Route Contribution
1. Scroll to **"Sector-Wise Airfare Heatmap Matrix"**.
2. Point out corridor-level median fares, price relatives vs base, and observation density.
3. Highlight **Dynamic Weight Renormalization**: If a route has zero observations, it is excluded (never assigned ₹0), and remaining route weights dynamically renormalize to sum to 100.0%.

#### Stage 6: 30-Day Backtesting & DGCA Validation Engine
1. Scroll to **"30-Day Historical Backtesting & DGCA Validation Engine"**.
2. Show the Pearson Correlation Coefficient ($r = 0.942$), Root Mean Square Error ($RMSE = 2.14$), and Mean Absolute Percentage Error ($MAPE = 1.68\%$).
3. Point out the clear disclaimer distinguishing empirical statistical alignment from predictive forecasting.

#### Stage 7: National Statistical Data Export Center & API v1
1. Scroll to **"National Statistical Data Export Center"**.
2. Click any export button (`CSV` / `JSON` for Daily, Weekly, Monthly, Heatmap, or Backtest) to demonstrate instant, server-generated download capability for NSO and RBI consumption.
3. Open `http://localhost:5000/api/v1/index/daily?leadTimeBucket=T+7&dataMode=DEMO` in a new tab to showcase the clean, versioned REST API.

---

### 3. API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Operational health and database connectivity |
| `GET` | `/api/v1/status` | System observability, triage metrics & Data Quality Index |
| `GET` | `/api/v1/basket` | Active route basket composition & DGCA traffic weights |
| `GET` | `/api/v1/index/daily` | Daily airfare price index series |
| `GET` | `/api/v1/index/weekly` | Weekly ISO-8601 calendar aggregated index series |
| `GET` | `/api/v1/index/monthly` | Monthly CPI-compatible airfare price index series |
| `GET` | `/api/v1/routes` | Route-level representative fare aggregations |
| `GET` | `/api/v1/analytics/heatmap` | Sector-wise price matrix & base differentials |
| `GET` | `/api/v1/analytics/lead-time` | Advance-purchase descriptive elasticity curve |
| `GET` | `/api/v1/export/index` | CSV/JSON streaming export of index series |
| `GET` | `/api/v1/export/heatmap` | CSV/JSON streaming export of sector heatmap |
| `GET` | `/api/v1/export/lead-time` | CSV/JSON streaming export of lead-time curve |
| `GET` | `/api/v1/export/backtest` | CSV/JSON streaming export of backtest metrics |
| `POST` | `/api/pipeline/run` | Tracked daily pipeline execution trigger |
| `GET` | `/api/pipeline/status` | Current pipeline execution state |
| `GET` | `/api/pipeline/history` | Audit log of previous pipeline execution runs |
| `POST` | `/api/scraper/fares/batch` | Scraper batch ingestion endpoint |
| `GET` | `/api/scraper/status` | Scraper ingestion metrics and error telemetry |

---

### 4. Troubleshooting Guide

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **Backend says "Degraded (DB Offline)"** | MongoDB is not running locally. | The backend automatically continues in degraded mode using in-memory calculations without crashing. To connect MongoDB: start local daemon or verify `MONGODB_URI` in `.env`. |
| **Frontend displays "N/A" for indices** | No pipeline run has occurred yet for the selected date/mode. | Run `SEED_DEMO_DATA=true node scripts/seedDemoData.js` or `node scripts/runDailyPipeline.js --date=2026-09-04 --mode=REAL`. |
| **Scraper receives 401 Unauthorized** | Missing or mismatched `X-SCRAPER-API-KEY`. | Set `X-SCRAPER-API-KEY: dev-scraper-key-12345` (or value matching `SCRAPER_API_KEY` in `.env`). |
| **Weight Basket says "PROVISIONAL"** | No DGCA passenger traffic file has been imported. | Run `node scripts/importDGCATraffic.js --file=./data/dgca_traffic_sample.csv --period=2026-Q1`. |
