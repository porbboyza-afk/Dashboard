import {finite} from './model.mjs';

function number(value,label,min,max,required=false) {
  const parsed=finite(value);
  if (parsed==null) {
    if (required) throw new Error(`กรุณาระบุ${label}`);
    return 0;
  }
  if (parsed<min || parsed>max) throw new Error(`${label}ต้องอยู่ระหว่าง ${min}–${max}`);
  return parsed;
}

function pace(value,required=false) {
  const text=String(value || '').trim();
  if (!text) {
    if (required) throw new Error('กรุณาระบุเพซช่วงเร็ว');
    return {text:'',minutes:null};
  }
  const match=/^(\d{1,2}):([0-5]\d)$/.exec(text);
  const minutes=match ? Number(match[1])+Number(match[2])/60 : /^\d{1,2}(?:\.\d+)?$/.test(text) ? Number(text) : null;
  if (minutes==null) throw new Error('เพซต้องเป็น นาที:วินาที หรือทศนาที เช่น 4:30 หรือ 4.5');
  if (minutes<.25 || minutes>30) throw new Error('เพซต้องอยู่ระหว่าง 0:15–30:00 /km');
  return {text,minutes};
}

export function intervalSummary(values) {
  const reps=number(values.ivReps,'จำนวนรอบ',1,30,true);
  if (!Number.isInteger(reps)) throw new Error('จำนวนรอบต้องเป็นจำนวนเต็ม');
  const repDist=number(values.ivRepDist,'ระยะต่อรอบ',.01,100,true);
  const repPace=pace(values.ivRepPace,true);
  const restTime=number(values.ivRestTime,'เวลาพัก',0,120);
  const repHR=number(values.ivRepHr,'HR ช่วงเร็ว',30,240);
  const restHR=number(values.ivRestHr,'HR ช่วงพัก',30,240);

  function section(prefix,label) {
    const dist=number(values[`${prefix}Dist`],`ระยะ${label}`,0,100);
    const time=number(values[`${prefix}Time`],`เวลา${label}`,0,180);
    const enteredPace=pace(values[`${prefix}Pace`]);
    if (dist>0 && time===0 && !enteredPace.minutes) throw new Error(`ระบุเวลาหรือเพซ${label}`);
    if (dist===0 && (time>0 || enteredPace.minutes)) throw new Error(`ระบุระยะ${label}ด้วย`);
    const calculatedTime=time || (dist && enteredPace.minutes ? dist*enteredPace.minutes : 0);
    const derivedSeconds=dist && calculatedTime ? Math.round(calculatedTime/dist*60) : null;
    return {dist,time:+calculatedTime.toFixed(3),pace:enteredPace.text || (derivedSeconds ? `${Math.floor(derivedSeconds/60)}:${String(derivedSeconds%60).padStart(2,'0')}` : '')};
  }
  const warmup=section('ivWu','วอร์มอัป');
  const cooldown=section('ivCd','คูลดาวน์');
  const dist=+(warmup.dist+reps*repDist+cooldown.dist).toFixed(3);
  const time=+(warmup.time+reps*(repPace.minutes*repDist+restTime)+cooldown.time).toFixed(3);
  if (dist<=0 || dist>1000 || time<=0 || time>10080) throw new Error('ผลรวมระยะหรือเวลาของ Interval ไม่ถูกต้อง');
  return {dist,time,interval:{reps,repDist,repPace:repPace.text,
    repHR:repHR || 0,restTime,restHR:restHR || 0,warmup,cooldown,totalTime:+time.toFixed(1)}};
}
