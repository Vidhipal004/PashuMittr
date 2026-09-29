# PashuMittr Hackathon v12

**Test. Understand. Act.**

PashuMittr is a multilingual, voice-first feed and silage screening prototype for Indian dairy workflows.

## Data used

### Supplied NIR spectrum dataset
`backend/data/source_dataset/Dataset NIR Spectrum of Animal Feed.xlsx`

The model is rebuilt from the supplied **25-sample** animal-feed NIR dataset. The spectral targets are **IVOMD, IVDMD, NDF and ADF**. The runtime exposes a PLS regression screening model; this is a proof-of-concept model and is **not validated for laboratory deployment**.

### Supplied dummy feed dataset
`backend/data/demo_feed_dataset.json`

The five rows F001–F005 from the supplied image are included as **demo/reference records**. They are kept separate from NIR training and are never presented as phone-camera or NIR-detected aflatoxin/adulteration results.

## Run

### Backend
```bash
cd backend
node server.js
```
Default API: `http://localhost:8787`

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Open the localhost URL shown by Vite.

Demo OTP: `123456`

## Main demo path

Login → Farmer → Feed Test → choose supplied demo/reference row → Camera / Upload → Visual Screening → supplied NIR sample → Combined Assessment → Direct Farmer Decision → Advisory → PashuMittr AI → QR → History → Silage Test → Cooperative → Alerts → Risk Map → Expert/Lab.

## Scientific boundary

- The phone camera is a **visual screening** layer only.
- NIR is a separate spectral screening layer.
- The current NIR model does not claim to detect aflatoxin/mycotoxins.
- Confirmatory laboratory testing is required for final safety/contamination decisions.
- Gemini, when configured, only explains the rule-engine result; it does not control the status/action decision.
