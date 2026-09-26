import {finite,localDate} from './model.mjs';

export const SESSION_TYPES=['Easy','Recovery','Tempo','Interval','Long','Race','Rest','Other'];
export const SESSION_TYPE_LABELS={
  Easy:'Easy (วิ่งสบาย)',
  Recovery:'Recovery (ฟื้นฟู)',
  Tempo:'Tempo (เทมโป)',
  Interval:'Interval (อินเทอร์วัล)',
  Long:'Long Run (วิ่งยาว)',
  Race:'Race (แข่งขัน/ทดสอบ)',
  Rest:'Rest (พัก 0 กม.)',
  Other:'Other (อื่นๆ)'
};

const isoDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'') && localDate(new Date(`${value}T12:00:00`))===value;

export function manualSession(input) {
  const date=String(input.date||'');
  const type=String(input.type||'');
  const distance=finite(input.targetDist);
  if (!isoDate(date)) throw new Error('วันที่เซสชันไม่ถูกต้อง');
  if (!SESSION_TYPES.includes(type)) throw new Error('ประเภทเซสชันไม่ถูกต้อง');
  if (type==='Rest' ? distance!==0 : distance==null || distance<=0 || distance>200) throw new Error(type==='Rest'?'วันพักต้องมีระยะ 0 กม.':'ระยะเซสชันต้องมากกว่า 0 และไม่เกิน 200 กม.');
  const title=String(input.title||'').trim().slice(0,120) || (type==='Rest'?'พัก':type);
  return {date,type,targetDist:distance,title,
    mainSet:String(input.mainSet||'').trim().slice(0,2000),
    warmup:String(input.warmup||'').trim().slice(0,1000),
    cooldown:String(input.cooldown||'').trim().slice(0,1000),
    notes:String(input.notes||'').trim().slice(0,2000)};
}

export function summarizeDraftPlan(draft) {
  if (!Array.isArray(draft) || !draft.length) {
    return {valid:false,totalDistanceKm:0,totalWeeks:0,weeks:[],errors:['ยังไม่มีเซสชันในตาราง']};
  }
  const errors=[];
  const validRows=[];
  draft.forEach((row,idx)=>{
    try {
      validRows.push(manualSession(row));
    } catch(err) {
      errors.push(`เซสชัน ${idx+1} (${row.date||'ไม่มีวันที่'}): ${err.message}`);
    }
  });
  if (!validRows.length) {
    return {valid:false,totalDistanceKm:0,totalWeeks:0,weeks:[],errors};
  }
  validRows.sort((a,b)=>a.date.localeCompare(b.date));
  const startDate=validRows[0].date;
  const endDate=validRows.at(-1).date;
  const totalWeeks=Math.floor((new Date(`${endDate}T12:00:00`)-new Date(`${startDate}T12:00:00`))/(7*86400000))+1;
  const weeks=Array.from({length:totalWeeks},(_,idx)=>({
    week:idx+1,
    startDate:localDate(new Date(new Date(`${startDate}T12:00:00`).getTime()+idx*7*86400000)),
    targetVolumeKm:0,
    runningDays:0,
    restDays:0,
    sessions:[]
  }));
  let totalDistanceKm=0;
  for (const row of validRows) {
    const w=Math.floor((new Date(`${row.date}T12:00:00`)-new Date(`${startDate}T12:00:00`))/(7*86400000));
    if (w>=0 && w<totalWeeks) {
      weeks[w].targetVolumeKm=+(weeks[w].targetVolumeKm+row.targetDist).toFixed(2);
      if (row.type==='Rest') weeks[w].restDays++; else weeks[w].runningDays++;
      weeks[w].sessions.push(row);
      totalDistanceKm=+(totalDistanceKm+row.targetDist).toFixed(2);
    }
  }
  return {
    valid:errors.length===0,
    startDate,
    endDate,
    totalWeeks,
    totalDistanceKm,
    weeks,
    errors
  };
}

