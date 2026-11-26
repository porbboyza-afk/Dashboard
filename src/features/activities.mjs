import {healthValue, reviewFor, trainingActivities} from '../domain/model.mjs';
import {escape as e, number, clock, dateLabel, sourceLabel, effortLabel} from '../ui/format.mjs';
import {icon} from '../ui/icons.mjs';
import {pageHeading, activityRow, metric, splitChart, splitTable, empty} from '../ui/components.mjs';
import {workoutForm} from '../ui/forms.mjs';

export function workouts(model, query='') {
  const rows=trainingActivities(model.activities).filter(row=>`${row.name} ${row.date} ${sourceLabel(row.source)}`.toLowerCase().includes(query.toLowerCase()));
  return `${pageHeading('YOUR TRAINING','กิจกรรม','ประวัติกิจกรรมทั้งหมด')}<div class="tabs"><a class="selected" href="#workouts">ประวัติกิจกรรม</a><a href="#plan">แผนฝึก</a></div>${workoutForm()}<div class="list-toolbar"><label class="search">ค้นหากิจกรรม<input id="activity-search" type="search" value="${e(query)}" placeholder="ชื่อ วันที่ หรือแหล่งข้อมูล"></label><span class="muted">${rows.length} รายการ</span></div><section class="card activity-list">${rows.map(activityRow).join('') || empty('ไม่พบกิจกรรม','ลองเปลี่ยนคำค้นหรืออ่านข้อมูลใหม่')}</section>`;
}

export function activityDetail(model, id) {
  const activity=(model.rawActivities || model.activities).find(row=>row.id===id);
  if (!activity) return `${pageHeading('ACTIVITY','ไม่พบกิจกรรม')}<a class="button" href="#workouts">กลับไปประวัติกิจกรรม</a>`;
  const review=reviewFor(activity,model.data);
  const effort=effortLabel(activity.rpe);
  const intervals=activity.raw.intervalsDetail;
  const trainingLoad=healthValue(intervals?.trainingLoad);
  const effortText=effort ? `RPE ${number(activity.rpe,0)} /10` : 'ยังไม่ได้ระบุ RPE';
  const loadText=trainingLoad!=null ? `<p>Training Load <strong>${number(trainingLoad,1)}</strong></p>` : '';
  return `<a href="#workouts" class="back-link">${icon('back')} กลับไปกิจกรรม</a>${pageHeading(sourceLabel(activity.source),activity.name,dateLabel(activity.date,{year:'numeric',weekday:'long'}))}
    <section class="metrics detail-metrics">${metric('route','Distance',number(activity.distanceKm,2),'km')}${metric('calendar','Duration',clock(activity.durationMin))}${metric('wave','Avg. Pace',clock(activity.distanceKm && activity.durationMin ? activity.durationMin/activity.distanceKm : null),'/km')}${metric('heart','Avg. HR',number(activity.averageHr,0),'bpm')}</section>
    <div class="detail-grid"><section class="card"><div class="section-heading"><h2>รอบวิ่ง / Splits</h2><span class="source">${e(sourceLabel(activity.lapSource || activity.source))}</span></div>${splitChart(activity.laps)}${splitTable(activity)}</section>
    <div class="detail-aside"><section class="card effort-card"><h2>ความหนักของกิจกรรม</h2><p class="effort-score">${e(effortText)}</p>${loadText}${effort ? `<p class="muted">${e(effort.label)} · ${e(effort.description)}</p>` : ''}</section>
    <section class="card"><h2>รายละเอียดเพิ่มเติม</h2><dl class="facts"><div><dt>Cadence</dt><dd>${number(activity.cadence,0)} spm</dd></div><div><dt>ที่มาของ cadence</dt><dd>${activity.cadenceOrigin==='splits'?'เฉลี่ยถ่วงน้ำหนักตามเวลารายช่วง':activity.cadenceOrigin==='summary'?'ข้อมูลสรุปกิจกรรม':'ไม่มีข้อมูล'}</dd></div><div><dt>รองเท้า</dt><dd>${e(activity.shoe || '—')}</dd></div>${intervalsActivityFacts(intervals)}</dl>${activity.note?`<p class="note">${e(activity.note)}</p>`:''}</section>
    <section class="card"><h2>เส้นทาง GPS</h2>${routePreview(activity.route)}</section></div><section class="card review-card"><p class="eyebrow">POST-RUN REVIEW</p><h2>รีวิวการวิ่งครั้งนี้</h2>${review?.aiSummary ? `<p class="muted">รีวิวที่บันทึกไว้${review.updatedAt?' · '+new Date(review.updatedAt).toLocaleDateString('th-TH'):''} • ยังไม่ได้ตรวจความตรงกับข้อมูลและแผน revision ปัจจุบัน</p><details><summary>อ่านรีวิวเดิม</summary><div class="review-text">${e(review.aiSummary)}</div></details>` : '<p class="muted">ยังไม่มีรีวิวที่บันทึกสำหรับกิจกรรมนี้</p>'}<p class="small muted">แสดงรีวิวที่เคยบันทึกไว้เท่านั้น ไม่มีการสร้างรีวิว AI ใหม่</p></section></div>`;
}

