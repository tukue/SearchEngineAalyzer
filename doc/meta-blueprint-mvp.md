# One-Click Meta Fix Blueprint (MVP)

This document specifies the deterministic rules, API contract, and UI behaviors for generating copy-pasteable meta tag recommendations from audit findings. The scope aligns with the MVP constraints: no AI rewriting, no CMS integrations, and no automatic site changes.

## Blueprint View Model

```json
{
  "pageUrl": "https://example.com",
  "generatedAt": "ISO-8601 timestamp",
  "confidenceLevel": "high | medium | low",
  "meta": {
    "title": {
      "recommended": "Example Page – Primary Keyword",
      "length": 52,
      "status": "fix | ok | optional",
      "sourceFindings": ["RULE_META_TITLE_MISSING", "RULE_META_TITLE_TOO_SHORT"]
    },
    "description": {
      "recommended": "Clear, concise summary of the page purpose under 160 characters.",
      "length": 148,
      "status": "fix | ok | optional",
      "sourceFindings": ["RULE_META_DESC_MISSING", "RULE_META_DESC_TOO_SHORT"]
    },
    "og:title": {
      "recommended": "Example Page – Primary Keyword",
      "status": "optional",
      "sourceFindings": ["RULE_OG_TITLE_MISSING"]
    },
    "og:description": {
      "recommended": "Clear, concise summary of the page purpose under 200 characters.",
      "status": "optional",
      "sourceFindings": ["RULE_OG_DESCRIPTION_MISSING"]
    },
    "twitter:title": {
      "recommended": "Example Page – Primary Keyword",
      "status": "optional",
      "sourceFindings": ["RULE_TWITTER_TITLE_MISSING"]
    },
    "twitter:description": {
      "recommended": "Clear, concise summary of the page purpose under 200 characters.",
      "status": "optional",
      "sourceFindings": ["RULE_TWITTER_DESCRIPTION_MISSING"]
    }
  },
  "sourceFindings": ["RULE_META_TITLE_MISSING", "RULE_META_DESC_TOO_SHORT"],
  "notes": ["All recommendations derived from deterministic rules; no AI rewriting."],
  "isEmpty": false
}
```

- `confidenceLevel` defaults to `high` when rules have direct page context (e.g., detected `<h1>` or existing title), `medium` when falling back to template text, and `low` only when inputs are incomplete.
- `status` reflects whether the recommendation fixes a detected issue (`fix`), confirms an already valid tag (`ok`), or provides optional parity tags (`optional`).
- `isEmpty` is `true` when no meta-related findings exist; the API then returns an empty-state payload instead of recommendations.

## Deterministic Rule Engine (Pseudocode)

```
function buildBlueprint(runId):
  audit = loadAudit(runId)
  assert audit.tenantId == currentTenantId
  if audit.findings.none(metaRelated):
    return emptyBlueprint(audit.pageUrl)

  meta = {}

  titleBase = pickTitleBase(audit)
  titleRecommendation = trimToRange(titleBase, 50, 60)
  meta.title = {
    recommended: titleRecommendation,
    length: length(titleRecommendation),
    status: statusFromFindings(audit.findings, 'title'),
    sourceFindings: findingsFor('title')
  }

  descriptionBase = pickDescriptionBase(audit)
  descriptionRecommendation = trimToRange(descriptionBase, 140, 160)
  meta.description = {
    recommended: descriptionRecommendation,
    length: length(descriptionRecommendation),
    status: statusFromFindings(audit.findings, 'description'),
    sourceFindings: findingsFor('description')
  }

  for socialTag in ['og:title','og:description','twitter:title','twitter:description']:
    if correspondingFindingExists(socialTag):
      meta[socialTag] = {
        recommended: mirror(metaFieldFor(socialTag)) or fallbackTemplate(socialTag),
        status: 'optional',
        sourceFindings: findingsFor(socialTag)
      }

  blueprint = {
    pageUrl: audit.pageUrl,
    generatedAt: nowISO8601(),
    confidenceLevel: confidence(meta),
    meta: meta,
    sourceFindings: metaFindingIds(audit),
    notes: ['Deterministic, reproducible recommendations.'],
    isEmpty: false
  }

  return blueprint

function pickTitleBase(audit):
  if audit.h1 exists and length within 40..70: return audit.h1
  if audit.pageTitle exists: return audit.pageTitle
  if audit.existingMetaTitle exists: return audit.existingMetaTitle
  return template("{siteName} | {pageTopic}")

function pickDescriptionBase(audit):
  if audit.firstMeaningfulParagraph exists: return audit.firstMeaningfulParagraph
  if audit.existingMetaDescription exists: return audit.existingMetaDescription
  return template("Concise summary of {pageTopic} in under 160 characters.")

function trimToRange(text, min, max):
  normalized = normalizeWhitespace(text)
  if length(normalized) < min: return padWithContext(normalized, min)
  if length(normalized) > max: return normalized[0:max-1] + '…'
  return normalized
```

