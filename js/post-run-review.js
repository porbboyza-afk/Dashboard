let _activePostRunWorkoutKey = null;

function postRunWorkoutKey(workout){
  if(!workout)return '';
  return String(workout._key||workout.id||workout.stravaId||workout.healthConnectId||`${workout.source||'manual'}-${workout.date||''}-${workout.type||''}`);
}

function postRunReviewFor(workout){
  const key=postRunWorkoutKey(workout);
  return (AppState.get('postRunReviews')||[]).find(review=>review.workoutKey===key||review._key===key)||null;
}

function postRunFindWorkout(key){
  const rows=getAllActivities();
  if(key)return rows.find(workout=>postRunWorkoutKey(workout)===key)||null;
  return rows.find(workout=>['run','interval','walk','bike','swim'].includes(workout.type))||rows[0]||null;
}

function postRunPaceDelta(actualPace,targetPace){
  const actual=parseFloat(actualPace||0);
  const target=paceStrToDecimal(targetPace||'');
  if(!actual||!target)return null;
  const seconds=Math.round((actual-target)*60);
  return {seconds, label:`${seconds>0?'+':''}${seconds}s/km`, onTarget:Math.abs(seconds)<=15};
}

function postRunPlanMatch(workout){
  const plan=window._coachPlan;
  if(!workout||!plan?.sessions?.length)return {session:null,score:0,label:'No coach plan'};
  const sameDate=(plan.sessions||[]).find(session=>session.date===workout.date&&session.type!=='Rest');
  if(sameDate)return {session:sameDate,score:100,label:'Matched by date'};
  const date=new Date((workout.date||'')+'T12:00:00');
  if(isNaN(date))return {session:null,score:0,label:'No valid workout date'};
  const candidates=(plan.sessions||[]).filter(session=>session.type!=='Rest').map(session=>{
    const sessionDate=new Date(session.date+'T12:00:00');
    const dayDiff=Math.abs((date-sessionDate)/86400000);
    const typeBonus=String(workout.purpose||workout.type||'').toLowerCase().includes(String(session.type||'').toLowerCase())?10:0;
    return {session,score:Math.max(0,70-(dayDiff*20)+typeBonus),dayDiff};
  }).filter(row=>row.dayDiff<=2).sort((a,b)=>b.score-a.score)[0];
  return candidates?{session:candidates.session,score:Math.round(candidates.score),label:`Nearest plan day (${candidates.dayDiff}d)`}:{session:null,score:0,label:'No nearby plan session'};
}

