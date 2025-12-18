import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage, getDefaultTenantContext } from '../server/storage';
import { urlSchema } from '../shared/schema';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import * as cheerio from 'cheerio';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = (req.url || '').split('?')[0];
  
  if (path === '/api/health' && req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      message: 'Meta Tag Analyzer API is healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }

  if (path === '/api/analyze' && req.method === 'POST') {
    try {
      const { url: targetUrl } = urlSchema.parse(req.body);
      
      let normalizedUrl = targetUrl;
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      
      let response;
      try {
        response = await fetch(normalizedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MetaTagAnalyzer/1.0)'
          }
        });
        
        if (!response.ok) {
          return res.status(400).json({ 
            message: `Failed to fetch website: ${response.status} ${response.statusText}` 
          });
        }
      } catch (error) {
        return res.status(400).json({ 
          message: `Failed to connect to the website: ${error instanceof Error ? error.message : String(error)}` 
        });
      }
      
      const html = await response.text();
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
        }
      });
      
      const totalImportantTags = importantSeoTags.length + 4 + 2; // SEO + key social + key technical
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
      
      return res.json(storedAnalysis);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message || 'Invalid URL format' });
      }
      console.error('Error analyzing website:', error);
      return res.status(500).json({ message: 'Failed to analyze website' });
    }
  }

  return res.status(404).json({ message: 'API endpoint not found' });
}
