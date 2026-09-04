import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

export function errorHandler(err, req, res, _next) {
  // 1. Handle JSON syntax errors from body-parser / express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.warn(`Malformed JSON in request: ${req.method} ${req.originalUrl}`);
    res.status(400).json({
      status: 'error',
      message: 'Malformed JSON payload in request body',
    });
    return;
  }

  // 2. Handle Known Operational AppErrors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`Operational AppError: ${err.message}`, { stack: err.stack, details: err.details });
    } else {
      logger.warn(`Operational Client Error [${err.statusCode}]: ${err.message}`, { details: err.details });
    }

    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // 3. Handle Unexpected Uncaught Errors
  const unexpectedError = err instanceof Error ? err : new Error(String(err));
  logger.error(`Unhandled Exception: ${unexpectedError.message}`, {
    stack: unexpectedError.stack,
    method: req.method,
    url: req.originalUrl,
  });

  const responseMessage = config.isProduction ? 'Internal server error' : unexpectedError.message;

  res.status(500).json({
    status: 'error',
    message: responseMessage,
    ...(!config.isProduction && unexpectedError.stack ? { stack: unexpectedError.stack } : {}),
  });
}
