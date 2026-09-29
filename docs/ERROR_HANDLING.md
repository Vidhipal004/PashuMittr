# PashuMittr Error Handling

## Principle

Every major feature has loading, empty, error and success states.

## Core errors

| Code | Meaning | UI action |
|---|---|---|
| `INVALID_PHONE` | Phone format invalid | Ask user to correct input |
| `OTP_INVALID` | Demo OTP mismatch | Show expected demo OTP |
| `INVALID_TEST_TYPE` | Unknown test type | Ask user to select feed/silage |
| `TEST_NOT_FOUND` | Record missing | Return to history / retry |
| `NIR_SPECTRUM_MISSING` | No spectrum payload | Ask for device/demo sample |
| `NIR_SPECTRUM_LENGTH_INVALID` | Unsupported spectrum size | Resample/device validation |
| `SILAGE_INPUT_INVALID` | pH/temp/humidity invalid | Highlight fields |
| `NETWORK_UNAVAILABLE` | API cannot be reached | Save offline + queue sync |
| `REQUEST_TIMEOUT` | API too slow | Offer retry |
| `INVALID_JSON` | Malformed request | Retry request |
| `INTERNAL_ERROR` | Unexpected server failure | Safe fallback + request ID |

## Offline behavior

```text
Network failure
   ↓
Save test locally
   ↓
Show “Saved offline”
   ↓
Queue sync item
   ↓
Network restored
   ↓
POST /api/v1/sync
   ↓
Clear local queue after successful sync
```

## AI/model conflict

When visual and NIR evidence disagree, the system does **not** silently turn that into a definitive contamination claim. It can surface a monitor/follow-up status and recommend confirmatory testing.

## Safety boundary

Phone image screening is not used as a claim of confirmed aflatoxin/mycotoxin detection. NIR outputs are limited to the parameters represented in the supplied dataset/model.
