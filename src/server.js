import './config/env.js';
import { app } from './app.js';
import { config } from './config/env.js';
import { connectDB, disconnectDB } from './config/database.js';
import { logger } from './utils/logger.js';

export async function startServer() {
  // 1. Attempt database connection without blocking server startup on failure
  await connectDB();

  // 2. Start HTTP server
  const server = app.listen(config.port, () => {
    logger.info(`Airfare Index Backend running on port ${config.port} [${config.nodeEnv}]`);
    logger.info(`Health check available at http://localhost:${config.port}/api/health`);
  });

  // 3. Graceful shutdown handler
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      await disconnectDB();
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // 4. Global process error safeguards
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection:', { reason });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', { error: err.message, stack: err.stack });
  });

  return server;
}

// Auto-start server when run directly
startServer().catch((err) => {
  logger.error('Fatal error during startup:', { error: err });
});
