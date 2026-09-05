import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

export function getDatabaseStatus() {
  switch (mongoose.connection.readyState) {
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    case 0:
    default:
      return 'disconnected';
  }
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  try {
    const rawUri = config.mongoUri;
    const sanitizedUri = rawUri.replace(/\/\/(.*?)@/, '//***:***@');
    logger.info(`Attempting MongoDB connection to ${sanitizedUri}...`);

    await mongoose.connect(rawUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      dbName: 'airfare_index',
      autoIndex: true,
    });

    logger.info('MongoDB connected successfully');
    return true;
  } catch (err) {
    logger.warn(`MongoDB initial connection failed: ${err.message}. Running in degraded database mode.`);
    return false;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  }
}

mongoose.connection.on('connected', () => {
  logger.info('MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error occurred:', { error: err.message });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection lost / disconnected');
});
