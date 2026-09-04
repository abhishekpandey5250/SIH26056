# DGCA Official Airfare Benchmark Reference Datasets
# Problem Statement: SIH26056 (MoSPI CPI Airfare Index)

This directory is the designated location for official, publicly available DGCA (Directorate General of Civil Aviation) and MoCA (Ministry of Civil Aviation) reference tariff datasets.

---

## 1. Supported Formats

The DGCA Data Importer (`backend/scripts/importDGCAData.js`) supports both **CSV** and **JSON** formats.

### CSV Format Schema (`dgca_reference.csv`)

| Column Name | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `reference_date` | `YYYY-MM-DD` | YES | Exact date of reference fare observation | `2026-08-01` |
| `origin` | `String (IATA)` | YES | 3-letter origin domestic airport code | `DEL` |
| `destination` | `String (IATA)` | YES | 3-letter destination domestic airport code | `BOM` |
| `average_fare` | `Number` | YES | Published DGCA representative/average fare in INR | `4150.00` |
| `currency` | `String` | NO | Currency code (Defaults to `INR`) | `INR` |
| `source` | `String` | NO | Official publication / report name | `DGCA_TARIFF_MONITORING` |
| `dataset_name` | `String` | NO | Benchmark dataset descriptor | `DGCA_MONTHLY_REPORT_AUG2026` |
| `month` | `YYYY-MM` | NO | Reporting month (Derived automatically if omitted) | `2026-08` |

### JSON Format Schema (`dgca_reference.json`)

```json
[
  {
    "referenceDate": "2026-08-01",
    "origin": "DEL",
    "destination": "BOM",
    "averageFare": 4150.00,
    "currency": "INR",
    "source": "DGCA_TARIFF_MONITORING",
    "datasetName": "DGCA_MONTHLY_REPORT_AUG2026"
  }
]
```

---

## 2. Import Command

To import a dataset into MongoDB:

```bash
cd backend
node scripts/importDGCAData.js ../data/dgca_reference.csv
# Or for JSON:
node scripts/importDGCAData.js ../data/dgca_reference.json
```

---

## 3. Important Methodological Notice

- Backtesting against DGCA reference benchmarks is an analytical validation tool.
- If no real DGCA dataset is imported, the system reports `readyFor30DayBacktest: false` and displays a clear, honest "Dataset not loaded" status on the dashboard.
- Zero fake or hallucinated benchmark fares are ever used in production calculations.
