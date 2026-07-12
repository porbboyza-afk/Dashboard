# Garmin Direct Integration Handoff

Last updated: 2026-07-12

## Purpose

เอกสารนี้เป็น handoff แยกสำหรับงาน Garmin Direct ของ MyDash ใช้เป็นสถานะอ้างอิงหลักเมื่อเริ่มงานรอบใหม่ เพื่อไม่ให้สับสนระหว่าง "ดึงข้อมูล Garmin ได้" กับ "ระบบพร้อมซิงก์เข้าแอปจริง"

## Project Locations

- MyDash repository: `C:\Users\pucca\Dashboard-GitHub`
- Phase 0 bridge: `C:\Users\pucca\Dashboard-GitHub\tools\garmin-direct-bridge`
- Local runtime data: `%LOCALAPPDATA%\MyDash\garmin-direct`
- Original implementation plan: `C:\Users\pucca\Desktop\MYDASH_GARMIN_DIRECT_INTEGRATION_PLAN_FINAL_WITH_GPT_REVIEW_Final.md`
- General project handoff: `C:\Users\pucca\Dashboard-GitHub\AI_HANDOFF_LOG.md`
- Machine migration runbook: `C:\Users\pucca\Dashboard-GitHub\GARMIN_DIRECT_MACHINE_MIGRATION_HANDOFF.md`

## Current Status

Phase 0 Read-Only Capability Probe is complete locally.

Completed:

- Interactive Garmin login works.
- Session is encrypted with Windows DPAPI Current User scope.
- Session restoration works without retaining the Garmin password.
- Real activity probes passed for 7-day and 30-day windows.
- Activity summary, detail, and splits passed.
- Sleep, HRV, heart rate, stress, and Body Battery probes passed.
- One explicitly requested original FIT download passed.
- Request budget is persisted in SQLite: 30/hour, 200/day, two-second spacing.
- Authentication, account challenge, and rate-limit circuit breakers exist.
- Unit tests pass 5/5.
- Effective directory ACL was inspected: current user, SYSTEM, and local Administrators have Full Control.

Phase 1 activity slice completed locally on 2026-07-12:

- Added versioned local SQLite tables for sync runs, per-domain cursors, and Garmin source activity metadata.
- Added a bounded 30-day initial activity window and two-day incremental overlap.
- Added deterministic upsert by Garmin `activityId` and canonical payload hash.
- Cursor advancement and source upserts occur in one transaction.
- Failed collection records a failed run and does not advance the cursor.
- Local source rows retain only ID, start time, type, hash, and observation timestamps; raw Garmin payloads are not duplicated into SQLite.
- Real first run fetched and inserted 23 records. The immediate overlap run inserted zero and retained 23 total records.
- Tests pass for repeat-run idempotency, changed-payload update, bounded overlap, and failure without cursor advancement.

Canonical activity contract slice completed locally:

- Added Garmin normalization to the existing MyDash `date/dist/time/hr/cad/type/avgPace` contract.
- Added UTC identity, schema version, source/source ID, elevation, calories, and field provenance.
- Garmin meters/seconds are converted deterministically to kilometers/minutes; unsupported values remain null rather than silently becoming zero.
- Added cross-source matching for Garmin, Strava, and Health Connect with explicit `duplicate`, `review`, and `distinct` outcomes.
- Same-source identity is deterministic; fuzzy matching uses activity type, start-time distance, duration tolerance, and distance tolerance.
- Normalization and deduplication tests bring the full bridge suite to 14 passing tests.

Wellness incremental collector implementation completed locally:

- Added independent cursors and run audit for sleep, HRV, heart rate, stress, and Body Battery.
- Daily domains upsert by domain/date; Body Battery uses one bounded range request.
- Local wellness storage contains payload hashes and schema shapes, not duplicated health values.
- Repeat runs, failure cursor behavior, range calls, and privacy storage are covered by tests.
- First real run was correctly blocked before its first request because the persisted 30/hour budget had been consumed by development probes. No wellness rows or cursors were committed.
- Resume with `python -m garmin_direct.cli sync-wellness --days 3` after the rolling hourly budget becomes available. Do not clear request history or increase limits.

Real wellness completion update:

- Real three-day sync completed for sleep, HRV, heart rate, stress, and Body Battery.
- Immediate overlap sync inserted zero new sleep/HRV/heart-rate/stress records.
- Body Battery initially exposed a range-aggregation defect: a changing overlap window changed the hash for the same end date.
- Collector now splits Body Battery arrays by their explicit `date`; bounded full refresh migrated the local database to three daily records.
- Local counts are now three records for each wellness domain.
- Full bridge suite passes 24 tests, including per-date Body Battery overlap idempotency.

