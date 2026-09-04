# DGCA Official Data Ingestion & Conversion Guide
## Problem Statement: SIH26056 (Real-Time Airfare Price Index for India)

This guide documents the ingestion capabilities, accepted/rejected schemas, conversion utilities, and statistical guardrails for importing Directorate General of Civil Aviation (DGCA) domestic scheduled passenger traffic and tariff reference data into the SIH26056 platform.

---

### 1. Repository DGCA File Audit

| File Path | Description | Status |
| :--- | :--- | :--- |
| `data/dgca_reference.example.csv` | Template / example reference fare file formatted for testing daily backtest pipelines | **Example / Template** |
| Official Raw DGCA CSV / JSON | Public monthly scheduled domestic traffic or tariff monitoring reports | **Not Committed in Repo** (Must be imported by evaluator / operator via provided utilities) |

> [!NOTE]
> **Zero Fabricated Pre-Loaded Files**: The repository maintains strict scientific and data integrity. No artificial or fake DGCA files are shipped in production mode. Real DGCA reports downloaded from official portals (e.g., [dgca.gov.in](https://www.dgca.gov.in) or [data.gov.in](https://data.gov.in)) can be directly imported using the scripts below.

---

### 2. DGCA Data Importers & Converters Overview

The platform provides three specialized CLI scripts and service integrations:

```text
                                DGCA SOURCE DATA
                                       │
     ┌─────────────────────────────────┼─────────────────────────────────┐
     │ (Scheduled Traffic Volume)      │ (Unified Monthly Reports)       │ (Benchmark Daily Tariff)
     ▼                                 ▼                                 ▼
scripts/importDGCATraffic.js    scripts/convertDGCAReference.js    scripts/importDGCAData.js
     │                                 │                                 │
     ▼                                 ▼                                 ▼
   DGCATraffic Schema            Split & Validate             DGCAReferenceFare Schema
(Route Basket Weights $w_r$)     (Traffic + Fares)            (Historical Backtesting)
```

---

### 3. Importer 1: DGCA Domestic Passenger Traffic (`importDGCATraffic.js`)

Used to import official scheduled domestic passenger volume counts to compute Laspeyres representative basket weights ($w_r = \text{pax}_r / \sum \text{pax}_i$).

#### Accepted Column Headers & Aliases (CSV & JSON)

| Canonical Field | Accepted Aliases (Case-Insensitive) | Type | Required | Example |
| :--- | :--- | :--- | :--- | :--- |
| `period` | `month`, `year`, `time_period` | String | YES | `2026-08`, `2026-Q1`, `2025-2026` |
| `origin` | `from`, `city1`, `origin_airport` | String (IATA) | YES | `DEL`, `BOM`, `BLR` |
| `destination` | `dest`, `to`, `city2`, `destination_airport` | String (IATA) | YES | `BOM`, `MAA`, `HYD` |
| `passengers` | `pax`, `passenger_count`, `traffic`, `volume` | Positive Integer | YES | `185000` |
| `trafficType` | `traffictype`, `traffic_type` | String | NO (Default: `DOMESTIC_SCHEDULED`) | `DOMESTIC_SCHEDULED` |
| `source` | `source_agency`, `report` | String | NO (Default: `DGCA_CITY_PAIR_TRAFFIC`) | `DGCA_MONTHLY_TRAFFIC_AUG2026` |
| `datasetName` | `datasetname`, `dataset_name` | String | NO (Default: `DGCA_TRAFFIC_STATISTICS`) | `DGCA_SCHEDULED_DOMESTIC` |

#### Accepted Example (CSV)
```csv
period,origin,destination,passengers,source
2026-08,DEL,BOM,215400,DGCA_DOMESTIC_CITY_PAIR
2026-08,DEL,BLR,184300,DGCA_DOMESTIC_CITY_PAIR
2026-08,BOM,BLR,126800,DGCA_DOMESTIC_CITY_PAIR
```

#### Rejection Conditions
- Origin equals destination (e.g. `DEL-DEL`).
- Airport code is non-domestic or invalid (e.g. `DEL-DXB`, `DEL-LHR`).
- Passenger count is negative, zero, or non-numeric (e.g. `-50`, `0`, `N/A`).
- Missing origin, destination, or period.

#### CLI Command
```bash
cd backend
node scripts/importDGCATraffic.js ../data/dgca_traffic.csv --mode=REAL
```

---

### 4. Importer 2: DGCA Benchmark Reference Tariff (`importDGCAData.js`)

Used to import reference airfares for historical validation and backtesting.

#### Accepted Column Headers & Aliases (CSV & JSON)

| Canonical Field | Accepted Aliases (Case-Insensitive) | Type | Required | Description |
| :--- | :--- | :--- | :--- | :--- |
| `referenceDate` | `referencedate`, `reference_date`, `date` | `YYYY-MM-DD` | YES | Exact observation date |
| `origin` | `from`, `city1`, `origin_airport` | String (IATA) | YES | Domestic 3-letter IATA code |
| `destination` | `dest`, `to`, `city2`, `destination_airport` | String (IATA) | YES | Domestic 3-letter IATA code |
| `averageFare` | `average_fare`, `avg_fare`, `fare`, `price` | Number ($>0$) | YES | Benchmark fare in INR |
| `currency` | `curr` | String | NO | Must be `INR` |
| `source` | `source_agency`, `report` | String | NO | Source publication identifier |
| `month` | `reporting_month` | `YYYY-MM` | NO | Auto-derived from `referenceDate` |

#### Accepted Example (CSV)
```csv
reference_date,origin,destination,average_fare,currency,source
2026-08-01,DEL,BOM,4150,INR,DGCA_TARIFF_MONITORING
2026-08-01,DEL,BLR,5080,INR,DGCA_TARIFF_MONITORING
2026-08-02,DEL,BOM,4210,INR,DGCA_TARIFF_MONITORING
```

#### Rejection Conditions
- Date format is not `YYYY-MM-DD` (e.g., `01/08/2026`, `Aug 2026`).
- Average fare is $\le 0$ or non-numeric.
- Currency is specified as non-INR (e.g. `USD`).
- Origin or destination is invalid / international.

#### CLI Command
```bash
cd backend
node scripts/importDGCAData.js ../data/dgca_reference.csv --mode=REAL
```

---

### 5. Importer & Converter 3: Unified DGCA Route-Level Converter (`convertDGCAReference.js`)

Publicly available DGCA monthly reports frequently combine passenger traffic and average realized passenger yield/fare in a single summary table per corridor per month.

`convertDGCAReference.js` parses unified route-level datasets containing:
- `origin`
- `destination`
- `passengers`
- `average_purchase_fare`
- `period` / `month`
- `source`

#### Accepted Column Headers & Aliases

| Parameter | Accepted Column Names |
| :--- | :--- |
| **Origin** | `origin`, `from`, `city1`, `origin_airport`, `source_city`, `source_airport` |
| **Destination** | `destination`, `dest`, `to`, `city2`, `destination_airport`, `dest_city` |
| **Passengers** | `passengers`, `pax`, `passenger_count`, `traffic`, `total_passengers`, `volume` |
| **Average Fare** | `average_purchase_fare`, `avg_purchase_fare`, `average_fare`, `avg_fare`, `fare`, `price`, `tariff`, `yield` |
| **Period / Month** | `period`, `month`, `year_month`, `reporting_month`, `time_period`, `date`, `reference_date` |
| **Source** | `source`, `source_agency`, `report`, `dataset_name`, `dataset` |

#### Accepted Example (CSV)
```csv
period,origin,destination,passengers,average_purchase_fare,source
2026-08,DEL,BOM,215400,4350.00,DGCA_MONTHLY_REPORT_AUG2026
2026-08,DEL,BLR,184300,5200.00,DGCA_MONTHLY_REPORT_AUG2026
2026-08,BOM,BLR,126800,6100.00,DGCA_MONTHLY_REPORT_AUG2026
2026-08,DEL,CCU,112000,4800.00,DGCA_MONTHLY_REPORT_AUG2026
```

#### CLI Execution Modes
```bash
# Mode A: Convert and export standardized JSON datasets to a directory
node scripts/convertDGCAReference.js ../data/raw_dgca_summary.csv --output=../data/converted/ --mode=REAL

# Mode B: Convert and directly upsert into MongoDB collections (DGCATraffic & DGCAReferenceFare)
node scripts/convertDGCAReference.js ../data/raw_dgca_summary.csv --import --mode=REAL
```

---

### 6. Strict Statistical Guardrails & Methodological Integrity

> [!IMPORTANT]
> **1. Zero Fabrication of Missing Values**:
> If a row has valid passenger counts but no fare, it is ingested exclusively as a traffic observation for route weighting. If a row has a fare but no passenger count, it is ingested exclusively as a benchmark fare. If neither is valid, the row is rejected with an explicit error. Values are never hallucinated.

> [!WARNING]
> **2. Monthly DGCA Data Must Remain Monthly (No Synthetic Daily Expansion)**:
> If DGCA publishes a single monthly average fare (e.g. ₹4,350 for `2026-08`), the system **NEVER** fabricates 30 synthetic daily records (`2026-08-01`, `2026-08-02`, ...). Doing so would artificially manufacture high statistical correlation ($r$) and directional agreement where no daily high-frequency government data exists.

> [!CAUTION]
> **3. 30-Day Daily Backtesting vs Monthly Macroeconomic Alignment**:
> - **30-Day Daily Backtesting**: Requires daily scraper observations compared against daily benchmark reference observations.
> - **Monthly DGCA Data**: Used for monthly CPI index aggregation alignment (`/api/v1/index/monthly`) and passenger basket weighting (`RouteBasketService`).
> The system explicitly reports `readyFor30DayBacktest: false` if daily reference data is absent, preventing false validation claims.

> [!NOTE]
> **4. Data Environment Isolation**:
> All DGCA importers strictly write records with `dataEnvironment: "REAL"`. Live mode never reads or mixes DEMO records.

---

### 7. Rejection Diagnostic Matrix

| Input Scenario | Importer Response | Error Output Example |
| :--- | :--- | :--- |
| `DEL -> DXB` (International) | **REJECTED** | `Route DEL-DXB is not a valid Indian domestic route.` |
| `BOM -> BOM` (Identical) | **REJECTED** | `Origin and destination cannot be identical: BOM-BOM.` |
| `passengers: -500` (Negative) | **REJECTED** | `Invalid passengers count: "-500". Must be a positive integer.` |
| `fare: "FREE"` (Non-numeric) | **REJECTED** | `Invalid averageFare: "FREE". Must be a strictly positive number.` |
| `period: ""` (Missing) | **REJECTED** | `Missing or invalid period/month: "undefined".` |
| `currency: "USD"` | **REJECTED** | `Invalid currency "USD". DGCA benchmark must be in INR.` |