function buildPostRunFacts(workout){
  const match=postRunPlanMatch(workout);
  const session=match.session;
  const dist=parseFloat(workout?.dist||0);
  const targetDist=parseFloat(session?.targetDist||0);
  const distDelta=targetDist?+((dist-targetDist)/targetDist*100).toFixed(1):null;
  const actualPace=workout?.avgPace||paceStrToDecimal(workout?.interval?.repPace||'');
  const paceDelta=postRunPaceDelta(actualPace,session?.targetPace);
  const hr=parseFloat(workout?.hr||0);
  const targetHR=parseFloat(session?.targetHR||0);
  const hrDelta=targetHR&&hr?Math.round(hr-targetHR):null;
  const load=sessionLoad(workout||{});
  const readiness=calculateReadiness();
  const readinessLoad=readiness?.load||{};
  const wellness=(AppState.get('wellness')||[]).find(row=>row.date===workout?.date)||null;
  const riskFlags=[];
  if(distDelta!==null&&Math.abs(distDelta)>15)riskFlags.push(distDelta>0?'distance_over_target':'distance_under_target');
  if(paceDelta&&Math.abs(paceDelta.seconds)>20)riskFlags.push(paceDelta.seconds<0?'pace_faster_than_target':'pace_slower_than_target');
  if(hrDelta!==null&&hrDelta>8)riskFlags.push('heart_rate_above_target');
  if(+workout?.rpe>=8)riskFlags.push('high_rpe');
  if(+workout?.pain>=4)riskFlags.push('pain_reported');
  if(readiness.score<60)riskFlags.push('low_readiness_context');
  return {
    workoutKey:postRunWorkoutKey(workout),
    date:workout?.date||'',
    planMatch:{score:match.score,label:match.label,session:session?{
      date:session.date,type:session.type,targetDist:session.targetDist,targetPace:session.targetPace,targetHR:session.targetHR,description:session.description,details:session.details||null
    }:null},
    targetComparison:{
      actualDist:dist||0,targetDist:targetDist||0,distDeltaPct:distDelta,
      actualPace:actualPace||0,targetPace:session?.targetPace||'',paceDelta,
      actualHR:hr||0,targetHR:targetHR||0,hrDelta,
      sessionLoad:load
    },
    subjective:{rpe:workout?.rpe||null,pain:workout?.pain||null,painLocation:workout?.painLocation||'',feeling:workout?.feeling||'',note:workout?.note||''},
    wellness:wellness?{sleepHours:wellness.sleepHours??null,restingHR:wellness.restingHR??null,hrv:wellness.hrv??null,spo2:wellness.spo2??null,fatigue:wellness.fatigue??null,soreness:wellness.soreness??null}:null,
    readiness:{
      score:readiness.score,
      level:readiness.level,
      load:{
        acute:readinessLoad.acute??0,
        chronicWeekly:readinessLoad.chronicWeekly??0,
        acwr:readinessLoad.acwr??null,
        monotony:readinessLoad.monotony??0,
        strain:readinessLoad.strain??0,
        historyDays:readinessLoad.historyDays??0,
        baselineReady:!!readinessLoad.baselineReady,
        daily:Array.isArray(readinessLoad.daily)?readinessLoad.daily.map(value=>Number.isFinite(value)?value:0):[]
      }
    },
    riskFlags,
    intervalAnalysis:workout?.interval?{
      reps:workout.interval.reps||0,repDist:workout.interval.repDist||0,repPace:workout.interval.repPace||'',restTime:workout.interval.restTime||0,
      plannedMainSet:session?.details?.mainSet||''
    }:null
  };
}

function postRunLocalVerdict(facts){
  const flags=facts.riskFlags||[];
  if(flags.includes('pain_reported')||flags.includes('heart_rate_above_target')||flags.includes('high_rpe'))return {label:'Review needed',color:'var(--orange)',next:'Keep the next 24 hours easy and recheck recovery before quality work.'};
  if(facts.targetComparison?.distDeltaPct!==null&&Math.abs(facts.targetComparison.distDeltaPct)<=10&&(facts.targetComparison.paceDelta?.onTarget!==false))return {label:'On target',color:'var(--green)',next:'Keep the plan unless tomorrow readiness drops.'};
  return {label:'Completed with variance',color:'var(--accent)',next:'Use the facts below before changing the next session.'};
}

function postRunMetric(label,value,color='var(--text)'){
  return `<div class="wellness-summary-item"><span class="c2">${label}</span><span style="color:${color}">${value??'--'}</span></div>`;
}

function postRunRenderWorkoutList(selectedKey){
  const container=document.getElementById('postrun-workout-list');
  if(!container)return;
  const rows=getAllActivities().filter(workout=>workout.date).slice(0,12);
  if(!rows.length){container.innerHTML='<div class="empty-state"><div class="empty-state-title">No activity yet</div><div class="empty-state-copy">Save a workout first, then review it here.</div></div>';return;}
  container.innerHTML=rows.map(workout=>{
    const key=postRunWorkoutKey(workout);
    const review=postRunReviewFor(workout);
    const active=key===selectedKey;
    return `<button class="postrun-activity-row ${active?'active':''}" onclick="openPostRunReview('${escapeHTML(key)}')">
      <span><strong>${escapeHTML(workout.date||'')}</strong><br><small>${escapeHTML(workout.type||'activity')} ${workout.dist||0}km${workout.avgPace?' @ '+formatPace(workout.avgPace):''}</small></span>
      <span class="postrun-review-state">${review?'Reviewed':'Open'}</span>
    </button>`;
  }).join('');
}

