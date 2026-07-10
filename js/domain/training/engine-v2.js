(function(root){
  'use strict';

  const T=root.MyDashTraining;
  if(!T)throw new Error('MyDashTraining profiles must load before engine-v2.js');

  const ENGINE_VERSION=2;
  const DAY_MS=86400000;
  const REFERENCES=[
    {id:'baa-10k',title:'B.A.A. 10K Training Plans',url:'https://www.baa.org/races/boston-10k/info-for-athletes/b-a-a-10k-training/'},
    {id:'world-athletics-road',title:'World Athletics Road Running Training Guidance',url:'https://worldathletics.org/en/competitions/world-athletics-road-running-championships/world-athletics-road-running-championships-7174065/for-participants/training/'},
    {id:'taper-meta-2023',title:'Effects of tapering on performance in endurance athletes',url:'https://pubmed.ncbi.nlm.nih.gov/37163550/'},
    {id:'10k-intervals-2023',title:'Intervals at maximal sustainable effort and 10-km performance',url:'https://pubmed.ncbi.nlm.nih.gov/36724870/'},
    {id:'intensity-distribution-2022',title:'Training intensity distribution in endurance athletes: systematic review',url:'https://pubmed.ncbi.nlm.nih.gov/34749417/'},
    {id:'recreational-polarized-2014',title:'Polarized training in recreational runners',url:'https://pubmed.ncbi.nlm.nih.gov/23752040/'}
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
    const distanceAt60=benchmark?benchmark.distanceKm*Math.pow(60/benchmark.minutes,1/1.06):null;
    const calculatedThreshold=distanceAt60?60/distanceAt60:current10k+.10;
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
      current_5k:round(paceFor(5)||Math.max(3.2,current10k-.24),3),
      current_10k:round(current10k,3),
      current_half:round(paceFor(21.0975)||current10k+.24,3),
      current_marathon:round(paceFor(42.195)||current10k+.55,3),
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
      level,benchmark,recent,
      currentWeeklyKm:round(weeklyKm||0,1),
      longestRecentRunKm:round(longestRunKm||0,1),
      anchors,targetMinutes,targetPace,currentGoalMinutes:currentGoalMinutes?round(currentGoalMinutes,2):null,
      effortTargets:{
        easy:{paceFast:easyFast,paceSlow:easySlow,hrMin:easyHRMin,hrMax:easyHRMax,basis:easyEvidence.sessions>=2?'activity_pace_hr+settings':'settings+fitness_model'},
        tempo:{paceFast:configuredTempo?.fast||round(threshold-.08,3),paceSlow:configuredTempo?.slow||round(threshold+.08,3),hrMin:tempoHRMin,hrMax:tempoHRMax,basis:configuredTempo?'athlete_settings':'fitness_model'}
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
    const days=clamp(parseInt(daysPerWeek)||4,3,5);
    const longDay=clamp(parseInt(longRunDay)||0,0,6);
    const offsets=days===3?[-5,-3,0]:days===4?[-6,-4,-2,0]:[-6,-5,-3,-1,0];
    return offsets.map(offset=>({weekday:(longDay+offset+7)%7,offset,isLong:offset===0,isQuality:offset===(days===3?-3:-4)}));
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
  function qualitySpec(profile,phase,progress,weekIndex,phasePosition=0){
    if(phase==='Base'){
      return weekIndex%2===0
        ? {intent:'speed_skill',structure:'repetitions',reps:6+Math.min(4,weekIndex),repSeconds:20,recoverySeconds:70,intensity:'strides',workKm:0}
        : {intent:'hill_strength',structure:'repetitions',reps:6+Math.min(4,weekIndex),repSeconds:30,recoverySeconds:90,intensity:'hill_controlled',workKm:0};
    }
    if(phase==='Build')return phasePosition%2===0?thresholdSpec(profile,progress,phasePosition>=2?'repetitions':'continuous'):intervalSpec(profile.buildIntervals,progress);
    if(phase==='Specific'){
      if(phasePosition===0)return thresholdSpec(profile,Math.max(.65,progress),'continuous');
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
    if(['vo2','hill_strength'].includes(intent))return 'Interval';
    return 'Easy';
  }
  function createQualitySession(profile,phase,progress,weekIndex,athlete,weeklyKm,phasePosition=0){
    let spec=qualitySpec(profile,phase,progress,weekIndex,phasePosition);
    if(spec.workKm){
      const cap=Math.max(2.4,weeklyKm*(phase==='Specific'?.22:.19));
      if(spec.workKm>cap&&spec.repKm){
        const reps=Math.max(2,Math.floor(cap/spec.repKm));
        spec={...spec,reps,workKm:round(reps*spec.repKm,1)};
      }
    }
    const pace=paceForIntensity(athlete.anchors,spec.intensity);
    const effortTarget=spec.intent==='threshold'?athlete.effortTargets.tempo:null;
    const targetPaceRange=effortTarget?`${formatPace(effortTarget.paceFast)}-${formatPace(effortTarget.paceSlow)}`:'';
    const targetHR=spec.intent==='threshold'?(effortTarget?.hrMax||''):'';
    const totalKm=round(Math.max(3.5,(spec.workKm||1)+3),1);
    const details=detailsFor(spec,totalKm,pace,effortTarget);
    return {
      type:legacyTypeForIntent(spec.intent),intent:spec.intent,targetDist:totalKm,targetPace:pace?formatPace(pace):'',targetPaceRange,targetHR,
      priority:['threshold','vo2','race_specific'].includes(spec.intent)?'key':'normal',
      workoutSpec:{...spec,qualityDistanceKm:spec.workKm||0,totalDistanceKm:totalKm,intensityTarget:{basis:effortTarget?.basis||spec.intensity,paceMinPerKm:pace?round(pace,3):null,paceFast:effortTarget?.paceFast||null,paceSlow:effortTarget?.paceSlow||null,hrMin:effortTarget?.hrMin||null,hrMax:effortTarget?.hrMax||null}},
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
  function createPlan(input={}){
    const profile=T.getProfile(input.distance||input.goalProfile?.distance||'10K');
    const startDate=input.startDate||dateString(new Date());
    const totalWeeks=Math.max(3,parseInt(input.totalWeeks)||profile.defaultWeeks);
    const endDate=input.endDate||addDays(startDate,totalWeeks*7);
    const athlete=buildAthleteModel(input,profile);
    const phases=allocatePhases(profile,totalWeeks);
    const weeklyTargets=buildWeeklyTargets(profile,athlete,phases);
    const longRunDay=clamp(parseInt(input.longRunDay ?? input.goalProfile?.longRunDay)||0,0,6);
    const daysPerWeek=clamp(parseInt(input.daysPerWeek||input.days)||4,3,5);
    const weekdays=trainingWeekdays(daysPerWeek,longRunDay);
    const unavailable=unavailableSet(input.unavailable||input.goalProfile?.unavailable||input.unavailableRaw||input.goalProfile?.unavailableRaw);
    const now=Number.isFinite(input.now)?input.now:Date.now();
    const planId=input.planId||`plan-${now.toString(36)}-${profile.key.toLowerCase().replace(/[^a-z0-9]/g,'')}`;
    const used=new Set(),sessions=[],phaseSchedule=[];
    let peakVolume=0;

    phases.forEach((phase,weekIndex)=>{
      const targetVolume=weeklyTargets[weekIndex];
      peakVolume=Math.max(peakVolume,targetVolume);
      const phaseInfo=phaseMeta(phases,weekIndex);
      const progress=phaseInfo.progress;
      const quality=createQualitySession(profile,phase,progress,weekIndex,athlete,targetVolume,phaseInfo.position);
      const maxLong=profile.maxLongKm[athlete.level];
      let longDistance=clamp(targetVolume*profile.longRatio,profile.minLongKm,maxLong);
      if(phase==='Taper')longDistance*=.72;
      if(phase==='RaceWeek')longDistance=3;
      if(athlete.longestRecentRunKm>0&&weekIndex<2)longDistance=Math.min(longDistance,athlete.longestRecentRunKm*1.08);
      longDistance=round(Math.max(3,longDistance),1);
      const easySlots=weekdays.filter(slot=>!slot.isLong&&!slot.isQuality).length;
      const remaining=Math.max(3*easySlots,targetVolume-quality.targetDist-longDistance);
      const easyDistance=round(clamp(remaining/Math.max(1,easySlots),3,12),1);
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
          const recovery=slotIndex===0&&daysPerWeek===5;
          const distance=phase==='RaceWeek'?Math.min(4,easyDistance):easyDistance;
          const effort=athlete.effortTargets.easy;
          const details=easyDetails(distance,athlete.anchors.easy,recovery?'recovery':'easy',effort);
          session={type:recovery?'Recovery':'Easy',intent:recovery?'recovery':'easy',targetDist:distance,targetPace:formatPace(athlete.anchors.easy),targetPaceRange:`${formatPace(effort.paceFast)}-${formatPace(effort.paceSlow)}`,targetHR:effort.hrMax||'',priority:'normal',
            workoutSpec:{intent:recovery?'recovery':'easy',structure:'continuous',totalDistanceKm:distance,qualityDistanceKm:0,intensityTarget:{basis:effort.basis,paceMinPerKm:athlete.anchors.easy,paceFast:effort.paceFast,paceSlow:effort.paceSlow,hrMin:effort.hrMin,hrMax:effort.hrMax}},details,description:details.targetDescription};
        }
        if(profile.race&&addDays(date,1)===endDate){
          const details=easyDetails(0,athlete.anchors.easy,'recovery',athlete.effortTargets.easy);
          session={type:'Rest',intent:'rest',targetDist:0,targetPace:'',targetHR:'',priority:'normal',workoutSpec:{intent:'rest',structure:'rest',totalDistanceKm:0,qualityDistanceKm:0},details:{...details,mainSet:'พักก่อนวันแข่ง ไม่เพิ่มการซ้อมชดเชย',targetDescription:'พักเพื่อให้ขาสดก่อนวันแข่ง'},description:'พักเพื่อให้ขาสดก่อนวันแข่ง'};
        }
        sessions.push({...session,sessionId:`${planId}-w${weekIndex+1}-s${slotIndex+1}`,date,phase,phaseLabel:phaseDisplay(phase),week:weekIndex+1,methodologyVersion:T.METHODOLOGY_VERSION,notes:`Training Engine V2 · ${profile.label} · ${phaseDisplay(phase)}`});
      });
    });

    sessions.sort((a,b)=>a.date.localeCompare(b.date));
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
        paceBasis:athlete.paceBasis,volumeBasis:athlete.volumeBasis
      },
      phaseSchedule,sessions,references:REFERENCES,
      completedDates:{},adjustments:[],dailyDecisions:{},
      compatibility:{legacyMirror:true,previousEngineAvailable:true}
    };
    plan.validation=validatePlan(plan,profile,weeklyTargets,peakVolume);
    return plan;
  }
  function validatePlan(plan,profile,weeklyTargets,peakVolume){
    const errors=[],warnings=[];
    const dates=new Set(),quality=[];
    const unavailable=unavailableSet(plan.goalProfile?.unavailable||plan.goalProfile?.unavailableRaw||'');
    (plan.sessions||[]).forEach(session=>{
      if(dates.has(session.date))errors.push(`duplicate_date:${session.date}`);
      dates.add(session.date);
      if(profile.race&&session.date===plan.endDate)errors.push(`race_day_session:${session.date}`);
      if(profile.race&&addDays(session.date,1)===plan.endDate&&session.type!=='Rest')errors.push(`race_eve_not_rest:${session.date}`);
      if(['Tempo','Interval'].includes(session.type))quality.push(session);
      if(session.type!=='Rest'&&!session.workoutSpec)errors.push(`missing_workout_spec:${session.sessionId}`);
      if(session.type!=='Rest'&&isUnavailable(session.date,unavailable))errors.push(`session_on_unavailable_date:${session.date}`);
    });
    for(let index=1;index<quality.length;index++){
      if(Math.abs(dayDiff(quality[index].date,quality[index-1].date))<=1)errors.push(`adjacent_quality:${quality[index].date}`);
    }
    const phases=new Set((plan.phaseSchedule||[]).map(row=>row.phase));
    if(profile.race&&plan.totalWeeks>=6&&!phases.has('Build'))errors.push('missing_build_phase');
    if(profile.race&&plan.totalWeeks>=4&&!phases.has('Specific'))errors.push('missing_specific_phase');
    if(profile.race&&!phases.has('RaceWeek'))errors.push('missing_race_week');
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
    return {valid:errors.length===0,errors,warnings,checkedAt:plan.updatedAt,weeklyTargetsKm:weeklyTargets,weeklyActualKm};
  }

  T.EngineV2={
    ENGINE_VERSION,REFERENCES,createPlan,validatePlan,allocatePhases,buildAthleteModel,parseBenchmark,projectedMinutes,formatPace,dateString,addDays,unavailableSet,isUnavailable
  };
})(window);
