#!/usr/bin/env bash
set -euo pipefail

# Start the casehub-pages examples gallery with the Quarkus backend.
# - Gallery: http://localhost:8080 (all 115 examples)
# - Backend: http://localhost:8090 (WebSocket push, event generators, Prometheus relay)
#
# Prerequisites: Node.js 18+, Java 21+

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  yarn install
fi

if [ ! -d examples/dist ]; then
  echo "Building frontend (first run takes ~60s)..."
  yarn build
  yarn build:examples
fi

echo ""
echo "  casehub-pages examples gallery + Quarkus backend"
echo "  Gallery:  http://localhost:8080"
echo "  Backend:  http://localhost:8090"
echo ""
echo "  Starting backend (Ctrl-C to stop both)..."
echo ""

cleanup() {
  echo ""
  echo "  Shutting down..."
  kill $GALLERY_PID 2>/dev/null || true
  wait $GALLERY_PID 2>/dev/null || true
}
trap cleanup EXIT

cd examples
npx http-server dist -c-1 -p 8080 -s &
GALLERY_PID=$!

cd server
exec mvn quarkus:dev
