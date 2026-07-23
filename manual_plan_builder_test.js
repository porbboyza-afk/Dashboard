const assert=require('assert');
const fs=require('fs');
const vm=require('vm');

global.window=global;
vm.runInThisContext(fs.readFileSync('js/services/manual-plan-builder.js','utf8'),{filename:'manual-plan-builder.js'});

const plan=global.MyDashManualPlan.createPlan([
  {date:'2026-08-30',type:'Long',targetDist:12,title:'Long run',mainSet:'12 km easy'},
  {date:'2026-08-25',type:'Easy',targetDist:6,title:'Easy run',warmup:'5 min walk',cooldown:'5 min jog'},
  {date:'2026-09-02',type:'Tempo',targetDist:8,title:'Tempo',mainSet:'2 km warm-up + 5 km tempo + 1 km cool-down'}
],{goal:'Manual 10K build',createdAt:1234567890});

assert.equal(plan.planId,'manual-1234567890');
assert.equal(plan.startDate,'2026-08-25');
assert.equal(plan.endDate,'2026-09-02');
assert.equal(plan.totalWeeks,2);
assert.equal(plan.sessions.length,3);
assert.deepEqual(plan.sessions.map(session=>session.date),['2026-08-25','2026-08-30','2026-09-02']);
assert.equal(plan.validation.weeklyTargetsKm.reduce((sum,value)=>sum+value,0),26);
assert.equal(plan.sessions.find(session=>session.type==='Tempo').workoutSpec.qualityDistanceKm,8);
const doubleDay=global.MyDashManualPlan.createPlan([{date:'2026-08-25',type:'Easy',targetDist:4,title:'AM easy'},{date:'2026-08-25',type:'Long',targetDist:8,title:'PM long'}]);
assert.equal(doubleDay.sessions.length,2);
assert.equal(doubleDay.sessions[0].description,'AM easy');
const repeats=global.MyDashManualPlan.createPlan([{date:'2026-08-27',type:'Interval',targetDist:'3 x 1.2',title:'3 x 1.2 km'}]);
assert.equal(repeats.sessions[0].targetDist,3.6);
assert.throws(()=>global.MyDashManualPlan.createPlan([{date:'2026-08-25',type:'Rest',targetDist:1}]),/Rest must have 0 km/);

console.log('Manual plan builder tests passed');
