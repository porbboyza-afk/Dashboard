# Garmin Direct Machine Migration Handoff

Last updated: 2026-07-12

## Purpose

เอกสารนี้ใช้เมื่อต้องย้าย MyDash Garmin Direct Bridge จากคอม Windows เครื่องเดิมไปเครื่องใหม่ โดยมีเป้าหมายให้ข้อมูลไม่ซ้ำ ไม่สูญหาย และไม่ย้าย credential แบบไม่ปลอดภัย

## Important Principle

Garmin session ปัจจุบันเข้ารหัสด้วย Windows DPAPI Current User scope ดังนั้น `session.enc` ผูกกับ Windows user/เครื่องเดิมและไม่ควรนำไปใช้บนเครื่องใหม่

เครื่องใหม่ต้องล็อกอิน Garmin ใหม่หนึ่งครั้งเพื่อสร้าง session ที่เข้ารหัสสำหรับเครื่องนั้นเอง

## Relevant Locations

- Repository: `C:\Users\pucca\Dashboard-GitHub`
- Bridge source: `C:\Users\pucca\Dashboard-GitHub\tools\garmin-direct-bridge`
- Machine-local runtime: `%LOCALAPPDATA%\MyDash\garmin-direct`
- Main Garmin handoff: `GARMIN_DIRECT_HANDOFF.md`
- General project handoff: `AI_HANDOFF_LOG.md`

## What Must Move

- Repository code through GitHub or a verified repository backup.
- Firebase project configuration that is already part of the application and contains no private Garmin credential.
- This migration handoff and the main Garmin Direct handoff.
- Non-secret sync configuration after an export command exists.
- Cloud-side source mappings and deduplication decisions after Firebase integration exists.

## What Must Not Move

- Garmin email/password stored in any file.
- MFA codes.
- `%LOCALAPPDATA%\MyDash\garmin-direct\secrets\session.enc`.
- Browser cookies or raw Garmin authorization headers.
- Request-budget SQLite state as a substitute for a fresh installation.
- Test FIT archives unless they are deliberately needed for development and transferred securely.
- `.env` files containing credentials.

## Current Limitation

The integration is still local-first and Firebase writer work is not complete. Until cloud checkpoints/source mappings exist, the old local SQLite database contains useful sync and deduplication state.

If migration occurs before Firebase integration is complete, retain an encrypted backup of the old runtime directory for rollback, but do not copy its DPAPI session into active use on the new computer.

## Before Leaving The Old Computer

1. Confirm the repository working tree and push intended source changes to GitHub.
2. Run the complete test suite:

```powershell
cd C:\Users\pucca\Dashboard-GitHub\tools\garmin-direct-bridge
python -m unittest discover -s tests -v
```

3. Record the current privacy status:

```powershell
python -m garmin_direct.cli privacy-status
```

4. Record only metadata required for comparison:
   - last successful activity sync date,
   - activity source count,
   - canonical activity count,
   - wellness record counts per domain,
   - latest successful run status.
5. Do not record health values, tokens, cookies, passwords, or raw payloads in the handoff.
6. If Firebase integration is already active, complete one manual sync and confirm that cloud counts match the local canonical counts.
7. Stop any Windows Task Scheduler entry before enabling the new machine. Only one active bridge should write at a time.
8. Keep the old machine unchanged until the new machine passes verification.

## Optional Rollback Backup

Create an encrypted backup containing machine-local SQLite metadata and reports only when rollback is required. The backup may include the old `session.enc`, but that file remains usable only by the original Windows identity and must never be committed or uploaded unencrypted.

Preferred retention:

- Keep the backup offline or inside an encrypted archive.
- Label it with computer name and migration date.
- Delete it after the new machine has operated correctly for an agreed retention period.

## Install On The New Computer

1. Install Git and a supported Python version.
2. Clone the same MyDash repository and checkout the intended branch/commit.
3. Enter the bridge directory:

```powershell
cd C:\Users\<NEW_USER>\Dashboard-GitHub\tools\garmin-direct-bridge
```

4. Install the bridge:

```powershell
python -m pip install -e .
```

5. Run tests before using real credentials:

