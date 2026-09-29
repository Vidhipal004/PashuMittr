# PashuMittr v24

## Guided onboarding
- First-use **How PashuMittr works** walkthrough opens automatically on a new browser.
- Eight short steps cover language/accessibility, storage sensor, feed/silage testing, visual screening, NIR screening, rule engine, result/advisory, PashuMittr AI, history and QR.
- Back / Next, progress, Skip and keyboard arrow navigation are included.
- Every step has a **सुनें** narration control using the existing Google TTS → browser TTS fallback.
- Tutorial can be replayed from Settings.

## Error UX
- Added one reusable `ErrorCard` pattern with clear title, message and Retry where useful.
- Camera, OTP/auth, voice input, NIR analysis, history sync, offline AI and sensor connection errors now use the shared pattern.
- Existing loading states remain visible while retryable actions are running.

## Storage sensor connection
- Demo sensor now starts **disconnected** instead of pretending a device is already connected.
- Connect flow supports **Bluetooth** or **Wi-Fi** and a selectable storage location.
- After connection, demo temperature/humidity readings load and refresh every 10 seconds.
- Disconnect clears the live reading so the UI does not imply a live sensor is present.
- Connected storage temperature/humidity are still passed into the rule-engine assessment path.

## Scientific guardrails
- Tutorial repeats that the phone camera is a visual-screening layer only.
- Phone camera does not measure NIR.
- Current NIR screening is based on the supplied reference dataset and is not a certified lab calibration.
- Confirmatory laboratory testing remains the route for final contamination/safety decisions.
