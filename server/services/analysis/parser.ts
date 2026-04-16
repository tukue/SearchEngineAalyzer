import * as cheerio from "cheerio";
import { ParsedData, TagResult, AuditCheck, CrawlMetrics } from "./types";

const normalize = (value?: string | null): string => (value || "").trim();

const textWordCount = (text: string): number => {
  const words = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return words.length;
};

const estimateReadability = (text: string): number => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return 0;

  const sentences = Math.max(1, clean.split(/[.!?]+/).filter(Boolean).length);
  const words = Math.max(1, clean.split(/\s+/).filter(Boolean).length);
  const syllables = clean
    .toLowerCase()
    .split(/\s+/)
    .reduce((count, word) => {
      const matches = word.match(/[aeiouy]+/g);
      return count + Math.max(1, matches?.length || 0);
    }, 0);

  // Flesch reading ease approximation (0-100)
  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  return Math.max(0, Math.min(100, Math.round(score)));
};

export class HtmlParser {
  static parse(html: string, analyzedUrl: string, metrics: CrawlMetrics): ParsedData {
    const $ = cheerio.load(html, { decodeEntities: true });
    const tags: TagResult[] = [];
    const checks: AuditCheck[] = [];
    let seoCount = 0;
    let socialCount = 0;
    let technicalCount = 0;
    let missingCount = 0;

    const addTag = (tag: TagResult) => {
      tags.push(tag);
      if (tag.tagType === "SEO") seoCount++;
      if (tag.tagType === "Social") socialCount++;
      if (tag.tagType === "Technical") technicalCount++;
      if (!tag.isPresent) missingCount++;
    };

    const addCheck = (check: AuditCheck) => {
      checks.push(check);
      if (!check.passed) {
        addTag({
          name: `check:${check.key}`,
          content: check.issue || "Missing",
          tagType: check.category === "Technical SEO" ? "Technical" : "SEO",
          isPresent: false,
        });
      }
    };

    const title = normalize($("title").first().text());
    const metaDescription = normalize($('meta[name="description"]').attr("content"));
    const viewport = normalize($('meta[name="viewport"]').attr("content"));
    const robotsMeta = normalize($('meta[name="robots"]').attr("content"));
    const canonical = normalize($('link[rel="canonical"]').first().attr("href"));

    addTag({ name: "title", content: title || "Missing", tagType: "SEO", isPresent: Boolean(title) });
    addTag({
      name: "description",
      content: metaDescription || "Missing",
      tagType: "SEO",
      isPresent: Boolean(metaDescription),
    });
    addTag({ name: "viewport", content: viewport || "Missing", tagType: "Technical", isPresent: Boolean(viewport) });
    addTag({ name: "robots", content: robotsMeta || "Missing", tagType: "Technical", isPresent: Boolean(robotsMeta) });
    addTag({ rel: "canonical", content: canonical || "Missing", tagType: "SEO", isPresent: Boolean(canonical) });

    const hasOgTitle = Boolean(normalize($('meta[property="og:title"]').attr("content")));
    const hasOgDescription = Boolean(normalize($('meta[property="og:description"]').attr("content")));
    const hasTwitterCard = Boolean(normalize($('meta[name="twitter:card"]').attr("content")));

    addTag({ property: "og:title", content: hasOgTitle ? "present" : "Missing", tagType: "Social", isPresent: hasOgTitle });
    addTag({
      property: "og:description",
      content: hasOgDescription ? "present" : "Missing",
      tagType: "Social",
      isPresent: hasOgDescription,
    });
    addTag({
      name: "twitter:card",
      content: hasTwitterCard ? "present" : "Missing",
      tagType: "Social",
      isPresent: hasTwitterCard,
    });

    const h1Count = $("h1").length;
    const headings = $("h1, h2, h3")
      .map((_, el) => Number(el.tagName.replace("h", "")))
      .get();

    let validHierarchy = true;
    for (let i = 1; i < headings.length; i++) {
      if (headings[i] - headings[i - 1] > 1) {
        validHierarchy = false;
        break;
      }
    }

    const bodyText = normalize($("body").text());
    const wordCount = textWordCount(bodyText);
    const readability = estimateReadability(bodyText);

    const images = $("img").toArray();
    const imagesMissingAlt = images.filter((image) => !normalize($(image).attr("alt"))).length;

    const links = $("a[href]").toArray();
    const base = new URL(metrics.finalUrl || analyzedUrl);
    let internalLinks = 0;
    let externalLinks = 0;
    let externalWithoutRel = 0;

    for (const link of links) {
      const href = normalize($(link).attr("href"));
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
      try {
        const resolved = new URL(href, base);
        if (resolved.hostname === base.hostname) {
          internalLinks++;
        } else {
          externalLinks++;
          const rel = normalize($(link).attr("rel")).toLowerCase();
          if (!rel.includes("nofollow") && !rel.includes("noopener")) {
            externalWithoutRel++;
          }
        }
      } catch {
        continue;
      }
    }

    const bodyLower = bodyText.toLowerCase();
    const titleLower = title.toLowerCase();
    const mainKeyword = titleLower
      .split(/\W+/)
      .filter((part) => part.length > 3)
      .slice(0, 2)
      .join(" ");

    const keywordInBody = mainKeyword ? bodyLower.includes(mainKeyword) : false;
    const headingText = $("h1, h2, h3")
      .map((_, el) => normalize($(el).text()).toLowerCase())
      .get()
      .join(" ");
    const keywordInHeadings = mainKeyword ? headingText.includes(mainKeyword) : false;

    const keywordTokens = mainKeyword.split(" ").filter(Boolean);
    const tokenOccurrences = keywordTokens.reduce((total, token) => {
      const matches = bodyLower.match(new RegExp(`\\b${token}\\b`, "g"));
      return total + (matches?.length || 0);
    }, 0);
    const stuffingRatio = wordCount > 0 ? (tokenOccurrences / wordCount) * 100 : 0;

    const normalizedPath = base.pathname;
    const hasReadableUrl = normalizedPath.length <= 80 && !/[A-Z]/.test(normalizedPath) && !/[?&].+=/.test(base.search);

    addCheck({
      key: "https",
      category: "Technical SEO",
      severity: "Critical",
      passed: base.protocol === "https:",
      points: 10,
      issue: "HTTPS is not enabled.",
      whyItMatters: "HTTPS is a trust and ranking signal.",
      recommendation: "Serve the page over HTTPS and redirect all HTTP traffic with a 301.",
    });

    addCheck({
      key: "performance-response-time",
      category: "Technical SEO",
      severity: "Important",
      passed: metrics.responseTimeMs <= 1200,
      points: 10,
      issue: `Server response time is ${metrics.responseTimeMs}ms (>1200ms).`,
      whyItMatters: "Slow pages hurt crawl efficiency and user experience.",
      recommendation: "Optimize backend rendering, CDN caching, and image/script payloads.",
    });

    addCheck({
      key: "viewport",
      category: "Technical SEO",
      severity: "Important",
      passed: viewport.includes("width=device-width"),
      points: 8,
      issue: "Viewport meta tag is missing or not responsive.",
      whyItMatters: "Without viewport hints, mobile rendering can break.",
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> in <head>.',
    });

    addCheck({
      key: "canonical",
      category: "Technical SEO",
      severity: "Important",
      passed: Boolean(canonical),
      points: 8,
      issue: "Canonical tag is missing.",
      whyItMatters: "Canonical tags reduce duplicate-content ambiguity.",
      recommendation: "Add a self-referencing canonical URL for indexable pages.",
    });

    addCheck({
      key: "robots-meta",
      category: "Technical SEO",
      severity: "Critical",
      passed: !robotsMeta.toLowerCase().includes("noindex"),
      points: 8,
      issue: "Meta robots contains noindex.",
      whyItMatters: "noindex can block your page from appearing in search.",
      recommendation: "Use index,follow for pages intended to rank.",
    });

    addCheck({
      key: "robots-txt",
      category: "Technical SEO",
      severity: "Important",
      passed: metrics.robotsTxtFound,
      points: 6,
      issue: "robots.txt file was not found.",
      whyItMatters: "robots.txt helps crawlers discover crawl rules and sitemap location.",
      recommendation: "Publish /robots.txt and include sitemap directives.",
    });

    addCheck({
      key: "sitemap",
      category: "Technical SEO",
      severity: "Important",
      passed: metrics.sitemapFound,
      points: 6,
      issue: "sitemap.xml file was not found.",
      whyItMatters: "Sitemaps improve URL discovery and indexing.",
      recommendation: "Generate and submit sitemap.xml in Search Console.",
    });

    addCheck({
      key: "url-structure",
      category: "Technical SEO",
      severity: "Minor",
      passed: hasReadableUrl,
      points: 4,
      issue: "URL path is not clean/readable.",
      whyItMatters: "Readable URLs improve relevance signals and CTR.",
      recommendation: "Use short lowercase slugs, hyphens, and avoid noisy query parameters.",
    });

    addCheck({
      key: "title-length",
      category: "On-page SEO",
      severity: "Critical",
      passed: title.length >= 50 && title.length <= 60,
      points: 8,
      issue: `Title length is ${title.length} chars (target: 50-60).`,
      whyItMatters: "Proper title length improves SERP visibility and relevance.",
      recommendation: "Write a unique title between 50 and 60 characters including the primary keyword.",
    });

    addCheck({
      key: "meta-description-length",
      category: "On-page SEO",
      severity: "Important",
      passed: metaDescription.length >= 120 && metaDescription.length <= 160,
      points: 8,
      issue: `Meta description length is ${metaDescription.length} chars (target: 120-160).`,
      whyItMatters: "Descriptions shape click-through rates from search results.",
      recommendation: "Write a clear 120-160 character summary with user intent and keyword context.",
    });

    addCheck({
      key: "single-h1",
      category: "On-page SEO",
      severity: "Important",
      passed: h1Count === 1,
      points: 8,
      issue: `Found ${h1Count} H1 tags (expected exactly 1).`,
      whyItMatters: "A single H1 clarifies the page's primary topic.",
      recommendation: "Keep one descriptive H1 and move supporting topics to H2/H3.",
    });

    addCheck({
      key: "heading-hierarchy",
      category: "On-page SEO",
      severity: "Minor",
      passed: validHierarchy,
      points: 4,
      issue: "Heading levels jump abruptly (e.g., H1 to H3).",
      whyItMatters: "Consistent heading hierarchy improves crawl comprehension and accessibility.",
      recommendation: "Use sequential heading levels (H1 → H2 → H3).",
    });

    addCheck({
      key: "keyword-placement",
      category: "On-page SEO",
      severity: "Important",
      passed: Boolean(mainKeyword) && keywordInBody && keywordInHeadings,
      points: 8,
      issue: "Primary keyword from title is not consistently used in headings/body.",
      whyItMatters: "Topical consistency helps search engines map intent.",
      recommendation: "Use the primary keyword naturally in the title, one heading, and opening body copy.",
    });

    addCheck({
      key: "keyword-stuffing",
      category: "On-page SEO",
      severity: "Minor",
      passed: stuffingRatio < 3,
      points: 4,
      issue: `Keyword repetition is high (${stuffingRatio.toFixed(2)}%).`,
      whyItMatters: "Over-optimization can trigger quality downgrades.",
      recommendation: "Reduce repeated exact-match terms and use semantic variations.",
    });

    addCheck({
      key: "image-alt",
      category: "On-page SEO",
      severity: "Important",
      passed: images.length === 0 || imagesMissingAlt === 0,
      points: 6,
      issue: `${imagesMissingAlt} image(s) missing alt text.`,
      whyItMatters: "Alt text supports image search and accessibility.",
      recommendation: "Add concise descriptive alt text for meaningful images.",
    });

    addCheck({
      key: "internal-links",
      category: "On-page SEO",
      severity: "Minor",
      passed: internalLinks >= 2,
      points: 4,
      issue: `Only ${internalLinks} internal links found.`,
      whyItMatters: "Internal links distribute authority and improve crawl paths.",
      recommendation: "Add contextual links to closely related pages.",
    });

    addCheck({
      key: "external-link-rel",
      category: "On-page SEO",
      severity: "Minor",
      passed: externalWithoutRel === 0,
      points: 4,
      issue: `${externalWithoutRel} external link(s) missing rel="nofollow" or rel="noopener".`,
      whyItMatters: "rel attributes improve security and outbound linking hygiene.",
      recommendation: "Set rel attributes intentionally for external links.",
    });

    addCheck({
      key: "word-count",
      category: "Content quality",
      severity: "Important",
      passed: wordCount >= 300,
      points: 8,
      issue: `Content has ${wordCount} words (<300).`,
      whyItMatters: "Thin content often lacks depth for ranking competitive queries.",
      recommendation: "Expand content with unique, intent-focused sections and examples.",
    });

    addCheck({
      key: "readability",
      category: "Content quality",
      severity: "Minor",
      passed: readability >= 45,
      points: 4,
      issue: `Readability score is ${readability} (target >=45).`,
      whyItMatters: "Readable content increases engagement and lowers pogo-sticking.",
      recommendation: "Use shorter sentences, simpler terms, and clearer subheadings.",
    });

    const duplicateTitleDescription =
      Boolean(title) &&
      Boolean(metaDescription) &&
      title.toLowerCase().replace(/[^a-z0-9 ]/g, "") ===
        metaDescription.toLowerCase().replace(/[^a-z0-9 ]/g, "");

    addCheck({
      key: "duplicate-signals",
      category: "Content quality",
      severity: "Minor",
      passed: !duplicateTitleDescription,
      points: 4,
      issue: "Title and meta description appear duplicated.",
      whyItMatters: "Duplicate snippets reduce SERP differentiation.",
      recommendation: "Write distinct title and description with complementary messaging.",
    });

    return {
      tags,
      checks,
      seoCount,
      socialCount,
      technicalCount,
      missingCount,
    };
  }
}
