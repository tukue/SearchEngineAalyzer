import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage, getDefaultTenantContext } from '../server/storage';
import { urlSchema } from '../shared/schema';
import { z } from 'zod';
import { formatZodError } from '@shared/validation';
import { analyzeUrl } from '../server/services/analysis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req;
  
  if (url === '/api/health' && req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      message: 'Meta Tag Analyzer API is healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }

  if (url === '/api/analyze' && req.method === 'POST') {
    try {
      const { url: targetUrl } = urlSchema.parse(req.body);
      
      let normalizedUrl = targetUrl;
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }

      const tenantContext = await getDefaultTenantContext();
      
      // Use the refactored service
      const analysisResult = await analyzeUrl(normalizedUrl, {
        tenantId: tenantContext.tenantId,
      });
      
      // Store the results
      const storedAnalysis = await storage.createAnalysis(tenantContext.tenantId, analysisResult);
      
      return res.json(storedAnalysis);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = formatZodError(error);
        return res.status(400).json({ message: validationError || 'Invalid URL format' });
      }
      if ((error as any).status) {
        return res.status((error as any).status).json({ message: (error as Error).message });
      }
      console.error('Error analyzing website:', error);
      return res.status(500).json({ message: 'Failed to analyze website' });
    }
  }

  return res.status(404).json({ message: 'API endpoint not found' });
}
