# PashuMittr on Mac (Apple Silicon M1/M2/M3/M4)

This build uses JavaScript-only dependencies and does not require x86/Rosetta binaries.
Node 22 LTS is recommended. Vite 7 requires Node 20.19+.

## First-time setup

```bash
cd ~/Downloads/PashuMittr_Hackathon_v24
cp backend/.env.example backend/.env
```

Fill `backend/.env` with your Twilio Verify credentials and a random `AUTH_SECRET`.

Generate the secret with:

```bash
openssl rand -hex 32
```

## Run everything

```bash
./run-mac-linux.sh
```

The API listens on `http://127.0.0.1:8787` and Vite on `http://localhost:5173`.

## Manual two-terminal run

Terminal 1:

```bash
cd ~/Downloads/PashuMittr_Hackathon_v24/backend
npm install
node server.js
```

Terminal 2:

```bash
cd ~/Downloads/PashuMittr_Hackathon_v24/frontend
npm install
npm run dev -- --host 127.0.0.1
```

## Check Node

```bash
node -v
npm -v
```

Node must be at least `20.19.0`; Node 22 LTS is recommended.
