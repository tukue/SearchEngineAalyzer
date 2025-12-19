import type { IncomingMessage, ServerResponse } from 'http';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage, getDefaultTenantContext } from '../server/storage';
import { urlSchema } from '../shared/schema';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

type NormalizedResponse = VercelResponse & ServerResponse & {
  status: (code: number) => NormalizedResponse;
  json: (body: unknown) => NormalizedResponse;
  send?: (body: unknown) => NormalizedResponse;
};

function normalizeResponse(res: VercelResponse | ServerResponse): NormalizedResponse {
  const serverRes = res as ServerResponse & Partial<VercelResponse> & Partial<NormalizedResponse>;

  if (typeof serverRes.status !== 'function') {
    serverRes.status = (code: number) => {
      serverRes.statusCode = code;
      return serverRes as NormalizedResponse;
    };
  }

  if (typeof serverRes.json !== 'function') {
    serverRes.json = (body: unknown) => {
      if (typeof serverRes.getHeader !== 'function' || !serverRes.getHeader('Content-Type')) {
        serverRes.setHeader?.('Content-Type', 'application/json');
      }

      serverRes.end(JSON.stringify(body));
      return serverRes as NormalizedResponse;
    };
  }

  if (typeof serverRes.send !== 'function') {
    serverRes.send = (body: unknown) => {
      if (typeof body === 'object') {
        return serverRes.json(body);
      }

      serverRes.end(body as any);
      return serverRes as NormalizedResponse;
    };
  }

  return serverRes as NormalizedResponse;
}

