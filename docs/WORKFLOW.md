# PashuMittr Workflow

## Farmer feed workflow

```text
Landing
  ↓
Login / Sign Up
  ↓
Select role → Farmer
  ↓
Farmer Home
  ↓
Feed Test
  ↓
Camera / Upload
  ↓
Image quality check
  ↓
Visual screening
  ↓
NIR screening
  ↓
Combined Evidence Engine
  ↓
Good / Monitor / High Risk (screening status)
  ↓
Simple explanation + advisory
  ↓
Read aloud / Voice assistant
  ↓
Save history
  ↓
QR + SHA-256 integrity record
  ↓
Monitor / Sync / Act
```

## Farmer silage workflow

```text
Silage Test
  ↓
pH + temperature + humidity + mould indicators
  ↓
Validation
  ↓
Storage assessment
  ↓
Good / Monitor
  ↓
Storage advisory
  ↓
History + offline sync
```

## Cooperative workflow

```text
Cooperative login
  ↓
Command center
  ↓
Farmers / Tests / Alerts / Risk Map / Traceability
  ↓
Open risk cluster
  ↓
Review affected samples
  ↓
Assign field officer / confirmatory testing
  ↓
Track action and resolution
```

## Error-aware workflow

```text
Any step
  ↓
Validate input
  ├── invalid → friendly correction message
  ├── service unavailable → retry/partial result where safe
  └── network lost → local save + sync queue
```


## v5 additions
Interactive QR scan/verify, cooperative alert investigation, village details, expert review, field-officer case actions, dark/light theme, market alternatives, and explicit PashuMittr AI entry points are now available in the frontend. BHASHINI is configuration-ready but still requires approved credentials/service IDs for real ASR/TTS.
