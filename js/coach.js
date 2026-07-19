// AI Coach logic extracted from index.html.
function updateCoachEndDate() {
  const start = document.getElementById('coach-start-date')?.value;
  const weeksEl = document.getElementById('coach-weeks');
  const endEl = document.getElementById('coach-end-date');
  if (!start || !weeksEl || !endEl) return;
  const w = parseInt(weeksEl.value);
  if (!w || isNaN(w)) return;
  const d = new Date(start + 'T00:00:00');
  d.setDate(d.getDate() + w * 7);
  endEl.value = toLocalDateStr(d);
}
function updateCoachWeeksFromEnd() {
  const start = document.getElementById('coach-start-date')?.value;
  const end = document.getElementById('coach-end-date')?.value;
  const weeksEl = document.getElementById('coach-weeks');
  if (!start || !end || !weeksEl) return;
  const diff = Math.round((new Date(end+'T00:00:00') - new Date(start+'T00:00:00')) / (7*86400000));
  if (diff > 0) weeksEl.value = 'custom';
  document.getElementById('coach-weeks-custom-display') && (document.getElementById('coach-weeks-custom-display').textContent = diff + ' สัปดาห์');
}

// ── AI COACH ──
function parseTimeToMinutes(value){
  const parts=String(value||'').trim().split(':').map(Number);
  if(parts.some(n=>!Number.isFinite(n)))return null;
  if(parts.length===2)return parts[0]+parts[1]/60;
  if(parts.length===3)return parts[0]*60+parts[1]+parts[2]/60;
  return Number.isFinite(parts[0])?parts[0]:null;
}
function raceDistanceKm(distance){
  if(window.MyDashTraining)return window.MyDashTraining.getProfile(distance).distanceKm||10;
  if(distance==='5K')return 5;
  if(distance==='Half')return 21.0975;
  if(distance==='Marathon')return 42.195;
  return 10;
}
function coachWeekdayName(day){
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][parseInt(day)]||'Sun';
}
function coachPhaseThai(phase){
  return {Base:'Base',Build:'Build',Peak:'Peak',Specific:'Peak / Specific',Taper:'Taper',RaceWeek:'Race Week',Consolidate:'Consolidate'}[phase]||phase||'Build';
}
function coachCurrentPhase(plan,date=toLocalDateStr()){
  const rows=plan?.phaseSchedule||[];
  const match=[...rows].reverse().find(row=>row.startDate&&row.startDate<=date);
  return match?.phase||plan?.sessions?.find(session=>session.date>=date)?.phase||coachPhaseForDate(date,plan?.startDate,plan?.totalWeeks);
}
function updateCoachGoalDefaults(){
  const select=document.getElementById('coach-race-distance');
  const target=document.getElementById('coach-target-time');
  const weeks=document.getElementById('coach-weeks');
  const profile=window.MyDashTraining?.getProfile(select?.value||'10K');
  if(!profile)return;
  if(target){
    target.disabled=!profile.race;
    target.placeholder=profile.race?'เช่น 47:59 หรือ 1:45:00':'ไม่ใช้เวลาเป้าหมายสำหรับ Base Building';
    if(!profile.race)target.value='';
  }
  if(weeks&&weeks.value!=='custom')weeks.value=String(profile.defaultWeeks);
  updateCoachEndDate();
}
function datePlusDays(dateStr,days){
  const d=new Date((dateStr||toLocalDateStr())+'T12:00:00');
  d.setDate(d.getDate()+days);
  return toLocalDateStr(d);
}
function coachWeekIndex(startDate,dateStr){
  const start=new Date((startDate||toLocalDateStr())+'T12:00:00');
  const date=new Date((dateStr||startDate||toLocalDateStr())+'T12:00:00');
  if(isNaN(start)||isNaN(date))return 0;
  return Math.max(0,Math.floor((date-start)/(7*86400000)));
}
function coachPhaseForWeek(week,totalWeeks){
  const total=Math.max(1,parseInt(totalWeeks)||1);
  const current=Math.max(0,Math.min(total-1,parseInt(week)||0));
  const taperWeeks=total>=7?2:1;
  const peakWeeks=total>=9?2:1;
  const raceWeekIndex=total-1;
  const taperStart=Math.max(0,raceWeekIndex-taperWeeks);
  const peakStart=Math.max(0,taperStart-peakWeeks);
  const baseWeeks=Math.max(1,Math.min(4,Math.round(total*0.35)));
  if(current===raceWeekIndex)return 'RaceWeek';
  if(current>=taperStart)return 'Taper';
  if(current>=peakStart)return 'Peak';
  if(current<baseWeeks)return 'Base';
  return 'Build';
}
function coachPhaseForDate(dateStr,startDate,totalWeeks){
  return coachPhaseForWeek(coachWeekIndex(startDate,dateStr),totalWeeks);
}
function coachPhaseSchedule(startDate,totalWeeks){
  const total=Math.max(1,parseInt(totalWeeks)||1);
  return Array.from({length:total},(_,week)=>{
    const phase=coachPhaseForWeek(week,total);
    const weekStart=datePlusDays(startDate,week*7);
    return {week:week+1,phase,startDate:weekStart};
  });
}
function isHardSession(type){
  return ['Tempo','Interval','Long'].includes(String(type||''));
}
function getCoachGoalProfile(plan=null,{preferPlan=false}={}){
  const fromPlan=preferPlan&&plan?.goalProfile;
  const distance=(fromPlan?plan.goalProfile.distance:document.getElementById('coach-race-distance')?.value)||plan?.goalProfile?.distance||'10K';
  const raceGoal=window.MyDashTraining?window.MyDashTraining.getProfile(distance).race:distance!=='Base';
  const targetTime=(fromPlan?plan.goalProfile.targetTime:document.getElementById('coach-target-time')?.value?.trim())||plan?.goalProfile?.targetTime||(raceGoal?'47:59':'');
  const targetMinutes=parseTimeToMinutes(targetTime);
  const km=raceDistanceKm(distance);
  const targetPace=targetMinutes?targetMinutes/km:null;
  const unavailableRaw=(fromPlan?plan.goalProfile.unavailableRaw:document.getElementById('coach-unavailable')?.value?.trim())||plan?.goalProfile?.unavailableRaw||'';
  const unavailable=unavailableRaw.split(/[,\s]+/).map(x=>x.trim()).filter(Boolean);
  const longRunDayRaw=(fromPlan?plan.goalProfile.longRunDay:document.getElementById('coach-long-run-day')?.value)||plan?.goalProfile?.longRunDay||'0';
  const longRunDay=String(Number.isFinite(parseInt(longRunDayRaw))?parseInt(longRunDayRaw):0);
  return {
    distance,targetTime,targetMinutes,targetPace,benchmark:(fromPlan?plan.goalProfile.benchmark:document.getElementById('coach-benchmark')?.value?.trim())||plan?.goalProfile?.benchmark||'',
    unavailableRaw,unavailable,longRunDay,longRunDayName:coachWeekdayName(longRunDay)
  };
}
function coachSourceSummary(activities){
  return activities.reduce((acc,w)=>{const key=w.source||'manual';acc[key]=(acc[key]||0)+1;return acc;},{});
}
function coachIsRunningActivity(activity){
  const text=`${activity?.type||''} ${activity?.purpose||''} ${activity?.name||''}`.toLowerCase();
  return /run|running|jog|easy|recovery|long|interval|tempo|threshold|race/.test(text)
    && !/walk|hike|cycle|bike|swim|strength|yoga/.test(text);
}
function buildCoachContext(plan=null){
  const activities=getAllActivities();
  const runningActivities=activities.filter(coachIsRunningActivity);
  const wellness=AppState.get('wellness')||[];
  const readiness=calculateReadiness();
  const goalProfile=getCoachGoalProfile(plan,{preferPlan:!!plan});
  const startDate=plan?.startDate||document.getElementById('coach-start-date')?.value||toLocalDateStr();
  const endDate=plan?.endDate||document.getElementById('coach-end-date')?.value||'';
  const totalWeeks=plan?.totalWeeks||parseInt(document.getElementById('coach-weeks')?.value)||8;
  const today=toLocalDateStr();
  const since=days=>runningActivities.filter(w=>new Date((w.date||'')+'T12:00:00')>=dateDaysAgo(days-1));
  const volume=rows=>rows.reduce((sum,w)=>sum+(parseFloat(w.dist)||0),0);
  const latest=activities.slice(0,12).map(w=>`${w.date} ${w.type||'run'} ${w.dist||0}km ${Math.round(w.time||0)}min${w.avgPace?' pace '+formatPace(w.avgPace):''}${w.hr?' HR'+w.hr:''}${w.cad?' Cad '+w.cad:''}${w.stride?' stride '+w.stride:''}${w.rpe?' RPE'+w.rpe:''} ${sourceMeta(w).label}`).join('\n');
  const wellnessRows=wellness.slice(0,14).map(r=>`${r.date}: sleep ${r.sleepHours??'-'}h, RHR ${r.restingHR??'-'}, HRV ${r.hrv??'-'}, SpO2 ${r.spo2??'-'}, fatigue ${r.fatigue??'-'}, pain ${r.soreness??'-'}, status ${r.healthStatus||'-'}`).join('\n');
  return {
    today,startDate,endDate,totalWeeks,goalProfile,readiness,
    load:readiness.load,
    volumes:{d7:+volume(since(7)).toFixed(1),d30:+volume(since(30)).toFixed(1),d90:+volume(since(90)).toFixed(1)},
    sourceSummary:coachSourceSummary(runningActivities),
    latestActivities:latest||'none',
    wellnessRows:wellnessRows||'none',
    phaseSchedule:coachPhaseSchedule(startDate,totalWeeks),
    planSummary:plan?.sessions?.slice(0,18).map(s=>`${s.date} ${s.phase||coachPhaseForDate(s.date,startDate,totalWeeks)} ${s.type} ${coachSessionDistanceSummary(s)||`${s.targetDist||0}km`} ${s.targetPace||''} ${s.notes||''}`).join('\n')||'none'
  };
}
function coachPlanSuitabilityFacts(plan){
  const activities=getAllActivities();
  const since90=activities.filter(activity=>new Date(`${activity.date||''}T12:00:00`)>=dateDaysAgo(89));
  const quality=(plan.sessions||[]).filter(session=>['Tempo','Interval'].includes(session.type)).map(session=>{
    const breakdown=coachSessionDistanceBreakdown(session);
    return {date:session.date,phase:session.phase,type:session.type,mainKm:breakdown?.mainKm??session.workoutSpec?.qualityDistanceKm??null,totalKm:breakdown?.totalKm??session.targetDist??null,danielsClass:session.workoutSpec?.danielsClass||'',workloadCapKm:session.workoutSpec?.workloadCapKm??null,workloadTargetMinutes:session.workoutSpec?.workloadTargetMinutes??null,danielsReferenceCapKm:session.workoutSpec?.danielsReferenceCapKm??null};
  });
  const lapEvidence=since90.filter(activity=>window.MyDashActivityAnalysis?.analyze?.(activity)?.laps?.length).length;
  return {
    goal:{distance:plan.goalProfile?.distance||'',targetTime:plan.goalProfile?.targetTime||'',benchmark:plan.goalProfile?.benchmark||'',goalRisk:plan.athleteProfile?.goalRisk||'unknown',improvementPct:plan.athleteProfile?.improvementPct??null,enduranceReadiness:plan.athleteProfile?.enduranceReadiness||null},
    history:{recentWeeklyKm:plan.athleteProfile?.currentWeeklyKm??null,longestRecentRunKm:plan.athleteProfile?.longestRecentRunKm??null,activities90d:since90.length,paceBasis:plan.athleteProfile?.paceBasis||'',volumeBasis:plan.athleteProfile?.volumeBasis||'',confidence:plan.athleteProfile?.confidence||''},
    measurements:{averageHrSessions:since90.filter(activity=>Number.isFinite(+activity.hr)).length,cadenceSessions:since90.filter(activity=>Number.isFinite(+activity.cad)).length,strideSessions:since90.filter(activity=>Number.isFinite(+activity.stride)).length,lapEvidenceSessions:lapEvidence},
    guardrails:{validation:plan.validation?.errors||[],warnings:plan.validation?.warnings||[],weeklyTargetsKm:plan.validation?.weeklyTargetsKm||[],weeklyActualKm:plan.validation?.weeklyActualKm||[]},
    qualitySessions:quality
  };
}
function formatCoachContext(ctx){
  const gp=ctx.goalProfile;
  return [
    `Today: ${ctx.today}`,
    `Goal: ${gp.distance} ${gp.targetTime} (${gp.targetPace?formatPace(gp.targetPace)+'/km':'pace n/a'})`,
    `Benchmark: ${gp.benchmark||'not provided'}`,
    `Unavailable: ${gp.unavailableRaw||'none'}`,
    `Preferred long run day: ${gp.longRunDayName||coachWeekdayName(gp.longRunDay||0)}`,
    `Readiness: ${ctx.readiness.score}/100 ${ctx.readiness.level}`,
    `Readiness reasons: ${(ctx.readiness.reasons||[]).join(' | ')||'none'}`,
    `Load: acute ${Math.round(ctx.load.acute)}, chronic ${Math.round(ctx.load.chronicWeekly)}, ACWR ${ctx.load.acwr?.toFixed(2)??'n/a'}, monotony ${ctx.load.monotony?.toFixed(2)??'n/a'}, strain ${Math.round(ctx.load.strain)}`,
    `Volume: 7D ${ctx.volumes.d7}km, 30D ${ctx.volumes.d30}km, 90D ${ctx.volumes.d90}km`,
    `Phase schedule:\n${(ctx.phaseSchedule||[]).map(row=>`Week ${row.week}: ${row.phase} (${row.startDate})`).join('\n')}`,
    `Sources: ${JSON.stringify(ctx.sourceSummary)}`,
    `Latest activities:\n${ctx.latestActivities}`,
    `Wellness 14D:\n${ctx.wellnessRows}`,
    `Current plan:\n${ctx.planSummary}`
  ].join('\n');
}
function coachSafetyDecision(session=null){
  const readiness=calculateReadiness();
  const today=readiness.today;
  const hard=isHardSession(session?.type);
  const reasons=[...(readiness.reasons||[])];
  let status=readiness.score>=80?'green':readiness.score>=60?'yellow':'red';
  let action=status==='green'?'Do planned session':status==='yellow'?'Reduce volume/intensity':'Recovery or rest';
  if(today?.healthStatus==='sick'||today?.soreness>=7){status='red';action='Rest or very easy only';reasons.push('Sick/high pain rule blocks hard training');}
  if(today?.soreness>=5&&hard){status=status==='green'?'yellow':status;action='Downgrade hard session';reasons.push('Pain rule downgrades hard session');}
  if(readiness.load.acwr!==null&&readiness.load.acwr>1.5&&hard){status='red';action='No hard session';reasons.push('ACWR > 1.5 blocks hard training');}
  else if(readiness.load.acwr!==null&&readiness.load.acwr>1.3&&hard){status=status==='green'?'yellow':status;action='Shorten hard session';}
  if(readiness.restHours!==null&&readiness.restHours<18&&hard){status=status==='green'?'yellow':status;action='Avoid back-to-back hard load';}
  return {status,action,reasons:reasons.slice(0,5),readiness};
}
function coachSessionForDate(plan,date){
  return (plan?.sessions||[]).find(s=>s.date===date&&s.type!=='Rest')||null;
}
function coachRecoveryCardForDate(plan,date){
  return (plan?.recoveryCards||[]).find(card=>card.date===date)
    || (plan?.sessions||[]).find(session=>session.date===date&&session.recoveryAdvice)?.recoveryAdvice
    || null;
}
function coachDailyDecision(plan,date=toLocalDateStr()){
  const session=coachSessionForDate(plan,date);
  const recoveryCard=coachRecoveryCardForDate(plan,date);
  const safety=coachSafetyDecision(session);
  const goalProfile=getCoachGoalProfile(plan,{preferPlan:true});
  const completedDates=plan?.completedDates||{};
  const actualDone=getAllActivities().some(w=>w.date===date);
  const alreadyDone=!!completedDates[date]||actualDone;
  const unavailable=coachDateMatchesUnavailable(date,goalProfile);
  const reasons=[...(safety.reasons||[])];
  if(unavailable)reasons.unshift('Today is marked unavailable');
  if(alreadyDone)reasons.unshift('Workout already completed today');
  let action='keep';
  let applyLabel='No change needed';
  if(!session){action=recoveryCard?'recovery':'no_session';applyLabel='Record daily recovery check';}
  else if(alreadyDone){action='done';applyLabel='Record completed-day check';}
  else if(unavailable){action='move';applyLabel='Move today session to next safe day';}
  else if(safety.status==='red'){action='rest';applyLabel='Convert today to recovery/rest';}
  else if(safety.status==='yellow'&&isHardSession(session.type)){action='downgrade';applyLabel='Downgrade hard session to easy';}
  else if(safety.status==='yellow'){action='reduce';applyLabel='Reduce today volume';}
  const previous=plan?.dailyDecisions?.[date];
  return {
    date,session,recoveryCard,action,status:safety.status,applyLabel,
    reasons:reasons.slice(0,6),readinessScore:safety.readiness?.score??null,
    safety,alreadyApplied:!!previous?.appliedAt,previous
  };
}
function coachGoalImpact(plan,dailyDecision,adjustmentType){
  const gp=getCoachGoalProfile(plan,{preferPlan:true});
  const goalText=`${gp.distance||'Race'} ${gp.targetTime||''}`.trim();
  const raceDate=plan?.endDate||'';
  const action=dailyDecision.action;
  let risk='low';
  let note='ยังเดินตามเป้าหมายหลักได้';
  let preservesStimulus=true;
  if(action==='move'){
    note='คง session เดิมไว้ แต่เลื่อนไปวันที่ปลอดภัยก่อนวันแข่ง';
  }else if(action==='downgrade'){
    risk='medium';
    preservesStimulus=false;
    note='ลด intensity วันนี้เพื่อกัน overreach; ถ้าเกิดซ้ำกับ key workout ต้องให้ AI review ปรับสัปดาห์ถัดไป';
  }else if(action==='reduce'){
    risk='low';
    note='ลด volume วันนี้แต่ยังคง stimulus หลักของวันไว้';
  }else if(action==='rest'){
    risk='medium';
    preservesStimulus=false;
    note='พักเพื่อรักษาความต่อเนื่องระยะยาว; ห้ามชดเชยโหลดวันถัดไป และควรรีวิวแผนถ้าเกิดซ้ำ';
  }
  return {goal:goalText,raceDate,adjustmentType,goalRisk:risk,preservesStimulus,note};
}
function cloneCoachPlan(plan){
  return JSON.parse(JSON.stringify(plan||{}));
}
function coachApplyDailyDecisionToPlan(plan,dailyDecision){
  const next=cloneCoachPlan(plan);
  const date=dailyDecision.date;
  const session=coachSessionForDate(next,date);
  const before=session?{date:session.date,type:session.type,targetDist:session.targetDist,targetPace:session.targetPace,targetHR:session.targetHR}:null;
  let adjustment={type:'daily_check',date,action:dailyDecision.action,status:dailyDecision.status,readinessScore:dailyDecision.readinessScore,reasons:dailyDecision.reasons||[]};
  if(session&&dailyDecision.action==='move'){
    const target=coachFindMoveDate(next,session);
    if(!target)throw new Error('No safe move slot found in the next 10 days');
    session.date=target;
    session.notes=[session.notes,`Adaptive move from ${date}; no catch-up load added`].filter(Boolean).join(' · ');
    adjustment={...adjustment,type:'auto_move',from:date,to:target,sessionType:session.type,before};
  }else if(session&&dailyDecision.action==='rest'){
    session.type='Rest';
    session.description='พัก/ฟื้นตัววันนี้ - ระบบปรับจาก readiness รายวัน';
    session.targetDist=0;session.targetPace='';session.targetHR='';
    session.details=coachSessionDetails('Rest',0,getCoachGoalProfile(next,{preferPlan:true}));
    session.notes=[session.notes,'Adaptive coach changed today to rest; no catch-up doubling'].filter(Boolean).join(' · ');
    adjustment={...adjustment,type:'auto_rest',before,to:{type:session.type,targetDist:0}};
  }else if(session&&dailyDecision.action==='downgrade'){
    session.type='Easy';
    session.targetDist=Math.max(3,+(parseFloat(session.targetDist||5)*0.65).toFixed(1));
    session.targetPace='';
    session.targetHR=session.targetHR?Math.min(+session.targetHR,145):145;
    session.details=coachSessionDetails('Easy',session.targetDist,getCoachGoalProfile(next,{preferPlan:true}));
    session.description=session.details.targetDescription;
    session.notes=[session.notes,'Adaptive coach downgraded hard session to easy'].filter(Boolean).join(' · ');
    adjustment={...adjustment,type:'auto_downgrade',before,to:{type:session.type,targetDist:session.targetDist,targetHR:session.targetHR}};
  }else if(session&&dailyDecision.action==='reduce'){
    session.targetDist=Math.max(2,+(parseFloat(session.targetDist||4)*0.75).toFixed(1));
    session.targetHR=session.targetHR?Math.min(+session.targetHR,145):145;
    session.details=coachSessionDetails(session.type,session.targetDist,getCoachGoalProfile(next,{preferPlan:true}));
    session.description=session.details.targetDescription;
    session.notes=[session.notes,'Adaptive coach reduced volume today'].filter(Boolean).join(' · ');
    adjustment={...adjustment,type:'auto_reduce',before,to:{type:session.type,targetDist:session.targetDist,targetHR:session.targetHR}};
  }
  const goalImpact=coachGoalImpact(next,dailyDecision,adjustment.type);
  adjustment.goalImpact=goalImpact;
  next.dailyDecisions={...(next.dailyDecisions||{}),[date]:{
    date,action:dailyDecision.action,status:dailyDecision.status,
    readinessScore:dailyDecision.readinessScore,reasons:dailyDecision.reasons||[],
    appliedAt:Date.now(),changed:!['keep','done','no_session','recovery'].includes(dailyDecision.action),
    goalImpact
  }};
  return {plan:next,adjustment};
}
function coachDecisionColor(status){
  return status==='green'?'var(--green)':status==='yellow'?'var(--orange)':'var(--red)';
}
function coachReviewSessionLine(session,actual,completedDates,today){
  if(session.type==='Rest')return '';
  const isDone=!!completedDates[session.date]||!!actual;
  const status=isDone?'done':session.date<today?'missed':'upcoming';
  const actualText=actual?` actual:${actual.dist||0}km${actual.avgPace?` pace:${formatPace(actual.avgPace)}`:''}${actual.hr?` HR:${actual.hr}`:''}`:'';
  return `[${session.date}] ${session.phase||''} ${session.type} target:${session.targetDist||0}km ${status}${actualText}`;
}
function coachBuildCompactReview(plan){
  const today=toLocalDateStr();
  const allWks=getAllActivities();
  const completedDates=plan.completedDates||{};
  const nonRest=(plan.sessions||[]).filter(session=>session.type!=='Rest');
  const doneCount=nonRest.filter(session=>completedDates[session.date]||allWks.some(workout=>workout.date===session.date)).length;
  const missCount=nonRest.filter(session=>!completedDates[session.date]&&!allWks.some(workout=>workout.date===session.date)&&session.date<today).length;
  const recentSessions=(plan.sessions||[]).filter(session=>session.date<=datePlusDays(today,7)).slice(-10);
  const summaryLines=recentSessions.map(session=>{
    const actual=allWks.find(workout=>workout.date===session.date);
    return coachReviewSessionLine(session,actual,completedDates,today);
  }).filter(Boolean);
  return {
    doneCount,
    missCount,
    summary:[
      `Plan: ${plan.goal}`,
      `Progress: done ${doneCount} / missed ${missCount}`,
      `Recent schedule:`,
      summaryLines.join('\n')||'none',
      `Recent adjustments: ${JSON.stringify((plan.adjustments||[]).slice(-6))}`
    ].join('\n')
  };
}
function coachLocalReviewFallback(plan,context,safety,compact){
  const phase=coachPhaseForDate(toLocalDateStr(),plan.startDate,plan.totalWeeks);
  const action=safety.status==='red'?'พัก/ฟื้นตัว':safety.status==='yellow'?'คุมโหลดและลดความหนัก':'เดินตามแผนได้';
  return [
    `## Coach Review`,
    `Phase ตอนนี้: ${coachPhaseThai(phase)}`,
    `Progress: ทำแล้ว ${compact.doneCount} session · เลยวัน ${compact.missCount} session`,
    `Readiness วันนี้: ${context.readiness.score}/100 (${context.readiness.level})`,
    `Load: acute ${Math.round(context.load.acute)} · chronic ${Math.round(context.load.chronicWeekly)} · ACWR ${context.load.acwr?.toFixed(2)??'n/a'}`,
    `คำแนะนำตอนนี้: ${action}`,
    `เหตุผลหลัก: ${(safety.reasons||[]).slice(0,4).join(' | ')||'ไม่มีสัญญาณเสี่ยงเด่น'}`,
    `ถ้า AI timeout อีก ให้ใช้การตัดสินใจรายวันด้านบนก่อน และอย่าชดเชยโหลดด้วยการอัดซ้อมเพิ่ม`
  ].join('\n\n');
}
function coachDateMatchesUnavailable(dateStr,goalProfile){
  const unavailable=goalProfile?.unavailable||[];
  if(!unavailable.length)return false;
  if(window.MyDashTraining?.EngineV2?.unavailableSet&&window.MyDashTraining?.EngineV2?.isUnavailable){
    return window.MyDashTraining.EngineV2.isUnavailable(dateStr,window.MyDashTraining.EngineV2.unavailableSet(unavailable));
  }
  const d=new Date(dateStr+'T12:00:00');
  const weekday=d.toLocaleDateString('en-US',{weekday:'short'}).toLowerCase();
  const weekdayLong=d.toLocaleDateString('en-US',{weekday:'long'}).toLowerCase();
  return unavailable.some(raw=>{
    const item=String(raw||'').trim().toLowerCase();
    if(!item)return false;
    if(item===dateStr)return true;
    return weekday.startsWith(item.slice(0,3))||weekdayLong===item;
  });
}
function coachTrainingWeekdays(daysPerWeek,longRunDayRaw){
  const longRunDay=parseInt(longRunDayRaw);
  const longDay=Number.isFinite(longRunDay)?Math.max(0,Math.min(6,longRunDay)):0;
  const preferred=[2,4,6,1,3,5,0].filter(day=>day!==longDay);
  return [...preferred.slice(0,Math.max(1,(parseInt(daysPerWeek)||4)-1)),longDay].sort((a,b)=>a-b);
}
function coachDateForWeekday(startDate,week,weekday){
  const weekStart=new Date(datePlusDays(startDate,week*7)+'T12:00:00');
  const delta=(weekday-weekStart.getDay()+7)%7;
  weekStart.setDate(weekStart.getDate()+delta);
  return toLocalDateStr(weekStart);
}
function extractJsonObject(text){
  const cleaned=String(text||'').replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
  try{return JSON.parse(cleaned);}catch(_){}
  const start=cleaned.indexOf('{'),end=cleaned.lastIndexOf('}');
  if(start>=0&&end>start)return JSON.parse(cleaned.slice(start,end+1));
  throw new Error('AI response did not contain JSON');
}
function normalizeCoachType(type){
  const value=String(type||'Easy').toLowerCase();
  if(value.includes('interval'))return 'Interval';
  if(value.includes('tempo')||value.includes('threshold'))return 'Tempo';
  if(value.includes('long'))return 'Long';
  if(value.includes('recover'))return 'Recovery';
  if(value.includes('rest'))return 'Rest';
  return 'Easy';
}
function hasThaiText(value){
  return /[\u0E00-\u0E7F]/.test(String(value||''));
}
function coachSessionTypeThai(type){
  return {Easy:'วิ่งเบา',Tempo:'เทมโป',Interval:'อินเทอร์วัล',Long:'วิ่งยาว',Recovery:'ฟื้นตัว',Rest:'พัก'}[type]||'วิ่งเบา';
}
function coachSessionQualityLabel(session){
  const intent=session?.workoutSpec?.intent||session?.intent;
  return {
    speed_skill:'Strides',hill_strength:'Hill strength',repetition:'R pace',
    vo2:'I pace',threshold:'T pace',race_specific:`${window._coachPlan?.goalProfile?.distance||'Race'} pace`,
    steady:'Steady'
  }[intent]||'';
}
function coachSessionDistanceBreakdown(session){
  const raw=session?.workoutSpec?.distanceBreakdown;
  const value=key=>{const number=parseFloat(raw?.[key]);return Number.isFinite(number)&&number>=0?number:null;};
  const total=parseFloat(session?.targetDist);
  if(raw&&['warmupKm','mainKm','recoveryKm','cooldownKm','easyKm','totalKm'].every(key=>value(key)!==null)){
    return {warmupKm:value('warmupKm'),mainKm:value('mainKm'),recoveryKm:value('recoveryKm'),cooldownKm:value('cooldownKm'),easyKm:value('easyKm'),totalKm:value('totalKm')};
  }
  const main=parseFloat(session?.workoutSpec?.qualityDistanceKm);
  if(['Tempo','Interval'].includes(session?.type)&&Number.isFinite(main)&&main>=0&&Number.isFinite(total)){
    return {mainKm:main,totalKm:total,legacy:true};
  }
  return null;
}
function coachSessionDistanceSummary(session){
  const breakdown=coachSessionDistanceBreakdown(session);
  if(!breakdown)return session?.targetDist>0?`รวม ${session.targetDist} กม.`:'';
  const main=breakdown.mainKm>0?`งานหลัก ${breakdown.mainKm.toFixed(1)} กม.`:'';
  return [`รวม ${breakdown.totalKm.toFixed(1)} กม.`,main].filter(Boolean).join(' · ');
}
function coachSessionDistanceBreakdownText(session){
  const breakdown=coachSessionDistanceBreakdown(session);
  if(!breakdown)return '';
  if(breakdown.legacy)return `งานหลัก ${breakdown.mainKm.toFixed(1)} กม. · รวม ${breakdown.totalKm.toFixed(1)} กม. (รวมวอร์ม/คูลดาวน์; แผนเดิมไม่ได้บันทึกส่วนย่อย)`;
  const rows=[
    `วอร์ม ${breakdown.warmupKm.toFixed(1)} กม.`,
    `งานหลัก ${breakdown.mainKm.toFixed(1)} กม.`,
    breakdown.recoveryKm>0?`จ๊อกพัก ${breakdown.recoveryKm.toFixed(1)} กม.`:'',
    breakdown.easyKm>0?`วิ่งเบาเพิ่ม ${breakdown.easyKm.toFixed(1)} กม.`:'',
    `คูลดาวน์ ${breakdown.cooldownKm.toFixed(1)} กม.`,
    `รวม ${breakdown.totalKm.toFixed(1)} กม.`
  ].filter(Boolean);
  return rows.join(' · ');
}
function coachFormatDuration(seconds){
  const total=Math.max(0,Math.round(Number(seconds)||0));
  return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;
}
function coachSessionStructureText(session){
  const spec=session?.workoutSpec;
  const metrics=spec?.intervalMetrics;
  if(!spec?.repKm||!metrics)return '';
  const sets=Math.max(1,parseInt(metrics.sets)||parseInt(spec.sets)||1);
  const repsPerSet=Math.max(1,parseInt(metrics.repsPerSet)||parseInt(spec.repsPerSet)||parseInt(spec.reps)||1);
  const work=Number.isFinite(metrics.workDurationMinutes)?coachFormatDuration(metrics.workDurationMinutes*60):'';
  const recovery=Number.isFinite(metrics.recoveryMinutes)?coachFormatDuration(metrics.recoveryMinutes*60):'';
  const shape=sets>1?`${sets} sets x ${repsPerSet} reps`:`${repsPerSet} reps`;
  return [shape,work?`work ${work}`:'',recovery?`recovery ${recovery}`:''].filter(Boolean).join(' · ');
}
function coachSessionDetails(type,dist,goalProfile,week=0){
  const targetPace=goalProfile?.targetPace||4.8;
  const easyPace=formatPace(targetPace+1.0);
  const steadyPace=formatPace(targetPace+0.45);
  const tempoPace=formatPace(targetPace+0.08);
  const intervalPace=formatPace(Math.max(3.8,targetPace-0.18));
  const km=Math.max(0,parseFloat(dist)||0);
  if(type==='Interval'){
    const reps=week<3?'6 x 400m':week<7?'5 x 800m':'4 x 1km';
    return {
      warmup:`วิ่งเบา 1.5-2 กม. + drill เคลื่อนไหวขา/สะโพก + strides 4 x 20 วินาที`,
      mainSet:`${reps} ที่ความเร็วประมาณ ${intervalPace}/กม. พัก jog/walk 200-400 ม. ระหว่างเซ็ต`,
      cooldown:`วิ่งเบา 1-1.5 กม. จบแบบผ่อน ไม่เร่งท้าย`,
      execution:`วิ่งเร็วแต่ต้องคุมฟอร์มได้ ถ้าฟอร์มเสีย เจ็บ หรือ HR พุ่งผิดปกติให้หยุดเซ็ตนั้น`,
      successCriteria:`ทุกเซ็ตใกล้ pace เป้าหมายในช่วง 5-8 วินาที/กม. เซ็ตสุดท้ายยังคุมได้ และปวดไม่เกิน 3/10`,
      intensity:'หนัก',
      targetDescription:`ซ้อมความเร็วรอบ ${intervalPace}/กม. รวมประมาณ ${km.toFixed(1)} กม.`
    };
  }
  if(type==='Tempo'){
    return {
      warmup:`วิ่งเบา 1.5-2 กม. + strides 3-4 รอบ`,
      mainSet:`เทมโป ${Math.max(2,(km-3).toFixed(1))} กม. ที่ประมาณ ${tempoPace}-${steadyPace}/กม. หนักแบบคุมได้`,
      cooldown:`วิ่งเบา 1 กม.`,
      execution:`คุมลมหายใจให้สม่ำเสมอ ไม่ใช่การแข่ง จบแล้วยังควรเหลือแรงอีกหนึ่งเกียร์`,
      successCriteria:`pace ไม่แกว่งมาก HR คุมได้ RPE ประมาณ 7/10 และฟอร์มไม่พัง`,
      intensity:'กลาง-หนัก',
      targetDescription:`ซ้อม threshold/tempo ประมาณ ${tempoPace}-${steadyPace}/กม.`
    };
  }
  if(type==='Long'){
    return {
      warmup:`10 นาทีแรกให้ช้ามากเพื่อเปิดระบบ`,
      mainSet:`วิ่งยาว ${km.toFixed(1)} กม. ประมาณ ${easyPace}/กม. หรือ HR โซน 2`,
      cooldown:`เดิน 5 นาที + mobility เบา ๆ`,
      execution:`ต้องยังพูดเป็นประโยคได้ อย่าไล่ pace ถ้า HR สูงหรืออากาศร้อน`,
      successCriteria:`จบแล้วยังสดพอซ้อมต่อใน 24-48 ชม. และปวดไม่เกิน 3/10`,
      intensity:'ง่าย-ยาว',
      targetDescription:`วิ่งยาวสร้างฐานแอโรบิก เน้นโซน 2`
    };
  }
  if(type==='Recovery'||type==='Rest'){
    return {
      warmup:type==='Rest'?'ไม่ต้อง warmup':'เดินหรือ jog เบามาก 5-10 นาที',
      mainSet:type==='Rest'?'พักจริง เน้นนอน/ยืด/ฟื้นตัว ไม่เพิ่มโหลด':'jog หรือเดินฟื้นตัวเบามาก คุม HR ต่ำ',
      cooldown:'mobility 8-12 นาที',
      execution:'เป้าหมายคือฟื้นตัว ถ้าล้าเพิ่มหรือปวดมากขึ้นให้หยุด',
      successCriteria:'หลังจบควรรู้สึกดีขึ้น ไม่ใช่เหนื่อยขึ้น',
      intensity:'ฟื้นตัว',
      targetDescription:type==='Rest'?'พัก ไม่เพิ่มโหลดวิ่ง':'ฟื้นตัวเท่านั้น'
    };
  }
  return {
    warmup:`5-10 นาทีแรกวิ่งเบามาก`,
    mainSet:`วิ่งเบา ${km.toFixed(1)} กม. ประมาณ ${easyPace}/กม. หรือ HR โซน 2`,
    cooldown:`เดิน 5 นาที + ยืดเบาได้ถ้าต้องการ`,
    execution:`ต้องคุยได้ หายใจคุมได้ วันนี้ห้ามกลายเป็น tempo`,
    successCriteria:`HR ค่อนข้างนิ่ง RPE 3-4/10 และปวดไม่เกิน 3/10`,
    intensity:'ง่าย',
    targetDescription:`วิ่งเบาแอโรบิกประมาณ ${easyPace}/กม.`
  };
}
function coachSessionDisplayDetails(session,index=0){
  const fallback=coachSessionDetails(session.type,session.targetDist,getCoachGoalProfile(window._coachPlan,{preferPlan:true}),Math.floor(index/4));
  const raw=session.details&&typeof session.details==='object'?session.details:{};
  const useRaw=hasThaiText(Object.values(raw).join(' '));
  return useRaw?{...fallback,...raw}:fallback;
}
function coachSessionDisplayDescription(session,index=0){
  const d=coachSessionDisplayDetails(session,index);
  return hasThaiText(session.description)?session.description:(d.targetDescription||coachSessionTypeThai(session.type));
}
function coachSessionDateScore(session,index=0){
  const priorityScore={key:300,normal:200,optional:100}[session.priority]||0;
  const typeScore={Long:90,Interval:80,Tempo:70,Easy:50,Recovery:40,Rest:10}[session.type]||20;
  const distScore=Math.min(50,Math.round((parseFloat(session.targetDist)||0)*2));
  return priorityScore+typeScore+distScore-(index*.001);
}
function dedupeCoachSessionsByDate(sessions){
  const byDate=new Map();
  sessions.forEach((session,index)=>{
    const current=byDate.get(session.date);
    if(!current||coachSessionDateScore(session,index)>coachSessionDateScore(current.session,current.index)){
      if(current){
        session.notes=[session.notes,'Same-day duplicate removed by planner guard; MyDash keeps one workout per date.'].filter(Boolean).join(' | ');
      }
      byDate.set(session.date,{session,index});
    }else{
      current.session.notes=[current.session.notes,'Same-day duplicate removed by planner guard; MyDash keeps one workout per date.'].filter(Boolean).join(' | ');
    }
  });
  return [...byDate.values()].map(row=>row.session).sort((a,b)=>a.date.localeCompare(b.date));
}
function coachApplyPromptDateGuard(prompt,days){
  const rule=[
    '- Each calendar date may appear at most once in sessions. Never schedule two workouts on the same YYYY-MM-DD.',
    `- Keep weekly non-rest sessions at or below ${parseInt(days)||4}. Do not stack an easy run and quality workout on the same day.`,
    '- The calendar day immediately before Race/GoalDate must not be Tempo, Interval, or Long. Use Rest or very light shakeout only.'
  ].join('\n');
  return String(prompt).replace('- No hard sessions on consecutive days.', `${rule}\n- No hard sessions on consecutive days.`)
    .replace('but never put a workout on Race/GoalDate.', 'with one session maximum per date, but never put a workout on Race/GoalDate.');
}
function coachIsRaceEve(date,raceDate){
  if(!date||!raceDate)return false;
  return datePlusDays(date,1)===raceDate;
}
function coachApplyPhaseRule(session,phase,{raceDate='',goalProfile={},index=0}={}){
  if(!session)return session;
  const raceMinus2=raceDate?datePlusDays(session.date,2)===raceDate:false;
  const applyEasy=(note,distCap=null)=>{
    session.type='Easy';
    if(distCap!==null)session.targetDist=Math.min(session.targetDist||distCap,distCap);
    session.targetPace='';
    session.targetHR=145;
    session.details=coachSessionDetails('Easy',session.targetDist,goalProfile,index);
    session.description=session.details.targetDescription;
    session.notes=[session.notes,note].filter(Boolean).join(' · ');
  };
  if(phase==='Base'&&session.type==='Interval'){
    session.type='Tempo';
    session.targetPace=session.targetPace||formatPace((goalProfile?.targetPace||4.8)+0.12);
    session.details=coachSessionDetails('Tempo',session.targetDist,goalProfile,index);
    session.description=session.details.targetDescription;
    session.notes=[session.notes,'Base phase guard: replace interval with controlled tempo'].filter(Boolean).join(' · ');
  }
  if(phase==='Taper'){
    if(session.type==='Long')applyEasy('Taper guard: remove long-run fatigue before race',6);
    if(session.type==='Interval'){
      session.type='Tempo';
      session.targetDist=Math.max(3,+(parseFloat(session.targetDist||5)*0.75).toFixed(1));
      session.targetPace=session.targetPace||formatPace((goalProfile?.targetPace||4.8)+0.08);
      session.details=coachSessionDetails('Tempo',session.targetDist,goalProfile,index);
      session.description=session.details.targetDescription;
      session.notes=[session.notes,'Taper guard: shorten interval into controlled tempo'].filter(Boolean).join(' · ');
    }
  }
  if(phase==='RaceWeek'){
    if(coachIsRaceEve(session.date,raceDate)){
      session.type='Rest';
      session.targetDist=0;
      session.targetPace='';
      session.targetHR='';
      session.details=coachSessionDetails('Rest',0,goalProfile,index);
      session.description='พักก่อนวันแข่ง เพื่อให้ขาสดและไม่สะสมความล้าเพิ่ม';
      session.notes=[session.notes,'Race-week guard: rest on the day before race'].filter(Boolean).join(' · ');
      return session;
    }
    if(raceMinus2&&isHardSession(session.type))applyEasy('Race-week guard: no hard session within 48 hours of race',3.5);
    else if(isHardSession(session.type))applyEasy('Race-week guard: keep race week light and fresh',4);
  }
  return session;
}
function validateCoachPlan(plan,{goal,startDate,endDate,totalWeeks,goalProfile}){
  if(!plan||typeof plan!=='object')throw new Error('Plan JSON is not an object');
  const sessions=Array.isArray(plan.sessions)?plan.sessions:[];
  if(!sessions.length)throw new Error('Plan JSON has no sessions');
  const raceDate=endDate||plan.endDate||'';
  const normalized=sessions.map((session,index)=>{
    const date=String(session.date||'').match(/^\d{4}-\d{2}-\d{2}$/)?session.date:datePlusDays(startDate,index);
    const type=normalizeCoachType(session.type);
    const phase=coachPhaseForDate(date,startDate,totalWeeks);
    const targetDist=Math.max(0,+(parseFloat(session.targetDist||0)||0).toFixed(1));
    const details=session.details&&typeof session.details==='object'
      ? session.details
      : coachSessionDetails(type,targetDist,goalProfile,Math.floor(index/4));
    return {
      date,phase,type,
      description:String(session.description||type).slice(0,160),
      targetDist:type==='Rest'?0:targetDist,
      targetPace:String(session.targetPace||'').slice(0,20),
      targetHR:session.targetHR?parseInt(session.targetHR)||'':'',
      notes:String(session.notes||'').slice(0,240),
      priority:['key','normal','optional'].includes(session.priority)?session.priority:(isHardSession(type)?'key':'normal'),
      details:{
        warmup:String(details.warmup||'').slice(0,240),
        mainSet:String(details.mainSet||'').slice(0,360),
        cooldown:String(details.cooldown||'').slice(0,240),
        execution:String(details.execution||'').slice(0,360),
        successCriteria:String(details.successCriteria||'').slice(0,320),
        intensity:String(details.intensity||'').slice(0,80),
        targetDescription:String(details.targetDescription||'').slice(0,180)
      }
    };
  }).filter(session=>!(raceDate&&session.date===raceDate));
  const uniqueSessions=dedupeCoachSessionsByDate(normalized);
  for(let i=1;i<uniqueSessions.length;i++){
    const prev=uniqueSessions[i-1],cur=uniqueSessions[i];
    if(isHardSession(prev.type)&&isHardSession(cur.type)){
      const days=(new Date(cur.date+'T12:00:00')-new Date(prev.date+'T12:00:00'))/86400000;
      if(days<=1){cur.type='Easy';cur.notes=[cur.notes,'ลดเป็นวิ่งเบาอัตโนมัติเพื่อเลี่ยงซ้อมหนักติดกัน'].filter(Boolean).join(' · ');cur.details=coachSessionDetails(cur.type,cur.targetDist,goalProfile,Math.floor(i/4));cur.description=cur.details.targetDescription;}
    }
  }
  uniqueSessions.forEach((session,index)=>{
    session.phase=session.phase||coachPhaseForDate(session.date,startDate,totalWeeks);
    coachApplyPhaseRule(session,session.phase,{raceDate,goalProfile,index:Math.floor(index/4)});
  });
  return {
    goal:plan.goal||goal,
    startDate:plan.startDate||startDate,
    endDate:plan.endDate||endDate,
    totalWeeks:plan.totalWeeks||totalWeeks,
    sessions:uniqueSessions,
    phaseSchedule:coachPhaseSchedule(plan.startDate||startDate,plan.totalWeeks||totalWeeks),
    goalProfile
  };
}
function coachPhaseLongDistance(phase,week,baseLong){
  if(phase==='Base')return +(baseLong+Math.min(week,4)*0.8).toFixed(1);
  if(phase==='Build')return +(baseLong+2+Math.min(week,5)*0.7).toFixed(1);
  if(phase==='Peak')return +(baseLong+3+Math.min(week,2)*0.5).toFixed(1);
  if(phase==='Taper')return +(Math.max(5,baseLong*0.8)).toFixed(1);
  return +(Math.max(3,baseLong*0.5)).toFixed(1);
}
function coachPhaseSessionForSlot(phase,slot,week,goalProfile){
  if(slot==='long'){
    return {type:phase==='RaceWeek'?'Easy':'Long',dist:coachPhaseLongDistance(phase,week,8),pace:''};
  }
  if(phase==='Base'){
    if(slot===0)return {type:'Easy',dist:+(4.5+Math.min(week,4)*0.5).toFixed(1),pace:''};
    if(slot===1)return {type:week%2===0?'Tempo':'Easy',dist:+(5+Math.min(week,3)*0.4).toFixed(1),pace:week%2===0&&goalProfile.targetPace?formatPace(goalProfile.targetPace+0.15):''};
    return {type:'Recovery',dist:+(4+Math.min(week,3)*0.3).toFixed(1),pace:''};
  }
  if(phase==='Build'){
    if(slot===0)return {type:'Easy',dist:+(5+Math.min(week,5)*0.4).toFixed(1),pace:''};
    if(slot===1)return {type:week%2?'Tempo':'Interval',dist:+(5.5+Math.min(week,5)*0.5).toFixed(1),pace:goalProfile.targetPace?formatPace(goalProfile.targetPace+(week%2?0.1:-0.08)):''};
    return {type:'Easy',dist:+(4.5+Math.min(week,4)*0.4).toFixed(1),pace:''};
  }
  if(phase==='Peak'){
    if(slot===0)return {type:'Easy',dist:+(5+Math.min(week,2)*0.3).toFixed(1),pace:''};
    if(slot===1)return {type:week%2?'Interval':'Tempo',dist:+(6+Math.min(week,2)*0.4).toFixed(1),pace:goalProfile.targetPace?formatPace(goalProfile.targetPace+(week%2?-0.1:0.05)):''};
    return {type:'Recovery',dist:4,pace:''};
  }
  if(phase==='Taper'){
    if(slot===0)return {type:'Easy',dist:4.5,pace:''};
    if(slot===1)return {type:'Tempo',dist:4.5,pace:goalProfile.targetPace?formatPace(goalProfile.targetPace+0.1):''};
    return {type:'Recovery',dist:3.5,pace:''};
  }
  if(slot===0)return {type:'Easy',dist:4,pace:''};
  if(slot===1)return {type:'Recovery',dist:3,pace:''};
  return {type:'Rest',dist:0,pace:''};
}
function buildFallbackTrainingPlan({goal,startDate,endDate,totalWeeks,days,context,level}){
  const goalProfile=context.goalProfile;
  const daysPerWeek=parseInt(days)||4;
  const pattern=coachTrainingWeekdays(daysPerWeek,goalProfile.longRunDay);
  const longDay=parseInt(goalProfile.longRunDay||0);
  const sessions=[];
  const baseLong=level==='advanced'?10:level==='beginner'?6:8;
  for(let week=0;week<totalWeeks;week++){
    const phase=coachPhaseForWeek(week,totalWeeks);
    let nonLongSlot=0;
    pattern.forEach((weekdayIndex)=>{
      let date=coachDateForWeekday(startDate,week,weekdayIndex);
      if(date<startDate)return;
      if(endDate&&date>=endDate)return;
      let guard=0;
      while(coachDateMatchesUnavailable(date,goalProfile)&&guard<6){date=datePlusDays(date,1);guard++;}
      if(endDate&&date>=endDate)return;
      const slot=weekdayIndex===longDay?'long':nonLongSlot++;
      const choice=coachPhaseSessionForSlot(phase,slot,week,goalProfile);
      let type=choice.type,dist=choice.dist,pace=choice.pace;
      if(slot==='long'&&choice.type==='Long')dist=coachPhaseLongDistance(phase,week,baseLong);
      const details=coachSessionDetails(type,dist,goalProfile,week);
      sessions.push({
        date,phase,type,
        description:details.targetDescription,
        targetDist:dist,
        targetPace:pace,
        targetHR:type==='Easy'?145:'',
        notes:`แผน fallback แบบมีโครงสร้าง กดรายละเอียดก่อนวิ่ง และลดโหลดถ้าร่างกายไม่พร้อม`,
        priority:isHardSession(type)?'key':'normal',
        details
      });
    });
  }
  return validateCoachPlan({goal,startDate,endDate,totalWeeks,sessions},{goal,startDate,endDate,totalWeeks,goalProfile});
}
async function generateTrainingPlan(){
  const goal=document.getElementById('coach-goal')?.value?.trim();
  if(!goal){showToast('กรุณาใส่เป้าหมาย','error');return;}
  if(!window._fb?.isSignedIn?.()){showToast('กรุณา Sign in ก่อนสร้างและบันทึกแผนลง Cloud','error');showPage('settings');return;}
  const level=document.getElementById('coach-level')?.value;
  const days=document.getElementById('coach-days')?.value;
  const startDate=document.getElementById('coach-start-date')?.value||toLocalDateStr();
  const endDate=document.getElementById('coach-end-date')?.value||'';
  // Compute weeks: prefer end-start, else selector
  let totalWeeks = parseInt(document.getElementById('coach-weeks')?.value) || 8;
  if (endDate && endDate > startDate) {
    const diff = Math.round((new Date(endDate+'T00:00:00') - new Date(startDate+'T00:00:00')) / (7*86400000));
    if (diff > 0) totalWeeks = diff;
  }
  const context=buildCoachContext();
  const weeklyInput=document.getElementById('coach-weekly-km');
  const confirmedWeeklyKm=parseFloat(weeklyInput?.value);
  const hasConfirmedWeeklyKm=Number.isFinite(confirmedWeeklyKm)&&confirmedWeeklyKm>0;
  const historyWeeklyKm=context.volumes.d30/4.285;
  if(!hasConfirmedWeeklyKm&&!historyWeeklyKm){
    const missingBaselineOutput=document.getElementById('coach-output');
    if(missingBaselineOutput)missingBaselineOutput.innerHTML='<span style="color:var(--red)">Please enter your weekly running distance before creating a plan. MyDash has no running history in the last 30 days to use as a baseline.</span>';
    return;
  }
  const out=document.getElementById('coach-output');
  if(out){out.style.color='var(--text2)';out.innerHTML='กำลังสร้างแผนด้วย Training Engine V2...';}
  const btn=document.getElementById('btn-coach');if(btn){btn.innerHTML='กำลังสร้างแผน...';btn.disabled=true;}
  try{
    if(!window.MyDashTraining?.EngineV2)throw new Error('Training Engine V2 is not loaded');
    if(!window.MyDashCoachRepository)throw new Error('Coach repository is not loaded');
    const planPayload=window.MyDashTraining.EngineV2.createPlan({
      goal,distance:context.goalProfile.distance,targetTime:context.goalProfile.targetTime,benchmark:context.goalProfile.benchmark,
      level,daysPerWeek:days,startDate,endDate,totalWeeks,longRunDay:context.goalProfile.longRunDay,
      unavailable:context.goalProfile.unavailable,unavailableRaw:context.goalProfile.unavailableRaw,
      currentWeeklyKm:hasConfirmedWeeklyKm?confirmedWeeklyKm:historyWeeklyKm,currentWeeklyKmSource:hasConfirmedWeeklyKm?'manual':'activity_history',recentActivities:getAllActivities(),asOfDate:toLocalDateStr(),
      athleteSettings:typeof getAthleteProfile==='function'?getAthleteProfile():(window._athleteProfile||{})
    });
    if(!planPayload.validation?.valid)throw new Error(`Plan validation failed: ${planPayload.validation?.errors?.join(', ')||'unknown error'}`);
    await window.MyDashCoachRepository.savePlan(planPayload);
    const savedPlan=await window._fb.getData('coach_plan');
    if(!savedPlan?.createdAt||savedPlan.createdAt!==planPayload.createdAt)throw new Error('Cloud save failed. Please sign in again and retry.');
    AppState.set('coachPlan',savedPlan);
    const athlete=planPayload.athleteProfile||{};
    const easy=athlete.effortTargets?.easy||{};
    const tempo=athlete.effortTargets?.tempo||{};
    const easyRange=easy.paceFast&&easy.paceSlow?`${window.MyDashTraining.EngineV2.formatPace(easy.paceFast)}-${window.MyDashTraining.EngineV2.formatPace(easy.paceSlow)}/km`:'n/a';
    const tempoRange=tempo.paceFast&&tempo.paceSlow?`${window.MyDashTraining.EngineV2.formatPace(tempo.paceFast)}-${window.MyDashTraining.EngineV2.formatPace(tempo.paceSlow)}/km`:'n/a';
    const endurance=athlete.enduranceReadiness||{};
    const enduranceText=endurance.status&&endurance.status!=='not_required'?`<br>Cross-distance endurance: ${escapeHTML(endurance.status)} · longest ${escapeHTML(endurance.longestRunKm)} km · sustained runs ${escapeHTML(endurance.sustainedRuns)} · I/race-specific scale ${escapeHTML(Math.round((endurance.qualityScale||1)*100))}%`:'';
    const warning=planPayload.validation.warnings.length?`<br><span style="color:var(--orange)">ตรวจเพิ่ม: ${escapeHTML(planPayload.validation.warnings.join(', '))}</span>`:'';
    if(out){out.style.color='var(--text)';out.innerHTML=`<div style="color:var(--green);font-weight:700;margin-bottom:10px">สร้างและบันทึก Training Engine V2 แล้ว</div><div style="font-size:12px;color:var(--text2)">Goal: <strong style="color:var(--text)">${escapeHTML(planPayload.goal)}</strong><br>${planPayload.sessions.length} sessions · ${planPayload.totalWeeks} weeks · ${escapeHTML(planPayload.goalProfile.distance)}<br>Easy: ${escapeHTML(easyRange)}${easy.hrMin&&easy.hrMax?` · HR ${escapeHTML(easy.hrMin)}-${escapeHTML(easy.hrMax)}`:''}<br>Tempo: ${escapeHTML(tempoRange)}${tempo.hrMin&&tempo.hrMax?` · HR ${escapeHTML(tempo.hrMin)}-${escapeHTML(tempo.hrMax)}`:''}<br>Pace basis: ${escapeHTML(athlete.paceBasis||'conservative')} · easy evidence ${escapeHTML(athlete.easyPaceEvidence?.sessions||0)} runs · confidence ${escapeHTML(athlete.confidence||'low')}${enduranceText}${warning}</div>`;}
    showToast('สร้างแผน V2 และบันทึก Cloud แล้ว','success');
    if(out)out.innerHTML+=`<div style="font-size:12px;color:var(--text2);margin-top:6px">Weekly running baseline used: <strong style="color:var(--text)">${escapeHTML(athlete.currentWeeklyKm)} km</strong> (${escapeHTML(athlete.volumeBasis||'unknown')})</div>`;
  }catch(e){if(out)out.innerHTML=`<span style="color:var(--red)">⚠️ ${e.message}</span>`;}
  finally{if(btn){btn.innerHTML='สร้างแผน + บันทึก Firebase';btn.disabled=false;}}
}

