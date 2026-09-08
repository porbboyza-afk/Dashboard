# Health Connect activity detail proposal — 2026-09-08

Status: explicitly approved by the user on 2026-09-08, implemented locally, built and installed as version 0.2.0, and verified with a foreground device sync. GitHub push remains prohibited.

## Foreground device result

- Phone: Samsung SM-A346E. Source route in use: Huawei Watch Fit 4 -> Huawei Health -> Health Sync -> Health Connect -> MyDash.
- The new app scanned 21 current Health Connect sessions and enriched 21 existing records. It reported 0 sessions with laps and 2,078 cadence samples in 6 sessions.
- Firebase inspection showed the Health Sync data origin (`nl.appyhapps.healthsync`) has no laps. The six source records available through the current Health Connect read each expose exactly one DistanceRecord for the whole activity, rather than a sequence of distance intervals. This cannot yield truthful per-kilometer pace.
- Other sources in the same Health Connect account can expose multiple distance records (for example Fitbit records), but they are not evidence about Health Sync/Huawei.

## Verified Android contracts

- ExerciseSessionRecord.laps contains optional laps with startTime, endTime and optional length. A lap is not necessarily one kilometer.
- DistanceRecord describes distance traveled during startTime/endTime, not a cumulative distance reading. Multiple records can describe a workout breakdown; one total cannot establish per-kilometer pace.
- ReadRecordsRequest defaults to 1000 records. Follow pageToken until null or empty, detecting repeated tokens.
- Use existing exercise/distance read permissions and filter distance records by the session data origin. GPS/route access is not part of this proposal.

References:
- https://developer.android.com/reference/androidx/health/connect/client/records/ExerciseLap
- https://developer.android.com/reference/androidx/health/connect/client/records/DistanceRecord
- https://developer.android.com/health-and-fitness/health-connect/read-data

## Concrete proposed change

Destination: existing authenticated user's `users/{uid}/workouts/{existingWorkoutId}/healthConnectDetail` in Firebase project `dash-ca315`.

Payload:
- schemaVersion, sourceApp, lapCount, distanceRecordCount, truncated, durationBasis=elapsed.
- laps: startTimeUtc, endTimeUtc, durationSeconds, optional distanceMeters.
- distanceIntervals: startTimeUtc, endTimeUtc, durationSeconds, distanceMeters.
- At most 2000 exported intervals and 2000 laps per workout; retain original counts and mark truncation explicitly.

Behavior:
- Read the existing last-30-day window. Reuse existing workout keys by healthConnectId to avoid duplicates when fuller distance reads alter totals.
- Enrich only the new detail field for existing workouts; preserve manual fields, splits, totals and original creation timestamps. Fill missing cadence separately without replacing the entire workout.
- Display recorded laps and elapsed pace in Post-Run Review. Missing lap length means no calculated pace. Never label arbitrary laps as kilometer splits.
- If no laps exist, report the available distance interval count. Do not fabricate splits from totals or equate cadence samples with distance samples.
- No new GPS collection, external AI transmission, live database migration, GitHub push or deployment.

## Verification after approval

- Build Android APK against the installed SDK and exercise pagination, missing lengths, elapsed units and non-finite values.
- Verify enrichment preserves existing workout identity and manual fields.
- Test web display for lap distances other than 1 km, missing lengths, no laps and truncation.
- Run MyDash static verification and browser smoke test.
- Real source availability remains unverified until the updated Android app reads the phone. Firebase currently contains summaries, not the missing source laps.
