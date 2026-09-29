# PashuMittr real phone authentication

## 1. Twilio Verify
Create a Twilio Verify Service with SMS verification enabled.

## 2. backend/.env
Copy `.env.example` to `.env` and fill:

```env
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=VA...
AUTH_SECRET=<random-secret>
```

Generate a secret with `openssl rand -hex 32`. Never commit `.env`.

## 3. Run
Terminal 1: `cd backend && npm install && node server.js`
Terminal 2: `cd frontend && npm install && npm run dev`

## 4. Flow
Sign Up checks that the number is not registered, sends an SMS through Twilio Verify, verifies the OTP, creates a persistent user in `backend/data/users.json`, and returns a 7-day session token. Log In requires an existing account and the same role.
