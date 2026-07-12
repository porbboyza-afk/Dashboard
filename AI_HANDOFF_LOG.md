# AI Handoff Log

Last updated: 2026-07-11 Asia/Bangkok

## 2026-07-11 Local-Only Coach Pace Anchor + Race-Week Coverage Fix

Status:

- Implemented locally after the user found a plan that ended several days before its race date. Do not push until the user approves this additional local Coach patch.

Coach changes:

- Tempo/threshold pace now has an explicit input hierarchy:
  1. Athlete-configured `tempoFast`/`tempoSlow` range.
  2. Athlete-configured `thresholdPace`.
  3. Recent benchmark converted to Daniels-style VDOT, then solved for a 60-minute pace anchor.
  4. Conservative level fallback only when no usable athlete input or benchmark exists.
- Plan data records `benchmarkVdot` and tempo basis (`athlete_settings`, `threshold_setting`, `recent_benchmark_vdot`, or `level_fallback`) so the source is inspectable.
- I pace and R pace now derive from the same benchmark VDOT model when a benchmark exists:
  - I anchor: VDOT-equivalent 11-minute pace.
  - R anchor: VDOT-equivalent 4-minute pace.
  - Existing 5K/10K profile sequence and Daniels R/I/T volume caps remain active.
- Race Week no longer depends solely on the normal weekly weekday pattern. For every race date, the engine ensures relative pre-race coverage when those dates are inside the plan and available:
  - race date minus 3: Easy;
  - race date minus 2: Easy;
  - race date minus 1: Rest.
- These dates are calculated from the submitted race date, never hard-coded to an example date. Validation rejects a race plan that is missing the pre-race coverage.
- PWA cache advanced to `mydash-v3-training-studio-ui-20260711-10`.

Verification passed:

- `node coach_v2_test.js` including VDOT anchor checks and dynamic race-minus-3/-2/-1 coverage checks.
- `node verify_dashboard.js`
- `python comprehensive_refactor_test.py`
- `python smoke_test_dashboard.py`
- `python mobile_layout_test.py`
- `git diff --check`

## 2026-07-11 Active Local-Only Training Studio Migration

Status:

- The user asked to complete the full UI migration today. Continue locally and do not push until every page is migrated and the final local review is accepted.
- The previously pushed commit `f534f1d Redesign full MyDash workspace UI` is the baseline currently on `origin/main`.

Completed in the current local-only migration:

- Added `training-studio-ui.css` and `studio-shell.css`.
- Desktop navigation is now a top Training Studio navigation shell; mobile keeps the existing menu behavior.
- Replaced the visible Today dashboard with `#studio-home` rendered by `js/studio-home.js`.
  - Uses existing `AppState`, `getAllActivities()`, `calculateReadiness()`, `coachDailyDecision()`, and Coach V2 plan data.
  - Renders real daily session decision, wellness/readiness context, weekly volume, ACWR, sleep, a live week board, recent activities, and post-run review links.
  - The old Today DOM remains hidden but intact for renderer/global-handler compatibility during migration.
- Added `js/studio-coach.js` and a Studio plan board to the Coach Track tab.
  - Uses real plan sessions, weekly phase, completed state, target distance/HR, and existing Details/Done handlers.
  - The legacy generated session list remains in the DOM but is hidden after the Studio board renders.
- Service worker cache is now `mydash-v3-training-studio-ui-20260711-3` and includes the new CSS/JS assets.

Still required before release:

1. User local review with their signed-in Firebase data, including desktop/tablet/mobile visual inspection.
2. Commit and push only after the user approves the local build.

Completed after the initial Studio slices:

- Added `studio-surfaces.css` to migrate Activity Log, Post-Run Review, Wellness, Statistics, Sources, Settings, and AI Q&A into the shared dark Training Studio surface while retaining their existing DOM ids, forms, charts, and actions.
- Existing Coach daily decision/recovery controls remain active and continue to render above the new weekly Studio board.
- Fixed the stylesheet cascade: Studio CSS now loads after the legacy inline stylesheet; the previous local review showed a broken white sidebar because legacy CSS overrode the new shell.
- Service worker cache advanced to `mydash-v3-training-studio-ui-20260711-9`.

Verification passed for the current Studio slices:

- `node verify_dashboard.js`
- `node --check js\\studio-home.js`
- `node --check js\\studio-coach.js`
- `git diff --check`
- `node coach_v2_test.js`
- `python smoke_test_dashboard.py`
- `python comprehensive_refactor_test.py`
- `python mobile_layout_test.py` (390px: no overflow; dark menu and drawer; Studio Home visible)

## 2026-07-11 Local-Only Daniels Coach Rules Upgrade

Status:

- Implemented locally from the user-provided `dokumen.pub_daniels-running-formula-4.epub`. Do not push until the user approves the accumulated local UI and Coach work.
- The deterministic engine now records the training rule that formed each quality session, so AI text cannot override the volume safety limit.

Coach changes:

- Added shared per-session Daniels caps, scaled to planned weekly volume:
  - `R`: no more than 5% of weekly volume, capped at 8 km.
  - `I`: no more than 8% of weekly volume, capped at 10 km.
  - `T`: no more than 10% of weekly volume.
- Added these caps to Base, 5K, 10K, Half Marathon, and Marathon profiles. Each session records `danielsClass`, `danielsCapKm`, and the rule used; validation rejects a manually altered session above its cap.
- 5K/10K progression now follows the Chapter 13 order within the compact plan model:
  - Base: easy running plus strides/hills.
  - Build: R work first.
  - Specific: I-focused block first, then continuous T-focused block.
  - Race week remains light/rest only.
- 5K/10K Base phase will not increase a long run beyond the Chapter 13 25% weekly-volume guideline. Existing long-run tolerance is retained rather than abruptly cutting a runner's established long run.
- Added race recovery metadata for all race profiles using the one Easy day per 3 km rule: 5K = 2 days, 10K = 3 days, Half = 7 days, Marathon = 14 days.
- Half Marathon now records Chapter 15 emphasis and taper metadata: long endurance, threshold, R/I rotation, approximately two-thirds normal long run in pre-race week, and a short T workout three days before race. The existing generator is still conservative for athletes with only 3-4 run days per week; it does not fabricate three hard sessions where the schedule cannot recover.
- Coach session detail shows its Daniels guard. Studio Coach board shows the plan's R/I/T caps and race recovery days.

Verification passed:

- `node coach_v2_test.js` including a mutation test that verifies the validator rejects a Half T session above its cap.
- `node verify_dashboard.js`
- `python smoke_test_dashboard.py`
- `python comprehensive_refactor_test.py` including 10K `R -> I -> T`, cap, UI persistence, and compatibility assertions.
- `python mobile_layout_test.py` (390px: no overflow; dark menu/drawer intact).
- `git diff --check`

## 2026-07-11 Local-Only Full-App UI Redesign

Status:

- This was pushed as `f534f1d Redesign full MyDash workspace UI` before the Training Studio migration began.
- This replaces the short-lived `training-hub-ui.css` experiment, which caused desktop card/layout regressions. That file is removed and must not be restored.

Design system changes:

- Added `app-redesign.css` as the single layout layer for the entire app, preserving existing page markup and JavaScript behavior.
- Rebuilt the app shell around a performance-workspace pattern:
  - dark, structured desktop navigation rail;
  - persistent workspace top bar with dynamic page title and live/source state;
  - neutral performance palette with coral action and green readiness signals;
  - compact 8 px surfaces, consistent forms, tabs, tables, plan rows, recovery cards, and chart containers.
- Updated all pages through shared rules: Dashboard, Activity Log, Post-Run Review, Statistics, Coach, Wellness, Sources, AI Q&A, and Settings.
- Responsive grid rules now collapse predictably at desktop/tablet/mobile widths. The tested desktop viewport had no horizontal overflow.
- PWA cache changed to `mydash-v3-full-app-redesign-20260711-1`; manifest id is `./?v=21` and its theme is aligned to the new UI.

Behavior safety:

- No Firebase path, workout, wellness, Coach V2, review matching, or data-source behavior was changed.
- `showPage()` now updates the workspace header and returns the main scroll region to the top when switching pages.

Verification passed:

- `node verify_dashboard.js`
- `node coach_v2_test.js`
- `python smoke_test_dashboard.py`
- `python comprehensive_refactor_test.py`
- `git diff --check`

## 2026-07-10 Local-Only Coach Progression Upgrade

Status:

- Implemented and verified locally. Do not push until the user approves the Coach and UI local work.
- The immediate issue was that 10K long runs could remain near 10 km because weekly-volume ratio was the only active target, despite a higher profile cap.

Coach changes:

- Long runs now use distance-specific phase targets plus the athlete's recent longest run, an 8% weekly progression guard, step-back weeks, and a volume safety guard.
- Intermediate profile targets now peak at:
  - 5K: 11 km
  - 10K: 14 km
  - Half Marathon: 20 km
  - Marathon: 32 km
- A 10K intermediate example with 28 km/week and a recent 12 km long run now progresses:
  - 12, 12, 13, 11.4 step-back, 14, 14, 10.1 taper km.
- 10K specific intervals progress to controlled kilometer-scale work, including 5 x 1.2 km (6 km quality), subject to profile and weekly-volume budgets.
- Continuous tempo is favored over broken tempo. Validation rejects a plan when segmented threshold sessions dominate beyond the profile ratio.
- Taper sessions now reduce easy minimum distance and warm-up/cool-down padding so low taper targets are achievable rather than falsely exceeding planned weekly volume.
- Added World Athletics speed-session and long-run durability research references to generated plan metadata.

Verification passed:

- `node coach_v2_test.js`
- `node --check js\\domain\\training\\engine-v2.js`
- `node verify_dashboard.js`
- `python smoke_test_dashboard.py`
- `python comprehensive_refactor_test.py`
- `git diff --check`

## 2026-07-10 Local-Only Web Structure Refactor: State, Bootstrap, Activity Model

Status:

- Implemented and verified locally. Do not push or deploy until the user explicitly approves.
- This is the first infrastructure pass before the full-app UI redesign. It preserves the existing global handler and Firebase data contracts.

Completed boundaries:

- `js/app-state.js`: owns AppState, the default AI proxy URL, and legacy `window._*` compatibility aliases.
- `js/app-bootstrap.js`: owns startup settings hydration, Firebase realtime listeners, and AppState-to-UI subscriptions. It keeps `window._appReady` as the Firebase auth compatibility entry point.
- `js/activity-model.js`: owns source metadata/badges, activity fingerprints, source priority, duplicate-candidate rules, and `getAllActivities()`.
- `js/today-dashboard-view-model.js`: owns Today weekly volume/count/recent activities, streak, PR, and load-level calculations.

Compatibility and data safety:

- No Firebase path, workout record, plan record, review record, or legacy Strava data was migrated or deleted.
- Health Connect remains the primary exact-duplicate source; near Strava duplicates remain review-only candidates.
- `js/backup-export.js` exposes `window.DEFAULT_GAS_URL` for bootstrap settings hydration.
- `index.html` is reduced from 4,106 to 3,973 lines in this slice; UI rendering remains there for now.
- Today keeps its existing DOM renderer, but it now consumes `MyDashTodayDashboard` instead of calculating weekly activity data inline.

Verification passed after the final activity-model extraction:

- `node --check js\\app-state.js`
- `node --check js\\app-bootstrap.js`
- `node --check js\\activity-model.js`
- `node --check js\\today-dashboard-view-model.js`
- `node verify_dashboard.js`
- `python smoke_test_dashboard.py`
- `python comprehensive_refactor_test.py`
- `git diff --check`

Next structural order:

1. Extract Activity Detail, Wellness, and Statistics view models.
2. Move the remaining Today health/readiness and sync-status calculation into view models/repositories.
3. Move direct Firebase writes behind repositories while preserving the current global UI API.
4. Remove duplicate function definitions and then replace inline `onclick` handlers.
5. Start the full-app UI redesign on these stable boundaries.

## 2026-07-10 Coach Recovery Model + Training Dashboard View Model

Status:

- Implemented and under verification in the current working tree.
- Coach Engine V2 now has explicit recovery modeling instead of treating all non-training days as invisible gaps.
- Training frequency supports 3-6 days/week.
- Fixed the 5-day schedule pattern so it keeps a quality slot; the previous offset pattern could omit quality work for 5-day plans.
- Added structured `recoveryCards` and `recoverySummary` to V2 plans.
- Recovery intents now include:
  - `passive_rest`
  - `active_recovery`
  - `post_long_run`
  - `post_quality`
  - `pre_race`
  - `illness_or_pain`
- Recovery runs store `recoveryIntent` and `recoveryAdvice` on the session. Rest-day guidance is stored separately in `recoveryCards` so the plan list is not flooded with rest rows.
- Added references for recovery, active recovery, and sleep consensus papers to the plan `references` payload.
- Daily Coach now finds the recovery card for today and shows Do/Avoid guidance when there is no planned run.
- Track Plan now has a training dashboard summary:
  - completion
  - completed/planned km
  - recovery day count
  - week-by-week volume/phase strip
  - easy/quality/long/recovery intensity distribution
- Added `js/training-dashboard-view-model.js` as the first broader UI refactor slice. It summarizes plan, activity, wellness, intensity, and recovery data for UI rendering without embedding the calculation inside HTML.
- Added a `6 days` option to the Coach form.
- PWA cache was bumped to `mydash-v3-coach-v2-20260710-3`; manifest id is `./?v=19`.

