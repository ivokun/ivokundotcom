#!/usr/bin/env bash
set -euo pipefail

echo "Installing dependencies..."
bun install --frozen-lockfile

echo "Running CMS database migrations..."
DATABASE_URL="postgres://postgres:postgres@localhost:5432/ivokundotcom_test?sslmode=disable" \
  dbmate -d "./cms/db/migrations" up

echo "Running unit tests (with 5min timeout)..."
timeout 300 bun --filter '@ivokundotcom/cms' test src/services/ src/middleware.test.ts src/schemas.test.ts src/errors.test.ts || EXIT_CODE=$?
if [ "${EXIT_CODE:-0}" -eq 124 ]; then
  echo "❌ Unit tests timed out after 5 minutes"
  exit 1
elif [ "${EXIT_CODE:-0}" -ne 0 ]; then
  echo "❌ Unit tests failed"
  exit 1
fi

echo "Running E2E tests (with 10min timeout)..."
timeout 600 test-e2e || EXIT_CODE=$?
if [ "${EXIT_CODE:-0}" -eq 124 ]; then
  echo "❌ E2E tests timed out after 10 minutes"
  exit 1
elif [ "${EXIT_CODE:-0}" -ne 0 ]; then
  echo "❌ E2E tests failed"
  exit 1
fi
