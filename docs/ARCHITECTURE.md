# PashuMittr System Architecture

```text
                         ┌────────────────────┐
                         │   PashuMittr       │
                         │ Farmers / Coop /   │
                         │ Expert / Officer   │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │ React / PWA UI     │
                         │ Camera • Voice •   │
                         │ Language • Offline │
                         └─────────┬──────────┘
                                   │ HTTPS/JSON
                                   ▼
                         ┌────────────────────┐
                         │ Versioned API      │
                         │ /api/v1            │
                         │ Auth • Validation  │
                         │ Errors • Sync      │
                         └─────────┬──────────┘
                                   │
              ┌────────────────────┼───────────────────┐
              │                    │                   │
              ▼                    ▼                   ▼
      ┌───────────────┐    ┌──────────────┐    ┌──────────────┐
      │ Visual/CV     │    │ NIR ML       │    │ Silage/IoT   │
      │ screening     │    │ PLS model    │    │ pH/temp/hum. │
      └───────┬───────┘    └──────┬───────┘    └──────┬───────┘
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  ▼
                       ┌──────────────────────┐
                       │ Combined Evidence   │
                       │ Assessment Engine    │
                       └───────────┬──────────┘
                                   │
                         ┌─────────┴────────┐
                         ▼                  ▼
                  ┌─────────────┐   ┌─────────────┐
                  │ Advisory    │   │ Trust Layer │
                  │ + Voice     │   │ QR + SHA256 │
                  └──────┬──────┘   └──────┬──────┘
                         │                 │
                         └────────┬────────┘
                                  ▼
                       ┌──────────────────────┐
                       │ History / Analytics  │
                       │ / Cooperative views  │
                       └──────────────────────┘
```

### Separation rule

The frontend never talks directly to the NIR model, database or audit store. It calls versioned APIs. This keeps input validation, error handling and model evolution in one controlled layer.