Verification passed so far:

- `node coach_v2_test.js`
- `node verify_dashboard.js`
- `python smoke_test_dashboard.py`
- `python comprehensive_refactor_test.py`

Important design decision:

- This is not a full big-bang UI rewrite. It starts the broader refactor with a safe Coach/Training surface, because this is where the plan/recovery logic is most consequential. Continue migrating other dashboard pages through view models instead of adding more calculations directly inside `index.html`.

## 2026-07-10 Coach V2 Effort Anchors Follow-up

Status:

- Athlete Settings are now explicit Engine V2 inputs rather than unused form data.
- Easy effort uses configured HR bounds plus recent easy-run pace/HR evidence; high-HR gray-zone runs are excluded from the easy-pace evidence set.
- Easy and long sessions expose a pace range, HR cap, talk test, and stored intensity basis instead of one falsely precise pace.
- Configured tempo pace/HR is used, with continuous threshold work introduced before limited segmented work; segmented tempo does not dominate the block.
- Thai and English unavailable weekdays plus exact dates are normalized, enforced during scheduling, and checked again by plan validation.
- Every generated plan stores `inputAudit` so target time, benchmark, availability, athlete settings, and evidence usage can be inspected later.
- Regression coverage includes Base, 5K, 10K, Half, Marathon, HR-grounded easy pace, tempo structure, unavailable dates, UI persistence, and Firebase compatibility writes.

## 2026-07-10 Active Decision - Coach/Review V2 Before Web Refactor

Status:

- Implemented, verified, and pushed to `origin/main`.
- Feature commit: `f26a39c Add multi-distance Coach V2 engine`.
- The user explicitly wants the Coach/Review improvements delivered and verified before the broader web refactor.

Implementation order:

1. Build deterministic multi-distance Training Engine V2.
2. Add versioned plan/session lifecycle and Post-Run Review matching.
3. Integrate through compatibility adapters while preserving the current UI and legacy Firebase path.
4. Keep Coach V1 as a temporary fallback.
5. Refactor the remaining web structure after V2 is stable.

Hard constraints:

- Do not add new Coach domain logic to `index.html`.
- AI explains plans and reviews; deterministic code creates and validates the training structure.
- Do not design only for 10K. Initial profiles must cover base building, 5K, 10K, half marathon, and marathon.
- Do not destructively migrate or delete legacy Firebase data.
- Archive versioned plans instead of erasing plan history.
- Post-Run Review must distinguish exact, mismatched, unplanned, historical-plan, and no-plan workouts.
- Preserve current UI behavior through compatibility bridges during migration.
- Run static, browser, and relevant build verification before push.

Full architecture plan:

- `docs/ARCHITECTURE_REFACTOR_PLAN.md`

Implementation result:

- Added deterministic Training Engine V2 modules:
  - `js/domain/training/profiles.js`
  - `js/domain/training/engine-v2.js`
- Initial goal profiles:
  - Base Building
  - 5K
  - 10K
  - Half Marathon
  - Marathon
- Pace anchors use a recent benchmark when available. Target time is used for feasibility/risk, not blindly treated as current fitness.
- Sessions now contain stable `sessionId`, `intent`, `workoutSpec`, quality distance, intensity basis, and methodology version.
- An 8-week 10K example now allocates:
  - Base: 2 weeks
  - Build: 2 weeks
  - Peak / Specific: 2 weeks
  - Taper: 1 week
  - Race Week: 1 week
- Added conservative handling when activity history is too sparse to establish a reliable weekly-volume baseline.
- Added `js/services/coach-repository.js` with:
  - `coach_plans/{planId}` writes,
  - `active_coach_plan_id`,
  - `coach_plan` compatibility mirror,
  - archive rather than destructive V2 plan deletion.
- Added `js/domain/review/matcher-v2.js` with match types:
  - `exact`
  - `date_mismatch`
  - `probable`
  - `unplanned`
  - `historical_plan`
  - `no_plan`
- Post-Run Review now uses workout-date load context, invalidates stale summaries with facts/revision hashes, and does not present an archived-plan summary as the current answer.
- AI remains available for plan/review explanation; it no longer creates the primary session structure.

Verification passed:

- `node verify_dashboard.js`
- `node coach_v2_test.js`
- JavaScript syntax checks for all new/changed modules
- Python AST syntax checks
- `python smoke_test_dashboard.py`
- `python comprehensive_refactor_test.py`
- Android `gradlew.bat assembleDebug`
- `git diff --check`

Next action after delivery:

- Validate generated plans with the user's real goals and training history, then begin the broader web refactor from `docs/ARCHITECTURE_REFACTOR_PLAN.md` without removing the V1 fallback in the same release.

## 2026-07-08 Coach Phase-Based Planner And Race-Week Guards

Context:

- User reported a realistic coaching bug: the planner could still place a `Tempo` session on the day before race.
- User also correctly pointed out that the deeper problem was not only race eve, but the lack of explicit training phases. The previous planner was mostly a repeating weekly pattern plus a light taper heuristic.

Code changes:

- `js/coach.js`
  - Added deterministic training phases:
    - `Base`
    - `Build`
    - `Peak`
    - `Taper`
    - `RaceWeek`
  - Added:
    - `coachPhaseForWeek()`
    - `coachPhaseForDate()`
    - `coachPhaseSchedule()`
    - `coachApplyPhaseRule()`
    - `coachIsRaceEve()`
  - `buildCoachContext()` now includes phase schedule context for the AI.
  - `validateCoachPlan()` now:
    - assigns a phase to each session,
    - keeps one session per date,
    - blocks back-to-back hard sessions,
    - applies phase rules after normalization.
  - New deterministic phase behavior:
    - `Base`: interval is downgraded to controlled tempo.
    - `Taper`: long runs are removed, interval is shortened into tempo.
    - `RaceWeek`: no `Tempo`, `Interval`, or `Long`; day before race is forced to `Rest`; two days before race cannot be hard.
  - `buildFallbackTrainingPlan()` now builds from phase-aware templates instead of a single repeating weekly pattern.
  - Coach UI now shows the current phase in plan meta and each session row date line.
  - `safetyPolicyVersion` bumped to `2`.
  - Prompt guard now explicitly tells the AI:
    - one session max per date,
    - training days/week cap,
    - no hard session on the day before race.
- `comprehensive_refactor_test.py`
  - Added assertions for:
    - race eve forced to `Rest`,
    - race week contains only light/rest sessions,
    - full phase schedule includes `Base`, `Build`, `Peak`, `Taper`, `RaceWeek`.
- `verify_dashboard.js`
  - Added required coach phase helper snippets.

Verification passed:

- `node verify_dashboard.js`
- `node --check js\coach.js`
- `python comprehensive_refactor_test.py`
- `python smoke_test_dashboard.py`
- `git diff --check`

Current planning model:

- The planner is no longer just "peak or taper".
- It now uses explicit phases and deterministic race-week controls before AI wording/fine detail is applied.

## 2026-07-08 Post-Run Review Implementation

Context:

- User asked whether the handoff recommendation referred to:
  - duplicate review/resolve UI, or
  - Post-Run Review with interval schema.
- Confirmed both were in the handoff.
- This session implemented the Post-Run Review path. Duplicate review/resolve UI remains separate future work.

Code changes:

- Added `js/post-run-review.js`.
  - `openPostRunReview(key)` opens the review page for a selected workout.
  - `renderPostRunReview()` renders recent activities, plan match, plan-vs-actual facts, recovery context, risk flags, interval detail, and AI output.
  - `buildPostRunFacts(workout)` calculates structured facts before AI runs:
    - matched coach plan session,
    - distance delta,
    - pace delta,
    - HR delta,
    - session load,
    - wellness/readiness context,
    - subjective RPE/pain/feeling/note,
    - `intervalAnalysis: null | {...}`.
  - Interval workouts use `interval.repPace` for pace comparison when aggregate `avgPace` is missing.
  - `generatePostRunAIReview(key)` sends only structured facts to the AI and saves the result under:
    - `users/{uid}/post_run_reviews/{workoutKey}`
  - AI is explicitly review-only. It does not change `coach_plan` automatically.
- `index.html`
  - Added desktop navigation item: `Post-Run Review`.
  - Added page `page-post-run-review`.
  - Added responsive CSS for the review layout.
  - Added review buttons in Recent Activities and Activity Detail.
  - Added AppState/Firebase support for `postRunReviews`.
- `js/ui-core.js`
  - `showPage('post-run-review')` now renders the review page.
- `manifest.json` and `sw.js`
  - PWA cache bumped to `mydash-v3-health-20260708-6`.
  - Manifest id bumped to `./?v=16`.
- Tests updated:
  - `verify_dashboard.js` checks the new script/page/helpers.
  - `smoke_test_dashboard.py` opens the Post-Run Review page.
  - `comprehensive_refactor_test.py` verifies:
    - page activation,
    - review list/body render,
    - coach plan match,
    - plan-vs-actual comparison,
    - interval schema and planned/actual interval data.

Verification passed:

- `node verify_dashboard.js`
- `node --check js\post-run-review.js`
- `node --check js\ui-core.js`
- `python smoke_test_dashboard.py`
- `python comprehensive_refactor_test.py`
- `git diff --check`

Remaining related work:

- Build UI review/resolve duplicate candidates for Health Connect/Garmin vs Strava imports.
- Add an explicit "Apply suggestion" flow later if Post-Run Review should propose coach plan adjustments. Do not let AI mutate the plan automatically.

## 2026-07-08 Coach Same-Date Session Guard

Context:

- User showed the AI Coach plan rendering two workouts on the same date (`Tuesday 21 July`): one easy run and one tempo run.
- The correct behavior is one planned training session per calendar date. MyDash should not stack an easy run and a quality session on the same day unless a future feature explicitly models two-a-day training.

Code changes:

- `js/coach.js`
  - Added `dedupeCoachSessionsByDate()` and `coachSessionDateScore()`.
  - `validateCoachPlan()` now collapses same-date sessions after race-day filtering.
  - If duplicates occur, MyDash keeps the higher-value session by priority/type/distance, e.g. `Tempo` over `Easy` for the user's screenshot case.
  - Added `coachApplyPromptDateGuard()` so the AI prompt explicitly says:
    - each `YYYY-MM-DD` can appear at most once,
    - weekly non-rest session count must stay at or below the selected training days/week,
    - do not stack an easy run and quality workout on the same day.
- `comprehensive_refactor_test.py`
  - Added a browser test matching the screenshot scenario:
    - `2026-07-21 Easy 4.4 km`
    - `2026-07-21 Tempo 5.5 km`
    - expected result: one row remains for `2026-07-21`, keeping `Tempo`.
  - Added a prompt guard assertion.
- `verify_dashboard.js`
  - Added static guards for the new coach helper functions.
- PWA cache bumped to:
  - `mydash-v3-health-20260708-5`
  - manifest id `./?v=15`

Verification passed:

- `node verify_dashboard.js`
- `node --check js\coach.js`
- `python smoke_test_dashboard.py`
- `python comprehensive_refactor_test.py`

Post-run review status check:

- No full Post-Run Review page exists yet.
- Existing related features are only:
  - Activity Log create/edit,
  - AI Coach progress review via `reviewPlanAI()`,
  - Strava detail/session analysis,
  - Statistics weekly/monthly AI analysis.
- The earlier planned product feature remains: build a dedicated Post-Run Review flow with interval-aware schema, including `intervalAnalysis: null | {...}`.

## 2026-07-08 Session Work Log - Strava Duplicate Guard Closeout

Purpose:

- Prepare MyDash for a possible one-month Strava paid recovery/import later.
- Main risk discussed with the user: the same run can exist twice after import, one from Garmin/Health Connect and one from Strava, with slightly different distance/time values.
- Requirement: detect and surface possible duplicates before any large Strava import, without deleting raw data.

What happened:

- Started from commit `0088608 Clean coach adaptive duplicate`.
- Confirmed repo work happened in `C:\Users\pucca\Dashboard-GitHub`.
- Read `AI_HANDOFF_LOG.md` before changing behavior.
- Existing strategic direction remains:
  - Strava is legacy/inactive for normal sync.
  - Garmin Connect -> Health Connect -> MyDash companion -> Firebase -> Web dashboard is the preferred path.
  - Strava may still be used later as a short-term paid historical archive recovery source.

Implementation details:

- `index.html`
  - Added `activitySourceKey(w)` to create a stable source/key identity for duplicate review.
  - Added `isStravaLike(w)` for `strava`, `strava_recovered`, and `strava_archive`.
  - Added `isDuplicateCandidate(a,b)` with fuzzy rules:
    - same date,
    - different source,
    - at least one side is Strava-like,
    - distance difference <= `0.25 km` and <= `4%`,
    - time difference <= `180 seconds` and <= `6%`.
  - Added `duplicateCandidatePairs(activities)` to find same-day near matches.
  - Updated `getAllActivities()` to attach `_possibleDuplicates` to the primary row.
  - Kept Garmin/Health Connect primary by reusing existing `activitySourcePriority()`.
  - Added `Possible duplicate` row in the activity detail view.
