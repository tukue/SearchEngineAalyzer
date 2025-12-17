import http from 'http';
import request from 'supertest';
import type { IncomingMessage, ServerResponse } from 'http';
import handler from '../../api/index';
import fetch from 'node-fetch';

type FetchMock = typeof fetch & jest.MockedFunction<typeof fetch>;

jest.mock('node-fetch', () => ({ __esModule: true, default: jest.fn() }));

const fetchMock = fetch as FetchMock;

const createServer = () =>
  http.createServer((req, res) => {
    const vercelReq = Object.assign(req, { query: {}, body: undefined }) as IncomingMessage & {
      query: Record<string, string>;
      body: unknown;
    };
    const vercelRes = res as ServerResponse;
    return handler(vercelReq, vercelRes);
  });

describe('Analyze endpoint integration', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('rejects invalid URL payloads with a validation error', async () => {
    const server = createServer();

    const res = await request(server)
      .post('/api/analyze')
      .send({ url: 'not-a-valid-url' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.message.toLowerCase()).toContain('valid url');
  });

  it('returns a 400 when the remote site responds with a non-OK status', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => '',
      headers: new Headers({ 'content-type': 'text/html' }),
      url: 'https://example.com/missing'
    } as any);

    const server = createServer();

    const res = await request(server)
      .post('/api/analyze')
      .send({ url: 'https://example.com/missing' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Failed to fetch website: 404 Not Found');
  });

  it('returns a 400 when the remote site cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('connect ETIMEDOUT'));

    const server = createServer();

    const res = await request(server)
      .post('/api/analyze')
      .send({ url: 'https://timeout.test' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Failed to connect to the website: connect ETIMEDOUT');
  });

  it('includes recommendations when key meta tags are missing', async () => {
    const html = `
      <html>
        <head>
          <title>Missing Meta Coverage</title>
        </head>
        <body>
          <h1>Example</h1>
        </body>
      </html>
    `;

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => html,
      headers: new Headers({ 'content-type': 'text/html' }),
      url: 'https://example.com/minimal'
    } as any);

    const server = createServer();

    const res = await request(server)
      .post('/api/analyze')
      .send({ url: 'https://example.com/minimal' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.analysis.missingCount).toBeGreaterThan(0);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
    expect(res.body.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tagName: expect.stringMatching(/description|title|canonical/) })
      ])
    );
  });
});
