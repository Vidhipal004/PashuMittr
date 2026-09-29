# 90-second demo path

1. Start the Node API.
2. Start the Vite frontend.
3. Open PashuMittr and choose **Log In**.
4. Pick **Farmer** → enter any 10-digit demo mobile → OTP `123456`.
5. Tap **Feed Test**.
6. Use the camera/upload path or choose the supplied **NIR sample fallback**.
7. Tap **Complete analysis** and show the API-backed sequence:
   - test created
   - visual screen
   - NIR model prediction
   - combined assessment
   - SHA-256 verification
8. On the result page, open **Technical verification** and show the QR/hash record.
9. Use **Read result aloud** or the voice assistant.
10. Go back and show **Silage Test** with pH, temperature and humidity.
11. Explain the offline branch: network loss → local save → sync queue → `/api/v1/sync`.
12. For judges, show `docs/architecture.svg` and `docs/workflow.svg`.
