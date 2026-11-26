import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildModel, normalizeActivity} from './src/domain/model.mjs';
import {activityDetail, intervalDetail} from './src/features/activities.mjs';
import {home} from './src/features/home.mjs';
import {health} from './src/features/overview.mjs';

const track = {points: [{lat: 13, lng: 100}, {lat: 13.01, lng: 100.01}]};
const run = {
  date: '2026-11-17', type: 'run', source: 'intervals', sourceId: 'demo', dist: 5.716, time: 34.9,
  splits: [1, 2, 3, 4, 5, 6].map(km => ({km, ...(km === 6 ? {dist: 0.72} : {}), pace: '6:00', paceSec: 360})),
  intervalsDetail: {name: 'Test run', maxHr: 180, trainingLoad: 45, elevationGain: 12, calories: 230, hrZoneTimes: [0, 120]},
};

test('an imported route and six kilometre splits render together', () => {
  const data = {workouts: {demo: run}, activity_details: {intervals_demo: {source: 'intervals', track}}};
  const model = buildModel({data});
  const [activity] = model.rawActivities;
  assert.equal(activity.route.length, 2);
  assert.equal(activity.laps.length, 6);
  assert.equal(activity.lapKind, 'intervals-kilometer-splits');
  assert.equal(activity.laps[5].distanceKm, 0.72);
  assert.equal(intervalDetail(activity), '');

  const html = activityDetail(model, activity.id);
  for (const label of ['เส้นทาง GPS', 'รอบรายกิโลจาก Intervals.icu', 'HR สูงสุด', 'Training Load', 'ความสูงสะสม', 'แคลอรี', 'โซนหัวใจ 2']) {
    assert.ok(html.includes(label), label);
  }
});

test('a structured interval renders even when the imported workout type is run', () => {
  const interval = {reps: 4, repDist: 0.4, repPace: '4:30', repHR: 174, autoDetected: 'intervals.icu'};
  const activity = normalizeActivity('demo', {...run, interval});
  const html = intervalDetail(activity);
  assert.match(html, /ชุดซ้อม Interval/);
  assert.match(html, /4 × 0\.4 km/);
  assert.doesNotMatch(html, /พักต่อรอบ/);
});

test('Home and Wellness retain separately dated values on sparse sync days', () => {
  const model = buildModel({data: {wellness: {
    '2026-11-26': {icuWellness: {ctl: 30, atl: 40, rampRate: 0}},
    '2026-11-25': {hrv: 50, icuWellness: {steps: 8123, sleepScore: 85}},
    '2026-11-24': {sleepHours: 7.5, restingHR: 54},
  }}});
  const homeHtml = home(model, {});
  assert.match(homeHtml, /#health\/2026-11-24/);
  assert.match(homeHtml, /7 ชม\. 30 นาที/);
  assert.match(homeHtml, /#health\/2026-11-25/);
  assert.match(health(model), /8,123/);
  assert.match(health(model, '2026-11-26'), /Fitness \(CTL\)/);
  assert.doesNotMatch(health(model, '2026-11-26'), /จำนวนก้าว/);
});
