# PashuMittr v30

## Gemini / 502 debugging
- Added explicit timestamped backend logging for assistant requests.
- Logs Gemini model attempts, upstream HTTP status, truncated provider response details, success/failure, and request IDs.
- Added `GET /api/v1/health` to confirm whether Gemini and ElevenLabs keys were loaded without exposing secrets.
- Added startup configuration summary (configured/not configured only).
- Added uncaught exception and unhandled rejection logging.
- Preserved existing 502/503/429 API behavior and user-facing error cards.

## Run
1. Set `backend/.env`.
2. Start backend with `node server.js`.
3. Open `http://localhost:5173`.
4. Visit `http://localhost:5173/api/v1/health` or `http://localhost:8787/api/v1/health` while debugging.
