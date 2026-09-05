import mongoose from 'mongoose';

const RawObservationSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: true,
      default: 'ota_scraper',
      trim: true,
      index: true,
    },
    dataEnvironment: {
      type: String,
      enum: ['REAL', 'DEMO'],
      default: 'REAL',
      index: true,
    },
    scrapedAt: {
      type: Date,
      index: true,
    },
    origin: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    destination: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    departureDate: {
      type: String,
      trim: true,
      index: true,
    },
    returnDate: {
      type: String,
      trim: true,
      default: null,
    },
    tripType: {
      type: String,
      trim: true,
      default: 'one-way',
    },
    cabinClass: {
      type: String,
      trim: true,
      default: 'economy',
    },
    passengers: {
      type: Number,
      default: 1,
    },
    airline: {
      type: String,
      trim: true,
      index: true,
    },
    flightNumber: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    departureTime: {
      type: String,
      trim: true,
      default: null,
    },
    arrivalTime: {
      type: String,
      trim: true,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: null,
    },
    stops: {
      type: Number,
      default: null,
    },
    fare: {
      observedFare: {
        type: Number,
        default: null,
        index: true,
      },
      currency: {
        type: String,
        trim: true,
        default: null,
      },
      priceRaw: {
        type: String,
        trim: true,
        default: null,
      },
    },
    metadata: {
      searchUrl: {
        type: String,
        trim: true,
        default: null,
      },
      co2Emissions: {
        type: String,
        trim: true,
        default: null,
      },
      emissionsVariation: {
        type: String,
        trim: true,
        default: null,
      },
      rawText: {
        type: String,
        default: null,
      },
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    quality: {
      isValid: {
        type: Boolean,
        required: true,
        default: true,
        index: true,
      },
      indexEligible: {
        type: Boolean,
        required: true,
        default: false,
        index: true,
      },
      flags: {
        type: [String],
        default: [],
        index: true,
      },
      validationErrors: {
        type: [String],
        default: [],
      },
    },
    deduplicationHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound indexes for high-frequency queries in pipeline
RawObservationSchema.index({ origin: 1, destination: 1, departureDate: 1, scrapedAt: 1, dataEnvironment: 1 });
RawObservationSchema.index({ 'quality.indexEligible': 1, departureDate: 1, dataEnvironment: 1 });
RawObservationSchema.index({ scrapedAt: 1, dataEnvironment: 1 });

export const RawObservation = mongoose.model('RawObservation', RawObservationSchema);