function switchCoachTab(tab,el){
  document.querySelectorAll('#page-coach .seg-tab').forEach(t=>t.classList.remove('active'));
  const tabs=document.querySelectorAll('#page-coach .seg-tab');
  if(tab==='create')tabs[0]?.classList.add('active');
  else if(tab==='track')tabs[1]?.classList.add('active');
  else if(tab==='race')tabs[2]?.classList.add('active');
  document.getElementById('coach-create-tab').style.display=tab==='create'?'block':'none';
  document.getElementById('coach-track-tab').style.display=tab==='track'?'block':'none';
  document.getElementById('coach-race-tab').style.display=tab==='race'?'block':'none';
  if(tab==='track')renderCoachTracking();
  if(tab==='race')loadRaces();
}

function renderCoachPlanInsights(plan){
  const el=document.getElementById('coach-plan-insights');
  if(!el||!window.MyDashTrainingDashboard?.build){if(el)el.innerHTML='';return;}
  const vm=window.MyDashTrainingDashboard.build(plan,{activities:getAllActivities(),wellness:window._wellness||[],today:toLocalDateStr()});
  const summary=vm.summary;
  const intensityTotal=Math.max(1,Object.values(vm.intensity).reduce((sum,row)=>sum+row.km,0));
  const intensityLabels={easy:'Easy',quality:'Quality',long:'Long',recovery:'Recovery',rest:'Rest'};
  const intensityColors={easy:'var(--green)',quality:'var(--orange)',long:'var(--accent)',recovery:'var(--accent)',rest:'var(--text3)'};
  const intensityRows=['easy','quality','long','recovery'].map(key=>{
    const row=vm.intensity[key];
    const pct=Math.round(row.km/intensityTotal*100);
    return `<div class="intensity-row"><div>${intensityLabels[key]}</div><div class="intensity-track"><div class="intensity-fill" style="width:${pct}%;background:${intensityColors[key]}"></div></div><div>${row.km} km</div></div>`;
  }).join('');
  const recoveryTotal=Object.values(vm.recoverySummary||{}).reduce((sum,value)=>sum+(parseInt(value)||0),0);
  const currentWeek=vm.weekly.find(week=>plan.sessions?.some(session=>session.week===week.week&&session.date>=vm.today))||vm.weekly[vm.weekly.length-1]||null;
  const weekCells=vm.weekly.slice(0,12).map(week=>`<div class="training-week-cell"><strong>W${week.week}</strong><span>${escapeHTML(week.phase)}</span><span>${week.plannedKm} / ${week.targetVolumeKm} km</span><span>Q ${week.qualitySessions} · R ${week.recoverySessions}</span></div>`).join('');
  el.innerHTML=`<div class="training-insights">
    <div class="training-insight-panel">
      <div class="card-label">Training Load</div>
      <div class="training-kpi-grid">
        <div class="training-kpi"><div class="training-kpi-value">${summary.completionPct}%</div><div class="training-kpi-label">Completion</div></div>
        <div class="training-kpi"><div class="training-kpi-value">${summary.completedKm}</div><div class="training-kpi-label">Done km</div></div>
        <div class="training-kpi"><div class="training-kpi-value">${summary.plannedKm}</div><div class="training-kpi-label">Plan km</div></div>
        <div class="training-kpi"><div class="training-kpi-value">${recoveryTotal}</div><div class="training-kpi-label">Recovery days</div></div>
      </div>
      <div class="training-week-strip">${weekCells}</div>
    </div>
    <div class="training-insight-panel">
      <div class="card-label">Intensity Distribution</div>
      ${intensityRows}
      <div class="coach-recovery-summary" style="margin-top:12px">${currentWeek?`Current week: W${currentWeek.week} ${escapeHTML(currentWeek.phase)} · ${currentWeek.plannedKm} km planned · ${currentWeek.qualitySessions} quality`:'No weekly model available'}</div>
    </div>
  </div>`;
}