- `js/sources-strava.js`
  - Added `liveDuplicatePairs`.
  - Displayed `Live possible duplicates: N` under the Recovered Strava card.
  - Important encoding note: this file contains Thai/non-ASCII text. Avoid PowerShell `Set-Content` or broad string rewrites. Use `apply_patch` with narrow ASCII context, or restore from Git before retrying if encoding looks wrong.
- `comprehensive_refactor_test.py`
  - Added browser test data with one Health Connect/Garmin run and one Strava run on the same date.
  - Verified exactly one duplicate candidate is detected.
  - Verified Health Connect remains primary.
  - Verified Strava is attached under `_possibleDuplicates`.
  - Restored `window._workouts` and `window._stravaWorkouts` after the duplicate test so later race/coach tests are not polluted.
- `verify_dashboard.js`
  - Added required snippets for `duplicateCandidatePairs` and `isDuplicateCandidate`.
  - Updated expected cache version.
- `manifest.json` and `sw.js`
  - Bumped PWA cache/version markers to `mydash-v3-health-20260708-4` and manifest id `./?v=14`.

Verification run and results:

- `node verify_dashboard.js` passed.
- `node --check js\sources-strava.js` passed.
- `git diff --check` passed.
- `python smoke_test_dashboard.py` passed with no page errors, console errors, or request failures.
- `python comprehensive_refactor_test.py` passed, including:
  - duplicate candidate detection,
  - interval edit preservation,
  - wellness manual edit preservation,
  - coach/race readiness checks.

Commits pushed:

- `d12d869 Prepare Strava duplicate guard`
  - Main code/test/cache/log implementation.
- `3347d70 Log Strava duplicate guard outcome`
  - Added final outcome summary to this handoff log.

Current state after closeout:

- Repo was clean after `3347d70` was pushed.
- No Firebase data migration was made.
- No raw Strava, Health Connect, workout, or cache data was deleted.
- Duplicate guard is review-only. It surfaces candidate rows for human review.
- If Strava is paid for one month later, import/recovery should run first, then review `Possible duplicate` candidates before marking anything ignored/archive-only.

Recommended next AI action:

- Before adding more features, read this log and check `git status --short`.
- If continuing Strava recovery, build a review/resolve UI for `_possibleDuplicates` instead of auto-deleting.
- If continuing the training feature work, next planned product feature is still Post-Run Review with interval-aware schema from the first commit.

## 2026-07-08 Strava Duplicate Guard Preparation

Context:

- User may pay for Strava for one month later to recover/sync old activity data.
- User correctly anticipated that Strava and Garmin/Health Connect data can duplicate with small distance/time differences.
- Goal is to prepare detection before a large Strava sync, without deleting raw records.

Code changes:

- Added fuzzy duplicate detection near the central activity merge helpers in `index.html`:
  - `isDuplicateCandidate(a,b)`
  - `duplicateCandidatePairs(activities)`
  - `activitySourceKey(w)`
- Detection rules:
  - same date,
  - different sources,
  - one side is Strava-like (`strava`, `strava_recovered`, `strava_archive`),
  - distance difference <= 0.25 km and <= 4%,
  - time difference <= 180 seconds and <= 6%.
- Garmin/Health Connect remains primary through existing source priority.
- `getAllActivities()` now attaches `_possibleDuplicates` to the primary row for display/review.
- Activity detail now displays `Possible duplicate` when a primary row has candidate duplicates.
- Sources overview now includes live possible duplicate count in addition to staged recovery duplicate count.
- No raw workout, Strava cache, or Firebase record is deleted by this guard.
- PWA cache bumped to:
  - `mydash-v3-health-20260708-4`
  - manifest id `./?v=14`

Test coverage added:

- `comprehensive_refactor_test.py` verifies:
  - Garmin/Health Connect and Strava runs on the same day with near distance/time are detected as one duplicate candidate,
  - Garmin/Health Connect is selected as primary,
  - Strava is attached under `_possibleDuplicates`.

Final outcome:

- Commit pushed to GitHub:
  - `d12d869 Prepare Strava duplicate guard`
- Verification passed:
  - `node verify_dashboard.js`
  - `node --check js\sources-strava.js`
  - `git diff --check`
  - `python smoke_test_dashboard.py`
  - `python comprehensive_refactor_test.py`
- Repo was clean immediately after push.
- If the user pays Strava for one month and imports old data later, do not bulk-delete duplicates automatically. First review `Possible duplicate` candidates, then decide whether to keep Strava as archive-only or mark duplicate rows as ignored.

## 2026-07-08 Coach Cleanup Before Post-Run Review

Context:

- User approved cleanup before building the new Post-Run Review feature.
- User explicitly reminded that interval workouts must not be forgotten because manual interval editing already exists.

Cleanup changes:

- Removed the duplicate old `renderCoachDailyDecision()` definition from `js/coach.js`.
- Kept the newer daily adaptive decision UI as the single active definition.
- Added verifier guards in `verify_dashboard.js`:
  - `renderCoachDailyDecision` must have exactly one definition,
  - `reviewPlanAI` must have exactly one definition.
- PWA cache bumped to:
  - `mydash-v3-health-20260708-3`
  - manifest id `./?v=13`

Interval protection:

- Existing interval edit support remains in `index.html`:
  - `editWorkout(key)` loads `w.interval` back into the interval form fields,
  - `saveWorkout()` preserves interval payload under `workout.interval`.
- Added comprehensive browser test coverage:
  - interval activity edit preloads reps, rep distance, rep pace,
  - rest time, warmup, and cooldown values are preserved,
  - interval panel is visible after editing an interval activity.

Next planned feature:

- Build Post-Run Review as a separate feature after this cleanup.
- Review schema must include `intervalAnalysis: null | {...}` from the first commit so interval workouts do not require a later schema rewrite.

## 2026-07-08 Wellness Manual Edit For Partial Garmin Health Connect Data

Context:

- User showed Android Health Connect permissions for Garmin Connect.
- Visible Garmin/Health Connect permissions included:
  - body fat,
  - weight,
  - sleep,
  - exercise/activity metrics,
  - active heart rate,
  - resting heart rate.
- HRV was not visible in the provided screenshot, so MyDash must treat HRV as optional/manual for this device state.
- User wants to manually fill missing wellness fields because Garmin does not provide everything MyDash needs for training decisions.

Code changes:

- Wellness form now includes:
  - Body Fat `%`,
  - HRV labelled as `manual optional`.
- Recent Wellness rows now have an `Edit` button.
- `loadWellnessToForm(date)` loads an existing wellness record into the form.
- `saveWellness()` now merges manual form values with the existing `wellness/{date}` record:
  - blank fields do not wipe synced Garmin/Health Connect values,
  - manual fields such as fatigue, pain, stress, mood, note, pain location, body fat can be added later,
  - saved rows get `manualOverride: true`, `manualUpdatedAt`, and `updatedAt`.
- Recent Wellness list now shows SpO2 in the summary.
- PWA cache bumped to:
  - `mydash-v3-health-20260708-2`
  - manifest id `./?v=12`

Test coverage added:

- `comprehensive_refactor_test.py` verifies:
  - manual Wellness merge preserves synced sleep/HRV/source values,
  - manual fatigue/bodyFat fields are saved,
  - edit form preloads the existing record.

## 2026-07-08 Daily Adaptive Coach Engine

Context:

- User clarified that the plan must actually support the target outcome, not only display a static schedule.
- User also clarified that MyDash must not hard-code 10K/sub-48 forever because future plans may be 5K, half marathon, or another goal.

Code changes:

- Added deterministic daily adaptation logic in `js/coach.js`:
  - `coachDailyDecision(plan, date)` returns `keep`, `move`, `rest`, `downgrade`, `reduce`, `done`, or `no_session`.
  - It reads the current plan goal, today's session, completed workouts, unavailable days, readiness, sleep/HRV/RHR/SpO2/pain data via existing readiness logic, and training-load safety rules.
  - It does not rely on AI text alone for safety decisions.
- Added `coachApplyDailyDecisionToPlan(plan, decision)`:
  - moves a session when today is unavailable,
  - converts risky red days to Rest,
  - downgrades hard yellow days to Easy,
  - reduces easier yellow days without doubling later load,
  - writes a `dailyDecisions/{date}` record into the saved `coach_plan`,
  - appends an adjustment record under `coach_plan.adjustments`.
- Added `coachGoalImpact()`:
  - every daily adjustment records the active goal and race date,
  - flags whether the workout stimulus was preserved,
  - marks goal risk as low/medium,
  - prevents silent drift away from the target.
- `coachFindMoveDate()` now refuses to move a workout onto or after `plan.endDate`, because `endDate` is race day.
- AI Coach Track tab now has a primary action:
  - `ปรับแผนวันนี้ + บันทึก Cloud`
  - this applies the deterministic decision and verifies the Firebase save.
- Removed production prompt hard-coding for `10K sub 48`:
  - generation prompt now uses the selected/current goal,
  - review prompt now uses the current plan goal.
- PWA cache bumped to:
  - `mydash-v3-health-20260708-1`
  - manifest id `./?v=11`

Test coverage added:

- `comprehensive_refactor_test.py` now verifies:
  - unavailable day triggers a `move`,
  - moved session leaves the unavailable day and stays before race day,
  - daily decision is saved under `dailyDecisions`,
  - yellow hard-day downgrade becomes Easy and reduces distance,
  - goal impact is saved with the adjustment.

Important behavior:

- The engine preserves the current selected goal, not a fixed 10K target.
- A daily reduction is allowed only as a safety adaptation; repeated medium-risk changes should trigger AI review/replan rather than silently weakening the whole plan.

## 2026-07-07 Local Backup And Coach/Race Refactor

Context:

- User asked to organize the growing codebase and clarified that backup should be a copied folder, not a zip archive.
- Work was intentionally kept local. No commit or push was performed in this pass.

Backup:

- Valid full-folder backup created at:
  - `C:\Users\pucca\Dashboard-GitHub-backup-before-refactor-20260707-142194f`
- Backup source HEAD before this refactor:
  - `142194f`

Code changes:

- Extracted AI Coach logic from `index.html` into:
  - `js/coach.js`
- Extracted Race tab and dashboard race banner logic from `index.html` into:
  - `js/races.js`
- `index.html` now loads:
  - `js/coach.js`
  - `js/races.js`
- Script load order is intentional:
  - existing inline script defines shared helpers first,
  - extracted coach/race scripts load after it,
  - this keeps existing global onclick handlers and helper references working.
- Updated `verify_dashboard.js` so dashboard guards now check:
  - shared HTML/CSS snippets in `index.html`,
  - AI Coach helpers in `js/coach.js`,
  - Race helpers in `js/races.js`.

Verification completed:

- `node verify_dashboard.js`
  - Passed.
- `python smoke_test_dashboard.py`
  - Passed with no page errors, console errors, or request failures.
- Targeted Playwright AI Coach mobile smoke:
  - Passed.
  - Confirmed no mobile overflow, Track Plan cards render, adaptive card renders, and detail buttons exist.
- Targeted Playwright Race tab smoke:
  - Passed.
  - Confirmed current plan end date creates a plan-derived race card and no delete button is shown for the virtual race.

Notes:

- This is a structure-only refactor; no Firebase schema, sync logic, AI prompt behavior, or Android companion code was intentionally changed.
- The earlier desktop zip attempt should not be treated as the valid backup. The copied folder above is the valid backup.

## 2026-07-07 Feature Module Refactor Continuation

Context:

- User challenged whether the code was actually organized yet.
- Continued the local-only refactor using the existing copied-folder backup.
- Goal was to reduce `index.html` without changing runtime behavior.

Additional code extraction:

- Extracted AI Q&A / current-news chat into:
  - `js/news-ai.js`
- Extracted Sources and legacy Strava API/recovery UI into:
  - `js/sources-strava.js`
- Extracted Statistics / Insights into:
  - `js/stats.js`
- Extracted Wellness, readiness, load, recovery, and wellness analytics into:
  - `js/wellness.js`
- Extracted Google Apps Script backup and import/export utilities into:
  - `js/backup-export.js`
- Extracted Settings and athlete profile logic into:
  - `js/settings.js`
- Extracted share-card rendering into:
  - `js/share-card.js`

Current script load order:

- `js/date-utils.js`
- `js/ui-core.js`
- `js/share-card.js`
- `js/wellness.js`
- `js/stats.js`
- `js/news-ai.js`
- `js/sources-strava.js`
- `js/settings.js`
- `js/backup-export.js`
- `js/coach.js`
- `js/races.js`

Load-order reasoning:

- `wellness.js` must load before `stats.js` and `coach.js` because both use readiness/load helpers.
- `stats.js` must load before `races.js` because `races.js` patches `renderWeekStats`.
- `sources-strava.js` must load before `settings.js` because athlete profile saving can re-run Strava interval analysis.
- `backup-export.js` can load after settings because backup/export handlers are user-driven, but its own initial `renderSyncStatus()` and `flushSheetsQueue()` calls must live inside `backup-export.js`.

Regression caught and fixed:

- After moving backup/export code, `python smoke_test_dashboard.py` caught:
  - `renderSyncStatus is not defined`
- Root cause:
  - `index.html` still called `renderSyncStatus()` and `setTimeout(flushSheetsQueue,1500)` before `js/backup-export.js` loaded.
- Fix:
  - moved those init calls into `js/backup-export.js` after the functions are defined.