async function readBody(req: VercelRequest | (IncomingMessage & { body?: unknown })): Promise<unknown> {
  if (typeof (req as any).body !== 'undefined') {
    return (req as any).body;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req as any as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const raw = Buffer.concat(chunks).toString('utf8');

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const httpResponse = normalizeResponse(res);

  httpResponse.setHeader('Access-Control-Allow-Origin', '*');
  httpResponse.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  httpResponse.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return httpResponse.status(200).end();
  }

  const { url } = req;
  const body = await readBody(req);

  if (url === '/api/health' && req.method === 'GET') {
    return httpResponse.status(200).json({
      status: 'ok',
      message: 'Meta Tag Analyzer API is healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }

  if (url === '/api/analyze' && req.method === 'POST') {
    try {
      const { url: targetUrl } = urlSchema.parse(body ?? {});
      
      let normalizedUrl = targetUrl;
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      
      let fetchResponse;
      try {
        fetchResponse = await fetch(normalizedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MetaTagAnalyzer/1.0)'
          }
        });

        if (!fetchResponse.ok) {
          return httpResponse.status(400).json({
            message: `Failed to fetch website: ${fetchResponse.status} ${fetchResponse.statusText}`
          });
        }
      } catch (error) {
        return httpResponse.status(400).json({
          message: `Failed to connect to the website: ${error instanceof Error ? error.message : String(error)}`
        });
      }

      const html = await fetchResponse.text();
      const $ = cheerio.load(html);
      
      const importantSeoTags = ['title', 'description', 'keywords', 'viewport', 'canonical'];
      const importantSocialTags = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
      const importantTechnicalTags = ['robots', 'charset', 'content-type', 'language', 'author', 'generator'];
      
      let seoCount = 0;
      let socialCount = 0;
      let technicalCount = 0;
      let missingCount = 0;
      
      const foundMetaTags: any[] = [];
      
      const titleTag = $('title').first().text();
      if (titleTag) {
        foundMetaTags.push({
          name: 'title',
          content: titleTag,
          tagType: 'SEO',
          isPresent: true
        });
        seoCount++;
      } else {
        foundMetaTags.push({
          name: 'title',
          content: 'Missing',
          tagType: 'SEO',
          isPresent: false
        });
        missingCount++;
      }
      
      const canonicalLink = $('link[rel="canonical"]').attr('href');
      if (canonicalLink) {
        foundMetaTags.push({
          rel: 'canonical',
          content: canonicalLink,
          tagType: 'SEO',
          isPresent: true
        });
        seoCount++;
      } else {
        foundMetaTags.push({
          rel: 'canonical',
          content: 'Missing',
          tagType: 'SEO',
          isPresent: false
        });
        missingCount++;
      }
      
      $('meta').each((i, elem) => {
        const name = $(elem).attr('name');
        const property = $(elem).attr('property');
        const httpEquiv = $(elem).attr('http-equiv');
        const charset = $(elem).attr('charset');
        const content = $(elem).attr('content') || '';
        
        let tagType = 'Technical';
        
        if (name && importantSeoTags.includes(name)) {
          tagType = 'SEO';
          seoCount++;
        } else if ((name && name.startsWith('twitter:')) || (property && property.startsWith('og:'))) {
          tagType = 'Social';
          socialCount++;
        } else if (charset || httpEquiv || importantTechnicalTags.includes(name || '')) {
          tagType = 'Technical';
          technicalCount++;
        } else if (name || property) {
          tagType = 'SEO';
          seoCount++;
        }
        
        foundMetaTags.push({
          name,
          property,
          httpEquiv,
          charset,
          content,
          tagType,
          isPresent: true
        });
      });
      
      const recommendations: any[] = [];
      
      const tagExists = (tagName: string) => {
        return foundMetaTags.some(tag => 
          (tag.name === tagName || tag.property === tagName || 
          (tag.name === 'title' && tagName === 'title'))
        );
      };
      
        importantSeoTags.forEach(tag => {
          if (!tagExists(tag)) {
            foundMetaTags.push({
              name: tag,
              content: 'Missing',
              tagType: 'SEO',
              isPresent: false
            });
            missingCount++;

            let example = '';
            let description = '';

            switch(tag) {
              case 'title':
                example = '<title>Your Page Title | Your Website Name</title>';
                description = 'Title tags are crucial for SEO and user experience. They appear in browser tabs and search results.';
                break;
              case 'description':
                example = '<meta name="description" content="A brief description of your page content.">';
                description = 'Meta descriptions provide a summary of your page content for search results.';
                break;
              case 'keywords':
                example = '<meta name="keywords" content="keyword1, keyword2, keyword3">';
                description = 'While less important than before, keywords can still help categorize your content.';
                break;
              case 'viewport':
                example = '<meta name="viewport" content="width=device-width, initial-scale=1">';
                description = 'Viewport meta tag ensures proper rendering on mobile devices and is a factor in mobile-friendly rankings.';
                break;
              case 'canonical':
                example = '<link rel="canonical" href="https://example.com/page">';
                description = 'Canonical URLs help prevent duplicate content issues by specifying the preferred version of a page.';
                break;
            }

            recommendations.push({
              tagName: tag,
              description,
              example
            });
          }
        });

        importantSocialTags.forEach(tag => {
          if (!tagExists(tag)) {
            foundMetaTags.push({
              property: tag.includes('og:') ? tag : undefined,
              name: tag.includes('twitter:') ? tag : undefined,
              content: 'Missing',
              tagType: 'Social',
              isPresent: false
            });
            missingCount++;

            if (['og:title', 'og:description', 'og:image', 'twitter:card', 'twitter:image'].includes(tag)) {
              let example = '';
              let description = '';

              switch(tag) {
                case 'og:title':
                  example = '<meta property="og:title" content="Your Page Title">';
                  description = 'Open Graph title is used when your content is shared on Facebook and other platforms.';
                  break;
                case 'og:description':
                  example = '<meta property="og:description" content="A description of your page for social sharing.">';
                  description = 'Open Graph description appears in social media post previews.';
                  break;
                case 'og:image':
                  example = '<meta property="og:image" content="https://example.com/image.jpg">';
                  description = 'Open Graph image is displayed when your content is shared on social media.';
                  break;
                case 'twitter:card':
                  example = '<meta name="twitter:card" content="summary_large_image">';
                  description = 'Twitter card type controls how your content appears when shared on Twitter.';
                  break;
                case 'twitter:image':
                  example = '<meta name="twitter:image" content="https://example.com/image.jpg">';
                  description = 'Twitter image is displayed when your content is shared on Twitter.';
                  break;
              }

              recommendations.push({
                tagName: tag,
                description,
                example
              });
            }
          }
        });

        importantTechnicalTags.forEach(tag => {
          if (!tagExists(tag) && ['robots', 'charset', 'content-type'].includes(tag)) {
            foundMetaTags.push({
              name: ['robots', 'author', 'generator', 'language'].includes(tag) ? tag : undefined,
              httpEquiv: ['content-type'].includes(tag) ? tag : undefined,
              charset: tag === 'charset' ? 'missing' : undefined,
              content: 'Missing',
              tagType: 'Technical',
              isPresent: false
            });
            missingCount++;

            if (['robots', 'charset'].includes(tag)) {
              let example = '';
              let description = '';

              switch(tag) {
                case 'robots':
                  example = '<meta name="robots" content="index, follow">';
                  description = 'Robots meta tag tells search engines how to crawl and index your page.';
                  break;
                case 'charset':
                  example = '<meta charset="UTF-8">';
                  description = 'Character set declaration ensures proper text encoding.';
                  break;
              }

              recommendations.push({
                tagName: tag,
                description,
                example
              });
            }
          }
        });

        const totalImportantTags =
          importantSeoTags.length +
          importantSocialTags.filter(t => ['og:title', 'og:description', 'og:image', 'twitter:card'].includes(t)).length +
          importantTechnicalTags.filter(t => ['robots', 'charset'].includes(t)).length;
      const presentImportantTags = totalImportantTags - missingCount;
      const healthScore = Math.round((presentImportantTags / totalImportantTags) * 100);
      
      const analysisResult = {
        analysis: {
          url: normalizedUrl,
          totalCount: foundMetaTags.length,
          seoCount,
          socialCount,
          technicalCount, 
          missingCount,
          healthScore,
          timestamp: new Date().toISOString()
        },
        tags: foundMetaTags,
        recommendations
      };
      
      const tenantContext = await getDefaultTenantContext();
      const storedAnalysis = await storage.createAnalysis(tenantContext.tenantId, analysisResult);
      
      return httpResponse.json(storedAnalysis);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return httpResponse.status(400).json({ message: validationError.message || 'Invalid URL format' });
      }
      console.error('Error analyzing website:', error);
      return httpResponse.status(500).json({ message: 'Failed to analyze website' });
    }
  }

  return httpResponse.status(404).json({ message: 'API endpoint not found' });
}