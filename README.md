# Meta Tag Analyzer

[![CI](https://github.com/tukue/SearchEngineAalyzer/workflows/Meta%20Tag%20Analyzer%20CI/badge.svg)](https://github.com/tukue/SearchEngineAalyzer/actions/workflows/ci.yml)
[![MVP Validation](https://github.com/tukue/SearchEngineAalyzer/workflows/MVP%20Measurements%20Validation/badge.svg)](https://github.com/tukue/SearchEngineAalyzer/actions/workflows/mvp-validation.yml)
[![Deploy](https://github.com/tukue/SearchEngineAalyzer/workflows/Deploy%20to%20Vercel/badge.svg)](https://github.com/tukue/SearchEngineAalyzer/actions/workflows/deploy.yml)

Meta Tag Analyzer is a web application that analyzes and validates meta tags from any website. It provides actionable recommendations to improve SEO, social media sharing, and technical metadata with advanced MVP measurements.

## Features

- **Meta Tag Analysis**: Analyze meta tags from any website and categorize them into SEO, Social, and Technical tags.
- **MVP Measurements**: Advanced scoring with SEO-Visible at First Byte, Prioritized Health Score, and Share Preview Confidence.
- **Recommendations**: Get actionable recommendations to improve your meta tags.
- **Search History**: View and manage your recent analyses.
- **Responsive Design**: Works seamlessly on both desktop and mobile devices.
- **CI/CD Pipeline**: Automated testing, validation, and deployment with quality gates.

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm (v8 or higher)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/tukue/SearchEngineAalyzer.git
   cd SearchEngineAalyzer
   ```

2. Install dependencies (Node.js 20+ recommended):

   ```bash
   npm ci
   ```

3. Run the full local test suite (builds the app, starts the production server locally, and exercises the APIs/UI):

   ```bash
   npm run test:local
   ```

This workflow runs entirely on localhost and does not depend on Vercel or external deployment hooks.
