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
load('js/training-dashboard-view-model.js');
load('js/domain/review/matcher-v2.js');

const training = context.window.MyDashTraining;
const engine = training.EngineV2;
const trainingDashboard = context.window.MyDashTrainingDashboard;
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
  const tenLongRuns = ten.sessions.filter(session=>session.type==='Long');
  assert(tenSpecific.length>=2, '10K: multiple specific sessions');
  assert(Math.max(...tenSpecific.map(session=>session.workoutSpec.qualityDistanceKm))>=5, '10K: specific workload reaches 5 km');
  assert(tenSpecific.some(session=>session.workoutSpec.repKm>=1), '10K: kilometer race-specific repetitions');
  assert(Math.max(...tenLongRuns.map(session=>session.targetDist))===14, '10K: intermediate long run reaches 14 km from a 12 km baseline');
  assert(tenSpecific.some(session=>session.workoutSpec.reps>=5&&session.workoutSpec.repKm>=1), '10K: specific intervals use a sufficient repeat count');
  assert(ten.sessions.filter(session=>session.phase==='RaceWeek').every(session=>!['Tempo','Interval','Long'].includes(session.type)), '10K: light race week');
  const peakTarget = Math.max(...ten.phaseSchedule.filter(row=>!['Taper','RaceWeek'].includes(row.phase)).map(row=>row.targetVolumeKm));
  assert(ten.phaseSchedule.filter(row=>['Taper','RaceWeek'].includes(row.phase)).every(row=>row.targetVolumeKm<peakTarget*.8), '10K: taper volume reduction');

  assert(!plans.Base.phaseSchedule.some(row=>row.phase==='RaceWeek'), 'Base: no race week');
  assert.equal(plans.Base.goalProfile.raceGoal, false, 'Base: non-race goal');
  assert(plans['5K'].sessions.some(session=>session.phase==='Specific'&&session.workoutSpec.repKm===1), '5K: 1 km specific reps');
  assert(plans.Half.sessions.some(session=>session.phase==='Specific'&&session.workoutSpec.repKm>=2), 'Half: longer specific reps');
  assert(plans.Marathon.sessions.some(session=>session.phase==='Specific'&&session.workoutSpec.qualityDistanceKm>=9), 'Marathon: marathon-specific work block');

  const longRunProfilePlans={
    '5K':engine.createPlan({goal:'5K long run profile',distance:'5K',level:'intermediate',daysPerWeek:4,startDate:'2026-07-13',endDate:'2026-09-07',totalWeeks:8,longRunDay:0,currentWeeklyKm:28,longestRecentRunKm:10,recentActivities:[],now:1783900000005}),
    Half:engine.createPlan({goal:'Half long run profile',distance:'Half',level:'intermediate',daysPerWeek:4,startDate:'2026-07-13',endDate:'2026-10-05',totalWeeks:12,longRunDay:0,currentWeeklyKm:40,longestRecentRunKm:15,recentActivities:[],now:1783900000006}),
    Marathon:engine.createPlan({goal:'Marathon long run profile',distance:'Marathon',level:'intermediate',daysPerWeek:4,startDate:'2026-07-13',endDate:'2026-11-02',totalWeeks:16,longRunDay:0,currentWeeklyKm:48,longestRecentRunKm:20,recentActivities:[],now:1783900000007})
  };
  assert.equal(Math.max(...longRunProfilePlans['5K'].sessions.filter(session=>session.type==='Long').map(session=>session.targetDist)),11,'5K: intermediate long run cap is 11 km');
  assert.equal(Math.max(...longRunProfilePlans.Half.sessions.filter(session=>session.type==='Long').map(session=>session.targetDist)),20,'Half: intermediate long run cap is 20 km');
  assert.equal(Math.max(...longRunProfilePlans.Marathon.sessions.filter(session=>session.type==='Long').map(session=>session.targetDist)),32,'Marathon: intermediate long run cap is 32 km');
  Object.values(longRunProfilePlans).forEach(plan=>assert.equal(plan.validation.valid,true,`Long run profile valid: ${plan.goalProfile.distance}`));
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

  const evidencePlan=engine.createPlan({
    goal:'10K HR grounded plan',distance:'10K',targetTime:'45:00',benchmark:'10K 46:00',
    level:'intermediate',daysPerWeek:4,startDate:'2026-07-13',endDate:'2026-09-07',totalWeeks:8,longRunDay:0,
    unavailable:'วันจันทร์,Fri,2026-08-05',unavailableRaw:'วันจันทร์,Fri,2026-08-05',currentWeeklyKm:30,
    athleteSettings:{maxHR:186,lthr:169,easyHRMin:130,easyHRMax:142,z1Max:130,z2Max:145,z3Max:155,z4Max:169,z5Max:186,thresholdPace:'4:21',tempoFast:'4:55',tempoSlow:'5:05'},
    recentActivities:[
      {date:'2026-07-02',type:'run',purpose:'easy',dist:8,avgPace:6.05,hr:136,rpe:3},
      {date:'2026-07-05',type:'long run',dist:12,avgPace:6.20,hr:139,rpe:4},
      {date:'2026-07-08',type:'run',purpose:'easy',dist:7,avgPace:6.10,hr:134,rpe:3},
      {date:'2026-07-09',type:'run',purpose:'steady',dist:8,avgPace:5.35,hr:150,rpe:6}
    ],asOfDate:'2026-07-10',now:1783900000002
  });
  assert.equal(evidencePlan.validation.valid,true,evidencePlan.validation.errors.join(','));
  assert.equal(evidencePlan.athleteProfile.easyPaceEvidence.sessions,3,'Only easy-HR evidence is accepted');
  assert.equal(evidencePlan.athleteProfile.effortTargets.easy.hrMax,142,'Configured easy HR cap is used');
  assert(evidencePlan.athleteProfile.effortTargets.easy.paceFast>5.35,'Easy pace guard excludes 5:21 gray-zone pace');
  assert.equal(evidencePlan.athleteProfile.effortTargets.tempo.paceFast,4+55/60,'Configured tempo fast pace is used');
  assert.equal(evidencePlan.athleteProfile.effortTargets.tempo.paceSlow,5+5/60,'Configured tempo slow pace is used');
  assert(evidencePlan.sessions.filter(session=>['easy','recovery','long'].includes(session.intent)).every(session=>session.targetHR===142&&session.targetPaceRange),'Easy sessions expose HR cap and pace range');
  assert(!evidencePlan.sessions.some(session=>session.type!=='Rest'&&[1,5].includes(new Date(session.date+'T12:00:00').getDay())),'Thai/English unavailable weekdays are respected');
  assert(!evidencePlan.sessions.some(session=>session.type!=='Rest'&&session.date==='2026-08-05'),'Unavailable date is respected');
  assert.equal(evidencePlan.inputAudit.athleteSettings.easyHRMax,142,'Plan records settings used');
  assert.equal(evidencePlan.inputAudit.targetTime,'45:00','Plan records target time used');
  const thresholdSessions=evidencePlan.sessions.filter(session=>session.workoutSpec?.intent==='threshold');
  const continuousThreshold=thresholdSessions.filter(session=>session.workoutSpec.structure==='continuous');
  const segmentedThreshold=thresholdSessions.filter(session=>session.workoutSpec.structure==='repetitions');
  assert(continuousThreshold.length>=2,'Plan includes repeated continuous tempo development');
  assert(segmentedThreshold.length<=continuousThreshold.length,'Segmented tempo does not dominate continuous tempo');
  assert(evidencePlan.recoveryCards.some(card=>card.intent==='post_quality'||card.intent==='post_long_run'),'Plan stores recovery cards for non-running days');
  const dashboardVm=trainingDashboard.build(evidencePlan,{activities:[{date:evidencePlan.sessions.find(session=>session.type!=='Rest').date}],wellness:[{date:'2026-07-10',sleepHours:7.5}],today:'2026-07-20'});
  assert(dashboardVm.summary.totalSessions>0,'Training dashboard summarizes sessions');
  assert(dashboardVm.summary.completedSessions===1,'Training dashboard counts completed planned activity');
  assert(dashboardVm.intensity.quality.sessions>0,'Training dashboard summarizes quality sessions');
  assert(Object.keys(dashboardVm.recoverySummary).length>0,'Training dashboard exposes recovery summary');

  const fiveDayPlan=engine.createPlan({
    goal:'10K five-day plan',distance:'10K',targetTime:'49:30',benchmark:'10K 52:30',
    level:'intermediate',daysPerWeek:5,startDate:'2026-07-13',endDate:'2026-09-07',totalWeeks:8,longRunDay:0,
    currentWeeklyKm:36,longestRecentRunKm:12,recentActivities:[],now:1783900000003
  });
  assert.equal(fiveDayPlan.validation.valid,true,fiveDayPlan.validation.errors.join(','));
  assert(fiveDayPlan.sessions.some(session=>['Tempo','Interval'].includes(session.type)),'5-day plan still includes quality work');
  assert(fiveDayPlan.sessions.some(session=>session.type==='Recovery'&&session.recoveryIntent==='post_long_run'),'5-day plan includes post-long-run recovery run');

  const sixDayPlan=engine.createPlan({
    goal:'Half six-day plan',distance:'Half',targetTime:'1:52:00',benchmark:'10K 52:30',
    level:'intermediate',daysPerWeek:6,startDate:'2026-07-13',endDate:'2026-10-05',totalWeeks:12,longRunDay:0,
    currentWeeklyKm:44,longestRecentRunKm:15,recentActivities:[],now:1783900000004
  });
  assert.equal(sixDayPlan.validation.valid,true,sixDayPlan.validation.errors.join(','));
  assert.equal(sixDayPlan.daysPerWeek,6,'6-day plan stores requested frequency');
  assert(sixDayPlan.sessions.some(session=>session.recoveryIntent==='post_quality'),'6-day plan includes post-quality recovery run');
  assert(sixDayPlan.recoveryCards.some(card=>card.intent==='passive_rest'),'6-day plan keeps at least one passive rest day');

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
    tenKLongRunKm:tenLongRuns.map(session=>session.targetDist),
    easyEffort:evidencePlan.athleteProfile.effortTargets.easy,
    tempoStructures:thresholdSessions.map(session=>session.workoutSpec.structure),
    recoverySummary:evidencePlan.recoverySummary,
    reviewTypes:[exact.type,mismatch.type,probable.type,noPlan.type,historical.type],
    persistence:'versioned-and-archivable'
  },null,2));
}

main().catch(error=>{console.error(error);process.exitCode=1;});
