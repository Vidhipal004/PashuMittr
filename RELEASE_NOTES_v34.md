# PashuMittr v34
## Gemini
- Hedged cascade: next model starts after GEMINI_HEDGE_MS (2.5s) or instantly on 503/429/timeout; first answer wins, rest are aborted.
- Hard overall deadline (28s) < frontend timeout (45s) so users get a real error, never a silent client timeout.
- thinkingLevel only sent to gemini-3.x (2.5 fallbacks would 400 on it). Added gemini-2.5-flash-lite/flash as capacity-independent fallbacks.
## ElevenLabs
- ELEVENLABS_VOICE_ID_EN / _HI: English -> EN voice, Hindi/other languages (or Devanagari text) -> HI voice.
- Optional ELEVENLABS_API_KEY_2 auto-fallback on 401/402/429 for both TTS and STT.
- /voice/status now reports both voice ids and number of keys configured.
