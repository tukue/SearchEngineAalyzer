export type WebsiteAnalyzerTags = {
  title?: string | null;
  metaDescription?: string | null;
  canonical?: string | null;
  openGraph?: {
    ogTitle?: string | null;
    ogDescription?: string | null;
    ogUrl?: string | null;
    ogImage?: string | null;
  };
  twitter?: {
    card?: string | null;
    title?: string | null;
    description?: string | null;
    image?: string | null;
  };
};

export type WebsiteAnalyzerCounts = {
  missing?: number;
  invalid?: number;
  warnings?: number;
};

export type WebsiteAnalyzerAuditPayload = {
  url?: string;
  http?: { status?: number; finalUrl?: string; blocked?: boolean };
  tags?: WebsiteAnalyzerTags;
  currentCounts?: WebsiteAnalyzerCounts;
  previousRun?: {
    counts?: WebsiteAnalyzerCounts;
  };
  quota?: { remaining?: number; limit?: number; warning?: boolean };
};

type ImplementationStatus = {
  label: string;
  status: "implemented" | "partial" | "missing";
  missingFields?: string[];
  description?: string;
};

const PLACEHOLDERS = {
  title: "{{PAGE_TITLE}}",
  description: "{{PAGE_DESCRIPTION}}",
  canonical: "{{CANONICAL_URL}}",
  image: "{{IMAGE_URL}}",
};

const hasValue = (value?: string | null) => {
  if (value === null || value === undefined) return false;
  return value.trim().length > 0;
};

