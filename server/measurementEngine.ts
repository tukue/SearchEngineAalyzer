import * as cheerio from "cheerio";
import { type AnalysisResult, type MetaTag } from "@shared/schema";

// Interfaces following SOLID principles
export interface MVPMeasurements {
  seoVisibleAtFirstByte: number;
  prioritizedHealthScore: number;
  sharePreviewConfidence: number;
}

export interface MeasurementCalculator {
  calculate(html: string, analysisResult: AnalysisResult): number;
}

export interface HTMLParser {
  parse(html: string): cheerio.CheerioAPI;
}

export interface TagFinder {
  findTag(tags: MetaTag[], criteria: TagCriteria): MetaTag | undefined;
}

export interface TagCriteria {
  name?: string;
  property?: string;
  rel?: string;
}

// Clean Architecture - Domain Services
export class CheerioHTMLParser implements HTMLParser {
  parse(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }
}

export class MetaTagFinder implements TagFinder {
  findTag(tags: MetaTag[], criteria: TagCriteria): MetaTag | undefined {
    return tags.find(tag => 
      tag.isPresent &&
      (!criteria.name || tag.name === criteria.name) &&
      (!criteria.property || tag.property === criteria.property) &&
      (!criteria.rel || tag.rel === criteria.rel)
    );
  }
}

// Single Responsibility Principle - Each calculator has one job
export class SeoVisibilityCalculator implements MeasurementCalculator {
  constructor(
    private htmlParser: HTMLParser,
    private tagFinder: TagFinder
  ) {}

  calculate(html: string, analysisResult: AnalysisResult): number {
    const $ = this.htmlParser.parse(html);
    let score = 0;
    
    // Title (30%)
    const titleTag = this.tagFinder.findTag(analysisResult.tags, { name: 'title' });
    if (titleTag?.content && titleTag.content.length > 10) {
      score += 30;
    }
    
    // Description (25%)
    const descTag = this.tagFinder.findTag(analysisResult.tags, { name: 'description' });
    if (descTag?.content && descTag.content.length > 50) {
      score += 25;
    }
    
    // H1 (20%)
    const h1 = $("h1").first().text();
    if (h1 && h1.length > 5) {
      score += 20;
    }
    
    // Structured data (15%)
    const hasStructuredData = $('script[type="application/ld+json"]').length > 0 || $('[itemscope]').length > 0;
    if (hasStructuredData) {
      score += 15;
    }
    
    // Other elements (10%)
    const canonical = this.tagFinder.findTag(analysisResult.tags, { rel: 'canonical' });
    const robots = this.tagFinder.findTag(analysisResult.tags, { name: 'robots' });
    if (canonical || robots) {
      score += 10;
    }
    
    return Math.min(score, 100);
  }
}

export class PrioritizedHealthCalculator implements MeasurementCalculator {
  constructor(private tagFinder: TagFinder) {}

  calculate(_html: string, analysisResult: AnalysisResult): number {
    const weights = {
      title: 25, description: 20, ogTitle: 15, ogDescription: 15,
      ogImage: 10, canonical: 10, viewport: 5
    };
    
    let score = 0;
    const { tags } = analysisResult;
    
    if (this.tagFinder.findTag(tags, { name: 'title' })) score += weights.title;
    if (this.tagFinder.findTag(tags, { name: 'description' })) score += weights.description;
    if (this.tagFinder.findTag(tags, { property: 'og:title' })) score += weights.ogTitle;
    if (this.tagFinder.findTag(tags, { property: 'og:description' })) score += weights.ogDescription;
    if (this.tagFinder.findTag(tags, { property: 'og:image' })) score += weights.ogImage;
    if (this.tagFinder.findTag(tags, { rel: 'canonical' })) score += weights.canonical;
    if (this.tagFinder.findTag(tags, { name: 'viewport' })) score += weights.viewport;
    
    return Math.min(score, 100);
  }
}

export class SharePreviewCalculator implements MeasurementCalculator {
  constructor(private tagFinder: TagFinder) {}

  calculate(_html: string, analysisResult: AnalysisResult): number {
    let score = 0;
    const { tags } = analysisResult;
    
    // Open Graph (60%)
    const ogTitle = this.tagFinder.findTag(tags, { property: 'og:title' });
    const ogDesc = this.tagFinder.findTag(tags, { property: 'og:description' });
    const ogImage = this.tagFinder.findTag(tags, { property: 'og:image' });
    const ogUrl = this.tagFinder.findTag(tags, { property: 'og:url' });
    
    if (ogTitle?.content && ogTitle.content.length > 5) score += 20;
    if (ogDesc?.content && ogDesc.content.length > 20) score += 20;
    if (ogImage?.content?.startsWith('http')) score += 15;
    if (ogUrl?.content?.startsWith('http')) score += 5;
    
    // Twitter (30%)
    const twitterCard = this.tagFinder.findTag(tags, { name: 'twitter:card' });
    const twitterTitle = this.tagFinder.findTag(tags, { name: 'twitter:title' });
    const twitterDesc = this.tagFinder.findTag(tags, { name: 'twitter:description' });
    const twitterImage = this.tagFinder.findTag(tags, { name: 'twitter:image' });
    
    if (twitterCard) score += 10;
    if (twitterTitle?.content) score += 5;
    if (twitterDesc?.content) score += 5;
    if (twitterImage?.content?.startsWith('http')) score += 10;
    
    // Fallback (10%)
    if (!ogTitle && this.tagFinder.findTag(tags, { name: 'title' })?.content) score += 5;
    if (!ogDesc && this.tagFinder.findTag(tags, { name: 'description' })?.content) score += 5;
    
    return Math.min(score, 100);
  }
}

// Factory Pattern for Dependency Injection
export class MVPMeasurementFactory {
  static create(): {
    seoCalculator: MeasurementCalculator;
    healthCalculator: MeasurementCalculator;
    shareCalculator: MeasurementCalculator;
  } {
    const htmlParser = new CheerioHTMLParser();
    const tagFinder = new MetaTagFinder();
    
    return {
      seoCalculator: new SeoVisibilityCalculator(htmlParser, tagFinder),
      healthCalculator: new PrioritizedHealthCalculator(tagFinder),
      shareCalculator: new SharePreviewCalculator(tagFinder)
    };
  }
}

// Main function following KISS principle
export function calculateMVPMeasurements(html: string, analysisResult: AnalysisResult): MVPMeasurements {
  const { seoCalculator, healthCalculator, shareCalculator } = MVPMeasurementFactory.create();
  
  return {
    seoVisibleAtFirstByte: seoCalculator.calculate(html, analysisResult),
    prioritizedHealthScore: healthCalculator.calculate(html, analysisResult),
    sharePreviewConfidence: shareCalculator.calculate(html, analysisResult),
  };
}

