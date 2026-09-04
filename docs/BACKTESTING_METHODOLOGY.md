# SIH26056: Real-time Airfare Price Index for India
## 30-Day Backtesting & DGCA Validation Methodology (v1.0)

---

### 1. Purpose & Objectives

The primary objective of the **Backtesting & Validation Engine** is to provide an empirical, auditable quality assurance layer that benchmarks our high-frequency daily Airfare Price Index against official reference tariff datasets published by the **Directorate General of Civil Aviation (DGCA)** and the **Ministry of Civil Aviation (MoCA)**.

> [!IMPORTANT]
> **Methodological Scope Disclaimer**:
> This backtesting system serves as an analytical validation and benchmarking tool to evaluate index behavior and trend concordance. It does not constitute or imply official regulatory certification by DGCA.

---

### 2. Dataset Schema & Ingestion

The backtest framework ingests DGCA tariff datasets in **CSV** or **JSON** format via [`backend/scripts/importDGCAData.js`](file:///c:/Users/abhis/Downloads/SIH_56/backend/scripts/importDGCAData.js).

#### Benchmark Data Attributes
- `referenceDate`: Calendar date of observation (`YYYY-MM-DD`).
- `origin` & `destination`: 3-letter IATA domestic airport codes (`DEL`, `BOM`, `BLR`, etc.).
- `route`: Canonical route key (`DEL-BOM`).
- `averageFare`: Published DGCA average/representative airfare in INR ($> 0$).
- `currency`: Must be `"INR"`.
- `source`: Official publication identifier (e.g. `DGCA_TARIFF_MONITORING`).
- `dataEnvironment`: Isolated environment tag (`"REAL"` vs `"DEMO"`).

---

### 3. Comparison Normalization Methodology

Because DGCA reference data and our high-frequency index may operate on different absolute baseline scales or collection frequencies, **direct raw subtraction between mismatched units is statistically invalid**.

Instead, both series are normalized to the **first valid common overlapping observation ($t_0$)**:

$$\text{Normalized Our Index}_t = \left( \frac{\text{Our Index}_t}{\text{Our Index}_{t_0}} \right) \times 100$$

$$\text{Normalized DGCA Reference}_t = \left( \frac{\text{DGCA Benchmark}_t}{\text{DGCA Benchmark}_{t_0}} \right) \times 100$$

This establishes a common base convention of $100.00$ at $t_0$ and evaluates percentage trend tracking over the evaluation horizon.

---

### 4. Mathematical Formulations for Evaluation Metrics

#### A. Mean Absolute Error (MAE)
Measures the average magnitude of absolute deviation between the normalized index and the normalized DGCA reference:
$$\text{MAE} = \frac{1}{N} \sum_{i=1}^N \left| \text{NormOur}_i - \text{NormRef}_i \right|$$

#### B. Mean Absolute Percentage Error (MAPE)
Measures the relative percentage error against the DGCA reference benchmark:
$$\text{MAPE} = \frac{1}{N} \sum_{i=1}^N \left( \frac{\left| \text{NormOur}_i - \text{NormRef}_i \right|}{\text{NormRef}_i} \right) \times 100\%$$

#### C. Root Mean Square Error (RMSE)
Penalizes larger variance outliers between the series:
$$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^N \left( \text{NormOur}_i - \text{NormRef}_i \right)^2}$$

#### D. Pearson Correlation Coefficient ($r$)
Measures linear co-movement between the normalized index and the benchmark ($N \ge 2$):
$$r = \frac{\sum_{i=1}^N (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum_{i=1}^N (x_i - \bar{x})^2 \sum_{i=1}^N (y_i - \bar{y})^2}}$$

#### E. Directional Agreement (%)
Measures the proportion of consecutive period transitions where day-to-day deltas move in the same directional sign:
$$\text{Directional Agreement} = \frac{\sum \mathbf{1}\left[\operatorname{sgn}(\Delta \text{Our}_t) = \operatorname{sgn}(\Delta \text{Ref}_t)\right]}{M} \times 100\%$$

---

### 5. Route-Level Validation Comparison

When DGCA reference records include city-pair route breakdowns, the engine computes:
- **Our Representative Fare**: Median observed fare for the city-pair on lead-time window $b$.
- **DGCA Reference Fare**: Average fare reported by DGCA.
- **Absolute Deviation**: $|\text{Our Fare} - \text{DGCA Fare}|$.
- **Percentage Deviation**: $\frac{\text{Our Fare} - \text{DGCA Fare}}{\text{DGCA Fare}} \times 100\%$.

Missing routes are **never assigned ₹0**; they are tracked as unmatched corridors with route coverage statistics.

---

### 6. Missing Data & Zero Fake Data Policy

1. **No Fake Accuracies**: If zero DGCA records exist in MongoDB, the API and frontend display `readyFor30DayBacktest: false` and render a clear "Dataset not loaded" notice.
2. **Sample Size Thresholds**: Statistical correlation and directional agreement require at least $N \ge 2$ overlapping observations. If fewer exist, metrics return `null` with explicit explanatory strings (e.g. *"Correlation unavailable: fewer than 2 overlapping days"*).
3. **Immutability of Production Index**: Backtesting computations are read-only and never alter live index records or base periods.

---

### 7. Execution Workflow

```bash
# 1. Import official DGCA dataset
node backend/scripts/importDGCAData.js data/dgca_reference.csv

# 2. Check diagnostic readiness
curl http://localhost:5000/api/backtest/status

# 3. Execute 30-day backtest
curl "http://localhost:5000/api/backtest/30-day?startDate=2026-08-01&endDate=2026-08-30&leadTimeBucket=T+7"

# 4. Export results
curl "http://localhost:5000/api/backtest/30-day/export?startDate=2026-08-01&endDate=2026-08-30&format=csv" -o backtest_results.csv
```
