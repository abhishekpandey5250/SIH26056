import { getDatabaseStatus } from '../config/database.js';
import { config } from '../config/env.js';

export function getHealth(req, res) {
  try {
    const dbStatus = getDatabaseStatus();
    const isHealthy = dbStatus === 'connected';

    res.status(200).json({
      status: isHealthy ? 'healthy' : 'degraded',
      database: dbStatus,
      environment: config.nodeEnv,
    });
  } catch (error) {
    res.status(200).json({
      status: 'degraded',
      database: 'disconnected',
      environment: config.nodeEnv,
    });
  }
}
