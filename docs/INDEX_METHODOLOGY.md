# SIH26056: Real-time Airfare Price Index for India
## Statistical Index Methodology & Mathematical Formulations (v1.0)

---

### 1. Laspeyres Fixed-Weight Airfare Price Index

The SIH26056 platform implements a fixed-basket **Laspeyres Price Relative Model** aligned with international Consumer Price Index (CPI) standards (IMF/ILO/MoSPI CPI Manual):

$$\text{Index}_{t, b} = 100 \times \sum_{r \in \text{Included}} \left( w_r^* \times \frac{P_{t, r, b}}{P_{0, r, b}} \right)$$

Where:
- $t$: Target calculation date (`YYYY-MM-DD`).
- $b$: Exact advance-purchase lead-time window (`T+1`, `T+7`, `T+15`, `T+30`, `T+45`).
- $P_{t, r, b}$: Daily representative fare for corridor $r$ in bucket $b$ on date $t$. Defined as the **empirical median** of all clean, eligible observations.
- $P_{0, r, b}$: Base period representative fare for corridor $r$ in bucket $b$ (median over base date interval).
- $w_r^*$: Dynamically renormalized route weight.

---

### 2. Missing Route Policy & Dynamic Weight Renormalization

If cancellations, severe weather, or zero scraper observations occur for route $r$ on date $t$:
1. The missing route is **excluded from calculation** (never assigned an artificial ₹0).
2. Weights of all remaining available routes are dynamically renormalized to sum to exactly 1.0:
   $$w_r^* = \frac{w_r}{\sum_{k \in \text{Included}} w_k}$$
3. Weight Coverage is recorded:
   $$\text{Coverage} = \frac{\sum_{k \in \text{Included}} w_k}{\sum_{all} w_j} \times 100\%$$

---

### 3. Advance-Purchase Horizons vs Predictive Machine Learning

Advance-purchase windows (`T+1` to `T+45`) reflect **observed airfares** for flights departing $N$ days in the future.
- **`T+1`**: Immediate departure / surge pricing.
- **`T+7`**: 1-week benchmark horizon.
- **`T+15`, `T+30`, `T+45`**: Advance planning horizons.

> [!IMPORTANT]
> Advance-purchase indices are descriptive cross-sectional measurements of current market quotes — **NOT machine learning forecasts or predictive models**.
