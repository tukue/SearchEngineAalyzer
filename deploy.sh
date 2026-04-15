#!/bin/bash

# Script to commit and push changes to GitHub

echo "🚀 Deploying SearchEngineAnalyzer 405 Fix"
echo "==========================================="
echo ""

# Check git status
echo "📋 Git Status:"
git status --short
echo ""

# Add all changes
echo "📝 Adding changes..."
git add -A

# Commit with descriptive message
echo "💾 Committing changes..."
git commit -m "fix: resolve 405 error on analyze endpoint by fixing API route rewrites

- Modified next.config.js to use beforeFiles rewrites to prevent /api/analyze and /api/health from being rewritten to external API
- Local Next.js route handlers now take precedence over external API rewrites
- Added comprehensive test suites to verify the fix works with real website analysis
- Created end-to-end test script (test-analyze-405-fix.js) for testing with actual websites
- Added testing guide (TESTING_405_FIX.md) with manual and automated testing scenarios
- Enhanced test-api.js with explicit 405 error detection and verification

Fixes: 405 Method Not Allowed error when pressing Analyze button"

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo ""
echo "📤 Pushing to GitHub (branch: $CURRENT_BRANCH)..."
git push origin $CURRENT_BRANCH

# Check if push was successful
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Changes pushed successfully!"
  echo ""
  echo "📊 Next Steps:"
  echo "1. Go to GitHub: https://github.com/tukue/SearchEngineAnalyzer"
  echo "2. Create a Pull Request from '$CURRENT_BRANCH' to 'main'"
  echo "3. Deploy to Vercel from the PR or main branch"
  echo ""
else
  echo ""
  echo "❌ Push failed. Please check your Git configuration."
  exit 1
fi
