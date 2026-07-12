# Endpoint Notes

The adapter pins `garminconnect==0.3.6` and exposes a strict read-only allowlist. Phase 0 performs no automatic retry. HTTP 401/403 opens the circuit for manual intervention; 429 opens it for 15 minutes. The generated report contains only field names, types, nullability, collection counts, and optional FIT hash metadata.

## Observed 2026-07-12

- Session restore from DPAPI succeeded.
- Activity lists succeeded for both 7-day and 30-day windows.
- Activity summary, chart/polyline detail, and splits succeeded.
- Sleep, HRV, heart rate, stress, and Body Battery succeeded for the three-day wellness probe.
- One explicit original activity download succeeded. In this library version the format enum is nested at `Garmin.ActivityDownloadFormat.ORIGINAL`.
- No retry, rate-limit response, authentication challenge, or response-contract failure was observed.
- Effective inherited ACL grants Full Control only to the current user, SYSTEM, and local Administrators.
