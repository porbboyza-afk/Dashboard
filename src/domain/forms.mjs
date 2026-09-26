import {finite, localDate} from './model.mjs';
import {intervalSummary} from './interval.mjs';

function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('กรุณาระบุวันที่');
  const parsed=new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.valueOf()) || localDate(parsed)!==value) throw new Error('วันที่ไม่ถูกต้อง');
  return value;
}

function numeric(value, label, min, max, required=false) {
  if (value==='' || value==null) {
    if (required) throw new Error(`กรุณาระบุ${label}`);
    return null;
  }
  const result=finite(value);
  if (result==null || result<min || result>max) throw new Error(`${label}ต้องอยู่ระหว่าง ${min}–${max}`);
  return result;
}

export function manualSplits(values, distanceKm = null) {
  if (!values) return undefined;
  let rawRows = [];
  if (Array.isArray(values)) {
    rawRows = values;
  } else if (Array.isArray(values.splits)) {
    rawRows = values.splits;
  } else if (typeof values.getAll === 'function') {
    const kms = values.getAll('splitKm');
    const paces = values.getAll('splitPace');
    const hrs = values.getAll('splitHr');
    if (!kms.length && !paces.length && !hrs.length) return undefined;
    const len = Math.max(kms.length, paces.length, hrs.length);
    for (let i = 0; i < len; i++) rawRows.push({km: kms[i], pace: paces[i], hr: hrs[i]});
  } else if ('splitKm' in values || 'splitPace' in values || 'splitHr' in values) {
    const toArr = v => Array.isArray(v) ? v : (v === undefined || v === null || v === '' ? [] : [v]);
    const kms = toArr(values.splitKm);
    const paces = toArr(values.splitPace);
    const hrs = toArr(values.splitHr);
    if (!kms.length && !paces.length && !hrs.length) return undefined;
    const len = Math.max(kms.length, paces.length, hrs.length);
    for (let i = 0; i < len; i++) rawRows.push({km: kms[i], pace: paces[i], hr: hrs[i]});
  } else {
    return undefined;
  }

  const rows = rawRows.filter(r => !(
    (r.km === '' || r.km == null) &&
    (r.pace === '' || r.pace == null) &&
    (r.hr === '' || r.hr == null)
  ));
  if (!rows.length) return undefined;

  const maxKm = distanceKm != null && finite(distanceKm) > 0 ? Math.ceil(Number(distanceKm)) : null;
  const result = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const kmNum = Number(r.km);
    if (!Number.isInteger(kmNum) || kmNum <= 0) {
      throw new Error('ลำดับกิโลเมตรต้องเป็นจำนวนเต็มบวก');
    }
    if (kmNum !== i + 1) {
      if (kmNum <= i) throw new Error('ลำดับกิโลเมตรซ้ำหรือเรียงลำดับไม่ถูกต้อง');
      throw new Error('ลำดับกิโลเมตรต้องเรียงลำดับต่อเนื่องโดยไม่มีช่องว่าง');
    }
    if (maxKm != null && kmNum > maxKm) {
      throw new Error(`รอบกิโลเมตรที่ ${kmNum} เกินระยะทางรวม (${distanceKm} km)`);
    }

    let hrVal = null;
    if (r.hr !== '' && r.hr != null) {
      const hrNum = finite(r.hr);
      if (hrNum == null || hrNum < 30 || hrNum > 240) {
        throw new Error('HR ต้องอยู่ระหว่าง 30–240 bpm');
      }
      hrVal = Number(r.hr);
      if (!r.pace || String(r.pace).trim() === '') {
        throw new Error('ต้องระบุเพซเมื่อมีการระบุอัตราการเต้นหัวใจ (HR)');
      }
    }

    if (!r.pace || String(r.pace).trim() === '') {
      throw new Error('กรุณาระบุเพซในแต่ละรอบที่บันทึก');
    }
    const match = /^(\d+):([0-5]\d)$/.exec(String(r.pace).trim());
    if (!match) {
      throw new Error('เพซต้องอยู่ในรูปแบบ นาที:วินาที เช่น 5:30 (วินาที 00–59)');
    }
    const mins = Number(match[1]);
    const secs = Number(match[2]);
    if (mins === 0 && secs === 0) {
      throw new Error('เพซต้องมากกว่า 0');
    }
    const formattedPace = `${mins}:${match[2]}`;

    result.push({km: kmNum, pace: formattedPace, hr: hrVal});
  }

  return result;
}

