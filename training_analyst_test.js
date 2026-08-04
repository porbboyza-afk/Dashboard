const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const state = {
  wellness: [{ date: '2026-07-18', sleepHours: 7.5, restingHR: 49, hrv: 62, stress: 3 }],
  coachPlan: { sessions: [{ date: '2026-07-18', type: 'Easy', targetDist: 7, targetPace: '5:50-6:10' }] },
  trainingAnalyses: {}
};
const activities = [{
  _key: 'garmin_1', source: 'garmin', sourceId: '1', date: '2026-07-18', type: 'run', dist: 7,
  time: 43, avgPace: 6.14, hr: 137, weather: 'hot', temperature: 33, surface: 'road'
}];
const window = {
  AppState: { get: key => state[key] },
  getAllActivities: () => activities,
  sessionTypeFromProfile: () => ({ type: 'easy', confidence: 61 }),
  getAthleteProfile: () => ({}),
  _fb: { setData: async (key, value) => { state.trainingAnalyses[key.split('/').at(-1)] = value; } }
};
const context = { window, console, Date, JSON, Math, Number, String, Object, Array, Promise, setTimeout, clearTimeout };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'js', 'training-analyst.js'), 'utf8'), context, { filename: 'training-analyst.js' });

const analyst = window.MyDashTrainingAnalyst;
assert.ok(analyst, 'exposes central analyst');
const key = analyst.activityKey(activities[0]);
assert.ok(!/[.#$/\[\]]/.test(key), 'uses a Firebase-safe activity key');

const automatic = analyst.classification(activities[0]);
assert.equal(automatic.type, 'easy', 'falls back to profile classification');
assert.equal(automatic.confirmed, false, 'automatic result is not user-confirmed');

const contextFacts = analyst.contextActivity(activities[0]);
assert.equal(contextFacts.weather, 'hot / 33C / road', 'preserves recorded weather context');
assert.equal(contextFacts.plannedSessions[0].type, 'Easy', 'includes nearby Coach context');

const expandedActivities = Array.from({ length: 20 }, (_, index) => ({
  _key: `garmin_month_${index}`,
  source: 'garmin', sourceId: `month_${index}`, date: `2026-07-${String((index % 20) + 1).padStart(2, '0')}`,
  type: 'run', dist: 5 + index / 2, time: 30 + index, avgPace: 6, hr: 145, cad: 168
}));
const compact = analyst.compactPeriodSummary(expandedActivities);
assert.equal(compact.activityCount, 20, 'monthly summary keeps the activity count');
assert.ok(compact.weekly.length > 0, 'monthly summary aggregates sessions by week');
assert.ok(compact.keySessions.length <= 10, 'monthly summary caps detailed sessions');
assert.equal(compact.omittedSessionCount, 20 - compact.keySessionCount, 'monthly summary reports omitted sessions');

(async () => {
  await analyst.setOverride(key, 'tempo');
  const overridden = analyst.classification(activities[0]);
  assert.equal(overridden.type, 'tempo', 'user override wins over auto classification');
  assert.equal(overridden.confirmed, true, 'user override is confirmed');
  console.log('Training Analyst tests passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
