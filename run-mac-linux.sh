#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node 22 LTS, then rerun this script."
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
if [ "$NODE_MAJOR" -lt 20 ] || { [ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -lt 19 ]; }; then
  echo "PashuMittr requires Node.js >= 20.19 (Node 22 LTS recommended)."
  echo "Current Node: $(node -v)"
  exit 1
fi

if [ ! -f "$ROOT/backend/.env" ]; then
  echo "Missing backend/.env"
  echo "Run: cp backend/.env.example backend/.env"
  exit 1
fi

trap 'kill 0 2>/dev/null || true' EXIT INT TERM

(cd "$ROOT/backend" && npm install && node server.js) &
BACKEND_PID=$!
sleep 1

if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "Backend failed to start. Check the backend terminal output above."
  exit 1
fi

(cd "$ROOT/frontend" && npm install && npm run dev -- --host 127.0.0.1) &
wait
