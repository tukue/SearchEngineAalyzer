import http from 'http';
import type { IncomingMessage, Server, ServerResponse } from 'http';
import request from 'supertest';
import handler from '../../api/index';
import fetch from 'node-fetch';

jest.mock('node-fetch', () => ({ __esModule: true, default: jest.fn() }));

const fetchMock = fetch as jest.MockedFunction<typeof fetch>;

const createServer = () =>
  http.createServer((req, res) => {
    const vercelReq = Object.assign(req, { query: {}, body: undefined }) as IncomingMessage & {
      query: Record<string, string>;
      body: unknown;
    };
    const vercelRes = Object.assign(res, {
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.setHeader('Content-Type', 'application/json');
        this.end(JSON.stringify(payload));
        return this;
      }
    }) as ServerResponse & {
      status: (code: number) => ServerResponse;
      json: (payload: unknown) => ServerResponse;
    };
    return handler(vercelReq, vercelRes);
  });

describe('CORS integration', () => {
  let server: Server;

  beforeEach(() => {
    fetchMock.mockReset();
    server = createServer();
  });

  afterEach(() => {
    server.close();
  });

  it('responds to OPTIONS preflight with permissive CORS headers', async () => {
    const res = await request(server).options('/api/analyze');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toContain('GET');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-headers']).toContain('Content-Type');
  });

  it('includes CORS headers on standard API responses', async () => {
    const res = await request(server).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.status).toBe('ok');
  });
});
