import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireEntitlement, PlanGatingService } from "./plan-gating";
import { checkAndReserveQuota, addQuotaToResponse, UsageLimitsService } from "./usage-limits";
import express from "express";
import { urlSchema, AuditRequest, PLAN_CONFIGS, TenantContext } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { fetchWithNetworkLimits, validatePublicHttpsUrl, createHttpError } from "./url-safety";
import * as cheerio from "cheerio";
import { requireAuthContext } from "./context";
import { isNextApiEnabled } from "./next-api-flags";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  const apiRouter = express.Router();
  
  // Middleware to add tenant context (simplified for MVP - uses default tenant)
  apiRouter.use(async (req, res, next) => {
    try {
      // In production, extract tenant from JWT token or request headers
      req.tenantContext = await getDefaultTenantContext();
      next();
    } catch (error) {
      console.error('Failed to load tenant context:', error);
      // Differentiate between authentication and system errors
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(401).json({ message: "Authentication required" });
      } else {
        res.status(500).json({ message: "System error occurred" });
      }
    }
  });

  const nextApiFlags = {
    plan: isNextApiEnabled("plan"),
    quota: isNextApiEnabled("quota"),
    history: isNextApiEnabled("history"),
    analyze: isNextApiEnabled("analyze"),
    export: isNextApiEnabled("export"),
  };

  // Health check endpoint for CI/CD
  apiRouter.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      message: "Meta Tag Analyzer API is healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });
  });

  apiRouter.use(requireAuthContext);

  // Get current plan and entitlements with quota status
  if (!nextApiFlags.plan) {
    apiRouter.get("/plan", async (req, res) => {
      try {
        const tenantContext = req.tenantContext as TenantContext;
        const planConfig = PLAN_CONFIGS[tenantContext.plan];
        const quotaStatus = await UsageLimitsService.getQuotaStatus(tenantContext.tenantId);

        res.json({
          currentPlan: tenantContext.plan,
          entitlements: planConfig,
          tenantId: tenantContext.tenantId,
          quota: quotaStatus
        });
      } catch (error) {
        console.error("Error fetching plan info:", error);
        res.status(500).json({ message: "Failed to fetch plan information" });
      }
    });
  }
  
  // Get current quota status
  if (!nextApiFlags.quota) {
    apiRouter.get("/quota", async (req, res) => {
      try {
        const tenantContext = req.tenantContext as TenantContext;
        const quotaStatus = await UsageLimitsService.getQuotaStatus(tenantContext.tenantId);

        res.json(quotaStatus);
      } catch (error) {
        console.error("Error fetching quota status:", error);
        res.status(500).json({ message: "Failed to fetch quota status" });
      }
    });
  }
  
  // Get analysis history with plan-based depth limiting
  if (!nextApiFlags.history) {
    apiRouter.get("/history", async (req, res) => {
      try {
        const tenantContext = req.tenantContext as TenantContext;
        const historyDepth = PlanGatingService.getQuotaLimit(tenantContext, 'historyDepth');

        const history = await storage.getAnalysisHistory(tenantContext.tenantId, historyDepth);

        res.json({
          analyses: history,
          limit: historyDepth,
          currentPlan: tenantContext.plan
        });
      } catch (error) {
        console.error("Error fetching history:", error);
        res.status(500).json({ message: "Failed to fetch analysis history" });
      }
    });
  }
  
  // Export analysis (gated feature)
  if (!nextApiFlags.export) {
    apiRouter.post("/export/:id", requireEntitlement('exportsEnabled'), async (req, res) => {
      try {
        const tenantContext = req.tenantContext as TenantContext;
        const analysisId = parseInt(req.params.id);
        const format = req.body.format || 'json'; // json, pdf, html

        const analysis = await storage.getAnalysis(tenantContext.tenantId, analysisId);
        if (!analysis) {
          return res.status(404).json({ message: "Analysis not found" });
        }

        // Increment export usage
        await storage.incrementUsage(tenantContext.tenantId, 'export');

        // For MVP, just return the analysis data
        // In production, this would generate PDF/HTML exports
        res.json({
          message: "Export generated successfully",
          format,
          data: analysis
        });
      } catch (error) {
        console.error("Error exporting analysis:", error);
        res.status(500).json({ message: "Failed to export analysis" });
      }
    });
  }
  
  // Analyze URL endpoint with quota checking and reservation
  if (!nextApiFlags.analyze) {
    apiRouter.post("/analyze", checkAndReserveQuota(), addQuotaToResponse(), async (req, res) => {
      const tenantContext = req.tenantContext!;
      const requestId = req.auditRequestId!;

      try {
      // Validate request
      const auditRequest = AuditRequest.parse({
        ...req.body,
        userId: req.tenantContext?.userId,
      });
      const { url } = auditRequest;

      if (tenantContext.role === "read-only") {
        throw createHttpError("Insufficient role for this action", 403);
      }

      const parsedUrl = await validatePublicHttpsUrl(url, `tenant=${tenantContext.tenantId}`);
      const normalizedUrl = parsedUrl.toString();

      let response;
      try {
        response = await fetchWithNetworkLimits(normalizedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; MetaTagAnalyzer/1.0)",
          },
        });
      } catch (error) {
        throw createHttpError(
          `Failed to connect to the website: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (!response.ok) {
        throw createHttpError(`Failed to fetch website: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      
      // Parse meta tags
      const $ = cheerio.load(html);
      
      // Important meta tag categories and their respective tags
      const importantSeoTags = ['title', 'description', 'keywords', 'viewport', 'canonical'];
      const importantSocialTags = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
      const importantTechnicalTags = ['robots', 'charset', 'content-type', 'language', 'author', 'generator'];
      
      // Initialize counts
      let seoCount = 0;
      let socialCount = 0;
      let technicalCount = 0;
      let missingCount = 0;
      
      // Store found meta tags
      const foundMetaTags: any[] = [];
      
      // Process title tag separately as it's not a meta tag
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
      
      // Process canonical link
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
      
      // Process meta tags
      $('meta').each((i, elem) => {
        const name = $(elem).attr('name');
        const property = $(elem).attr('property');
        const httpEquiv = $(elem).attr('http-equiv');
        const charset = $(elem).attr('charset');
        const content = $(elem).attr('content') || '';
        
        let tagName = name || property || httpEquiv || 'charset';
        let tagType = 'Technical';
        
        // Determine tag type
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
          // Default other named meta tags to SEO
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
      
      // Check for missing important tags
      const recommendations: any[] = [];
      
      // Function to check if a tag exists
      const tagExists = (tagName: string) => {
        return foundMetaTags.some(tag => 
          (tag.name === tagName || tag.property === tagName || 
          (tag.name === 'title' && tagName === 'title'))
        );
      };
      
      // Check for missing SEO tags
      importantSeoTags.forEach(tag => {
        if (!tagExists(tag)) {
          foundMetaTags.push({
            name: tag,
            content: 'Missing',
            tagType: 'SEO',
            isPresent: false
          });
          missingCount++;
          
          // Add recommendation
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
      
      // Check for missing social tags
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
          
          // Add recommendation for key social tags
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
      
      // Check for missing technical tags
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
          
          // Add recommendation for key technical tags
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
      
      // Calculate health score (simplified algorithm)
      const totalImportantTags = importantSeoTags.length + 
                                 importantSocialTags.filter(t => ['og:title', 'og:description', 'og:image', 'twitter:card'].includes(t)).length + 
                                 importantTechnicalTags.filter(t => ['robots', 'charset'].includes(t)).length;
      
      const presentImportantTags = totalImportantTags - missingCount;
      const healthScore = Math.round((presentImportantTags / totalImportantTags) * 100);
      
      // Create analysis record
      const totalTags = foundMetaTags.length;
      
      const analysisResult = {
        analysis: {
          id: 0, // Will be assigned by storage
          url: normalizedUrl,
          totalCount: totalTags,
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
      
      // Store the results
      const storedAnalysis = await storage.createAnalysis(tenantContext.tenantId, analysisResult);
      
      // Mark audit as completed
      await UsageLimitsService.completeAudit(tenantContext.tenantId, requestId);
      
      // Increment legacy usage tracking
      await storage.incrementUsage(tenantContext.tenantId, 'audit');
      
      res.json(storedAnalysis);
    } catch (error) {
      // Mark audit as failed
      try {
        await UsageLimitsService.failAudit(tenantContext.tenantId, requestId);
      } catch (failError) {
        console.error("Error marking audit as failed:", failError);
      }
      
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message || "Invalid request format" });
      }

      if ((error as any).status) {
        return res.status((error as any).status).json({ message: (error as Error).message });
      }

      console.error("Error analyzing website:", error);
      res.status(500).json({ message: "Failed to analyze website" });
    }
  });
  }
  
  app.use("/api", apiRouter);
  
  const httpServer = createServer(app);
  return httpServer;
}
