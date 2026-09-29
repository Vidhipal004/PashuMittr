# PashuMittr multilingual + voice architecture

## Whole-app language switching

The language selector is global and persisted in `localStorage` as `pashumitr-lang`.

The frontend uses `src/i18n.js` with:

- native-script language picker
- 12 Indian/English locales
- a DOM bridge that translates existing screen labels, buttons, placeholders, headings, alerts and accessibility labels without requiring a full component rewrite
- `document.documentElement.lang` updated to the selected BCP-47 locale
- selected locale passed to AI/advisory requests and voice playback

The DOM bridge has an English canonical dictionary and reverse mapping, so switching English -> Hindi -> Marathi -> Gujarati etc. does not permanently change the source strings.

## Voice

Primary server-side TTS path:

`PashuMittr -> /api/v1/voice/tts -> ElevenLabs`

Primary recorded-voice STT path:

`PashuMittr -> /api/v1/voice/asr -> ElevenLabs Scribe`

Fallbacks remain BHASHINI/Google/browser depending on capability and configuration. The frontend keeps Play / Pause / Resume / Stop / Listen-again controls. ElevenLabs keys stay server-side in `backend/.env`.

## Tutorial language

The first-use tutorial has its own language picker, separate from the main navigation picker. Switching languages immediately changes the tutorial title, step text, controls and narration. The same 12-language catalog is used so a farmer can switch the tutorial into a familiar language before proceeding.

## Voice locale map

| UI language | Voice locale |
|---|---|
| English | en-IN |
| Hindi | hi-IN |
| Marathi | mr-IN |
| Gujarati | gu-IN |
| Punjabi | pa-IN |
| Bengali | bn-IN |
| Telugu | te-IN |
| Tamil | ta-IN |
| Kannada | kn-IN |
| Malayalam | ml-IN |
| Odia | or-IN |
| Assamese | as-IN |

Google Cloud currently documents broad Indian-locale support for Chirp 3 HD voices, including Bengali, Gujarati, Hindi, Kannada, Malayalam, Marathi, Punjabi, Tamil and Telugu. Exact voice-name availability can vary by voice family, so optional environment-variable voice overrides are supported.

## Voice input

When ElevenLabs STT is configured, the recorded browser audio is sent to `/api/v1/voice/asr` and transcribed server-side. Browser SpeechRecognition remains the fast fallback for browsers that support it.


## BHASHINI v10 adapter
PashuMittr v10 is ready for the current BHASHINI Dhruva inference API. Configure `BHASHINI_INFERENCE_API_KEY`, `BHASHINI_USER_ID`, and the locale-specific ASR/TTS service IDs in `backend/.env`. Requests are proxied server-side so the inference key is not exposed in the browser. The current BHASHINI documentation specifies the inference endpoint `https://dhruva-api.bhashini.gov.in/services/inference/pipeline`, an `Authorization` inference key, and locale/service IDs for ASR/TTS.
