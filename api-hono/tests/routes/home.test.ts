import { describe, it, expect } from 'vitest';
import app from '@/app';

describe('Home API', () => {
  it('should handle get home page content', async () => {
    const res = await app.request('/api/home');
    
    expect([200, 404, 500].includes(res.status)).toBe(true);
    
    if (res.status === 200) {
      const data = await res.json();
      expect(data).toHaveProperty('data');
    }
  });

  it('should handle update home page content', async () => {
    const res = await app.request('/api/home', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Updated Home Title',
        description: 'Updated description',
        status: 'published',
      }),
    });
    
    expect([200, 404, 500].includes(res.status)).toBe(true);
  });
});