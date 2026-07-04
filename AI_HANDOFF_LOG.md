# AI Handoff Log

Last updated: 2026-07-04 00:00 Asia/Bangkok

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

User action needed after GitHub Pages updates:

- Hard refresh MyDash.
- Go to Settings and confirm Strava Client ID, Client Secret, and Redirect URI are saved.
- On Strava page, Disconnect old token.
- Connect again via `Open Strava auth`, accept all requested scopes, paste the returned `code`, then sync.

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
