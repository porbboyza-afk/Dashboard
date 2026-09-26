import {periodBounds, summarize, localDate, trainingActivities, wellnessSourceState, cleanHealthConnectStreak} from '../domain/model.mjs';
import {escape as e, number, dateLabel, sleepDuration, sourceLabel} from '../ui/format.mjs';
import {icon} from '../ui/icons.mjs';
import {pageHeading, activityRow, metric, empty} from '../ui/components.mjs';
import {planBuilderForm, planImportForm} from '../ui/forms.mjs';
import {backupPayload} from '../domain/backup.mjs';

function weeklyVolumeTrend(activities, referenceDate) {
  const current=periodBounds(referenceDate,'week').start;
  const starts=Array.from({length:12},(_,index)=>{
    const date=new Date(`${current}T12:00:00`);
    date.setDate(date.getDate()-(11-index)*7);
    return localDate(date);
  });
  const totals=new Map(starts.map(start=>[start,0]));
  const counts=new Map(starts.map(start=>[start,0]));
  for (const activity of activities) {
    const start=activity.date ? periodBounds(activity.date,'week').start : '';
    if (totals.has(start)) {
      totals.set(start,totals.get(start)+(activity.distanceKm || 0));
      counts.set(start,counts.get(start)+1);
    }
  }
  const rows=starts.map(start=>({start,distance:totals.get(start),count:counts.get(start)}));
  const maximum=Math.max(...rows.map(row=>row.distance),1);
  const weeklyTable=`<details class="weekly-volume-details"><summary>ดูยอดรายสัปดาห์ทั้ง 12 สัปดาห์</summary><div class="table-scroll"><table><thead><tr><th>เริ่มสัปดาห์</th><th>ระยะทาง</th><th>เซสชัน</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${dateLabel(row.start,{year:'numeric'})}</td><td>${number(row.distance,2)} km</td><td>${row.count}</td></tr>`).join('')}</tbody></table></div></details>`;
  return `<section class="card volume-trend"><div class="section-heading"><div><p class="eyebrow">WEEKLY DISTANCE</p><h2>ระยะทางรายสัปดาห์</h2></div><span class="source">12 สัปดาห์</span></div><div class="volume-bars" aria-label="ระยะทางรายสัปดาห์ 12 สัปดาห์ล่าสุด">${rows.map((row,index)=>`<button type="button" data-week="${row.start}" class="volume-bar" title="สัปดาห์ ${dateLabel(row.start)}: ${number(row.distance,2)} km"><span class="confirmed-bar" style="height:${Math.max(row.distance ? 7 : 0,Math.round(row.distance/maximum*100))}%"></span><strong>${index===rows.length-1||index%3===0?number(row.distance,0):''}</strong><small>${index===rows.length-1||index%3===0?dateLabel(row.start,{day:'numeric',month:'short'}):''}</small></button>`).join('')}</div>${weeklyTable}</section>`;
}

export function progress(model, period='week', date=localDate()) {
  const bounds=periodBounds(date,period);
  const activities=trainingActivities(model.activities);
  const runningActivities=activities;
  const summary=summarize(activities,bounds);
  return `${pageHeading('YOUR PROGRESS','ความก้าวหน้า','ระยะทาง เวลา และกิจกรรมในแต่ละช่วง')}${weeklyVolumeTrend(runningActivities,date)}<div class="period-toolbar"><div class="tabs"><button data-period="week" class="${period==='week'?'selected':''}">สัปดาห์</button><button data-period="month" class="${period==='month'?'selected':''}">เดือน</button></div><label>วันที่อ้างอิง<input id="period-date" type="date" value="${e(date)}"></label></div><p class="muted">${dateLabel(bounds.start)} – ${dateLabel(bounds.end,{year:'numeric'})}</p><section class="metrics">${metric('route','Distance',number(summary.distanceKm,2),'km')}${metric('shoe','Activities',summary.count)}${metric('calendar','Duration',number(summary.durationMin,0),'min')}${metric('wave','แหล่งข้อมูล',new Set(summary.rows.map(row=>row.source)).size)}</section><section class="card"><h2>กิจกรรมในช่วงนี้</h2>${summary.rows.map(activityRow).join('') || empty('ยังไม่มีกิจกรรม','เลือกช่วงวันอื่นเพื่อดูประวัติ')}</section>`;
}

const healthMetrics=[
  {key:'sleepHours',label:'Sleep',unit:'ชม.',icon:'moon',format:value=>sleepDuration(value),axis:value=>`${number(value,1)} ชม.`,color:'#496c5c'},
  {key:'restingHR',label:'Resting HR',unit:'bpm',icon:'heart',format:value=>number(value,0),axis:value=>`${number(value,0)} bpm`,color:'#c55e42'},
  {key:'hrv',label:'HRV',unit:'ms',icon:'wave',format:value=>number(value,0),axis:value=>`${number(value,0)} ms`,color:'#307e79'},
  {key:'spo2',label:'SpO₂',unit:'%',icon:'sun',format:value=>number(value,0),axis:value=>`${number(value,0)}%`,color:'#bd8a35'},
];

function healthTrend(records, definition) {
  const timeline=records.slice(0,28).reverse();
  const points=timeline.map((row,index)=>({row,index,value:row[definition.key] == null || row[definition.key] === '' ? NaN : Number(row[definition.key])})).filter(point=>Number.isFinite(point.value));
  if (points.length<2) return `<section class="trend-card"><div class="section-heading"><h2>${icon(definition.icon)} ${e(definition.label)}</h2><span class="source">แนวโน้ม 28 วัน</span></div><p class="muted">มีข้อมูลไม่พอสำหรับแสดงแนวโน้ม</p></section>`;
  const values=points.map(point=>point.value), rawLow=Math.min(...values), rawHigh=Math.max(...values);
  const span=rawHigh-rawLow || Math.max(Math.abs(rawHigh)*.08,1);
  const low=rawLow-span*.12, high=rawHigh+span*.12;
  const width=390, left=54, right=374, top=16, bottom=118;
  const xFor=index=>timeline.length===1 ? (left+right)/2 : left+(index/(timeline.length-1))*(right-left);
  const yFor=value=>bottom-((value-low)/(high-low))*(bottom-top);
  const coords=points.map(point=>`${xFor(point.index).toFixed(1)},${yFor(point.value).toFixed(1)}`);
  const ticks=[high,(high+low)/2,low];
  const latest=points.at(-1);
  const unit=definition.key==='sleepHours' ? '' : definition.unit;
  const recordsList=points.slice().reverse().map(point=>`<a href="#health/${e(point.row.date)}"><span>${dateLabel(point.row.date,{year:'numeric',weekday:'short'})}</span><strong>${e(definition.format(point.value))}${unit ? ` <small>${e(unit)}</small>` : ''}</strong></a>`).join('');
  return `<section class="trend-card"><div class="section-heading"><div><h2>${icon(definition.icon)} ${e(definition.label)}</h2><p class="muted">${points.length} วันที่มีค่าใน 28 วันล่าสุด · แตะจุดหรือดูรายวัน</p></div><strong>${e(definition.format(latest.value))}${unit ? ` <small>${e(unit)}</small>` : ''}</strong></div><svg class="health-trend-chart" viewBox="0 0 ${width} 150" role="img" aria-label="แนวโน้ม ${e(definition.label)} พร้อมแกนตั้งและจุดข้อมูลที่กดได้"><g class="trend-grid">${ticks.map(value=>`<line x1="${left}" x2="${right}" y1="${yFor(value).toFixed(1)}" y2="${yFor(value).toFixed(1)}"/><text x="${left-7}" y="${(yFor(value)+4).toFixed(1)}" text-anchor="end">${e(definition.axis(value))}</text>`).join('')}</g><polyline points="${coords.join(' ')}" fill="none" stroke="${definition.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${points.map((point,index)=>`<a href="#health/${e(point.row.date)}" aria-label="${e(dateLabel(point.row.date,{year:'numeric'}))}: ${e(definition.format(point.value))}"><title>${e(dateLabel(point.row.date,{year:'numeric'}))}: ${e(definition.format(point.value))}</title><circle cx="${xFor(point.index).toFixed(1)}" cy="${yFor(point.value).toFixed(1)}" r="${index===points.length-1?5:3.5}" fill="${definition.color}"/></a>`).join('')}<text class="trend-date" x="${left}" y="141">${e(dateLabel(timeline[0].date))}</text><text class="trend-date" x="${right}" y="141" text-anchor="end">${e(dateLabel(latest.row.date))}</text></svg><details class="trend-records"><summary>ดูค่ารายวัน ${points.length} วัน</summary><div>${recordsList}</div></details></section>`;
}

