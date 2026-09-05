import mongoose from 'mongoose';

const RouteWeightSchema = new mongoose.Schema(
  {
    routeKey: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
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
    weight: {
      type: Number,
      required: true,
      min: 0,
    },
    source: {
      type: String,
      default: 'DEMO',
      trim: true,
    },
    effectiveFrom: {
      type: String,
      default: '2026-01-01',
      trim: true,
    },
    effectiveTo: {
      type: String,
      default: null,
      trim: true,
    },
    methodologyVersion: {
      type: String,
      default: '1.0-prototype',
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

RouteWeightSchema.index(
  { routeKey: 1, effectiveFrom: 1, methodologyVersion: 1 },
  { unique: true }
);

export const RouteWeight = mongoose.model('RouteWeight', RouteWeightSchema);
