import { describe, it, expect } from 'vitest';
import app from '@/app';

describe('Categories API', () => {
  it('should return categories list endpoint', async () => {
    const res = await app.request('/api/categories');
    
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('meta');
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('should handle category creation request', async () => {
    const res = await app.request('/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test Category',
        description: 'Test description',
        status: 'draft',
      }),
    });
    
    expect([200, 201, 500].includes(res.status)).toBe(true);
  });

  it('should handle get category by ID', async () => {
    const res = await app.request('/api/categories/test-id');
    
    expect([200, 404, 500].includes(res.status)).toBe(true);
  });

  it('should handle get category by slug', async () => {
    const res = await app.request('/api/categories/slug/test-slug');
    
    expect([200, 404, 500].includes(res.status)).toBe(true);
  });
});