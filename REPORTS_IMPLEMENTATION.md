# Actionable Reports Implementation

This document describes the implementation of the actionable reports feature for the Web Audit SaaS MVP.

## Overview

The reports feature transforms audit run data into consistent, actionable reports with health scores, prioritized fixes, and export capabilities. All functionality is multi-tenant aware and plan-gated.

## Architecture

### Core Components

1. **Report Schema** (`shared/report-schema.ts`)
   - Canonical report view model
   - Scoring and prioritization constants
   - Filter and export schemas

2. **Report Service** (`server/report-service.ts`)
   - Deterministic scoring algorithm
   - Finding prioritization logic
   - Filter application

3. **Export Service** (`server/export-service.ts`)
   - Feature-flagged export functionality
   - Plan-gated access control
   - HTML/PDF generation

4. **Report Routes** (`server/report-routes.ts`)
   - REST API endpoints
   - Error handling and validation

5. **UI Components** (`client/src/components/`)
   - `ReportView.tsx` - Full report display
   - `ReportSummary.tsx` - Dashboard summary cards

## Scoring Algorithm

### Health Score Calculation

The health score is calculated using a weighted approach:

1. **Category Scores** (0-100):
   - Based on severity-weighted penalty system
   - No findings = 100 (perfect score)
   - Penalties: Critical=10, High=7, Medium=4, Low=2, Info=1

2. **Overall Score**:
   - Weighted average of category scores
   - Weights: SEO=1.0, Social=0.8, Technical=0.6

3. **Grade Assignment**:
   - Excellent: 90-100
   - Good: 75-89
   - Fair: 60-74
   - Poor: 40-59
   - Critical: 0-39

### Prioritization Algorithm

Top fixes are prioritized using:

1. **Priority Score** = (Severity Weight × Category Weight × Effort Weight) / Max Possible × 100
2. **Effort Weight** = 1 / Effort Level (lower effort = higher priority)
3. **Ranking** by priority score (descending)

## API Endpoints

### Get Report
```
GET /api/reports/:runId?filters={}
```
Returns complete report with optional filtering.

### Export Report
```
POST /api/reports/:runId/export
{
  "format": "pdf|html",
  "filters": {...},
  "includeGuidance": true
}
```
Generates and returns download URL for export.

### Get Report Summary
```
GET /api/reports/:runId/summary
```
Returns lightweight summary for dashboard display.

### Download Export
```
GET /api/exports/download/:filename
```
Downloads generated export file.

## Feature Flags

Environment variables control feature availability:

- `EXPORTS_ENABLED` - Master export toggle
- `PDF_EXPORTS` - PDF export availability
- `HTML_EXPORTS` - HTML export availability

## Plan Gating

Export functionality is gated by plan:

- **Free Plan**: No export access
- **Pro Plan**: Full export access when features enabled

Enforcement occurs at multiple levels:
1. Service-level checks
2. Route-level middleware
3. UI-level hiding

## Consistency Guarantees

The same report data is used across:
- Dashboard summaries
- Full report views
- Exported reports

This is achieved through:
1. Canonical report view model
2. Shared scoring algorithms
3. Consistent filter application

## Error Handling

### Export Errors
- Plan gating violations → 403 with upgrade message
- Feature disabled → 400 with retry guidance
- Generation failures → 500 with error details

### Report Errors
- Invalid run ID → 400 with format message
- Run not found → 404 with clear message
- Generation failures → 500 with retry option

## Testing Strategy

### Unit Tests
- `report-service.test.ts` - Scoring consistency
- `export-service.test.ts` - Feature flag enforcement

### Integration Tests
- End-to-end report generation
- Export download flows
- Plan gating enforcement

### Consistency Checks
- Score matching across views
- Filter application consistency
- Export content verification

## Deployment

### Environment Setup
1. Copy `.env.example` to `.env`
2. Configure feature flags
3. Set up export storage (production)

### Database Migration
No new tables required - uses existing audit runs and findings.

### Dependencies
- `puppeteer` for PDF generation
- Existing persistence layer

## Usage Examples

### Generate Report
```typescript
const report = await ReportService.generateReport(tenantId, runId);
```

### Apply Filters
```typescript
const filtered = ReportService.applyFilters(findings, {
  categories: ['seo'],
  severities: ['critical', 'high']
});
```

### Export Report
```typescript
const result = await ExportService.exportReport(tenantContext, {
  runId,
  format: 'pdf',
  includeGuidance: true
});
```

## Future Enhancements

1. **Trend Analysis** - Compare scores across runs
2. **Custom Scoring** - Tenant-specific weights
3. **Scheduled Exports** - Automated report delivery
4. **Advanced Filters** - Date ranges, custom rules
5. **Export Templates** - Branded report layouts