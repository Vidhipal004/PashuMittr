# Offline Sync Design

## Data stores

IndexedDB database: `pashumitr-offline-v2`

Stores:
- `local_tests`: recent test records and sync status.
- `sync_queue`: pending/failed outbound items.
- `meta`: reserved for future sync metadata.

## Sync lifecycle

```text
Create test
   ↓
API success? ── yes ──> persist synced result
   │
   no
   ↓
Save result locally
   ↓
Queue outbound item with client_id
   ↓
Internet returns
   ↓
flushQueue()
   ↓
POST /api/v1/sync (one item at a time)
   ↓
server returns client_id → server_id
   ↓
delete queue item
   ↓
mark local test synced
```

## Reliability

- Idempotency is enforced server-side using `client_id`.
- Partial failures do not delete successful queue items.
- Retryable failures get exponential backoff.
- Permanent failures remain visible in the queue until manually retried.
- `online` events trigger a flush.
- A periodic retry runs while the app is open.

## Offline media

Recent test images are stored with the local test record in IndexedDB. They are not sent during the `/api/v1/sync` queue request in this hackathon build; the sync payload contains structured test data only. This keeps retries small and avoids repeatedly uploading large image payloads.


## v5 additions
Interactive QR scan/verify, cooperative alert investigation, village details, expert review, field-officer case actions, dark/light theme, market alternatives, and explicit PashuMittr AI entry points are now available in the frontend. BHASHINI is configuration-ready but still requires approved credentials/service IDs for real ASR/TTS.
