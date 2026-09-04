import mongoose from 'mongoose';

const DailyRouteAggregationSchema = new mongoose.Schema(
  {
    collectionDate: {
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
    routeKey: {
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
    representativeFare: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
      trim: true,
    },
    cabinClass: {
      type: String,
      required: true,
      default: 'economy',
      trim: true,
    },
    observationCount: {
      type: Number,
      required: true,
      default: 0,
    },
    eligibleObservationCount: {
      type: Number,
      required: true,
      default: 0,
    },
    minFare: {
      type: Number,
      required: true,
    },
    maxFare: {
      type: Number,
      required: true,
    },
    quality: {
      flaggedObservationCount: {
        type: Number,
        default: 0,
      },
      ineligibleObservationCount: {
        type: Number,
        default: 0,
      },
    },
    sourceBreakdown: {
      type: Map,
      of: Number,
      default: {},
    },
    calculationVersion: {
      type: String,
      default: '1.0.0',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Deterministic unique compound index ensuring idempotency and isolating REAL vs DEMO environments
DailyRouteAggregationSchema.index(
  { collectionDate: 1, routeKey: 1, leadTimeBucket: 1, dataEnvironment: 1 },
  { unique: true }
);

// Secondary query index for index calculation pipelines
DailyRouteAggregationSchema.index({ collectionDate: 1, leadTimeBucket: 1, dataEnvironment: 1 });

export const DailyRouteAggregation = mongoose.model(
  'DailyRouteAggregation',
  DailyRouteAggregationSchema
);
