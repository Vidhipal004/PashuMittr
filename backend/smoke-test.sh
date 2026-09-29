#!/usr/bin/env bash
set -euo pipefail
BASE=${BASE:-http://localhost:8787/api/v1}

echo '1) health'
curl -fsS "$BASE/health" | python -m json.tool | head -20

echo '2) create feed test'
TEST=$(curl -fsS -X POST "$BASE/tests" -H 'Content-Type: application/json' -d '{"test_type":"feed","feed_type":"demo-feed"}')
echo "$TEST" | python -m json.tool | head -20
ID=$(python -c 'import json,sys; print(json.loads(sys.stdin.read())["data"]["test_id"])' <<<"$TEST")

echo '3) NIR'
curl -fsS -X POST "$BASE/tests/$ID/nir" -H 'Content-Type: application/json' -d '{"sample_id":1}' | python -m json.tool | head -40

echo '4) assessment'
curl -fsS -X POST "$BASE/tests/$ID/assess" -H 'Content-Type: application/json' -d '{"visual":{"quality":"Image quality looks usable","visualRisk":"Low visual concern"}}' | python -m json.tool | head -40

echo '5) verify'
curl -fsS -X POST "$BASE/tests/$ID/verify" -H 'Content-Type: application/json' -d '{}' | python -m json.tool | head -40

echo 'Smoke test passed.'
