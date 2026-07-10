const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
const context = vm.createContext({window:{}, console});
context.window.window = context.window;

function load(relativePath) {
  const filePath = path.join(root, relativePath);
  vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, {filename:relativePath});
}

load('js/domain/training/profiles.js');
load('js/domain/training/engine-v2.js');
load('js/domain/review/matcher-v2.js');

const training = context.window.MyDashTraining;
const engine = training.EngineV2;
const matcher = context.window.MyDashReviewMatcher;

function targetFor(distance) {
  return {Base:'', '5K':'24:30', '10K':'49:30', Half:'1:52:00', Marathon:'4:05:00'}[distance];
}

function create(distance, weeks) {
  const startDate = '2026-07-13';
  return engine.createPlan({
    goal:`${distance} test plan`, distance, targetTime:targetFor(distance), benchmark:'10K 52:30',
    level:'intermediate', daysPerWeek:4, startDate, endDate:engine.addDays(startDate,weeks*7), totalWeeks:weeks,
    longRunDay:0, currentWeeklyKm:distance==='Marathon'?38:28, longestRecentRunKm:distance==='Marathon'?20:12,
    recentActivities:[], now:1783900000000
  });
}

async function main() {
  const plans = {
    Base:create('Base',8),
    '5K':create('5K',8),
    '10K':create('10K',8),
    Half:create('Half',12),
    Marathon:create('Marathon',16)
  };

  for (const [distance, plan] of Object.entries(plans)) {
    assert.equal(plan.engineVersion, 2, `${distance}: engine version`);
    assert.equal(plan.methodologyVersion, training.METHODOLOGY_VERSION, `${distance}: methodology version`);
    assert.equal(plan.validation.valid, true, `${distance}: ${plan.validation.errors.join(',')}`);
    assert.equal(plan.phaseSchedule.length, plan.totalWeeks, `${distance}: phase schedule length`);
    assert.equal(new Set(plan.sessions.map(session=>session.sessionId)).size, plan.sessions.length, `${distance}: unique session ids`);
    assert(plan.sessions.filter(session=>session.type!=='Rest').every(session=>session.workoutSpec), `${distance}: workout specs`);
    assert(!plan.sessions.some(session=>session.date===plan.endDate), `${distance}: no session on end/race day`);
    assert.equal(plan.validation.weeklyActualKm.length,plan.totalWeeks,`${distance}: weekly actual volume`);
  }

  const ten = plans['10K'];
  const tenPhases = ten.phaseSchedule.map(row=>row.phase);
  assert(tenPhases.filter(phase=>phase==='Build').length>=2, '10K: meaningful build block');
  assert(tenPhases.filter(phase=>phase==='Specific').length>=2, '10K: meaningful specific block');
  const tenSpecific = ten.sessions.filter(session=>session.phase==='Specific'&&session.workoutSpec.qualityDistanceKm>0);
  assert(tenSpecific.length>=2, '10K: multiple specific sessions');
  assert(Math.max(...tenSpecific.map(session=>session.workoutSpec.qualityDistanceKm))>=5, '10K: specific workload reaches 5 km');
  assert(tenSpecific.some(session=>session.workoutSpec.repKm>=1), '10K: kilometer race-specific repetitions');
  assert(ten.sessions.filter(session=>session.phase==='RaceWeek').every(session=>!['Tempo','Interval','Long'].includes(session.type)), '10K: light race week');
  const peakTarget = Math.max(...ten.phaseSchedule.filter(row=>!['Taper','RaceWeek'].includes(row.phase)).map(row=>row.targetVolumeKm));
  assert(ten.phaseSchedule.filter(row=>['Taper','RaceWeek'].includes(row.phase)).every(row=>row.targetVolumeKm<peakTarget*.8), '10K: taper volume reduction');

  assert(!plans.Base.phaseSchedule.some(row=>row.phase==='RaceWeek'), 'Base: no race week');
  assert.equal(plans.Base.goalProfile.raceGoal, false, 'Base: non-race goal');
  assert(plans['5K'].sessions.some(session=>session.phase==='Specific'&&session.workoutSpec.repKm===1), '5K: 1 km specific reps');
  assert(plans.Half.sessions.some(session=>session.phase==='Specific'&&session.workoutSpec.repKm>=2), 'Half: longer specific reps');
  assert(plans.Marathon.sessions.some(session=>session.phase==='Specific'&&session.workoutSpec.qualityDistanceKm>=9), 'Marathon: marathon-specific work block');
  assert.equal(ten.athleteProfile.paceBasis, 'recent_benchmark', 'Benchmark drives training pace');
  assert.equal(engine.parseBenchmark('Half 1:45').minutes,105,'Half benchmark accepts H:MM');
  assert.equal(engine.parseBenchmark('Marathon 4:05').minutes,245,'Marathon benchmark accepts H:MM');
  const sparseHistoryPlan=engine.createPlan({
    goal:'Sparse history',distance:'10K',targetTime:'50:00',level:'intermediate',daysPerWeek:4,
    startDate:'2026-07-13',endDate:'2026-09-07',totalWeeks:8,longRunDay:0,currentWeeklyKm:1.4,
    currentWeeklyKmSource:'activity_history',recentActivities:[{date:'2026-07-10',type:'run',dist:5.8}],asOfDate:'2026-07-10',now:1783900000001
  });
  assert.equal(sparseHistoryPlan.validation.valid,true,'Sparse history uses a conservative viable baseline');
  assert.equal(sparseHistoryPlan.athleteProfile.volumeBasis,'insufficient_history_conservative_fallback','Sparse history is not treated as a reliable baseline');

  const intervalWorkout={_key:'w1',date:'2026-07-22',type:'interval',purpose:'interval',dist:7,time:42,updatedAt:10};
  const intervalSession={sessionId:'s1',date:'2026-07-22',type:'Interval',intent:'vo2',targetDist:7,targetPace:'4:45'};
  const easySession={sessionId:'s2',date:'2026-07-22',type:'Easy',intent:'easy',targetDist:6,targetPace:'6:10'};
  const exact=matcher.matchWorkout(intervalWorkout,{planId:'p1',revisionId:'r1',sessions:[intervalSession]});
  const mismatch=matcher.matchWorkout(intervalWorkout,{planId:'p1',revisionId:'r1',sessions:[easySession]});
  const probable=matcher.matchWorkout({...intervalWorkout,date:'2026-07-23'},{planId:'p1',revisionId:'r1',sessions:[intervalSession]});
  const noPlan=matcher.matchWorkout(intervalWorkout,null,null);
  const historical=matcher.matchWorkout(intervalWorkout,null,{planId:'old-plan',planMatch:{session:intervalSession}});
  assert.equal(exact.type,'exact');
  assert.equal(exact.score,100);
  assert.equal(mismatch.type,'date_mismatch');
  assert.equal(mismatch.compareTargets,false);
  assert.equal(probable.type,'probable');
  assert.equal(probable.requiresConfirmation,true);
  assert.equal(noPlan.type,'no_plan');
  assert.equal(historical.type,'historical_plan');
  const facts={factsVersion:matcher.FACTS_VERSION,factsHash:matcher.factsHash(intervalWorkout,{planId:'p1',revisionId:'r1'},exact)};
  assert.equal(matcher.isReviewStale({...facts},facts),false);
  assert.equal(matcher.isReviewStale({...facts,factsHash:'old'},facts),true);

  const writes=new Map();
  context.window._fb={
    setData:async (key,value)=>writes.set(key,value),
    getData:async key=>writes.get(key)??null,
    removeData:async key=>writes.delete(key)
  };
  load('js/services/coach-repository.js');
  const repository=context.window.MyDashCoachRepository;
  await repository.savePlan(ten);
  assert(writes.has(`coach_plans/${ten.planId}`),'Versioned plan write');
  assert.equal(writes.get('active_coach_plan_id'),ten.planId,'Active plan pointer');
  assert.equal(writes.get('coach_plan').planId,ten.planId,'Legacy compatibility mirror');
  await repository.archivePlan(ten);
  assert.equal(writes.get(`coach_plans/${ten.planId}/status`),'archived','Archive status');
  assert.equal(writes.has('active_coach_plan_id'),false,'Active pointer removed');
  assert.equal(writes.has('coach_plan'),false,'Legacy mirror removed');

  console.log(JSON.stringify({
    profiles:Object.keys(plans),
    tenKPhases:tenPhases,
    tenKSpecificWorkKm:tenSpecific.map(session=>session.workoutSpec.qualityDistanceKm),
    reviewTypes:[exact.type,mismatch.type,probable.type,noPlan.type,historical.type],
    persistence:'versioned-and-archivable'
  },null,2));
}

main().catch(error=>{console.error(error);process.exitCode=1;});
