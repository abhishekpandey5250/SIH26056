# SIH26056: Real-time Airfare Price Index for India
## Data Sources & Provenance Classification

To ensure strict statistical transparency, compliance with MoSPI standards, and data integrity, all datasets in the SIH26056 platform are classified into four mutually exclusive tiers.

---

### 1. Data Classification Tiers

```
┌───────────────────────────────────────────────────────────────────────┐
│                    DATA SOURCE PROVENANCE MATRIX                      │
├──────────────────────────┬──────────────────────┬─────────────────────┤
│ Source Tier              │ Authority / Origin   │ Production Role     │
├──────────────────────────┼──────────────────────┼─────────────────────┤
│ 1. Official DGCA Data    │ DGCA / MoCA Reports  │ Traffic Weights &   │
│                          │                      │ Benchmark Backtests │
│ 2. Scraped Airfare Data  │ Direct Airlines/OTAs │ Daily High-Frequency│
│                          │                      │ Observations        │
│ 3. Provisional Config    │ System Baseline      │ Safe Fallback until │
│                          │ (MoSPI Protocol)     │ DGCA Traffic Loaded │
│ 4. Demo Dataset          │ Deterministic Seed   │ SIH Hackathon &     │
│                          │ (Clearly Labeled)    │ Jury Evaluations    │
└──────────────────────────┴──────────────────────┴─────────────────────┘
```

---

### 2. Detailed Tier Specifications

#### Tier 1: Official DGCA Reference Data (`source: DGCA_*`)
- **Authority**: Directorate General of Civil Aviation (DGCA) and Ministry of Civil Aviation (MoCA).
- **Types**:
  1. *Passenger Traffic Statistics* (`DGCATraffic`): Monthly city-pair scheduled domestic passenger volume used to derive Laspeyres route weights ($w_r$).
  2. *Tariff Monitoring Benchmarks* (`DGCAReferenceFare`): Historical route average fares used exclusively for 30-day backtesting.
- **Rule**: If official DGCA data is not imported, the system explicitly reports *"DGCA dataset not loaded"* and never synthesizes mock regulatory numbers.

#### Tier 2: Live Airline & OTA Scraped Observations (`source: ota_scraper | <Airline>`)
- **Origin**: Public web quotes from scheduled domestic carriers (IndiGo, Air India, SpiceJet, Akasa Air, etc.) and aggregators.
- **Format**: Ingested via `POST /api/scraper/fares/batch` with `X-SCRAPER-API-KEY`.
- **Environment**: Tagged with `dataEnvironment: "REAL"`.

#### Tier 3: Provisional Baseline Configuration
- **Purpose**: Provides a default 6-corridor domestic trunk basket (DEL-BOM, DEL-BLR, BOM-BLR, DEL-CCU, BLR-HYD, MAA-DEL) when official DGCA traffic files have not yet been imported.
- **Labeling**: Visibly tagged on APIs and Dashboard as `"PROVISIONAL / NOT DGCA-VALIDATED"`.

#### Tier 4: Deterministic Demo Dataset (`source: DEMO`)
- **Purpose**: Verifiable evaluation dataset for jury demonstrations and automated regression suites.
- **Environment**: Tagged with `dataEnvironment: "DEMO"`.
- **Isolation Guarantee**: REAL pipeline queries query strictly `{ dataEnvironment: "REAL" }`, completely preventing demo observations from entering live indices.
