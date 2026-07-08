import contextlib
import http.server
import json
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent
PORT = 8124
URL = f"http://127.0.0.1:{PORT}/index.html"
CHROME_CANDIDATES = [
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
]

EXPECTED_SCRIPT_ORDER = [
    "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js",
    "js/date-utils.js",
    "js/ui-core.js",
    "js/share-card.js",
    "js/wellness.js",
    "js/stats.js",
    "js/news-ai.js",
    "js/sources-strava.js",
    "js/settings.js",
    "js/backup-export.js",
    "js/coach.js",
    "js/races.js",
    "js/post-run-review.js",
]

EXPECTED_GLOBALS = [
    "showPage",
    "renderTodayStats",
    "renderRecentWorkouts",
    "renderDashboardExtras",
    "renderDashboardHomeInsights",
    "renderDashboardSyncStatus",
    "renderWellness",
    "renderWellnessAnalytics",
    "calculateReadiness",
    "calculateLoadMetrics",
    "renderCurrentStatsView",
    "renderWeekStats",
    "renderMonthStats",
    "renderStatsInsights",
    "renderNewsChat",
    "renderNewsSidePanel",
    "askNewsAI",
    "askDeepSeek",
    "renderStravaPage",
    "renderSourcesOverview",
    "renderStravaActivities",
    "saveDeepSeekKey",
    "saveStravaSettings",
    "loadAthleteProfile",
    "saveBackupSettings",
    "renderSyncStatus",
    "showShareStatsModal",
    "renderShareCanvas",
    "closeShareStats",
    "updateCoachEndDate",
    "renderCoachTracking",
    "switchCoachTab",
    "renderPostRunReview",
    "openPostRunReview",
    "buildPostRunFacts",
    "mergeRaceEntries",
    "renderRaceList",
]

PAGES = [
    "today",
    "fitness-log",
    "fitness-stats",
    "coach",
    "post-run-review",
    "strava",
    "news",
    "wellness",
    "settings",
]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def find_browser():
    for path in CHROME_CANDIDATES:
        if path.exists():
            return str(path)
    raise FileNotFoundError("No Chrome/Edge executable found")


def assert_true(checks, key, value, message):
    checks[key] = value
    if not value:
        raise AssertionError(message)


