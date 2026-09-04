# SIH26056: Real-time Airfare Price Index for India
## Scraper Team Ingestion API Contract (Version 1.2)

This document specifies the exact API integration contract between the **Web Scraping Team** and the **Statistical Price Index Engine Backend**.

---

### 1. Ingestion Endpoints & Authentication

#### Ingestion Batch Endpoint
- **Endpoint**: `POST /api/scraper/fares/batch`
- **Content-Type**: `application/json`
- **Authentication Header**: `X-SCRAPER-API-KEY: <SECRET_KEY>`
- **Environment Variable**: `SCRAPER_API_KEY` (configured on the backend server)

#### Scraper Operational Monitoring Endpoint
- **Endpoint**: `GET /api/scraper/status`
- **Query Parameters**: `?dataMode=REAL` (default) or `?dataMode=DEMO`
- **Authentication**: None required (Public operational status & ingestion volume telemetry)

#### Daily Pipeline Execution Endpoint
- **Endpoint**: `POST /api/index/pipeline`
- **Content-Type**: `application/json`
- **Request Body**: `{ "collectionDate": "YYYY-MM-DD", "dataEnvironment": "REAL" }`

#### Pipeline Diagnostic Readiness Check
- **Endpoint**: `GET /api/index/pipeline/status`
- **Query Parameters**: `?dataMode=REAL` (default) or `?dataMode=DEMO`
- **Authentication**: None required

> [!IMPORTANT]
> All scraper batches sent to `POST /api/scraper/fares/batch` must include the `X-SCRAPER-API-KEY` header. Requests with missing or invalid keys will receive an HTTP `401 Unauthorized` response.

---

### 2. Request Schema

The endpoint accepts a JSON object containing an `observations` array (or a top-level JSON array of observation objects).

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

### 3. Field Specifications & Validation Rules

| Field Name | Type | Status | Description & Rules | Normalization Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `scraped_at` | `String` | **REQUIRED** | ISO-8601 timestamp of scrape event (e.g. `2026-09-04T08:00:00Z`). Used for UTC midnight lead-time calculation and flight deduplication. | Parsed into standard JavaScript `Date` object. |
| `origin` | `String` | **REQUIRED** | 3-letter IATA domestic airport code (e.g. `DEL`, `BOM`, `BLR`, `HYD`, `CCU`, `MAA`). | Trimmed, converted to uppercase. Invalid codes flag `INVALID_AIRPORT_CODE`. |
| `destination` | `String` | **REQUIRED** | 3-letter IATA domestic airport code (e.g. `BOM`). Must differ from `origin`. | Trimmed, converted to uppercase. Identical origin/destination flags `SAME_ORIGIN_DESTINATION`. |
| `departure_date` | `String` | **REQUIRED** | Calendar departure date in `YYYY-MM-DD` format (e.g. `2026-09-11`). | Validated as calendar date. |
| `price` | `Number\|String` | **REQUIRED\*** | Consumer-facing fare in numeric or string format (e.g. `8883`, `8883.00`, `"₹8,883"`). | Strips currency symbols (`₹`, `,`, ` `) and parses to positive float. |
| `currency` | `String` | **REQUIRED\*** | Currency code. Must be `"INR"` for CPI index eligibility. | Converted to uppercase. `"UNKNOWN"`, `"N/A"` normalized to `null`. |
| `trip_type` | `String` | **OPTIONAL** | `"one-way"` or `"round-trip"`. Default: `"one-way"`. | Converted to lowercase. Round-trips are preserved in raw storage but excluded from CPI aggregation. |
| `cabin_class` | `String` | **OPTIONAL** | Seat cabin class (e.g. `"economy"`). Default: `"economy"`. | Converted to lowercase. Non-economy fares flag `UNSUPPORTED_CABIN`. |
| `passengers` | `Number` | **OPTIONAL** | Number of passengers quoted. Default: `1`. | Parsed to integer. |
| `airline` | `String` | **OPTIONAL** | Scheduled carrier name (e.g. `"IndiGo"`, `"Air India"`, `"SpiceJet"`, `"Akasa Air"`). | Preserved with whitespace trimmed. |
| `flight_number` | `String` | **OPTIONAL** | Flight identifier (e.g. `"AI-2803"`). | `"N/A"`, `"NONE"`, `"-"` normalized to `null` (flagged `MISSING_FLIGHT_NUMBER`, remains index-eligible). |
| `departure_time` | `String` | **OPTIONAL** | Local scheduled departure time (e.g. `"06:30"`, `"2:25 PM"`). | Trimmed string. |
| `arrival_time` | `String` | **OPTIONAL** | Local scheduled arrival time (e.g. `"09:25"`, `"3:35 PM"`). | Trimmed string. |
| `duration` | `String` | **OPTIONAL** | Flight duration string (e.g. `"2 hr 55 min"`, `"175 min"`). | Parsed into `durationMinutes`. |
| `duration_minutes` | `Number` | **OPTIONAL** | Total flight elapsed duration in minutes (e.g. `175`). | Integer value. |
| `stops` | `Number\|String`| **OPTIONAL** | Number of intermediate stops (e.g. `0`, `"non-stop"` $\rightarrow 0$). Default: `0`. | Parsed to non-negative integer. |
| `source` | `String` | **OPTIONAL** | Scraper portal/connector identifier (e.g. `"Air India"`, `"IndiGo"`, `"MakeMyTrip"`). Default: `"ota_scraper"`. | Trimmed lowercase for deduplication. |
| `search_url` | `String` | **OPTIONAL** | Direct deep link to flight quote page. | Stored in metadata for data provenance. |
| `co2_emissions` | `String` | **OPTIONAL** | Estimated flight carbon emissions (e.g. `"143 kg CO2"`). | Stored in metadata. |

