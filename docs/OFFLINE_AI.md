# PashuMittr Offline AI

PashuMittr uses a layered offline strategy:

1. **Rule engine**: deterministic screening/advisory logic remains local.
2. **Offline queue**: tests/actions remain in IndexedDB and sync when connectivity returns.
3. **Optional local LLM**: the browser can prepare LiteRT-LM's current web-compatible Gemma 4 E2B model for local text-in/text-out chat.
4. **Online Gemini**: when connected/configured, Gemini handles natural-language explanation and contextual chat.

## Browser model

The optional browser model defaults to:

`https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm`

The LiteRT-LM JavaScript/Web API is currently an early preview and supports a limited set of web-compatible models. The model is large, so the hackathon build does **not** bundle it inside the ZIP. The user must explicitly choose **Settings → Prepare Offline AI** on a supported browser/device.

After the model is prepared, PashuMittr tries it when the Gemini/API path is unavailable. If the local model is unavailable, PashuMittr falls back to its rule-based advisory instead of failing.

## Safety boundary

The local LLM is an explanation/chat layer only. It must not override the structured assessment, invent laboratory results, or claim that a phone photo proves chemical toxins/mycotoxins.

## Native Android direction

For a real Android deployment, Google documents LiteRT-LM support across Android and other platforms, and documents Gemma 3n as a local/offline-ready multimodal model. The current browser MVP does not bundle Gemma 3n.
