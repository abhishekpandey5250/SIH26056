# SIH26056: Real-time Airfare Price Index for India
## System Architecture & Statistical Formulation (Version 1.0)

**Problem Statement**: SIH26056 — Development of a Real-time Airfare Price Index for India through Automated Web Scraping of Airline and Online Travel Aggregator Portals for Augmentation of the Consumer Price Index (CPI).

---

### 1. End-to-End System Architecture

```
┌────────────────────────────────────────────────────────┐
│               WEB SCRAPING LAYER                       │
│  - Scheduled Airline Portals (IndiGo, Air India, etc.) │
│  - Online Travel Aggregators (MakeMyTrip, EaseMyTrip)  │
└───────────────────────────┬────────────────────────────┘
                            │ POST /api/scraper/fares/batch
                            │ (Header: X-SCRAPER-API-KEY)
                            ▼
┌────────────────────────────────────────────────────────┐
│            INGESTION & TRIAGE SERVICE                  │
│  - Normalization: String prices, flight numbers, dates │
│  - Quality Triage: Assigns 14 standard quality flags   │
│  - Index Eligibility: Evaluates CPI qualification      │
│  - Deduplication: Deterministic SHA-256 flight hash    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             RAW OBSERVATION REPOSITORY                 │
│  - MongoDB `RawObservation` collection                 │
│  - Preserves immutable rawPayload for auditability     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│         DAILY ROUTE AGGREGATION ENGINE                 │
│  - UTC Midnight Calendar Date boundary parsing         │
│  - Exact Lead-Time Windows: T+1, T+7, T+15, T+30, T+45 │
│  - Robust Median Representative Fare Calculation       │
│  - Persists to `DailyRouteAggregation` (Unique Index)  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│        STATISTICAL AIRFARE INDEX ENGINE                │
│  - Benchmark Base Period median fare matching (P0)     │
│  - Route Price Relative Calculation (R = Pt/P0 * 100)  │
│  - Fixed-Weight Laspeyres Aggregation: Σ (w* * R)      │
│  - Dynamic Weight Renormalization for missing routes   │
│  - Persists to `AirfareIndex` (Unique Date+Code Index) │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                PRESENTATION PORTAL                     │
│  - React / Tailwind CSS Government Monitoring Portal   │
│  - Pure SVG responsive historical trend charts         │
│  - City-pair breakdown tables and telemetry indicators │
└────────────────────────────────────────────────────────┘
```

---

### 2. Statistical Methodology

#### 1. Lead-Time Day Calculation
To eliminate daylight saving and timezone conversion shifts, lead time is calculated strictly across UTC calendar days:
$$\text{leadTimeDays} = \text{Date.UTC}(\text{departure\_date}) - \text{Date.UTC}(\text{scraped\_at\_date})$$

#### Exact Window Mapping
- $1 \text{ day} \longrightarrow \mathbf{T+1}$ (Immediate departure index)
- $7 \text{ days} \longrightarrow \mathbf{T+7}$ (1-week advance purchase index)
- $15 \text{ days} \longrightarrow \mathbf{T+15}$ (2-weeks advance purchase index)
- $30 \text{ days} \longrightarrow \mathbf{T+30}$ (1-month advance purchase index)
- $45 \text{ days} \longrightarrow \mathbf{T+45}$ (1.5-months advance purchase index)
- *Nearby offsets (6, 8, 14, 16, 29, 31) are disqualified from index aggregation.*

#### 2. Representative Fare: Median
Dynamic airfare pricing contains significant positive skew and algorithmic price spikes. The **median** provides a statistically robust measure of central tendency:
$$\text{Representative Fare } P_{t, r, b} = \text{Median}\left( \{ \text{observedFare}_i \mid i \in \text{CleanEligible}(t, r, b) \} \right)$$

#### 3. Route Price Relative
$$R_{t, r, b} = \left( \frac{P_{t, r, b}}{P_{0, r, b}} \right) \times 100$$
where $P_{0, r, b}$ is the median representative fare during the fixed base period ($[startDate, endDate]$).

#### 4. Fixed-Weight Laspeyres Composite Index
$$\text{Index}_{t, b} = \sum_{r \in \text{Included}} \left( w_r^* \times R_{t, r, b} \right)$$
where $w_r^*$ is the normalized effective weight:
$$w_r^* = \frac{w_r}{\sum_{k \in \text{Included}} w_k}$$

- When current fares match base fares: $\mathbf{\text{Index} = 100.00}$.
- If a route is missing, it is excluded (never assigned ₹0), weights are renormalized, and coverage percentage is exposed.

---

### 3. Database Collections & Index Strategy

1. **`RawObservation`**:
   - Stores raw scraper quotes, normalization fields, quality flags, and metadata.
   - Unique Index: `{ deduplicationHash: 1 }`
   - Query Indexes: `{ origin: 1, destination: 1, departureDate: 1, scrapedAt: 1 }`, `{ 'quality.indexEligible': 1, departureDate: 1 }`

2. **`DailyRouteAggregation`**:
   - Stores route-level representative fares, min/max bounds, observation counts, and source breakdowns.
   - Unique Index: `{ collectionDate: 1, routeKey: 1, leadTimeBucket: 1 }`

3. **`RouteWeight`**:
   - Stores domestic trunk corridor passenger traffic weights and source provenance.
   - Unique Index: `{ routeKey: 1, effectiveFrom: 1, methodologyVersion: 1 }`

4. **`AirfareIndex`**:
   - Stores composite Laspeyres index values, daily changes, route breakdown contributions, and coverage stats.
   - Unique Index: `{ indexDate: 1, indexCode: 1 }`
   - Query Index: `{ leadTimeBucket: 1, indexDate: -1 }`

---

### 4. Non-Forecasting Disclosure

In alignment with international official statistical standards (ILO/IMF Consumer Price Index Manual):
- `T+1`, `T+7`, `T+15`, `T+30`, and `T+45` represent **observed price levels for flight tickets currently available for purchase at specified advance booking horizons**.
- They are **NOT** econometric forecasts or machine learning predictions of future prices.
