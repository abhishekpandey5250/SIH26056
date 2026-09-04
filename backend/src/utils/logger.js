import winston from 'winston';
import { config } from '../config/env.js';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// Custom format for local development
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const errorStack = stack ? `\n${stack}` : '';
  return `[${timestamp}] [${level}]: ${message}${metaStr}${errorStack}`;
});

export const logger = winston.createLogger({
  level: config.isProduction ? 'info' : (config.isTest ? 'warn' : 'debug'),
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    config.isProduction ? json() : combine(colorize({ all: true }), consoleFormat)
  ),
  transports: [
    new winston.transports.Console({
      silent: config.isTest && process.env.ENABLE_TEST_LOGS !== 'true',
    }),
  ],
});