function renderCoachTracking(){
  const plan=window._coachPlan;
  const noplan=document.getElementById('coach-no-plan'),planView=document.getElementById('coach-plan-view');
  if(!plan?.sessions?.length){if(noplan)noplan.style.display='block';if(planView)planView.style.display='none';return;}
  if(noplan)noplan.style.display='none';if(planView)planView.style.display='block';
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  const today=toLocalDateStr();
  const currentPhase=coachCurrentPhase(plan,today);
  set('coach-plan-goal-disp','🎯 '+(plan.goal||'—'));
  set('coach-plan-meta-disp',`START ${plan.startDate||'—'} · ${plan.totalWeeks||4} WKS · ${plan.sessions.length} SESSIONS · ${coachPhaseThai(currentPhase).toUpperCase()}`);
  const completedDates=plan.completedDates||{};
  const workoutDates=new Set(getAllActivities().map(w=>w.date));
  let doneCount=0,missCount=0,remainCount=0;
  plan.sessions.forEach(s=>{if(s.type==='Rest')return;if(completedDates[s.date]||workoutDates.has(s.date))doneCount++;else if(s.date<today)missCount++;else remainCount++;});
  set('coach-done-count',doneCount);set('coach-miss-count',missCount);set('coach-remain-count',remainCount);
  const totalNonRest=plan.sessions.filter(s=>s.type!=='Rest').length;
  const pct=totalNonRest>0?Math.round(doneCount/totalNonRest*100):0;
  set('coach-progress-pct',pct+'%');
  const pb=document.getElementById('coach-progress-bar');if(pb)pb.style.width=pct+'%';
  renderCoachPlanInsights(plan);
  renderCoachDailyDecision(plan);
  const daysEl=document.getElementById('coach-plan-days');if(!daysEl)return;
  const typeEmoji={Easy:'🟢',Recovery:'🟦',Tempo:'🟡',Interval:'🔴',Long:'🔵',Rest:'⚪'};
  const typeColor={Easy:'var(--green)',Recovery:'var(--accent)',Tempo:'var(--orange)',Interval:'var(--red)',Long:'var(--accent)',Rest:'var(--text3)'};
  window._coachRenderedSessions=plan.sessions;
  daysEl.innerHTML=plan.sessions.map((s,index)=>{
    const isToday=s.date===today,isFuture=s.date>today,isRest=s.type==='Rest';
    const actualWks=getAllActivities().filter(w=>w.date===s.date);
    const isDone=!!completedDates[s.date]||actualWks.length>0;
    const isMissed=!isDone&&s.date<today&&!isRest;
    let cls='plan-day';
    if(isToday)cls+=' today-row';else if(isDone)cls+=' done';else if(isMissed)cls+=' missed';
    let badge='';
    if(isRest)badge='<span class="plan-badge badge-upcoming">🛌 พัก</span>';
    else if(isDone)badge='<span class="plan-badge badge-done">✅ ทำแล้ว</span>';
    else if(isMissed)badge='<span class="plan-badge badge-missed">❌ เลยวัน</span>';
    else if(isToday)badge='<span class="plan-badge badge-today">📍 วันนี้</span>';
    else badge='<span class="plan-badge badge-upcoming">⏳ รอซ้อม</span>';
    const dateStr=new Date(s.date+'T00:00:00').toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short'});
    const phaseLabel=coachPhaseThai(s.phase||coachPhaseForDate(s.date,plan.startDate,plan.totalWeeks));
    const displayDetails=coachSessionDisplayDetails(s,index);
    const displayDescription=coachSessionDisplayDescription(s,index);
    const displayType=coachSessionQualityLabel(s)||coachSessionTypeThai(s.type);
    const recoveryLine=s.recoveryAdvice?.summary?`<div class="coach-session-note">Recovery: ${escapeHTML(s.recoveryAdvice.summary)}</div>`:'';
    let actualLine='';
    if(actualWks.length){const aw=actualWks[0];actualLine=`<div style="font-size:11px;color:var(--green);margin-top:5px;font-weight:600;font-family:var(--font-mono)">📊 ${aw.dist}km${aw.avgPace?' · '+formatPace(aw.avgPace)+'/km':''}${aw.hr?' · ♥'+aw.hr:''}</div>`;if(s.targetDist>0&&aw.dist>0){const diff=((parseFloat(aw.dist)-s.targetDist)/s.targetDist*100).toFixed(0);const c=Math.abs(diff)<=10?'var(--green)':(diff>0?'var(--accent)':'var(--orange)');actualLine+=`<div style="font-size:10px;color:${c};margin-top:2px;font-family:var(--font-mono)">${diff>0?'↑':'↓'} ${Math.abs(diff)}% from target</div>`;}}
    return `<div class="${cls}"><div class="plan-day-header"><div class="plan-day-date">${dateStr} · ${escapeHTML(phaseLabel)}</div>${badge}</div>
      <div class="coach-plan-row"><span class="coach-session-icon">${typeEmoji[s.type]||'🏃'}</span>
      <div class="coach-session-main"><div class="coach-session-title" style="color:${typeColor[s.type]||'var(--text)'}">${displayType}${coachSessionDistanceSummary(s)?' · '+escapeHTML(coachSessionDistanceSummary(s)):''}</div>
      <div class="coach-session-desc">${escapeHTML(displayDescription)}${(s.targetPaceRange||s.targetPace)?' · pace '+escapeHTML(s.targetPaceRange||s.targetPace):''}${s.targetHR?' · HR < '+escapeHTML(s.targetHR):''}</div>
      ${coachSessionDistanceBreakdownText(s)?`<div class="coach-session-preview"><strong>แบ่งระยะ:</strong> ${escapeHTML(coachSessionDistanceBreakdownText(s))}</div>`:''}
      ${displayDetails.mainSet?`<div class="coach-session-preview"><strong>ชุดหลัก:</strong> ${escapeHTML(displayDetails.mainSet)}</div>`:''}
      ${coachSessionStructureText(s)?`<div class="coach-session-preview"><strong>โครงสร้าง:</strong> ${escapeHTML(coachSessionStructureText(s))}</div>`:''}
      ${recoveryLine}
      ${s.notes?`<div class="coach-session-note">เหตุผล/หมายเหตุ: ${escapeHTML(hasThaiText(s.notes)?s.notes:'ทำตามรายละเอียดก่อนวิ่ง และปรับลดถ้าร่างกายไม่พร้อม')}</div>`:''}${actualLine}</div>
      <div class="coach-session-actions">
        <button onclick="showCoachSessionDetail(${index})" class="btn btn-primary btn-xs">รายละเอียด</button>
        ${(!isDone&&!isFuture&&!isRest)?`<button onclick="markDone('${s.date}')" class="btn btn-green btn-xs">✓ ทำแล้ว</button>`:''}
        ${(!isDone&&!isRest)?`<button onclick="coachMoveSession('${s.date}')" class="btn btn-ghost btn-xs">เลื่อน</button>`:''}
        ${(!isDone&&isHardSession(s.type))?`<button onclick="coachDowngradeSession('${s.date}')" class="btn btn-ghost btn-xs">ลดโหลด</button>`:''}
        ${(!isDone&&!isRest)?`<button onclick="coachSkipSession('${s.date}')" class="btn btn-ghost btn-xs">ข้าม</button>`:''}
      </div></div></div>`;
  }).join('');
  if (typeof window.renderStudioCoachBoard === 'function') window.renderStudioCoachBoard(plan);
}

