const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

global.window = global;
vm.runInThisContext(fs.readFileSync('js/services/coros-plan-import.js', 'utf8'), {filename:'coros-plan-import.js'});

const plan = global.MyDashCorosPlans.createSub50Plan(1234567890);
assert.equal(plan.engineVersion, 2);
assert.equal(plan.planId, 'coros-10k-sub50-2026-10-18');
assert.equal(plan.startDate, '2026-08-24');
assert.equal(plan.endDate, '2026-10-18');
assert.equal(plan.totalWeeks, 8);
assert.equal(plan.sessions.length, 31);
assert.equal(plan.sourcePlan.provider, 'COROS');
assert.equal(plan.sourcePlan.planId, '479006363339636967');
assert(plan.sessions.every(session => !['Mon','Fri'].includes(new Date(`${session.date}T12:00:00`).toLocaleDateString('en-US',{weekday:'short'}))), 'No imported session may fall on Monday or Friday');
assert(plan.sessions.some(session => session.date === '2026-09-16' && session.details.mainSet.includes('4 x 1200 m')), '4 x 1200 m threshold session retained');
assert(plan.sessions.some(session => session.date === '2026-09-23' && session.details.mainSet.includes('4 x 1600 m')), '4 x 1600 m threshold session retained');
assert(plan.sessions.some(session => session.date === '2026-10-11' && session.type === 'Long' && session.targetDist === 12), 'Final progressive long run retained');
assert(plan.sessions.some(session => session.date === '2026-10-18' && session.type === 'Race' && session.targetDist === 10), 'Race session retained');
assert.equal(plan.phaseSchedule.reduce((sum,week) => sum + week.targetVolumeKm, 0).toFixed(2), '247.70');

console.log('COROS external plan import tests passed');
