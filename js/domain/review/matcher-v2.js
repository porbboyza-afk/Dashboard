(function(root){
  'use strict';

  const FACTS_VERSION=2;
  const DAY_MS=86400000;

  function normalize(value){return String(value||'').trim().toLowerCase();}
  function workoutIntent(workout){
    const text=[workout?.purpose,workout?.type,workout?.name,workout?.note].map(normalize).join(' ');
    if(workout?.interval||/interval|repeat|rep\b/.test(text))return 'vo2';
    if(/threshold|tempo|cruise/.test(text))return 'threshold';
    if(/race.?pace|specific/.test(text))return 'race_specific';
    if(/long/.test(text))return 'long';
    if(/recovery|recover/.test(text))return 'recovery';
    if(/hill/.test(text))return 'hill_strength';
    if(/easy|aerobic|base/.test(text))return 'easy';
    return 'unknown';
  }
  function sessionIntent(session){
    if(session?.intent)return normalize(session.intent);
    if(session?.workoutSpec?.intent)return normalize(session.workoutSpec.intent);
    const type=normalize(session?.type);
    if(type==='interval')return 'vo2';
    if(type==='tempo')return 'threshold';
    if(type==='long')return 'long';
    if(type==='recovery')return 'recovery';
    if(type==='easy')return 'easy';
    return type||'unknown';
  }
  function intentGroup(intent){
    const value=normalize(intent);
    if(['easy','recovery','speed_skill','steady'].includes(value))return 'aerobic';
    if(['threshold'].includes(value))return 'threshold';
    if(['vo2','hill_strength'].includes(value))return 'high_intensity';
    if(['race_specific'].includes(value))return 'race_specific';
    if(value==='long')return 'long';
    return 'unknown';
  }
  function compatible(workoutValue,sessionValue){
    const workoutGroup=intentGroup(workoutValue),sessionGroup=intentGroup(sessionValue);
    if(workoutGroup==='unknown'||sessionGroup==='unknown')return null;
    if(workoutGroup===sessionGroup)return true;
    if(['threshold','race_specific'].includes(workoutGroup)&&['threshold','race_specific'].includes(sessionGroup))return true;
    return false;
  }
  function dateDistance(left,right){
    const a=new Date(String(left||'')+'T12:00:00'),b=new Date(String(right||'')+'T12:00:00');
    return isNaN(a)||isNaN(b)?Infinity:Math.abs((a-b)/DAY_MS);
  }
  function snapshot(session){
    if(!session)return null;
    return {
      sessionId:session.sessionId||'',date:session.date||'',phase:session.phase||'',type:session.type||'',intent:sessionIntent(session),
      targetDist:session.targetDist||0,targetPace:session.targetPace||'',targetHR:session.targetHR||'',description:session.description||'',
      details:session.details||null,workoutSpec:session.workoutSpec||null
    };
  }
  function result(type,label,session,score,extra={}){
    return {type,label,session,sessionSnapshot:snapshot(session),score,compareTargets:['exact','probable'].includes(type),requiresConfirmation:type==='probable',...extra};
  }
  function matchWorkout(workout,plan,savedReview=null){
    if(!workout)return result('no_plan','No workout',null,0);
    if(!plan?.sessions?.length){
      if(savedReview?.planId||savedReview?.planMatch?.planId||savedReview?.planMatch?.session){
        return result('historical_plan','Historical review from an archived or replaced plan',null,0,{historicalSession:savedReview.planMatch?.session||null});
      }
      return result('no_plan','No active coach plan',null,0);
    }
    const intent=workoutIntent(workout);
    const sessions=(plan.sessions||[]).filter(session=>session.type!=='Rest');
    const sameDate=sessions.filter(session=>session.date===workout.date);
    if(sameDate.length){
      const compatibleRow=sameDate.find(session=>compatible(intent,sessionIntent(session))===true);
      if(compatibleRow)return result('exact','Matched by date and workout intent',compatibleRow,100,{workoutIntent:intent,sessionIntent:sessionIntent(compatibleRow)});
      const unknownRow=sameDate.find(session=>compatible(intent,sessionIntent(session))===null);
      if(unknownRow)return result('probable','Same date; workout intent needs confirmation',unknownRow,72,{workoutIntent:intent,sessionIntent:sessionIntent(unknownRow)});
      return result('date_mismatch','Same date but workout intent does not match the plan',sameDate[0],20,{workoutIntent:intent,sessionIntent:sessionIntent(sameDate[0])});
    }
    const nearby=sessions.map(session=>({session,days:dateDistance(workout.date,session.date),isCompatible:compatible(intent,sessionIntent(session))}))
      .filter(row=>row.days<=2&&row.isCompatible===true)
      .sort((a,b)=>a.days-b.days)[0];
    if(nearby)return result('probable',`Nearby compatible plan session (${nearby.days}d)`,nearby.session,Math.round(80-nearby.days*15),{workoutIntent:intent,sessionIntent:sessionIntent(nearby.session)});
    return result('unplanned','Completed workout is not represented by the active plan',null,0,{workoutIntent:intent});
  }
  function stableValue(value){
    if(Array.isArray(value))return value.map(stableValue);
    if(value&&typeof value==='object')return Object.keys(value).sort().reduce((out,key)=>{out[key]=stableValue(value[key]);return out;},{});
    return value;
  }
  function hash(value){
    const text=JSON.stringify(stableValue(value));
    let result=2166136261;
    for(let index=0;index<text.length;index++){result^=text.charCodeAt(index);result=Math.imul(result,16777619);}
    return (result>>>0).toString(16).padStart(8,'0');
  }
  function workoutRevision(workout){
    return String(workout?.updatedAt||workout?.createdAt||hash({date:workout?.date,type:workout?.type,purpose:workout?.purpose,dist:workout?.dist,time:workout?.time,hr:workout?.hr,rpe:workout?.rpe,interval:workout?.interval}));
  }
  function factsHash(workout,plan,match){
    return hash({workoutRevision:workoutRevision(workout),planId:plan?.planId||'',revisionId:plan?.revisionId||'',sessionId:match?.session?.sessionId||'',matchType:match?.type||'no_plan'});
  }
  function isReviewStale(review,facts){
    if(!review)return false;
    if(review.factsVersion!==FACTS_VERSION)return true;
    return !!review.factsHash&&review.factsHash!==facts.factsHash;
  }

  root.MyDashReviewMatcher={FACTS_VERSION,workoutIntent,sessionIntent,intentGroup,compatible,matchWorkout,workoutRevision,factsHash,isReviewStale};
})(window);
