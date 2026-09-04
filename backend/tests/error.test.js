import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { app } from '../src/app.js';
import { AppError } from '../src/utils/AppError.js';
import { errorHandler } from '../src/middleware/error.middleware.js';

describe('Centralized Error Handling', () => {
  it('should return controlled 404 JSON for unknown routes', async () => {
    const response = await request(app).get('/api/non-existent-route-12345');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 'error',
      message: expect.stringContaining('Route not found'),
    });
  });

  it('should return controlled 400 JSON when malformed JSON payload is sent', async () => {
    const response = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{ "invalidJson": broken }');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Malformed JSON payload in request body',
    });
  });

  it('should handle AppError with custom status code and message', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/test-error', () => {
      throw new AppError('Custom operational error message', 422, { field: 'sample' });
    });
    testApp.use(errorHandler);

    const response = await request(testApp).get('/test-error');

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Custom operational error message',
      details: { field: 'sample' },
    });
  });

  it('should catch unexpected errors gracefully without crashing the process', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/test-crash', () => {
      throw new Error('Database unexpected failure');
    });
    testApp.use(errorHandler);

    const response = await request(testApp).get('/test-crash');

    expect(response.status).toBe(500);
    expect(response.body.status).toBe('error');
    expect(response.body.message).toBeDefined();
  });
});
