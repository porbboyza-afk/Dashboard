# MyDash Architecture Refactor Plan

Last updated: 2026-07-10 Asia/Bangkok
Status: Coach/Review V2 implemented and pushed; state, startup, and activity-model boundaries are verified locally before the broader full-app UI redesign.

## Decision

Deliver the user-facing Coach and Post-Run Review improvements before the broad web refactor, but implement them behind new domain boundaries so this work becomes the foundation of the later refactor.

Implementation order:

1. Add a deterministic, multi-distance Training Engine V2.
2. Add versioned plan/session lifecycle and review matching.
3. Integrate through compatibility adapters while preserving the current UI.
4. Keep Coach V1 as a temporary fallback until V2 is verified in production.
5. Refactor the remaining web application around the proven domain boundaries.

## Hard Constraints

- Do not add new Coach domain logic to `index.html`.
- Deterministic code creates and validates plans. AI explains plans and reviews; it is not the source of truth for session structure.
- Support multiple goals and distances rather than embedding 10K-only rules.
- Do not destructively migrate or delete legacy Firebase data.
- Keep `coach_plan` readable during the transition.
- Store V2 plans under versioned IDs and archive plans instead of erasing their history.
- Post-Run Review must distinguish exact, mismatched, unplanned, historical-plan, and no-plan activities.
- Preserve the existing UI and global handler contract until the broader web refactor replaces it.
- Every slice must pass static verification and browser integration tests before deployment or push.

## Current Structural Risks

- `index.html` still combines page markup, rendering, and many global helpers. App state, startup/listeners, and activity normalization have now been extracted.
- Inline `onclick` handlers require global functions and script-order coupling.
- Duplicate function definitions exist; the last loaded definition wins.
- `AppState` and `window._*` aliases create multiple access paths to the same state.
- UI code calls Firebase and AI services directly.
- `coach_plan` is a singleton and cannot represent plan history or revisions.
- Review records can retain summaries from a deleted plan without identifying them as historical.
- Service-worker cache versions are updated manually.

## Target Boundaries

```text
js/domain/training/
  profiles.js
  engine-v2.js

js/domain/review/
  matcher-v2.js

js/services/
  coach-repository.js

index.html / js/coach.js / js/post-run-review.js
  compatibility UI only
```

Later web refactor target:

```text
domain/       Pure training, review, load, and activity rules
services/     Firebase, AI, sync, and backup adapters
state/        Single application state boundary
view-models/  UI-ready summaries derived from domain/state
ui/pages/     Page rendering and event handlers
```

## Coach V2 Contract

- Inputs: goal type, race distance, target time, recent benchmark, recent volume, longest run, available days, long-run day, wellness/readiness, and plan duration.
- Fitness anchors come from current evidence first: benchmark, recent performance, then conservative fallback. Target pace is not treated as current fitness.
- Periodization is composed to fit the available duration. Short plans must not spend most weeks in base/taper while leaving only one build week.
- Workout intent and workout structure are separate fields.
- Sessions include structured work segments, quality distance, total distance, intensity basis, purpose, phase, and stable IDs.
- Distance profiles cover base building, 5K, 10K, half marathon, and marathon initially. More profiles can be added as data instead of rewriting the engine.
- Plan validation covers schedule uniqueness, recovery spacing, race-day/race-eve safety, phase coverage, progressive quality work, weekly volume, and taper reduction.

## Plan Lifecycle

```text
users/{uid}/coach_plans/{planId}
users/{uid}/active_coach_plan_id
users/{uid}/coach_plan                       # compatibility mirror
users/{uid}/post_run_reviews/{workoutId}
```

V2 plan fields include:

- `planId`
- `revisionId`
- `engineVersion`
- `methodologyVersion`
- `status`
- `createdAt`
- `updatedAt`
- `goalProfile`
- `athleteProfile`
- `phaseSchedule`
- `sessions`
- `validation`

Deleting an active plan means setting its status to `archived`, removing `active_coach_plan_id`, and removing only the compatibility mirror. Historical plan records and reviews remain explicit.

## Review Lifecycle

Matching result types:

- `exact`: date and intent/structure are compatible.
- `date_mismatch`: same date but incompatible intent.
- `probable`: nearby compatible session; user confirmation is still required.
- `unplanned`: an active plan exists but no credible session match exists.
- `historical_plan`: saved review references an archived or replaced plan.
- `no_plan`: no active or historical plan applies.

Review facts must store `planId`, `revisionId`, `sessionId`, `matchType`, `factsVersion`, workout revision/hash, and the workout-date context used for analysis. Editing a workout invalidates a stale AI summary.

## Safe Migration Strategy

1. Add V2 files and tests without removing V1.
2. Generate and validate V2 locally.
3. Save V2 to `coach_plans/{planId}` and mirror it to `coach_plan` for the current UI.
4. Read the compatibility mirror until active-plan loading is moved behind a repository.
5. Archive rather than delete V2 records.
6. Keep old backups/restores readable.
7. Remove V1 only after a separate production validation period.

## Verification Gates

- Unit-style deterministic tests for every supported distance and plan duration.
- Golden assertions for phase allocation, progressive workout structure, taper volume, and race-week safety.
- Review tests for exact, mismatched, probable, unplanned, historical, and no-plan cases.
- Existing static verification and Playwright smoke/integration suites.
- Android build when shared data contracts change.
- `git diff --check` and a clean status before push.

## Broader Web Refactor Backlog

- Remove duplicate function definitions one canonical function at a time.
- Move Firebase access behind repositories.
- Replace `window._*` aliases after all consumers use the state boundary.
- Replace inline `onclick` handlers after compatibility exports are no longer required.
- Split page rendering from domain calculations.
- Continue the view-model migration started by `js/training-dashboard-view-model.js`; next candidates are Today Dashboard, Activity Detail, Wellness, and Statistics.
- Add Firebase rules and emulator tests to the repository.
- Add authentication/rate limiting to the AI proxy and remove browser API-key storage.
- Normalize Health Connect, manual, and Strava activities through source adapters.
- Move PWA cache versioning to generated content hashes.
- Add a concise root README and architecture decision records.

## Progress

- [x] Architecture direction approved.
- [x] Coach/Review V2 selected as the first slice.
- [x] Multi-distance Training Engine V2 implemented.
- [x] Versioned plan persistence implemented.
- [x] Review matching V2 implemented.
- [x] Compatibility UI integrated.
- [x] Full verification passed.
- [x] V2 pushed to GitHub (`f26a39c`).
- [x] Broader web refactor started with `js/training-dashboard-view-model.js`.
- [x] Recovery/rest-day model added to Coach Engine V2.
- [x] AppState extracted from `index.html` with legacy aliases preserved.
- [x] Startup settings hydration, Firebase listeners, and UI state subscriptions extracted.
- [x] Activity source, dedupe, and merge rules extracted.
- [x] Today weekly activity, streak, PR, and load-level calculations extracted behind a view model.
- [ ] Remaining pages migrated behind view models.