Wellness application integration completed locally:

- Added canonical wellness normalization for sleep, HRV, heart rate, stress, and Body Battery; raw sample arrays are excluded.
- Sleep and HRV real canonical backfill completed. Heart rate, stress, and Body Battery canonical backfill remain pending only because the rolling 30/hour request budget is full.
- Added deterministic wellness Firebase planning under `wellness_sources/garmin/<date>/<domain>` so manual `wellness` records are never overwritten.
- Settings importer validates and imports both activity and wellness manifest kinds with separate owner-prefix allowlists.
- Added realtime Garmin wellness listener and derived merge. Manual non-empty values override Garmin; missing manual values fall back to Garmin.
- Garmin sleep minutes become hours, sleep/stress scores are converted to the existing 1-10 UI scale, and HRV/resting HR feed existing wellness analytics/recovery contracts.
- Updated central activity model to deduplicate Garmin/Health Connect/Strava/manual records before Coach, load, stats, and graphs consume them. Time tolerance is correctly expressed as three minutes.
- Bridge suite passes 29 tests; activity dedupe behavior, dashboard syntax, and smoke regression pass.

Timed resume worker:

- Added `garmin_direct.resume_worker`, which reads the persisted rolling budget and waits without calling Garmin.
- It requires capacity for all seven remaining requests before starting Heart rate, Stress, and Body Battery backfill.
- After backfill it creates the deterministic wellness Firebase dry-run manifest automatically.
- It logs metadata only to `%LOCALAPPDATA%\MyDash\garmin-direct\logs\resume-wellness.jsonl`.
- Worker started hidden on 2026-07-12 with PID 18468 and entered `waiting` state for the budget window.
- The worker does not perform Firebase writes; the generated manifest still requires authenticated Settings import confirmation.
- Full bridge suite passes 30 tests.

First real wellness cloud import:

- Resume worker completed successfully at 09:37 local time and exited normally.
- Heart rate, Stress, and Body Battery canonical backfill completed for three days.
- Final wellness manifest contained 15 unique deterministic operations across five domains and three dates; invalid owner paths were zero.
- The account owner confirmed importing the wellness manifest through the authenticated MyDash Settings UI.
- Post-import regression passed: bridge 30/30, activity dedupe behavior, dashboard syntax, and smoke tests with no page, console, or request failures.
- Repository secret scan found no supplied Garmin email/password or bearer credentials in the changed Garmin Direct files.
- Cloud import confirmation is user-reported; the local automated browser did not have access to the authenticated session for an independent Firebase readback.

Firebase dry-run foundation completed locally:

- Added deterministic Firebase workout keys (`garmin_<activityId>`) and `set` operations under `users/<uid>/workouts`.
- A valid explicit Firebase UID is mandatory; email addresses and paths are rejected.
- Added dry-run JSON manifests only. No network writer or live Firebase mutation is enabled.
- Added `status`, `verify`, `export-config`, and `import-config` commands.
- Exported configuration contains only fixed request/window settings and no credential/session values.
- Local verification reports 23 source activities, 23 canonical activities, valid SQLite integrity, encrypted session present, Firebase writes disabled, and scheduler disabled.
- Full suite passes 23 tests.
- Next blocker for a real dry-run manifest is the authenticated MyDash Firebase UID. Do not infer it from email.

Firebase ownership dry-run completed locally:

- The authenticated MyDash UID was supplied interactively and used only in the LocalAppData report; it is not recorded in the repository or handoff.
- The manifest contains 23 deterministic `set` operations and 23 unique paths.
- All paths passed the expected `users/<authenticated uid>/workouts/garmin_*` ownership boundary.
- Invalid-owner paths: zero. Non-`set` operations: zero.
- Live Firebase writing remains disabled. The production writer should execute through the authenticated MyDash browser session so the bridge never stores a Firebase ID token.

Authenticated MyDash importer implemented locally:

- Added Garmin Direct Import to the MyDash Settings page.
- The browser reads a local dry-run manifest and verifies manifest version, operation count, signed-in UID, owner path, Garmin source, deterministic path, and duplicate paths before enabling import.
- Import requires an explicit browser confirmation and uses the existing authenticated `window._fb.setData` boundary; the local bridge never receives or stores a Firebase ID token.
- Writes use deterministic `workouts/garmin_<activityId>` paths, so retrying cannot create push-key duplicates.
- Progress and stopped/error states are visible. On completion, `sync_sources/garmin_direct` records last sync, status, activity count, and schema version.
- Dashboard syntax verification and smoke regression pass with no page, console, or request errors.
- No real Firebase write has occurred yet. The first import must be performed from Settings with the already generated LocalAppData manifest and reviewed afterward.