function intervalsActivityFacts(detail) {
  if (!detail) return '';
  const facts=[['HR สูงสุด',detail.maxHr,'bpm'],['ความสูงสะสม',detail.elevationGain,'ม.'],['แคลอรี',detail.calories,'kcal']];
  const summary=facts.map(([label,raw,unit])=>{
    const value=healthValue(raw);
    return value==null ? '' : `<div><dt>${label}</dt><dd>${number(value,1)} ${unit}</dd></div>`;
  }).join('');
  const zoneTimes=Array.isArray(detail.hrZoneTimes) ? detail.hrZoneTimes : [];
  const zones=zoneTimes.map((raw,index)=>{
    const seconds=healthValue(raw);
    return seconds==null || seconds<0 ? '' : `<div><dt>โซนหัวใจ ${index+1}</dt><dd>${clock(seconds/60)}</dd></div>`;
  }).join('');
  return summary+zones;
}

export function intervalDetail(activity) {
  const interval=activity?.raw?.interval;
  if (!interval || !(Number(interval.reps)>0)) return '';
  const detected=interval.autoDetected==='intervals.icu';
  const section=(label,row)=>row && (Number(row.dist)>0 || Number(row.time)>0)
    ? `<div><dt>${label}</dt><dd>${number(row.dist,2)} km · ${number(row.time,1)} นาที${row.pace?` · ${e(row.pace)} /km`:''}</dd></div>` : '';
  const fast=[`${number(interval.reps,0)} รอบ`];
  if (Number(interval.repDist)>0) fast[0]=`${number(interval.reps,0)} × ${number(interval.repDist,2)} km`;
  if (interval.repPace) fast.push(`${interval.repPace} /km`);
  if (Number(interval.repHR)>0) fast.push(`${number(interval.repHR,0)} bpm`);
  const rest=healthValue(interval.restTime);
  return `<section class="card interval-detail"><div class="section-heading"><h2>ชุดซ้อม Interval</h2>${detected?'<span class="source">Intervals.icu</span>':''}</div><dl class="facts"><div><dt>ช่วงเร็ว</dt><dd>${e(fast.join(' · '))}</dd></div>${rest==null?'':`<div><dt>พักต่อรอบ</dt><dd>${number(rest,1)} นาที</dd></div>`}${section('วอร์มอัป',interval.warmup)}${section('คูลดาวน์',interval.cooldown)}</dl></section>`;
}

function routePreview(points) {
  const valid=(Array.isArray(points)?points:[]).filter(p=>Number.isFinite(p?.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180);
  if (valid.length<2) return '<p class="muted">ไม่มีพิกัด GPS ในข้อมูลกิจกรรมที่นำเข้ามา</p>';
  const W=340,H=220,PAD=16;
  const merc=(lat,lng,z)=>{const s=256*Math.pow(2,z),r=lat*Math.PI/180;return [(lng+180)/360*s,(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*s];};
  const lats=valid.map(p=>p.lat), lngs=valid.map(p=>p.lng);
  const maxLat=Math.max(...lats), minLat=Math.min(...lats), maxLng=Math.max(...lngs), minLng=Math.min(...lngs);
  let z=18;
  for(;z>3;z--){const [x0,y0]=merc(maxLat,minLng,z),[x1,y1]=merc(minLat,maxLng,z);if(x1-x0<=W-2*PAD && y1-y0<=H-2*PAD)break;}
  const [bx0,by0]=merc(maxLat,minLng,z),[bx1,by1]=merc(minLat,maxLng,z);
  const ox=(bx0+bx1)/2-W/2, oy=(by0+by1)/2-H/2, n=Math.pow(2,z);
  let tiles='';
  for(let tx=Math.floor(ox/256); tx<=Math.floor((ox+W)/256); tx++)
    for(let ty=Math.floor(oy/256); ty<=Math.floor((oy+H)/256); ty++){
      if(ty<0||ty>=n) continue;
      const wx=((tx%n)+n)%n;
      tiles+=`<img src="https://tile.openstreetmap.org/${z}/${wx}/${ty}.png" alt="" width="256" height="256" loading="lazy" decoding="async" style="left:${(tx*256-ox)/W*100}%;top:${(ty*256-oy)/H*100}%">`;
    }
  const pt=p=>{const [x,y]=merc(p.lat,p.lng,z);return [(x-ox),(y-oy)];};
  const xy=valid.map(pt);
  const path=xy.map(([x,y])=>`${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [sx,sy]=xy[0], [fx,fy]=xy[xy.length-1];
  return `<div class="route-map" role="img" aria-label="แผนที่เส้นทางจากพิกัด GPS">`
    +`<div class="route-tiles">${tiles}</div>`
    +`<svg class="route-line" viewBox="0 0 ${W} ${H}"><polyline points="${path}" fill="none" stroke="#ed6b2d" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`
    +`<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="5" fill="#2ecc71" stroke="#fff" stroke-width="2"/>`
    +`<circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="5" fill="#e74c3c" stroke="#fff" stroke-width="2"/></svg>`
    +`<span class="route-attrib">© OpenStreetMap</span></div>`
    +`<p class="small muted">เส้นทางจากพิกัด GPS บนแผนที่ • ${valid.length} จุด • zoom ${z}</p>`;
}
