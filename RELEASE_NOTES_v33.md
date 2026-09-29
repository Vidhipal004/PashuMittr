# PashuMittr v33

## Gemini assistant reliability
- Farmer assistant now tries `GEMINI_ASSISTANT_MODEL=gemini-3.5-flash-lite` first for lower latency, then the configured Gemini model and supported Flash fallbacks.
- Added short per-model request timeout and model cascade on 5xx/timeout/429 conditions.
- 401/403 errors still stop immediately with a clear API-key/permission message.
- Gemini 3 requests use `thinkingLevel: low` to reduce latency for short farmer Q&A.
- Frontend assistant timeout increased to 45 seconds so the cascade can complete instead of showing an early client-side timeout.
- Added Gemini assistant model and request-timeout fields to `.env.example`.

## Local dev server
- Vite dev server now pins the local HMR websocket to `localhost:5173` to reduce local WebSocket mismatch errors.
