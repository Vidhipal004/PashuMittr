# PashuMittr v26 — ElevenLabs voice + Twilio OTP + multilingual tutorial

## Voice
- ElevenLabs TTS is attempted first when `ELEVENLABS_API_KEY` is configured.
- ElevenLabs Scribe STT is attempted first for recorded browser audio.
- Browser SpeechRecognition and BHASHINI remain fallbacks.
- Tutorial narration uses the same TTS pipeline.
- ElevenLabs credentials remain server-side only.

## Authentication
- Replaced the hackathon hard-coded OTP login path with **Twilio Verify SMS** as the default auth provider.
- `POST /api/v1/auth/request-otp` starts a Twilio Verify verification.
- `POST /api/v1/auth/login` checks the entered code with Twilio Verify.
- Added `GET /api/v1/auth/status` so the UI can show whether Twilio is configured.
- Added resend cooldown handling and clearer Twilio-specific error messages.
- Added an explicit `AUTH_PROVIDER=demo` mode for local testing only; the production-style default is `twilio`.
- No SMS OTP is surfaced in the UI when Twilio mode is active.

## Tutorial language
- Tutorial has its own language selector.
- Changing the tutorial language immediately changes step labels, content, and narration text.
- English + 11 Indian language packs are included.

## v27 patch — judge-safe OTP demo path

- Added a dedicated judge/demo OTP number so reviewers do not need to provide a personal phone number.
- Demo phone: `0000000000` (shown beside the mobile field in the UI).
- Demo OTP: `123456` (shown in the judge demo helper text).
- The demo number never calls Twilio Verify; it uses the existing local OTP state only.
- Real phone numbers continue to use Twilio Verify when `AUTH_PROVIDER=twilio` and Twilio credentials are configured.
- Added `DEMO_AUTH_ENABLED`, `DEMO_PHONE`, and `DEMO_OTP` to `backend/.env.example`.
