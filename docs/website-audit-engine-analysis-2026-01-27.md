# Website Audit Engine Upgrade Analysis (Draft)

## Overview
This document captures the discovery framework and initial analysis structure for a website audit engine upgrade. It is prepared for a follow-up once the Phase 1 discovery questions are answered.

## Provided Context (Pending Confirmation)
- **Tech Stack:** _Not provided yet_
- **Primary Goal:** _Not provided yet_
- **Current Pain Points:** _Not provided yet_

## Phase 1: Deep Discovery (Required Inputs)
Please provide detailed answers to the following:

### 1) Concurrency & Queueing
- What job system or queue do you use (e.g., BullMQ, RabbitMQ, SQS), and how do you enforce **per-domain rate limits** or politeness delays?
- What is your current **max concurrency per domain** and **global concurrency**?

### 2) Rendering Strategy
- How do you decide when to do **static HTML fetch** vs **full JS rendering** (e.g., heuristics, UA sniffing, content-size thresholds, specific SPA detectors)?
- Which rendering engine is used (Puppeteer/Playwright/Chrome headless), and do you reuse browser instances or spin one per page?

### 3) Data Persistence & History
- What datastore(s) do you use for crawl results (e.g., Postgres, Elasticsearch, Redis, S3)?
- How do you store **historical runs** and compare deltas (e.g., diff tables, snapshots, time-series indices)?

### 4) Audit Logic Architecture
- Are audits **hard-coded rules**, **config-driven** (JSON/YAML), or a **plugin system**?
- How do you version rules and handle rule updates across historical data?

### 5) Cost / Efficiency Controls
- How do you measure and enforce **CPU/RAM limits** per job?
- Do you track **cost-per-page** (time, memory, bandwidth) and have automatic backoff or kill thresholds?

### 6) Crawl Scope & Discovery
- How do you discover URLs (sitemaps, link extraction, crawl frontier), and how do you avoid traps/duplicates (canonical tags, URL normalization)?

### 7) JS Rendering Accuracy vs Speed
- Do you currently do **partial rendering** (e.g., wait for network idle, DOMContentLoaded, specific selectors)?
- What are the top causes of **inaccurate JS rendering** you’re seeing?

## Phase 2: Capability Evaluation (Pending)
Once the Phase 1 answers are provided, the evaluation will cover:
- **Resilience:** Handling Cloudflare/WAFs and robots.txt
- **Semantic Intelligence:** LLM-based, context-aware audits
- **Actionability:** Translating audit results into prioritized business-impact tasks

## Phase 3: Roadmap (Pending)
A prioritized roadmap will follow with:
- **Tier 1 (Quick Wins):** Low-code and infrastructure optimizations
- **Tier 2 (Overhaul):** Structural engine improvements for speed and accuracy
- **Tier 3 (AI Integration):** LLM-based analysis for semantic insights

## Next Step
Provide the Phase 1 answers so the evaluation and roadmap can be completed.