const formatDeltaValue = (delta: number) => {
  if (delta === 0) return "0";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`;
};

const pluralize = (label: string, count: number) => {
  if (Math.abs(count) === 1) return label;
  if (label === "warning") return "warnings";
  return label;
};

const formatImplementationStatus = (status: ImplementationStatus) => {
  if (status.status === "implemented") {
    return `✔ ${status.label} — Implemented`;
  }

  if (status.status === "partial") {
    const missingFields = status.missingFields?.length
      ? ` (missing: ${status.missingFields.join(", ")})`
      : "";
    return `⚠ ${status.label} — Partially implemented${missingFields}`;
  }

  return `✖ ${status.label} — Not implemented`;
};

const formatSingleStatus = (label: string, isImplemented: boolean) => {
  return isImplemented
    ? `✔ ${label} — Implemented`
    : `⚠ ${label} — Missing or incomplete`;
};

const buildImplementationStatuses = (tags?: WebsiteAnalyzerTags): ImplementationStatus[] => {
  const openGraph = tags?.openGraph;
  const twitter = tags?.twitter;

  const ogFields = [
    { key: "ogTitle", label: "og:title", value: openGraph?.ogTitle },
    { key: "ogDescription", label: "og:description", value: openGraph?.ogDescription },
    { key: "ogUrl", label: "og:url", value: openGraph?.ogUrl },
    { key: "ogImage", label: "og:image", value: openGraph?.ogImage },
  ];

  const twitterFields = [
    { key: "card", label: "twitter:card", value: twitter?.card },
    { key: "title", label: "twitter:title", value: twitter?.title },
    { key: "description", label: "twitter:description", value: twitter?.description },
    { key: "image", label: "twitter:image", value: twitter?.image },
  ];

  const ogMissing = ogFields.filter((field) => !hasValue(field.value)).map((field) => field.label);
  const twitterMissing = twitterFields.filter((field) => !hasValue(field.value)).map((field) => field.label);

  const ogStatus: ImplementationStatus = ogMissing.length === 0
    ? { label: "Open Graph", status: "implemented" }
    : ogMissing.length === ogFields.length
      ? { label: "Open Graph", status: "missing" }
      : { label: "Open Graph", status: "partial", missingFields: ogMissing };

  const twitterStatus: ImplementationStatus = twitterMissing.length === 0
    ? { label: "Twitter Cards", status: "implemented" }
    : twitterMissing.length === twitterFields.length
      ? { label: "Twitter Cards", status: "missing" }
      : { label: "Twitter Cards", status: "partial", missingFields: twitterMissing };

  return [
    {
      label: "Title tag",
      status: hasValue(tags?.title) ? "implemented" : "missing",
      description: "Title tag",
    },
    {
      label: "Meta description",
      status: hasValue(tags?.metaDescription) ? "implemented" : "missing",
      description: "Meta description",
    },
    {
      label: "Canonical URL",
      status: hasValue(tags?.canonical) ? "implemented" : "missing",
      description: "Canonical URL",
    },
    ogStatus,
    twitterStatus,
  ];
};

const buildRecommendations = (statuses: ImplementationStatus[]) => {
  const recommendations: string[] = [];

  statuses.forEach((status) => {
    if (status.status === "implemented") return;

    switch (status.label) {
      case "Title tag":
        recommendations.push("Title tag: Add a clear page title to improve search result relevance.");
        break;
      case "Meta description":
        recommendations.push("Meta description: Add a concise summary so search snippets are compelling.");
        break;
      case "Canonical URL":
        recommendations.push("Canonical URL: Specify the preferred URL to avoid duplicate page signals.");
        break;
      case "Open Graph": {
        const missing = status.missingFields?.join(", ") || "og:title, og:description, og:url, og:image";
        recommendations.push(`Open Graph: Add ${missing} so social shares render rich previews.`);
        break;
      }
      case "Twitter Cards": {
        const missing = status.missingFields?.join(", ") || "twitter:card, twitter:title, twitter:description, twitter:image";
        recommendations.push(`Twitter Cards: Add ${missing} so Twitter previews display correctly.`);
        break;
      }
      default:
        break;
    }
  });

  return recommendations;
};

const buildSnippets = (statuses: ImplementationStatus[]) => {
  const snippets: string[] = [];
  const statusMap = new Map(statuses.map((status) => [status.label, status]));

  if (statusMap.get("Title tag")?.status !== "implemented") {
    snippets.push(`<!-- SEO: Title -->
<title>${PLACEHOLDERS.title}</title>`);
  }

  if (statusMap.get("Meta description")?.status !== "implemented") {
    snippets.push(`<!-- SEO: Meta Description -->
<meta name="description" content="${PLACEHOLDERS.description}" />`);
  }

  const openGraphStatus = statusMap.get("Open Graph");
  if (openGraphStatus && openGraphStatus.status !== "implemented") {
    snippets.push(`<!-- Open Graph -->
<meta property="og:title" content="${PLACEHOLDERS.title}" />
<meta property="og:description" content="${PLACEHOLDERS.description}" />
<meta property="og:url" content="${PLACEHOLDERS.canonical}" />
<meta property="og:image" content="${PLACEHOLDERS.image}" />`);
  }

  const twitterStatus = statusMap.get("Twitter Cards");
  if (twitterStatus && twitterStatus.status !== "implemented") {
    snippets.push(`<!-- Twitter Cards -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${PLACEHOLDERS.title}" />
<meta name="twitter:description" content="${PLACEHOLDERS.description}" />
<meta name="twitter:image" content="${PLACEHOLDERS.image}" />`);
  }

  return snippets;
};

const buildDeltaSummary = (current?: WebsiteAnalyzerCounts, previous?: WebsiteAnalyzerCounts) => {
  if (!previous) {
    return "First run — no comparison yet.";
  }

  const missingDelta = (current?.missing ?? 0) - (previous.missing ?? 0);
  const invalidDelta = (current?.invalid ?? 0) - (previous.invalid ?? 0);
  const warningDelta = (current?.warnings ?? 0) - (previous.warnings ?? 0);

  const deltas = [
    { label: "missing", value: missingDelta },
    { label: "invalid", value: invalidDelta },
    { label: "warning", value: warningDelta },
  ].filter((delta) => delta.value !== 0);

  if (deltas.length === 0) {
    return "No changes since last run.";
  }

  const allImproved = deltas.every((delta) => delta.value < 0);
  const allWorse = deltas.every((delta) => delta.value > 0);

  const deltaText = deltas
    .map((delta) => `${formatDeltaValue(delta.value)} ${pluralize(delta.label, delta.value)}`)
    .join(", ");

  if (allImproved) {
    return `Nice progress — ${deltaText}`;
  }

  if (allWorse) {
    return `Heads up — ${deltaText}, no fixes yet`;
  }

  return `Mixed results — ${deltaText}`;
};

const buildQuotaLine = (quota?: WebsiteAnalyzerAuditPayload["quota"]) => {
  if (!quota || quota.remaining === undefined || quota.limit === undefined) {
    return "Quota: unavailable";
  }

  if (quota.remaining <= 3) {
    return `⚠ Quota low: ${quota.remaining} / ${quota.limit} checks remaining`;
  }

  return `Quota: ${quota.remaining} / ${quota.limit} checks remaining`;
};

const buildClosingInsight = (statuses: ImplementationStatus[]) => {
  const missingStatuses = statuses.filter((status) => status.status !== "implemented");
  if (missingStatuses.length === 0) {
    return "Strong SEO base — only minor gaps left.";
  }

  const hasSocialGaps = missingStatuses.some((status) =>
    ["Open Graph", "Twitter Cards"].includes(status.label)
  );

  if (hasSocialGaps) {
    return "You’re close — adding social tags will improve sharing.";
  }

  return "Nice momentum — closing the remaining gaps will lift visibility.";
};

export const formatWebsiteAnalyzerReport = (payload: WebsiteAnalyzerAuditPayload) => {
  const statuses = buildImplementationStatuses(payload.tags);

  const implementationLines = statuses.map((status) => {
    if (["Title tag", "Meta description", "Canonical URL"].includes(status.label)) {
      return formatSingleStatus(status.label, status.status === "implemented");
    }

    return formatImplementationStatus(status);
  });

  const recommendations = buildRecommendations(statuses);
  const snippets = buildSnippets(statuses);

  const lines = [
    "Implementation Status",
    ...implementationLines,
    "",
    "Delta vs last run",
    buildDeltaSummary(payload.currentCounts, payload.previousRun?.counts),
    "",
    "Quota status",
    buildQuotaLine(payload.quota),
    "",
    "Recommendations",
    ...(recommendations.length > 0 ? recommendations.map((rec) => `- ${rec}`) : ["No gaps found."]),
    "",
    "Next Step HTML snippets",
    ...(snippets.length > 0 ? snippets : ["No snippets needed."]),
    ...(snippets.length > 0 ? ["Replace placeholders with real values."] : []),
    "",
    buildClosingInsight(statuses),
  ];

  return lines.join("\n");
};
