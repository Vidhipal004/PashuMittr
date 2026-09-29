# PashuMittr updated build

## Included
- Landing hero right-side farmer/cattle photograph uses `farmer-cattle-hero.jpg` instead of the illustration.
- Auth/login page uses `farmer-buffalo-bg.jpg` as the farmer-focused background.
- NIR assessment returns the deterministic rule-engine result immediately; Gemini explanation runs in the background and is polled by the frontend.
- Gemini assistant uses a fast hedged model flow with a bounded timeout.
- Existing navigation, test, history, QR, voice and sensor UI are preserved.

## Local run
Backend:
`cd backend && npm install && npm start`

Frontend in a second terminal:
`cd frontend && npm install && npm run dev`

Do not commit real API keys. Configure `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` through local `.env` or Render environment variables.


## Judge demo + farmer photo UI patch
- Fixed judge OTP verification to call `POST /api/v1/auth/login`, matching the backend route.
- Removed the white photo wash from the landing hero background so the farmer/cattle photo is visible immediately below the navbar.
- Kept the landing text/card styling and functional controls unchanged.
- Included the existing `.env` files from this archive; secret values remain exactly as supplied and are not fabricated.
