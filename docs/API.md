# PashuMittr API Contract

## Standard success response

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "request_id": "REQ-ABC123"
}
```

## Standard error response

```json
{
  "success": false,
  "error": {
    "code": "IMAGE_QUALITY_LOW",
    "message": "Please capture a clearer image.",
    "retryable": true
  },
  "request_id": "REQ-ABC123"
}
```

## Feed test lifecycle

```text
POST /api/v1/tests
POST /api/v1/tests/:id/visual
POST /api/v1/tests/:id/nir
POST /api/v1/tests/:id/assess
POST /api/v1/tests/:id/verify
GET  /api/v1/tests/:id
```

### NIR request

```json
{
  "sample_id": 1
}
```

or a device payload:

```json
{
  "spectrum": [0.3344, 0.33395, 0.33397]
}
```

The backend accepts the full 1557-point supplied spectrum or the compact 312-point model spectrum.

### NIR response

```json
{
  "ivomd": 56.48,
  "ivdmd": 54.13,
  "ndf": 27.34,
  "adf": 17.46,
  "model": {
    "type": "PLSRegression",
    "components": 2,
    "training_samples": 25,
    "wavelengths_used": 312,
    "screening_only": true
  }
}
```

### Combined assessment

The result is deliberately called a **screening status**, not a laboratory verdict. Conflicting evidence is surfaced as a reason for human/confirmatory follow-up.

## Advisory and assistant endpoints

### Rule-based advisory

`POST /api/v1/advisory`

Input can contain `visual`, `nir`, and/or `silage` evidence. The server returns:

- `screening_status`
- `evidence_score`
- `advisory`
- `actions[]`
- `rule_reasons[]`
- `confirmatory_testing_recommended`
- `engine: "rule-based-v1"`

### Contextual farmer chat

`POST /api/v1/assistant/chat`

```json
{
  "query": "इस रिजल्ट का मतलब क्या है?",
  "lang": "Hindi",
  "context": {
    "latest": {
      "assessment": {},
      "nir": {},
      "visual": {}
    }
  }
}
```

When `GEMINI_API_KEY` is configured, Gemini is used for concise farmer-friendly language while the supplied context remains the source of truth. Without a key, the deterministic rule-engine fallback is used.

## Voice UX

Chatbot responses and result advisories expose per-message speech controls:

`Listen → Pause → Resume → Stop → Listen again`

Voice input uses the browser speech-recognition capability where supported. Spoken answers use browser speech synthesis in the selected Indian-language locale. A production deployment can replace those browser voice layers with BHASHINI/other approved speech services without changing the rule-engine or Gemini API contract.


## v5 additions
Interactive QR scan/verify, cooperative alert investigation, village details, expert review, field-officer case actions, dark/light theme, market alternatives, and explicit PashuMittr AI entry points are now available in the frontend. BHASHINI is configuration-ready but still requires approved credentials/service IDs for real ASR/TTS.

## Demo/reference dataset
`GET /api/v1/demo/feed-samples` returns the five supplied F001–F005 reference records used only for demo scenario context. These records are deliberately separate from the NIR model training data.
