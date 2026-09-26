import {periodBounds, summarize, localDate, trainingActivities} from '../domain/model.mjs';
import {escape as e, number, clock, dateLabel, activityUrl, sleepDuration} from '../ui/format.mjs';
import {icon} from '../ui/icons.mjs';
import {metric, activityRow, splitChart, empty} from '../ui/components.mjs';

export function home(model, preferences) {
  const today=localDate();
  const activities=trainingActivities(model.activities);
  const week=summarize(activities,periodBounds(today));
  const recent=activities.find(row=>['run','interval','trailrun','virtualrun'].includes(row.type.toLowerCase()));
  const health=model.wellness.find(row=>row.date<=today);
  const next=(model.plan?.sessions || []).filter(row=>row.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0];
  const goal=Number(preferences.weeklyGoal) || 0;
  const percentage=goal>0 ? Math.round(week.distanceKm/goal*100) : null;
  const hour=new Date().getHours();
  const greeting=hour<12?'Good morning,':hour<18?'Good afternoon,':'Good evening,';
  return `<section class="hero"><div class="hero-landscape" aria-hidden="true"></div><div class="hero-content"><div class="hero-date">${new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long'})}<span>${icon('sun')}</span></div><h1>${greeting}<br>Runner.</h1><p>Consistency builds<br>better days.</p></div><span class="hero-label">YOUR EVERYDAY<br>PERFORMANCE</span></section>
  <div class="home-grid"><section class="card distance-card"><div><p class="eyebrow">Weekly Distance</p><div class="distance-value">${number(week.distanceKm,1)} <span>km</span></div><p class="muted">${goal ? `จากเป้าหมาย ${number(goal)} km` : 'ยังไม่ได้ตั้งเป้าระยะประจำสัปดาห์'}</p><div class="progress-track"><span style="width:${Math.min(percentage || 0,100)}%"></span></div><p class="small">${week.count} กิจกรรม • ${dateLabel(periodBounds(today).start)} – ${dateLabel(periodBounds(today).end)}</p><button class="text-button" data-action="goal">${goal?'แก้ไขเป้าหมาย':'ตั้งเป้าหมาย'}</button><a class="detail-link" href="#progress">ดูแนวโน้มกิจกรรม ${icon('arrow')}</a></div><div class="distance-ring" style="--progress:${Math.min(percentage || 0,100)}%"><div><strong>${percentage == null?'—':percentage+'%'}</strong><small>WEEKLY GOAL</small></div></div></section>
  <a href="#plan" class="next-workout"><span class="next-icon">${icon('shoe')}</span><div><p class="eyebrow">${next?'Next Workout':'Training Plan'}</p><h2>${e(next?.title || next?.type || 'ยังไม่มีแผนฝึก')}</h2><p>${next ? `${next.targetDist ? number(next.targetDist)+' km · ' : ''}${e(next.targetPace || '')}` : 'เลือกดูหรือจัดแผนการวิ่งของคุณ'}</p><small>${next?dateLabel(next.date,{weekday:'short'}):'เปิดหน้าแผนฝึก'}</small></div>${icon('arrow','chevron')}</a>
  <section class="metrics">${metric('moon','Sleep',sleepDuration(health?.sleepHours),'','#health',health?dateLabel(health.date):'ยังไม่มีข้อมูล')}${metric('heart','Resting HR',number(health?.restingHR,0),'bpm','#health')}${metric('wave','HRV',number(health?.hrv,0),'ms','#health')}${metric('shoe','Cadence',number(recent?.cadence,0),'spm',recent?activityUrl(recent):'#workouts',recent?'กิจกรรมล่าสุด':'ยังไม่มีข้อมูล')}</section>
  <section class="card recent-card"><div class="section-heading"><h2>Recent Run</h2><a href="#workouts">ดูทั้งหมด ${icon('arrow')}</a></div>${recent ? `${activityRow(recent)}<div class="recent-summary"><span>${clock(recent.durationMin)} <small>ระยะเวลา</small></span><span>${number(recent.averageHr,0)} <small>HR เฉลี่ย</small></span></div>${splitChart(recent.laps)}${recent.laps.length ? `<div class="split-tiles">${recent.laps.slice(0,5).map(lap=>`<div><small>${e(lap.index)} · ${number(lap.distanceKm,2)} km</small><strong>${clock(lap.pace)}</strong></div>`).join('')}</div>` : '<p class="muted">ไม่มีข้อมูลรอบวิ่งจากแหล่งนี้</p>'}<a class="detail-link" href="${activityUrl(recent)}">รายละเอียดกิจกรรมและรีวิว ${icon('arrow')}</a>` : empty('ยังไม่มีกิจกรรม','กิจกรรมที่ซิงก์จะปรากฏที่นี่')}</section>
  <section class="card week-card"><div class="section-heading"><h2>This Week</h2><a href="#progress">แนวโน้ม ${icon('arrow')}</a></div>${week.rows.slice(0,4).map(activityRow).join('') || '<p class="muted">ยังไม่มีกิจกรรมในสัปดาห์นี้</p>'}<a class="detail-link" href="#workouts">เปิดประวัติทั้งหมด ${icon('arrow')}</a></section></div>`;
}
