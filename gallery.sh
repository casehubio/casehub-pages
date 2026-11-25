#!/usr/bin/env bash
set -euo pipefail

# Start the casehub-pages examples gallery (client-side only, no backend needed).
# Opens http://localhost:8080 with all examples and hot reload.
#
# Prerequisites: Node.js 18+

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
echo "  casehub-pages examples gallery"
echo "  http://localhost:8080"
echo ""
echo "  Server examples (live push, Prometheus) need ./gallery-server.sh instead."
echo ""

npx webpack serve --env dev --open
