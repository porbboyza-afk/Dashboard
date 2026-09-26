const collections={workouts:'workouts',wellness:'wellness',coachPlans:'coach_plans',stravaActivities:'strava_activities'};
const objects={activityDetails:'activity_details',stravaDetails:'strava_activity_details',wellnessGarmin:'wellness_sources/garmin',postRunReviews:'post_run_reviews',trainingAnalyses:'training_analyses',races:'races'};
const validKey=key=>typeof key==='string' && key.length>0 && key.length<=768 && !/[.#$\[\]/\x00-\x1f\x7f]/.test(key) && !['__proto__','constructor','prototype'].includes(key);
function validate(value,depth=0){
  if(depth>40)throw new Error('ข้อมูลซ้อนกันลึกเกินไป');
  if(value===null || typeof value==='string' || typeof value==='boolean')return;
  if(typeof value==='number' && Number.isFinite(value))return;
  if(!value || typeof value!=='object')throw new Error('ข้อมูลในไฟล์ไม่ถูกต้อง');
  for(const [key,item] of Object.entries(value)){if(!validKey(key))throw new Error('พบชื่อฟิลด์ที่ไม่ปลอดภัย');validate(item,depth+1);}
}
export function equalData(a,b){
  if(a===b)return true;
  if(!a || !b || typeof a!=='object' || typeof b!=='object')return false;
  const keys=Object.keys(a);return keys.length===Object.keys(b).length && keys.every(key=>Object.hasOwn(b,key)&&equalData(a[key],b[key]));
}
export function restoreEntries(payload){
  if(payload?.format!=='MyDash Performance backup' || payload.version!==2)throw new Error('กู้คืนได้เฉพาะไฟล์สำรอง MyDash Performance รุ่น 2; ไฟล์เก่าเปิดตรวจได้เท่านั้น');
  validate(payload);
  const entries=[];const seen=new Set();
  function add(path,key,value){
    if(!validKey(key)||!value||typeof value!=='object')throw new Error('รายการไม่มีรหัสหรือข้อมูลที่ถูกต้อง');
    const target=path+'/'+key;if(seen.has(target))throw new Error('มีรหัสรายการซ้ำในไฟล์');seen.add(target);
    entries.push({path,key,value:structuredClone(value)});
    if(entries.length>20000)throw new Error('ไฟล์มีรายการมากเกินไป');
  }
  for(const [field,path] of Object.entries(collections)){
    const rows=payload[field]??[];if(!Array.isArray(rows))throw new Error('รูปแบบรายการไม่ถูกต้อง');
    for(const row of rows){const {_key,...value}=row;add(path,_key,value);}
  }
  for(const [field,path] of Object.entries(objects)){
    const rows=payload[field]??{};if(typeof rows!=='object'||rows===null)throw new Error('รูปแบบรายละเอียดไม่ถูกต้อง');
    for(const [key,value] of Object.entries(rows))add(path,key,value);
  }
  return entries;
}
// Input is a nested user root. Never replace existing records, settings or active pointers.
export function applyRestore(root,entries){
  const next=structuredClone(root||{});const report={added:0,identical:0,conflicts:0,items:[]};
  for(const entry of entries){
    let parent=next;let blocked=false;
    for(const part of entry.path.split('/')){
      if(parent[part]==null)parent[part]={};
      if(Array.isArray(parent[part]))parent[part]=Object.fromEntries(Object.entries(parent[part]));
      if(typeof parent[part]!=='object'){blocked=true;break;}parent=parent[part];
    }
    let state;
    if(blocked)state='conflicts';
    else if(parent[entry.key]!=null)state=equalData(parent[entry.key],entry.value)?'identical':'conflicts';
    else{state='added';parent[entry.key]=structuredClone(entry.value);if(entry.path==='coach_plans')parent[entry.key].status='archived';}
    report[state]++;report.items.push({path:entry.path,key:entry.key,state});
  }
  return {next,report};
}
