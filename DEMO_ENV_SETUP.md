# PashuMittr Demo Environment

The ZIP includes local `.env` files so the project can be started without creating the files manually.

## Judge demo login

- Mobile: `0000000000`
- OTP: `123456`
- No SMS is sent for this demo path.
- `DEMO_AUTH_ENABLED=true` is already set in `backend/.env`.

## Real API keys

The ZIP intentionally does not contain real Gemini, ElevenLabs, or Twilio credentials. Put your real server-side keys in `backend/.env` before testing those live services. Never put these keys in `frontend/.env` or commit them to GitHub.

## Local run

Terminal 1:

```bash
cd backend
npm install
npm start
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.
