#!/usr/bin/env bash
set -euo pipefail

# Start the casehub-pages examples gallery with the Quarkus backend.
# - Gallery: http://localhost:8080 (all examples with hot reload)
# - Backend: http://localhost:8090 (WebSocket push, event generators, Prometheus relay)
#
# The gallery proxies /api/ and /ws/ to the backend automatically.
#
# Prerequisites: Node.js 18+, Java 21+

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  yarn install
fi

# Build core packages (needed by examples webpack)
if [ ! -d packages/pages-runtime/dist ]; then
  echo "Building packages (first run takes ~60s)..."
  yarn build:packages
fi

# Generate samples.json and copy sample YAML files
cd examples
yarn generate-samples
yarn copy-samples
yarn copy-playbooks

echo ""
echo "  casehub-pages examples gallery + Quarkus backend"
echo "  Gallery:  http://localhost:8080"
echo "  Backend:  http://localhost:8090"
echo ""
echo "  Starting backend and gallery (Ctrl-C to stop both)..."
echo ""

cleanup() {
  echo ""
  echo "  Shutting down..."
  kill $BACKEND_PID 2>/dev/null || true
  wait $BACKEND_PID 2>/dev/null || true
}
trap cleanup EXIT

cd server
mvn quarkus:dev &
BACKEND_PID=$!
cd ..

npx webpack serve --env dev --open
