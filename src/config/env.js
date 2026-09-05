import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Search for .env files in multiple standard locations
const potentialEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(__dirname, '../../.env'), // backend/.env
  path.resolve(__dirname, '../../../.env'), // root .env
];

// Load all found .env files (without overriding already set process.env variables)
for (const envPath of potentialEnvPaths) {
  try {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  } catch (err) {
    // Ignore read errors
  }
}

// Case-insensitive environment variable resolution
export const config = {
  port: parseInt(process.env.PORT || process.env.port || '5000', 10) || 5000,
  mongoUri:
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.mongoUri ||
    process.env.mongo_uri ||
    process.env.DATABASE_URL ||
    process.env.database_url ||
    'mongodb://localhost:27017/airfare_index',
  scraperApiKey:
    process.env.SCRAPER_API_KEY ||
    process.env.scraperApiKey ||
    process.env.SCRAPER_KEY ||
    process.env.scraper_key ||
    '',
  nodeEnv: process.env.NODE_ENV || process.env.nodeEnv || 'development',
  corsOrigin: process.env.CORS_ORIGIN || process.env.corsOrigin || 'http://localhost:5173',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  isTest: (process.env.NODE_ENV || 'development') === 'test',
};