Cross-source reconciliation added after the first import exposed duplicates:

- Settings can scan imported Garmin workouts against existing Strava, Health Connect, and manual workouts.
- Matching uses activity type, start time/date, duration, and distance with explicit duplicate/review/distinct thresholds.
- Only high-confidence Garmin copies with deterministic `garmin_` keys can be selected for removal.
- Review-range matches are shown but never removed automatically.
- Existing non-Garmin records are retained.
- Future manifest previews skip high-confidence cross-source duplicates before writing.
- Removal still requires explicit user confirmation in the authenticated MyDash page.

Not implemented:

- No Firebase writer.
- No wellness incremental collectors yet.
- No Garmin-to-MyDash normalization layer.
- No cross-source deduplication.
- No MyDash UI integration.
- No background scheduler.
- No Android direct Garmin integration.
- No Coach consumption of Garmin Direct data.

## Why Phase 0 Was Necessary

Garmin Direct in this project relies on an unofficial/reverse-engineered client rather than a guaranteed public contract. Endpoint availability, response fields, authentication behavior, and account challenges can change without notice.

Phase 0 therefore had to prove the following before any production data write:

1. Authentication and session restoration work on this computer.
2. Required activity and wellness data are actually available for this account.
3. Request volume can remain conservative enough to reduce rate-limit and account-challenge risk.
4. Credentials and session material can remain outside the repository.
5. Reports can inspect response contracts without duplicating private health values into development artifacts.

Skipping this phase would risk building Firebase and UI code around endpoints or fields that may not exist.

## What "Usable" Means

The integration is usable only when all of these conditions are met:

- New Garmin records sync incrementally rather than repeatedly downloading full history.
- Re-running sync produces no duplicate activities or wellness records.
- Garmin records are converted into a stable internal MyDash schema.
- Timezone, units, null values, activity types, laps, and sensor samples are normalized consistently.
- The system can distinguish Garmin, Strava, and Health Connect records representing the same workout.
- Firebase writes are idempotent and scoped to the authenticated MyDash user.
- Existing MyDash and Coach behavior remains unchanged when Garmin is unavailable.
- The UI exposes source, last sync, partial failure, re-authentication, and retry states.
- Real-data regression checks pass against Garmin Connect for activity and wellness totals.

Phase 0 alone does not satisfy these conditions. It proves only that the source can be read safely enough to continue development.

## Required Work Order

### Phase 1: Local Incremental Sync Engine

Build checkpoint-based local collection before introducing Firebase.

Required work:

- Persist separate cursors for activities and each wellness domain.
- Fetch only a bounded overlap window around the last successful cursor.
- Store source identifiers, payload hashes, observed timestamps, and sync-run status.
- Make every collection operation resumable after process or network failure.
- Add explicit states for success, partial success, auth required, challenged, rate limited, and contract changed.
- Never automatically retry authentication or account challenge failures.

Why this must come first:

Without checkpoints and idempotency, every sync could re-download history, exhaust the request budget, and create duplicate records later.

Exit criteria:

- Two consecutive local syncs create zero duplicate records.
- Interrupted sync resumes from a safe checkpoint.
- No endpoint exceeds the configured request budget.

### Phase 2: Canonical Normalization And Provenance

Create a source-independent schema used by MyDash.

Required work:

- Normalize activity identity, type, start time, timezone, duration, distance, pace, heart rate, elevation, calories, laps, and samples.
- Normalize sleep windows/stages, HRV, heart rate, stress, and Body Battery.
- Preserve raw source identifiers and schema version.
- Record provenance for every normalized field.
- Define null/missing/unsupported semantics explicitly.

Why this is required:

Garmin, Strava, and Health Connect use different names, units, precision, and availability. Binding UI or Coach directly to Garmin fields would spread source-specific assumptions through the application and make future changes dangerous.

Exit criteria:

- Fixture tests cover every observed response shape.
- Unit and timezone conversions are deterministic.
- Unsupported fields remain explicit rather than silently becoming zero.

### Phase 3: Cross-Source Deduplication And Priority

Determine when multiple sources describe one workout.

Required work:

