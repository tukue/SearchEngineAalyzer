# Database Design Proposal for WebAnalyzer

This document summarizes a recommended database solution for a WebAnalyzer application that analyzes websites for SEO, performance, accessibility, and technical issues.

## 1. Database Choice

**Recommendation: PostgreSQL**

PostgreSQL is the best fit for this application because:

- **Relational query needs**: The domain is naturally relational (users → websites → scans → issues → reports) and benefits from joins and aggregates.
- **Scalability and analytics**: PostgreSQL supports advanced indexing, partitioning, and reporting queries.
- **Operational maturity**: Managed offerings are widely available (AWS RDS, Supabase, Render, Neon).

## 2. Core Data Model / Tables

Below is a schema that covers users, websites, scans, issues, and recommendations.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID REFERENCES websites(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  seo_score INTEGER,
  performance_score INTEGER,
  accessibility_score INTEGER,
  technical_score INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  page_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  summary JSONB NOT NULL,
  recommendations JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scans_website_id_created_at ON scans(website_id, created_at DESC);
CREATE INDEX idx_issues_scan_id ON issues(scan_id);
CREATE INDEX idx_issues_category_severity ON issues(category, severity);
```

## 3. Relationships & Query Patterns

**Relationships**

- One user → many websites
- One website → many scans
- One scan → many issues and recommendations
- One scan → one report

**Example Queries**

Latest scan for a site:

```sql
SELECT *
FROM scans
WHERE website_id = $1
ORDER BY created_at DESC
LIMIT 1;
```

Scan history dashboard:

```sql
SELECT id, status, seo_score, performance_score, accessibility_score, technical_score, created_at
FROM scans
WHERE website_id = $1
ORDER BY created_at DESC;
```

Top recurring SEO issues:

```sql
SELECT title, COUNT(*) AS occurrences
FROM issues
WHERE category = 'seo'
GROUP BY title
ORDER BY occurrences DESC
LIMIT 10;
```

## 4. Backend Integration

### Node.js (Prisma)

```ts
const latestScan = await prisma.scan.findFirst({
  where: { websiteId },
  orderBy: { createdAt: "desc" },
});
```

### Python (SQLAlchemy)

```py
latest_scan = (
    session.query(Scan)
    .filter(Scan.website_id == website_id)
    .order_by(Scan.created_at.desc())
    .first()
)
```

## 5. Deployment & Cloud Setup

- **Managed PostgreSQL**: AWS RDS, Supabase, Render, or Neon.
- **Migrations**: Use a migration tool (e.g., Drizzle, Prisma Migrate, Alembic).
- **Security**: Store credentials in environment variables and limit DB access by IP/VPC when possible.

## 6. Future Enhancements

- **Scheduled scans**: Add a `scan_jobs` table with cron schedules.
- **Team accounts**: Add `teams` and `team_members` tables; link websites to teams.
- **AI recommendations**: Store model version, confidence score, and prompt metadata.
- **Analytics dashboards**: Build materialized views for trends and cohorts.
