import http from 'http';
import request from 'supertest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../../api/index';
import fetch from 'node-fetch';

jest.mock('node-fetch', () => ({ __esModule: true, default: jest.fn() }));

const fetchMock = fetch as jest.MockedFunction<typeof fetch>;

describe('Vercel deployment API integration', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  const createServer = () =>
    http.createServer((req, res) => {
      const vercelReq = Object.assign(req, { query: {}, body: undefined }) as VercelRequest;
      const vercelRes = res as VercelResponse;
      return handler(vercelReq, vercelRes);
    });

  it('serves JSON for the health route instead of raw source', async () => {
    const server = createServer();

    const res = await request(server).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.status).toBe('ok');
    expect(res.body.message).toContain('healthy');
  });

  it('processes analyze requests through the serverless handler', async () => {
    const html = `
      <html>
        <head>
          <title>Example Page</title>
          <link rel="canonical" href="https://example.com/" />
          <meta name="description" content="Example description" />
          <meta name="keywords" content="example, meta" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta property="og:title" content="Example OG Title" />
          <meta property="og:description" content="Example OG Description" />
          <meta property="og:image" content="https://example.com/image.png" />
          <meta property="og:url" content="https://example.com/" />
          <meta property="og:type" content="website" />
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content="Example Twitter Title" />
          <meta name="twitter:description" content="Example Twitter Description" />
          <meta name="twitter:image" content="https://example.com/twitter-image.png" />
          <meta name="robots" content="index, follow" />
          <meta charset="UTF-8" />
          <meta http-equiv="content-type" content="text/html; charset=utf-8" />
          <meta name="language" content="en" />
          <meta name="author" content="Tester" />
          <meta name="generator" content="Integration Suite" />
        </head>
        <body>
          <h1>Hello World</h1>
        </body>
      </html>
    `;

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => html,
      headers: new Headers({ 'content-type': 'text/html' }),
      url: 'https://example.com'
    } as any);

    const server = createServer();

    const res = await request(server)
      .post('/api/analyze')
      .send({ url: 'https://example.com' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.analysis.url).toContain('https://example.com');
    expect(res.body.analysis.totalCount).toBeGreaterThan(0);
    expect(
      res.body.tags.some(
        (tag: { name: string; content?: string }) =>
          tag.name === 'description' && tag.content === 'Example description'
      )
    ).toBe(true);
    expect(res.body.recommendations.length).toBeGreaterThanOrEqual(0);
  });
});