```powershell
python -m unittest discover -s tests -v
```

6. Confirm the new runtime is empty:

```powershell
python -m garmin_direct.cli privacy-status
```

Expected before login:

- `encryptedSessionPresent` is `false`.
- `firebaseWrites` is `false` until the writer is deliberately enabled.
- `schedulerEnabled` is `false`.

## Login On The New Computer

Run interactive login:

```powershell
python -m garmin_direct.cli login
```

Enter Garmin email, password, and MFA only in the interactive prompts. Do not pass them as command arguments and do not create a plaintext `.env` file.

Confirm afterward:

```powershell
python -m garmin_direct.cli privacy-status
```

Expected: `encryptedSessionPresent` is `true`.

## Initial Sync On The New Computer

Do not perform unlimited history import. Start with the bounded activity refresh:

```powershell
python -m garmin_direct.cli sync-activities --full
```

Then run wellness when the rolling request budget allows:

```powershell
python -m garmin_direct.cli sync-wellness --days 3
```

The request budget must not be cleared or raised merely to accelerate migration.

## Deduplication Verification

Before enabling Firebase writes or scheduler on the new machine, verify:

- Garmin source count is plausible compared with the old machine.
- Canonical activity count does not increase unexpectedly.
- Re-running activity sync reports `inserted: 0` for the overlap window when no new activity exists.
- Known Garmin activities that also exist in Strava/Health Connect resolve to one canonical workout.
- Ambiguous matches remain in `review` state rather than being silently merged.
- Weekly distance, training load, activity count, and Coach input are not doubled.

## Firebase-Aware Migration

After Firebase writer implementation is complete, the cloud must become the durable source for:

- canonical activity IDs,
- source-to-canonical mappings,
- deduplication decisions,
- last committed source cursors,
- schema versions and migration state.

The new machine should read those cloud checkpoints, apply a small overlap window, and upsert deterministically. It must never generate new random IDs for previously synced Garmin activities.

## Cutover

Enable the new machine only after all verification checks pass:

1. Complete a manual dry-run.
2. Review proposed Firebase inserts/updates and confirm there are no unexpected duplicates.
3. Complete one manual real sync.
4. Verify MyDash desktop and mobile activity/wellness views.
5. Verify Coach sees canonical workouts only once.
6. Disable the bridge/scheduler permanently on the old machine.
7. Enable scheduler on the new machine only after manual sync remains stable.

## Rollback

If the new machine creates unexpected records or mismatched totals:

1. Stop its bridge and scheduler immediately.
2. Do not run additional sync attempts.
3. Preserve the new machine's redacted run metadata for diagnosis.
4. Re-enable the old machine only if it was not modified and no concurrent writer remains active.
5. Use Firebase audit/dry-run records to identify the affected deterministic IDs.
6. Do not mass-delete records without verifying source mappings and user ownership.

## Old Computer Decommission

After the new computer has remained stable:

1. Run `python -m garmin_direct.cli logout` on the old machine.
2. Confirm its local `session.enc` has been removed.
3. Remove its scheduled task.
4. Delete the runtime directory only after any required encrypted rollback retention expires.
5. Do not delete Garmin cloud data or Firebase records during machine decommissioning.

## Future Commands To Implement

These commands should be added before calling migration support complete:

```powershell
python -m garmin_direct.cli export-config
python -m garmin_direct.cli import-config <file>
python -m garmin_direct.cli verify
python -m garmin_direct.cli status
```

`export-config` must exclude all credentials, DPAPI blobs, cookies, raw health payloads, and authorization data.

## Migration Completion Checklist

- [ ] Repository and handoffs available on the new machine.
- [ ] Test suite passes on the new machine.
- [ ] New DPAPI session created through interactive login.
- [ ] Bounded activity sync completes.
- [ ] Wellness sync completes within request budget.
- [ ] No unexpected duplicate canonical activities.
- [ ] Firebase dry-run contains only expected deterministic changes.
- [ ] MyDash totals and Coach inputs remain correct.
- [ ] Old scheduler disabled before new scheduler enabled.
- [ ] Old session removed after retention period.