Share-card extraction note:

- First extraction accidentally moved `</script>` into `js/share-card.js` and left external script tags inside the inline script.
- `node verify_dashboard.js` caught this as:
  - `SyntaxError: Unexpected token '<'`
- Fix:
  - restored `</script>` before external script tags in `index.html`,
  - removed the stray `</script>` from `js/share-card.js`.

Verification completed after all extractions:

- `node verify_dashboard.js`
  - Passed.
- `python smoke_test_dashboard.py`
  - Passed with no page errors, console errors, or request failures.
- Targeted Playwright AI Coach mobile smoke:
  - Passed.
- Targeted Playwright Race tab smoke:
  - Passed.

Current result:

- `index.html` is reduced to about 4,112 lines.
- Feature code now lives in focused files under `js/`.
- Remaining `index.html` still contains core shell, Firebase/AppState bootstrapping, activity form/log helpers, dashboard home widgets, calendar/detail overlays, PWA shell, and HTML markup.
- No commit or push was performed.

## 2026-07-07 Local Verification Hardening Before Push

Context:

- User correctly noted that pushing directly after a broad refactor could break the main site.
- Goal was to strengthen local verification before any commit/push.
- Literal 100% runtime certainty is not possible without exhaustive user-device/browser coverage, but the local automated checks now cover the major refactor risk points.

Test additions:

- Added `comprehensive_refactor_test.py`.
- The test runs the dashboard through local HTTP + Playwright and verifies:
  - exact external script load order,
  - all refactored global functions exist,
  - all inline `onclick="functionName(...)"` handlers point to existing functions,
  - every primary page can activate:
    - Dashboard,
    - Activity Log,
    - Statistics,
    - AI Coach,
    - Sources,
    - AI Q&A,
    - Wellness,
    - Settings,
  - representative render calls for:
    - Dashboard widgets,
    - Activity list,
    - Stats week/month/insights,
    - Wellness check-in/analytics,
    - AI Q&A side panel,
    - Sources/Strava page,
    - Settings athlete profile,
    - Backup sync status,
    - Coach track/race tabs,
    - Share card modal/canvas,
  - no mobile horizontal overflow in the tested viewport,
  - no page errors, console errors, or request failures.

Test fixes while building the guard:

- Initial comprehensive test forgot that Chart.js CDN is the first script. Fixed expected script order.
- Activity and Wellness list assertions initially expected `.card`, but the real UI renders `.workout-row`. Fixed selectors.
- News panel assertion initially expected a non-existent `#news-side-panel`; changed to `.news-side` + `#news-sources`.

PWA/deploy-readiness fix:

- Bumped service worker cache from:
  - `mydash-v3-health-20260707-2`
  - to `mydash-v3-health-20260707-3`
- Bumped manifest/icon query strings to `20260707-3`.
- Bumped manifest id from `./?v=7` to `./?v=8`.
- Added all local JS modules to the service worker app shell:
  - `js/date-utils.js`
  - `js/ui-core.js`
  - `js/share-card.js`
  - `js/wellness.js`
  - `js/stats.js`
  - `js/news-ai.js`
  - `js/sources-strava.js`
  - `js/settings.js`
  - `js/backup-export.js`
  - `js/coach.js`
  - `js/races.js`
- Updated `verify_dashboard.js` to guard the service worker cache version and new JS app-shell entries.

Verification completed after hardening:

- `node verify_dashboard.js`
  - Passed.
- Python syntax check via `ast.parse` for:
  - `comprehensive_refactor_test.py`
  - `smoke_test_dashboard.py`
  - Passed.
- `python smoke_test_dashboard.py`
  - Passed with no page errors, console errors, or request failures.
- `node --check workers\ai-proxy\src\index.js`
  - Passed.
- `python comprehensive_refactor_test.py`
  - Passed with:
    - exact script order OK,
    - missing globals: none,
    - missing onclick handlers: none,
    - all primary pages active,
    - key DOM/render checks OK.

Remaining risk before push:

- Local automated checks are strong enough for the refactor, but not a mathematical 100% guarantee.
- Still worth doing one manual phone hard-refresh check after GitHub Pages updates because PWA/service-worker/browser cache behavior can differ from local headless Chrome.

## 2026-07-07 Race Readiness Wording And Mobile Card Fix

Context:

- User sent mobile screenshots after the refactor push.
- Screenshot 1 showed dashboard race countdown content visually overlapping in the small right-column mobile grid.
- Screenshot 2 showed AI Coach -> Race tab saying the user was `พร้อมมาก` even though the user had not started training under the new plan yet.

Root causes:

- Dashboard:
  - On mobile, `.stats-col` becomes a 3-column grid.
  - `#dash-race-banner` was being placed into one narrow column even though its content is a horizontal race banner.
- Race tab:
  - `renderRaceList()` computed readiness only from recent 4-week average distance vs race distance.
  - It did not distinguish:
    - pre-plan historical running base,
    - actual workouts completed after `coach_plan.startDate`.
  - Therefore existing historical runs could produce `พร้อมมาก` before the current plan had really started.

Code changes:

- Mobile layout:
  - `#dash-race-banner` now spans all columns in the mobile `.stats-col` grid.
  - Added small mobile spacing/padding safeguards for the race banner.
- Race tab logic:
  - Added `raceTrainingReadiness(r, all, today)`.
  - For plan-derived races, it checks `window._coachPlan.startDate`.
  - If no workout exists after the plan start date, the card now says:
    - `ยังไม่เริ่มซ้อมตามแผน`
  - Historical 4-week mileage is now described as baseline/base data, not as race readiness.
  - The section heading changed from `ความพร้อม` to:
    - `สถานะแผน / ฐานซ้อม`
- PWA cache:
  - bumped cache from `mydash-v3-health-20260707-3` to `mydash-v3-health-20260707-4`.
  - bumped manifest/icon query strings to `20260707-4`.
  - bumped manifest id to `./?v=9`.
- Test:
  - `comprehensive_refactor_test.py` now verifies:
    - the dashboard race banner spans full mobile row,
    - a plan race with no post-plan workouts does not show `พร้อมมาก`,
    - the Race tab shows `ยังไม่เริ่มซ้อมตามแผน`.

Verification:

- `node verify_dashboard.js`
  - Passed.
- `python smoke_test_dashboard.py`
  - Passed.
- `python comprehensive_refactor_test.py`
  - Passed.

## 2026-07-08 Coach Plan Race Day, Long Run Day, And Sleep Formatting

Context:

- User reported three plan-quality issues:
  - Sleep display such as `4.9h` is hard to read.
  - The last day of a training plan is normally race day, but the generated plan could still contain a workout on that date.
  - User should be able to choose the weekly long run day.
- User asked to use Garmin Coach / Garmin race-planning behavior as a reference.

Reference interpretation:

- Garmin-style race planning separates the race/event from training workouts.
- Garmin-style planning uses recent training load / predicted time as context, but it should not label that as proof the current plan has been started.
- Garmin-style setup lets the user choose preferred training days; MyDash now adds a first explicit control for the long run day.

Code changes:

- Sleep formatting:
  - Added `formatSleepHours(value, {compact})` in `js/wellness.js`.
  - `4.9` now displays as:
    - `4 ชม. 54 นาที` in full contexts,
    - `4ชม 54น` in compact dashboard KPI contexts.
  - Updated dashboard sleep widgets, Wellness list, and Wellness average sleep display.
- AI Coach form:
  - Added `Long Run Day` selector:
    - Sunday default,
    - Saturday,
    - Friday,
    - Monday.
- Coach goal profile:
  - `getCoachGoalProfile()` now stores:
    - `longRunDay`,
    - `longRunDayName`.
  - Coach context and AI prompt include the preferred long run day.
- Fallback plan generation:
  - Added `coachTrainingWeekdays()` and `coachDateForWeekday()`.
  - Fallback sessions now use real weekdays rather than offsets from the start date.
  - Long runs are placed on the selected long run day when possible.
  - No fallback workout is created on or after `endDate`.
- AI/validation safety:
  - Prompt now says Race/GoalDate is the race event, not a training workout.
  - `validateCoachPlan()` filters out any session that lands exactly on `endDate`, even if the AI returns one.
  - This means the Race tab can still show the virtual race from `coach_plan.endDate`, but Track Plan will not show a workout on race day.
- PWA cache:
  - bumped cache from `mydash-v3-health-20260707-4` to `mydash-v3-health-20260707-5`.
  - bumped manifest/icon query strings to `20260707-5`.
  - bumped manifest id to `./?v=10`.

Test coverage added:

- `comprehensive_refactor_test.py` now verifies:
  - `formatSleepHours(4.9)` -> `4 ชม. 54 นาที`,
  - compact sleep format -> `4ชม 54น`,
  - fallback plan has no workout on race day,
  - fallback long runs respect selected Sunday long-run preference.

Verification:

- `node verify_dashboard.js`
  - Passed.
- `python smoke_test_dashboard.py`
  - Passed.
- `python comprehensive_refactor_test.py`
  - Passed.

## 2026-07-07 Coach End Date Race Integration

Context:

- User clarified that the training plan end date usually means race day.
- User reported that after setting a plan and end date, the Race tab did not show the race.

Root cause:

- `generateTrainingPlan()` saves the plan end date under:
  - `users/{uid}/coach_plan/endDate`
- The Race tab and dashboard race banner only read:
  - `users/{uid}/races`
- Therefore a plan could have a race/end date but the Race tab remained empty unless the user manually added a race record.

Code changes:

- Added `coachPlanRaceEntry(plan)`:
  - derives a virtual race from `coach_plan.endDate`,
  - uses `coach_plan.goal`,
  - uses `coach_plan.goalProfile.distance`,
  - uses `coach_plan.goalProfile.targetTime`.
- Added `mergeRaceEntries(savedRaces, plan)`:
  - combines manually saved races with the current plan-derived race,
  - avoids adding a duplicate when a saved race already has the same date and close distance.
- Added `getAllRaceEntries()`:
  - used by the dashboard race banner.
- Updated `loadRaces()`:
  - Race tab now shows saved races plus the current plan-derived race.
- Updated Race tab rendering:
  - plan-derived race shows a `จากแผนซ้อมปัจจุบัน` tag,
  - plan-derived race does not show a delete button.
- Updated `addRace()` and `deleteRace()`:
  - writes only manually saved races back to `users/{uid}/races`,
  - does not persist the virtual plan-derived race into the races path.
- Updated `verify_dashboard.js` to guard the new race integration helpers.

Verification to run:

- `node verify_dashboard.js`
- `python smoke_test_dashboard.py`

## 2026-07-07 Coach Mobile UX Thai Detail And Adaptive Explanation

Context:

- User reviewed the generated exercise plan on a phone in portrait orientation and reported:
  - text was not arranged/readable,
  - plan cards/table looked messy,
  - workout explanations should be Thai,
  - it was unclear how the training changes with daily body condition if the plan looks fixed.

Interpretation:

- The coach plan should be treated as a baseline plan, not as an immutable schedule.
- Daily adaptation is handled by:
  - readiness/load/wellness decision card,
  - user-confirmed actions: move, downgrade, skip,
  - Firebase writes to `users/{uid}/coach_plan` after each confirmed change.
- Do not silently mutate the whole plan every day because that can create confusing or unsafe schedule drift.

Code changes:

- Added coach-specific mobile CSS classes:
  - `.coach-plan-row`
  - `.coach-session-main`
  - `.coach-session-preview`
  - `.coach-session-actions`
  - `.coach-adaptive-card`
  - `.coach-detail-card`
- Added mobile breakpoints for AI Coach:
  - session cards stack vertically on portrait phones,
  - action buttons become a grid / single column on very narrow screens,
  - detail modal uses tighter mobile sizing.
- Converted deterministic/fallback workout details to Thai:
  - warmup,
  - mainSet,
  - cooldown,
  - execution,
  - successCriteria,
  - intensity,
  - targetDescription.
- Added display helpers:
  - `hasThaiText()`
  - `coachSessionTypeThai()`
  - `coachSessionDisplayDetails()`
  - `coachSessionDisplayDescription()`
- Existing saved plans with English details are displayed using Thai deterministic details without overwriting Firebase.
- Updated AI prompt so new plan descriptions, notes, and details must be Thai.
- Updated Track Plan card rendering:
  - Thai session type labels,
  - Thai badges,
  - Thai action buttons,
  - clearer main-set preview.
- Updated workout detail modal:
  - Thai headings,
  - Thai close/action wording,
  - mobile-readable layout classes.
- Added adaptive explanation helpers:
  - `coachDecisionThai()`
  - `coachAdaptiveGuidance()`
- The daily adaptive card now explains:
  - the baseline plan,
  - whether today is green/yellow/red,
  - what changes are recommended,
  - that changes are only persisted after move/downgrade/skip writes to Firebase.
- Updated action toasts and adjustment notes to Thai.
- Updated `verify_dashboard.js` checks for the new coach UX/adaptive helpers.

Verification to run:

- `node verify_dashboard.js`
- `python smoke_test_dashboard.py`

## 2026-07-07 Coach Plan Quality And Cloud Save Fix

Context:

- User reported that generated training plans were too low quality to use:
  - no actionable workout detail,
  - clicking into a plan day did not show what to run,
  - the plan did not reliably save to cloud.
