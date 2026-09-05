# SIH26056: Real-time Airfare Price Index for India
## Web Scraper Team Integration Guide


# SETTING UP YOUR ENVIRONMENT
pip install -r requirements.txt
setup python interpretor to 3.12 or 3.14

## HOW TO SCRAP DATA 
MAIN FILE TO EXECUTE -> main_scraper.py
Setting up routes to scrape and from which date refer  to-> sample_routes.json

# COMMAND TO EXECUTE FOR SCRAPING 
python main_scarper.py -i sample_routes.json --lead-times 1,7,15,30,45 -d scraped_data


# main functionality andworking of this command 

ingest your input of name of routes and starting date  ( -i <file name.json> )
to scrape the data of lead time ( --lead-times 1,7,15,30,)
to storethe data in o/p directory (-d <file_name>)

# file structure  in which data is tored
  |--t+1
    - DEL-BOM.JSON
    - DEL-CCA.JSON
    - BLR-BOM.JSON
  |--t+7
  |--t+15
  |--t+30
  |--t+45

# file ingestion 
.venv\Scripts\python main_scraper.py -i sample_routes.json --output results.json

# Future window scraping
.venv\Scripts\python main_scraper.py --routes DEL-BOM --lead-times 1,7,15,30,45 --output batch_results.json

## segregate
.venv\Scripts\python main_scraper.py --routes DEL-BOM DEL-BLR --lead-times 1,7,15,30,45 -d scraped_data











































<!-- Welcome to the **SIH26056 Airfare Price Index Backend Integration Guide**. This document provides everything the scraping engineering team needs to format, authenticate, validate, and transmit airfare crawl batches into the real-time index pipeline.

---

### 1. Architecture & End-to-End Data Pipeline

```
┌────────────────────────┐
│  Scraper Web Crawlers  │ (IndiGo, Air India, OTAs, Aggregators)
└───────────┬────────────┘
            │ POST /api/scraper/fares/batch (Header: X-SCRAPER-API-KEY)
            ▼
┌────────────────────────┐
│  Normalization Engine  │ (Cleans currencies, timestamps, fares, duration)
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│   Quality Validation   │ (Assigns quality flags, computes indexEligible)
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ RawObservation Storage │ (Immutable audit trail, SHA-256 deduplication)
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ DailyRouteAggregation  │ (Computes robust median fares for T+1, T+7, T+15, T+30, T+45)
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ Statistical Index      │ (Fixed-weight Laspeyres index + weight renormalization)
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ React Analytics Portal │ (MoSPI monitoring dashboard & historical charts)
└────────────────────────┘
```

---

### 2. Quick Integration Reference

- **Base URL (Local)**: `http://localhost:5000`
- **Ingestion Endpoint**: `POST /api/scraper/fares/batch`
- **Required Header**: `X-SCRAPER-API-KEY: <your-configured-key>`
- **Content-Type**: `application/json`

---

### 3. Valid Payload Example

```json
{
  "observations": [
    {
      "source": "IndiGo",
      "scraped_at": "2026-09-04T06:22:33.793390+00:00",
      "origin": "DEL",
      "destination": "BOM",
      "departure_date": "2026-09-11",
      "return_date": null,
      "trip_type": "one-way",
      "cabin_class": "economy",
      "passengers": 1,
      "airline": "IndiGo",
      "flight_number": "6E-205",
      "departure_time": "08:30",
      "arrival_time": "10:45",
      "duration": "2 hr 15 min",
      "duration_minutes": 135,
      "stops": 0,
      "price": 5400,
      "currency": "INR",
      "price_raw": "₹5,400",
      "search_url": "https://www.goindigo.in/booking/select.html?...",
      "co2_emissions": "43 kg CO2"
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
| **String Price (`"₹7,890"`)** | Parsed into `7890.00`. | **Stored & Index Eligible** |
| **Duration String (`"1 hr 10 min"`)** | Parsed into `70` minutes. | **Stored & Index Eligible** |
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
- **`1 day`** $\longrightarrow$ **`T+1`**
- **`7 days`** $\longrightarrow$ **`T+7`**
- **`15 days`** $\longrightarrow$ **`T+15`**
- **`30 days`** $\longrightarrow$ **`T+30`**
- **`45 days`** $\longrightarrow$ **`T+45`**

*Scrapers should target these exact departure offsets during search execution.*

---

### 6. Local Testing with the Scraper Simulator

A local scraper simulator client is provided in the repository to test your connection:

```bash
# 1. From the repository root, navigate to backend
cd backend

# 2. Set your environment key (or use default development key)
export SCRAPER_API_KEY="dev-scraper-key-12345"

# 3. Run the simulator script
node scripts/simulateScraper.js
```

The simulator generates a realistic multi-airline, multi-route batch, transmits it to the running backend, and prints the operational validation summary.

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
- **Technical Contact**: Backend Integration Team (`backend-team@sih26056.local`) -->


