(function(root){
  'use strict';

  const WEEKDAY_OFFSETS={mon:0,monday:0,'จันทร์':0,tue:1,tues:1,tuesday:1,'อังคาร':1,wed:2,wednesday:2,'พุธ':2,thu:3,thur:3,thurs:3,thursday:3,'พฤหัส':3,fri:4,friday:4,'ศุกร์':4,sat:5,saturday:5,'เสาร์':5,sun:6,sunday:6,'อาทิตย์':6};

  function parseCsvLine(line){
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
  function key(value){return String(value||'').toLowerCase().replace(/[^a-z0-9ก-๙]/g,'');}
  function valueFrom(row,names){
    const found=names.map(name=>row[key(name)]).find(value=>value!==undefined&&value!=='');
    return found===undefined?'':found;
  }
  function parseDate(value){
    const raw=String(value||'').trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
    const match=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if(!match)return raw;
    let year=Number(match[3]);if(year>2400)year-=543;else if(year<100)year+=2000;
    return `${year}-${String(match[2]).padStart(2,'0')}-${String(match[1]).padStart(2,'0')}`;
  }
  function isIsoDate(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;
    const parsed=new Date(`${value}T12:00:00`);
    return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
  }
  function addDays(date,days){const value=new Date(`${date}T12:00:00`);value.setDate(value.getDate()+days);return value.toISOString().slice(0,10);}
  function weekdayOffset(value){
    const normalized=key(value);
    const match=Object.entries(WEEKDAY_OFFSETS).find(([name])=>normalized===key(name)||normalized.includes(key(name)));
    if(!match)throw new Error(`Unrecognized schedule day: ${value}`);
    return match[1];
  }
  function mapSession(input,rowNumber=0,{allowMissingDate=false}={}){
    const details=input?.details&&typeof input.details==='object'?input.details:{};
    const sourceWeek=valueFrom(input,['week','weekNumber','สัปดาห์'])||input.week||input.sourceWeek||'';
    const sourceDay=valueFrom(input,['day','weekday','dayName','วัน'])||input.day||input.sourceDay||input.dayName||'';
    const sourceType=input.sourceType||input.type||valueFrom(input,['type','workoutType','sessionType','ประเภท'])||'Other';
    const sourceDistance=valueFrom(input,['targetDist','distanceKm','distance','totalDistanceKm','km','ระยะ'])||input.targetDist||input.distanceKm||input.distance||input.totalDistanceKm;
    const session={
      date:parseDate(valueFrom(input,['date','sessionDate','วันที่'])||input.date),sourceWeek,sourceDay,
      type:sourceType,sourceType,targetDist:sourceDistance,
      title:valueFrom(input,['title','name','workout','session','description','ชื่อ'])||input.title||input.name||input.description||details.targetDescription||`${sourceType}${sourceDistance?` · ${sourceDistance} km`:''}`,
      mainSet:valueFrom(input,['mainSet','main','workoutDetails','ชุดหลัก'])||input.mainSet||details.mainSet||'',
      warmup:valueFrom(input,['warmup','warmUp','วอร์ม'])||input.warmup||details.warmup||'',
      cooldown:valueFrom(input,['cooldown','coolDown','คูลดาวน์'])||input.cooldown||details.cooldown||'',
      notes:valueFrom(input,['notes','note','remarks','หมายเหตุ'])||input.notes||input.note||'',
      execution:input.execution||details.execution||'',successCriteria:input.successCriteria||details.successCriteria||'',intensity:input.intensity||details.intensity||'',
      targetPace:valueFrom(input,['targetPace','targetPaceRange','pace','pacePerKm'])||input.targetPace||input.targetPaceRange||'',
      targetHR:valueFrom(input,['targetHR','hr','heartRate','hrZone','hrZoneBpm'])||input.targetHR||'',priority:input.priority||''
    };
    if(!session.date&&!allowMissingDate)throw new Error(`Session row ${rowNumber||'?'} is missing a date.`);
    return session;
  }
  function parseCsv(text){
    const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
    if(lines.length<2)throw new Error('CSV needs a header row and at least one session row.');
    const headers=parseCsvLine(lines[0]).map(key);
    return lines.slice(1).map((line,index)=>{
      const cells=parseCsvLine(line),row={};headers.forEach((header,column)=>{row[header]=cells[column]??'';});
      return mapSession(row,index+2,{allowMissingDate:true});
    });
  }
  function parsePastedRows(text){
    const rows=String(text||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    if(!rows.length)throw new Error('Paste at least one schedule row.');
    return rows.map((line,index)=>{
      const parts=line.split('|').map(value=>value.trim());
      if(parts.length<3)throw new Error(`Line ${index+1}: use Date | Type | km | Title | Main set | Notes`);
      return {date:parseDate(parts[0]),type:parts[1],targetDist:parts[2],title:parts[3]||'',mainSet:parts[4]||'',notes:parts.slice(5).join(' | ')};
    });
  }
  function resolveWeekDaySessions(rows,weekOneMonday){
    const anchor=parseDate(weekOneMonday);
    if(!isIsoDate(anchor))throw new Error('Choose the Monday that starts Week 1 before importing this file.');
    if(new Date(`${anchor}T12:00:00`).getDay()!==1)throw new Error(`${anchor} is not a Monday. Choose the Monday that starts Week 1.`);
    return rows.map((session,index)=>{
      if(session.date)return session;
      const week=Number(session.sourceWeek);
      if(!Number.isInteger(week)||week<1)throw new Error(`Session row ${index+1}: Week must be a positive whole number.`);
      return {...session,date:addDays(anchor,(week-1)*7+weekdayOffset(session.sourceDay))};
    });
  }
  function createImportedPlan(payload,{fileName='Imported schedule',format='json',weekOneMonday='',createdAt=Date.now()}={}){
    const source=Array.isArray(payload)?{sessions:payload}:payload;
    if(!source||typeof source!=='object')throw new Error('Import file must contain a JSON object or session array.');
    const rows=Array.isArray(source.sessions)?source.sessions:(Array.isArray(source.workouts)?source.workouts:null);
    if(!rows?.length)throw new Error('Import file has no sessions array.');
    if(!root.MyDashManualPlan?.createPlan)throw new Error('Manual plan builder is not loaded. Refresh and try again.');
    const parsed=rows.map((row,index)=>mapSession(row,index+1,{allowMissingDate:true}));
    const needsWeekDayMapping=parsed.some(session=>!session.date);
    if(needsWeekDayMapping&&parsed.some(session=>!session.sourceWeek||!session.sourceDay))throw new Error('This file has no date column. Every session needs Week and Day, then choose the Monday that starts Week 1.');
    const sessions=needsWeekDayMapping?resolveWeekDaySessions(parsed,weekOneMonday):parsed;
    if(sessions.some(session=>!isIsoDate(session.date)))throw new Error('Every imported session needs a valid date.');
    return root.MyDashManualPlan.createPlan(sessions,{goal:String(source.goal||source.name||source.title||fileName).trim()||fileName,createdAt,provider:'imported',sourcePlan:{provider:'imported',label:fileName,fileName,format,originalProvider:source.sourcePlan?.provider||source.provider||'',weekOneMonday:needsWeekDayMapping?parseDate(weekOneMonday):'',adaptation:'Imported sessions are preserved as supplied. MyDash does not regenerate or reinterpret them.'},inputAudit:{source:'imported file',fileName,format,originalPlanId:source.planId||source.id||'',dateMapping:needsWeekDayMapping?'week_day_from_week_one_monday':'dates_from_source_file'}});
  }
  async function parseFile(file,options={}){
    if(!file)throw new Error('Choose a .json or .csv schedule file first.');
    const text=await file.text();const format=String(file.name||'').toLowerCase().endsWith('.csv')?'csv':'json';
    const payload=format==='csv'?{sessions:parseCsv(text),name:file.name}:JSON.parse(text.replace(/^\uFEFF/,''));
    return createImportedPlan(payload,{fileName:file.name||'Imported schedule',format,...options});
  }

  root.MyDashPlanFileImport={parseCsv,parsePastedRows,mapSession,resolveWeekDaySessions,createImportedPlan,parseFile};
})(window);
