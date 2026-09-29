# PashuMittr v29 — Gemini AI error handling cleanup

## Fixes
- Improved `/api/v1/assistant/chat` diagnostics for Gemini failures. Invalid/unauthorized Gemini credentials now return a clear 503 message instead of a generic 502.
- Added model fallback attempts for transient model/API compatibility issues: configured model, then `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`.
- The assistant response now reports the actual model used.
- Removed the offline/local-AI status card from Settings so judges are not shown any “Preparing model” / offline-AI preparation UI.

## Important setup
Put the real Gemini API key in `backend/.env`:

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.8-flash
```

Restart `node server.js` after changing `.env`.
