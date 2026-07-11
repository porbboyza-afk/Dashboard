(function(root){
  'use strict';

  const T=root.MyDashTraining;
  if(!T)throw new Error('MyDashTraining profiles must load before engine-v2.js');

  const ENGINE_VERSION=2;
  const DAY_MS=86400000;
  const REFERENCES=[
    {id:'baa-10k',title:'B.A.A. 10K Training Plans',url:'https://www.baa.org/races/boston-10k/info-for-athletes/b-a-a-10k-training/'},
    {id:'world-athletics-road',title:'World Athletics Road Running Training Guidance',url:'https://worldathletics.org/en/competitions/world-athletics-road-running-championships/world-athletics-road-running-championships-7174065/for-participants/training/'},
    {id:'world-athletics-speed',title:'World Athletics: Speed training for endurance runners',url:'https://worldathletics.org/personal-best/performance/speed-training-endurance-runners-benefits-limits'},
    {id:'long-run-durability-2025',title:'Long runs and running economy durability in well-trained runners',url:'https://pubmed.ncbi.nlm.nih.gov/40878015/'},
    {id:'taper-meta-2023',title:'Effects of tapering on performance in endurance athletes',url:'https://pubmed.ncbi.nlm.nih.gov/37163550/'},
    {id:'10k-intervals-2023',title:'Intervals at maximal sustainable effort and 10-km performance',url:'https://pubmed.ncbi.nlm.nih.gov/36724870/'},
    {id:'intensity-distribution-2022',title:'Training intensity distribution in endurance athletes: systematic review',url:'https://pubmed.ncbi.nlm.nih.gov/34749417/'},
    {id:'recreational-polarized-2014',title:'Polarized training in recreational runners',url:'https://pubmed.ncbi.nlm.nih.gov/23752040/'},
    {id:'recovery-consensus-2018',title:'Recovery and performance in sport: consensus statement',url:'https://pubmed.ncbi.nlm.nih.gov/29345524/'},
    {id:'active-recovery-review-2018',title:'Active recovery systematic review',url:'https://pubmed.ncbi.nlm.nih.gov/29742750/'},
    {id:'sleep-athlete-consensus-2021',title:'Sleep and athletes consensus statement',url:'https://pubmed.ncbi.nlm.nih.gov/33144349/'}
    ,{id:'daniels-running-formula-4',title:"Daniels' Running Formula, 4th edition (5K/10K, Half, Marathon)",source:'user_provided_epub',chapters:['13','15','16']}
  ];

  function clamp(value,min,max){return Math.min(max,Math.max(min,value));}
  function round(value,digits=1){const power=Math.pow(10,digits);return Math.round(value*power)/power;}
  function parseDate(value){const date=new Date(String(value||'')+'T12:00:00');return isNaN(date)?null:date;}
  function dateString(date){
    const d=date instanceof Date?date:parseDate(date);
    if(!d)return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function addDays(value,days){const date=parseDate(value);if(!date)return '';date.setDate(date.getDate()+days);return dateString(date);}
  function dayDiff(a,b){const left=parseDate(a),right=parseDate(b);return left&&right?Math.round((left-right)/DAY_MS):0;}
  function mondayFor(value){const date=parseDate(value);if(!date)return null;const offset=(date.getDay()+6)%7;date.setDate(date.getDate()-offset);return date;}
  function weekDate(startDate,week,weekday){
    const monday=mondayFor(startDate);if(!monday)return '';
    monday.setDate(monday.getDate()+week*7+(weekday===0?6:weekday-1));
    return dateString(monday);
  }
  function formatPace(minutes){
    const value=parseFloat(minutes);if(!Number.isFinite(value)||value<=0)return '';
    let mins=Math.floor(value),seconds=Math.round((value-mins)*60);
    if(seconds===60){mins++;seconds=0;}
    return `${mins}:${String(seconds).padStart(2,'0')}`;
  }
  function parseClock(value,hoursHint=false){
    const parts=String(value||'').trim().split(':').map(Number);
    if(!parts.length||parts.some(part=>!Number.isFinite(part)))return null;
    if(parts.length===3)return parts[0]*60+parts[1]+parts[2]/60;
    if(parts.length===2&&hoursHint&&parts[0]<=6)return parts[0]*60+parts[1];
    if(parts.length===2)return parts[0]+parts[1]/60;
    return parts[0]||null;
  }
  function distanceKm(value){
    const key=T.normalizeProfileKey(value);
    return T.getProfile(key).distanceKm;
  }
  function parseBenchmark(value){
    const match=String(value||'').match(/(5\s*K|10\s*K|half(?:\s*marathon)?|HM|marathon|42(?:\.2)?\s*K)\s*[:=-]?\s*(\d{1,2}:\d{2}(?::\d{2})?)/i);
    if(!match)return null;
    const distance=distanceKm(match[1]);
    const minutes=parseClock(match[2],distance>=21);
    return distance&&minutes?{distanceKm:distance,minutes,label:`${T.normalizeProfileKey(match[1])} ${match[2]}`} : null;
  }
  function projectedMinutes(benchmark,distance){
    if(!benchmark||!distance)return null;
    return benchmark.minutes*Math.pow(distance/benchmark.distanceKm,1.06);
  }
  function vdotForPerformance(distanceKm,minutes){
    const distance=Number(distanceKm),time=Number(minutes);
    if(!Number.isFinite(distance)||!Number.isFinite(time)||distance<=0||time<=0)return null;
    const velocity=distance*1000/time; // metres per minute
    const oxygenCost=-4.60+.182258*velocity+.000104*Math.pow(velocity,2);
    const fraction=.8+.1894393*Math.exp(-.012778*time)+.2989558*Math.exp(-.1932605*time);
    const vdot=oxygenCost/fraction;
    return Number.isFinite(vdot)&&vdot>0?round(vdot,2):null;
  }
  function paceForVdotAtDuration(vdot,durationMinutes=60){
    const target=Number(vdot),duration=Number(durationMinutes);
    if(!Number.isFinite(target)||target<=0||!Number.isFinite(duration)||duration<=0)return null;
    let low=120,high=420;
    for(let index=0;index<48;index++){
      const velocity=(low+high)/2;
      const oxygenCost=-4.60+.182258*velocity+.000104*Math.pow(velocity,2);
      const fraction=.8+.1894393*Math.exp(-.012778*duration)+.2989558*Math.exp(-.1932605*duration);
      if(oxygenCost/fraction<target)low=velocity;else high=velocity;
    }
    return round(1000/((low+high)/2),3);
  }
  function levelDefault10kPace(level){
    return {beginner:6.5,intermediate:5.5,advanced:4.6}[level]||5.5;
  }
  function recentVolume(activities=[],asOf=dateString(new Date())){
    const end=parseDate(asOf)||new Date();
    const start=new Date(end);start.setDate(start.getDate()-27);
    const rows=(activities||[]).filter(activity=>{
      const date=parseDate(activity.date);return date&&date>=start&&date<=end;
    });
    const total=rows.reduce((sum,activity)=>sum+(parseFloat(activity.dist)||0),0);
    const longest=rows.reduce((max,activity)=>Math.max(max,parseFloat(activity.dist)||0),0);
    return {weeklyKm:round(total/4,1),longestRunKm:round(longest,1),activities:rows.length};
  }
  function numeric(value){const number=parseFloat(value);return Number.isFinite(number)?number:null;}
  function paceRange(first,second){
    const left=parseClock(first),right=parseClock(second);
    if(!left||!right)return null;
    return {fast:Math.min(left,right),slow:Math.max(left,right)};
  }
  function weightedMedian(rows){
    const sorted=rows.filter(row=>Number.isFinite(row.value)&&row.value>0).sort((a,b)=>a.value-b.value);
    const total=sorted.reduce((sum,row)=>sum+Math.max(.5,row.weight||1),0);
    let cursor=0;
    for(const row of sorted){cursor+=Math.max(.5,row.weight||1);if(cursor>=total/2)return row.value;}
    return null;
  }
  function easyPaceEvidence(activities=[],settings={},asOf=dateString(new Date())){
    const end=parseDate(asOf)||new Date();
    const start=new Date(end);start.setDate(start.getDate()-89);
    const hrMin=numeric(settings.easyHRMin)??numeric(settings.z1Max);
    const hrMax=numeric(settings.easyHRMax)??numeric(settings.z2Max);
    if(!hrMax)return {sessions:0,medianPace:null,hrMin:null,hrMax:null};
    const rows=(activities||[]).filter(activity=>{
      const date=parseDate(activity.date),pace=numeric(activity.avgPace),hr=numeric(activity.hr);
      const text=`${activity.type||''} ${activity.purpose||''} ${activity.name||''}`.toLowerCase();
      const runLike=/run|easy|recovery|long/.test(text)&&!/interval|tempo|threshold|race/.test(text);
      const rpe=numeric(activity.rpe);
      return date&&date>=start&&date<=end&&runLike&&pace&&hr&&hr>=(hrMin??0)-3&&hr<=hrMax+3&&(!rpe||rpe<=5);
    }).map(activity=>({value:numeric(activity.avgPace),weight:Math.min(15,Math.max(1,numeric(activity.dist)||1))}));
    return {sessions:rows.length,medianPace:weightedMedian(rows),hrMin,hrMax};
  }
  function buildAthleteModel(input,profile){
    const level=['beginner','intermediate','advanced'].includes(input.level)?input.level:'intermediate';
    const settings=input.athleteSettings||{};
    const benchmark=parseBenchmark(input.benchmark);
    const recent=recentVolume(input.recentActivities,input.asOfDate||dateString(new Date()));
    const easyEvidence=easyPaceEvidence(input.recentActivities,settings,input.asOfDate||dateString(new Date()));
    const suppliedWeekly=parseFloat(input.currentWeeklyKm);
    const suppliedLong=parseFloat(input.longestRecentRunKm);
    const suppliedFromHistory=input.currentWeeklyKmSource==='activity_history';
    const observedWeekly=Number.isFinite(suppliedWeekly)&&suppliedWeekly>0?suppliedWeekly:recent.weeklyKm;
    const volumeHistoryReliable=!suppliedFromHistory||recent.activities>=3;
    const weeklyKm=volumeHistoryReliable
      ? observedWeekly
      : Math.max(observedWeekly||0,profile.defaultWeeklyKm[level]*.60);
    const longestRunKm=Number.isFinite(suppliedLong)&&suppliedLong>0?suppliedLong:recent.longestRunKm;
    const fallback10k=levelDefault10kPace(level);
    const paceFor=distance=>benchmark?projectedMinutes(benchmark,distance)/distance:null;
    const current10k=paceFor(10)||fallback10k;
    const benchmarkVdot=benchmark?vdotForPerformance(benchmark.distanceKm,benchmark.minutes):null;
    const calculatedThreshold=benchmarkVdot?paceForVdotAtDuration(benchmarkVdot,60):current10k+.10;
    const configuredTempo=paceRange(settings.tempoFast,settings.tempoSlow);
    const configuredThreshold=parseClock(settings.thresholdPace);
    const threshold=configuredTempo?(configuredTempo.fast+configuredTempo.slow)/2:(configuredThreshold||calculatedThreshold);
    const evidenceFastLimit=easyEvidence.medianPace?easyEvidence.medianPace-.15:0;
    const easyFast=round(Math.max(threshold+.85,current10k+.95,evidenceFastLimit),3);
    const easySlow=round(Math.max(easyFast+.40,easyEvidence.medianPace?easyEvidence.medianPace+.25:0),3);
    const easyMid=round((easyFast+easySlow)/2,3);
    const maxHR=numeric(settings.maxHR);
    const lthr=numeric(settings.lthr);
    const easyHRMin=numeric(settings.easyHRMin)??numeric(settings.z1Max)??(maxHR?Math.round(maxHR*.60):null);
    const easyHRMax=numeric(settings.easyHRMax)??numeric(settings.z2Max)??(maxHR?Math.round(maxHR*.75):null);
    const tempoHRMin=numeric(settings.z3Max)??(lthr?Math.round(lthr*.90):null);
    const tempoHRMax=lthr??numeric(settings.z4Max)??(maxHR?Math.round(maxHR*.90):null);
    const anchors={
      easy:easyMid,
      easyFast,
      easySlow,
      steady:round(threshold+.35,3),
      threshold:round(threshold,3),
      interval:round(benchmarkVdot?paceForVdotAtDuration(benchmarkVdot,11):Math.max(3.1,current10k-.30),3),
      current_5k:round(paceFor(5)||Math.max(3.2,current10k-.24),3),
      current_10k:round(current10k,3),
      current_half:round(paceFor(21.0975)||current10k+.24,3),
      current_marathon:round(paceFor(42.195)||current10k+.55,3),
      repetition:round(benchmarkVdot?paceForVdotAtDuration(benchmarkVdot,4):Math.max(3,current10k-.45),3),
      strides:round(Math.max(3,current10k-.45),3),
      hill_controlled:null
    };
    const targetMinutes=parseClock(input.targetTime,profile.distanceKm>=21);
    const targetPace=profile.distanceKm&&targetMinutes?targetMinutes/profile.distanceKm:null;
    const currentGoalPace=profile.distanceKm
      ? (paceFor(profile.distanceKm)||anchors[`current_${profile.key==='Half'?'half':profile.key==='Marathon'?'marathon':profile.key.toLowerCase()}`]||current10k)
      : null;
    const currentGoalMinutes=profile.distanceKm&&currentGoalPace?currentGoalPace*profile.distanceKm:null;
    const improvementPct=targetMinutes&&currentGoalMinutes&&targetMinutes<currentGoalMinutes
      ? round((currentGoalMinutes-targetMinutes)/currentGoalMinutes*100,1):0;
    const confidence=benchmark?'high':recent.activities>=4?'medium':'low';
    const goalRisk=improvementPct>12?'high':improvementPct>6?'medium':'low';
    return {
      level,benchmark,benchmarkVdot,recent,
      currentWeeklyKm:round(weeklyKm||0,1),
      longestRecentRunKm:round(longestRunKm||0,1),
      anchors,targetMinutes,targetPace,currentGoalMinutes:currentGoalMinutes?round(currentGoalMinutes,2):null,
      effortTargets:{
        easy:{paceFast:easyFast,paceSlow:easySlow,hrMin:easyHRMin,hrMax:easyHRMax,basis:easyEvidence.sessions>=2?'activity_pace_hr+settings':'settings+fitness_model'},
        tempo:{paceFast:configuredTempo?.fast||round(threshold-.08,3),paceSlow:configuredTempo?.slow||round(threshold+.08,3),hrMin:tempoHRMin,hrMax:tempoHRMax,basis:configuredTempo?'athlete_settings':configuredThreshold?'threshold_setting':benchmarkVdot?'recent_benchmark_vdot':'level_fallback'}
      },
      easyPaceEvidence:easyEvidence,
      athleteSettingsUsed:{maxHR,lthr,easyHRMin,easyHRMax,z1Max:numeric(settings.z1Max),z2Max:numeric(settings.z2Max),z3Max:numeric(settings.z3Max),z4Max:numeric(settings.z4Max),z5Max:numeric(settings.z5Max),thresholdPace:settings.thresholdPace||'',tempoFast:settings.tempoFast||'',tempoSlow:settings.tempoSlow||''},
      improvementPct,confidence,goalRisk,
      paceBasis:benchmark?'recent_benchmark':recent.activities>=4?'recent_volume_with_conservative_pace':'level_fallback',
      volumeBasis:volumeHistoryReliable?(suppliedFromHistory?'activity_history':'manual_or_explicit'):'insufficient_history_conservative_fallback'
    };
  }

  function allocatePhases(profile,totalWeeks){
    const total=Math.max(3,parseInt(totalWeeks)||profile.defaultWeeks);
    if(!profile.race){
      const base=Math.max(1,Math.round(total*.45));
      const consolidate=total>=6?1:0;
      return Array.from({length:total},(_,index)=>index<base?'Base':index>=total-consolidate?'Consolidate':'Build');
    }
    const raceWeek=1;
    const taper=total>=14?2:total>=6?1:0;
    const specific=total>=12?3:total>=8?2:1;
    const base=total>=12?Math.min(4,Math.floor(total*.25)):total>=7?2:total>=5?1:0;
    let build=total-raceWeek-taper-specific-base;
    let adjustedBase=base;
    while(build<1&&adjustedBase>0){adjustedBase--;build++;}
    const phases=[];
    phases.push(...Array(adjustedBase).fill('Base'));
    phases.push(...Array(Math.max(1,build)).fill('Build'));
    phases.push(...Array(specific).fill('Specific'));
    phases.push(...Array(taper).fill('Taper'));
    phases.push('RaceWeek');
    return phases.slice(0,total);
  }
  function phaseDisplay(phase){return phase==='Specific'?'Peak / Specific':phase;}
  function phaseMeta(phases,index){
    const phase=phases[index];
    const indexes=phases.map((value,i)=>value===phase?i:-1).filter(i=>i>=0);
    const position=indexes.indexOf(index);
    return {position,count:indexes.length,progress:indexes.length<=1?1:position/(indexes.length-1)};
  }
  function phaseLongTarget(profile,level,phase){
    const targets=profile.longRunTargets||{};
    return targets[phase]?.[level]||profile.maxLongKm[level];
  }
  function longRunDistance(profile,athlete,phase,weekIndex,targetVolume,previousLongKm=0,previousVolume=0,highestLongKm=0){
    if(phase==='RaceWeek')return 3;
    const level=athlete.level;
    const phaseTarget=phaseLongTarget(profile,level,phase);
    const baseline=Math.max(profile.minLongKm,athlete.longestRecentRunKm||0);
    const progressionCap=round(baseline*(1+.08*Math.max(0,weekIndex)),1);
    const volumeCap=Math.max(profile.minLongKm,targetVolume*(profile.maxLongRatio||.50));
    let distance=Math.min(phaseTarget,profile.maxLongKm[level],progressionCap,volumeCap);
    const baseRatio=profile.daniels?.baseLongRunMaxWeeklyRatio;
    if(phase==='Base'&&baseRatio){
      const phaseOneCap=targetVolume*baseRatio;
      const established=Math.max(profile.minLongKm,athlete.longestRecentRunKm||0);
      distance=Math.min(distance,Math.max(phaseOneCap,established));
    }
    const stepBack=previousLongKm>0&&previousVolume>0&&targetVolume<previousVolume*.94;
    if(previousLongKm>0){
      const recoveryCeiling=Math.max(previousLongKm*1.10,highestLongKm*1.08);
      distance=Math.min(distance,stepBack?previousLongKm*.88:recoveryCeiling);
    }
    if(phase==='Taper')distance=Math.min(distance,Math.max(profile.minLongKm*.75,previousLongKm*.72));
    return round(Math.max(phase==='Taper'?3:profile.minLongKm,distance),1);
  }
  function buildWeeklyTargets(profile,athlete,phases){
    const fallback=profile.defaultWeeklyKm[athlete.level];
    let volume=athlete.currentWeeklyKm>0?Math.max(8,athlete.currentWeeklyKm):fallback;
    const cap=volume*1.35;
    let peak=volume;
    return phases.map((phase,index)=>{
      if(index>0&&['Base','Build'].includes(phase))volume=Math.min(cap,volume*(phase==='Base'?1.04:1.06));
      if(index>0&&index%4===3&&['Base','Build'].includes(phase))volume*=.86;
      if(phase==='Specific')volume=Math.min(cap,Math.max(volume,peak)*1.01);
      peak=Math.max(peak,volume);
      if(phase==='Taper')volume=peak*.66;
      if(phase==='RaceWeek')volume=peak*.40;
      if(phase==='Consolidate')volume=peak*.78;
      return round(volume,1);
    });
  }
  function trainingWeekdays(daysPerWeek,longRunDay){
    const days=clamp(parseInt(daysPerWeek)||4,3,6);
    const longDay=clamp(parseInt(longRunDay)||0,0,6);
    const offsets=days===3?[-5,-3,0]:days===4?[-6,-4,-2,0]:days===5?[-6,-5,-4,-2,0]:[-6,-5,-4,-3,-1,0];
    return offsets.map(offset=>({weekday:(longDay+offset+7)%7,offset,isLong:offset===0,isQuality:offset===(days===3?-3:-4)}));
  }
  function isRecoveryRunSlot(slot,daysPerWeek){
    const days=clamp(parseInt(daysPerWeek)||4,3,6);
    return days>=5&&(slot.offset===-6||(days>=6&&slot.offset===-3));
  }
  function isQualityType(type){return ['Tempo','Interval'].includes(String(type||''));}
  function recoveryAdvice(intent,context={}){
    const table={
      passive_rest:{
        title:'Rest day',
        summary:'No running load today. Keep the day easy so the next key session is not compromised.',
        actions:['Sleep target first','Easy walking or mobility only','Normal meals and hydration'],
        avoid:['Do not add catch-up mileage','Do not turn rest into tempo']
      },
      active_recovery:{
        title:'Active recovery',
        summary:'Very light movement is acceptable only if legs feel better after the first 10 minutes.',
        actions:['Walk, mobility, or short easy spin','Keep RPE 1-2','Stop if soreness rises'],
        avoid:['No strides','No pace target']
      },
      post_long_run:{
        title:'Post long-run recovery',
        summary:'Absorb the long run. The purpose is tissue recovery and energy replacement, not extra fitness.',
        actions:['Prioritize sleep','Eat enough carbohydrate and protein','Walk or mobility if it feels good'],
        avoid:['No hard running','No catch-up intervals']
      },
      post_quality:{
        title:'Post quality recovery',
        summary:'Protect adaptation after threshold, interval, hill, or race-specific work.',
        actions:['Keep HR low if moving','Use soreness and resting HR as brakes','Delay hard work if legs stay heavy'],
        avoid:['No second quality session','No gray-zone run']
      },
      pre_race:{
        title:'Pre-race rest',
        summary:'Arrive fresh. Do not add fitness work inside the final 24 hours.',
        actions:['Short walk or mobility only','Prepare gear and sleep','Keep food familiar'],
        avoid:['No tempo','No long run','No new exercises']
      },
      illness_or_pain:{
        title:'Illness or pain recovery',
        summary:'Training is blocked until symptoms settle. Fitness loss from one rest day is lower risk than forcing load.',
        actions:['Rest','Monitor symptoms','Resume with easy running only'],
        avoid:['No intensity','No testing fitness']
      }
    };
    const base=table[intent]||table.passive_rest;
    return {...base,intent,date:context.date||'',sourceSessionId:context.sourceSessionId||'',phase:context.phase||'',priority:['post_quality','post_long_run','pre_race','illness_or_pain'].includes(intent)?'high':'normal'};
  }
  function createRecoveryCards({startDate,endDate,sessions,profile,daysPerWeek}){
    const byDate=new Map((sessions||[]).map(session=>[session.date,session]));
    const cards=[];
    for(let date=startDate;date&&date<endDate;date=addDays(date,1)){
      const current=byDate.get(date);
      const previous=byDate.get(addDays(date,-1));
      const next=byDate.get(addDays(date,1));
      let intent='';
      let source=previous||next||current||null;
      if(profile.race&&addDays(date,1)===endDate)intent='pre_race';
      else if(current?.type==='Rest')intent='passive_rest';
      else if(current)continue;
      else if(previous?.type==='Long')intent='post_long_run';
      else if(isQualityType(previous?.type))intent='post_quality';
      else if(isQualityType(next?.type))intent=daysPerWeek>=5?'active_recovery':'passive_rest';
      else intent='passive_rest';
      cards.push(recoveryAdvice(intent,{date,sourceSessionId:source?.sessionId||'',phase:source?.phase||''}));
    }
    return cards;
  }
  function paceForIntensity(anchors,intensity){return anchors[intensity]||anchors.threshold;}
  function paceLabel(pace,range=null){
    return range?`${formatPace(range.fast)}-${formatPace(range.slow)}`:formatPace(pace);
  }
  function segmentSummary(spec,pace,range=null){
    if(spec.structure==='continuous')return `${spec.workKm.toFixed(1)} กม. ต่อเนื่อง @ ${paceLabel(pace,range)}/กม.`;
    if(spec.repKm)return `${spec.reps} x ${spec.repKm<1?Math.round(spec.repKm*1000)+' ม.':spec.repKm+' กม.'} @ ${paceLabel(pace,range)}/กม. พัก ${Math.round(spec.recoverySeconds/60*10)/10} นาที`;
    return `${spec.reps} x ${spec.repSeconds} วินาที พัก ${Math.round(spec.recoverySeconds/60*10)/10} นาที`;
  }
  function detailsFor(spec,totalKm,pace,effortTarget=null){
    const range=effortTarget?.paceFast&&effortTarget?.paceSlow?{fast:effortTarget.paceFast,slow:effortTarget.paceSlow}:null;
    const main=segmentSummary(spec,pace,range);
    const purpose={
      threshold:'พัฒนาความเร็วที่คุมได้นานและความทนทานใกล้ lactate threshold',
      vo2:'พัฒนาความเร็วและกำลังแอโรบิก โดยยังคุมทุก rep ให้สม่ำเสมอ',
      race_specific:'ฝึกความคุ้นเคยกับความหนักและจังหวะเฉพาะของระยะเป้าหมาย',
      hill_strength:'สร้างแรงวิ่งและฟอร์มบนเนินโดยไม่เร่งจนเสียท่า',
      speed_skill:'รักษาความคล่องของขาและท่าวิ่ง ไม่ใช่การ sprint เต็มแรง',
      steady:'เพิ่มความทนทานแบบต่อเนื่องโดยไม่ขึ้นถึง threshold'
    }[spec.intent]||'สร้างความฟิตตามเป้าหมายของสัปดาห์';
    return {
      warmup:'วิ่งเบา 1.5-2 กม. ตามด้วย mobility และ strides สั้นตามความพร้อม',
      mainSet:main,
      cooldown:'วิ่งเบา 1-1.5 กม. และจบโดยไม่เร่งท้าย',
      execution:`${purpose}${effortTarget?.hrMax?` คุม HR ไม่เกินประมาณ ${effortTarget.hrMax} bpm`:''} ถ้า pace, HR หรือฟอร์มเริ่มควบคุมไม่ได้ ให้ลดความเร็วหรือจบชุด`,
      successCriteria:'ช่วงงานหลักสม่ำเสมอ จบแล้วยังควบคุมฟอร์มได้ และไม่มีอาการเจ็บเพิ่ม',
      intensity:spec.intent==='speed_skill'?'เบา + เร่งสั้น':'คุณภาพแบบควบคุม',
      targetDescription:`${purpose} รวมระยะประมาณ ${totalKm.toFixed(1)} กม.`
    };
  }
  function thresholdSpec(profile,progress,structure='continuous'){
    const workKm=round(profile.thresholdWorkKm.min+(profile.thresholdWorkKm.max-profile.thresholdWorkKm.min)*progress,1);
    const split=structure==='repetitions'&&workKm>=4;
    return {intent:'threshold',structure:split?'repetitions':'continuous',reps:split?2:1,repKm:split?round(workKm/2,1):workKm,workKm,recoverySeconds:split?120:0,intensity:'threshold'};
  }
  function intervalSpec(list,progress){
    const index=Math.min(list.length-1,Math.floor(progress*list.length));
    const source=list[Math.max(0,index)]||list[0];
    const workKm=source.repKm?round(source.reps*source.repKm,1):0;
    return {...source,structure:'repetitions',workKm};
  }
  function danielsClassForSpec(profile,spec){
    if(!spec)return '';
    if(spec.intent==='threshold')return 'T';
    if(spec.intent==='vo2')return 'I';
    if(['speed_skill','hill_strength','repetition'].includes(spec.intent))return 'R';
    // Goal-pace work is retained as its own class. It is not silently treated
    // as I pace, whose Daniel's limit applies only to true I-pace repetitions.
    if(spec.intent==='race_specific')return profile.key==='Half'?'HMP':'Race';
    return '';
  }
  function danielsQualityCap(profile,spec,weeklyKm,phase){
    const qualityClass=danielsClassForSpec(profile,spec);
    const rule=profile.daniels?.qualityCaps?.[qualityClass];
    const profileBudget=profile.qualityBudgetKm?.[phase];
    const ruleCap=rule
      ? Math.min(rule.maxKm||Infinity,Math.max(0,weeklyKm*(rule.percentOfWeekly||0)))
      : Infinity;
    const phaseCap=Number.isFinite(profileBudget)?profileBudget:Infinity;
    return {qualityClass,capKm:round(Math.min(ruleCap,phaseCap),1),rule:rule||null};
  }
  function capQualitySpec(spec,capKm){
    if(!Number.isFinite(capKm)||!spec.workKm||spec.workKm<=capKm+.05)return spec;
    // Preserve repetitions only when at least two whole reps fit. Otherwise a
    // controlled continuous block is a clearer and safer prescription.
    if(spec.structure==='continuous')return {...spec,reps:1,repKm:round(capKm,1),workKm:round(capKm,1),recoverySeconds:0};
    if(spec.repKm){
      const reps=Math.floor(capKm/spec.repKm);
      return reps>=2
        ? {...spec,reps,workKm:round(reps*spec.repKm,1)}
        : {...spec,structure:'continuous',reps:1,repKm:round(capKm,1),workKm:round(capKm,1),recoverySeconds:0};
    }
    return spec;
  }
  function qualitySpec(profile,phase,progress,weekIndex,phasePosition=0){
    if(phase==='Base'){
      return weekIndex%2===0
        ? {intent:'speed_skill',structure:'repetitions',reps:6+Math.min(4,weekIndex),repSeconds:20,recoverySeconds:70,intensity:'strides',workKm:0}
        : {intent:'hill_strength',structure:'repetitions',reps:6+Math.min(4,weekIndex),repSeconds:30,recoverySeconds:90,intensity:'hill_controlled',workKm:0};
    }
    const shortRoadGoal=['5K','10K'].includes(profile.key);
    if(phase==='Build'&&shortRoadGoal)return intervalSpec(profile.repetitionIntervals||profile.buildIntervals,progress);
    if(phase==='Build'){
      if(phasePosition%3===0)return thresholdSpec(profile,progress,'continuous');
      if(phasePosition%3===1)return intervalSpec(profile.buildIntervals,progress);
      return thresholdSpec(profile,progress,'repetitions');
    }
    if(phase==='Specific'&&shortRoadGoal){
      if(phasePosition===0)return intervalSpec(profile.buildIntervals,progress);
      return thresholdSpec(profile,Math.max(.65,progress),'continuous');
    }
    if(phase==='Specific'){
      if(phasePosition%3===0)return thresholdSpec(profile,Math.max(.65,progress),'continuous');
      return profile.specificIntervals.length?intervalSpec(profile.specificIntervals,progress):thresholdSpec(profile,progress,'continuous');
    }
    if(phase==='Taper'){
      const source=profile.specificIntervals[0]||profile.buildIntervals[0];
      if(source?.repKm){
        const reps=Math.max(2,Math.min(3,source.reps));
        return {...source,structure:'repetitions',reps,workKm:round(reps*source.repKm,1),recoverySeconds:Math.max(90,source.recoverySeconds||90)};
      }
      return {intent:'speed_skill',structure:'repetitions',reps:6,repSeconds:20,recoverySeconds:80,intensity:'strides',workKm:0};
    }
    if(phase==='Consolidate')return {intent:'steady',structure:'continuous',reps:1,repKm:3,workKm:3,recoverySeconds:0,intensity:'steady'};
    return {intent:'speed_skill',structure:'repetitions',reps:4,repSeconds:20,recoverySeconds:90,intensity:'strides',workKm:0};
  }
  function legacyTypeForIntent(intent){
    if(['threshold','race_specific','steady'].includes(intent))return 'Tempo';
    if(['vo2','hill_strength','repetition'].includes(intent))return 'Interval';
    return 'Easy';
  }
  function createQualitySession(profile,phase,progress,weekIndex,athlete,weeklyKm,phasePosition=0){
    let spec=qualitySpec(profile,phase,progress,weekIndex,phasePosition);
    const danielsPolicy=danielsQualityCap(profile,spec,weeklyKm,phase);
    spec=capQualitySpec(spec,danielsPolicy.capKm);
    const pace=paceForIntensity(athlete.anchors,spec.intensity);
    const effortTarget=spec.intent==='threshold'?athlete.effortTargets.tempo:null;
    const targetPaceRange=effortTarget?`${formatPace(effortTarget.paceFast)}-${formatPace(effortTarget.paceSlow)}`:'';
    const targetHR=spec.intent==='threshold'?(effortTarget?.hrMax||''):'';
    const totalKm=round(Math.max(phase==='Taper'?3:3.5,(spec.workKm||1)+(phase==='Taper'?2:3)),1);
    const details=detailsFor(spec,totalKm,pace,effortTarget);
    return {
      type:legacyTypeForIntent(spec.intent),intent:spec.intent,targetDist:totalKm,targetPace:pace?formatPace(pace):'',targetPaceRange,targetHR,
      priority:['threshold','vo2','repetition','race_specific'].includes(spec.intent)?'key':'normal',
      workoutSpec:{...spec,qualityDistanceKm:spec.workKm||0,danielsClass:danielsPolicy.qualityClass,danielsCapKm:danielsPolicy.capKm,danielsRule:danielsPolicy.rule,totalDistanceKm:totalKm,intensityTarget:{basis:effortTarget?.basis||spec.intensity,paceMinPerKm:pace?round(pace,3):null,paceFast:effortTarget?.paceFast||null,paceSlow:effortTarget?.paceSlow||null,hrMin:effortTarget?.hrMin||null,hrMax:effortTarget?.hrMax||null}},
      details,
      description:details.targetDescription
    };
  }
  function easyDetails(distance,pace,intent='easy',effortTarget=null){
    const recovery=intent==='recovery';
    const paceText=effortTarget?.paceFast&&effortTarget?.paceSlow?`${formatPace(effortTarget.paceFast)}-${formatPace(effortTarget.paceSlow)}`:formatPace(pace);
    const hrText=effortTarget?.hrMin&&effortTarget?.hrMax?` และ HR ${effortTarget.hrMin}-${effortTarget.hrMax} bpm`:effortTarget?.hrMax?` และ HR ไม่เกิน ${effortTarget.hrMax} bpm`:'';
    return {
      warmup:'5-10 นาทีแรกให้ช้ามากและผ่อนคลาย',
      mainSet:`วิ่ง${recovery?'ฟื้นตัว':'เบา'} ${distance.toFixed(1)} กม. ในช่วง ${paceText}/กม.${hrText} โดยใช้ talk test เป็นตัวตัดสินสุดท้าย`,
      cooldown:'เดิน 5 นาทีหรือ mobility เบา ๆ',
      execution:'ต้องพูดเป็นประโยคได้และไม่ไล่ pace เมื่ออากาศร้อนหรือร่างกายล้า',
      successCriteria:'RPE 3-4/10 และจบแล้วรู้สึกว่ายังวิ่งต่อได้',
      intensity:recovery?'ฟื้นตัว':'ง่าย',
      targetDescription:recovery?'วิ่งฟื้นตัวเพื่อเตรียมร่างกายสำหรับ session ถัดไป':'สร้างฐานแอโรบิกด้วยความหนักที่ควบคุมได้'
    };
  }
  function longDetails(distance,pace,profile,effortTarget=null){
    const paceText=effortTarget?.paceFast&&effortTarget?.paceSlow?`${formatPace(effortTarget.paceFast)}-${formatPace(effortTarget.paceSlow)}`:formatPace(pace);
    const hrText=effortTarget?.hrMax?` และ HR ไม่เกินประมาณ ${effortTarget.hrMax} bpm`:'';
    return {
      warmup:'10 นาทีแรกให้ช้ากว่า pace หลักและตรวจความพร้อมของร่างกาย',
      mainSet:`วิ่งยาว ${distance.toFixed(1)} กม. ในช่วง ${paceText}/กม.${hrText} หรือช้ากว่านี้เมื่ออากาศร้อน`,
      cooldown:'เดิน 5-10 นาที เติมน้ำและพลังงานตามระยะ',
      execution:profile.key==='Marathon'?'เน้น time-on-feet และการเติมพลัง ไม่เปลี่ยนเป็น tempo เอง':'คุม talk test ได้ตลอดและไม่เร่งช่วงท้ายโดยไม่มีคำสั่ง',
      successCriteria:'จบโดยไม่หมดแรง ฟอร์มไม่เสีย และพร้อมฟื้นตัวภายใน 24-48 ชั่วโมง',
      intensity:'ง่าย-ยาว',
      targetDescription:`สร้าง endurance สำหรับ ${profile.label} ด้วย long run ที่สัมพันธ์กับ volume รายสัปดาห์`
    };
  }
  function unavailableSet(value){
    const rows=Array.isArray(value)?value:String(value||'').split(/[,\s]+/);
    const aliases={
      sun:0,sunday:0,'อาทิตย์':0,'วันอาทิตย์':0,
      mon:1,monday:1,'จันทร์':1,'วันจันทร์':1,
      tue:2,tues:2,tuesday:2,'อังคาร':2,'วันอังคาร':2,
      wed:3,wednesday:3,'พุธ':3,'วันพุธ':3,
      thu:4,thur:4,thurs:4,thursday:4,'พฤหัส':4,'พฤหัสบดี':4,'วันพฤหัสบดี':4,
      fri:5,friday:5,'ศุกร์':5,'วันศุกร์':5,
      sat:6,saturday:6,'เสาร์':6,'วันเสาร์':6
    };
    return new Set(rows.map(item=>{
      const token=String(item||'').trim().toLowerCase();
      return Object.prototype.hasOwnProperty.call(aliases,token)?`weekday:${aliases[token]}`:token;
    }).filter(Boolean));
  }
  function isUnavailable(date,unavailable){
    if(unavailable.has(date.toLowerCase()))return true;
    const parsed=parseDate(date);if(!parsed)return false;
    return unavailable.has(`weekday:${parsed.getDay()}`);
  }
  function moveFromUnavailable(date,used,unavailable,endDate){
    let candidate=date;
    for(let offset=0;offset<6;offset++){
      if(!used.has(candidate)&&!isUnavailable(candidate,unavailable)&&(!endDate||candidate<endDate))return candidate;
      candidate=addDays(candidate,1);
    }
    return date;
  }
  function appendRaceWeekGuardSessions({sessions,profile,athlete,startDate,endDate,totalWeeks,planId,unavailable}){
    if(!profile.race||!endDate)return;
    const used=new Set(sessions.map(session=>session.date));
    const effort=athlete.effortTargets.easy;
    const addEasy=(offset,distance)=>{
      const date=addDays(endDate,offset);
      if(!date||date<startDate||used.has(date)||isUnavailable(date,unavailable))return;
      const details=easyDetails(distance,athlete.anchors.easy,'easy',effort);
      sessions.push({
        sessionId:`${planId}-race-guard-${Math.abs(offset)}`,date,phase:'RaceWeek',phaseLabel:phaseDisplay('RaceWeek'),week:totalWeeks,
        type:'Easy',intent:'easy',targetDist:distance,targetPace:formatPace(athlete.anchors.easy),targetPaceRange:`${formatPace(effort.paceFast)}-${formatPace(effort.paceSlow)}`,targetHR:effort.hrMax||'',priority:'normal',
        workoutSpec:{intent:'easy',structure:'continuous',raceWeekGuard:true,totalDistanceKm:distance,qualityDistanceKm:0,intensityTarget:{basis:effort.basis,paceMinPerKm:athlete.anchors.easy,paceFast:effort.paceFast,paceSlow:effort.paceSlow,hrMin:effort.hrMin,hrMax:effort.hrMax}},
        details,description:details.targetDescription,methodologyVersion:T.METHODOLOGY_VERSION,
        notes:`Training Engine V2 · ${profile.label} · Race week: easy only before race`
      });
      used.add(date);
    };
    // Race-week coverage must be relative to the athlete's actual race date,
    // not their normal weekday pattern. This preserves 2 Easy days and rest
    // on race eve even when the last scheduled workout would otherwise be earlier.
    addEasy(-3,3);
    addEasy(-2,2.5);
    const raceEve=addDays(endDate,-1);
    if(!raceEve||raceEve<startDate||used.has(raceEve))return;
    const details=easyDetails(0,athlete.anchors.easy,'recovery',effort);
    sessions.push({
      sessionId:`${planId}-race-guard-1`,date:raceEve,phase:'RaceWeek',phaseLabel:phaseDisplay('RaceWeek'),week:totalWeeks,
      type:'Rest',intent:'rest',targetDist:0,targetPace:'',targetPaceRange:'',targetHR:'',priority:'normal',
      workoutSpec:{intent:'rest',structure:'rest',raceWeekGuard:true,recoveryIntent:'pre_race',totalDistanceKm:0,qualityDistanceKm:0},
      recoveryIntent:'pre_race',recoveryAdvice:recoveryAdvice('pre_race',{date:raceEve,phase:'RaceWeek'}),
      details:{...details,mainSet:'Rest before race. Do not add a catch-up workout.',targetDescription:'Rest before race day.'},description:'Rest before race day.',methodologyVersion:T.METHODOLOGY_VERSION,
      notes:`Training Engine V2 · ${profile.label} · Race week: pre-race rest`
    });
  }
  function createPlan(input={}){
    const profile=T.getProfile(input.distance||input.goalProfile?.distance||'10K');
    const startDate=input.startDate||dateString(new Date());
    const totalWeeks=Math.max(3,parseInt(input.totalWeeks)||profile.defaultWeeks);
    const endDate=input.endDate||addDays(startDate,totalWeeks*7);
    const athlete=buildAthleteModel(input,profile);
    const phases=allocatePhases(profile,totalWeeks);
    const weeklyTargets=buildWeeklyTargets(profile,athlete,phases);
    const longRunDay=clamp(parseInt(input.longRunDay ?? input.goalProfile?.longRunDay)||0,0,6);
    const daysPerWeek=clamp(parseInt(input.daysPerWeek||input.days)||4,3,6);
    const weekdays=trainingWeekdays(daysPerWeek,longRunDay);
    const unavailable=unavailableSet(input.unavailable||input.goalProfile?.unavailable||input.unavailableRaw||input.goalProfile?.unavailableRaw);
    const now=Number.isFinite(input.now)?input.now:Date.now();
    const planId=input.planId||`plan-${now.toString(36)}-${profile.key.toLowerCase().replace(/[^a-z0-9]/g,'')}`;
    const used=new Set(),sessions=[],phaseSchedule=[];
    let peakVolume=0,previousLongDistance=0,previousTargetVolume=0,highestLongDistance=0;

    phases.forEach((phase,weekIndex)=>{
      const targetVolume=weeklyTargets[weekIndex];
      peakVolume=Math.max(peakVolume,targetVolume);
      const phaseInfo=phaseMeta(phases,weekIndex);
      const progress=phaseInfo.progress;
      const quality=createQualitySession(profile,phase,progress,weekIndex,athlete,targetVolume,phaseInfo.position);
      const longDistance=longRunDistance(profile,athlete,phase,weekIndex,targetVolume,previousLongDistance,previousTargetVolume,highestLongDistance);
      if(phase!=='RaceWeek'){
        previousLongDistance=longDistance;
        highestLongDistance=Math.max(highestLongDistance,longDistance);
      }
      previousTargetVolume=targetVolume;
      const easySlots=weekdays.filter(slot=>!slot.isLong&&!slot.isQuality).length;
      const easyMinimum=phase==='Taper'?2:3;
      const remaining=Math.max(easyMinimum*easySlots,targetVolume-quality.targetDist-longDistance);
      const easyDistance=round(clamp(remaining/Math.max(1,easySlots),easyMinimum,12),1);
      const weekStart=weekDate(startDate,weekIndex,1);
      phaseSchedule.push({week:weekIndex+1,phase,phaseLabel:phaseDisplay(phase),startDate:weekStart,targetVolumeKm:targetVolume});

      weekdays.forEach((slot,slotIndex)=>{
        let date=weekDate(startDate,weekIndex,slot.weekday);
        if(!date||date<startDate)return;
        if(profile.race&&date===endDate)return;
        if(date>=endDate)return;
        date=moveFromUnavailable(date,used,unavailable,endDate);
        if(used.has(date)||date>=endDate)return;
        used.add(date);
        let session;
        if(slot.isQuality)session={...quality};
        else if(slot.isLong&&phase!=='RaceWeek'){
          const effort=athlete.effortTargets.easy;
          const details=longDetails(longDistance,athlete.anchors.easy,profile,effort);
          session={type:'Long',intent:'long',targetDist:longDistance,targetPace:formatPace(athlete.anchors.easy),targetPaceRange:`${formatPace(effort.paceFast)}-${formatPace(effort.paceSlow)}`,targetHR:effort.hrMax||'',priority:'key',
            workoutSpec:{intent:'long',structure:'continuous',totalDistanceKm:longDistance,qualityDistanceKm:0,intensityTarget:{basis:effort.basis,paceMinPerKm:athlete.anchors.easy,paceFast:effort.paceFast,paceSlow:effort.paceSlow,hrMin:effort.hrMin,hrMax:effort.hrMax}},details,description:details.targetDescription};
        }else{
          const recovery=isRecoveryRunSlot(slot,daysPerWeek);
          const distance=phase==='RaceWeek'?Math.min(4,easyDistance):easyDistance;
          const effort=athlete.effortTargets.easy;
          const details=easyDetails(distance,athlete.anchors.easy,recovery?'recovery':'easy',effort);
          const recoveryIntent=recovery?(slot.offset===-6?'post_long_run':'post_quality'):'';
          const recoveryCard=recovery?recoveryAdvice(recoveryIntent,{date,phase}):null;
          session={type:recovery?'Recovery':'Easy',intent:recovery?'recovery':'easy',targetDist:distance,targetPace:formatPace(athlete.anchors.easy),targetPaceRange:`${formatPace(effort.paceFast)}-${formatPace(effort.paceSlow)}`,targetHR:effort.hrMax||'',priority:'normal',
            workoutSpec:{intent:recovery?'recovery':'easy',structure:'continuous',recoveryIntent,totalDistanceKm:distance,qualityDistanceKm:0,intensityTarget:{basis:effort.basis,paceMinPerKm:athlete.anchors.easy,paceFast:effort.paceFast,paceSlow:effort.paceSlow,hrMin:effort.hrMin,hrMax:effort.hrMax}},recoveryIntent,recoveryAdvice:recoveryCard,details,description:details.targetDescription};
        }
        if(profile.race&&addDays(date,1)===endDate){
          const details=easyDetails(0,athlete.anchors.easy,'recovery',athlete.effortTargets.easy);
          session={type:'Rest',intent:'rest',targetDist:0,targetPace:'',targetHR:'',priority:'normal',workoutSpec:{intent:'rest',structure:'rest',recoveryIntent:'pre_race',totalDistanceKm:0,qualityDistanceKm:0},recoveryIntent:'pre_race',recoveryAdvice:recoveryAdvice('pre_race',{date,phase}),details:{...details,mainSet:'พักก่อนวันแข่ง ไม่เพิ่มการซ้อมชดเชย',targetDescription:'พักเพื่อให้ขาสดก่อนวันแข่ง'},description:'พักเพื่อให้ขาสดก่อนวันแข่ง'};
        }
        sessions.push({...session,sessionId:`${planId}-w${weekIndex+1}-s${slotIndex+1}`,date,phase,phaseLabel:phaseDisplay(phase),week:weekIndex+1,methodologyVersion:T.METHODOLOGY_VERSION,notes:`Training Engine V2 · ${profile.label} · ${phaseDisplay(phase)}`});
      });
    });

    appendRaceWeekGuardSessions({sessions,profile,athlete,startDate,endDate,totalWeeks,planId,unavailable});
    sessions.sort((a,b)=>a.date.localeCompare(b.date));
    const recoveryCards=createRecoveryCards({startDate,endDate,sessions,profile,daysPerWeek});
    const recoverySummary=recoveryCards.reduce((acc,card)=>{acc[card.intent]=(acc[card.intent]||0)+1;return acc;},{});
    const raceRecoveryPolicy=profile.race&&profile.daniels?.raceRecovery
      ? {
          type:'easy_running',
          easyDays:Math.round((profile.distanceKm||0)/3*profile.daniels.raceRecovery.easyDaysPer3Km),
          startsAfterRaceDate:addDays(endDate,1),
          rule:'1 easy day per 3 km raced'
        }
      : null;
    const plan={
      planId,revisionId:'r1',engineVersion:ENGINE_VERSION,methodologyVersion:T.METHODOLOGY_VERSION,status:'active',
      goal:input.goal||`${profile.label} training plan`,startDate,endDate,totalWeeks,daysPerWeek,
      createdAt:now,updatedAt:now,
      goalProfile:{
        distance:profile.key,targetTime:input.targetTime||'',targetMinutes:athlete.targetMinutes,targetPace:athlete.targetPace,
        benchmark:input.benchmark||'',unavailableRaw:input.unavailableRaw||input.goalProfile?.unavailableRaw||'',
        unavailable:[...unavailable],longRunDay:String(longRunDay),longRunDayName:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][longRunDay],raceGoal:profile.race
      },
      athleteProfile:athlete,
      inputAudit:{
        goal:input.goal||'',distance:profile.key,targetTime:input.targetTime||'',benchmark:input.benchmark||'',
        level:athlete.level,daysPerWeek,longRunDay:String(longRunDay),unavailableRaw:input.unavailableRaw||input.goalProfile?.unavailableRaw||'',
        athleteSettings:athlete.athleteSettingsUsed,easyPaceEvidenceSessions:athlete.easyPaceEvidence.sessions,
        paceBasis:athlete.paceBasis,volumeBasis:athlete.volumeBasis,
        longRunPolicy:{targets:profile.longRunTargets||{},maxLongKm:profile.maxLongKm,progressionPerWeekPct:8},
        qualityBudgetKm:profile.qualityBudgetKm||{},continuousTempoRatio:profile.continuousTempoRatio??.6,
        danielsQualityCaps:profile.daniels?.qualityCaps||null,
        raceRecoveryPolicy
      },
      phaseSchedule,sessions,recoveryCards,recoverySummary,raceRecoveryPolicy,references:REFERENCES,
      completedDates:{},adjustments:[],dailyDecisions:{},
      compatibility:{legacyMirror:true,previousEngineAvailable:true}
    };
    plan.validation=validatePlan(plan,profile,weeklyTargets,peakVolume);
    return plan;
  }
  function validatePlan(plan,profile,weeklyTargets,peakVolume){
    const errors=[],warnings=[];
    const dates=new Set(),quality=[],longRuns=[],thresholdSessions=[];
    const unavailable=unavailableSet(plan.goalProfile?.unavailable||plan.goalProfile?.unavailableRaw||'');
    (plan.sessions||[]).forEach(session=>{
      if(dates.has(session.date))errors.push(`duplicate_date:${session.date}`);
      dates.add(session.date);
      if(profile.race&&session.date===plan.endDate)errors.push(`race_day_session:${session.date}`);
      if(profile.race&&addDays(session.date,1)===plan.endDate&&session.type!=='Rest')errors.push(`race_eve_not_rest:${session.date}`);
      if(['Tempo','Interval'].includes(session.type))quality.push(session);
      if(session.type==='Long')longRuns.push(session);
      if(session.workoutSpec?.intent==='threshold')thresholdSessions.push(session);
      const qualityBudget=profile.qualityBudgetKm?.[session.phase];
      if(qualityBudget&&session.workoutSpec?.qualityDistanceKm>qualityBudget+.15)errors.push(`quality_budget_exceeded:${session.sessionId}`);
      const weeklyKm=weeklyTargets[(session.week||1)-1]||0;
      const danielsPolicy=danielsQualityCap(profile,session.workoutSpec,weeklyKm,session.phase);
      if(danielsPolicy.rule&&session.workoutSpec?.qualityDistanceKm>danielsPolicy.capKm+.15)errors.push(`daniels_quality_cap_exceeded:${session.sessionId}`);
      if(session.type!=='Rest'&&!session.workoutSpec)errors.push(`missing_workout_spec:${session.sessionId}`);
      if(session.type!=='Rest'&&isUnavailable(session.date,unavailable))errors.push(`session_on_unavailable_date:${session.date}`);
    });
    for(let index=1;index<quality.length;index++){
      if(Math.abs(dayDiff(quality[index].date,quality[index-1].date))<=1)errors.push(`adjacent_quality:${quality[index].date}`);
    }
    const continuousTempo=thresholdSessions.filter(session=>session.workoutSpec?.structure==='continuous').length;
    const segmentedTempo=thresholdSessions.filter(session=>session.workoutSpec?.structure==='repetitions').length;
    if(segmentedTempo>0&&continuousTempo/segmentedTempo<(profile.continuousTempoRatio??.6))errors.push('continuous_tempo_underrepresented');
    longRuns.sort((a,b)=>a.date.localeCompare(b.date));
    longRuns.forEach((session,index)=>{
      const phaseTarget=phaseLongTarget(profile,plan.athleteProfile?.level||'intermediate',session.phase);
      if(['Base','Build','Specific'].includes(session.phase)&&session.targetDist>phaseTarget+.15)errors.push(`long_run_phase_cap_exceeded:${session.sessionId}`);
      const previous=longRuns[index-1];
      const previousPrevious=longRuns[index-2];
      const previousWeekTarget=weeklyTargets[(previous?.week||1)-1]||0;
      const preStepBackTarget=weeklyTargets[(previousPrevious?.week||1)-1]||0;
      const recoveringFromStepBack=previous&&previousPrevious&&previousWeekTarget<preStepBackTarget*.94;
      const progressionLimit=recoveringFromStepBack
        ? Math.max(previous.targetDist*1.105+.15,previousPrevious.targetDist*1.10+.15)
        : previous?.targetDist*1.105+.15;
      if(previous&&session.phase!=='Taper'&&session.targetDist>progressionLimit&&session.week===previous.week+1)errors.push(`long_run_progression_too_fast:${session.sessionId}`);
    });
    const phases=new Set((plan.phaseSchedule||[]).map(row=>row.phase));
    if(profile.race&&plan.totalWeeks>=6&&!phases.has('Build'))errors.push('missing_build_phase');
    if(profile.race&&plan.totalWeeks>=4&&!phases.has('Specific'))errors.push('missing_specific_phase');
    if(profile.race&&!phases.has('RaceWeek'))errors.push('missing_race_week');
    if(profile.race){
      const raceEve=addDays(plan.endDate,-1);
      const raceMinus2=addDays(plan.endDate,-2);
      const raceMinus3=addDays(plan.endDate,-3);
      if(!plan.sessions.some(session=>session.date===raceEve&&session.type==='Rest'))errors.push('race_eve_rest_missing');
      if(raceMinus2>=plan.startDate&&!isUnavailable(raceMinus2,unavailable)&&!plan.sessions.some(session=>session.date===raceMinus2&&['Easy','Recovery','Rest'].includes(session.type)))errors.push('race_minus_2_coverage_missing');
      if(raceMinus3>=plan.startDate&&!isUnavailable(raceMinus3,unavailable)&&!plan.sessions.some(session=>session.date===raceMinus3&&['Easy','Recovery','Rest'].includes(session.type)))errors.push('race_minus_3_coverage_missing');
    }
    if(profile.race&&plan.athleteProfile.goalRisk==='high')warnings.push('target_requires_large_improvement');
    if(plan.athleteProfile.confidence==='low')warnings.push('pace_anchors_low_confidence');
    const plannedWeeks=(plan.phaseSchedule||[]).map((row,index)=>({phase:row.phase,target:weeklyTargets[index]||row.targetVolumeKm}));
    const weeklyActualKm=(plan.phaseSchedule||[]).map(row=>round((plan.sessions||[]).filter(session=>session.week===row.week).reduce((sum,session)=>sum+(parseFloat(session.targetDist)||0),0),1));
    plannedWeeks.forEach((row,index)=>{
      const actual=weeklyActualKm[index]||0;
      if(row.phase!=='RaceWeek'&&actual>row.target*1.25)errors.push(`weekly_volume_above_target:w${index+1}`);
      if(row.phase!=='RaceWeek'&&actual<row.target*.65)warnings.push(`weekly_volume_below_target:w${index+1}`);
    });
    const taper=plannedWeeks.filter(row=>['Taper','RaceWeek'].includes(row.phase));
    if(profile.race&&taper.length&&taper.some(row=>row.target>=peakVolume*.9))warnings.push('taper_volume_not_reduced');
    if(profile.race&&profile.daniels?.raceRecovery&&plan.raceRecoveryPolicy?.easyDays!==Math.round((profile.distanceKm||0)/3))errors.push('race_recovery_policy_invalid');
    return {valid:errors.length===0,errors,warnings,checkedAt:plan.updatedAt,weeklyTargetsKm:weeklyTargets,weeklyActualKm,qualityBudgetKm:profile.qualityBudgetKm||{},danielsQualityCaps:profile.daniels?.qualityCaps||null,continuousTempo:{continuous:continuousTempo,segmented:segmentedTempo},longRunPeakKm:round(Math.max(0,...longRuns.map(session=>session.targetDist||0)),1)};
  }

  T.EngineV2={
    ENGINE_VERSION,REFERENCES,createPlan,validatePlan,allocatePhases,buildAthleteModel,parseBenchmark,projectedMinutes,vdotForPerformance,paceForVdotAtDuration,formatPace,dateString,addDays,unavailableSet,isUnavailable,recoveryAdvice,phaseLongTarget,longRunDistance,danielsClassForSpec,danielsQualityCap
  };
})(window);