function healthDay(model, date) {
  const row=model.wellness.find(entry=>entry.date===date);
  if (!row) return `${pageHeading('HEALTH DETAIL','ไม่พบข้อมูลของวันนี้','วันดังกล่าวไม่มีข้อมูลสุขภาพที่อ่านได้')}<a class="button" href="#health">กลับไปสุขภาพ</a>`;
  const sourceNote='';
  const details=[
    ['Sleep',sleepDuration(row.sleepHours)], ['Resting HR',`${number(row.restingHR,0)} bpm`],
    ['HRV',`${number(row.hrv,0)} ms`], ['SpO₂',`${number(row.spo2,0)} %`],
    ['แหล่งข้อมูล',row.sources.map(sourceLabel).join(' + ') || '—'],
  ];
  return `${pageHeading('HEALTH DETAIL',dateLabel(row.date,{year:'numeric',weekday:'long'}),'ค่าที่บันทึกไว้ของวันนี้ ไม่มีการคำนวณทดแทนข้อมูลที่หายไป')}<section class="metrics detail-metrics">${healthMetrics.map(item=>metric(item.icon,item.label,item.format(row[item.key]),item.key==='sleepHours'?'':item.unit)).join('')}</section>${sourceNote?`<p class="data-policy">${e(sourceNote)}</p>`:''}<section class="card"><h2>รายละเอียดและแหล่งข้อมูล</h2><dl class="facts">${details.map(([label,value])=>`<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl></section>`;
}

function healthSourceLabel(row) {
  const state=wellnessSourceState(row);
  if (state==='mixed_legacy') return 'Health Connect + Garmin';
  if (state==='garmin_legacy') return 'Garmin';
  return row.sources.map(sourceLabel).join(' + ') || '—';
}

export function health(model, selectedDate='') {
  if (selectedDate) return healthDay(model,selectedDate);
  const latest=model.wellness[0];
  const rows=records=>`<div class="table-scroll"><table><thead><tr><th>วันที่</th><th>นอน (ชม.)</th><th>RHR</th><th>HRV</th><th>SpO₂</th><th>แหล่งข้อมูล</th></tr></thead><tbody>${records.map(row=>`<tr class="health-row"><td><a href="#health/${e(row.date)}">${dateLabel(row.date,{year:'2-digit'})}</a></td><td>${sleepDuration(row.sleepHours)}</td><td>${number(row.restingHR,0)}</td><td>${number(row.hrv,0)}</td><td>${number(row.spo2,0)}</td><td>${e(healthSourceLabel(row))}</td></tr>`).join('')}</tbody></table></div>`;
  const readiness=`<section class="card readiness-pending"><p class="eyebrow">READINESS</p><h2>ยังไม่มีคะแนนความพร้อม</h2></section>`;
  const recent=model.wellness.slice(0,14), older=model.wellness.slice(14);
  const history=model.wellness.length ? `${rows(recent)}${older.length?`<details class="health-history"><summary>ดูประวัติเก่าอีก ${older.length} วัน</summary>${rows(older)}</details>`:''}` : empty('ยังไม่มีข้อมูลสุขภาพ','ข้อมูลที่ซิงก์จะปรากฏเมื่ออ่านข้อมูลใหม่');
  return `${pageHeading('RECOVERY & HEALTH','สุขภาพและการนอน','ดูค่าล่าสุด แนวโน้ม และกดวันเพื่อดูรายละเอียด')}<details class="card"><summary>ไฟล์สุขภาพและเทียบข้อมูลแอปเก่า</summary><p><button type="button" data-export-health="json">ส่งออก JSON</button> <button type="button" data-export-health="csv">ส่งออก CSV</button></p><label>เลือกไฟล์ JSON จากแอปเก่า<input id="health-compare-file" type="file" accept=".json,application/json"></label><p class="muted">เปิดเทียบค่าในเครื่อง ไม่มีการบันทึกทับข้อมูลบัญชี</p><div id="health-compare-result" aria-live="polite"></div></details><section class="metrics">${metric('moon','Sleep',sleepDuration(latest?.sleepHours),'','',latest?dateLabel(latest.date):'ไม่มีข้อมูล')}${metric('heart','Resting HR',number(latest?.restingHR,0),'bpm')}${metric('wave','HRV',number(latest?.hrv,0),'ms')}${metric('sun','SpO₂',number(latest?.spo2,0),'%')}</section>${readiness}<section class="health-trends"><div class="section-heading"><div><p class="eyebrow">TRENDS</p><h2>แนวโน้มสุขภาพ</h2></div><span class="source">จากวันที่มีข้อมูลจริง</span></div>${healthMetrics.map(item=>healthTrend(model.wellness,item)).join('')}</section><section class="card"><div class="section-heading"><h2>ประวัติสุขภาพ</h2><span class="source">กดวันที่เพื่อดูรายละเอียด</span></div>${history}</section>`;
}

export function plan(model) {
  const active=model.plan;
  const activeCard=active ? `<section class="card active-plan-card">
    <div class="section-heading">
      <div>
        <p class="eyebrow" style="color:var(--orange);">ACTIVE PLAN</p>
        <h2>${e(active.name || active.title || active.goal || 'แผนปัจจุบัน')}</h2>
      </div>
      <button type="button" id="archive-active-plan" class="subtle-button" data-plan-id="${e(active.planId)}" style="color:#b33c24; border-color:#e2c5bd;">จัดเก็บแผนนี้ (Archive)</button>
    </div>
    <p class="muted" style="margin-bottom:14px;">${(active.sessions || []).length} เซสชัน${active.startDate ? ' · '+dateLabel(active.startDate)+' – '+dateLabel(active.endDate,{year:'numeric'}) : ''}</p>
    ${sessions(active.sessions)}
  </section>` : empty('ยังไม่มีแผนที่เปิดใช้งาน','คุณสามารถสร้างตารางฝึกซ้อมใหม่ด้วยแบบฟอร์มด้านล่างนี้');
  return `${pageHeading('TRAINING PLAN','แผนฝึก','แผนที่ใช้งานอยู่และการสร้างแผนใหม่')}<div class="tabs"><a href="#workouts">ประวัติกิจกรรม</a><a class="selected" href="#plan">แผนฝึก</a></div>${activeCard}${planBuilderForm(active)}${planImportForm()}`;
}

function sessions(rows=[]) {
  return rows.map(row=>`<details class="plan-session"><summary><span>${dateLabel(row.date)}</span><strong>${e(row.title || row.type || 'Session')}</strong><span>${row.targetDist?number(row.targetDist)+' km':''}</span></summary><dl class="facts">${[['เพซ',row.targetPace],['HR',row.targetHR],['คำแนะนำ',row.description],['วอร์มอัป',row.details?.warmup],['ชุดหลัก',row.details?.mainSet],['คูลดาวน์',row.details?.cooldown],['วิธีวิ่ง',row.details?.execution],['หมายเหตุ',row.notes],['รายละเอียด',typeof row.details==='string'?row.details:null]].filter(([,value])=>value!=null&&value!=='').map(([label,value])=>`<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl></details>`).join('');
}

export function more(model) {
  return `${pageHeading('YOUR SPACE','เพิ่มเติม','สุขภาพ การเชื่อมต่อ และข้อมูลของคุณ')}<section class="card menu-list"><a href="#health">${icon('heart')}<span><strong>สุขภาพและการนอน</strong><small>ดูประวัติและข้อมูลจากอุปกรณ์</small></span>${icon('arrow')}</a><a href="#plan">${icon('calendar')}<span><strong>แผนฝึก</strong><small>ตารางปัจจุบันและแผนที่จัดเก็บ</small></span>${icon('arrow')}</a><a href="#connections">${icon('link')}<span><strong>การเชื่อมต่อ</strong><small>สถานะ COROS, Garmin และ Health Connect</small></span>${icon('arrow')}</a><a href="#backup">${icon('calendar')}<span><strong>สำรองและส่งออกข้อมูล</strong><small>ดาวน์โหลดไฟล์ของคุณลงเครื่อง</small></span>${icon('arrow')}</a></section><section class="card"><h2>สถานะตัวใหม่ในเครื่อง</h2><p class="muted">ใช้ข้อมูลจริงที่อ่านจาก MyDash เมื่อ ${model.readAt?new Date(model.readAt).toLocaleString('th-TH'):'—'} ข้อมูลจะไม่เปลี่ยนจนกว่าจะอ่านใหม่</p><p class="muted">รองรับการติดตั้งเป็นแอป มีหน้าแจ้งออฟไลน์ และแจ้งก่อนอัปเดต ไม่เก็บข้อมูลกิจกรรมหรือสุขภาพในแคช</p></section>`;
}

export function backup(model) {
  const payload=backupPayload(model);
  return `${pageHeading('MYDASH BACKUP','สำรองและส่งออกข้อมูล','ส่งออกข้อมูลที่อ่านอยู่ หรือกู้คืนเฉพาะรายการที่หายหลังตรวจและยืนยัน')}<section class="card"><h2>สำรองประวัติที่อ่านได้</h2><p class="muted">JSON เก็บกิจกรรม สุขภาพ แผน การแข่งขัน และรายละเอียดประวัติ ไม่รวมการตั้งค่า โปรไฟล์ token หรือค่าลับ</p><button class="button" type="button" data-export-backup="json">ดาวน์โหลดไฟล์สำรอง JSON</button></section><section class="card"><h2>ส่งออกกิจกรรม</h2><p class="muted">CSV เปิดด้วย Excel ได้ เหมาะสำหรับวิเคราะห์ ไม่ใช่ไฟล์กู้คืน</p><button class="button" type="button" data-export-backup="csv">ดาวน์โหลดกิจกรรม CSV</button></section><section class="card"><h2>ตรวจไฟล์ก่อนกู้คืน</h2><p class="muted">รองรับ JSON รุ่น 2 และไฟล์เดิม MyDash Health Intelligence V4 ไม่เกิน 10 MB เพิ่มเฉพาะรายการที่หาย ไม่ทับข้อมูลเดิม ไม่เปลี่ยนแผนที่ใช้อยู่ รายการเก่าที่จับคู่กำกวมจะไม่ถูกนำเข้าโดยเดา</p><label>ไฟล์สำรอง JSON<input id="backup-inspect-file" type="file" accept=".json,application/json"></label><div id="backup-inspect-result" class="form-status" aria-live="polite"></div></section><section class="card"><h2>ข้อมูลในหน้าปัจจุบัน</h2><dl class="facts"><div><dt>กิจกรรม</dt><dd>${model.activities.length} รายการ</dd></div><div><dt>สุขภาพ</dt><dd>${model.wellness.length} วัน</dd></div><div><dt>แผนที่เก็บไว้</dt><dd>${payload.coachPlans.length} แผน</dd></div></dl></section>`;
}

export function connections(model) {
  const statuses=model.data.sync_sources || {};
  return `${pageHeading('CONNECTED SOURCES','การเชื่อมต่อ','เวลาอ่านข้อมูลของตัวใหม่อาจใหม่กว่าเวลาที่อุปกรณ์ซิงก์สำเร็จ')}<div class="connection-grid">${Object.entries(statuses).map(([name,row])=>`<section class="card"><p class="eyebrow">${e(name)}</p><h2>${e(row.status || 'ข้อมูลสถานะ')}</h2><dl class="facts">${Object.entries(row).filter(([key,value])=>/status|last_sync|updatedAt|created|enriched|unchanged|fetched/.test(key)&&['string','number','boolean'].includes(typeof value)).map(([key,value])=>`<div><dt>${e(key)}</dt><dd>${e(/last_sync|updatedAt/.test(key)&&typeof value==='number'?new Date(value).toLocaleString('th-TH'):value)}</dd></div>`).join('')}</dl></section>`).join('')}</div><section class="card"><h2>กิจกรรมที่อาจซ้ำ</h2><p class="muted">พบ ${model.possibleDuplicates.length} คู่ที่ระยะและเวลาใกล้กัน ใช้ตรวจรายละเอียดเพิ่มเติมจากข้อมูลที่อ่านได้</p>${model.possibleDuplicates.slice(0,20).map(pair=>`<div class="duplicate-pair">${pair.map(id=>activityRow(model.activities.find(row=>row.id===id))).join('')}</div>`).join('')}</section>`;
}
