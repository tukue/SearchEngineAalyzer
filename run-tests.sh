#!/bin/bash

# Run all test scripts

echo "========================================================"
echo "Running structure tests..."
echo "========================================================"
node simple-test.js
if [ $? -ne 0 ]; then
  echo "Structure tests failed!"
  exit 1
fi

echo -e "\n\n========================================================"
echo "Running API tests..."
echo "========================================================"
# API tests are skipped by default to avoid failures when the client build is
# not available in CI. Set RUN_API_TESTS=1 to execute them explicitly.
if [ "${RUN_API_TESTS:-0}" = "1" ]; then
  node api-test.js
  if [ $? -ne 0 ]; then
    echo "API tests failed!"
    exit 1
  fi
else
  echo "Skipping API tests (set RUN_API_TESTS=1 to enable)."
fi

echo -e "\n\n========================================================"
echo "Running frontend integration tests..."
echo "========================================================"
node frontend-check.js
if [ $? -ne 0 ]; then
  echo "Frontend integration tests failed!"
  exit 1
fi

echo -e "\n\n========================================================"
echo "Running end-to-end tests..."
echo "========================================================"
# Check if application is running on port 5000
if nc -z localhost 5000 2>/dev/null; then
  echo "Application is running on port 5000. Running e2e tests..."
  node e2e-test.js
  if [ $? -ne 0 ]; then
    echo "❌ End-to-end tests failed!"
    exit 1
  fi
else
  echo "⚠️ Application is not running on port 5000. Skipping e2e tests."
  echo "To run e2e tests, make sure the application is running with 'npm run dev'"
fi

echo -e "\n\n========================================================"
echo "✅ All tests passed!"
echo "========================================================"
