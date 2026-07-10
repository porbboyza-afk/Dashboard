(function(root){
  'use strict';

  function number(value){const n=parseFloat(value);return Number.isFinite(n)?n:0;}
  function todayString(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function sessionIntensity(session){
    const type=String(session?.type||'');
    if(type==='Rest')return 'rest';
    if(type==='Recovery')return 'recovery';
    if(type==='Long')return 'long';
    if(type==='Tempo'||type==='Interval')return 'quality';
    return 'easy';
  }
  function sameDateSet(rows){
    return new Set((rows||[]).map(row=>row?.date).filter(Boolean));
  }
  function build(plan,{activities=[],wellness=[],today=todayString()}={}){
    const sessions=Array.isArray(plan?.sessions)?plan.sessions:[];
    const nonRest=sessions.filter(session=>session.type!=='Rest');
    const activityDates=sameDateSet(activities);
    const completedDates=plan?.completedDates||{};
    const completed=nonRest.filter(session=>completedDates[session.date]||activityDates.has(session.date));
    const missed=nonRest.filter(session=>!completedDates[session.date]&&!activityDates.has(session.date)&&session.date<today);
    const upcoming=nonRest.filter(session=>!completedDates[session.date]&&!activityDates.has(session.date)&&session.date>=today);
    const intensity={easy:{sessions:0,km:0},quality:{sessions:0,km:0},long:{sessions:0,km:0},recovery:{sessions:0,km:0},rest:{sessions:0,km:0}};
    sessions.forEach(session=>{
      const key=sessionIntensity(session);
      intensity[key].sessions+=1;
      intensity[key].km+=number(session.targetDist);
    });
    Object.values(intensity).forEach(row=>{row.km=Math.round(row.km*10)/10;});
    const plannedKm=Math.round(nonRest.reduce((sum,session)=>sum+number(session.targetDist),0)*10)/10;
    const completedKm=Math.round(completed.reduce((sum,session)=>sum+number(session.targetDist),0)*10)/10;
    const weekly=(plan?.phaseSchedule||[]).map(week=>{
      const rows=sessions.filter(session=>session.week===week.week);
      return {
        week:week.week,
        phase:week.phase,
        targetVolumeKm:number(week.targetVolumeKm),
        plannedKm:Math.round(rows.reduce((sum,session)=>sum+number(session.targetDist),0)*10)/10,
        qualitySessions:rows.filter(session=>['Tempo','Interval'].includes(session.type)).length,
        recoverySessions:rows.filter(session=>session.type==='Recovery').length
      };
    });
    const todaySession=nonRest.find(session=>session.date===today)||null;
    const todayRecovery=(plan?.recoveryCards||[]).find(card=>card.date===today)||todaySession?.recoveryAdvice||null;
    const latestWellness=(wellness||[]).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0]||null;
    return {
      today,
      goal:plan?.goal||'',
      summary:{
        totalSessions:nonRest.length,
        completedSessions:completed.length,
        missedSessions:missed.length,
        upcomingSessions:upcoming.length,
        plannedKm,
        completedKm,
        completionPct:nonRest.length?Math.round(completed.length/nonRest.length*100):0
      },
      intensity,
      weekly,
      todaySession,
      todayRecovery,
      latestWellness,
      recoverySummary:plan?.recoverySummary||{}
    };
  }

  root.MyDashTrainingDashboard={build,sessionIntensity};
})(window);
