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
const wellnessScriptPath = path.join(root, 'js', 'wellness.js');
const statsScriptPath = path.join(root, 'js', 'stats.js');
const coachScriptPath = path.join(root, 'js', 'coach.js');
const settingsScriptPath = path.join(root, 'js', 'settings.js');
const backupExportScriptPath = path.join(root, 'js', 'backup-export.js');
const racesScriptPath = path.join(root, 'js', 'races.js');
const extraScripts = [
  path.join(root, 'js', 'date-utils.js'),
  path.join(root, 'js', 'ui-core.js'),
  newsAiScriptPath,
  sourcesStravaScriptPath,
  shareCardScriptPath,
  wellnessScriptPath,
  statsScriptPath,
  settingsScriptPath,
  backupExportScriptPath,
  coachScriptPath,
  racesScriptPath,
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
  '<script src="js/date-utils.js"></script>',
  '<script src="js/ui-core.js"></script>',
  '<script src="js/share-card.js"></script>',
  '<script src="js/wellness.js"></script>',
  '<script src="js/stats.js"></script>',
  '<script src="js/news-ai.js"></script>',
  '<script src="js/sources-strava.js"></script>',
  '<script src="js/settings.js"></script>',
  '<script src="js/backup-export.js"></script>',
  '<script src="js/coach.js"></script>',
  '<script src="js/races.js"></script>',
  'function mdToHtml(text)',
  'function duplicateCandidatePairs',
  'function isDuplicateCandidate',
  'out.innerHTML = mdToHtml(reply);',
  '.coach-plan-row',
  '.coach-adaptive-card',
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

ensureContains(coachScriptPath, [
  'function coachTrainingWeekdays',
  'function coachDateForWeekday',
  'function coachDailyDecision',
  'function coachApplyDailyDecisionToPlan',
  'function validateCoachPlan(plan',
  'function buildFallbackTrainingPlan',
  'function coachSessionDetails',
  'function coachSessionDisplayDetails',
  'function coachAdaptiveGuidance',
  'function showCoachSessionDetail',
  'function assertCoachCloudSaved',
  'Cloud save failed. Please sign in again and retry.',
  'Local fallback plan saved',
]);
ensureFunctionCount(coachScriptPath, 'renderCoachDailyDecision', 1);
ensureFunctionCount(coachScriptPath, 'reviewPlanAI', 1);

ensureContains(racesScriptPath, [
  'function coachPlanRaceEntry',
  'function mergeRaceEntries',
  'function getAllRaceEntries',
]);

ensureContains(swPath, [
  "mydash-v3-health-20260708-4",
  './js/date-utils.js',
  './js/ui-core.js',
  './js/share-card.js',
  './js/wellness.js',
  './js/stats.js',
  './js/news-ai.js',
  './js/sources-strava.js',
  './js/settings.js',
  './js/backup-export.js',
  './js/coach.js',
  './js/races.js',
]);

console.log(`Syntax OK: ${inlineCount} inline scripts, ${extraScripts.length} external scripts, manifest, service worker, Apps Script`);
