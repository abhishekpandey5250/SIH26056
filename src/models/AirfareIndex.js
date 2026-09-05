import mongoose from 'mongoose';

const RoutePriceRelativeSchema = new mongoose.Schema(
  {
    routeKey: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    origin: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    destination: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    configuredWeight: {
      type: Number,
      required: true,
    },
    effectiveWeight: {
      type: Number,
      required: true,
    },
    baseFare: {
      type: Number,
      required: true,
    },
    currentFare: {
      type: Number,
      required: true,
    },
    priceRelative: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const AirfareIndexSchema = new mongoose.Schema(
  {
    indexDate: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    dataEnvironment: {
      type: String,
      enum: ['REAL', 'DEMO'],
      default: 'REAL',
      index: true,
    },
    indexCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    leadTimeBucket: {
      type: String,
      required: true,
      enum: ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'],
      index: true,
    },
    leadTimeDays: {
      type: Number,
      required: true,
      enum: [1, 7, 15, 30, 45],
    },
    indexValue: {
      type: Number,
      required: true,
    },
    previousIndexValue: {
      type: Number,
      default: null,
    },
    dailyChangePercent: {
      type: Number,
      default: null,
    },
    baseRelativeChangePercent: {
      type: Number,
      required: true,
    },
    basePeriod: {
      startDate: {
        type: String,
        required: true,
        trim: true,
      },
      endDate: {
        type: String,
        required: true,
        trim: true,
      },
    },
    routeCount: {
      type: Number,
      required: true,
    },
    configuredRouteCount: {
      type: Number,
      required: true,
    },
    availableRouteCount: {
      type: Number,
      required: true,
    },
    weightCoverage: {
      type: Number,
      required: true,
    },
    routes: [RoutePriceRelativeSchema],
    methodologyVersion: {
      type: String,
      default: '1.0-prototype',
      trim: true,
    },
    calculationVersion: {
      type: String,
      default: '1.0.0',
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Deterministic unique composite index isolating REAL vs DEMO environments
AirfareIndexSchema.index({ indexDate: 1, indexCode: 1, dataEnvironment: 1 }, { unique: true });
AirfareIndexSchema.index({ indexDate: -1, leadTimeBucket: 1, dataEnvironment: 1 });
AirfareIndexSchema.index({ leadTimeBucket: 1, indexDate: -1, dataEnvironment: 1 });

export const AirfareIndex = mongoose.model('AirfareIndex', AirfareIndexSchema);
