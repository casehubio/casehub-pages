#!/usr/bin/env bash
set -euo pipefail

# Start the casehub-pages examples gallery (client-side only, no backend needed).
# Opens http://localhost:8080 with 115 interactive examples.

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  yarn install
fi

if [ ! -d examples/dist ]; then
  echo "Building (first run takes ~60s)..."
  yarn build
  yarn build:examples
fi

echo ""
echo "  casehub-pages examples gallery"
echo "  http://localhost:8080"
echo ""
echo "  Server examples (live push, Prometheus) need ./gallery-server.sh instead."
echo ""

cd examples
npx http-server dist -c-1 -p 8080 -o
