import mongoose from 'mongoose';

const DGCAReferenceFareSchema = new mongoose.Schema(
  {
    referenceDate: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    month: {
      type: String,
      required: true,
      trim: true,
      index: true,
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
    averageFare: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
      trim: true,
      uppercase: true,
    },
    source: {
      type: String,
      required: true,
      default: 'DGCA_MONTHLY_REPORT',
      trim: true,
    },
    datasetName: {
      type: String,
      required: true,
      default: 'DGCA_BENCHMARK',
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

// Compound unique index ensuring idempotency and environment isolation
DGCAReferenceFareSchema.index(
  { referenceDate: 1, route: 1, dataEnvironment: 1 },
  { unique: true }
);

// Secondary query indexes
DGCAReferenceFareSchema.index({ month: 1, route: 1, dataEnvironment: 1 });
DGCAReferenceFareSchema.index({ referenceDate: 1, dataEnvironment: 1 });

export const DGCAReferenceFare = mongoose.model('DGCAReferenceFare', DGCAReferenceFareSchema);
