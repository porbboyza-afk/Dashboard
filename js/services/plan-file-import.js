(function(root){
  'use strict';

  function parseCsvLine(line){
    const values=[];let value='',quoted=false;
    for(let index=0;index<line.length;index++){
      const char=line[index];
      if(char==='"'&&quoted&&line[index+1]==='"'){value+='"';index++;}
      else if(char==='"')quoted=!quoted;
      else if(char===','&&!quoted){values.push(value.trim());value='';}
      else value+=char;
    }
    values.push(value.trim());
    return values;
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
  function parseCsv(text){
    const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
    if(lines.length<2)throw new Error('CSV needs a header row and at least one session row.');
    const headers=parseCsvLine(lines[0]).map(key);
    return lines.slice(1).map((line,index)=>{
      const cells=parseCsvLine(line),row={};headers.forEach((header,column)=>{row[header]=cells[column]??'';});
      return mapSession(row,index+2);
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
  function mapSession(input,rowNumber=0){
    const details=input?.details&&typeof input.details==='object'?input.details:{};
    const session={
      date:parseDate(valueFrom(input,['date','day','วันที่'])||input.date),
      type:valueFrom(input,['type','workoutType','sessionType','ประเภท'])||input.type||input.sourceType||'Other',
      sourceType:input.sourceType||input.type||valueFrom(input,['type','workoutType','sessionType','ประเภท'])||'',
      targetDist:valueFrom(input,['targetDist','distanceKm','distance','totalDistanceKm','km','ระยะ'])||input.targetDist||input.distanceKm||input.distance||input.totalDistanceKm,
      title:valueFrom(input,['title','name','workout','session','description','ชื่อ'])||input.title||input.name||input.description||details.targetDescription||'',
      mainSet:valueFrom(input,['mainSet','main','workoutDetails','ชุดหลัก'])||input.mainSet||details.mainSet||'',
      warmup:valueFrom(input,['warmup','warmUp','วอร์ม'])||input.warmup||details.warmup||'',
      cooldown:valueFrom(input,['cooldown','coolDown','คูลดาวน์'])||input.cooldown||details.cooldown||'',
      notes:valueFrom(input,['notes','note','remarks','หมายเหตุ'])||input.notes||input.note||'',
      execution:input.execution||details.execution||'',successCriteria:input.successCriteria||details.successCriteria||'',
      intensity:input.intensity||details.intensity||'',targetPace:input.targetPace||input.targetPaceRange||'',targetHR:input.targetHR||'',priority:input.priority||''
    };
    if(!session.date)throw new Error(`Session row ${rowNumber||'?'} is missing a date.`);
    return session;
  }
  function createImportedPlan(payload,{fileName='Imported schedule',format='json',createdAt=Date.now()}={}){
    const source=Array.isArray(payload)?{sessions:payload}:payload;
    if(!source||typeof source!=='object')throw new Error('Import file must contain a JSON object or session array.');
    const rows=Array.isArray(source.sessions)?source.sessions:(Array.isArray(source.workouts)?source.workouts:null);
    if(!rows?.length)throw new Error('Import file has no sessions array.');
    if(!root.MyDashManualPlan?.createPlan)throw new Error('Manual plan builder is not loaded. Refresh and try again.');
    const sessions=rows.map((row,index)=>mapSession(row,index+1));
    return root.MyDashManualPlan.createPlan(sessions,{
      goal:String(source.goal||source.name||source.title||fileName).trim()||fileName,createdAt,provider:'imported',
      sourcePlan:{provider:'imported',label:fileName,fileName,format,originalProvider:source.sourcePlan?.provider||source.provider||'',adaptation:'Imported sessions are preserved as supplied. MyDash does not regenerate or reinterpret them.'},
      inputAudit:{source:'imported file',fileName,format,originalPlanId:source.planId||source.id||''}
    });
  }
  async function parseFile(file){
    if(!file)throw new Error('Choose a .json or .csv schedule file first.');
    const text=await file.text();
    const format=String(file.name||'').toLowerCase().endsWith('.csv')?'csv':'json';
    const payload=format==='csv'?{sessions:parseCsv(text),name:file.name}:JSON.parse(text.replace(/^\uFEFF/,''));
    return createImportedPlan(payload,{fileName:file.name||'Imported schedule',format});
  }

  root.MyDashPlanFileImport={parseCsv,parsePastedRows,mapSession,createImportedPlan,parseFile};
})(window);
