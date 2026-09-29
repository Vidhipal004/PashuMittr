#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
trap 'kill 0' EXIT
(cd "$ROOT/backend" && node server.js) &
sleep 1
(cd "$ROOT/frontend" && npm run dev -- --host 0.0.0.0) &
wait
