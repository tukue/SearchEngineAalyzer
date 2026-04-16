import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage, getDefaultTenantContext } from '../server/storage';
import { urlSchema, PLAN_CONFIGS } from '../shared/schema';
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

  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const pathname = requestUrl.pathname;
  
  if (pathname === '/api/health' && req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      message: 'Meta Tag Analyzer API is healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    });
  }

  if (pathname === '/api/plan' && req.method === 'GET') {
    try {
      const tenantContext = await getDefaultTenantContext();
      const planConfig = PLAN_CONFIGS[tenantContext.plan];

      return res.status(200).json({
        currentPlan: tenantContext.plan,
        entitlements: planConfig,
        tenantId: tenantContext.tenantId,
      });
    } catch (error) {
      console.error('Error fetching plan info:', error);
      return res.status(500).json({ message: 'Failed to fetch plan information' });
    }
  }

  if (pathname === '/api/usage/current' && req.method === 'GET') {
    try {
      const tenantContext = await getDefaultTenantContext();
      const period = new Date().toISOString().slice(0, 7);
      const usage = await storage.getCurrentUsage(tenantContext.tenantId, period);
      const limit = PLAN_CONFIGS[tenantContext.plan].monthlyAuditLimit;
      const used = usage?.auditCount ?? 0;
      const usageRatio = limit > 0 ? used / limit : 0;

      let warning_level: 'none' | 'warning_80' | 'warning_90' | 'exceeded' = 'none';
      if (used >= limit) {
        warning_level = 'exceeded';
      } else if (usageRatio >= 0.9) {
        warning_level = 'warning_90';
      } else if (usageRatio >= 0.8) {
        warning_level = 'warning_80';
      }

      return res.status(200).json({
        period,
        used,
        limit,
        warning_level,
      });
    } catch (error) {
      console.error('Error fetching usage status:', error);
      return res.status(500).json({ message: 'Failed to fetch usage status' });
    }
  }

  if (pathname === '/api/analyze' && req.method === 'POST') {
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

  return res.status(404).json({ message: `API endpoint not found for ${req.method} ${pathname}` });
}
