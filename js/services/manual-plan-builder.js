(function(root){
  'use strict';

  const TYPES=['Easy','Recovery','Tempo','Interval','Long','Race','Rest','Other'];

  function normalizeType(value){
    const raw=String(value||'').trim();
    const lowered=raw.toLowerCase();
    if(!raw)return 'Easy';
    if(TYPES.includes(raw))return raw;
    if(/rest|off|พัก/.test(lowered))return 'Rest';
    if(/recover|easy|aerobic|base|jog|เบา|ฟื้น/.test(lowered))return lowered.includes('recover')?'Recovery':'Easy';
    if(/tempo|threshold|steady|progression|เทมโป/.test(lowered))return 'Tempo';
    if(/interval|repeat|repetition|speed|hill|อินเท/.test(lowered))return 'Interval';
    if(/long|endurance|ยาว/.test(lowered))return 'Long';
    if(/race|time trial|แข่งขัน/.test(lowered))return 'Race';
    return 'Other';
  }

  function isIsoDate(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;
    const parsed=new Date(`${value}T12:00:00`);
    return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
  }
  function addDays(date,days){
    const value=new Date(`${date}T12:00:00`);
    value.setDate(value.getDate()+days);
    return value.toISOString().slice(0,10);
  }
  function round(value){return +Number(value).toFixed(2);}
  function normalizeSession(input,index){
    const date=String(input?.date||'').trim();
    const sourceType=String(input?.sourceType||input?.type||'').trim();
    const type=normalizeType(sourceType);
    const targetDist=round(Number(input?.targetDist??input?.distanceKm??input?.distance??input?.totalDistanceKm));
    if(!isIsoDate(date))throw new Error(`Session ${index+1}: choose a valid date.`);
    if(type==='Rest'&&targetDist!==0)throw new Error(`Session ${index+1}: Rest must have 0 km.`);
    if(type!=='Rest'&&(!Number.isFinite(targetDist)||targetDist<=0))throw new Error(`Session ${index+1}: distance must be greater than 0.`);
    const details=input?.details&&typeof input.details==='object'?input.details:{};
    const title=String(input?.title||input?.description||details.targetDescription||'').trim()||`${sourceType||type} run`;
    const mainSet=String(input?.mainSet||details.mainSet||'').trim()||title;
    return {
      date,type,sourceType:sourceType||type,targetDist,title,mainSet,
      warmup:String(input?.warmup??details.warmup??'').trim(),
      cooldown:String(input?.cooldown??details.cooldown??'').trim(),
      notes:String(input?.notes||'').trim(),
      execution:String(input?.execution??details.execution??'').trim(),
      successCriteria:String(input?.successCriteria??details.successCriteria??'').trim(),
      intensity:String(input?.intensity??details.intensity??'').trim(),
      targetPace:String(input?.targetPace||input?.targetPaceRange||'').trim(),
      targetHR:input?.targetHR??'',priority:String(input?.priority||'').trim()
    };
  }
  function createPlan(inputs,{goal='Manual running schedule',createdAt=Date.now(),provider='manual',sourcePlan={},inputAudit={}}={}){
    if(!Array.isArray(inputs)||!inputs.length)throw new Error('Add at least one session before saving.');
    const normalized=inputs.map(normalizeSession).sort((a,b)=>a.date.localeCompare(b.date));
    const startDate=normalized[0].date,endDate=normalized[normalized.length-1].date;
    const totalWeeks=Math.max(1,Math.floor((new Date(`${endDate}T12:00:00`)-new Date(`${startDate}T12:00:00`))/(7*86400000))+1);
    const weeklyTargets=Array.from({length:totalWeeks},()=>0);
    const sessions=normalized.map((session,index)=>{
      const week=Math.floor((new Date(`${session.date}T12:00:00`)-new Date(`${startDate}T12:00:00`))/(7*86400000))+1;
      weeklyTargets[week-1]=round(weeklyTargets[week-1]+session.targetDist);
      const quality=['Tempo','Interval','Race'].includes(session.type)?session.targetDist:0;
      return {
        sessionId:`manual-${createdAt}-s${index+1}`,date:session.date,week,phase:'Manual',phaseLabel:'Manual schedule',
        type:session.type,sourceType:session.sourceType,intent:provider==='manual'?'manual':'imported',targetDist:session.targetDist,targetPace:session.targetPace,targetPaceRange:session.targetPace,targetHR:session.targetHR,
        priority:['key','normal','optional'].includes(session.priority)?session.priority:(['Tempo','Interval','Long','Race'].includes(session.type)?'key':'normal'),description:session.title,
        details:{warmup:session.warmup,mainSet:session.mainSet,cooldown:session.cooldown,execution:session.execution||'Follow the source session exactly as entered.',successCriteria:session.successCriteria||'Complete the planned session with controlled form.',intensity:session.intensity||'Source plan',targetDescription:session.title},
        workoutSpec:{intent:provider==='manual'?'manual':'imported',structure:provider==='manual'?'manual':'imported_file',totalDistanceKm:session.targetDist,qualityDistanceKm:quality,sourceProvider:provider},
        notes:session.notes,methodologyVersion:'manual-schedule-2026.07.22'
      };
    });
    return {
      planId:`manual-${createdAt}`,revisionId:'r1',engineVersion:2,methodologyVersion:'manual-schedule-2026.07.22',status:'active',goal:String(goal||'Manual running schedule').trim()||'Manual running schedule',startDate,endDate,totalWeeks,daysPerWeek:Math.max(...weeklyTargets.map((_,week)=>sessions.filter(session=>session.week===week+1&&session.type!=='Rest').length)),createdAt,updatedAt:createdAt,
      sourcePlan:{provider,label:sourcePlan.label|| (provider==='manual'?'Manual schedule':'Imported schedule'),importedAt:createdAt,adaptation:sourcePlan.adaptation|| (provider==='manual'?'Sessions were entered directly by the athlete.':'Sessions are preserved from the imported file; MyDash does not regenerate them.'),...sourcePlan},
      goalProfile:{distance:'Manual',targetTime:'',targetMinutes:null,targetPace:null,benchmark:'',unavailableRaw:'',unavailable:[],longRunDay:'',longRunDayName:'',raceGoal:sessions.some(session=>session.type==='Race')},
      athleteProfile:{level:'manual',currentWeeklyKm:Math.max(...weeklyTargets),volumeBasis:'manual_schedule',paceBasis:'manual',confidence:'manual'},
      inputAudit:{source:provider==='manual'?'manual schedule':'imported file',...inputAudit},phaseSchedule:weeklyTargets.map((targetVolumeKm,index)=>({week:index+1,phase:'Manual',phaseLabel:provider==='manual'?'Manual schedule':'Imported schedule',startDate:addDays(startDate,index*7),targetVolumeKm})),sessions,recoveryCards:[],recoverySummary:{},completedDates:{},adjustments:[],dailyDecisions:{},
      validation:{valid:true,errors:[],warnings:[provider==='manual'?'manual_schedule: sessions are athlete-entered and are not generated by MyDash.':'imported_schedule: sessions are preserved from the source file and are not regenerated by MyDash.'],weeklyTargetsKm:weeklyTargets,weeklyActualKm:weeklyTargets},compatibility:{legacyMirror:true,previousEngineAvailable:true,manualPlan:provider==='manual',importedPlan:provider!=='manual'}
    };
  }

  root.MyDashManualPlan={TYPES,normalizeType,createPlan};
})(window);