- Social tags mirror the recommended title/description when present; otherwise they use concise templates to stay deterministic.
- Every recommendation collects the finding IDs that triggered it to maintain traceability.

## API Contract

**Endpoint:** `GET /audits/{runId}/meta-blueprint`

**Behavior:**
- Loads audit scoped to the authenticated tenant. Return `404` if the run does not belong to the tenant or does not exist.
- Checks plan entitlements: Free plans can view the blueprint but cannot export/copy-all (UI should disable actions and the API omits export tokens). Pro plans can copy/export.
- Returns `204` with `{ "isEmpty": true }` when there are no meta-related findings.
- Targets sub-500ms latency post-audit by reusing stored findings and page content extracted during the run.

**Successful Response (Pro plan):**
```json
{
  "pageUrl": "https://example.com",
  "generatedAt": "2024-06-01T12:00:00Z",
  "confidenceLevel": "high",
  "meta": { /* as defined in View Model */ },
  "sourceFindings": ["RULE_META_TITLE_MISSING", "RULE_META_DESC_TOO_SHORT"],
  "notes": ["Deterministic, reproducible recommendations."],
  "isEmpty": false,
  "entitlements": { "canCopy": true, "canExport": true }
}
```

**Successful Response (Free plan, view-only):**
```json
{
  "pageUrl": "https://example.com",
  "generatedAt": "2024-06-01T12:00:00Z",
  "confidenceLevel": "high",
  "meta": { /* as defined in View Model */ },
  "sourceFindings": ["RULE_META_TITLE_MISSING"],
  "notes": ["Upgrade to enable copy/export."],
  "isEmpty": false,
  "entitlements": { "canCopy": false, "canExport": false }
}
```

**Error Cases:**
- `401` when unauthenticated.
- `403` when tenant mismatch or plan restriction breached.
- `404` when run does not exist for the tenant.

## UI Wireframe (Textual)

- **Section placement:** Dedicated "Meta Fix Blueprint" block in the audit report, above the general findings list.
- **Header row:** Page URL, generated timestamp, confidence badge, and plan-gated "Copy All" button (disabled with tooltip for Free).
- **Fields (Title, Description, OG Title, OG Description, Twitter Title, Twitter Description):**
  - Label with status pill (`Fix`, `OK`, `Optional`).
  - Recommended value in a monospace, copy-ready block with a per-field copy button.
  - Character count and target range (e.g., `52 / 50-60`).
  - "Why this helps" tooltip explaining the linked finding(s).
- **Empty state:** If `isEmpty` is true, show "No meta issues detected in this audit" with a quick link to rerun or view details.

## Test Plan

1. **Rule Determinism**
   - Given identical audit inputs, repeated calls return identical blueprint values.
   - Long titles/descriptions are truncated to max lengths; short ones are padded per template rules.
2. **Finding Mapping**
   - Each recommended field includes the finding IDs that triggered it; verify traceability in responses.
   - Requests with no meta findings return `204` and `isEmpty: true`.
3. **Plan Gating**
   - Free plan: endpoint returns blueprint with `canCopy=false`, `canExport=false`; UI disables copy buttons and shows upgrade tooltip.
   - Pro plan: `canCopy=true`, `canExport=true`; copy buttons emit usage metrics.
4. **Tenant Isolation**
   - Accessing a run from another tenant returns `403/404`; data is not leaked.
5. **Performance**
   - With stored audit payloads, the endpoint responds under 500ms at P95.
6. **UI Interactions**
   - Per-field copy and "Copy All" trigger clipboard writes (or mock in tests) and record usage metrics.
   - Empty-state renders when `isEmpty` is true and hides copy actions.
7. **Error Handling**
   - Unauthenticated requests get `401`; deleted or missing runs get `404` within the tenant scope.

## Metrics to Log (MVP)

- Blueprint view events per audit run.
- Copy actions (per-field and copy-all) with plan identifier.
- Latency from audit completion to blueprint generation and first copy action.
- Drop-off counts when the blueprint is empty.