*\* Required for CPI Index Eligibility. If missing or invalid, record is safely stored in raw database with quality flags, but disqualified from statistical aggregation.*

---

### 4. Lead-Time Calculation & Exact Advance-Purchase Windows

The statistical engine calculates lead time using exact calendar-day boundaries:
$$\text{leadTimeDays} = \text{Date.UTC}(\text{departure\_date}) - \text{Date.UTC}(\text{scraped\_at\_date})$$

#### Exact Windows Mapping
- $\text{leadTimeDays} = 1 \longrightarrow \mathbf{T+1}$ (Immediate departure)
- $\text{leadTimeDays} = 7 \longrightarrow \mathbf{T+7}$ (1 week advance)
- $\text{leadTimeDays} = 15 \longrightarrow \mathbf{T+15}$ (2 weeks advance)
- $\text{leadTimeDays} = 30 \longrightarrow \mathbf{T+30}$ (1 month advance)
- $\text{leadTimeDays} = 45 \longrightarrow \mathbf{T+45}$ (1.5 months advance)

> [!WARNING]
> Only exact integer values enter these buckets. Lead times of 6 or 8 days **do NOT** map to `T+7`. Lead times of 14 or 16 days **do NOT** map to `T+15`.

---

### 5. Idempotency & Deduplication

Each observation receives a deterministic SHA-256 flight hash:
$$\text{Hash} = \text{SHA256}(\text{source} \mid \text{origin} \mid \text{destination} \mid \text{departure\_date} \mid \text{airline} \mid \text{flight\_number} \mid \text{departure\_time} \mid \text{price} \mid \text{scraped\_at} \mid \text{dataEnvironment})$$

- If a scraper transmits the identical record multiple times, MongoDB executes an atomic `$setOnInsert` upsert.
- The duplicate is recorded in the batch response (`duplicates: 1`) without creating duplicate rows in `RawObservation`.

---

### 6. Response Contract

#### Successful Batch Ingestion (HTTP 200)
```json
{
  "success": true,
  "dataEnvironment": "REAL",
  "received": 15,
  "stored": 14,
  "duplicates": 1,
  "rejected": 0,
  "indexEligible": 10,
  "flagged": 5,
  "errors": []
}
```

#### Scraper Operational Status Response (`GET /api/scraper/status`)
```json
{
  "success": true,
  "dataMode": "REAL",
  "lastScrapeAt": "2026-09-04T08:00:00.000Z",
  "lastBatchReceivedAt": "2026-09-04T08:30:00.000Z",
  "lastBatchSize": 15,
  "lastBatchStatus": "SUCCESS",
  "latestCollectionDate": "2026-09-04",
  "observationsReceived": 150,
  "observationsStored": 142,
  "duplicates": 8,
  "rejected": 0,
  "indexEligible": 120,
  "flagged": 22
}
```

#### Pipeline Diagnostic Readiness (`GET /api/index/pipeline/status`)
```json
{
  "success": true,
  "dataMode": "REAL",
  "latestCollectionDate": "2026-09-04",
  "rawObservations": 142,
  "eligibleObservations": 120,
  "aggregationsAvailable": 18,
  "indexRecordsAvailable": 5,
  "bucketsAvailable": ["T+1", "T+7", "T+15", "T+30", "T+45"],
  "routesAvailable": 6,
  "readyForIndex": true,
  "databaseStatus": "connected"
}
```

---

### 7. Testing with cURL

```bash
# Post sample observation batch using placeholder API key
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

# Query scraper telemetry status
curl http://localhost:5000/api/scraper/status

# Check pipeline diagnostic readiness
curl http://localhost:5000/api/index/pipeline/status

# Execute daily pipeline run for collection date
curl -X POST http://localhost:5000/api/index/pipeline \
  -H "Content-Type: application/json" \
  -d '{ "collectionDate": "2026-09-04", "dataEnvironment": "REAL" }'
```
