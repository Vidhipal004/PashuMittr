# PashuMittr v25 — ElevenLabs + OTP + multilingual tutorial

## Voice
- ElevenLabs TTS is attempted first when `ELEVENLABS_API_KEY` is configured.
- ElevenLabs Scribe v2 STT is attempted first for recorded browser audio.
- Browser SpeechRecognition and BHASHINI remain fallbacks.
- ElevenLabs credentials stay server-side.
- Tutorial audio uses the same voice pipeline, so changing the tutorial language changes the spoken tutorial text.

## OTP
- Added `POST /api/v1/auth/request-otp`.
- OTP is stored server-side with expiry, attempt limits, and resend cooldown.
- Hackathon/demo OTP is `123456` by default and is returned to the UI explicitly as demo-only.
- Login verification now checks the issued OTP instead of relying only on a hard-coded frontend check.

## Tutorial language
- Tutorial now has its own language selector.
- Switching language inside the tutorial resets to step 1 and changes tutorial labels, content and narration text.
- Included English plus 11 Indian-language tutorial packs.
