# SIH26056: Real-time Airfare Price Index for India
## Web Scraper Team Integration Guide (v1.2)

Welcome to the **SIH26056 Airfare Price Index Backend Integration Guide**. This document provides everything the scraping engineering team needs to format, authenticate, validate, and transmit airfare crawl batches into the real-time index pipeline.

---

### 1. Practical End-to-End Data Flow

```
1. Scraper Crawlers Obtain Raw Airfare HTML/JSON
   │
   ▼
2. Scraper Transforms to Agreed Schema
   │ (origin, destination, departure_date, scraped_at, price, airline, flight_number, etc.)
   ▼
3. Scraper Transmits HTTP POST Request
   │ POST /api/scraper/fares/batch (Header: X-SCRAPER-API-KEY: YOUR_KEY)
   ▼
4. Backend Ingestion & Authentication
   │ Authenticates API key, validates request structure
   ▼
5. Normalization, Quality Triage & SHA-256 Deduplication
   │ Cleans values, flags anomalies, marks indexEligible, skips exact duplicates
   ▼
6. RawObservation Storage (MongoDB Atlas)
   │ Immutable audit trail tagged with dataEnvironment: "REAL"
   ▼
7. Daily Route Aggregation Engine
   │ Calculates representative median fares for T+1, T+7, T+15, T+30, T+45
   ▼
8. Statistical Laspeyres Index Engine
   │ Calculates fixed-weight price index with dynamic weight renormalization
   ▼
9. React Analytics Portal
   │ MoSPI real-time monitoring dashboard reads GET /api/index/latest and /history
```

---

### 2. Quick Integration Reference

- **Base URL (Local)**: `http://localhost:5000`
- **Ingestion Endpoint**: `POST /api/scraper/fares/batch`
- **Telemetry Endpoint**: `GET /api/scraper/status`
- **Readiness Diagnostic**: `GET /api/index/pipeline/status`
- **Pipeline Trigger**: `POST /api/index/pipeline`
- **Required Header**: `X-SCRAPER-API-KEY: YOUR_SCRAPER_API_KEY_HERE`
- **Content-Type**: `application/json`

---

### 3. Real Scraper Payload Example

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

### 4. Invalid / Problematic Records Handling

The backend is engineered to be **resilient to imperfect scraper data**. Incomplete records do not crash the batch:

| Problematic Condition | Backend Behavior | Resulting Status |
| :--- | :--- | :--- |
| **Missing Flight Number (`"N/A"`)** | Normalized to `null`. Flagged with `MISSING_FLIGHT_NUMBER`. | **Stored & Index Eligible** |
| **String Price (`"₹8,883"`)** | Parsed into `8883.00`. | **Stored & Index Eligible** |
| **Duration String (`"2 hr 55 min"`)** | Parsed into `175` minutes. | **Stored & Index Eligible** |
| **Round-Trip Quote** | Flagged with `ROUND_TRIP`. | **Stored in Raw DB, Excluded from CPI aggregation** |
| **International Route (`DEL-DXB`)** | Flagged with `INTERNATIONAL_ROUTE`. | **Stored in Raw DB, Excluded from CPI aggregation** |
| **Non-INR Currency (`USD`)** | Flagged with `NON_INR_CURRENCY`. | **Stored in Raw DB, Excluded from CPI aggregation** |
| **Missing / Zero Fare** | Flagged with `PRICE_UNAVAILABLE` or `INVALID_PRICE`. | **Stored in Raw DB, Excluded from CPI aggregation** |
| **Duplicate Transmissions** | Skipped via SHA-256 hash check. | **Skipped without raw corruption** |
| **Non-JSON Payload** | Rejected at controller level. | **HTTP 400 Bad Request** |

---

### 5. Advance-Purchase Lead-Time Rules

Lead times are calculated based on calendar days between scrape timestamp and departure date:

$$\text{leadTimeDays} = \text{Date.UTC}(\text{departure\_date}) - \text{Date.UTC}(\text{scraped\_at\_date})$$

The prototype requires these **EXACT** windows:
- **`1 day`** $\longrightarrow$ **`T+1`** (Immediate)
- **`7 days`** $\longrightarrow$ **`T+7`** (1 week ahead)
- **`15 days`** $\longrightarrow$ **`T+15`** (2 weeks ahead)
- **`30 days`** $\longrightarrow$ **`T+30`** (1 month ahead)
- **`45 days`** $\longrightarrow$ **`T+45`** (1.5 months ahead)

*Scrapers should target these exact departure offsets during search execution.*

---

### 6. Testing with cURL

```bash
# Ingest batch of real scraper observations
curl -X POST http://localhost:5000/api/scraper/fares/batch \
  -H "Content-Type: application/json" \
  -H "X-SCRAPER-API-KEY: YOUR_SCRAPER_API_KEY_HERE" \
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

# Check diagnostic readiness
curl http://localhost:5000/api/index/pipeline/status

# Execute daily pipeline run
curl -X POST http://localhost:5000/api/index/pipeline \
  -H "Content-Type: application/json" \
  -d '{ "collectionDate": "2026-09-04", "dataEnvironment": "REAL" }'
```

---

### 7. Production Deployment Checklist

1. [ ] Scraper crawlers format output with ISO-8601 timestamps (`scraped_at`).
2. [ ] Departure dates follow standard `YYYY-MM-DD`.
3. [ ] `X-SCRAPER-API-KEY` header is set on all HTTP POST requests.
4. [ ] Scrape schedules target exact lead-time dates (+1, +7, +15, +30, +45 days).
5. [ ] Scrapers transmit batches in chunks of 50–500 observations per POST request.

---

### 8. Contact & Escalation

- **Project**: Smart India Hackathon 2026 — Problem Statement SIH26056
- **Ministry Sponsor**: Ministry of Statistics and Programme Implementation (MoSPI)
- **Technical Contact**: Backend Integration Team (`backend-team@sih26056.local`)