def main():
    results = {"page_errors": [], "console_errors": [], "request_failures": [], "checks": {}}
    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(ROOT), **kwargs)
    server = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                executable_path=find_browser(),
                headless=True,
                args=["--disable-gpu", "--no-first-run", "--no-default-browser-check"],
            )
            page = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True)
            page.on("pageerror", lambda exc: results["page_errors"].append(str(exc)))
            page.on(
                "console",
                lambda msg: results["console_errors"].append(f"{msg.type}: {msg.text}")
                if msg.type == "error"
                else None,
            )
            page.on(
                "requestfailed",
                lambda req: results["request_failures"].append(
                    f"{req.method} {req.url} :: {req.failure}"
                ),
            )

            page.goto(URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            checks = results["checks"]
            checks["title"] = page.title()
            assert_true(checks, "title_ok", checks["title"] == "MyDash", "Wrong title")

            script_order = page.evaluate(
                "() => Array.from(document.querySelectorAll('script[src]')).map(s => s.getAttribute('src').split('?')[0])"
            )
            checks["script_order"] = script_order
            assert_true(
                checks,
                "script_order_ok",
                script_order == EXPECTED_SCRIPT_ORDER,
                f"Unexpected script order: {script_order}",
            )

            missing_globals = page.evaluate(
                "(names) => names.filter(name => typeof window[name] !== 'function')",
                EXPECTED_GLOBALS,
            )
            checks["missing_globals"] = missing_globals
            assert_true(checks, "globals_ok", missing_globals == [], f"Missing globals: {missing_globals}")

            missing_onclick_handlers = page.evaluate(
                """
                () => {
                  const names = new Set();
                  document.querySelectorAll('[onclick]').forEach(el => {
                    const code = el.getAttribute('onclick') || '';
                    const match = code.match(/^\\s*([A-Za-z_$][\\w$]*)\\s*\\(/);
                    if (match) names.add(match[1]);
                  });
                  return Array.from(names).filter(name => typeof window[name] !== 'function').sort();
                }
                """
            )
            checks["missing_onclick_handlers"] = missing_onclick_handlers
            assert_true(
                checks,
                "onclick_handlers_ok",
                missing_onclick_handlers == [],
                f"Missing onclick handlers: {missing_onclick_handlers}",
            )

            page.evaluate(
                """
                () => {
                  const workouts = [
                    {_key:'hc-run-1', date:'2026-07-07', type:'run', dist:8.2, time:42, hr:156, cad:172, avgPace:5.12, rpe:6, source:'health_connect', sourceApp:'com.garmin.android.apps.connectmobile', purpose:'tempo'},
                    {_key:'interval-1', date:'2026-07-08', type:'interval', dist:5.8, time:36, hr:164, cad:176, avgPace:0, rpe:8, source:'manual', purpose:'interval', pain:1, interval:{reps:6, repDist:0.4, repPace:'4:15', repHR:170, restTime:1.5, restHR:124, warmup:{dist:1.2,time:8,pace:'6:40'}, cooldown:{dist:1.6,time:11,pace:'6:50'}}},
                    {date:'2026-07-05', type:'run', dist:12.0, time:68, hr:148, cad:168, avgPace:5.67, rpe:5, source:'strava_recovered'},
                    {date:'2026-07-03', type:'bike', dist:22.0, time:55, hr:132, cad:80, avgPace:2.5, rpe:3, source:'manual'}
                  ];
                  const wellness = [
                    {date:'2026-07-07', sleepHours:7.5, restingHR:52, hrv:62, spo2:98, fatigue:3, stress:3, soreness:2, mood:8, weight:66},
                    {date:'2026-07-06', sleepHours:6.2, restingHR:55, hrv:55, spo2:97, fatigue:4, stress:4, soreness:3, mood:7, weight:66.2}
                  ];
                  const coachPlan = {
                    goal:'10K sub 48',
                    startDate:'2026-07-07',
                    endDate:'2026-09-01',
                    totalWeeks:8,
                    completedDates:{},
                    adjustments:[],
                    goalProfile:{distance:'10K', targetTime:'47:59', targetPace:4.798, unavailableRaw:'', unavailable:[]},
                    sessions:[
                      {date:'2026-07-07', type:'Interval', targetDist:6, targetPace:'4:35', targetHR:165, description:'Fast reps', notes:'Fallback structured plan', priority:'key', details:{mainSet:'6 x 400m @ 4:15/km', warmup:'easy', cooldown:'easy'}},
                      {date:'2026-07-08', type:'Interval', targetDist:5.8, targetPace:'4:15', targetHR:170, description:'Interval reps', notes:'Structured interval', priority:'key', details:{mainSet:'6 x 400m @ 4:15/km, rest 90s', warmup:'easy', cooldown:'easy'}},
                      {date:'2026-07-09', type:'Easy', targetDist:5, targetPace:'', targetHR:145, description:'Easy run', notes:'', priority:'normal'}
                    ]
                  };
                  window._workouts = workouts;
                  window._wellness = wellness;
                  window._coachPlan = coachPlan;
                  window._postRunReviews = [];
                  if (window.AppState) {
                    AppState.set('workouts', workouts);
                    AppState.set('wellness', wellness);
                    AppState.set('coachPlan', coachPlan);
                    AppState.set('postRunReviews', []);
                  }
                  localStorage.setItem('mydash-sync-queue', JSON.stringify([{action:'upsert', type:'ping', data:{date:'2026-07-07'}}]));
                }
                """
            )

            for page_id in PAGES:
                page.evaluate("(id) => showPage(id)", page_id)
                page.wait_for_timeout(350)
                active = page.evaluate(
                    "(id) => document.getElementById('page-' + id)?.classList.contains('active')",
                    page_id,
                )
                assert_true(checks, f"page_{page_id}_active", active, f"Page did not activate: {page_id}")

            page.evaluate(
                """
                async () => {
                  showPage('today');
                  renderTodayStats();
                  renderDashboardExtras();
                  await renderDashboardHomeInsights();
                  await renderDashboardSyncStatus();
                  showDashActivities();
                  showPage('fitness-log');
                  renderRecentWorkouts();
                  showPage('fitness-stats');
                  renderCurrentStatsView();
                  switchStatsTab('month');
                  renderMonthStats();
                  switchStatsTab('week');
                  renderWeekStats();
                  await renderStatsInsights();
                  showPage('wellness');
                  renderIntegratedHealth();
                  renderWellness();
                  switchWellnessTab('analytics');
                  renderWellnessAnalytics();
                  showPage('news');
                  renderNewsChat();
                  renderNewsSidePanel();
                  setNewsQ('ทดสอบ');
                  showPage('strava');
                  await renderStravaPage();
                  renderStravaActivities([]);
                  showPage('settings');
                  loadAthleteProfile(window.DEFAULT_ATHLETE_PROFILE || {});
                  renderSyncStatus();
                  showPage('coach');
                  switchCoachTab('track');
                  renderCoachTracking();
                  switchCoachTab('race');
                  window._races = mergeRaceEntries([], window._coachPlan);
                  renderRaceList();
                  openPostRunReview('interval-1');
                  renderPostRunReview();
                  showShareStatsModal();
                  renderShareCanvas();
                  closeShareStats();
                  showPage('today');
                  await renderDashRaceBanner();
                }
                """
            )
            page.wait_for_timeout(1000)

            dom_checks = page.evaluate(
                """
                () => ({
                  noHorizontalOverflow: document.body.scrollWidth <= window.innerWidth + 2,
                  recentWorkoutCards: document.querySelectorAll('#recent-workouts-list .workout-row').length,
                  wellnessCards: document.querySelectorAll('#wellness-list .workout-row').length,
                  statsCanvasExists: !!document.querySelector('#hrzone-chart, #pace-trend-chart, canvas'),
                  coachPlanDays: document.querySelectorAll('.plan-day').length,
                  postRunRows: document.querySelectorAll('#postrun-workout-list .postrun-activity-row').length,
                  postRunBody: !!document.querySelector('#postrun-review-body .postrun-hero'),
                  raceCards: document.querySelectorAll('#race-list-container .card').length,
                  raceBannerFullRow: (() => {
                    const banner = document.querySelector('#dash-race-banner');
                    const parent = banner?.parentElement;
                    if (!banner || !parent || getComputedStyle(banner).display === 'none') return false;
                    const bannerRect = banner.getBoundingClientRect();
                    const parentRect = parent.getBoundingClientRect();
                    return bannerRect.width >= parentRect.width * 0.9;
                  })(),
                  newsPanelExists: !!document.querySelector('.news-side') && !!document.querySelector('#news-sources'),
                  sourcesPageExists: !!document.querySelector('#strava-page-content, #strava-status-box'),
                  syncStatusRendered: !!document.querySelector('#gas-status'),
                  shareOverlayClosed: document.getElementById('share-stats-overlay')?.style.display === 'none'
                })
                """
            )
            checks["dom"] = dom_checks
            for key, value in dom_checks.items():
                assert_true(checks, f"dom_{key}", bool(value), f"DOM check failed: {key}")

            wellness_edit_rules = page.evaluate(
                """
                () => {
                  const existing = {date:'2026-07-08', sleepHours:6.5, hrv:52, restingHR:48, source:'health_connect', createdAt:1000};
                  const formEntry = {date:'2026-07-08', sleepHours:null, hrv:null, restingHR:null, fatigue:4, soreness:1, bodyFat:18.2, healthStatus:'normal', note:'manual check'};
                  const merged = mergeWellnessEntry(existing, formEntry);
                  AppState.set('wellness', [{...merged, _key:'2026-07-08'}]);
                  loadWellnessToForm('2026-07-08');
                  return {
                    sleepPreserved: merged.sleepHours === 6.5,
                    hrvPreserved: merged.hrv === 52,
                    sourcePreserved: merged.source === 'health_connect',
                    manualFatigueSaved: merged.fatigue === 4,
                    bodyFatSaved: merged.bodyFat === 18.2,
                    manualFlag: merged.manualOverride === true,
                    formBodyFat: document.getElementById('w-body-fat')?.value,
                    formSleep: document.getElementById('w-sleep-hours')?.value
                  };
                }
                """
            )
            checks["wellness_edit_rules"] = wellness_edit_rules
            assert_true(checks, "wellness_preserve_sync_ok", wellness_edit_rules["sleepPreserved"] is True and wellness_edit_rules["hrvPreserved"] is True and wellness_edit_rules["sourcePreserved"] is True, "Manual wellness merge did not preserve synced fields")
            assert_true(checks, "wellness_manual_fields_ok", wellness_edit_rules["manualFatigueSaved"] is True and wellness_edit_rules["bodyFatSaved"] is True and wellness_edit_rules["manualFlag"] is True, "Manual wellness fields were not saved")
            assert_true(checks, "wellness_edit_form_ok", wellness_edit_rules["formBodyFat"] == "18.2" and wellness_edit_rules["formSleep"] == "6.5", "Wellness edit form did not preload existing values")

            interval_edit_rules = page.evaluate(
                """
                () => {
                  window._workouts = [{
                    _key:'interval-test-1',
                    date:'2026-07-08',
                    type:'interval',
                    dist:5.2,
                    time:36.5,
                    hr:172,
                    interval:{
                      reps:6,
                      repDist:0.4,
                      repPace:'4:15',
                      repHR:172,
                      restTime:1.5,
                      restHR:135,
                      warmup:{dist:1.2,time:8,pace:'6:40'},
                      cooldown:{dist:1.6,time:11,pace:'6:50'},
                      totalTime:36.5
                    },
                    splits:[{km:1,pace:'6:40',hr:130}]
                  }];
                  editWorkout('interval-test-1');
                  return {
                    type: document.getElementById('f-type')?.value,
                    reps: document.getElementById('iv-reps')?.value,
                    repDist: document.getElementById('iv-rep-dist')?.value,
                    repPace: document.getElementById('iv-rep-pace')?.value,
                    restTime: document.getElementById('iv-rest-time')?.value,
                    warmupDist: document.getElementById('iv-wu-dist')?.value,
                    cooldownDist: document.getElementById('iv-cd-dist')?.value,
                    intervalPanelVisible: document.getElementById('fields-interval')?.style.display !== 'none',
                    saveButton: document.getElementById('workout-save-btn')?.textContent || ''
                  };
                }
                """
            )
            checks["interval_edit_rules"] = interval_edit_rules
            assert_true(checks, "interval_edit_preload_ok", interval_edit_rules["type"] == "interval" and interval_edit_rules["reps"] == "6" and interval_edit_rules["repDist"] == "0.4" and interval_edit_rules["repPace"] == "4:15", "Interval edit did not preload main set")
            assert_true(checks, "interval_edit_extras_ok", interval_edit_rules["restTime"] == "1.5" and interval_edit_rules["warmupDist"] == "1.2" and interval_edit_rules["cooldownDist"] == "1.6" and interval_edit_rules["intervalPanelVisible"] is True, "Interval edit did not preserve rest/warmup/cooldown")

            post_run_rules = page.evaluate(
                """
                () => {
                  const workout = {
                    _key:'postrun-interval-1',
                    date:'2026-07-08',
                    type:'interval',
                    dist:5.8,
                    time:36,
                    hr:164,
                    rpe:8,
                    pain:1,
                    purpose:'interval',
                    interval:{reps:6, repDist:0.4, repPace:'4:15', restTime:1.5}
                  };
                  window._workouts = [workout];
                  window._coachPlan = {
                    goal:'10K sub 48',
                    goalProfile:{distance:'10K', targetTime:'47:59', targetPace:4.798, unavailableRaw:'', unavailable:[]},
                    sessions:[{date:'2026-07-08', type:'Interval', targetDist:5.8, targetPace:'4:15', targetHR:170, details:{mainSet:'6 x 400m @ 4:15/km'}}]
                  };
                  AppState.set('workouts', [workout]);
                  AppState.set('coachPlan', window._coachPlan);
                  AppState.set('wellness', [{date:'2026-07-08', sleepHours:7.2, restingHR:50, hrv:60, soreness:1}]);
                  const facts = buildPostRunFacts(workout);
                  openPostRunReview('postrun-interval-1');
                  return {
                    key: postRunWorkoutKey(workout),
                    matchScore: facts.planMatch.score,
                    targetType: facts.planMatch.session?.type,
                    distDelta: facts.targetComparison.distDeltaPct,
                    paceDelta: facts.targetComparison.paceDelta?.seconds,
                    intervalReps: facts.intervalAnalysis?.reps,
                    intervalPlan: facts.intervalAnalysis?.plannedMainSet || '',
                    highRpeFlag: facts.riskFlags.includes('high_rpe'),
                    pageActive: document.getElementById('page-post-run-review')?.classList.contains('active'),
                    bodyRendered: !!document.querySelector('#postrun-review-body .postrun-hero')
                  };
                }
                """
            )
            checks["post_run_rules"] = post_run_rules
            assert_true(checks, "post_run_match_ok", post_run_rules["matchScore"] == 100 and post_run_rules["targetType"] == "Interval", "Post-run review did not match the planned interval session")
            assert_true(checks, "post_run_comparison_ok", post_run_rules["distDelta"] == 0 and post_run_rules["paceDelta"] == 0, "Post-run target comparison is wrong")
            assert_true(checks, "post_run_interval_schema_ok", post_run_rules["intervalReps"] == 6 and "400m" in post_run_rules["intervalPlan"], "Post-run intervalAnalysis schema is missing planned/actual interval data")
            assert_true(checks, "post_run_render_ok", post_run_rules["pageActive"] is True and post_run_rules["bodyRendered"] is True, "Post-run review page did not render selected workout")

            duplicate_rules = page.evaluate(
                """
                () => {
                  const oldWorkouts = window._workouts;
                  const oldStravaWorkouts = window._stravaWorkouts;
                  window._workouts = [
                    {_key:'garmin-1', date:'2026-07-08', type:'run', dist:10.08, time:3120, source:'health_connect', sourceApp:'Garmin Connect'}
                  ];
                  window._stravaWorkouts = [
                    {_key:'strava-1', date:'2026-07-08', type:'run', dist:10.01, time:3135, source:'strava'}
                  ];
                  const pairs = duplicateCandidatePairs();
                  const all = getAllActivities();
                  const primary = all.find(w => w.source === 'health_connect');
                  window._workouts = oldWorkouts;
                  window._stravaWorkouts = oldStravaWorkouts;
                  return {
                    pairCount: pairs.length,
                    primarySource: pairs[0]?.primary?.source,
                    duplicateSource: pairs[0]?.duplicate?.source,
                    possibleCount: primary?._possibleDuplicates?.length || 0,
                    possibleSource: primary?._possibleDuplicates?.[0]?.source || ''
                  };
                }
                """
            )
            checks["duplicate_rules"] = duplicate_rules
            assert_true(checks, "duplicate_candidate_detected", duplicate_rules["pairCount"] == 1 and duplicate_rules["primarySource"] == "health_connect" and duplicate_rules["duplicateSource"] == "strava", "Fuzzy duplicate candidate was not detected with Garmin primary")
            assert_true(checks, "duplicate_candidate_attached", duplicate_rules["possibleCount"] == 1 and duplicate_rules["possibleSource"] == "strava", "Possible duplicate was not attached to primary activity")

            coach_plan_rules = page.evaluate(
                """
                () => {
                  const goalProfile = {distance:'10K', targetTime:'47:59', targetPace:4.798, unavailableRaw:'', unavailable:[], longRunDay:'0', longRunDayName:'Sun'};
                  const plan = buildFallbackTrainingPlan({
                    goal:'10K sub 48',
                    startDate:'2026-07-08',
                    endDate:'2026-08-02',
                    totalWeeks:4,
                    days:'4',
                    context:{goalProfile},
                    level:'intermediate'
                  });
                  const longDays = plan.sessions.filter(s => s.type === 'Long').map(s => new Date(s.date + 'T12:00:00').getDay());
                  const movePlan = {
                    goalProfile:{distance:'10K', targetTime:'47:59', targetPace:4.798, unavailableRaw:'2026-07-09', unavailable:['2026-07-09'], longRunDay:'0', longRunDayName:'Sun'},
                    endDate:'2026-08-02',
                    sessions:[{date:'2026-07-09', type:'Easy', targetDist:5, targetPace:''}]
                  };
                  const moveDecision = coachDailyDecision(movePlan, '2026-07-09');
                  const moved = coachApplyDailyDecisionToPlan(movePlan, moveDecision);
                  const hardPlan = {
                    goalProfile:{distance:'10K', targetTime:'47:59', targetPace:4.798, unavailableRaw:'', unavailable:[], longRunDay:'0', longRunDayName:'Sun'},
                    endDate:'2026-08-02',
                    sessions:[{date:'2026-07-10', type:'Interval', targetDist:8, targetPace:'4:30'}]
                  };
                  const downgraded = coachApplyDailyDecisionToPlan(hardPlan, {date:'2026-07-10', action:'downgrade', status:'yellow', readinessScore:58, reasons:['test']});
                  const duplicateDatePlan = validateCoachPlan({
                    goal:'10K sub 48',
                    startDate:'2026-07-08',
                    endDate:'2026-08-02',
                    totalWeeks:4,
                    sessions:[
                      {date:'2026-07-21', type:'Easy', targetDist:4.4, priority:'normal'},
                      {date:'2026-07-21', type:'Tempo', targetDist:5.5, priority:'key'},
                      {date:'2026-07-23', type:'Easy', targetDist:5, priority:'normal'}
                    ]
                  }, {goal:'10K sub 48', startDate:'2026-07-08', endDate:'2026-08-02', totalWeeks:4, goalProfile});
                  const duplicateDateRows = duplicateDatePlan.sessions.filter(s => s.date === '2026-07-21');
                  const guardedPrompt = coachApplyPromptDateGuard('Rules\\n- No hard sessions on consecutive days.\\nEnd but never put a workout on Race/GoalDate.', '4');
                  return {
                    sleepFull: formatSleepHours(4.9),
                    sleepCompact: formatSleepHours(4.9, {compact:true}),
                    hasRaceDayWorkout: plan.sessions.some(s => s.date === '2026-08-02'),
                    duplicateDateCount: duplicateDateRows.length,
                    duplicateDateKeptType: duplicateDateRows[0]?.type,
                    promptHasOnePerDateRule: guardedPrompt.includes('Never schedule two workouts on the same YYYY-MM-DD') && guardedPrompt.includes('one session maximum per date'),
                    longRunDayOk: longDays.length > 0 && longDays.every(day => day === 0),
                    unavailableAction: moveDecision.action,
                    movedOffUnavailable: moved.plan.sessions[0].date !== '2026-07-09',
                    movedBeforeRace: moved.plan.sessions[0].date < '2026-08-02',
                    movedDailyDecisionSaved: !!moved.plan.dailyDecisions['2026-07-09']?.appliedAt,
                    downgradeType: downgraded.plan.sessions[0].type,
                    downgradeReduced: downgraded.plan.sessions[0].targetDist < 8,
                    downgradeAdjustment: downgraded.adjustment.type,
                    downgradeGoalRisk: downgraded.adjustment.goalImpact.goalRisk,
                    goalImpactSaved: !!downgraded.plan.dailyDecisions['2026-07-10'].goalImpact?.goal
                  };
                }
                """
            )
            checks["coach_plan_rules"] = coach_plan_rules
            assert_true(checks, "sleep_format_full_ok", coach_plan_rules["sleepFull"] == "4 ชม. 54 นาที", "Sleep full format is wrong")
            assert_true(checks, "sleep_format_compact_ok", coach_plan_rules["sleepCompact"] == "4ชม 54น", "Sleep compact format is wrong")
            assert_true(checks, "no_race_day_workout", coach_plan_rules["hasRaceDayWorkout"] is False, "Plan contains a workout on race day")
            assert_true(checks, "coach_no_duplicate_dates", coach_plan_rules["duplicateDateCount"] == 1 and coach_plan_rules["duplicateDateKeptType"] == "Tempo", "Coach plan did not collapse same-date duplicate sessions")
            assert_true(checks, "coach_prompt_date_guard", coach_plan_rules["promptHasOnePerDateRule"] is True, "Coach AI prompt is missing one-session-per-date guard")
            assert_true(checks, "long_run_day_ok", coach_plan_rules["longRunDayOk"] is True, "Long run day preference was not respected")
            assert_true(checks, "daily_move_action_ok", coach_plan_rules["unavailableAction"] == "move", "Unavailable day did not trigger move")
            assert_true(checks, "daily_move_saved_ok", coach_plan_rules["movedOffUnavailable"] is True and coach_plan_rules["movedBeforeRace"] is True and coach_plan_rules["movedDailyDecisionSaved"] is True, "Daily move was not applied/saved safely")
            assert_true(checks, "daily_downgrade_ok", coach_plan_rules["downgradeType"] == "Easy" and coach_plan_rules["downgradeReduced"] is True and coach_plan_rules["downgradeAdjustment"] == "auto_downgrade", "Hard day was not downgraded")
            assert_true(checks, "daily_goal_impact_ok", coach_plan_rules["downgradeGoalRisk"] == "medium" and coach_plan_rules["goalImpactSaved"] is True, "Goal impact was not saved")

            no_plan_training_text = page.evaluate(
                """
                () => {
                  const plan = {
                    goal:'10km นายช้อย',
                    startDate:'2026-07-07',
                    endDate:'2026-11-15',
                    totalWeeks:18,
                    createdAt:123,
                    goalProfile:{distance:'10K', targetTime:'47:59', targetPace:4.798, unavailableRaw:'', unavailable:[]},
                    sessions:[]
                  };
                  const oldWorkouts = [
                    {date:'2026-06-20', type:'run', dist:10, time:63, avgPace:6.3, source:'health_connect'},
                    {date:'2026-06-25', type:'run', dist:8, time:50, avgPace:6.25, source:'health_connect'}
                  ];
                  window._workouts = oldWorkouts;
                  window._coachPlan = plan;
                  if (window.AppState) {
                    AppState.set('workouts', oldWorkouts);
                    AppState.set('coachPlan', plan);
                  }
                  showPage('coach');
                  switchCoachTab('race');
                  window._races = mergeRaceEntries([], plan);
                  renderRaceList();
                  return document.querySelector('#race-list-container')?.innerText || '';
                }
                """
            )
            checks["race_no_plan_training_text"] = no_plan_training_text
            assert_true(
                checks,
                "race_not_ready_before_plan_training",
                "พร้อมมาก" not in no_plan_training_text and "ยังไม่เริ่มซ้อมตามแผน" in no_plan_training_text,
                "Race tab should not mark the user as highly ready before plan training starts",
            )

            browser.close()
    finally:
        with contextlib.suppress(Exception):
            server.shutdown()
        with contextlib.suppress(Exception):
            server.server_close()

    critical_console = [item for item in results["console_errors"] if "favicon" not in item.lower()]
    if results["page_errors"] or critical_console:
        raise AssertionError(
            json.dumps(
                {
                    "page_errors": results["page_errors"],
                    "console_errors": critical_console,
                    "request_failures": results["request_failures"],
                },
                ensure_ascii=False,
                indent=2,
            )
        )

    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False, indent=2))
        raise SystemExit(1)