export function workoutFields(values,{existingType=null,existingInterval=null,intervalEdited=false}={}) {
  const name=String(values.name || '').trim();
  if (!name || name.length>120) throw new Error('ระบุชื่อกิจกรรมไม่เกิน 120 ตัวอักษร');
  const allowed=['run','walk','bike','swim','interval','strength'];
  const type=String(values.type || '');
  if (!allowed.includes(type) && type!==existingType) throw new Error('ประเภทกิจกรรมนี้ยังไม่รองรับการบันทึก');
  const calculated=type==='interval' && (!existingInterval || intervalEdited) ? intervalSummary(values) : null;
  const dist=calculated?.dist ?? numeric(values.dist,'ระยะทาง',.01,1000,type!=='strength');
  const time=calculated?.time ?? numeric(values.time,'เวลา',.01,10080,true);
  const splits=manualSplits(values,dist);
  return {name,type,date:date(values.date),dist,time,avgPace:dist ? time/dist : null,
    ...(calculated ? {interval:calculated.interval} : {}),
    ...(splits !== undefined ? {splits} : {}),
    hr:calculated ? (calculated.interval.repHR || null) : numeric(values.hr,'HR',30,240),
    cad:numeric(values.cad,'cadence',1,300),
    rpe:numeric(values.rpe,'RPE',1,10),note:String(values.note || '').slice(0,2000),
    shoe:String(values.shoe || '').slice(0,150),
    stride:numeric(values.stride,'ความยาวก้าว',.01,5),
    temperature:numeric(values.temperature,'อุณหภูมิ',-20,60),
    pain:numeric(values.pain,'ระดับอาการเจ็บ',0,10),
    purpose:String(values.purpose || '').slice(0,80),
    surface:String(values.surface || '').slice(0,80),
    weather:String(values.weather || '').slice(0,60),
    painLocation:String(values.painLocation || '').slice(0,80),
    feeling:String(values.feeling || '').slice(0,160)};
}

export function workoutPatch(values,previous,{intervalEdited=false}={}) {
  const validated=workoutFields(values,{existingType:previous.type,existingInterval:previous.interval,intervalEdited});
  const patch={};
  for (const [field,value] of Object.entries(validated)) {
    if (field==='avgPace') continue;
    if (field==='interval') {
      if (JSON.stringify(value)!==JSON.stringify(previous.interval)) patch.interval=value;
      continue;
    }
    if (field==='splits') {
      if (JSON.stringify(value)!==JSON.stringify(previous.splits)) patch.splits=value;
      continue;
    }
    let before=previous[field];
    if (['hr','cad','rpe','stride'].includes(field)) before=finite(before)>0?Number(before):null;
    if (['temperature','pain'].includes(field)) before=finite(before);
    if (['dist','time'].includes(field)) before=finite(before);
    if (['note','shoe','purpose','surface','weather','painLocation','feeling'].includes(field)) before=String(before || '');
    if (field==='name') before=previous.name || previous.purpose || previous.type || 'Activity';
    if (field==='purpose' && !previous.purpose) before='';
    if (value!==before) patch[field]=value;
  }
  if (previous.type==='interval' && validated.type!=='interval' && previous.interval) patch.interval=null;
  if (('splits' in values) && (values.splits === null || (Array.isArray(values.splits) && values.splits.length === 0)) && previous.splits) {
    patch.splits = null;
  }
  if ('dist' in patch || 'time' in patch) patch.avgPace=validated.avgPace;
  if (!Object.keys(patch).length) throw new Error('ยังไม่มีข้อมูลที่เปลี่ยนแปลง');
  return patch;
}

export const wellnessNumericFields = {
  sleepHours:['เวลานอน',0,24],restingHR:['Resting HR',20,220],hrv:['HRV',0,400],
  spo2:['SpO₂',0,100],fatigue:['ความเหนื่อย',1,10],stress:['ความเครียด',1,10],
  sleepQuality:['คุณภาพการนอน',1,10],weight:['น้ำหนัก',1,500],
  bodyFat:['ไขมันในร่างกาย',0,100],soreness:['อาการปวดเมื่อย',0,10],mood:['อารมณ์',1,10],
};

// Only changed fields are patched. Blank is an explicit clear only after editing.
export function wellnessPatch(values, previous={}) {
  const patch={date:date(values.date)};
  let changed=false;
  for (const [key,[label,min,max]] of Object.entries(wellnessNumericFields)) {
    if (!(key in values)) continue;
    const before=previous[key]==null?'':String(previous[key]);
    if (String(values[key])===before) continue;
    patch[key]=numeric(values[key],label,min,max);
    changed=true;
  }
  if ('note' in values && String(values.note)!==String(previous.note || '')) {
    patch.note=String(values.note).slice(0,2000);changed=true;
  }
  for (const key of ['bloodPressure','painLocation']) {
    if (!(key in values)) continue;
    const value=String(values[key] || '').trim();
    if (value===String(previous[key] || '')) continue;
    if (value.length>150) throw new Error('ข้อความยาวเกิน 150 ตัวอักษร');
    patch[key]=value;changed=true;
  }
  if ('healthStatus' in values) {
    const value=String(values.healthStatus || '');
    if (value && !['normal','sick','injured'].includes(value)) throw new Error('สถานะสุขภาพไม่ถูกต้อง');
    if (value && value!==String(previous.healthStatus || '')) {patch.healthStatus=value;changed=true;}
  }
  if (!changed) throw new Error('ยังไม่มีข้อมูลที่เปลี่ยนแปลง');
  return patch;
}