export function createManualPlan(draft,{goal='ตารางฝึกที่สร้างเอง',createdAt=Date.now(),id=null}={}) {
  if (!Array.isArray(draft) || !draft.length) throw new Error('เพิ่มเซสชันก่อนบันทึกแผน');
  const rows=draft.map(manualSession).sort((a,b)=>a.date.localeCompare(b.date));
  const startDate=rows[0].date,endDate=rows.at(-1).date;
  const totalWeeks=Math.floor((new Date(`${endDate}T12:00:00`)-new Date(`${startDate}T12:00:00`))/(7*86400000))+1;
  const weeklyTargets=Array.from({length:totalWeeks},()=>0);
  const sessions=rows.map((row,index)=>{
    const week=Math.floor((new Date(`${row.date}T12:00:00`)-new Date(`${startDate}T12:00:00`))/(7*86400000))+1;
    weeklyTargets[week-1]=+(weeklyTargets[week-1]+row.targetDist).toFixed(2);
    return {sessionId:`${id||`manual-${createdAt}`}-s${index+1}`,date:row.date,week,
      phase:'Manual',phaseLabel:'Manual schedule',type:row.type,sourceType:row.type,
      intent:'manual',targetDist:row.targetDist,targetPace:'',targetPaceRange:'',targetHR:'',
      priority:['Tempo','Interval','Long','Race'].includes(row.type)?'key':'normal',
      description:row.title,details:{warmup:row.warmup,mainSet:row.mainSet||row.title,
        cooldown:row.cooldown,execution:'Follow the entered session exactly.',
        successCriteria:'Complete the planned session with controlled form.',
        intensity:'Manual schedule',targetDescription:row.title},
      workoutSpec:{intent:'manual',structure:'manual',totalDistanceKm:row.targetDist,
        qualityDistanceKm:['Tempo','Interval','Race'].includes(row.type)?row.targetDist:0,
        sourceProvider:'manual'},notes:row.notes,methodologyVersion:'manual-schedule-2026.07.22'};
  });
  const planId=id||`manual-${createdAt}`;
  const safeGoal=String(goal||'').trim().slice(0,150)||'ตารางฝึกที่สร้างเอง';
  return {planId,revisionId:'r1',engineVersion:2,methodologyVersion:'manual-schedule-2026.07.22',
    status:'active',goal:safeGoal,startDate,endDate,totalWeeks,
    daysPerWeek:Math.max(...weeklyTargets.map((_,index)=>sessions.filter(row=>row.week===index+1&&row.type!=='Rest').length)),
    createdAt,updatedAt:createdAt,
    sourcePlan:{provider:'manual',label:'Manual schedule',importedAt:createdAt,
      adaptation:'Sessions were entered directly by the athlete.'},
    goalProfile:{distance:'Manual',targetTime:'',targetMinutes:null,targetPace:null,benchmark:'',
      unavailableRaw:'',unavailable:[],longRunDay:'',longRunDayName:'',raceGoal:sessions.some(row=>row.type==='Race')},
    athleteProfile:{level:'manual',currentWeeklyKm:Math.max(...weeklyTargets),volumeBasis:'manual_schedule',paceBasis:'manual',confidence:'manual'},
    inputAudit:{source:'manual schedule'},
    phaseSchedule:weeklyTargets.map((targetVolumeKm,index)=>({week:index+1,phase:'Manual',phaseLabel:'Manual schedule',
      startDate:localDate(new Date(new Date(`${startDate}T12:00:00`).getTime()+index*7*86400000)),targetVolumeKm})),
    sessions,recoveryCards:[],recoverySummary:{},completedDates:{},adjustments:[],dailyDecisions:{},
    validation:{valid:true,errors:[],warnings:['manual_schedule: sessions are athlete-entered and are not generated by MyDash.'],
      weeklyTargetsKm:weeklyTargets,weeklyActualKm:weeklyTargets},
    compatibility:{legacyMirror:true,previousEngineAvailable:true,manualPlan:true,importedPlan:false}};
}

export function parseCsvLine(line) {
  const values=[];let value='',quoted=false;
  for(let index=0;index<line.length;index++){
    const char=line[index];
    if(char==='"'&&quoted&&line[index+1]==='"'){value+='"';index++;}
    else if(char==='"')quoted=!quoted;
    else if(char===','&&!quoted){values.push(value.trim());value='';}
    else value+=char;
  }
  values.push(value.trim());return values;
}

const NORMALIZE_MAP={
  easy:'Easy','วิ่งสบาย':'Easy','อีซี่':'Easy',
  recovery:'Recovery','ฟื้นฟู':'Recovery',
  tempo:'Tempo','เทมโป':'Tempo',
  interval:'Interval','อินเทอร์วัล':'Interval','คอร์ท':'Interval',
  long:'Long','longrun':'Long','วิ่งยาว':'Long',
  race:'Race','แข่ง':'Race','แข่งขัน':'Race','ทดสอบ':'Race',
  rest:'Rest','พัก':'Rest','พักผ่อน':'Rest',
  other:'Other','อื่นๆ':'Other'
};

export function normalizeSessionType(raw) {
  const clean=String(raw||'').trim().toLowerCase().replace(/[^a-z0-9ก-๙]/g,'');
  return NORMALIZE_MAP[clean] || (SESSION_TYPES.includes(raw)?raw:'Other');
}

