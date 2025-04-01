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
node api-test.js
if [ $? -ne 0 ]; then
  echo "API tests failed!"
  exit 1
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
echo "✅ All tests passed!"
echo "========================================================"