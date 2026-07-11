const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
const indexPath = path.join(root, 'index.html');
const manifestPath = path.join(root, 'manifest.json');
const swPath = path.join(root, 'sw.js');
const appsScriptPath = path.join(root, 'apps-script', 'Code.gs');
const newsAiScriptPath = path.join(root, 'js', 'news-ai.js');
const sourcesStravaScriptPath = path.join(root, 'js', 'sources-strava.js');
const shareCardScriptPath = path.join(root, 'js', 'share-card.js');
const appStateScriptPath = path.join(root, 'js', 'app-state.js');
const appBootstrapScriptPath = path.join(root, 'js', 'app-bootstrap.js');
const activityModelScriptPath = path.join(root, 'js', 'activity-model.js');
const todayDashboardViewModelScriptPath = path.join(root, 'js', 'today-dashboard-view-model.js');
const wellnessScriptPath = path.join(root, 'js', 'wellness.js');
const statsScriptPath = path.join(root, 'js', 'stats.js');
const coachScriptPath = path.join(root, 'js', 'coach.js');
const postRunReviewScriptPath = path.join(root, 'js', 'post-run-review.js');
const studioHomeScriptPath = path.join(root, 'js', 'studio-home.js');
const studioCoachScriptPath = path.join(root, 'js', 'studio-coach.js');
const chartDataScriptPath = path.join(root, 'js', 'chart-data.js');
const chartSemanticsScriptPath = path.join(root, 'js', 'chart-semantics.js');
const trainingProfilesScriptPath = path.join(root, 'js', 'domain', 'training', 'profiles.js');
const trainingEngineScriptPath = path.join(root, 'js', 'domain', 'training', 'engine-v2.js');
const trainingDashboardVmScriptPath = path.join(root, 'js', 'training-dashboard-view-model.js');
const reviewMatcherScriptPath = path.join(root, 'js', 'domain', 'review', 'matcher-v2.js');
const coachRepositoryScriptPath = path.join(root, 'js', 'services', 'coach-repository.js');
const settingsScriptPath = path.join(root, 'js', 'settings.js');
const backupExportScriptPath = path.join(root, 'js', 'backup-export.js');
const racesScriptPath = path.join(root, 'js', 'races.js');
const extraScripts = [
  path.join(root, 'js', 'date-utils.js'),
  path.join(root, 'js', 'ui-core.js'),
  appStateScriptPath,
  appBootstrapScriptPath,
  activityModelScriptPath,
  todayDashboardViewModelScriptPath,
  newsAiScriptPath,
  sourcesStravaScriptPath,
  shareCardScriptPath,
  wellnessScriptPath,
  statsScriptPath,
  settingsScriptPath,
  backupExportScriptPath,
  trainingProfilesScriptPath,
  trainingEngineScriptPath,
  coachRepositoryScriptPath,
  trainingDashboardVmScriptPath,
  coachScriptPath,
  racesScriptPath,
  reviewMatcherScriptPath,
  postRunReviewScriptPath,
  studioHomeScriptPath,
  studioCoachScriptPath,
  chartDataScriptPath,
  chartSemanticsScriptPath,
];

function checkJsFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  new vm.Script(code, { filename: path.basename(filePath) });
}

function checkHtmlInlineScripts(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const regex = /<script\b(?![^>]*\btype\s*=\s*["']module["'])[^>]*>([\s\S]*?)<\/script>/gi;
  let count = 0;
  for (const match of html.matchAll(regex)) {
    const code = match[1].trim();
    if (!code) continue;
    new vm.Script(code, { filename: `inline_${count}.js` });
    count += 1;
  }
  return count;
}

function ensureContains(filePath, snippets) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const snippet of snippets) {
    if (!text.includes(snippet)) {
      throw new Error(`Missing snippet in ${path.basename(filePath)}: ${snippet}`);
    }
  }
}

function ensureFunctionCount(filePath, functionName, expectedCount) {
  const text = fs.readFileSync(filePath, 'utf8');
  const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = text.match(new RegExp(`function\\s+${escaped}\\s*\\(`, 'g')) || [];
  if (matches.length !== expectedCount) {
    throw new Error(`${path.basename(filePath)} expected ${expectedCount} ${functionName} definition(s), found ${matches.length}`);
  }
}

const inlineCount = checkHtmlInlineScripts(indexPath);
checkJsFile(swPath);
for (const scriptPath of extraScripts) {
  checkJsFile(scriptPath);
}

JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
checkJsFile(appsScriptPath);

ensureContains(indexPath, [
  '<link rel="stylesheet" href="app-redesign.css?v=20260711-1">',
  '<link rel="stylesheet" href="training-studio-ui.css?v=20260711-1">',
  '<link rel="stylesheet" href="studio-shell.css?v=20260711-1">',
  '<link rel="stylesheet" href="studio-surfaces.css?v=20260711-1">',
  'class="workspace-topbar"',
  '<script src="js/date-utils.js"></script>',
  '<script src="js/ui-core.js"></script>',
  '<script src="js/app-state.js"></script>',
  '<script src="js/app-bootstrap.js"></script>',
  '<script src="js/activity-model.js"></script>',
  '<script src="js/today-dashboard-view-model.js"></script>',
  '<script src="js/share-card.js"></script>',
  '<script src="js/wellness.js"></script>',
  '<script src="js/stats.js"></script>',
  '<script src="js/news-ai.js"></script>',
  '<script src="js/sources-strava.js"></script>',
  '<script src="js/settings.js"></script>',
  '<script src="js/backup-export.js"></script>',
  '<script src="js/domain/training/profiles.js"></script>',
  '<script src="js/domain/training/engine-v2.js"></script>',
  '<script src="js/services/coach-repository.js"></script>',
  '<script src="js/coach.js"></script>',
  '<script src="js/races.js"></script>',
  '<script src="js/domain/review/matcher-v2.js"></script>',
  '<script src="js/post-run-review.js"></script>',
  '<script src="js/studio-home.js"></script>',
  '<script src="js/studio-coach.js"></script>',
  '<script src="js/chart-data.js"></script>',
  '<script src="js/chart-semantics.js"></script>',
  'id="page-post-run-review"',
  'function mdToHtml(text)',
  'out.innerHTML = mdToHtml(reply);',
  '.coach-plan-row',
  '.coach-adaptive-card',
]);

ensureContains(swPath, [
  'mydash-v3-training-studio-ui-20260711-10',
  './app-redesign.css?v=20260711-1',
  './training-studio-ui.css?v=20260711-1',
  './studio-shell.css?v=20260711-1',
  './studio-surfaces.css?v=20260711-1',
  './js/studio-home.js',
  './js/studio-coach.js',
]);

ensureContains(shareCardScriptPath, [
  'function showShareStatsModal',
  'function renderShareCanvas',
  'function downloadShareCard',
  'async function shareCard',
]);

ensureContains(wellnessScriptPath, [
  'function formatSleepHours',
  'function loadWellnessToForm',
  'function mergeWellnessEntry',
  'function calculateReadiness',
  'function calculateLoadMetrics',
  'function renderIntegratedHealth',
  'async function saveWellness',
  'function renderWellness',
  'function renderWellnessAnalytics',
]);

ensureContains(statsScriptPath, [
  'function renderWeekStats',
  'function renderMonthStats',
  'async function renderStatsInsights',
  'function renderStatsEfficiencyChart',
  'async function analyzeFitnessAI',
]);

ensureContains(newsAiScriptPath, [
  'function renderNewsSidePanel',
  'async function callNewsChat',
  'async function askNewsAI',
  'async function askDeepSeek',
  'NEWS_SYSTEM_PROMPT',
]);

ensureContains(sourcesStravaScriptPath, [
  'const STRAVA_API',
  'async function stravaSync',
  'function stravaBuildHttpError',
  'async function renderStravaPage',
  'function renderSourcesOverview',
  'function renderStravaActivities',
]);

ensureContains(settingsScriptPath, [
  'async function saveDeepSeekKey',
  'async function saveStravaSettings',
  'function loadAthleteProfile',
  'async function saveAthleteProfile',
]);

ensureContains(backupExportScriptPath, [
  'const DEFAULT_GAS_URL',
  'async function sendSheetsBackup',
  'async function syncAllToSheets',
  'async function exportMyDashJSON',
  'function exportActivitiesCSV',
  'async function restoreMyDashJSON',
]);

ensureContains(appStateScriptPath, [
  'DEFAULT_AI_PROXY_URL',
  'root.AppState = AppState',
  'Object.defineProperties(root',
  '_coachPlan',
]);

ensureContains(appBootstrapScriptPath, [
  'function startRealtimeListeners',
  'function appReady',
  'function registerUiSubscriptions',
  'root._appReady = appReady',
  'MyDashCoachRepository?.loadActivePlan',
]);

