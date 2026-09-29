# PashuMittr v22

## Gemini / general farmer assistant
- Backend now auto-loads `backend/.env`.
- With a valid `GEMINI_API_KEY`, PashuMittr AI sends **general farmer questions and test-specific questions to live Gemini**.
- The old canned “latest test / silage” answer is no longer the general-question fallback.
- If Gemini is missing, general questions show an explicit configuration error instead of pretending to be a live AI answer.
- The Gemini prompt preserves PashuMittr scientific boundaries and asks for conservative escalation on high-risk veterinary topics.

## Farmer profile
- Feed Test and Profile include a Breed dropdown with **Other / enter manually**.
- Breed, species, production stage and milk yield are carried in the AI context and test metadata.

## Storage environment / IoT
- Farmer Home, Feed Test, Silage Test and Result show **storage-room temperature + humidity**.
- The reading refreshes from the demo sensor endpoint; every 10 seconds the demo values change slightly.
- Feed/silage assessment receives the storage reading as evidence.
- Current rule-engine demo thresholds: storage temperature >35°C or humidity >80% changes the screening to **Monitor** and adds a storage corrective action.
- Current source is explicitly **Demo IoT sensor**; a real ESP32/BLE/Wi-Fi device can publish to the same API in a later hardware integration.

## Integrity
- No `.env` secret is included in the ZIP.
