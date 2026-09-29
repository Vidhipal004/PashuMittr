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

Primary TTS path:

`PashuMittr -> /api/v1/voice/tts -> Google Cloud Text-to-Speech`

Fallback path:

`PashuMittr -> browser SpeechSynthesis`

The frontend keeps Play / Pause / Resume / Stop / Listen-again controls for both paths.

Google Cloud TTS is optional. Configure either:

- `GOOGLE_CLOUD_TTS_API_KEY`, or
- `GOOGLE_CLOUD_ACCESS_TOKEN`

The backend returns `google_tts_configured` from `/api/v1/voice/status`.

Official Google Cloud docs use the `text:synthesize` endpoint and return base64-encoded audio in `audioContent`. PashuMittr converts that response to an MP3 Blob for browser playback.

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

The current voice-input demo continues to use the browser SpeechRecognition API. Google Cloud STT can be added later as a server-side `/api/v1/voice/transcribe` path without changing the UI contract.


## BHASHINI v10 adapter
PashuMittr v10 is ready for the current BHASHINI Dhruva inference API. Configure `BHASHINI_INFERENCE_API_KEY`, `BHASHINI_USER_ID`, and the locale-specific ASR/TTS service IDs in `backend/.env`. Requests are proxied server-side so the inference key is not exposed in the browser. The current BHASHINI documentation specifies the inference endpoint `https://dhruva-api.bhashini.gov.in/services/inference/pipeline`, an `Authorization` inference key, and locale/service IDs for ASR/TTS.
