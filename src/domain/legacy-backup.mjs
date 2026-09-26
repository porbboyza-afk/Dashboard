import {equalData,restoreEntries} from './restore.mjs';
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
async function digest(row){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(row))));return 'legacy-'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
export async function normalizeBackup(payload,current={}){
  if(payload?.version===2){restoreEntries(payload);return payload;}
  if(payload?.version!=='MyDash Health Intelligence V4')throw new Error('ไม่รู้จักรุ่นไฟล์นี้ เปิดตรวจได้แต่ไม่กู้คืนโดยเดารูปแบบ');
  const next={format:'MyDash Performance backup',version:2,workouts:[],wellness:[],coachPlans:[],stravaActivities:[],stravaDetails:payload.stravaDetails||{}};
  for(const [field,path] of [['workouts','workouts'],['wellness','wellness'],['stravaActivities','strava_activities']]){
    if(payload[field]!=null&&!Array.isArray(payload[field]))throw new Error('รูปแบบรายการในไฟล์เก่าไม่ถูกต้อง');
    const seen=new Set();
    for(const row of payload[field]||[]){
      if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('รายการในไฟล์เก่าไม่ถูกต้อง');
      const {_key:oldKey,...value}=row;
      const existing=Object.entries(current[path]||{}).filter(([,item])=>equalData(item,value));
      const sameIdentity=field==='workouts'?Object.entries(current[path]||{}).filter(([,item])=>['date','createdAt','type','dist','time','source'].every(key=>(item[key]??'')===(value[key]??''))):[];
      if(existing.length>1||(!existing.length&&sameIdentity.length>1))throw new Error('พบกิจกรรมเก่าที่จับคู่ได้หลายรายการ กรุณาตรวจรหัสก่อนกู้คืน');
      let key=existing[0]?.[0]||sameIdentity[0]?.[0]||oldKey;
      if(!key&&field==='wellness'){if(!/^\d{4}-\d{2}-\d{2}$/.test(value.date||''))throw new Error('ข้อมูลสุขภาพเก่าไม่มีวันที่ที่ใช้เป็นรหัสได้');key=value.date;}
      if(!key&&field==='stravaActivities'&&value.id!=null)key=String(value.id);
      key ||= await digest(value);
      if(seen.has(key))throw new Error('ไฟล์เก่ามีรายการรหัสซ้ำ กรุณาตรวจไฟล์ก่อน');seen.add(key);
      next[field].push({...value,_key:key});
    }
  }
  if(payload.coachPlan){const plan=payload.coachPlan;next.coachPlans.push({...plan,_key:String(plan.planId||await digest(plan))});}
  restoreEntries(next);return next;
}