export function parsePlanDate(value) {
  const raw=String(value||'').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
  const match=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if(!match)return raw;
  let year=Number(match[3]);if(year>2400)year-=543;else if(year<100)year+=2000;
  return `${year}-${String(match[2]).padStart(2,'0')}-${String(match[1]).padStart(2,'0')}`;
}

export function parsePlanCsv(text) {
  const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
  if(lines.length<2)throw new Error('ไฟล์ CSV ต้องมีแถวหัวตารางและเซสชันอย่างน้อย 1 แถว');
  const headers=parseCsvLine(lines[0]).map(h=>h.toLowerCase().replace(/[^a-z0-9ก-๙]/g,''));
  const keyMap={
    date:['date','sessiondate','วันที่','วัน'],
    type:['type','workouttype','sessiontype','ประเภท'],
    dist:['targetdist','dist','distancekm','distance','totaldistancekm','km','ระยะทาง','ระยะ'],
    title:['title','name','workout','session','description','ชื่อ','ชื่อเซสชัน','หัวข้อ'],
    mainSet:['mainset','main','workoutdetails','ชุดหลัก','รายละเอียด'],
    warmup:['warmup','warm_up','วอร์ม','วอร์มอัป'],
    cooldown:['cooldown','cool_down','คูลดาวน์'],
    notes:['notes','note','remarks','หมายเหตุ']
  };
  const resolve=(cells,aliasList)=>{
    for(const alias of aliasList){
      const idx=headers.indexOf(alias);
      if(idx!==-1&&cells[idx]!==undefined&&cells[idx]!=='')return cells[idx];
    }
    return '';
  };

  return lines.slice(1).map((line,lineIdx)=>{
    const cells=parseCsvLine(line);
    const rawDate=resolve(cells,keyMap.date);
    const rawType=resolve(cells,keyMap.type);
    const rawDist=resolve(cells,keyMap.dist);
    const rawTitle=resolve(cells,keyMap.title);
    const rawMain=resolve(cells,keyMap.mainSet);
    const rawWarmup=resolve(cells,keyMap.warmup);
    const rawCooldown=resolve(cells,keyMap.cooldown);
    const rawNotes=resolve(cells,keyMap.notes);

    const type=normalizeSessionType(rawType||'Easy');
    const distNum=type==='Rest'?0:Number(rawDist||5);
    return manualSession({
      date:parsePlanDate(rawDate),
      type,
      targetDist:distNum,
      title:rawTitle||(type==='Rest'?'พัก':`${type} ${distNum} km`),
      mainSet:rawMain,
      warmup:rawWarmup,
      cooldown:rawCooldown,
      notes:rawNotes
    });
  });
}

export function parsePlanJson(text) {
  const parsed=JSON.parse(String(text||'').replace(/^\uFEFF/,''));
  const rawRows=Array.isArray(parsed)?parsed:(Array.isArray(parsed.sessions)?parsed.sessions:(Array.isArray(parsed.workouts)?parsed.workouts:null));
  if(!rawRows||!rawRows.length)throw new Error('ไฟล์ JSON ต้องมี array ของ sessions หรือ workouts');
  const goal=parsed.goal||parsed.name||parsed.title||'ตารางฝึกนำเข้าจากไฟล์ JSON';
  const sessions=rawRows.map(row=>manualSession({
    date:parsePlanDate(row.date||row.sessionDate),
    type:normalizeSessionType(row.type||row.sourceType||'Easy'),
    targetDist:row.type==='Rest'?0:Number(row.targetDist??row.distanceKm??row.dist??5),
    title:row.title||row.name||row.description||'',
    mainSet:row.mainSet||row.details?.mainSet||'',
    warmup:row.warmup||row.details?.warmup||'',
    cooldown:row.cooldown||row.details?.cooldown||'',
    notes:row.notes||row.note||''
  }));
  return {goal,sessions};
}

export function parsePlanFileContent(text,fileName='schedule.csv') {
  const isCsv=fileName.toLowerCase().endsWith('.csv')||(!text.trim().startsWith('{')&&!text.trim().startsWith('['));
  if(isCsv){
    const sessions=parsePlanCsv(text);
    const goal=fileName.replace(/\.[^/.]+$/,'').trim()||'ตารางฝึกนำเข้าจากไฟล์ CSV';
    return {goal,sessions,summary:summarizeDraftPlan(sessions)};
  } else {
    const {goal,sessions}=parsePlanJson(text);
    return {goal,sessions,summary:summarizeDraftPlan(sessions)};
  }
}

