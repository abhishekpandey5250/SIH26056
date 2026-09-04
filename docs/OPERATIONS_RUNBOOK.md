# SIH26056: Real-time Airfare Price Index for India
## Production Operations & Automated Scheduler Runbook

---

### 1. Automated Pipeline Operations

The daily statistical pipeline executes in four automated phases:
1. **Ingestion & Triage**: Scraper feeds post batches to `POST /api/scraper/fares/batch`.
2. **Aggregation**: Median fares calculated per corridor and lead-time window.
3. **Index Computation**: Fixed-weight Laspeyres index computed for `T+1`, `T+7`, `T+15`, `T+30`, `T+45`.
4. **Audit Logging**: Execution summary saved to `PipelineRun` with elapsed duration.

---

### 2. Operational Environment Configuration

| Variable | Description | Recommended Setting |
| :--- | :--- | :--- |
| `PORT` | Backend service HTTP port | `5000` |
| `MONGODB_URI` | MongoDB Atlas / Community connection string | `mongodb+srv://...` |
| `SCRAPER_API_KEY` | Secret authentication key for scraper batch ingestion | Strong 32-char hex string |
| `DATA_MODE` | Active operational mode (`REAL` or `DEMO`) | `REAL` |
| `PIPELINE_ENABLED` | Enables automated daily scheduler | `true` |
| `PIPELINE_SCHEDULE` | Cron schedule expression | `0 2 * * *` (02:00 IST daily) |
| `PIPELINE_TIMEZONE` | Execution timezone | `Asia/Kolkata` |

---

### 3. Monitoring & Health Checks

```bash
# Service Health
curl http://localhost:5000/api/health

# Comprehensive Observability Summary
curl http://localhost:5000/api/v1/status

# Pipeline Automation Status & History
curl http://localhost:5000/api/pipeline/status
curl http://localhost:5000/api/pipeline/history?limit=5

# Route Basket Status
curl http://localhost:5000/api/index/basket/status
```