function renderPostRunReview(){
  const page=document.getElementById('page-post-run-review');
  if(!page)return;
  const workout=postRunFindWorkout(_activePostRunWorkoutKey);
  const selectedKey=postRunWorkoutKey(workout);
  postRunRenderWorkoutList(selectedKey);
  const body=document.getElementById('postrun-review-body');
  if(!body)return;
  if(!workout){body.innerHTML='<div class="empty-state"><div class="empty-state-title">No workout selected</div><div class="empty-state-copy">Save an activity or open one from Activity Log.</div></div>';return;}
  _activePostRunWorkoutKey=selectedKey;
  const facts=buildPostRunFacts(workout);
  const review=postRunReviewFor(workout);
  const verdict=postRunLocalVerdict(facts);
  const session=facts.planMatch.session;
  const comparison=facts.targetComparison;
  body.innerHTML=`
    <div class="postrun-hero">
      <div>
        <div class="card-label">Post-Run Review</div>
        <div class="postrun-title">${escapeHTML(workout.date||'')} · ${escapeHTML(workout.type||'activity')} ${workout.dist||0} km</div>
        <div class="text-sm c2 mt-4">${facts.planMatch.label}${session?` · ${escapeHTML(session.type)} ${session.targetDist||0} km`:''}</div>
      </div>
      <div class="postrun-verdict" style="border-color:${verdict.color};color:${verdict.color}">${verdict.label}</div>
    </div>
    <div class="grid g2 mt-16">
      <div class="card">
        <div class="card-label">Plan vs Actual</div>
        <div class="wellness-summary-list mt-12">
          ${postRunMetric('Distance',`${comparison.actualDist||0} / ${comparison.targetDist||'--'} km`,Math.abs(comparison.distDeltaPct||0)<=10?'var(--green)':'var(--orange)')}
          ${postRunMetric('Distance delta',comparison.distDeltaPct===null?'--':`${comparison.distDeltaPct>0?'+':''}${comparison.distDeltaPct}%`)}
          ${postRunMetric('Pace',`${comparison.actualPace?formatPace(comparison.actualPace):'--'} / ${comparison.targetPace||'--'}`)}
          ${postRunMetric('Pace delta',comparison.paceDelta?.label||'--',comparison.paceDelta?.onTarget?'var(--green)':'var(--orange)')}
          ${postRunMetric('Heart rate',`${comparison.actualHR||'--'} / ${comparison.targetHR||'--'} bpm`,comparison.hrDelta&&comparison.hrDelta>8?'var(--orange)':'var(--text)')}
          ${postRunMetric('Session load',comparison.sessionLoad||0,'var(--accent)')}
        </div>
      </div>
      <div class="card">
        <div class="card-label">Recovery Context</div>
        <div class="wellness-summary-list mt-12">
          ${postRunMetric('Readiness',`${facts.readiness.score}/100`)}
          ${postRunMetric('Sleep',facts.wellness?.sleepHours!=null?formatSleepHours(facts.wellness.sleepHours):'--')}
          ${postRunMetric('HRV',facts.wellness?.hrv!=null?facts.wellness.hrv+' ms':'--')}
          ${postRunMetric('RPE',facts.subjective.rpe?facts.subjective.rpe+'/10':'--')}
          ${postRunMetric('Pain',facts.subjective.pain?`${facts.subjective.pain}/10 ${escapeHTML(facts.subjective.painLocation||'')}`:'--',+facts.subjective.pain>=4?'var(--red)':'var(--text)')}
          ${postRunMetric('Flags',facts.riskFlags.length?facts.riskFlags.join(', '):'none',facts.riskFlags.length?'var(--orange)':'var(--green)')}
        </div>
      </div>
    </div>
    ${facts.intervalAnalysis?`<div class="card mt-16"><div class="card-label">Interval Analysis</div><div class="coach-session-preview mt-8">Actual: ${facts.intervalAnalysis.reps} x ${facts.intervalAnalysis.repDist} km @ ${escapeHTML(facts.intervalAnalysis.repPace||'--')} · Rest ${facts.intervalAnalysis.restTime||0} min${facts.intervalAnalysis.plannedMainSet?`<br>Plan: ${escapeHTML(facts.intervalAnalysis.plannedMainSet)}`:''}</div></div>`:''}
    <div class="card mt-16">
      <div class="flex justify-between items-center gap-12 flex-wrap">
        <div>
          <div class="card-label">Coach AI Summary</div>
          <div class="text-sm c2 mt-4">AI uses this workout, the matched plan session, wellness, readiness, and recent load. It does not change the plan automatically.</div>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-postrun-ai" onclick="generatePostRunAIReview('${escapeHTML(selectedKey)}')">Generate AI Review</button>
      </div>
      <div id="postrun-ai-output" class="ai-box mt-12" style="display:${review?.aiSummary?'block':'none'}">${review?.aiSummary?mdToHtml(review.aiSummary):''}</div>
      ${!review?.aiSummary?`<div class="postrun-local-note mt-12">${escapeHTML(verdict.next)}</div>`:''}
    </div>`;
}