- Apps Script exists in this project, but its current backup scope is only:
  - `workout`
  - `wellness`
  - `ping`
- Therefore coach plans remain Firebase-first at:
  - `users/{uid}/coach_plan`
- Apps Script was not changed in this pass because adding coach plans there would require a new schema and Apps Script deployment version.

Root causes found:

- `buildFallbackTrainingPlan()` created shallow fallback sessions such as generic easy/tempo/interval rows.
- `renderCoachTracking()` listed sessions but had no detail modal or drill-by-drill view.
- Firebase helper `setData()` silently returned when no user was signed in, so the UI could imply success even when no cloud write happened.
- Plan adjustment actions did not verify the saved Firebase state after writing.
- Downgrade/skip actions could leave old hard-session details attached to the changed session.

Code changes:

- Added Firebase auth state helpers:
  - `window._fb.isSignedIn()`
  - `window._fb.currentUid()`
- `generateTrainingPlan()` now blocks plan creation until the user is signed in.
- `generateTrainingPlan()` now writes `coach_plan`, reads it back, and fails visibly if the saved `createdAt` is not confirmed.
- AI prompt now requires each session to include structured `details`:
  - warmup
  - mainSet
  - cooldown
  - execution
  - successCriteria
  - intensity
  - targetDescription
- Added deterministic `coachSessionDetails()` so both AI plans and local fallback plans have actionable detail.
- `validateCoachPlan()` now normalizes/preserves `details` for every session.
- `buildFallbackTrainingPlan()` now creates structured plans with concrete run instructions instead of generic rows.
- `renderCoachTracking()` now shows main-set preview and a `Detail` button for each session.
- Added `showCoachSessionDetail()` modal with full workout instructions and action buttons.
- Added `assertCoachCloudSaved()` for coach plan write verification.
- `markDone()`, move, downgrade, and skip now verify Firebase state after writing.
- Downgrade now regenerates Easy workout details.
- Skip now regenerates Rest workout details.
- Updated `verify_dashboard.js` to guard these new coach functions and cloud-save error text.

Verification to run:

- `node verify_dashboard.js`
- `python smoke_test_dashboard.py`

User-facing expectation after deploy:

- The user must be signed in before generating a plan.
- A generated plan should either show `AI plan saved` or `Local fallback plan saved`; both must be confirmed in Firebase before success.
- Track Plan should show a `Detail` button for each session.
- Detail should explain exactly what to run, including warmup, main set, cooldown, execution, and success criteria.
- Move/Downgrade/Skip/Done should fail visibly if Firebase save is not confirmed.

## 2026-07-07 AI Coach Plan Generation Hotfix

Context:

- User tried generating a running plan and saw:
  - `DeepSeek ไม่ส่งแผนกลับมา`
- Audit also found stale Strava copy, stale PWA cache versions, stale Android README notes, and a coach goal-profile precedence bug.

Changes made:

- `generateTrainingPlan()` no longer uses the news/search path for coach plan generation.
  - It calls the AI proxy with `use_search: false`.
  - Temperature is reduced for JSON plan output.
- Added robust plan handling:
  - `extractJsonObject()` extracts JSON from fenced or mixed AI responses.
  - `validateCoachPlan()` normalizes session types, dates, distances, and downgrades back-to-back hard sessions.
  - `buildFallbackTrainingPlan()` creates a deterministic local plan if AI/proxy returns no content or invalid JSON.
- Fallback plans are saved instead of failing the user flow.
  - Saved plan includes `aiFallback: true`.
  - Saved plan includes `aiFallbackReason`.
- Fixed `getCoachGoalProfile(plan)`:
  - plan review/reschedule now prefers `plan.goalProfile` over default form values.
- Reschedule now respects unavailable dates/weekdays from `goalProfile.unavailable`.
- Updated stale copy:
  - weekly dashboard note no longer says Firebase + Strava.
  - AI Coach helper copy no longer says Sync Strava every day.
- Bumped PWA cache/version strings:
  - `sw.js`
  - `manifest.json`
  - `index.html` manifest/icon query strings.
- Updated Android README to reflect current cadence, wellness, SpO2, and auto-sync support.
- Updated `verify_dashboard.js` checks to cover the new fallback/validation flow.

Verification to run:

- `node verify_dashboard.js`
- `python smoke_test_dashboard.py`
- `node --check workers/ai-proxy/src/index.js`
- `android-sync-companion/gradlew.bat assembleDebug`

Verification completed:

- All commands above passed.
- Extra targeted browser smoke passed:
  - mocked AI response with empty content.
  - `generateTrainingPlan()` saved a local fallback plan.
  - fallback produced 16 sessions for a 4-week / 4-days-per-week test.
  - unavailable weekday `Fri` was respected.
  - no page errors.

## Current Project

- Repo: `C:\Users\pucca\Dashboard-GitHub`
- GitHub remote: `https://github.com/porbboyza-afk/Dashboard.git`
- Main app: MyDash static dashboard, opened by the user through GitHub Pages.
- AI proxy Worker: `mydash-ai-proxy`
- Lita Worker: `litago`

## Critical Safety Notes

- Do not run bare `npx wrangler deploy` from `C:\Users\pucca`.
- `C:\Users\pucca\wrangler.jsonc` points to `litago`:
  - `name = litago`
  - `main = AI_Assistant/Lita_Cloud_Worker_V19.2.js`
- Always deploy MyDash proxy with an explicit config path:
  - `npx wrangler deploy -c C:\Users\pucca\Dashboard-GitHub\workers\ai-proxy\wrangler.toml`
- Do not deploy, rollback, or edit `litago` unless the user explicitly asks.
- Do not read or print `.env` or secrets unless strictly required and approved.

## What Happened

The user reported that AI Q&A could not answer 2026 news because the model only knew up to 2025 and had no search engine. A MyDash AI proxy was added earlier to inject current news context before calling DeepSeek.

The user then saw browser errors:

- `Failed to fetch`
- `เชื่อมต่อ AI Proxy ไม่ได้ ตรวจสอบ AI Proxy URL, CORS ของ Worker, หรืออินเทอร์เน็ต แล้วลองใหม่`

During investigation, the live URL `https://mydash-ai-proxy.porbboyza.workers.dev` was returning Lita text. This created concern that Lita Go had been damaged. Later checks showed:

- `litago` live deployment stayed on version `cad3673c-dd37-483a-a15c-1be2c4a31e2b`.
- `mydash-ai-proxy` is a separate Worker and has its own `DEEPSEEK_API_KEY` secret.
- After deploying with the explicit MyDash config path, `mydash-ai-proxy` now returns MyDash proxy JSON again.

## Current Worker Status

Latest verified MyDash proxy deployment:

- Worker: `mydash-ai-proxy`
- URL: `https://mydash-ai-proxy.porbboyza.workers.dev`
- Latest tested version after fixes: `3106bfb5-e69b-4b2c-b0a1-e4a9f5817d24`
- Health check expected body:
  - `{"ok":true,"service":"mydash-ai-proxy","search":"google-news-rss,bing-news-rss,gdelt"}`

Latest verified Lita status during this work:

- Worker: `litago`
- Version stayed unchanged: `cad3673c-dd37-483a-a15c-1be2c4a31e2b`
- No Lita deploy was intentionally performed after the issue was understood.

## Current AI Search Behavior

Frontend:

- `index.html` default proxy URL is `https://mydash-ai-proxy.porbboyza.workers.dev`.
- AI Q&A sends `use_search: true` in proxy mode.
- Direct browser-to-DeepSeek mode cannot search current news.

Worker:

- Tries Google News RSS first.
- If Google is blocked or empty, tries Bing News RSS.
- If still empty, tries GDELT.
- Injects fetched title/source/date/snippet into the model context.
- Returns `search_results` to the frontend so the side panel can show sources.
- Supports `debug_search: true` in test requests to return non-secret upstream diagnostics.

Observed production behavior from Cloudflare:

- Google News RSS returned `503`.
- GDELT returned `429/500`.
- Bing News RSS returned `200` and produced current 2026 news results.

## UI Work Added

AI Q&A page now has a two-column layout:

- Main chat area.
- Right side panel with:
  - latest sources from the proxy response,
  - pinned news notes stored in localStorage,
  - manual note textarea,
  - Pin, Open, Summarize, Remove actions.

Relevant functions in `index.html`:

- `renderNewsSidePanel`
- `pinNewsSource`
- `saveManualNewsNote`
- `deletePinnedNews`
- `clearPinnedNewsNotes`
- `summarizeNewsSource`
- `summarizePinnedNews`
- `summarizeNewsItem`

Relevant UI hook in `js/ui-core.js`:

- `showPage('news')` now renders the chat and side panel when entering the AI Q&A page.

## Verification Already Run

Local syntax and app checks:

- `node --check C:\Users\pucca\Dashboard-GitHub\workers\ai-proxy\src\index.js`
- `node --check C:\Users\pucca\Dashboard-GitHub\js\ui-core.js`
- `node C:\Users\pucca\Dashboard-GitHub\verify_dashboard.js`
- `python C:\Users\pucca\Dashboard-GitHub\smoke_test_dashboard.py`

Worker checks:

- GET health returned `service: mydash-ai-proxy`.
- OPTIONS with origin `https://porbboyza-afk.github.io` returned `access-control-allow-origin: https://porbboyza-afk.github.io`.
- POST test for `ข่าว AI และเทคโนโลยีที่น่าสนใจในปี 2026` returned:
  - `search_results` count: `2`
  - Sources included `ฐานเศรษฐกิจ on MSN` and `Sanook`
  - AI answer referenced June 2026 current context.

PowerShell note:

- `Invoke-RestMethod` and `curl.exe` in this shell showed local TLS/proxy issues.
- Node `fetch` worked and was used for endpoint verification.

## Next Steps

1. Run final syntax tests after any further edits.
2. Commit and push these MyDash changes.
3. Ask the user to hard refresh GitHub Pages after push.
4. If the browser still uses an old proxy URL from localStorage, clear or update MyDash Settings -> AI Proxy URL.

## 2026-07-04 Strava Sync 404 Investigation

User reported: MyDash Strava sync cannot sync and shows `404`.

Important findings:

- Repo was clean before this investigation.
- Strava sync code is in `index.html`.
- Strava sync does not use Apps Script or Google Sheets backup.
- Apps Script only handles backup types `workout` and `wellness`.
- Main Strava sync endpoint is:
  - `https://www.strava.com/api/v3/athlete/activities?per_page=100`
- Detail enrichment endpoints are:
  - `https://www.strava.com/api/v3/activities/{id}`
  - `https://www.strava.com/api/v3/activities/{id}/laps`
  - `https://www.strava.com/api/v3/activities/{id}/streams?...`
- Testing public Strava endpoints without a token returned `401`, not `404`, so the user's `404` likely depends on their saved token/scope/activity/privacy or a specific detail endpoint.
- This session did not have the user's real Strava token, so a full authenticated sync could not be reproduced locally.

Code changes made:

- Added `stravaEndpointLabel(url)` to label failed endpoints as token refresh, activities list, athlete profile, activity detail, activity laps, or activity streams.
- Added `stravaBuildHttpError(response, url)` to include HTTP status, endpoint label, Strava API message, and a specific 404 hint.
- Updated Strava connect, refresh, detail fetch, and activity-list sync to use the clearer error builder.
- Updated `fetchStravaActivityDetail()` so if all detail/laps/streams calls fail, it saves a summary-only payload instead of throwing. This prevents detail 404s from making the main sync look completely broken.
- Existing detail enrichment already catches per-activity failures in `enrichNewStravaActivities()`, so this change makes the cache/UI more graceful and easier to debug.

Verification run after the change:

- `node C:\Users\pucca\Dashboard-GitHub\verify_dashboard.js`
- `python C:\Users\pucca\Dashboard-GitHub\smoke_test_dashboard.py`
- Both passed with no page errors, console errors, or request failures.

## 2026-07-12 - Garmin Direct Phase 0 read-only bridge foundation

Scope implemented locally under `tools/garmin-direct-bridge`:

- Added a Windows-only CLI isolated from the dashboard runtime.
- Pinned `garminconnect==0.3.6` behind a strict read-only method allowlist.
- Added interactive login and DPAPI Current User encrypted session storage under `%LOCALAPPDATA%\MyDash\garmin-direct`.
- Added persisted SQLite request budgets: 30/hour, 200/day, two-second spacing.
- Added auth/challenge/rate-limit circuit breaking with no automatic retries.
- Added schema-only 7/30-day capability probes for activities, detail/splits, sleep, HRV, heart rate, stress, and Body Battery.
- Added an explicit one-activity original FIT probe; it never runs without `--include-fit`.
- Added privacy/status documentation and initial capability/endpoint notes.
- Confirmed there are no Firebase writes, Coach mutations, scheduler, or Android direct integration in Phase 0.

Verification completed:

- Core unit tests pass for redaction, schema-only output, and persisted request budgeting.
- CLI `privacy-status` runs and reports no local session, Firebase writes disabled, scheduler disabled.

Still pending before Phase 0 can be called complete:

- Run interactive Garmin login with the account owner present.
- Run real 7-day and 30-day probes, plus one explicit FIT download.
- Replace Pending cells in `docs/CAPABILITY_MATRIX.md` and add observed endpoint behavior to `docs/ENDPOINT_NOTES.md`.
- Verify and document the effective Windows ACL on the LocalAppData bridge directory.

