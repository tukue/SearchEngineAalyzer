#!/bin/bash

# Run all test scripts

SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

start_server() {
  if nc -z localhost 5000 2>/dev/null; then
    pkill -f "dist/server/index.js" 2>/dev/null || true
    sleep 1
  fi

  echo "Starting production server for API/E2E tests..."
  npm run start >/tmp/devserver.log 2>&1 &
  SERVER_PID=$!

  for i in {1..30}; do
    if nc -z localhost 5000 2>/dev/null; then
      echo "Server is up on port 5000."
      return 0
    fi
    sleep 1
  done

  echo "Server failed to start within timeout. Last 20 log lines:" >&2
  tail -n 20 /tmp/devserver.log >&2 || true
  exit 1
}

echo "========================================================"
echo "Running structure tests..."
echo "========================================================"
node simple-test.js
if [ $? -ne 0 ]; then
  echo "Structure tests failed!"
  exit 1
fi

echo -e "\n\n========================================================"
echo "Building production assets..."
echo "========================================================"
npm run build
if [ $? -ne 0 ]; then
  echo "Build failed!"
  exit 1
fi

start_server

echo -e "\n\n========================================================"
echo "Running homepage rendering test..."
echo "========================================================"
node homepage-test.js
if [ $? -ne 0 ]; then
  echo "Homepage test failed!"
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
echo "Running audit endpoint test..."
echo "========================================================"
node audit-endpoint.test.js
if [ $? -ne 0 ]; then
  echo "Audit endpoint test failed!"
  exit 1
fi

echo -e "\n\n========================================================"
echo "Running integration tests..."
echo "========================================================"
node integration-test.js
if [ $? -ne 0 ]; then
  echo "Integration tests failed!"
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
echo "Running end-to-end tests..."
echo "========================================================"
node e2e-test.js
if [ $? -ne 0 ]; then
  echo "❌ End-to-end tests failed!"
  exit 1
fi

echo -e "\n\n========================================================"
echo "✅ All tests passed!"
echo "========================================================"