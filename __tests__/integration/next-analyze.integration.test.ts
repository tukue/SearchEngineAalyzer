/** @jest-environment node */

import { NextRequest } from 'next/server';
import type { NextRequestInit } from 'next/server';

jest.mock('@server/storage', () => ({
  storage: {
    createAnalysis: jest.fn(async (analysisResult: any) => {
      const analysisId = analysisResult?.analysis?.id ?? 42;

      return {
        ...analysisResult,
        analysis: {
          ...analysisResult.analysis,
          id: analysisId,
          tenantId: 1
        },
        tags: (analysisResult.tags || []).map((tag: any, index: number) => ({
          ...tag,
          id: index + 1,
          analysisId
        })),
        recommendations: (analysisResult.recommendations || []).map((rec: any, index: number) => ({
          ...rec,
          id: index + 1,
          analysisId
        }))
      };
    })
  }
}));

const loadAnalyzeHandler = async () => {
  jest.resetModules();
  process.env.NEXT_MIGRATED_API_ENDPOINTS = 'analyze';
  const module = await import('../../next/app/api/analyze/route');
  return module;
};

const buildRequest = (body: unknown, init: Partial<NextRequestInit> = {}) =>
  new NextRequest('http://localhost/api/analyze', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    ...init
  });

describe('Next.js analyze API handler', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.NEXT_MIGRATED_API_ENDPOINTS;
  });

  it('returns a persisted analysis payload for valid requests', async () => {
    const html = `
      <html>
        <head>
          <title>Example</title>
          <meta name="description" content="Site description" />
          <meta property="og:title" content="OG Title" />
          <meta name="robots" content="index" />
        </head>
      </html>
    `;

    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => html,
        json: async () => ({ html }),
        blob: async () => new Blob([html]),
        arrayBuffer: async () => new TextEncoder().encode(html).buffer,
        formData: async () => new FormData(),
        clone: function () {
          return { ...this } as Response;
        }
      } as unknown as Response);

    const { POST } = await loadAnalyzeHandler();
    const response = await POST(buildRequest({ url: 'https://example.com' }));

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': expect.stringContaining('MetaTagAnalyzer') })
      })
    );
    expect(body.analysis.url).toBe('https://example.com');
    expect(body.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'title', isPresent: true }),
        expect.objectContaining({ property: 'og:title', isPresent: true })
      ])
    );
    expect(Array.isArray(body.recommendations)).toBe(true);
    expect(body.recommendations.length).toBeGreaterThan(0);
  });

  it('rejects missing URL input with a validation error', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const { POST } = await loadAnalyzeHandler();

    const response = await POST(buildRequest({}));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.message.toLowerCase()).toContain('url');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('supports CORS preflight for analyze requests', async () => {
    const { OPTIONS } = await loadAnalyzeHandler();
    const response = OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
  });

  it('supports GET analyze requests with url query parameter', async () => {
    const html = `
      <html>
        <head>
          <title>Example</title>
          <meta name="description" content="Site description" />
        </head>
      </html>
    `;

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => html,
      json: async () => ({ html }),
      blob: async () => new Blob([html]),
      arrayBuffer: async () => new TextEncoder().encode(html).buffer,
      formData: async () => new FormData(),
      clone: function () {
        return { ...this } as Response;
      }
    } as unknown as Response);

    const { GET } = await loadAnalyzeHandler();
    const request = new NextRequest('http://localhost/api/analyze?url=https://example.com', {
      method: 'GET',
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.analysis.url).toBe('https://example.com');
  });
});
