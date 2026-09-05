import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.js';
import { requestLogger } from './middleware/logging.middleware.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();

  // 1. Security & Parsing Middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 2. HTTP Request Logger
  app.use(requestLogger);

  // 3. API Routes
  app.use('/api', apiRoutes);

  // 4. 404 Handler for undefined routes
  app.use(notFoundHandler);

  // 5. Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
