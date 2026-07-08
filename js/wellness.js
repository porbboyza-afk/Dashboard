// Wellness, readiness, load, and recovery logic extracted from index.html.
function numberValue(id) {
  const value = parseFloat(document.getElementById(id)?.value);
  return Number.isFinite(value) ? value : null;
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function formatSleepHours(value,{compact=false}={}){
  const hours=parseFloat(value);
  if(!Number.isFinite(hours))return '—';
  const totalMinutes=Math.max(0,Math.round(hours*60));
  const h=Math.floor(totalMinutes/60);
  const m=totalMinutes%60;
  if(compact)return m?`${h}ชม ${m}น`:`${h}ชม`;
  return m?`${h} ชม. ${m} นาที`:`${h} ชม.`;
}

function dateDaysAgo(days){
  const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-days);return d;
}
function sessionLoad(w){
  const minutes=parseFloat(w.time||0);if(!minutes)return 0;
  if(w.rpe)return Math.round(minutes*parseFloat(w.rpe));
  const hr=parseFloat(w.hr||0);
  const intensity=hr?(hr<130?2:hr<145?3:hr<160?5:hr<175?7:9):(w.type==='interval'?7:w.type==='run'?4:3);
  return Math.round(minutes*intensity);
}
function calculateLoadMetrics(all=getAllActivities()){
  const today=new Date();today.setHours(23,59,59,999);
  const inRange=days=>all.filter(w=>{const d=new Date((w.date||'')+'T12:00:00');return d>=dateDaysAgo(days-1)&&d<=today;});
  const acuteActs=inRange(7),chronicActs=inRange(28);
  const acute=acuteActs.reduce((s,w)=>s+sessionLoad(w),0);
  const chronicTotal=chronicActs.reduce((s,w)=>s+sessionLoad(w),0);
  const chronicWeekly=chronicTotal/4;
  const validDates=chronicActs.map(w=>new Date((w.date||'')+'T12:00:00')).filter(d=>!isNaN(d));
  const historyDays=validDates.length?Math.floor((today-Math.min(...validDates))/86400000)+1:0;
  const baselineReady=historyDays>=21&&chronicActs.length>=3;
  const acwr=baselineReady&&chronicWeekly>0?acute/chronicWeekly:null;
  const daily=Array.from({length:7},(_,i)=>{const ds=toLocalDateStr(dateDaysAgo(6-i));return acuteActs.filter(w=>w.date===ds).reduce((s,w)=>s+sessionLoad(w),0);});
  const mean=daily.reduce((a,b)=>a+b,0)/7;
  const sd=Math.sqrt(daily.reduce((s,v)=>s+Math.pow(v-mean,2),0)/7);
  const monotony=sd>0?mean/sd:(mean>0?7:0);
  const strain=acute*monotony;
  return {acute,chronicWeekly,acwr,monotony,strain,daily,acuteActs,chronicActs,historyDays,baselineReady};
}
function wellnessBaseline(records,field,days=28){
  const values=(records||[]).filter(r=>new Date((r.date||'')+'T12:00:00')>=dateDaysAgo(days-1)).map(r=>parseFloat(r[field])).filter(Number.isFinite);
  return values.length>=3?values.reduce((a,b)=>a+b,0)/values.length:null;
}
function paceHREfficiency(w){const pace=parseFloat(w.avgPace||0),hr=parseFloat(w.hr||0);return pace>0&&hr>0?(1/pace)*1000/hr:0;}
function calculateEfficiencyTrend(all=getAllActivities()){
  const current=all.filter(w=>new Date((w.date||'')+'T12:00:00')>=dateDaysAgo(27)).map(paceHREfficiency).filter(Boolean);
  const prior=all.filter(w=>{const d=new Date((w.date||'')+'T12:00:00');return d>=dateDaysAgo(55)&&d<dateDaysAgo(27);}).map(paceHREfficiency).filter(Boolean);
  if(current.length<2||prior.length<2)return null;
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  return (avg(current)-avg(prior))/avg(prior)*100;
}
function hoursSinceLastWorkout(all=getAllActivities()){
  if(!all.length)return null;
  const latest=[...all].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
  return Math.max(0,(Date.now()-new Date((latest.date||'')+'T12:00:00').getTime())/3600000);
}
function calculateReadiness(){
  const wellness=AppState.get('wellness')||[];
  const today=wellness.find(r=>r.date===toLocalDateStr())||wellness[0]||null;
  const recovery=calculateRecoveryScore(today);
  const load=calculateLoadMetrics();
  const rhrBase=wellnessBaseline(wellness,'restingHR');
  const hrvBase=wellnessBaseline(wellness,'hrv');
  const restHours=hoursSinceLastWorkout();
  let score=recovery??55,reasons=[];
  if(load.acwr!==null){
    if(load.acwr>1.5){score-=18;reasons.push(`โหลด 7 วันสูงกว่าฐาน ${Math.round((load.acwr-1)*100)}%`);}
    else if(load.acwr>1.3){score-=9;reasons.push('โหลดเพิ่มค่อนข้างเร็ว');}
    else if(load.acwr<0.6&&load.chronicWeekly>0){score-=4;reasons.push('โหลดต่ำกว่าฐานระยะยาว');}
    else reasons.push('โหลดอยู่ในช่วงสมดุล');
  }
  if(today&&rhrBase&&today.restingHR){
    const diff=today.restingHR-rhrBase;
    if(diff>=8){score-=15;reasons.push(`Resting HR สูงกว่าฐาน ${Math.round(diff)} bpm`);}
    else if(diff>=5){score-=8;reasons.push(`Resting HR สูงกว่าฐาน ${Math.round(diff)} bpm`);}
  }
  if(today&&hrvBase&&today.hrv&&today.hrv<hrvBase*.8){score-=10;reasons.push('HRV ต่ำกว่าฐานมากกว่า 20%');}
  if(restHours!==null&&restHours<18){score-=8;reasons.push(`พักจากครั้งล่าสุด ${Math.round(restHours)} ชม.`);}
  if(today?.soreness>=6||today?.healthStatus==='injured'){score=Math.min(score,45);reasons.push('มีอาการปวด/บาดเจ็บสูง');}
  if(today?.healthStatus==='sick'){score=Math.min(score,35);reasons.push('สถานะป่วย');}
  const efficiencyTrend=calculateEfficiencyTrend();
  if(efficiencyTrend!==null)reasons.push(`ประสิทธิภาพ Pace/HR ${efficiencyTrend>=0?'ดีขึ้น':'ลดลง'} ${Math.abs(efficiencyTrend).toFixed(0)}%`);
  score=clamp(Math.round(score),0,100);
  const level=score>=80?'พร้อมฝึกตามแผน':score>=65?'พร้อม แต่ควรคุมความหนัก':score>=45?'แนะนำ Recovery / Easy':'แนะนำพักและติดตามอาการ';
  return {score,level,reasons,recovery,load,rhrBase,hrvBase,restHours,today,efficiencyTrend};
}
function renderIntegratedHealth(){
  const result=calculateReadiness(),{load}=result;
  const color=result.score>=80?'var(--green)':result.score>=60?'var(--orange)':'var(--red)';
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('dash-readiness-score',result.score);
  set('dash-readiness-label',result.level);
  set('dash-readiness-reasons',result.reasons.slice(0,3).join(' · ')||'เพิ่มข้อมูล Wellness เพื่อความแม่นยำ');
  set('dash-load-7',Math.round(load.acute));
  set('dash-acwr',load.acwr===null?'—':load.acwr.toFixed(2));
  set('dash-rest-hours',result.restHours===null?'—':Math.round(result.restHours)+'h');
  const scoreEl=document.getElementById('dash-readiness-score');if(scoreEl)scoreEl.style.color=color;
  const card=document.getElementById('readiness-dashboard-card');if(card)card.style.borderLeftColor=color;
  set('metric-acute',Math.round(load.acute));
  set('metric-chronic',Math.round(load.chronicWeekly));
  set('metric-acwr',load.acwr===null?'—':load.acwr.toFixed(2));
  set('metric-monotony',load.monotony.toFixed(2));
  set('metric-strain',Math.round(load.strain));
  const risk=document.getElementById('load-risk-message');
  if(risk){
    const notes=[];
    if(load.acwr!==null&&load.acwr>1.5)notes.push('⚠️ โหลดเพิ่มเร็วมาก ควรลดความหนักหรือพัก');
    else if(load.acwr!==null&&load.acwr>1.3)notes.push('🟠 โหลดเพิ่มเร็ว ควรหลีกเลี่ยงวันหนักติดกัน');
    else notes.push('✅ อัตราโหลดไม่พบความเสี่ยงเด่น');
    if(load.monotony>2)notes.push('รูปแบบการฝึกซ้ำสูง ควรสลับวันเบาและวันพัก');
    risk.textContent=notes.join(' · ');
  }
}

