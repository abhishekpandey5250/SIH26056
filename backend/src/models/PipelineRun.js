import mongoose from 'mongoose';

const PipelineRunSchema = new mongoose.Schema(
  {
    runId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    collectionDate: {
      type: String,
      required: true,
      index: true,
    },
    dataEnvironment: {
      type: String,
      enum: ['REAL', 'DEMO'],
      default: 'REAL',
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL'],
      default: 'PENDING',
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    durationMs: {
      type: Number,
      default: null,
    },
    observationsIngested: {
      type: Number,
      default: 0,
    },
    routesProcessed: {
      type: Number,
      default: 0,
    },
    indexRecordsCreated: {
      type: Number,
      default: 0,
    },
    errors: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    suppressReservedKeysWarning: true,
  }
);

PipelineRunSchema.index({ collectionDate: 1, dataEnvironment: 1 });
PipelineRunSchema.index({ startedAt: -1 });

export const PipelineRun = mongoose.model('PipelineRun', PipelineRunSchema);