Phase 0 completion update:

- Interactive login completed; encrypted session restoration succeeded.
- Real 7-day capability probe passed for activities, activity summary/detail/splits, sleep, HRV, heart rate, stress, and Body Battery.
- One explicit original FIT download passed (15,341 bytes); only its byte count and SHA-256 metadata appear in the schema report.
- Real 30-day activity probe passed. Wellness was not repeated because the same three-day capability had already passed and the bridge preserves its request budget.
- Fixed the pinned library compatibility detail: download format is `Garmin.ActivityDownloadFormat.ORIGINAL`.
- Unit tests pass 5/5, including DPAPI round-trip and pinned-library download enum coverage.
- ACL inspection passed: current user, SYSTEM, and local Administrators have Full Control through inherited Windows permissions.
- Phase 0 is complete locally. No Firebase write, Coach mutation, scheduler, or Android direct sync was introduced.
- Detailed Garmin Direct continuation guide: `GARMIN_DIRECT_HANDOFF.md`. This is the canonical handoff for Phase 1 onward and explains why incremental sync, normalization, provenance, deduplication, and local verification must precede Firebase/UI integration.

## 2026-07-12 - Garmin Direct Phase 1 activity incremental slice

- Added `sync_store.py` with versioned SQLite schema for sync runs, cursors, and source activity metadata.
- Added `activity_sync.py` with a bounded 30-day initial window and two-day overlap.
- Activity identity uses Garmin `activityId`; payload changes use a deterministic SHA-256 hash.
- Upserts and cursor advancement share one transaction. A failed fetch records failure without moving the cursor.
- Raw Garmin payloads are not stored in the local database.
- Added `python -m garmin_direct.cli sync-activities`.
- Activity sync tests and existing security tests pass 9/9.
- Real run 1: fetched 23, inserted 23, total 23.
- Real immediate overlap run: fetched 0, inserted 0, total remained 23.
- Next work is canonical activity normalization and cross-source deduplication fixtures. Firebase/UI remain blocked.

Normalization follow-up:

- Added `normalize.py` for canonical Garmin activity conversion with explicit units, UTC time, missing-value semantics, schema version, and provenance.
- Added `dedupe.py` for deterministic identity and fuzzy cross-source decisions (`duplicate`, `review`, `distinct`).
- Added Garmin/Strava/Health Connect-shaped fixtures covering near matches and distinct workouts.
- Full Garmin Direct suite passes 14/14.
- Next: persist canonical records/decisions, add wellness incremental collectors, then Firebase dry-run. Live writes remain blocked.

Wellness follow-up:

- Added independent incremental collectors for sleep, HRV, heart rate, stress, and Body Battery.
- Added local schema-only/hash persistence keyed by domain/date; health values are not copied into the development database.
- Full suite passes 19 tests after adding explicit `budget_exhausted` classification.
- The first real wellness run was blocked before any endpoint call because the persisted 30/hour request budget was already exhausted. No wellness cursor advanced and no records were committed.
- Resume the same CLI command after the rolling-hour budget opens; do not clear or raise the safety limit.

Real wellness sync completion:

- Three-day real sync completed for sleep, HRV, heart rate, stress, and Body Battery.
- Repeat overlap inserted no duplicate records for the four daily endpoints.
- Fixed Body Battery range aggregation by splitting the returned array using each item's explicit date.
- Bounded Body Battery refresh completed; all five domains now have three local daily records.
- Full bridge suite passes 24/24.

Wellness UI/Coach integration while Garmin budget was closed:

- Added canonical wellness normalizers and deterministic wellness Firebase planner.
- Added activity/wellness manifest support to the authenticated Settings importer.
- Added realtime `wellness_sources/garmin` listener and safe manual-over-Garmin merge.
- Existing Wellness analytics/recovery graphs now receive normalized Garmin sleep, HRV, resting HR, stress, and Body Battery fields when imported.
- Central `getAllActivities()` now suppresses high-confidence Garmin/Health Connect/Strava/manual duplicates before Coach, load, stats, and graphs consume them.
- Corrected near-duplicate duration tolerance from 180 minutes to 3 minutes.
- Bridge suite passes 29/29; activity dedupe behavior, syntax, and dashboard smoke regression pass.

Timed wellness resume:

- Added a Python resume worker that waits on persisted request-budget state without polling Garmin.
- It starts only when seven hourly requests are available, backfills Heart rate/Stress/Body Battery, then creates the wellness dry-run manifest.
- Metadata-only progress log: `%LOCALAPPDATA%\MyDash\garmin-direct\logs\resume-wellness.jsonl`.
- Hidden worker PID at launch: 18468. It was confirmed running in `waiting` state.
- Firebase writes remain user-confirmed through Settings.
- Full bridge suite passes 30/30.

First real wellness Firebase import:

- Timed worker completed all three pending domains and generated 15 deterministic wellness operations across five domains/three dates.
- Owner-path validation passed with zero invalid or duplicate paths.
- User confirmed importing the manifest through authenticated MyDash Settings.
- Final regression: bridge 30/30, activity dedupe behavior pass, syntax pass, dashboard smoke pass with no page/console/request failures.
- Secret scan found no supplied Garmin credentials in changed Garmin Direct files.
- Firebase readback remains user-confirmed rather than independently automated because the test browser lacked the authenticated session.

Firebase dry-run foundation:

- Added deterministic `set` planning under `users/<uid>/workouts/garmin_<activityId>`.
- Planner requires a validated explicit Firebase UID and performs no network calls.
- Added `status`, `verify`, `export-config`, and strict `import-config` commands.
- Local verification passes with 23 source/canonical activities, valid SQLite integrity, encrypted session present, Firebase writes disabled, and scheduler disabled.
- Full suite passes 23/23.
- A real dry-run manifest still requires the authenticated MyDash Firebase UID; do not infer UID from email or enable live writes yet.

Firebase ownership dry-run result:

- Authenticated UID was supplied interactively but deliberately not written to the repository.
- Generated 23 operations with 23 unique deterministic paths.
- All operations are `set`; all paths stayed under the expected authenticated-user Garmin workout boundary.
- Live writes remain disabled. Next implementation should use the browser's existing Firebase Auth session rather than storing an ID token in the local bridge.

Authenticated Garmin import UI:

- Added a Settings importer for the local Firebase dry-run manifest.
- It verifies the current Firebase UID, owner prefix, deterministic Garmin paths, operation type/count, duplicate paths, and Garmin source before enabling the write action.
- Import uses the existing authenticated browser Firebase adapter and never exposes an ID token to the local bridge.
- Deterministic paths make interrupted imports safely repeatable without creating new workout keys.
- Syntax and dashboard smoke tests pass with no page errors, console errors, or request failures.
- The first real import has not been confirmed in the UI yet.

Duplicate reconciliation follow-up:

- The first real import revealed expected cross-source duplicates because Garmin deterministic identity alone does not merge existing Strava/Health Connect keys.
- Added Settings scan using type, time/date, duration, and distance matching.
- Only high-confidence `garmin_` copies are eligible for confirmed removal; review-range matches and all existing non-Garmin records remain untouched.
- Future manifest preview filters high-confidence cross-source duplicates before import.
- Syntax and smoke regression remain clean.

Machine migration documentation:

- Added `GARMIN_DIRECT_MACHINE_MIGRATION_HANDOFF.md` as the canonical computer-change runbook.
- It explains why DPAPI session files cannot be reused on another Windows identity, what must/must not move, bounded re-sync, deduplication verification, cutover, rollback, and old-machine decommissioning.
- The main `GARMIN_DIRECT_HANDOFF.md` links to the migration runbook.

## 2026-07-07 Adaptive AI Coach And Strava Archive Safety

Context:

- User asked to implement the full recommendation set:
  - AI coach for 10K sub-48 style planning.
  - daily body/readiness-aware decisions.
  - rescheduling when unavailable.
  - Strava paid/archive import safety so Health Connect and Strava do not fight.

Code changes:

- Added goal-profile fields to the AI Coach create form:
  - race distance
  - target time
  - latest benchmark
  - unavailable days
- Added deterministic coach helper layer in `index.html`:
  - `parseTimeToMinutes()`
  - `raceDistanceKm()`
  - `getCoachGoalProfile()`
  - `buildCoachContext()`
  - `formatCoachContext()`
  - `coachSafetyDecision()`
- `generateTrainingPlan()` now sends a richer coach context to AI:
  - target goal/pace
  - 7D/30D/90D volume
  - readiness score and reasons
  - ACWR, monotony, strain
  - wellness 14D including sleep, RHR, HRV, SpO2, fatigue, pain
  - latest workouts with source labels
  - explicit safety rules preventing catch-up load doubling and hard-day stacking
- Saved coach plans now include:
  - `goalProfile`
  - `safetyPolicyVersion: 1`
  - `adjustments: []`
- Added adaptive track-plan controls:
  - `Today unavailable`
  - `Downgrade today`
  - per-session `Move`
  - per-session `Downgrade`
  - per-session `Skip`
- Added `coach_plan.adjustments` history when sessions are moved, downgraded, or skipped.
- Added daily decision card in Track Plan:
  - Green: do planned session.
  - Yellow: reduce volume/intensity.
  - Red: recovery/rest, no hard session.
- `reviewPlanAI()` now uses the same coach context and adjustment history.

Safety rules implemented in code:

- No deterministic catch-up doubling after missed/unavailable sessions.
- Hard sessions are not moved into slots with hard sessions nearby.
- Pain/high soreness, sick status, and high ACWR block or downgrade hard sessions.
- AI is instructed not to invent missing cadence/GPS/splits.

Strava archive/dedupe changes:

- Added `strava_archive` source badge.
- `renderStravaActivities()` maps newly synced Strava API activities as:
  - `source: "strava_archive"`
  - `archiveOnly: true`
- `getAllActivities()` no longer lets Strava override primary data when fingerprints duplicate.
- Source priority is now:
  - Health Connect
  - manual/local
  - recovered Strava cache
  - Strava archive
  - legacy Strava API
- Activity detail shows `Merged duplicates` when lower-priority duplicate sources were merged away.
- Sources overview now separates Strava archive count from manual/local workouts.

Verification:

- `node verify_dashboard.js`
- `python smoke_test_dashboard.py`
- Both passed with no page errors, console errors, or request failures.

Next recommended checks:

- Create a new 10K sub-48 plan and confirm JSON save works through AI proxy.
- Open Track Plan and test:
  - Today unavailable
  - Downgrade today
  - Move/Downgrade/Skip on a future session
- If Strava access is restored temporarily, treat sync as archive-only and review duplicate behavior before using any Strava detail for enrichment.

Recommended next debugging step if the user still sees 404:

- Open browser DevTools -> Network while pressing Strava Sync.
- Capture the exact failing URL and response body.
- If it is `activities list HTTP 404`, check whether the saved Strava app credentials/token are for the expected Strava account.
- If it is `activity detail/laps/streams HTTP 404`, reconnect Strava using `activity:read_all` and check whether the activity is private/deleted or not owned by the authenticated athlete.

## 2026-07-04 Strava Sync 403 Follow-up

User then reported: Strava sync now shows `403`.

Official Strava docs checked:

- Strava OAuth authorization response includes accepted scopes, and users can opt out of requested scopes.
- `activity:read` reads activities visible to Everyone and Followers.
- `activity:read_all` includes `activity:read` access plus privacy zone data and activities visible as Only You.
- Activity streams require `activity:read`; Only Me activities require `activity:read_all`.

Likely cause:

- The saved Strava refresh token is valid enough to authenticate but does not have the needed activity scope, or the user did not accept `activity:read_all`.
- This is more consistent with `403` than with a missing endpoint.

Code changes made:

- Reworked `stravaConnect()` UI to prefer OAuth authorization-code flow:
  - `Open Strava auth`
  - paste `code=...`
  - `Connect code`
- Added `stravaGetAuthSettings()` to read saved Strava Client ID, Client Secret, and Redirect URI.
- Added `stravaOpenAuthorize()` to generate the Strava OAuth URL with:
  - `approval_prompt=force`
  - `scope=activity:read,activity:read_all`
- Added `stravaExtractCode()`.
- Added `stravaExchangeCodeCall()` for authorization-code token exchange.
- Added `stravaConnectCode()` to save access token, refresh token, expiry, accepted scope, and athlete.
- Kept the old refresh-token paste flow under an Advanced section.
- Updated 403 error hint to tell the user to reconnect and accept `activity:read_all`.
- Updated the Strava guide card to describe the new flow instead of manual curl token exchange.

Verification run:

- `node C:\Users\pucca\Dashboard-GitHub\verify_dashboard.js`
- `python C:\Users\pucca\Dashboard-GitHub\smoke_test_dashboard.py`
- Both passed with no page errors, console errors, or request failures.

## 2026-07-04 Garmin / Health Connect Sync Companion Plan

User context:

- Strava sync stopped working because Strava returned `Application.Status.Inactive`.
- User found Strava now requires paid/subscription/dev access for the app path they used.
- User wants a phone-friendly sync path; exporting Garmin files from Garmin Connect Web is not acceptable because it is too manual.
- User asked for a plan first, and wants this logged so another AI can continue safely.

Project scope checked:

