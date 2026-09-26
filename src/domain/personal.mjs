export function validDate(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const d=new Date(value+'T12:00:00Z');
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0,10)===value;
}
export function raceFields(values) {
  const name=String(values.name || '').trim(), date=values.date, dist=Number(values.dist);
  if(!name || name.length>200 || !validDate(date) || !Number.isFinite(dist) || dist<=0 || dist>1000) throw new Error('ตรวจชื่อ วันที่ และระยะทางการแข่งขัน');
  const goal=String(values.goal || '').trim();
  if(goal && !/^\d{1,3}:[0-5]\d(?::[0-5]\d)?$/.test(goal)) throw new Error('เป้าเวลาใช้ m:ss หรือ h:mm:ss');
  return {name,date,dist,goal};
}
export const profileDefinitions=[['dob','วันเกิด','date'],['maxHR','Max HR','number'],['lthr','Lactate threshold HR','number'],['thresholdPace','Threshold pace (m:ss)','text'],['thresholdPower','Threshold power (W)','number'],['easyHRMin','Easy HR ต่ำสุด','number'],['easyHRMax','Easy HR สูงสุด','number'],...Array.from({length:5},(_,i)=>['z'+(i+1)+'Max','Zone '+(i+1)+' สูงสุด','number']),['tempoFast','Tempo เร็วสุด (m:ss)','text'],['tempoSlow','Tempo ช้าสุด (m:ss)','text']];
export function profilePatch(values,previous={}) {
  previous ||= {};
  const next={},patch={};
  for(const [key,,type] of profileDefinitions){
    const raw=String(values[key] ?? '').trim();let value=raw || null;
    if(raw && type==='date' && !validDate(raw))throw new Error('วันเกิดไม่ถูกต้อง');
    if(raw && type==='number'){value=Number(raw);if(!Number.isFinite(value)||value<=0||value>(key==='thresholdPower'?3000:250))throw new Error('ค่าตัวเลขโปรไฟล์ไม่ถูกต้อง');}
    if(raw && type==='text' && (!/^\d{1,2}:[0-5]\d$/.test(raw)||/^0+:00$/.test(raw)))throw new Error('เพซต้องเป็น m:ss และมากกว่าศูนย์');
    next[key]=value;if((previous[key]??null)!==value)patch[key]=value;
  }
  const zones=profileDefinitions.filter(([k])=>/^z\d/.test(k)).map(([k])=>next[k]).filter(v=>v!=null);
  if(zones.some((v,i)=>i && v<=zones[i-1]))throw new Error('ขอบเขตโซนต้องเรียงจากต่ำไปสูง');
  if(next.easyHRMin && next.easyHRMax && next.easyHRMin>next.easyHRMax)throw new Error('Easy HR ต่ำสุดต้องไม่เกินสูงสุด');
  return patch;
}