- Match using source IDs where linked and a time/duration/distance fingerprint otherwise.
- Define tolerances for start time, duration, and distance.
- Keep all source provenance while presenting one canonical activity.
- Define field-level priority instead of deleting lower-priority records.
- Provide a manual review state for ambiguous matches.

Why this is required:

The same Garmin workout may already reach MyDash through Strava or Health Connect. Writing Garmin activities directly would inflate mileage, training load, statistics, and Coach analysis.

Exit criteria:

- Known duplicate fixtures collapse into one canonical activity.
- Distinct workouts close in time remain separate.
- Deduplication decisions are explainable and reversible.

### Phase 4: Firebase Writer

Add a narrow write boundary only after local sync and normalization are stable.

Required work:

- Use deterministic document/record keys.
- Validate authenticated user ownership.
- Use idempotent upsert semantics.
- Version normalized schemas and migrations.
- Separate sync metadata from user-visible health data.
- Add dry-run and write-audit modes.
- Never upload Garmin credentials or DPAPI session material.

Why this is delayed:

Firebase increases blast radius. A normalization or deduplication bug can affect the live dashboard, statistics, and Coach. Local verification must happen before production writes.

Exit criteria:

- Dry-run output matches expected Firebase mutations.
- Repeating the same batch produces no additional records.
- Security rules reject cross-user access.
- Rollback/rebuild procedure is documented and tested.

### Phase 5: MyDash UI And Coach Integration

Expose Garmin data through existing MyDash contracts rather than direct endpoint calls.

Required work:

- Add source and last-sync status.
- Add manual Sync Garmin command with progress and actionable errors.
- Bind normalized activity detail and wellness metrics to current views.
- Preserve loading, empty, partial, stale, offline, and re-auth states.
- Feed Coach only canonical deduplicated data.
- Keep source provenance visible in detailed views.

Why this comes after Firebase:

The UI and Coach need a stable internal contract. Connecting them earlier would couple product behavior to an unofficial Garmin response format and could double-count training load.

Exit criteria:

- Desktop and mobile regression tests pass.
- Garmin unavailable does not break existing Strava/Health Connect behavior.
- Coach never analyzes duplicate workouts.

### Phase 6: Scheduling And Operational Hardening

Automation is the last step.

Required work:

- Add a Windows scheduler only after manual sync is stable.
- Prevent overlapping runs with a process lock.
- Add conservative backoff, circuit state, and actionable local notifications.
- Add retention, log rotation, privacy cleanup, and health checks.
- Document re-authentication and disaster recovery.

Why scheduling is last:

Automation repeats defects without supervision. A scheduler must not amplify endpoint changes, authentication failures, duplicate writes, or excessive requests.

Exit criteria:

- Repeated scheduled runs remain within budget.
- Concurrent starts collapse into one active run.
- Failure recovery requires no database repair.

## Non-Negotiable Safety Rules

- Never commit Garmin email, password, MFA, OAuth/session token, cookie, or raw authorization headers.
- Do not add a plaintext credential fallback or `.env` password storage.
- Keep session material under DPAPI Current User encryption.
- Do not print raw Garmin payloads or personal health values in logs/tests/handoff files.
- Do not write Firebase until normalization, provenance, and deduplication tests pass locally.
- Do not let Coach consume raw Garmin payloads.
- Do not add an automatic scheduler before manual end-to-end sync is reliable.
- Do not silently raise request limits or bypass an open circuit.
- Do not bulk-download FIT history during development.

## Phase 0 Commands

Run from:

`C:\Users\pucca\Dashboard-GitHub\tools\garmin-direct-bridge`

```powershell
python -m garmin_direct.cli privacy-status
python -m garmin_direct.cli probe --days 7
python -m garmin_direct.cli probe --days 30 --activities-only
python -m unittest discover -s tests -v
```

Do not run `login` again unless the encrypted session is missing, expired, or rejected.

## Next Concrete Task

Start Phase 1 with a design-and-fixture pass before implementing collection writes:

1. Persist canonical normalized records and explainable deduplication decisions in local SQLite.
2. Add adapters for existing Strava and Health Connect workout shapes and run mixed-source fixture tests.
3. Add wellness cursors and collectors one domain at a time.
4. Design Firebase dry-run mutations only after mixed-source tests pass.
5. Keep live Firebase/UI writes blocked until dry-run, ownership, and idempotency tests pass.

Do not begin with Firebase or UI changes.

## Git Status At Handoff

The Garmin Direct work and this handoff are local changes. They have not been committed or pushed unless a later log entry explicitly records that action.