- Repo checked: `C:\Users\pucca\Dashboard-GitHub`
- Existing project is a static web dashboard, not an Android project.
- Current files are web/PWA, Apps Script backup, and Cloudflare AI proxy only:
  - `index.html`
  - `js/ui-core.js`
  - `js/date-utils.js`
  - `apps-script/Code.gs`
  - `workers/ai-proxy/src/index.js`
- No Gradle/Kotlin/Android app scaffold exists in this repo yet.
- Git worktree was clean before writing this log section.

Relevant current MyDash data model:

- Firebase app config is embedded in `index.html`.
- User-scoped Realtime Database paths use:
  - `users/{uid}/settings`
  - `users/{uid}/workouts`
  - `users/{uid}/wellness`
  - `users/{uid}/strava_token`
  - `users/{uid}/strava_activities`
  - `users/{uid}/strava_activity_details`
  - `users/{uid}/strava_last_sync`
- Manual workouts are stored under `users/{uid}/workouts`.
- Workout object shape used by `saveWorkout()`:
  - `date`
  - `dist`
  - `time`
  - `hr`
  - `cad`
  - `stride`
  - `purpose`
  - `rpe`
  - `shoe`
  - `surface`
  - `temperature`
  - `weather`
  - `pain`
  - `painLocation`
  - `feeling`
  - `note`
  - `type`
  - `avgPace`
  - `splits`
  - `interval`
  - `createdAt`
  - `updatedAt`
- `getAllActivities()` merges manual workouts and Strava-derived workouts using `workoutFingerprint()`.
- Existing dedupe fingerprint is:
  - `date|type|rounded dist*20|rounded time`
- If duplicate activity exists, Strava currently wins over manual data.

Official docs checked:

- Garmin Connect Developer Program:
  - `https://developer.garmin.com/gc-developer-program/`
  - Garmin says the API program is for enterprise/business use and requires request/review.
- Android Health Connect:
  - `https://developer.android.com/health-and-fitness/health-connect`
  - Health Connect stores health/fitness records and supports app-to-app data sharing with user permission.
  - Google Fit APIs are supported until the end of 2026, so new work should target Health Connect instead of Google Fit.
- Health Connect raw reads:
  - `https://developer.android.com/health-and-fitness/health-connect/read-data`
  - Apps read records with `ReadRecordsRequest`.
  - Default third-party historical read limit is 30 days unless requesting extra history permission.
  - Background read requires `android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND` and should be implemented defensively.
- Health Connect exercise session record:
  - `https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/ExerciseSessionRecord`
  - Key fields include start/end time, `exerciseType`, title, notes, laps, route result, and optional RPE.
- Firebase Android setup:
  - `https://firebase.google.com/docs/android/setup`
  - Existing Firebase project can add/register an Android app and download `google-services.json`.
- Firebase Realtime Database Android:
  - `https://firebase.google.com/docs/database/android/start`
- Firebase Google Sign-In Android:
  - `https://firebase.google.com/docs/auth/android/google-signin`

Decision:

- Do not rebuild MyDash as a full mobile app now.
- Build a small Android-only sync companion first.
- The companion app's job is only to move activity data from Health Connect into the same Firebase paths the web app already reads.
- The web dashboard remains the source of UI/analytics truth.

Target architecture:

```text
Garmin watch
-> Garmin Connect Android app
-> Health Connect
-> MyDash Sync Companion Android app
-> Firebase Realtime Database
-> MyDash Web Dashboard
```

Why Android companion first:

- It avoids Strava API restrictions.
- It avoids manual Garmin Connect Web export.
- It does not require Garmin Developer Program approval.
- It reuses the existing Firebase user data and MyDash web dashboard.
- It is smaller and safer than rewriting the web app as a full native app.

Planned repo layout:

```text
C:\Users\pucca\Dashboard-GitHub
  android-sync-companion\
    settings.gradle.kts
    build.gradle.kts
    app\
      build.gradle.kts
      google-services.json       # local only; do not commit if it contains project config not intended for repo
      src\main\AndroidManifest.xml
      src\main\java\...\MainActivity.kt
      src\main\java\...\HealthConnectSync.kt
      src\main\java\...\FirebaseSyncRepository.kt
```

Implementation plan:

1. Create Android project scaffold under `android-sync-companion`.
2. Register Android app in existing Firebase project `dash-ca315`.
3. Add Firebase Auth and Realtime Database Android SDK.
4. Add Health Connect client dependency.
5. Implement Google login so the Android app writes to the same `users/{uid}` as the web app.
6. Request Health Connect permissions for:
   - exercise sessions
   - distance
   - heart rate
   - calories if available
   - speed/pace if available
   - cadence if available
   - route only if needed and permission allows
7. First sync should read last 30 days because Health Connect default historical access is limited.
8. Later sync should read from `users/{uid}/sync_sources/health_connect/last_sync`.
9. Map records into MyDash workout schema and write to `users/{uid}/workouts/{deterministicId}`.
10. Add `source: "health_connect"` and source metadata to imported workouts.
11. Add duplicate protection compatible with `workoutFingerprint()`.
12. Add a minimal app UI:
    - Sign in / signed-in user
    - Health Connect permission status
    - Last sync time
    - Sync now button
    - Last result count/errors
13. Add optional background sync later using WorkManager after manual sync works.

Proposed Health Connect to MyDash mapping:

```text
ExerciseSessionRecord.startTime -> date
ExerciseSessionRecord.exerciseType -> type
duration between start/end -> time
DistanceRecord total -> dist
HeartRateRecord average samples in session -> hr
cadence records if available -> cad
computed time / dist -> avgPace
ExerciseSessionRecord.title -> name
ExerciseSessionRecord.notes -> note
ExerciseSessionRecord.laps -> splits when available
source app/package -> sourceApp or dataOrigin
```

Proposed imported workout object:

```js
{
  date: "YYYY-MM-DD",
  type: "run" | "bike" | "swim" | "walk",
  dist: 0,
  time: 0,
  hr: 0,
  cad: 0,
  avgPace: 0,
  name: "...",
  note: "...",
  source: "health_connect",
  sourceApp: "...",
  healthConnectId: "...",
  syncSource: "garmin_via_health_connect",
  importedAt: 0,
  createdAt: 0,
  updatedAt: 0
}
```

Important risks / unknowns:

- Need the user's phone to confirm Garmin Connect actually writes Garmin workouts into Health Connect on that device/account.
- Health Connect may not expose every Garmin field. FIT/Garmin API may contain more detail than Health Connect.
- Default Health Connect read history is 30 days for third-party data. Older history needs special permission/request path.
- Route, cadence, laps, and detailed samples may be incomplete depending on Garmin's Health Connect export.
- Firebase Realtime Database rules must allow authenticated users to write only their own `users/{uid}` path. If current rules are weaker, fix rules before distributing the companion app.
- Android app requires registering package name and SHA fingerprints in Firebase.
- Do not commit secrets. Treat `google-services.json` carefully.

What not to do yet:

- Do not replace the web dashboard.
- Do not deploy Cloudflare Worker for this.
- Do not modify Lita Worker.
- Do not rely on Google Fit REST for new work because it is being phased out by Google.
- Do not build iOS unless the user confirms iPhone is the primary Garmin sync phone.

Next action if user approves:

1. Check local Android/Gradle tooling.
2. Create `android-sync-companion` scaffold.
3. Register or verify Firebase Android app config.
4. Build a minimal Health Connect permission + manual sync prototype.
5. Test on the user's Android phone with Health Connect and Garmin Connect installed.
6. Verify new workouts appear in MyDash Web without changing the main dashboard schema.

## 2026-07-04 MyDash Skill + Android Sync Prototype

User approved creating a Codex skill and proceeding with the Android sync companion plan.

Skill created:

- Path: `C:\Users\pucca\.codex\skills\mydash-project`
- Type: router/master project skill with references:
  - `references/safety.md`
  - `references/web-dashboard.md`
  - `references/firebase-schema.md`
  - `references/health-connect-companion.md`
  - `references/strava-legacy.md`
  - `references/ai-proxy.md`
  - `references/apps-script-backup.md`
  - `references/agent-roles.md`
- Validation:
  - Installed `PyYAML` because `quick_validate.py` required it.
  - `python C:\Users\pucca\.codex\skills\.system\skill-creator\scripts\quick_validate.py C:\Users\pucca\.codex\skills\mydash-project`
  - Result: `Skill is valid!`

Android/Firebase tooling findings:

- Java is installed: OpenJDK 21.
- Global `gradle` command is not in PATH.
- Android SDK exists at `C:\Users\pucca\AppData\Local\Android\Sdk`.
- Installed SDK platforms include `android-34` and `android-36.1`.
- Firebase project `dash-ca315` already has Android app:
  - Display name: `MyDash Android`
  - App ID: `1:431723990100:android:c507449727c9e4b58131c1`
  - Package: `com.pucca.mydashsync`
- Existing debug SHA was already registered in Firebase.

Android prototype created:

- Path: `C:\Users\pucca\Dashboard-GitHub\android-sync-companion`
- Package: `com.pucca.mydashsync`
- Main files:
  - `settings.gradle.kts`
  - `build.gradle.kts`
  - `app/build.gradle.kts`
  - `app/src/main/AndroidManifest.xml`
  - `app/src/main/java/com/pucca/mydashsync/MainActivity.kt`
  - `app/src/main/java/com/pucca/mydashsync/HealthConnectSync.kt`
  - `README.md`
- Local ignored files:
  - `android-sync-companion/local.properties`
  - `android-sync-companion/app/google-services.json`

Prototype behavior:

- Native Kotlin Android app, no Compose.
- Uses Firebase Auth + Google Sign-In.
- Uses Health Connect client.
- Requests read permissions for:
  - exercise sessions
  - distance
  - heart rate
  - total calories burned
- Reads Health Connect exercise sessions for the last 30 days.
- Maps sessions to MyDash workout objects.
- Writes imported activities to:
  - `users/{uid}/workouts/{deterministicId}`
- Writes sync status to:
  - `users/{uid}/sync_sources/health_connect`

Build notes:

- Used cached Gradle 8.5 to create a project wrapper.
- Gradle wrapper now exists in `android-sync-companion`.
- Android Gradle Plugin pinned to `8.2.2` because it was already cached.
- Health Connect pinned to `1.1.0-alpha06` to work with compile SDK 34 and available cached tooling.
- `gradle.properties` forces `-Duser.language=en -Duser.country=US` because AGP zip packaging failed on Thai locale with a DOS-date `VerifyException`.
- Verified command:
  - `cd C:\Users\pucca\Dashboard-GitHub\android-sync-companion`
  - `.\gradlew.bat assembleDebug`
  - Result: `BUILD SUCCESSFUL`

Current blocker:

- No Android device was attached over ADB during this session.
- `C:\Users\pucca\AppData\Local\Android\Sdk\platform-tools\adb.exe devices` returned no devices.

Next action:

1. Connect Android phone with USB debugging enabled.
2. Run:
   - `C:\Users\pucca\AppData\Local\Android\Sdk\platform-tools\adb.exe devices`
3. Install:
   - `C:\Users\pucca\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r C:\Users\pucca\Dashboard-GitHub\android-sync-companion\app\build\outputs\apk\debug\app-debug.apk`
4. On phone:
   - Sign in with the same Google account used by MyDash Web.
   - Grant Health Connect permissions.
   - Run `Sync last 30 days`.
5. Refresh MyDash Web and verify imported workouts.

## 2026-07-05 Android Sync Device Test

Device test:

- ADB device detected: `RRCX10685RZ`
- Installed debug APK successfully:
  - `adb install -r C:\Users\pucca\Dashboard-GitHub\android-sync-companion\app\build\outputs\apk\debug\app-debug.apk`
- Opened app with monkey launcher.

Issues found during device testing:

- First permission attempt appeared to do nothing.
- Fixes applied:
  - Updated Health Connect SDK to `androidx.health.connect:connect-client:1.1.0-alpha12`.
  - Raised `compileSdk` to 36 and added `android.suppressUnsupportedCompileSdk=36`.
  - Changed availability check from `HealthConnectClient.getSdkStatus(context, PROVIDER_PACKAGE)` to `HealthConnectClient.getSdkStatus(context)` for Android 14+ platform Health Connect.
  - Added `PermissionsRationaleActivity`.
  - Added Health Connect privacy/rationale manifest entries:
    - `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`
    - `android.intent.action.VIEW_PERMISSION_USAGE`
    - `android.intent.category.HEALTH_PERMISSIONS`
- After reinstall, Health Connect permissions were granted.

Second issue:

- Sync result was overwritten by `render()`, so the user could not see imported/skipped/scanned counts after pressing `Sync last 30 days`.
- Fix applied:
  - Added `lastDetailMessage` in `MainActivity`.
  - Added `Log.i("MyDashSync", ...)` on sync success.
  - Added `Log.e("MyDashSync", ...)` on sync failure.

Final result:

- User confirmed activity appeared in MyDash after pressing `Sync last 30 days`.
- This confirms the first working pipeline:

```text
Health Connect
-> MyDash Sync Companion
-> Firebase Realtime Database users/{uid}/workouts
-> MyDash Web activity view
```

Remaining improvements:

- Add better persisted sync history/result after app restart.
- Add Garmin source filtering or source display once real Health Connect data origins are inspected.
- Add duplicate review UI if Health Connect entries duplicate existing Strava/manual workouts.
- Consider Credential Manager migration later because current GoogleSignIn client is deprecated but still works.