function calculateRecoveryScore(entry) {
  if (!entry) return null;
  const sleepHours = entry.sleepHours ?? 0;
  const sleepQuality = entry.sleepQuality ?? 5;
  const fatigue = entry.fatigue ?? 5;
  const stress = entry.stress ?? 5;
  const soreness = entry.soreness ?? 0;
  const mood = entry.mood ?? 5;
  const sleepHoursScore = clamp((sleepHours / 8) * 100, 0, 100);
  return Math.round(
    sleepHoursScore * .20 +
    sleepQuality * 10 * .20 +
    (11 - fatigue) * 10 * .20 +
    (11 - stress) * 10 * .15 +
    (10 - soreness) * 10 * .15 +
    mood * 10 * .10
  );
}

async function saveWellness() {
  if (!window._fb || !document.getElementById('user-name')?.textContent || document.getElementById('user-name').textContent === '—') {
    showToast('กรุณา Sign in ก่อนบันทึกข้อมูล', 'error'); return;
  }
  const entry = {
    date: document.getElementById('w-date').value || toLocalDateStr(),
    weight: numberValue('w-weight'),
    restingHR: numberValue('w-rhr'),
    sleepHours: numberValue('w-sleep-hours'),
    sleepQuality: numberValue('w-sleep-quality'),
    fatigue: numberValue('w-fatigue'),
    stress: numberValue('w-stress'),
    soreness: numberValue('w-soreness'),
    mood: numberValue('w-mood'),
    hrv: numberValue('w-hrv'),
    spo2: numberValue('w-spo2'),
    bloodPressure: fieldValue('w-bp'),
    healthStatus: fieldValue('w-health-status')||'normal',
    painLocation: document.getElementById('w-pain-location').value.trim(),
    note: document.getElementById('w-note').value.trim(),
    createdAt: Date.now()
  };
  if ([entry.sleepQuality,entry.fatigue,entry.stress,entry.mood].some(v => v !== null && (v < 1 || v > 10)) ||
      (entry.soreness !== null && (entry.soreness < 0 || entry.soreness > 10))) {
    showToast('คะแนนต้องอยู่ในช่วงที่กำหนด', 'error'); return;
  }
  entry.recoveryScore = calculateRecoveryScore(entry);
  showLoading('Saving wellness...');
  try {
    await window._fb.setData(`wellness/${entry.date}`, entry);
    await sendSheetsBackup('wellness', entry, true);
    showToast('✅ Wellness saved');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

async function deleteWellness(key) {
  if (!confirm('ลบข้อมูล Wellness วันนี้?')) return;
  await window._fb.removeData(`wellness/${key}`);
}

function renderWellness() {
  const list = document.getElementById('wellness-list');
  if (!list) return;
  const records = AppState.get('wellness') || [];
  const today = records.find(r => r.date === toLocalDateStr()) || records[0];
  const score = today?.date===toLocalDateStr()?calculateReadiness().score:calculateRecoveryScore(today);
  const scoreEl = document.getElementById('recovery-score');
  const labelEl = document.getElementById('recovery-label');
  const adviceEl = document.getElementById('recovery-advice');
  if (scoreEl) {
    scoreEl.textContent = score ?? '—';
    const color = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--orange)' : 'var(--red)';
    scoreEl.style.color = score === null ? 'var(--text3)' : color;
  }
  if (labelEl && adviceEl) {
    if (score === null) {
      labelEl.textContent = 'ยังไม่มีข้อมูล';
      adviceEl.textContent = 'บันทึก Morning Check-in เพื่อรับคำแนะนำ';
    } else if (score >= 80) {
      labelEl.textContent = 'พร้อมฝึก';
      adviceEl.textContent = calculateReadiness().reasons.join(' · ') || 'ร่างกายฟื้นตัวดี สามารถทำแผนตามกำหนดได้';
    } else if (score >= 60) {
      labelEl.textContent = 'ควรลดความหนัก';
      adviceEl.textContent = 'เลือก Easy/Recovery และติดตาม HR กับอาการปวดระหว่างฝึก';
    } else {
      labelEl.textContent = 'ควรพักหรือฝึกเบา';
      adviceEl.textContent = 'ความพร้อมต่ำ หากมีอาการปวดหรือ Resting HR สูงผิดปกติควรพัก';
    }
  }
  list.innerHTML = records.length ? records.slice(0,14).map(r => `
    <div class="workout-row">
      <div class="workout-icon-wrap" style="background:var(--green-light)">🫀</div>
      <div style="flex:1;min-width:0">
        <div class="workout-title">${r.date} · Recovery ${calculateRecoveryScore(r) ?? '—'}</div>
        <div class="workout-meta">Sleep ${formatSleepHours(r.sleepHours)} · RHR ${r.restingHR ?? '—'} · HRV ${r.hrv ?? '—'} · Fatigue ${r.fatigue ?? '—'} · Pain ${r.soreness ?? '—'}</div>
      </div>
      <button onclick="deleteWellness('${r._key}')" class="btn btn-ghost btn-sm">✕</button>
    </div>`).join('') : '<p class="text-sm c2">ยังไม่มีข้อมูล Wellness</p>';
  if (document.getElementById('wellness-analytics-view')?.style.display !== 'none') {
    renderWellnessAnalytics(records);
  }
}

let wellnessRangeDays = 30;

function switchWellnessTab(tab, element) {
  document.querySelectorAll('#wellness-tabs .seg-tab').forEach(item => item.classList.remove('active'));
  element?.classList.add('active');
  const checkin = document.getElementById('wellness-checkin-view');
  const analytics = document.getElementById('wellness-analytics-view');
  if (checkin) checkin.style.display = tab === 'checkin' ? 'block' : 'none';
  if (analytics) analytics.style.display = tab === 'analytics' ? 'block' : 'none';
  if (tab === 'analytics') setTimeout(renderWellnessAnalytics, 50);
  window.scrollTo({top:0,behavior:'smooth'});
}

function setWellnessRange(days, button) {
  wellnessRangeDays = days;
  document.querySelectorAll('.wellness-range-btn').forEach(el => el.classList.toggle('active', el === button));
  renderWellnessAnalytics();
}

function wellnessAverage(records, field, transform = value => value) {
  const values = records.map(r => transform(r[field], r)).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function wellnessPeriodRecords(records, start, end = new Date()) {
  return records.filter(r => {
    const date = new Date(`${r.date}T12:00:00`);
    return date >= start && date <= end;
  });
}

function wellnessTrend(current, previous, unit = '') {
  if (current === null || previous === null) return 'ข้อมูลยังไม่พอสำหรับเปรียบเทียบ';
  const diff = current - previous;
  if (Math.abs(diff) < .05) return 'ใกล้เคียงช่วงก่อนหน้า';
  return `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(unit === 'h' ? 1 : 0)}${unit} จากช่วงก่อนหน้า`;
}

function wellnessSummaryRows(current, previous) {
  const avgRecovery = wellnessAverage(current, 'recoveryScore', (_, record) => calculateRecoveryScore(record));
  const previousRecovery = wellnessAverage(previous, 'recoveryScore', (_, record) => calculateRecoveryScore(record));
  const avgSleep = wellnessAverage(current, 'sleepHours');
  const avgRhr = wellnessAverage(current, 'restingHR');
  const avgHrv = wellnessAverage(current, 'hrv');
  return [
    ['วันที่บันทึก', `${current.length} วัน`],
    ['Recovery เฉลี่ย', avgRecovery === null ? '—' : `${avgRecovery.toFixed(0)} · ${wellnessTrend(avgRecovery, previousRecovery)}`],
    ['การนอนเฉลี่ย', avgSleep === null ? '—' : formatSleepHours(avgSleep)],
    ['Resting HR เฉลี่ย', avgRhr === null ? '—' : `${avgRhr.toFixed(0)} bpm`],
    ['HRV เฉลี่ย', avgHrv === null ? '—' : `${avgHrv.toFixed(0)} ms`]
  ];
}

function renderWellnessSummary(targetId, rows) {
  const element = document.getElementById(targetId);
  if (!element) return;
  element.innerHTML = rows.map(([label, value]) => `<div class="wellness-summary-item"><span class="c2">${label}</span><span>${value}</span></div>`).join('');
}

function renderWellnessAlerts(records) {
  const element = document.getElementById('wellness-alerts');
  if (!element) return;
  const latest = [...records].sort((a,b) => (b.date || '').localeCompare(a.date || '')).slice(0, 7);
  const rhrBase = wellnessBaseline(records, 'restingHR');
  const hrvBase = wellnessBaseline(records, 'hrv');
  const alerts = [];
  const highRhr = latest.filter(r => r.restingHR && rhrBase && r.restingHR >= rhrBase + 5);
  const lowHrv = latest.filter(r => r.hrv && hrvBase && r.hrv <= hrvBase * .8);
  const poorSleep = latest.filter(r => Number.isFinite(+r.sleepHours) && +r.sleepHours < 6);
  const pain = latest.filter(r => +r.soreness >= 6 || r.healthStatus === 'injured');
  if (highRhr.length >= 2) alerts.push(['warn', `Resting HR สูงกว่าฐานอย่างน้อย 5 bpm จำนวน ${highRhr.length} วันในข้อมูลล่าสุด`]);
  if (lowHrv.length >= 2) alerts.push(['warn', `HRV ต่ำกว่าฐานมากกว่า 20% จำนวน ${lowHrv.length} วัน ควรติดตามการฟื้นตัว`]);
  if (poorSleep.length >= 2) alerts.push(['warn', `นอนต่ำกว่า 6 ชั่วโมง ${poorSleep.length} วัน อาจกระทบคุณภาพการซ้อม`]);
  if (pain.length) alerts.push(['danger', `พบอาการปวดสูงหรือสถานะบาดเจ็บ ${pain.length} วัน หลีกเลี่ยงการเพิ่มโหลดเร็ว`]);
  const load = calculateLoadMetrics();
  if (load.acwr !== null && load.acwr > 1.3) alerts.push(['danger', `ACWR ${load.acwr.toFixed(2)} โหลดเพิ่มเร็ว ควรลดวันหนักติดกัน`]);
  if (!alerts.length && latest.length) alerts.push(['', 'ยังไม่พบสัญญาณเสี่ยงเด่นจากข้อมูลล่าสุด']);
  if (!latest.length) alerts.push(['', 'เริ่มบันทึก Wellness เพื่อเปิดการตรวจจับแนวโน้ม']);
  element.innerHTML = alerts.map(([level, text]) => `<div class="wellness-alert ${level}">${text}</div>`).join('');
}

function renderWellnessCalendar(records) {
  const element = document.getElementById('wellness-calendar');
  if (!element) return;
  const byDate = Object.fromEntries(records.map(r => [r.date, r]));
  element.innerHTML = Array.from({length:30}, (_, index) => {
    const date = dateDaysAgo(29 - index);
    const dateString = toLocalDateStr(date);
    const score = calculateRecoveryScore(byDate[dateString]);
    const level = score === null ? 'none' : score >= 80 ? 'good' : score >= 60 ? 'fair' : 'low';
    const detail = score === null ? 'ไม่มีข้อมูล' : `Recovery ${score}`;
    return `<div class="wellness-day" data-level="${level}" title="${dateString} · ${detail}"></div>`;
  }).join('');
}

function wellnessChartOptions(extra = {}) {
  const colors = getChartColors();
  return {
    responsive:true,
    maintainAspectRatio:false,
    interaction:{mode:'index',intersect:false},
    plugins:{
      legend:{labels:{color:colors.tick,boxWidth:10,font:{size:10}}},
      tooltip:{backgroundColor:colors.tooltip,borderColor:colors.tooltipBorder,borderWidth:1,titleColor:colors.tooltipText,bodyColor:colors.tooltipText}
    },
    scales:{
      x:{grid:{display:false},ticks:{color:colors.tick,maxTicksLimit:8,font:{size:9}}},
      y:{grid:{color:colors.grid},ticks:{color:colors.tick,font:{size:9}}}
    },
    ...extra
  };
}

function replaceWellnessChart(name, canvasId, config) {
  if (charts[name]) charts[name].destroy();
  const context = document.getElementById(canvasId)?.getContext('2d');
  if (context) charts[name] = new Chart(context, config);
}

function renderWellnessAnalytics(sourceRecords) {
  if (!document.getElementById('page-wellness')) return;
  const all = [...(sourceRecords || AppState.get('wellness') || [])]
    .filter(record => record.date)
    .sort((a,b) => a.date.localeCompare(b.date));
  const records = wellnessPeriodRecords(all, dateDaysAgo(wellnessRangeDays - 1));
  const recent7 = wellnessPeriodRecords(all, dateDaysAgo(6));
  const previous7End = dateDaysAgo(7); previous7End.setHours(23,59,59,999);
  const previous7 = wellnessPeriodRecords(all, dateDaysAgo(13), previous7End);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const previousMonthEnd = new Date(monthStart); previousMonthEnd.setMilliseconds(-1);
  const previousMonthStart = new Date(previousMonthEnd.getFullYear(), previousMonthEnd.getMonth(), 1);
  const thisMonth = wellnessPeriodRecords(all, monthStart);
  const previousMonth = wellnessPeriodRecords(all, previousMonthStart, previousMonthEnd);
  const priorEnd = dateDaysAgo(wellnessRangeDays); priorEnd.setHours(23,59,59,999);
  const priorRecords = wellnessPeriodRecords(all, dateDaysAgo(wellnessRangeDays * 2 - 1), priorEnd);
  const avgRecovery = wellnessAverage(records, 'recoveryScore', (_, record) => calculateRecoveryScore(record));
  const priorRecovery = wellnessAverage(priorRecords, 'recoveryScore', (_, record) => calculateRecoveryScore(record));
  const avgSleep = wellnessAverage(records, 'sleepHours');
  const priorSleep = wellnessAverage(priorRecords, 'sleepHours');
  const avgHrv = wellnessAverage(records, 'hrv');
  const priorHrv = wellnessAverage(priorRecords, 'hrv');
  const set = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
  set('wellness-avg-recovery', avgRecovery === null ? '—' : avgRecovery.toFixed(0));
  set('wellness-recovery-trend', wellnessTrend(avgRecovery, priorRecovery));
  set('wellness-avg-sleep', avgSleep === null ? '—' : formatSleepHours(avgSleep,{compact:true}));
  set('wellness-sleep-trend', wellnessTrend(avgSleep, priorSleep, 'h'));
  set('wellness-avg-hrv', avgHrv === null ? '—' : avgHrv.toFixed(0));
  set('wellness-hrv-trend', wellnessTrend(avgHrv, priorHrv));
  const coverage = Math.min(100, Math.round(records.length / wellnessRangeDays * 100));
  set('wellness-coverage', `${coverage}%`);
  set('wellness-coverage-note', coverage >= 80 ? 'ข้อมูลเพียงพอสำหรับดูแนวโน้ม' : coverage >= 50 ? 'ควรบันทึกให้สม่ำเสมอขึ้น' : 'ข้อมูลยังน้อย ผลวิเคราะห์อาจไม่นิ่ง');
  renderWellnessSummary('wellness-week-summary', wellnessSummaryRows(recent7, previous7));
  renderWellnessSummary('wellness-month-summary', wellnessSummaryRows(thisMonth, previousMonth));
  renderWellnessAlerts(all);
  renderWellnessCalendar(all);

  const labels = records.map(record => record.date.slice(5));
  const colors = getChartColors();
  const xScale = {grid:{display:false},ticks:{color:colors.tick,maxTicksLimit:8,font:{size:9}}};
  replaceWellnessChart('wellnessRecovery', 'chart-wellness-recovery', {
    type:'line',
    data:{labels,datasets:[
      {label:'Recovery',data:records.map(calculateRecoveryScore),borderColor:'#34C759',backgroundColor:'rgba(52,199,89,.12)',fill:true,tension:.3,yAxisID:'y'},
      {label:'Sleep h',data:records.map(r => r.sleepHours),borderColor:'#007AFF',backgroundColor:'transparent',tension:.3,spanGaps:true,yAxisID:'y1'}
    ]},
    options:wellnessChartOptions({scales:{
      x:xScale,
      y:{min:0,max:100,grid:{color:colors.grid},ticks:{color:colors.tick,font:{size:9}}},
      y1:{min:0,max:12,position:'right',grid:{display:false},ticks:{color:colors.tick,font:{size:9}}}
    }})
  });
  replaceWellnessChart('wellnessVitals', 'chart-wellness-vitals', {
    type:'line',
    data:{labels,datasets:[
      {label:'HRV ms',data:records.map(r => r.hrv),borderColor:'#AF52DE',tension:.3,spanGaps:true,yAxisID:'y'},
      {label:'Resting HR',data:records.map(r => r.restingHR),borderColor:'#FF3B30',tension:.3,spanGaps:true,yAxisID:'y1'}
    ]},
    options:wellnessChartOptions({scales:{
      x:xScale,
      y:{position:'left',grid:{color:colors.grid},ticks:{color:colors.tick,font:{size:9}}},
      y1:{position:'right',grid:{display:false},ticks:{color:colors.tick,font:{size:9}}}
    }})
  });
  replaceWellnessChart('wellnessFeeling', 'chart-wellness-feeling', {
    type:'line',
    data:{labels,datasets:[
      {label:'Fatigue',data:records.map(r => r.fatigue),borderColor:'#FF9500',tension:.3,spanGaps:true},
      {label:'Stress',data:records.map(r => r.stress),borderColor:'#FF3B30',tension:.3,spanGaps:true},
      {label:'Pain',data:records.map(r => r.soreness),borderColor:'#AF52DE',tension:.3,spanGaps:true}
    ]},
    options:wellnessChartOptions({scales:{
      x:xScale,
      y:{min:0,max:10,grid:{color:colors.grid},ticks:{stepSize:2,color:colors.tick,font:{size:9}}}
    }})
  });
  const loadByDate = {};
  getAllActivities().forEach(workout => {
    loadByDate[workout.date] = (loadByDate[workout.date] || 0) + sessionLoad(workout);
  });
  replaceWellnessChart('wellnessLoad', 'chart-wellness-load', {
    type:'bar',
    data:{labels,datasets:[
      {label:'Training load',data:records.map(r => loadByDate[r.date] || 0),backgroundColor:'rgba(255,77,0,.45)',borderRadius:4,yAxisID:'y1'},
      {type:'line',label:'Recovery',data:records.map(calculateRecoveryScore),borderColor:'#34C759',backgroundColor:'#34C759',tension:.3,yAxisID:'y'}
    ]},
    options:wellnessChartOptions({scales:{
      x:xScale,
      y:{min:0,max:100,grid:{color:colors.grid},ticks:{color:colors.tick,font:{size:9}}},
      y1:{position:'right',beginAtZero:true,grid:{display:false},ticks:{color:colors.tick,font:{size:9}}}
    }})
  });
}
