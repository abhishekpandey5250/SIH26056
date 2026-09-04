# Scraper Team JSON Ingestion Guide
## SIH26056: Real-Time Airfare Price Index for India

This guide explains how to import and validate scraped airline fare observation batches produced by the web scraping team.

---

### 1. Quick Commands

#### Option A: Ingest Complete Scraped Data Directory
To ingest all JSON files from the `scraped_data/` folder (across all lead-time subfolders `T+0`, `T+1`, `T+7`, `T+15`, `T+30`, `T+45`):

```bash
# From project root:
node backend/scripts/importScraperJSON.js scraped_data --mode=REAL

# Or from backend directory:
npm run import:scraped
```

#### Option B: Ingest Specific Lead-Time Subdirectory
```bash
node backend/scripts/importScraperJSON.js scraped_data/T+1 --mode=REAL
```

#### Option C: Ingest Individual Route File
```bash
node backend/scripts/importScraperJSON.js scraped_data/T+1/DEL_BOM.json --mode=REAL
```

---

### 2. Expected JSON Format

The importer accepts a JSON file with an `observations` array (or a top-level array of observation objects):

```json
{
  "observations": [
    {
      "source": "Air India",
      "scraped_at": "2026-09-04T08:00:00.000Z",
      "origin": "DEL",
      "destination": "BLR",
      "departure_date": "2026-09-11",
      "return_date": null,
      "trip_type": "one-way",
      "cabin_class": "economy",
      "passengers": 1,
      "airline": "Air India",
      "flight_number": "AI-2803",
      "departure_time": "06:30",
      "arrival_time": "09:25",
      "duration": "2 hr 55 min",
      "duration_minutes": 175,
      "stops": 0,
      "price": 8883,
      "currency": "INR",
      "price_raw": "₹8,883",
      "search_url": "https://www.airindia.com/booking",
      "co2_emissions": "143 kg CO2"
    }
  ]
}
```

---

### 3. Canonical 20-Route Production Basket & Direction Mapping

The importer validates each observation against the canonical **20-route production basket**.

#### Bidirectional Route Mapping
Reverse flight directions automatically map to the same canonical `routeId`:
- `DEL -> BOM` and `BOM -> DEL` $\longrightarrow$ `DEL-BOM`
- `DEL -> BLR` and `BLR -> DEL` $\longrightarrow$ `DEL-BLR`
- `GOX` (Goa Mopa) aliases to the `GOI` corridor.

#### The 20 Production Corridors & Authoritative Weights:
1. `DEL-BOM` (Delhi – Mumbai) = 0.13
2. `DEL-BLR` (Delhi – Bengaluru) = 0.09
3. `BOM-BLR` (Mumbai – Bengaluru) = 0.08
4. `DEL-HYD` (Delhi – Hyderabad) = 0.06
5. `BOM-GOI` (Mumbai – Goa) = 0.05
6. `DEL-CCU` (Delhi – Kolkata) = 0.05
7. `BLR-HYD` (Bengaluru – Hyderabad) = 0.04
8. `DEL-MAA` (Delhi – Chennai) = 0.05
9. `DEL-AMD` (Delhi – Ahmedabad) = 0.05
10. `BOM-HYD` (Mumbai – Hyderabad) = 0.04
11. `BOM-MAA` (Mumbai – Chennai) = 0.04
12. `BLR-MAA` (Bengaluru – Chennai) = 0.03
13. `DEL-PNQ` (Delhi – Pune) = 0.06
14. `BOM-CCU` (Mumbai – Kolkata) = 0.04
15. `BLR-GOI` (Bengaluru – Goa) = 0.03
16. `HYD-MAA` (Hyderabad – Chennai) = 0.03
17. `DEL-GOI` (Delhi – Goa) = 0.05
18. `BOM-AMD` (Mumbai – Ahmedabad) = 0.04
19. `BLR-CCU` (Bengaluru – Kolkata) = 0.04
20. `BLR-COK` (Bengaluru – Kochi) = 0.03

---

### 4. Quality & Statistical Guardrails

1. **Strict Environment Tagging**: All imported records are tagged with `dataEnvironment: "REAL"`.
2. **Zero Price Fabrication**: If a fare price is missing or null, it is **never** converted to ₹0 and never fabricated. It is stored for auditability and flagged as ineligible for index aggregation.
3. **Idempotency & Deduplication**: Every observation is assigned a deterministic SHA-256 flight hash:
   $$\text{Hash} = \text{SHA256}(\text{source} \mid \text{origin} \mid \text{destination} \mid \text{departure\_date} \mid \text{airline} \mid \text{flight\_number} \mid \text{departure\_time} \mid \text{price} \mid \text{scraped\_at} \mid \text{dataEnvironment})$$
   Re-running the same JSON file skips duplicate records without creating duplicate rows in the database.
4. **End-to-End Pipeline Execution**: Once ingested, the importer automatically initiates `DailyRouteAggregationService` and `AirfareIndexService` across all advance-purchase horizons ($T+1, T+7, T+15, T+30, T+45$) for each collection date in the batch.

---

### 5. Ingestion Output Summary Example

```text
================================================================================
 SIH26056: SCRAPER JSON INGESTION & PIPELINE RUNNER
================================================================================
Source File:       ../data/scraper_batch.json
Data Environment:  REAL
Database Status:   Connected

--------------------------------------------------------------------------------
✅ INGESTION & TRIAGE SUMMARY
--------------------------------------------------------------------------------
• Total Observations Received:    150
• Accepted for 20-Route Basket:   142
• Successfully Stored (DB):       138
• Exact Duplicates Skipped:       4
• Malformed / Rejected:           0
• Index-Eligible Observations:    126
• Flagged Observations:           16

📊 Triage Breakdown:
  - Invalid / Non-Basket Routes:  8
  - International Routes:         2
  - Invalid / Missing Prices:     4
  - Non-INR / Unknown Currency:   2
  - Round-Trip Quotes:            6
  - Missing Flight Numbers:       12

📅 Date Ranges:
  - Scraped At Range:             2026-09-04 ➔ 2026-09-04
  - Departure Date Range:         2026-09-05 ➔ 2026-10-19

✈️  20-Route Production Basket Coverage:
  - Corridors Represented:        18 / 20
  - Route Observation Counts:
    * DEL-BOM : 32 observations
    * DEL-BLR : 26 observations
    * BOM-BLR : 18 observations
    * DEL-HYD : 14 observations
    ...

⚡ Pipeline Execution Runs:
  - Date: 2026-09-04 | Routes: 18 | Buckets: 5 | Coverage: 94.2%
--------------------------------------------------------------------------------
```
