import { describe, it, expect } from 'vitest';
import { app, createApp } from '../src/app.js';

describe('Express Application Setup', () => {
  it('should export app and createApp without automatically starting the HTTP server', () => {
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');

    const newAppInstance = createApp();
    expect(newAppInstance).toBeDefined();
    expect(typeof newAppInstance.listen).toBe('function');
  });
});
