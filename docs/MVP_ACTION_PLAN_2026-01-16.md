# MVP Action Plan

This action plan converts the MVP priorities into concrete, low-to-medium effort work that improves user clarity, actionability, and perceived quality without adding large subsystems. It focuses primarily on the current Vite frontend and Express backend surfaces.

## Guiding Principles
- **Core user value first**: emphasize what to fix and why it matters.
- **Signal over noise**: highlight issues and suppress non-actionable detail by default.
- **Actionability**: provide clear next steps, not just raw data.
- **MVP feasibility**: incremental changes that fit current Vite UI and Express API contracts.

---

## Action Plan (Prioritized)

### 1) Add a “Health Summary” card (Vite UI)
**What to improve**  
Show a compact summary with a health score and pass/fail counts by category (SEO, Social, Technical).

**Why it matters to the user**  
Users can quickly understand overall status without scanning all tags.

**Estimated effort**  
Low

**MVP-friendly implementation idea**  
Derive counts from existing tag validation results returned by the Express analyze endpoint and render a small score badge plus category counts at the top of the Vite results page.

---

### 2) Add “Top 3 Issues” with severity + quick win labels (Vite UI)
**What to improve**  
Surface the top 3–5 issues with a severity indicator and a “quick win” label for low-effort fixes.

**Why it matters to the user**  
Users get a clear starting point and can prioritize fixes with the highest impact.

**Estimated effort**  
Low–Medium

**MVP-friendly implementation idea**  
Compute a priority score from missing/invalid tag severity in the Express response payload and display a short list ahead of detailed sections in the Vite UI.

---

### 3) Default to “Missing/Invalid tags” view (Vite UI)
**What to improve**  
Show missing/invalid tags first and hide valid tags behind a “Show all” toggle.

**Why it matters to the user**  
Reduces noise and prevents users from wading through already-correct entries.

**Estimated effort**  
Low

**MVP-friendly implementation idea**  
Filter visible tags by default in the Vite UI; add a toggle to reveal full tag lists.

---

### 4) Provide “Next Step” snippets for key tags (Vite UI)
**What to improve**  
For core tags (title, meta description, Open Graph, Twitter cards), provide copy-paste HTML snippets when missing.

**Why it matters to the user**  
Turns insights into immediate action without additional research.

**Estimated effort**  
Low

**MVP-friendly implementation idea**  
Maintain a small snippet map in the Vite UI and render examples alongside recommendations when those tags are missing.

---

### 5) Show “Delta vs. last run” at the top (Vite UI + Express history)
**What to improve**  
Display a small change summary (e.g., “+2 issues fixed, -1 missing tag”) compared to the previous audit.

**Why it matters to the user**  
Gives users feedback and reinforces progress across repeat audits.

**Estimated effort**  
Medium

**MVP-friendly implementation idea**  
Use Express history data to compute a simple diff for missing/invalid counts and render the delta summary in the Vite UI header.

---

### 6) Make quota messaging visible in results (Express + Vite UI)
**What to improve**  
Show quota remaining and warning state in the results header.

**Why it matters to the user**  
Reduces surprises and helps users manage usage without hitting hard limits.

**Estimated effort**  
Low

**MVP-friendly implementation idea**  
Use the quota payload already returned by the Express API and render a friendly status line in the Vite UI results header.

---

### 7) Improve error UX with status + fix hints (Express + Vite UI)
**What to improve**  
When an audit fails, show the HTTP status and likely reasons (blocked, invalid URL) plus suggested fixes.

**Why it matters to the user**  
Failure modes feel less opaque, so users can self-resolve.

**Estimated effort**  
Low–Medium

**MVP-friendly implementation idea**  
Expose Express error details in the Vite UI and render a short “Try this” list.

---

## Suggested Sequencing (2-week MVP window)
- **Week 1**: Health summary (Vite), top issues list (Vite), missing/invalid default view (Vite), quota messaging (Express + Vite).
- **Week 2**: Next-step snippets (Vite), delta vs. last run (Express history + Vite), error UX improvements (Express + Vite).

## Definition of Done (per item)
- Visible in the Vite UI and validated against at least one real Express analysis result.
- Copy reviewed for clarity and brevity.
- No new services or heavy data pipelines added.
