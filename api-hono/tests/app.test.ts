import { describe, it, expect } from 'vitest';
import app from '@/app';

describe('Hono App', () => {
  it('should return health check', async () => {
    const res = await app.request('/health');
    
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data).toHaveProperty('status', 'healthy');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('version', '1.0.0');
  });

  it('should return 404 for unknown routes', async () => {
    const res = await app.request('/unknown');
    
    expect(res.status).toBe(404);
    
    const data = await res.json();
    expect(data).toHaveProperty('error', 'Not Found');
  });

  it('should handle CORS headers', async () => {
    const res = await app.request('/health', {
      method: 'OPTIONS',
    });
    
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  });
});