const assert=require('assert');
const fs=require('fs');
const vm=require('vm');

global.window=global;
vm.runInThisContext(fs.readFileSync('js/services/manual-plan-builder.js','utf8'),{filename:'manual-plan-builder.js'});
vm.runInThisContext(fs.readFileSync('js/services/plan-file-import.js','utf8'),{filename:'plan-file-import.js'});

const jsonPlan=global.MyDashPlanFileImport.createImportedPlan({
  name:'Coach supplied half marathon plan',provider:'External coach',sessions:[
    {date:'2026-08-02',type:'Threshold',distanceKm:11,title:'3 x 10 min threshold',details:{warmup:'20 min easy',mainSet:'3 x 10 min threshold, 2 min jog',cooldown:'15 min easy'},notes:'Do not alter the session.'},
    {date:'2026-08-02',type:'Strength',distanceKm:1,title:'Mobility and strength',mainSet:'20 min mobility'}
  ]
},{fileName:'coach-plan.json',createdAt:123});

assert.equal(jsonPlan.sourcePlan.provider,'imported');
assert.equal(jsonPlan.sessions.length,2);
assert.equal(jsonPlan.sessions[0].description,'3 x 10 min threshold');
assert.equal(jsonPlan.sessions[0].details.mainSet,'3 x 10 min threshold, 2 min jog');
assert.equal(jsonPlan.sessions[0].type,'Tempo');
assert.equal(jsonPlan.sessions[1].type,'Other');
assert.equal(jsonPlan.sessions[1].sourceType,'Strength');

const csv=global.MyDashPlanFileImport.parseCsv('date,type,distanceKm,title,mainSet,notes\n2026-08-03,Interval,8,"5 x 800 m","2 km warm-up + 5 x 800 m + cool-down","keep source text"');
assert.equal(csv.length,1);
assert.equal(csv[0].mainSet,'2 km warm-up + 5 x 800 m + cool-down');
assert.equal(csv[0].notes,'keep source text');

const rows=global.MyDashPlanFileImport.parsePastedRows('2026-08-03 | Easy | 6 | Easy aerobic | comfortable\n2026-08-05 | Long | 12 | Long run | easy');
assert.equal(rows.length,2);
assert.equal(rows[1].targetDist,'12');

console.log('Plan file import tests passed');