function openPostRunReview(key=''){
  _activePostRunWorkoutKey=key||_activePostRunWorkoutKey;
  showPage('post-run-review');
  renderPostRunReview();
}

async function generatePostRunAIReview(key=''){
  const workout=postRunFindWorkout(key||_activePostRunWorkoutKey);
  if(!workout){showToast('No workout selected','error');return;}
  if(!AppState.get('deepseekKey')&&!AppState.get('aiProxyUrl')){showToast('Set AI Proxy or DeepSeek API key first','error');showPage('settings');return;}
  const facts=buildPostRunFacts(workout);
  const button=document.getElementById('btn-postrun-ai');
  const output=document.getElementById('postrun-ai-output');
  const old=button?.innerHTML;
  if(button){button.disabled=true;button.innerHTML='Analyzing...';}
  if(output){output.style.display='block';output.innerHTML='Analyzing workout...';}
  try{
    const prompt=`Post-run review facts JSON:\n${JSON.stringify(facts,null,2)}\n\nReturn a concise Thai post-run review:\n1. Did the workout meet the planned intent?\n2. What went well?\n3. Risk flags from HR/RPE/pain/load.\n4. Recommendation for the next 24-48 hours.\n5. Whether the next coach session should be kept, reduced, or reviewed by the user. Do not change the plan automatically. Separate facts from AI estimate.`;
    const data=await callNewsChat([
      {role:'system',content:'You are a conservative running coach. Use only the provided structured facts. Do not invent missing GPS, cadence, splits, HRV, or medical claims. Respond in Thai.'},
      {role:'user',content:prompt}
    ],{useSearch:false,temperature:.2,maxTokens:1400});
    const reply=data?.choices?.[0]?.message?.content||'No AI review returned.';
    const reviewPayload={...facts,aiSummary:reply,model:data?.model||'',updatedAt:Date.now(),createdAt:postRunReviewFor(workout)?.createdAt||Date.now()};
    await window._fb.setData(`post_run_reviews/${facts.workoutKey}`,reviewPayload);
    AppState.set('postRunReviews',[...(AppState.get('postRunReviews')||[]).filter(review=>review.workoutKey!==facts.workoutKey&&review._key!==facts.workoutKey),{_key:facts.workoutKey,...reviewPayload}]);
    if(output)output.innerHTML=mdToHtml(reply);
    showToast('Post-run review saved');
  }catch(error){
    if(output)output.innerHTML=`<span style="color:var(--red)">${escapeHTML(error.message||'AI review failed')}</span>`;
    showToast(error.message||'AI review failed','error');
  }finally{
    if(button){button.disabled=false;button.innerHTML=old||'Generate AI Review';}
  }
}
