import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as databaseModule from '../src/config/database.js';

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 200 with healthy status when database is connected', async () => {
    vi.spyOn(databaseModule, 'getDatabaseStatus').mockReturnValue('connected');

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'healthy',
      database: 'connected',
      environment: expect.any(String),
    });
    expect(response.body.mongoUri).toBeUndefined();
    expect(response.body.credentials).toBeUndefined();
  });

  it('should return 200 with degraded status when database is disconnected / unavailable', async () => {
    vi.spyOn(databaseModule, 'getDatabaseStatus').mockReturnValue('disconnected');

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'degraded',
      database: 'disconnected',
      environment: expect.any(String),
    });
  });

  it('should never crash if database status check throws an exception', async () => {
    vi.spyOn(databaseModule, 'getDatabaseStatus').mockImplementation(() => {
      throw new Error('Unexpected DB error');
    });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.database).toBe('disconnected');
  });
});
