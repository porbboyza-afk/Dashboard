import {reviewFor} from '../domain/model.mjs';
import {trainingActivities} from '../domain/model.mjs';
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
  return `<a href="#workouts" class="back-link">${icon('back')} กลับไปกิจกรรม</a>${pageHeading(sourceLabel(activity.source),activity.name,dateLabel(activity.date,{year:'numeric',weekday:'long'}))}<section class="metrics detail-metrics">${metric('route','Distance',number(activity.distanceKm,2),'km')}${metric('calendar','Duration',clock(activity.durationMin))}${metric('wave','Avg. Pace',clock(activity.distanceKm && activity.durationMin ? activity.durationMin/activity.distanceKm : null),'/km')}${metric('heart','Avg. HR',number(activity.averageHr,0),'bpm')}</section><div class="detail-grid"><section class="card"><div class="section-heading"><h2>รอบวิ่ง / Splits</h2><span class="source">${e(sourceLabel(activity.source))}</span></div>${splitChart(activity.laps)}${splitTable(activity)}</section><div class="detail-aside"><section class="card effort-card"><p class="eyebrow">SESSION EFFORT</p><h2>${e(effort?.label || 'ยังไม่ได้ระบุความหนัก')}</h2><p class="effort-score">${effort ? `RPE ${number(activity.rpe,0)} /10` : 'ไม่มี Training Load จากแหล่งข้อมูล'}</p><p class="muted">${e(effort?.description || 'กรอก RPE หลังจบกิจกรรมเพื่อใช้ติดตามความหนักแบบไม่เดาตัวเลข')}</p></section><section class="card"><h2>รายละเอียดเพิ่มเติม</h2><dl class="facts"><div><dt>Cadence</dt><dd>${number(activity.cadence,0)} spm</dd></div><div><dt>ที่มาของ cadence</dt><dd>${activity.cadenceOrigin==='splits'?'เฉลี่ยถ่วงน้ำหนักตามเวลารายช่วง':activity.cadenceOrigin==='summary'?'ข้อมูลสรุปกิจกรรม':'ไม่มีข้อมูล'}</dd></div><div><dt>RPE</dt><dd>${number(activity.rpe,0)} /10</dd></div><div><dt>รองเท้า</dt><dd>${e(activity.shoe || '—')}</dd></div></dl>${activity.note?`<p class="note">${e(activity.note)}</p>`:''}</section><section class="card"><h2>เส้นทาง GPS</h2>${routePreview(activity.route)}</section></div><section class="card review-card"><p class="eyebrow">POST-RUN REVIEW</p><h2>รีวิวการวิ่งครั้งนี้</h2>${review?.aiSummary ? `<p class="muted">รีวิวที่บันทึกไว้${review.updatedAt?' · '+new Date(review.updatedAt).toLocaleDateString('th-TH'):''} • ยังไม่ได้ตรวจความตรงกับข้อมูลและแผน revision ปัจจุบัน</p><details><summary>อ่านรีวิวเดิม</summary><div class="review-text">${e(review.aiSummary)}</div></details>` : '<p class="muted">ยังไม่มีรีวิวที่บันทึกสำหรับกิจกรรมนี้</p>'}<p class="small muted">แสดงรีวิวที่เคยบันทึกไว้เท่านั้น ไม่มีการสร้างรีวิว AI ใหม่</p></section></div>`;
}

export function intervalDetail(activity) {
  const interval=activity?.raw?.interval;
  if (!interval || activity.type!=='interval') return '';
  const section=(label,row)=>row && (Number(row.dist)>0 || Number(row.time)>0)
    ? `<div><dt>${label}</dt><dd>${number(row.dist,2)} km · ${number(row.time,1)} นาที${row.pace?` · ${e(row.pace)} /km`:''}</dd></div>` : '';
  return `<section class="card interval-detail"><h2>โครงสร้าง Interval</h2><dl class="facts"><div><dt>ช่วงเร็ว</dt><dd>${number(interval.reps,0)} × ${number(interval.repDist,2)} km · ${e(interval.repPace || '—')} /km</dd></div><div><dt>พักต่อรอบ</dt><dd>${number(interval.restTime,1)} นาที</dd></div>${section('วอร์มอัป',interval.warmup)}${section('คูลดาวน์',interval.cooldown)}</dl></section>`;
}

function routePreview(points) {
  const valid=(Array.isArray(points)?points:[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180);
  if (valid.length<2) return '<p class="muted">ไม่มีพิกัด GPS ในข้อมูลกิจกรรมที่นำเข้ามา</p>';
  const lats=valid.map(p=>p.lat), lngs=valid.map(p=>p.lng);
  const minLat=Math.min(...lats), minLng=Math.min(...lngs);
  const latSpan=Math.max(...lats)-minLat || .00001, lngSpan=Math.max(...lngs)-minLng || .00001;
  const scale=Math.min(300/lngSpan,170/latSpan);
  const path=valid.map(p=>`${20+(p.lng-minLng)*scale},${190-(p.lat-minLat)*scale}`).join(' ');
  return `<svg viewBox="0 0 340 210" class="route-chart" role="img" aria-label="รูปร่างเส้นทางจากพิกัด GPS"><polyline points="${path}" fill="none" stroke="#ed6b2d" stroke-width="3"/></svg><p class="small muted">รูปร่างเส้นทางจากพิกัดที่บันทึก • ไม่มีแผนที่พื้นหลัง</p>`;
}
