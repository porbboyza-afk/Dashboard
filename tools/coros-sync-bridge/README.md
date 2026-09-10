# COROS Sync Bridge

Status: COROS OAuth and live Huawei kilometer-split retrieval verified.
Sync implementation and local UI are ready; operational verification is recorded
in AI_HANDOFF_LOG.md. GitHub publication remains frozen.

Current source: Huawei Watch Fit 4 -> Huawei Health -> transfer helper -> COROS.
Health Connect currently supplies activity summaries but no Huawei laps.

Verified activity: September 8, 2026, 8.03 km. COROS supplies 8 kilometer splits
plus the final 30 m, per-split time, HR and cadence. The COROS response also
contains whole-activity and 5-km groups; these are not concatenated into the
kilometer splits. Raw distance 100000 = 1 km and time is seconds, checked against
pace and total distance/duration on every activity. These are COROS distance
splits, not proof of original watch lap-button events. Preserve the difference
between activity timer and split-time totals.

Operation: browser authorization, refreshable encrypted tokens, a rolling nine-day
window, and deterministic matches/new IDs. Runs must not overlap. A scheduled
bridge runs while the Windows user is signed in, the computer is awake and online.
Wake/login or missed runs use StartWhenAvailable. Reauthorization may be needed
if COROS revokes the token. A gap exceeding nine days can be recovered with
--days (maximum 30); do not imply unlimited backfill.

Commands (run in this directory):

```powershell
python connect.py login-start
python connect.py login-finish
python connect.py tools
python sync.py --uid <MyDash-uid>             # read-only dry-run
python sync.py --uid <MyDash-uid> --apply     # sync and verify
.\install-scheduler.ps1 -Uid <MyDash-uid>     # every two hours + logon
```

The installer adds desktop shortcuts: Sync COROS to MyDash and COROS Sync Status.
It refuses to overwrite an existing task. It does not change Garmin tasks.
Firebase CLI must remain logged in for the scheduled Windows user; Windows
python/pywin32 and firebase-tools are prerequisites already available here.

Existing workouts receive only corosDetail. New workouts use coros_<labelId>.
Ambiguous or close-but-uncertain matches are counted as review and not inserted.
Precise Health Connect start timestamps take precedence over rounded summaries.
The response catalog and date-list format are checked; unexpected formats fail
closed rather than fabricating missing data. This connector currently handles
running sport codes 100–103 and kilometer splits; it does not fetch wellness/GPS.

Runtime: LOCALAPPDATA/MyDash/coros-sync. OAuth state, tokens, source probes and
before-write snapshots are DPAPI encrypted. Firebase payloads use temporary local
files because its Windows CLI rejects stdin, then the files are removed. A
crashed process may leave a firebase-*.json temporary file in that runtime folder.
Status HTML contains counts/timestamps only. Each changed record is re-read before
updating and read back afterward. This is not a transactional multi-record update;
an interrupted run can partially complete and is safe to retry. External writes
in the tiny interval between final read and patch are not transactionally locked.

Local UI changes show COROS source badges and distance/time/pace/HR/cadence in
activity detail and Post-Run Review. Distinct COROS IDs are not collapsed by
same-day fuzzy dedupe. Live GitHub Pages needs a separately authorized release
before these new UI changes appear there.

Official protocol references:
- https://github.com/coroslab/COROS-MCP
- https://github.com/coroslab/COROS-MCP/blob/main/skill/coros_mcp_login_gateway/scripts/coros_mcp_login.py
- https://support.coros.com/hc/en-us/articles/53181619102996-Build-on-COROS-MCP

Relevant read tools: querySportRecords, getActivityDetail, queryActivityLapData.
The existing coros-plan-import.js imports training plans, not recorded activities.
GitHub push freeze remains in effect.