ensureContains(activityModelScriptPath, [
  'function getAllActivities',
  'function duplicateCandidatePairs',
  'function isDuplicateCandidate',
  'function sourceMeta',
  'Object.assign(root',
]);

ensureContains(todayDashboardViewModelScriptPath, [
  'function build',
  'weeklyActivityCount',
  'weeklyDistanceKm',
  'root.MyDashTodayDashboard',
]);

ensureContains(coachScriptPath, [
  'function updateCoachGoalDefaults',
  'MyDashTraining.EngineV2.createPlan',
  "athleteSettings:typeof getAthleteProfile==='function'",
  'MyDashCoachRepository.savePlan',
  'function coachTrainingWeekdays',
  'function coachDateForWeekday',
  'function coachPhaseForWeek',
  'function coachPhaseSchedule',
  'function coachDailyDecision',
  'function coachRecoveryCardForDate',
  'function renderCoachPlanInsights',
  'function coachApplyDailyDecisionToPlan',
  'function validateCoachPlan(plan',
  'function dedupeCoachSessionsByDate',
  'function coachApplyPromptDateGuard',
  'function coachApplyPhaseRule',
  'function buildFallbackTrainingPlan',
  'function coachSessionDetails',
  'function coachSessionDisplayDetails',
  'function coachAdaptiveGuidance',
  'coach-recovery-card',
  'MyDashTrainingDashboard.build',
  'function showCoachSessionDetail',
  'function assertCoachCloudSaved',
  'Cloud save failed. Please sign in again and retry.',
  'Training Engine V2',
  'archivePlan(plan)',
]);
ensureFunctionCount(coachScriptPath, 'renderCoachDailyDecision', 1);
ensureFunctionCount(coachScriptPath, 'reviewPlanAI', 1);

ensureContains(postRunReviewScriptPath, [
  'function renderPostRunReview',
  'function openPostRunReview',
  'function buildPostRunFacts',
  'function generatePostRunAIReview',
  'intervalAnalysis',
  'post_run_reviews',
  'postRunLoadAsOf',
  'MyDashReviewMatcher',
]);

ensureContains(trainingProfilesScriptPath, [
  'METHODOLOGY_VERSION',
  "'5K'",
  "'10K'",
  'Half:',
  'Marathon:',
  'normalizeProfileKey',
]);

ensureContains(trainingEngineScriptPath, [
  'ENGINE_VERSION=2',
  'function allocatePhases',
  'function buildAthleteModel',
  'function easyPaceEvidence',
  'function recoveryAdvice',
  'function isRecoveryRunSlot',
  'recoveryCards',
  'session_on_unavailable_date',
  'inputAudit',
  'function qualitySpec',
  'function createPlan',
  'function validatePlan',
  'workoutSpec',
  'methodologyVersion',
]);

ensureContains(trainingDashboardVmScriptPath, [
  'MyDashTrainingDashboard',
  'function build',
  'function sessionIntensity',
  'recoverySummary',
]);

ensureContains(reviewMatcherScriptPath, [
  'FACTS_VERSION=2',
  'function matchWorkout',
  "'date_mismatch'",
  "'historical_plan'",
  "'no_plan'",
  'function factsHash',
]);

ensureContains(coachRepositoryScriptPath, [
  'coach_plans/',
  'active_coach_plan_id',
  'async function savePlan',
  'async function archivePlan',
]);

ensureContains(racesScriptPath, [
  'function coachPlanRaceEntry',
  'function mergeRaceEntries',
  'function getAllRaceEntries',
]);

ensureContains(swPath, [
  "mydash-v3-training-studio-ui-20260711-10",
  './js/training-dashboard-view-model.js',
  './js/date-utils.js',
  './js/ui-core.js',
  './js/app-state.js',
  './js/app-bootstrap.js',
  './js/activity-model.js',
  './js/today-dashboard-view-model.js',
  './js/share-card.js',
  './js/wellness.js',
  './js/stats.js',
  './js/news-ai.js',
  './js/sources-strava.js',
  './js/settings.js',
  './js/backup-export.js',
  './js/domain/training/profiles.js',
  './js/domain/training/engine-v2.js',
  './js/services/coach-repository.js',
  './js/coach.js',
  './js/races.js',
  './js/domain/review/matcher-v2.js',
  './js/post-run-review.js',
]);

console.log(`Syntax OK: ${inlineCount} inline scripts, ${extraScripts.length} external scripts, manifest, service worker, Apps Script`);
