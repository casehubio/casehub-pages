#!/usr/bin/env bash
# Start the demo server with in-memory event store (no Docker/Postgres needed).
# Events stream via WebSocket on http://localhost:8090.
# For persistent storage, use: docker compose up
cd "$(dirname "$0")/server"
exec mvn quarkus:dev
