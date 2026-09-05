import mongoose from 'mongoose';

const DGCATrafficSchema = new mongoose.Schema(
  {
    period: {
      type: String,
      required: true,
      trim: true,
      index: true, // e.g. "2026-08" or "2026-Q2" or "2025-2026"
    },
    origin: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    destination: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    route: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    passengers: {
      type: Number,
      required: true,
      min: 1,
    },
    trafficType: {
      type: String,
      required: true,
      default: 'DOMESTIC_SCHEDULED',
      trim: true,
    },
    source: {
      type: String,
      required: true,
      default: 'DGCA_CITY_PAIR_TRAFFIC',
      trim: true,
    },
    datasetName: {
      type: String,
      required: true,
      default: 'DGCA_TRAFFIC_STATISTICS',
      trim: true,
    },
    dataEnvironment: {
      type: String,
      enum: ['REAL', 'DEMO'],
      default: 'REAL',
      index: true,
    },
    importedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound unique index for idempotent upserts and environment isolation
DGCATrafficSchema.index(
  { period: 1, route: 1, dataEnvironment: 1 },
  { unique: true }
);

DGCATrafficSchema.index({ period: 1, dataEnvironment: 1 });

export const DGCATraffic = mongoose.model('DGCATraffic', DGCATrafficSchema);