function showCoachSessionDetail(index){
  const s=window._coachRenderedSessions?.[index];if(!s)return;
  const d=coachSessionDisplayDetails(s,index);
  const title=coachSessionDisplayDescription(s,index);
  const typeThai=coachSessionQualityLabel(s)||coachSessionTypeThai(s.type);
  const overlay=document.createElement('div');
  overlay.id='coach-session-detail-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:950;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
  const row=(label,value)=>value?`<div class="coach-detail-row"><div class="coach-detail-row-label">${label}</div><div class="coach-detail-row-value">${escapeHTML(value)}</div></div>`:'';
  overlay.innerHTML=`<div class="coach-detail-card">
    <div class="coach-detail-header">
      <div>
        <div class="card-label">รายละเอียดการซ้อม</div>
        <div class="coach-detail-title" style="color:${coachDecisionColor(isHardSession(s.type)?'yellow':'green')}">${escapeHTML(typeThai)}${coachSessionDistanceSummary(s)?' · '+escapeHTML(coachSessionDistanceSummary(s)):''}</div>
        <div class="text-sm c2 mt-4">${escapeHTML(s.date)}${(s.targetPaceRange||s.targetPace)?' · pace '+escapeHTML(s.targetPaceRange||s.targetPace):''}${s.targetHR?' · HR < '+escapeHTML(s.targetHR):''}</div>
      </div>
      <button class="coach-detail-close" onclick="document.getElementById('coach-session-detail-overlay').remove()">✕</button>
    </div>
    <div class="coach-detail-summary">
      <div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:4px;line-height:1.5">${escapeHTML(title)}</div>
      <div class="text-xs c3">${escapeHTML(hasThaiText(s.notes)?s.notes:'นี่คือแผนหลักของวันนั้น ถ้า readiness วันนี้เหลือง/แดง ให้ลดหรือเลื่อนจากปุ่มในหน้า Track Plan')}</div>
    </div>
    ${row('วอร์มอัพ',d.warmup)}
    ${row('ชุดหลัก',d.mainSet)}
    ${row('คูลดาวน์',d.cooldown)}
    ${row('แบ่งระยะ',coachSessionDistanceBreakdownText(s))}
    ${coachSessionStructureText(s)?row('โครงสร้าง',coachSessionStructureText(s)):''}
    ${row('วิธีวิ่ง',d.execution)}
    ${row('เกณฑ์ว่าวิ่งถูกต้อง',d.successCriteria)}
    ${row('ความหนัก',d.intensity)}
    ${s.workoutSpec?.danielsClass&&Number.isFinite(s.workoutSpec?.workloadCapKm)?row('Workload guard',`${s.workoutSpec.danielsClass}-pace work <= ${s.workoutSpec.workloadCapKm} km${Number.isFinite(s.workoutSpec.workloadTargetMinutes)?` (${s.workoutSpec.workloadTargetMinutes} min target)`:''}`):''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
      <button class="btn btn-ghost btn-sm" onclick="coachMoveSession('${s.date}');document.getElementById('coach-session-detail-overlay')?.remove()">เลื่อนวัน</button>
      ${isHardSession(s.type)?`<button class="btn btn-ghost btn-sm" onclick="coachDowngradeSession('${s.date}');document.getElementById('coach-session-detail-overlay')?.remove()">ลดเป็นวิ่งเบา</button>`:''}
      ${s.type!=='Rest'?`<button class="btn btn-ghost btn-sm" onclick="coachSkipSession('${s.date}');document.getElementById('coach-session-detail-overlay')?.remove()">ข้ามวันนี้</button>`:''}
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',event=>{if(event.target===overlay)overlay.remove();});
}

function coachDecisionThai(status){
  return status==='green'
    ? {label:'พร้อมซ้อมตามแผน',action:'ทำ session หลักได้'}
    : status==='yellow'
      ? {label:'ควรลดโหลดวันนี้',action:'ลดระยะหรือความหนักก่อนซ้อม'}
      : {label:'ไม่ควรฝืน',action:'พักหรือฟื้นตัวแทน'};
}
function coachAdaptiveGuidance(decision,session){
  if(!session)return 'วันนี้ไม่มี session หลัก ระบบยังใช้ sleep, HRV, RHR, SpO2, soreness, health status และ training load เพื่อดูว่าควรพักต่อหรือกลับเข้าตาราง';
  const typeThai=coachSessionTypeThai(session.type);
  if(decision.status==='green')return `แผนหลักวันนี้คือ ${typeThai}${session.targetDist?' '+session.targetDist+' กม.':''} และสัญญาณร่างกายยังไม่ชนกฎลดโหลด จึงทำตามแผนหลักได้`;
  if(decision.status==='yellow')return `แผนหลักยังเป็น ${typeThai} แต่ readiness/โหลดเริ่มเสี่ยง ระบบแนะนำให้ลดเป็นวิ่งเบา ลดระยะประมาณ 30-40% หรือกดลดเป็นวิ่งเบาเพื่อบันทึกแผนที่ปรับแล้ว`;
  return `แผนหลักเดิมถูกกันไว้เป็นจุดอ้างอิง แต่สภาพร่างกายวันนี้เสี่ยงสูง ระบบแนะนำให้พัก/ฟื้นตัว และใช้ข้ามวันนี้หรือวันนี้ไม่ว่าง เพื่อไม่ให้มีการชดเชยโหลดวันถัดไป`;
}
async function matchWorkoutsToPlan(silent=false){if(!window._coachPlan?.sessions)return;if(document.getElementById('page-coach').classList.contains('active')&&document.getElementById('coach-track-tab').style.display!=='none')renderCoachTracking();if(!silent)showToast('🔄 Activities matched');}
function renderCoachDailyDecision(plan){
  const el=document.getElementById('coach-daily-decision');if(!el)return;
  const today=toLocalDateStr();
  const daily=coachDailyDecision(plan,today);
  const todaySession=daily.session;
  const recoveryCard=daily.recoveryCard;
  const color=coachDecisionColor(daily.status);
  const thai=coachDecisionThai(daily.status);
  const reasons=daily.reasons?.length?daily.reasons.map(escapeHTML).join(' · '):'ยังไม่มีสัญญาณเสี่ยงหลักจากข้อมูลวันนี้';
  const actionText={keep:'ทำตามแผนเดิม',done:'บันทึกว่าเช็คแล้ว',no_session:'ไม่มี session วันนี้',recovery:'Recovery / rest day',move:'ย้าย session วันนี้',rest:'เปลี่ยนเป็นพัก/ฟื้นตัว',downgrade:'ลดจากงานหนักเป็น Easy',reduce:'ลดระยะ/ความหนัก'}[daily.action]||daily.action;
  const applyDisabled=daily.alreadyApplied?'disabled':'';
  const recoveryHtml=recoveryCard?`
        <div class="coach-recovery-card">
          <div class="coach-recovery-title">${escapeHTML(recoveryCard.title||'Recovery')}</div>
          <div class="coach-recovery-summary">${escapeHTML(recoveryCard.summary||'Keep today easy and protect the next session.')}</div>
          <div class="coach-recovery-grid">
            <div><strong>Do</strong>${(recoveryCard.actions||[]).slice(0,4).map(item=>`<span>${escapeHTML(item)}</span>`).join('')}</div>
            <div><strong>Avoid</strong>${(recoveryCard.avoid||[]).slice(0,4).map(item=>`<span>${escapeHTML(item)}</span>`).join('')}</div>
          </div>
        </div>`:'';
  el.style.display='block';
  el.style.borderLeft=`4px solid ${color}`;
  el.innerHTML=`
    <div class="coach-adaptive-card">
      <div class="coach-adaptive-main">
        <div class="card-label">Adaptive Coach Today</div>
        <div class="coach-adaptive-action" style="color:${color}">${escapeHTML(thai.label)} · ${escapeHTML(thai.action)}</div>
        <div class="text-sm c2">${todaySession?`แผนหลักวันนี้: ${escapeHTML(coachSessionTypeThai(todaySession.type))} ${todaySession.targetDist||''} กม. ${(todaySession.targetPaceRange||todaySession.targetPace)?`· pace ${escapeHTML(todaySession.targetPaceRange||todaySession.targetPace)}`:''}`:'วันนี้ไม่มี session หนักในแผน'}</div>
        <div class="coach-adaptive-explain"><strong>Daily decision:</strong> ${escapeHTML(actionText)}${daily.alreadyApplied?' · applied to cloud':''}</div>
        <div class="coach-adaptive-explain">${escapeHTML(coachAdaptiveGuidance(daily.safety,todaySession))}</div>
        ${recoveryHtml}
        <div class="text-xs c3 mt-8">เหตุผลจากข้อมูลวันนี้: ${reasons}</div>
        <div class="coach-adaptive-rules">
          <div class="coach-adaptive-rule"><strong>แผนหลัก</strong>AI สร้างตารางตั้งต้นไว้ก่อนเพื่อให้มีโครงสร้างระยะยาว</div>
          <div class="coach-adaptive-rule"><strong>ปรับรายวัน</strong>ระบบอ่าน readiness, sleep, HRV, RHR, SpO2, pain/soreness, unavailable days และ training load ก่อนวันซ้อม</div>
          <div class="coach-adaptive-rule"><strong>บันทึกจริง</strong>เมื่อกดปรับแผนวันนี้ ระบบเขียน dailyDecisions และ adjustments ลง Firebase โดยไม่ชดเชยโหลดมั่ว</div>
        </div>
      </div>
      <div class="coach-adaptive-buttons">
        <button class="btn btn-green btn-sm" onclick="coachApplyDailyDecision('${today}')" ${applyDisabled}>${daily.alreadyApplied?'บันทึกแล้ววันนี้':'ปรับแผนวันนี้ + บันทึก Cloud'}</button>
        ${todaySession?`<button class="btn btn-ghost btn-sm" onclick="coachMoveSession('${today}')">วันนี้ไม่ว่าง: เลื่อน</button>`:''}
        ${todaySession&&isHardSession(todaySession.type)?`<button class="btn btn-ghost btn-sm" onclick="coachDowngradeSession('${today}')">ลดเป็นวิ่งเบา</button>`:''}
        <button class="btn btn-primary btn-sm" onclick="reviewPlanAI()">ให้ AI รีวิวจากข้อมูลล่าสุด</button>
      </div>
    </div>`;
}

async function assertCoachCloudSaved(expected={}){
  const saved=await window._fb.getData('coach_plan');
  if(!saved?.createdAt||saved.createdAt!==expected.createdAt)throw new Error('Cloud save failed. Please sign in again and retry.');
  if(expected.updatedAt&&saved.updatedAt!==expected.updatedAt)throw new Error('Cloud save failed. Latest plan update was not confirmed.');
  if(expected.adjustmentCount!==undefined&&(saved.adjustments||[]).length<expected.adjustmentCount)throw new Error('Cloud save failed. Plan adjustment was not confirmed.');
  if(expected.completedDate&&!(saved.completedDates||{})[expected.completedDate])throw new Error('Cloud save failed. Completed workout was not confirmed.');
  return saved;
}
async function markDone(date){
  const plan=window._coachPlan;if(!plan)return;
  const next={...plan,completedDates:{...(plan.completedDates||{}),[date]:Date.now()}};
  const persisted=next.engineVersion===2&&window.MyDashCoachRepository
    ? await window.MyDashCoachRepository.saveRevision(next)
    : (await window._fb.setData('coach_plan/completedDates',next.completedDates),next);
  await assertCoachCloudSaved({createdAt:persisted.createdAt,completedDate:date});
  AppState.set('coachPlan',persisted);showToast('✅ บันทึกว่าทำแล้ว');
}
async function clearCoachPlan(){
  if(!confirm('เก็บแผนนี้เป็นประวัติและหยุดใช้งาน?'))return;
  const plan=window._coachPlan;
  if(plan?.engineVersion===2&&window.MyDashCoachRepository)await window.MyDashCoachRepository.archivePlan(plan);
  else await window._fb.removeData('coach_plan');
  AppState.set('coachPlan',null);showToast('เก็บแผนเป็นประวัติแล้ว');
}
function coachSessionsOn(plan,date){return (plan.sessions||[]).filter(s=>s.date===date);}
function coachHasHardNear(plan,date){
  return [-1,0,1].some(offset=>coachSessionsOn(plan,datePlusDays(date,offset)).some(s=>isHardSession(s.type)));
}
function coachFindMoveDate(plan,session){
  const goalProfile=getCoachGoalProfile(plan,{preferPlan:true});
  const raceDate=plan?.endDate||'';
  for(let offset=1;offset<=10;offset++){
    const candidate=datePlusDays(session.date,offset);
    if(raceDate&&candidate>=raceDate)continue;
    if(coachDateMatchesUnavailable(candidate,goalProfile))continue;
    const rows=coachSessionsOn(plan,candidate);
    if(rows.some(s=>s.type!=='Rest'))continue;
    if(isHardSession(session.type)&&coachHasHardNear(plan,candidate))continue;
    return candidate;
  }
  return null;
}
async function saveCoachPlanWithAdjustment(plan,adjustment){
  const next={...plan,updatedAt:Date.now(),adjustments:[...(plan.adjustments||[]),{...adjustment,createdAt:Date.now()}]};
  const persisted=next.engineVersion===2&&window.MyDashCoachRepository
    ? await window.MyDashCoachRepository.saveRevision(next)
    : (await window._fb.setData('coach_plan',next),next);
  await assertCoachCloudSaved({createdAt:persisted.createdAt,updatedAt:persisted.updatedAt,adjustmentCount:persisted.adjustments.length});
  AppState.set('coachPlan',persisted);
  renderCoachTracking();
}
async function coachApplyDailyDecision(date=toLocalDateStr()){
  const plan=window._coachPlan;if(!plan?.sessions)return showToast('No plan','error');
  const daily=coachDailyDecision(plan,date);
  if(daily.alreadyApplied)return showToast('วันนี้ปรับ/เช็คแผนไปแล้ว','warn');
  try{
    const result=coachApplyDailyDecisionToPlan(plan,daily);
    await saveCoachPlanWithAdjustment(result.plan,result.adjustment);
    showToast(daily.action==='keep'||daily.action==='done'||daily.action==='no_session'?'บันทึก daily coach check แล้ว':'ปรับแผนวันนี้และบันทึก Cloud แล้ว','success');
  }catch(err){
    console.error(err);
    showToast(err.message||'ปรับแผนวันนี้ไม่สำเร็จ','error');
  }
}
async function coachMoveSession(date){
  const plan=window._coachPlan;if(!plan?.sessions)return;
  const session=plan.sessions.find(s=>s.date===date&&s.type!=='Rest');if(!session)return showToast('ไม่มี session ให้เลื่อน','error');
  const target=coachFindMoveDate(plan,session);if(!target)return showToast('ยังหาช่องว่างที่ปลอดภัยใน 10 วันถัดไปไม่ได้','error');
  const oldDate=session.date;
  session.date=target;
  session.notes=[session.notes,`เลื่อนจาก ${oldDate}; ไม่เพิ่มโหลดชดเชย`].filter(Boolean).join(' · ');
  await saveCoachPlanWithAdjustment(plan,{type:'move',from:oldDate,to:target,sessionType:session.type,reason:'unavailable_or_manual_move'});
  showToast(`เลื่อนไปวันที่ ${target}`);
}
async function coachDowngradeSession(date){
  const plan=window._coachPlan;if(!plan?.sessions)return;
  const session=plan.sessions.find(s=>s.date===date&&s.type!=='Rest');if(!session)return showToast('ไม่มี session ให้ลดโหลด','error');
  const before={type:session.type,targetDist:session.targetDist,targetPace:session.targetPace};
  session.type='Easy';
  session.targetDist=Math.max(3,+(parseFloat(session.targetDist||5)*0.65).toFixed(1));
  session.targetPace='';
  session.targetHR=session.targetHR?Math.min(+session.targetHR,145):145;
  session.details=coachSessionDetails(session.type,session.targetDist,getCoachGoalProfile(plan,{preferPlan:true}));
  session.description=session.details.targetDescription;
  session.notes=[session.notes,'ลดโหลดโดย adaptive coach'].filter(Boolean).join(' · ');
  await saveCoachPlanWithAdjustment(plan,{type:'downgrade',date,from:before,to:{type:session.type,targetDist:session.targetDist,targetHR:session.targetHR},reason:'readiness_or_manual_downgrade'});
  showToast('ลดโหลดเป็นวิ่งเบาแล้ว');
}
async function coachSkipSession(date){
  const plan=window._coachPlan;if(!plan?.sessions)return;
  const session=plan.sessions.find(s=>s.date===date&&s.type!=='Rest');if(!session)return showToast('ไม่มี session ให้ข้าม','error');
  const before={type:session.type,targetDist:session.targetDist,targetPace:session.targetPace};
  session.type='Rest';
  session.description='ข้ามวันนี้ - ไม่เพิ่มโหลดชดเชย';
  session.targetDist=0;
  session.targetPace='';
  session.targetHR='';
  session.details=coachSessionDetails(session.type,0,getCoachGoalProfile(plan,{preferPlan:true}));
  session.notes=[session.notes,'ข้ามโดยไม่เพิ่มโหลดซ้ำในวันถัดไป'].filter(Boolean).join(' · ');
  await saveCoachPlanWithAdjustment(plan,{type:'skip',date,from:before,reason:'unavailable_or_recovery'});
  showToast('ข้าม session อย่างปลอดภัยแล้ว');
}
async function coachRescheduleWeek(){await coachMoveSession(toLocalDateStr());}
async function coachDowngradeToday(){await coachDowngradeSession(toLocalDateStr());}
async function reviewPlanAI(){
  const plan=window._coachPlan;if(!plan?.sessions){showToast('No plan','error');return;}
  const today=toLocalDateStr();
  const context=buildCoachContext(plan);
  const compact=coachBuildCompactReview(plan);
  const safety=coachSafetyDecision((plan.sessions||[]).find(s=>s.date===today));
  const suitability=coachPlanSuitabilityFacts(plan);
  const output=document.getElementById('coach-review-output');
  const reply=await askDeepSeek(
    `${formatCoachContext({
      ...context,
      latestActivities:(context.latestActivities||'').split('\n').slice(0,8).join('\n'),
      wellnessRows:(context.wellnessRows||'').split('\n').slice(0,7).join('\n'),
      planSummary:(context.planSummary||'').split('\n').slice(0,10).join('\n')
    })}\n\n${compact.summary}\n\nPlan suitability facts (JSON):\n${JSON.stringify(suitability)}\n\nDaily safety decision: ${safety.status} - ${safety.action}\nReasons: ${safety.reasons.join(' | ')}\n\nReview whether this plan fits the stated goal and training history. For every quality session, explicitly separate main quality distance from total distance including warm-up, recovery jog, and cool-down. Explain when a short main set is a Daniels/weekly-volume guard rather than a beginner prescription. Use HR, cadence, lap evidence, wellness, and history only when present; state missing metrics instead of inventing them. Do not recommend catch-up doubling or mutate the plan. Separate facts from AI estimate. Keep the answer concise.`,
    `คุณคือโค้ชวิ่งที่ตรวจแผนอย่างรอบคอบสำหรับเป้าหมาย: ${plan.goal||context.goalProfile.distance} วิเคราะห์เป็นภาษาไทย ใช้ข้อมูลจริงเท่านั้น ถ้าเป็นการประเมินให้บอกว่า AI estimate`,
    'btn-coach-review',
    'coach-review-output'
  );
  if(!reply&&output)output.innerHTML=mdToHtml(coachLocalReviewFallback(plan,context,safety,compact));
  if(output)output.style.display='block';
}

// ── NEWS ──
