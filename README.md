# PashuMittr Hackathon v26

**Test. Understand. Act.**

PashuMittr is an AI-assisted feed and silage quality screening prototype for Indian dairy-farmer workflows.

## Run on Windows / VS Code

1. Extract the ZIP and open the inner `PashuMittr_Hackathon_v27` folder in VS Code.
2. Copy `backend/.env.example` to `backend/.env`.
3. Put your real Gemini key in:

```env
PORT=8787
CORS_ORIGIN=*
GEMINI_API_KEY=YOUR_REAL_GEMINI_KEY
GEMINI_MODEL=gemini-3.8-flash
```

4. Terminal 1:

```powershell
cd backend
npm install
node server.js
```

5. Terminal 2:

```powershell
cd frontend
npm install
npm run dev
```

6. Open the Vite localhost URL, normally `http://localhost:5173`.

**Restart the backend after changing `.env`.** The backend now loads `backend/.env` automatically.

Authentication: PashuMittr uses **Twilio Verify SMS** when `AUTH_PROVIDER=twilio`. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` in `backend/.env`, then restart the backend. Twilio Verify handles OTP generation, delivery and code verification; PashuMittr does not store the SMS code in Twilio mode. For local-only UI testing, set `AUTH_PROVIDER=demo` and use `DEMO_OTP`.

### Twilio setup

1. In Twilio Console, create a **Verify Service** and copy its `VA...` Service SID.
2. Put your Account SID, Auth Token and Verify Service SID into `backend/.env`.
3. Keep `AUTH_PROVIDER=twilio` and restart `node server.js`.
4. The login screen now calls Twilio to send the SMS and Twilio to verify the entered code.

> Twilio trial accounts can require destination numbers to be verified before SMS/voice/WhatsApp delivery.


## First-use guide & errors

On the first browser visit, PashuMittr opens a guided “How PashuMittr works” walkthrough with voice narration. It can be replayed from Settings. Retryable failures use a shared error card so camera, voice, AI, history and sensor problems look and behave consistently.

## Storage sensor connection

The storage sensor demo starts disconnected. Choose **Bluetooth** or **Wi-Fi**, select the storage location, and press **Connect & load readings**. Once connected, demo temperature and humidity readings refresh periodically and are included as evidence in feed/silage assessment.

## PashuMittr AI

PashuMittr AI is a general farmer assistant, not only a test-result chatbot. Questions about cattle/buffalo care, feed, fodder, silage, storage, routine dairy practices and specific PashuMittr tests are sent to Gemini when the key is configured.

## Breed

Feed Test and Profile provide a Breed dropdown plus **Other / enter manually**. The selected breed is stored with the test and passed into the AI context.

## Storage environment

Farmer Home, Feed Test, Silage Test and Result show the current storage environment. The current prototype uses a clearly-labelled **Demo IoT sensor** with temperature and humidity. These values are sent to the rule engine; temperature above 35°C or humidity above 80% changes the prototype assessment to `Monitor`.

## NIR data

The supplied `Dataset NIR Spectrum of Animal Feed.xlsx` is bundled under `backend/data/source/`. The proof-of-concept uses 25 supplied samples with IVOMD, IVDMD, NDF and ADF targets. It remains screening/model evidence only, not a certified laboratory calibration.

## Scientific limits

- Smartphone camera is a visual-screening layer only.
- Smartphone camera does not measure NIR.
- The current NIR model does not detect aflatoxin/mycotoxins.
- Dummy aflatoxin/adulteration values are demo/reference values, not camera/NIR detections.
- Confirmatory laboratory testing remains the path for final safety/contamination decisions.

## NIR runtime verification

From `backend/`:

```text
node validate-nir.js
```

## Voice provider configuration

PashuMittr uses **ElevenLabs first** for server-side text-to-speech and speech-to-text when `ELEVENLABS_API_KEY` is configured. The default voice ID is `JBFqnCBsd6RMkjVDRZzb` and can be replaced with your preferred ElevenLabs voice. Browser speech and BHASHINI remain fallbacks. Tutorial narration uses the same voice pipeline, so changing the tutorial language changes the narration language/content.

## OTP authentication with Twilio

PashuMittr now uses **Twilio Verify SMS** by default. Set `AUTH_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` in `backend/.env`. The frontend shows a Twilio-specific status and never displays the SMS code. For a local mock/demo only, set `AUTH_PROVIDER=demo`; this is not the real SMS flow.


### Judge OTP demo
Use mobile `0000000000` and OTP `123456` for the judge demo. This special demo path never sends an SMS and does not require a real judge phone number. Real numbers continue through Twilio Verify when configured.

## Gemini assistant troubleshooting
If the browser console shows `/api/v1/assistant/chat` with HTTP 503, the backend is running but Gemini credentials are missing or rejected. Set `GEMINI_API_KEY` in `backend/.env`, keep `GEMINI_MODEL=gemini-3.8-flash`, restart the backend, and retry. HTTP 429 means Gemini is temporarily rate-limited.
