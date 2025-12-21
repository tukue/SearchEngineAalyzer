import { NextRequest } from 'next/server';
import { GET as healthHandler } from '../../next/app/api/health/route';

const createRequest = (path = '/api/health') => new NextRequest(`http://localhost${path}`);

describe('Next.js health route', () => {
  const originalEnv = process.env.NEXT_MIGRATED_API_ENDPOINTS;

  afterEach(() => {
    process.env.NEXT_MIGRATED_API_ENDPOINTS = originalEnv;
  });

  it('returns ok when the health endpoint is enabled', async () => {
    process.env.NEXT_MIGRATED_API_ENDPOINTS = 'health,analyze';

    const res = healthHandler(createRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.message).toContain('healthy');
    expect(typeof body.timestamp).toBe('string');
    expect(body.version).toBe('1.0.0');
  });

  it('returns ok when no migration list is provided', async () => {
    delete process.env.NEXT_MIGRATED_API_ENDPOINTS;

    const res = healthHandler(createRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('returns a 503 when the endpoint is disabled via migration gating', async () => {
    process.env.NEXT_MIGRATED_API_ENDPOINTS = 'analyze';

    const res = healthHandler(createRequest());

    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).toContain('application/json');

    const body = await res.json();
    expect(body.message).toContain('disabled');
  });
});
