(function(root){
  'use strict';

  const COROS_SUB50_URL='https://t.coros.com/schedule-plan/share?planId=479006363339636967&region=1';
  const RACE_DATE='2026-10-18';
  const START_DATE='2026-08-24';
  const WEEKDAY_OFFSET={Tue:1,Wed:2,Sat:5,Sun:6};
  const PHASES=['Foundation','Foundation','Benchmark','Threshold','Build','Build','Specific','RaceWeek'];

  // Friday sessions are intentionally placed on Saturday because Friday is unavailable.
  const BLUEPRINT=[
    [['Tue','Easy',6.17,'Easy aerobic 40 min + 4 x 15 sec strides','Easy aerobic 40 min. Add 4 x 15 sec relaxed strides with 45 sec recovery.','speed_skill'],['Wed','Easy',5.43,'Easy + 200 m strides','Controlled 200 m strides. Focus on posture, coordination, and relaxed form.','speed_skill'],['Sat','Easy',9.26,'Easy aerobic 60 min + 6 x 15 sec strides','Easy aerobic 60 min. Add 6 x 15 sec relaxed strides with 45 sec recovery.','speed_skill'],['Sun','Long',10.80,'Easy aerobic 70 min + 8 x 15 sec strides','Easy aerobic 70 min. Add 8 x 15 sec relaxed strides with 45 sec recovery.','long']],
    [['Tue','Easy',7.72,'Easy aerobic 50 min + 4 x 15 sec strides','Easy aerobic 50 min. Add 4 x 15 sec relaxed strides with 45 sec recovery.','speed_skill'],['Wed','Easy',5.83,'Easy + 200 m strides','Controlled 200 m strides. Focus on posture, coordination, and relaxed form.','speed_skill'],['Sat','Easy',7.72,'Easy aerobic 50 min + 6 x 15 sec strides','Easy aerobic 50 min. Add 6 x 15 sec relaxed strides with 45 sec recovery.','speed_skill'],['Sun','Long',12.35,'Easy aerobic 80 min + 8 x 15 sec strides','Easy aerobic 80 min. Add 8 x 15 sec relaxed strides with 45 sec recovery.','long']],
    [['Tue','Easy',9.26,'Easy aerobic 60 min + 4 x 15 sec strides','Easy aerobic 60 min. Add 4 x 15 sec relaxed strides with 45 sec recovery.','speed_skill'],['Wed','Easy',4.69,'Easy + 200 m strides','Controlled 200 m strides. Focus on posture, coordination, and relaxed form.','speed_skill'],['Sat','Easy',6.17,'Easy aerobic 40 min + 6 x 15 sec strides','Easy aerobic 40 min. Add 6 x 15 sec relaxed strides with 45 sec recovery.','speed_skill'],['Sun','Race',5,'5K time trial','Run 5K at a controlled maximal effort to update training zones and threshold.','benchmark']],
    [['Tue','Easy',4.53,'Easy aerobic 30 min + 4 x 15 sec strides','Easy aerobic 30 min. Add 4 x 15 sec relaxed strides with 45 sec recovery.','speed_skill'],['Wed','Tempo',6.80,'Threshold intervals: 4 x 1200 m','Warm up 2 km. Run 4 x 1200 m at threshold with 3 min recovery. Cool down 10 min.','threshold'],['Sat','Easy',6.05,'Easy aerobic 40 min + 4 x 15 sec strides','Easy aerobic 40 min. Add 4 x 15 sec relaxed strides with 45 sec recovery.','speed_skill'],['Sun','Tempo',10,'Continuous tempo 8 km','Warm up 2 km. Run 8 km at tempo effort. Cool down 10 min.','threshold']],
    [['Tue','Easy',6.05,'Easy aerobic 40 min + 4 x 15 sec strides','Easy aerobic 40 min. Add 4 x 15 sec relaxed strides with 45 sec recovery.','speed_skill'],['Wed','Tempo',8.40,'Threshold intervals: 4 x 1600 m','Warm up 2 km. Run 4 x 1600 m at threshold with 3 min recovery. Cool down 10 min.','threshold'],['Sat','Easy',9.07,'Easy aerobic 60 min + 6 x 15 sec strides','Easy aerobic 60 min. Add 6 x 15 sec relaxed strides with 45 sec recovery.','speed_skill'],['Sun','Long',15,'Progressive long run: 13 km','Warm up 2 km. Run 13 km progressively from easy effort toward threshold. Cool down 10 min.','steady']],
    [['Tue','Easy',6.80,'Easy aerobic 45 min + 4 x 15 sec strides','Easy aerobic 45 min. Add 4 x 15 sec relaxed strides with 45 sec recovery.','speed_skill'],['Wed','Tempo',11,'Progressive run: 9 km','Warm up 2 km. Run 9 km progressively and finish faster than threshold effort only if controlled. Cool down 10 min.','steady'],['Sat','Easy',7.56,'Easy aerobic 50 min + 6 x 15 sec strides','Easy aerobic 50 min. Add 6 x 15 sec relaxed strides with 45 sec recovery.','speed_skill'],['Sun','Long',13,'Progressive long run: 11 km','Warm up 2 km. Run 11 km progressively toward threshold. Cool down 10 min.','steady']],
    [['Tue','Tempo',9,'Threshold blocks: 5 km + 2 km','Warm up 2 km. Run 5 km at threshold, recover 3 min, then run 2 km at threshold. Cool down 10 min.','threshold'],['Sat','Easy',6.05,'Easy aerobic 40 min + 4 x 15 sec strides','Easy aerobic 40 min. Add 4 x 15 sec relaxed strides with 45 sec recovery.','speed_skill'],['Sun','Long',12,'Progressive long run: 10 km','Warm up 2 km. Run 10 km progressively toward threshold. Cool down 10 min.','steady']],
    [['Tue','Easy',4.53,'Easy 30 min','Easy 30 min to reset before race week.','easy'],['Wed','Tempo',6.93,'40 min tempo progression','Run 10 min endurance, 20 min aerobic power, then 10 min threshold.','steady'],['Sat','Easy',4.53,'Easy 30 min','Easy 30 min. Keep the effort relaxed and finish fresh.','easy'],['Sun','Race',10,'10K race','Race day. Follow the event plan and do not add a catch-up workout.','race']]
  ];

  function addDays(date,days){
    const value=new Date(`${date}T12:00:00`);
    value.setDate(value.getDate()+days);
    return value.toISOString().slice(0,10);
  }
  function round(value){return +Number(value).toFixed(2);}
  function details(mainSet,type){
    const isKey=['Tempo','Long','Race'].includes(type);
    return {
      warmup:isKey?'Follow the COROS warm-up stated in the main set.':'Easy aerobic running before strides.',
      mainSet,
      cooldown:isKey?'Follow the COROS cool-down stated in the main set.':'Walk or jog until breathing is calm.',
      execution:'Follow the imported COROS session. Keep easy days easy and stop if pain changes form.',
      successCriteria:'Complete the prescribed session with controlled form; do not add unplanned intensity.',
      intensity:isKey?'COROS prescribed':'Easy',
      targetDescription:mainSet
    };
  }
  function sourceNote(week,day){
    return `COROS 10K sub-50, week ${week}. Source day ${day==='Sat'?'Friday moved to Saturday':'unchanged'} to preserve Friday unavailability.`;
  }
  function createPlan(now=Date.now()){
    const planId='coros-10k-sub50-2026-10-18';
    const sessions=[];
    const phaseSchedule=[];
    const weeklyTargets=[];
    BLUEPRINT.forEach((weekRows,index)=>{
      const week=index+1;
      const phase=PHASES[index];
      const startDate=addDays(START_DATE,index*7);
      const targetVolume=round(weekRows.reduce((sum,row)=>sum+row[2],0));
      weeklyTargets.push(targetVolume);
      phaseSchedule.push({week,phase,phaseLabel:`COROS ${phase}`,startDate,targetVolumeKm:targetVolume});
      weekRows.forEach(([day,type,distance,title,mainSet,intent],slot)=>{
        const date=addDays(startDate,WEEKDAY_OFFSET[day]);
        sessions.push({
          sessionId:`${planId}-w${week}-s${slot+1}`,
          date,week,phase,phaseLabel:`COROS ${phase}`,
          type,intent,targetDist:distance,targetPace:'',targetPaceRange:'',targetHR:'',
          priority:['Tempo','Long','Race'].includes(type)?'key':'normal',
          description:title,details:details(mainSet,type),
          workoutSpec:{intent,structure:'external_coros',totalDistanceKm:distance,qualityDistanceKm:['Tempo','Race'].includes(type)?distance:0,sourceProvider:'COROS'},
          notes:sourceNote(week,day),methodologyVersion:'external-coros-2026.07.19'
        });
      });
    });
    return {
      planId,revisionId:'r1',engineVersion:2,methodologyVersion:'external-coros-2026.07.19',status:'active',
      goal:'COROS 10K sub-50 plan - target 47:58',startDate:START_DATE,endDate:RACE_DATE,totalWeeks:8,daysPerWeek:4,
      createdAt:now,updatedAt:now,
      sourcePlan:{provider:'COROS',label:'COROS 10K under 50 minutes',sharedUrl:COROS_SUB50_URL,planId:'479006363339636967',importedAt:now,adaptation:'Friday sessions moved to Saturday because Friday is unavailable; all workout content and weekly distances are preserved.'},
      goalProfile:{distance:'10K',targetTime:'47:58',targetMinutes:47+58/60,targetPace:(47*60+58)/10/60,benchmark:'5K 23:28; current 10K estimate about 50:00',unavailableRaw:'Mon,Fri',unavailable:['Mon','Fri'],longRunDay:'0',longRunDayName:'Sun',raceGoal:true},
      athleteProfile:{level:'intermediate',currentWeeklyKm:30,volumeBasis:'manual',paceBasis:'COROS external plan',confidence:'external_source'},
      inputAudit:{source:'COROS shared plan',sourceUrl:COROS_SUB50_URL,daysPerWeek:4,longRunDay:'0',unavailableRaw:'Mon,Fri'},
      phaseSchedule,sessions:sessions.sort((a,b)=>a.date.localeCompare(b.date)),recoveryCards:[],recoverySummary:{},
      completedDates:{},adjustments:[],dailyDecisions:{},
      validation:{valid:true,errors:[],warnings:['external_coros_plan: MyDash preserves the COROS structure and does not regenerate sessions.'],weeklyTargetsKm:weeklyTargets,weeklyActualKm:weeklyTargets},
      compatibility:{legacyMirror:true,previousEngineAvailable:true,externalPlan:true}
    };
  }
  async function importPlan(){
    const button=document.getElementById('btn-import-coros-sub50');
    try{
      if(!root._fb?.isSignedIn?.())throw new Error('Sign in before importing a plan.');
      if(!root.MyDashCoachRepository?.replaceActivePlan)throw new Error('Coach repository is not ready.');
      if(button){button.disabled=true;button.textContent='Importing COROS plan...';}
      const saved=await root.MyDashCoachRepository.replaceActivePlan(createPlan());
      root.AppState?.set('coachPlan',saved);
      const output=document.getElementById('coach-output');
      if(output)output.innerHTML='<strong style="color:var(--green)">COROS sub-50 plan imported.</strong><br>8 weeks, 31 sessions, race 18 Oct 2026. Friday sessions were moved to Saturday.';
      root.showToast?.('Imported COROS 10K sub-50 plan','success');
      root.switchCoachTab?.('track');
      return saved;
    }catch(error){
      root.showToast?.(error.message,'error');
      throw error;
    }finally{
      if(button){button.disabled=false;button.textContent='Import COROS 10K sub-50 plan';}
    }
  }

  root.MyDashCorosPlans={createSub50Plan:createPlan,COROS_SUB50_URL};
  root.importCorosSub50Plan=importPlan;
})(window);