Firebase data check after successful Health Connect sync:

- Firebase project checked: `dash-ca315`.
- User path found: `users/4QrRDDXHyEN4TGJ4MCoLav5BK6D3`.
- `workouts` currently contains 11 records.
- All current `workouts` records are from `health_connect`.
- Current `workouts` date range: `2026-06-20` to `2026-07-02`.
- `strava_activities` returned `null`, so the old Strava list cache is gone.
- `strava_activity_details` still contains 17 cached Strava activity detail records.
- Cached Strava detail range: `2026-04-08T18:33:19Z` to `2026-06-30T18:08:40Z`.
- Cached Strava details are all `Run`.
- Safe recovery plan:
  - Do not restore all 17 Strava details directly because many overlap with Health Connect workouts from `2026-06-20` onward.
  - First restore only cached Strava runs before `2026-06-20` into `users/{uid}/workouts/strava-recovered-{activityId}`.
  - That would recover 7 older Strava runs without duplicating the Health Connect import.
  - If richer Strava detail is preferred for overlapping dates, build a separate review/merge path instead of blindly overwriting Health Connect workouts.

Recovery action completed:

- Wrote staging summaries for all 17 cached Strava detail records to:
  - `users/4QrRDDXHyEN4TGJ4MCoLav5BK6D3/imports/strava_cache_recovery`
- Restored 7 non-overlapping Strava runs before `2026-06-20` to `workouts`:
  - `strava-recovered-18025941343`
  - `strava-recovered-18619600821`
  - `strava-recovered-18822542427`
  - `strava-recovered-18877005982`
  - `strava-recovered-18902196321`
  - `strava-recovered-18956807864`
  - `strava-recovered-18970778200`
- Verification after write:
  - `workouts`: 18 records.
  - `imports/strava_cache_recovery`: 17 records.
- Overlap handling:
  - 8 cached Strava details matched existing Health Connect workouts by date/type/distance/time fingerprint and were left in staging only.
  - 2 cached Strava details were close but not exact fingerprint matches (`2026-06-20`, `2026-06-25`) and were left in staging only for manual review.

## 2026-07-06 Sources Page Direction

Strava is no longer treated as the primary sync page.

Code changes:

- Renamed the Strava navigation label to `Sources`.
- Kept the original page id `page-strava` and existing Strava functions to avoid breaking routing, deep links, and legacy code.
- Added a `Sync source status` card to the page.
- The page now reads and summarizes:
  - `users/{uid}/sync_sources/health_connect`
  - `users/{uid}/imports/strava_cache_recovery`
  - `users/{uid}/workouts`
  - `users/{uid}/strava_activities`
  - `users/{uid}/strava_token`
- Health Connect is presented as the primary source.
- Strava API is presented as `Legacy Strava API`.
- The dashboard status pill now shows Health Connect first and Strava as legacy/recovery only.

Verification:

- `node verify_dashboard.js`
- `python smoke_test_dashboard.py`
- Both passed with no page errors, console errors, or request failures.

## 2026-07-06 Health Connect Cadence Check

Goal:

- Verify whether Garmin Connect writes cadence into Health Connect and import it into MyDash workouts.

Findings from local SDK inspection:

- `androidx.health.connect:connect-client:1.1.0-alpha12` includes:
  - `StepsCadenceRecord` for run/walk step cadence.
  - `CyclingPedalingCadenceRecord` for bike cadence.
- `StepsCadenceRecord` requires `android.permission.health.READ_STEPS`.
- `CyclingPedalingCadenceRecord` maps to the existing `READ_EXERCISE` permission.

Code changes:

- Added `READ_STEPS` to the Android manifest.
- Added `StepsCadenceRecord` and `CyclingPedalingCadenceRecord` read permissions.
- Android sync now reads average cadence:
  - run/walk: average `StepsCadenceRecord.Sample.rate`
  - bike: average `CyclingPedalingCadenceRecord.Sample.revolutionsPerMinute`
- Android sync now updates existing Health Connect workouts if they were previously saved with `cad=0` and a new cadence value is found.
- Sync status now stores:
  - `updated`
  - `cadence_sessions`
  - `cadence_samples`
- App sync result text now shows imported/updated/skipped/scanned counts and cadence diagnostic message.

Verification:

- `.\gradlew.bat assembleDebug` passed.
- ADB device check returned no connected devices, so Garmin -> Health Connect cadence availability is not confirmed yet.

Next device-test steps:

1. Connect Android phone with USB debugging enabled.
2. Install the new debug APK.
3. Open MyDash Sync.
4. Grant the new Health Connect `Steps` permission if prompted.
5. Tap `Sync last 30 days`.
6. Check `sync_sources/health_connect/cadence_sessions` and `cadence_samples`.
7. Check Health Connect workouts in Firebase for `cad > 0`.

## 2026-07-07 Health Connect Wellness Sync

Goal:

- Extend the Android sync companion so Health Connect can fill Daily Wellness automatically where possible.
- Required fields requested by user:
  - sleep
  - resting HR
  - HRV RMSSD
  - weight
  - SpO2

Code changes:

- Added manifest permissions:
  - `READ_SLEEP`
  - `READ_RESTING_HEART_RATE`
  - `READ_HEART_RATE_VARIABILITY`
  - `READ_WEIGHT`
  - `READ_OXYGEN_SATURATION`
- Added Health Connect readers:
  - `SleepSessionRecord` -> `wellness/{date}/sleepHours`
  - `RestingHeartRateRecord` -> `wellness/{date}/restingHR`
  - `HeartRateVariabilityRmssdRecord` -> `wellness/{date}/hrv`
  - `WeightRecord` -> `wellness/{date}/weight`
  - `OxygenSaturationRecord` -> `wellness/{date}/spo2`
- Sleep records are assigned to the local date of `endTime`.
- Existing manual wellness values are not overwritten.
  - The sync only fills missing/blank/zero fields.
- Sync status now stores:
  - `wellness_days_scanned`
  - `wellness_days_updated`
  - `wellness_fields_updated`
- The Android result message now includes wellness days/fields updated.

Verification:

- `.\gradlew.bat assembleDebug` passed.
- Installed the debug APK on device `RRCX10685RZ`.
- Opened the app with ADB.

User/device action needed:

1. Grant the new Health Connect permissions when prompted.
2. Tap `Sync last 30 days`.
3. Verify Firebase:
   - `users/{uid}/sync_sources/health_connect/wellness_days_updated`
   - `users/{uid}/sync_sources/health_connect/wellness_fields_updated`
   - `users/{uid}/wellness/{YYYY-MM-DD}` fields.

## 2026-07-07 Android Auto Sync

Goal:

- Add automatic Health Connect sync so the user does not need to open the app every day.

Code changes:

- Added WorkManager dependency:
  - `androidx.work:work-runtime-ktx:2.9.1`
- Added `AutoSyncWorker`.
- Auto sync runs as unique periodic work:
  - work name: `mydash-health-connect-auto-sync`
  - interval: 12 hours
  - constraints: network connected, battery not low
- The worker:
  - uses persisted Firebase Auth current user.
  - skips cleanly if no user is signed in.
  - skips cleanly if Health Connect permissions are missing.
  - calls `HealthConnectSync.syncLast30Days(uid)`.
  - writes auto status to:
    - `users/{uid}/sync_sources/health_connect_auto`
- `MainActivity` schedules auto sync when:
  - app opens and user + permissions are ready.
  - Google sign-in completes.
  - Health Connect permission request returns.
  - manual sync completes.

Verification:

- `.\gradlew.bat assembleDebug` passed.
- Installed APK on device `RRCX10685RZ`.
- Opened app with ADB.
- `dumpsys jobscheduler` showed WorkManager job scheduled for `com.pucca.mydashsync`, next run around `+11h59m`.
- Firebase confirmed:
  - `sync_sources/health_connect_auto/enabled: true`
  - `interval_hours: 12`
  - `last_result: success`
  - latest auto run scanned 11 sessions and skipped existing rows.

Notes:

- WorkManager timing is approximate; Android may delay the run for battery/network policy.
- Manual `Sync last 30 days` remains necessary as a fallback and for immediate refresh.

## 2026-07-07 UI Cleanup And Source Badges

Context:

- User approved continuing the Qwen-derived cleanup plan.
- This pass focused on the safe first slice:
  - remove primary-source language that still said `Firebase + Strava`.
  - add a source badge system.
  - do not remove legacy Strava code.

Code changes:

- Added `sourceMeta()` and `sourceBadge()` helpers in `index.html`.
- Source badge labels:
  - `health_connect` with Garmin source app -> `GARMIN`
  - `health_connect` without Garmin source app -> `HC`
  - `strava_recovered` -> `STRAVA LEGACY`
  - `strava` -> `STRAVA API`
  - missing/other source -> `MANUAL`
- Applied badges to:
  - dashboard recent workouts.
  - statistics monthly workout list.
  - activity detail popup.
  - dashboard weekly activities modal.
- Updated primary-source copy:
  - login banner now mentions MyDash Cloud and Health Connect.
  - Statistics subtitle now mentions MyDash Cloud / Health Connect / DeepSeek.
  - weekly volume note now says MyDash Cloud.
  - AI weekly source note now says MyDash Cloud.
  - Strava analysis card title now says `Advanced Training Load Analysis`.
  - Settings Strava card now says `Legacy Data Archive - Strava API`.
  - legacy Strava connect popup now explains it is recovery-only and not the primary sync path.

Verification:

- `node verify_dashboard.js`
- `python smoke_test_dashboard.py`
- Both passed with no page errors, console errors, or request failures.

User action after GitHub Pages updates:

- Hard refresh MyDash.
- Confirm recent activities show source badges:
  - `GARMIN` / `HC` for Health Connect.
  - `STRAVA LEGACY` for recovered Strava cache.
  - `MANUAL` for manual entries.
- Keep the Strava page as legacy/recovery only unless the user explicitly reactivates Strava API access.

## 2026-07-04 Strava 403 After Accepted Scope

User provided a Strava redirect URL containing:

- `scope=read,activity:read,activity:read_all`

But MyDash still showed:

- `Error: Strava activities list HTTP 403: forbidden. Reconnect Strava and accept activity:read_all, then sync again`

Interpretation:

- The authorization URL did include the correct scope, but the app still needs to verify the token response and activities-list access after exchanging the code.
- The previous error builder hid the real Strava response body for 403, making the next step unclear.

Code changes made:

- Added `stravaNormalizeScope(scope)` to normalize comma/space-separated scopes.
- Added `stravaHasActivityScope(scope)` to verify the exchanged token includes `activity:read` or `activity:read_all`.
- Added `stravaValidateActivityListAccess(token)` to call `GET /api/v3/athlete/activities?per_page=1` immediately after Connect code.
- `stravaConnectCode()` now:
  - checks accepted token scope,
  - validates activities-list access before saving,
  - removes old `strava_token` before saving the new one,
  - saves normalized scope.
- Refresh-token flow also saves normalized scope.
- 403 errors now include Strava's actual API message when available:
  - `Strava says: ...`

Why this matters:

- If Connect code succeeds now, the token is proven to read `/athlete/activities`.
- If it fails during Connect code, the user will see Strava's real 403 message instead of only the generic reconnect hint.

Verification run:

- `node C:\Users\pucca\Dashboard-GitHub\verify_dashboard.js`
- `python C:\Users\pucca\Dashboard-GitHub\smoke_test_dashboard.py`
- Both passed with no page errors, console errors, or request failures.
## 2026-07-12 Garmin Rounded Duplicate Regression

Issue reported with a confirmed duplicate pair:

- `1.33 km / 9 min / HR 112` on `2026-07-09`
- `1.32889 km / 8.9667 min / HR 113` on `2026-07-09`

Root cause:

- The Settings scanner gave only `0.45` time confidence when one source lacked a precise start timestamp.
- Even nearly identical distance and duration could therefore remain below the confirmed-duplicate threshold.

Fix:

- When both records are on the same date, lack comparable precise timestamps, and distance plus duration each score at least `0.8`, the scanner assigns `0.9` date/time confidence.
- Precise timestamps still use the existing five-minute decay rule.
- Cross-source rendering already accepts this pair through the distance/duration tolerance guard.
- Added `duplicateRoundingRegression()` using the exact reported values.

Verification:

- `node verify_dashboard.js` passed.
- `python smoke_test_dashboard.py` passed with no page, console, or request errors.
- Garmin bridge test suite passed `30/30`.
## 2026-07-12 Garmin Direct Production Automation

- Added locked incremental `auto-sync` for activities and all supported wellness domains.
- Added automatic deterministic Firebase CLI writer with read-back verification and metadata-only audit/failure status.
- Added pre-write cross-source dedupe so removed Garmin copies are not recreated.
- Added Garmin SpO2 collection, normalization, Firebase storage, and existing wellness UI merge.
- Installed Windows tasks at 09:00 and 21:00 with missed-run recovery and overlap prevention.
- Live auto-sync succeeded and Firebase returned `automatic:true`, `status:success`, `schema_version:2`.
- Scheduler reports both tasks enabled/Ready; bridge tests pass 37/37 and dashboard regression passes.
- Remaining validation is operational only: observe the first unattended 21:00 and next 09:00 executions and continue a multi-day soak.
