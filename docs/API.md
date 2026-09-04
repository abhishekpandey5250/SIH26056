# SIH26056: Real-time Airfare Price Index for India
## Official Versioned REST API Documentation (`/api/v1`)

The SIH26056 platform provides a standardized, versioned REST API (`/api/v1/*`) tailored for high-frequency consumption by the **National Statistical Office (NSO)**, the **Reserve Bank of India (RBI)**, and macroeconomic researchers.

---

### 1. Global Standards & Envelope Contract

All `/api/v1/*` responses adhere to a consistent JSON envelope with audit metadata:

```json
{
  "success": true,
  "meta": {
    "frequency": "daily",
    "leadTimeBucket": "T+7",
    "dataEnvironment": "REAL",
    "generatedAt": "2026-09-04T08:00:00.000Z",
    "recordCount": 30,
    "source": "MoSPI SIH26056 Index Engine v1.0"
  },
  "data": []
}
```

---

### 2. Temporal Index Series Endpoints

#### A. Daily Index Series
- **Endpoint**: `GET /api/v1/index/daily`
- **Query Parameters**:
  - `startDate`: Filter start date (`YYYY-MM-DD`)
  - `endDate`: Filter end date (`YYYY-MM-DD`)
  - `leadTimeBucket`: `T+1`, `T+7`, `T+15`, `T+30`, `T+45` (Default: `T+7`)
  - `dataEnvironment`: `REAL` (default) or `DEMO`
- **Example**: `GET /api/v1/index/daily?startDate=2026-08-01&endDate=2026-08-30&leadTimeBucket=T+7`

#### B. Weekly Index Series (ISO-8601 Calendar Weeks)
- **Endpoint**: `GET /api/v1/index/weekly`
- **Example Response**:
```json
{
  "success": true,
  "meta": { "frequency": "weekly", "leadTimeBucket": "T+7", "dataEnvironment": "REAL" },
  "data": [
    {
      "period": "2026-W32",
      "startDate": "2026-08-03",
      "endDate": "2026-08-09",
      "frequency": "weekly",
      "leadTimeBucket": "T+7",
      "indexValue": 112.45,
      "baseIndex": 100.0,
      "sampleDays": 7,
      "routeCount": 6,
      "coveragePercent": 100.0
    }
  ]
}
```

#### C. Monthly Index Series
- **Endpoint**: `GET /api/v1/index/monthly`
- **Example Response**:
```json
{
  "success": true,
  "meta": { "frequency": "monthly", "leadTimeBucket": "T+7", "dataEnvironment": "REAL" },
  "data": [
    {
      "period": "2026-08",
      "frequency": "monthly",
      "leadTimeBucket": "T+7",
      "indexValue": 114.10,
      "baseIndex": 100.0,
      "sampleDays": 31,
      "routeCount": 6,
      "coveragePercent": 100.0
    }
  ]
}
```

---

### 3. Route Basket & Governance Endpoints

#### A. DGCA / Provisional Route Basket
- **Endpoint**: `GET /api/v1/index/basket`
- **Response**:
```json
{
  "success": true,
  "dataEnvironment": "REAL",
  "basketVersion": "2.0-dgca-traffic",
  "validationStatus": "DGCA_TRAFFIC_DERIVED",
  "isDgcaDerived": true,
  "period": "2026-Q1",
  "routeCount": 6,
  "weightSum": 1.0,
  "routes": [
    {
      "routeKey": "DEL-BOM",
      "origin": "DEL",
      "destination": "BOM",
      "weight": 0.5,
      "passengers": 450000
    }
  ]
}
```

---

### 4. Advanced Analytics Endpoints

#### A. Sector-Wise Heatmap Matrix
- **Endpoint**: `GET /api/v1/analytics/heatmap`
- **Query Parameters**: `startDate`, `endDate`, `leadTimeBucket`, `dataEnvironment`

#### B. Observed Advance-Purchase Lead-Time Elasticity
- **Endpoint**: `GET /api/v1/analytics/lead-time`
- **Query Parameters**: `date`, `routeKey`, `dataEnvironment`

---

### 5. Universal Data Export Endpoints

Support both `format=csv` and `format=json`:
- `GET /api/v1/export/index?freq=daily|weekly|monthly&format=csv|json`
- `GET /api/v1/export/heatmap?format=csv|json`
- `GET /api/v1/export/lead-time?format=csv|json`
- `GET /api/v1/export/backtest?format=csv|json`
