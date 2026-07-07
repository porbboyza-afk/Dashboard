// Race and race banner logic extracted from index.html.
async function renderDashRaceBanner() {
  const banner = document.getElementById('dash-race-banner');
  if (!banner) return;
  try {
    const races = await getAllRaceEntries();
    const today = new Date(); today.setHours(0,0,0,0);
    const upcoming = races
      .filter(r => r.date && new Date(r.date+'T00:00:00') >= today)
      .sort((a,b) => (a.date||'').localeCompare(b.date||''));
    if (!upcoming.length) { banner.style.display = 'none'; return; }
    const next = upcoming[0];
    const daysLeft = Math.ceil((new Date(next.date+'T00:00:00') - today) / 86400000);
    const urgencyColor = daysLeft <= 14 ? 'var(--red)' : daysLeft <= 30 ? 'var(--orange)' : 'var(--accent)';
    const urgencyBg = daysLeft <= 14 ? 'rgba(255,59,48,.08)' : daysLeft <= 30 ? 'rgba(255,149,0,.08)' : 'rgba(0,122,255,.06)';
    banner.style.display = 'block';
    banner.innerHTML = `<div style="background:${urgencyBg};border:1.5px solid ${urgencyColor};border-radius:var(--r-lg);padding:14px 16px;display:flex;align-items:center;gap:14px;cursor:pointer" onclick="showPage('coach');switchCoachTab('race',null)">
      <div style="font-size:28px;line-height:1">🏁</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${next.name}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px">${new Date(next.date+'T00:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'})} · ${next.dist||10}K</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-family:var(--font-mono);font-size:26px;font-weight:800;line-height:1;color:${urgencyColor}">${daysLeft}</div>
        <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">วันที่เหลือ</div>
      </div>
    </div>
    ${upcoming.length > 1 ? `<div style="font-size:10px;color:var(--text3);margin-top:6px;text-align:right">+ อีก ${upcoming.length-1} งาน · <span style="color:var(--accent);cursor:pointer" onclick="showPage('coach');switchCoachTab('race',null)">ดูทั้งหมด →</span></div>` : ''}`;
  } catch(e) { banner.style.display = 'none'; }
}

// ── MINI WEEK STRIP (removed) ──

let _races = [];

function coachPlanRaceEntry(plan=window._coachPlan){
  if(!plan?.endDate)return null;
  const goalProfile=plan.goalProfile||{};
  const distKm=raceDistanceKm(goalProfile.distance||'10K');
  const goalTime=goalProfile.targetTime||'';
  const name=plan.goal||`${goalProfile.distance||'10K'} goal race`;
  return {
    id:'coach-plan-race',
    name,
    date:plan.endDate,
    dist:+distKm.toFixed(1),
    goal:goalTime,
    source:'coach_plan',
    sourceLabel:'จากแผนซ้อมปัจจุบัน',
    createdAt:plan.createdAt||0
  };
}

function mergeRaceEntries(savedRaces=[],plan=window._coachPlan){
  const rows=Array.isArray(savedRaces)?savedRaces:Object.values(savedRaces||{});
  const planRace=coachPlanRaceEntry(plan);
  const merged=[...rows.filter(Boolean)];
  if(planRace&&!merged.some(r=>r.date===planRace.date&&Math.abs((parseFloat(r.dist)||0)-planRace.dist)<0.2)){
    merged.unshift(planRace);
  }
  return merged.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
}

async function getAllRaceEntries(){
  let saved=[];
  try{
    const data=await window._fb.getData('races');
    saved=data?(Array.isArray(data)?data:Object.values(data)):[];
  }catch(e){saved=[];}
  return mergeRaceEntries(saved,window._coachPlan);
}

function raceTrainingReadiness(r,all,today){
  const dist=parseFloat(r.dist)||10;
  const recentActs=all.filter(w=>{
    const d=new Date((w.date||'')+'T00:00:00');
    return !isNaN(d)&&(today-d)<=28*86400000&&d<=today;
  });
  const avgWeeklyDist=recentActs.reduce((sum,w)=>sum+parseFloat(w.dist||0),0)/4;
  const planStart=window._coachPlan?.startDate||'';
  const isPlanRace=r.source==='coach_plan'&&!!planStart;
  const planStartDate=planStart?new Date(planStart+'T00:00:00'):null;
  const planStarted=!isPlanRace||!planStartDate||planStartDate<=today;
  const planActs=isPlanRace&&planStartDate
    ? all.filter(w=>{
        const d=new Date((w.date||'')+'T00:00:00');
        return !isNaN(d)&&d>=planStartDate&&d<=today;
      })
    : recentActs;
  const hasPlanTraining=!isPlanRace||planActs.length>0;
  const score=Math.min(100,Math.round((avgWeeklyDist/(dist*0.6))*100));
  if(!planStarted){
    return {score:0,avgWeeklyDist,color:'var(--text3)',label:'ยังไม่เริ่มแผน',note:`แผนเริ่ม ${planStart} · ใช้ข้อมูลย้อนหลังเป็นฐานตั้งต้นเท่านั้น`};
  }
  if(!hasPlanTraining){
    return {score:Math.min(score,45),avgWeeklyDist,color:'var(--orange)',label:'ยังไม่เริ่มซ้อมตามแผน',note:`ฐานวิ่งย้อนหลัง ${avgWeeklyDist.toFixed(1)} km/สัปดาห์ · ยังไม่มี workout หลังวันเริ่มแผน`};
  }
  const color=score>=80?'var(--green)':score>=50?'var(--orange)':'var(--red)';
  const label=score>=80?'ฐานวิ่งดี':'กำลังสร้างฐาน';
  const note=`ซ้อมในแผนแล้ว ${planActs.length} ครั้ง · ฐาน 4 สัปดาห์ ${avgWeeklyDist.toFixed(1)} km/สัปดาห์`;
  return {score,avgWeeklyDist,color,label,note};
}

async function loadRaces() {
  try {
    const data = await window._fb.getData('races');
    const saved = data ? (Array.isArray(data) ? data : Object.values(data)) : [];
    _races = mergeRaceEntries(saved, window._coachPlan);
  } catch(e) { _races = []; }
  renderRaceList();
}

async function addRace() {
  const name = document.getElementById('race-name-in')?.value?.trim();
  const date = document.getElementById('race-date-in')?.value;
  const dist = document.getElementById('race-dist-in')?.value;
  const goal = document.getElementById('race-goal-in')?.value?.trim();
  if (!name || !date) { showToast('กรุณาใส่ชื่อและวันที่', 'error'); return; }
  const race = { id: Date.now(), name, date, dist: parseFloat(dist)||10, goal, createdAt: Date.now() };
  const savedRaces=_races.filter(r=>r.source!=='coach_plan');
  savedRaces.push(race);
  savedRaces.sort((a,b) => (a.date||'').localeCompare(b.date||''));
  await window._fb.setData('races', savedRaces);
  _races=mergeRaceEntries(savedRaces,window._coachPlan);
  // Clear inputs
  ['race-name-in','race-date-in','race-goal-in'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  showToast('บันทึกการแข่งขันแล้ว ✅');
  renderRaceList();
}

async function deleteRace(id) {
  const savedRaces = _races.filter(r => r.source!=='coach_plan' && r.id !== id);
  await window._fb.setData('races', savedRaces);
  _races=mergeRaceEntries(savedRaces,window._coachPlan);
  renderRaceList();
}

function renderRaceList() {
  const el = document.getElementById('race-list-container');
  if (!el) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = toLocalDateStr(today);
  if (!_races.length) { el.innerHTML = '<p class="text-sm c2" style="text-align:center;padding:24px">ยังไม่มีการแข่งขัน — เพิ่มด้านบนได้เลย 🏁</p>'; return; }

  const all = getAllActivities();
  el.innerHTML = _races.map(r => {
    const raceDate = new Date(r.date + 'T00:00:00');
    const daysLeft = Math.ceil((raceDate - today) / 86400000);
    const isPast = daysLeft < 0;
    const dist = parseFloat(r.dist) || 10;

    const training = raceTrainingReadiness(r, all, today);
    const prs = computePR(all);

    // Predict finish time from best pace
    let predictedTime = null;
    const bestPace = prs['10k']?.pace || prs['5k']?.pace;
    if (bestPace) {
      // Add ~5% fatigue factor per doubling of distance beyond 5K
      const factor = 1 + Math.max(0, Math.log2(dist/5)) * 0.04;
      predictedTime = bestPace * factor * dist;
    }
    const formatTime = mins => {
      const h = Math.floor(mins/60), m = Math.floor(mins%60), s = Math.round((mins%1)*60);
      return h>0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
    };

    // Readiness score 0-100
    const readiness = training.score;
    const readColor = readiness >= 80 ? 'var(--green)' : readiness >= 50 ? 'var(--orange)' : 'var(--red)';
    const readLabel = training.label;

    const countdownColor = isPast ? 'var(--text3)' : daysLeft <= 14 ? 'var(--red)' : daysLeft <= 30 ? 'var(--orange)' : 'var(--accent)';

    return `<div class="card mb-16" style="border-left:4px solid ${countdownColor}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
        <div>
          <div style="font-size:16px;font-weight:800">${r.name}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:3px">${new Date(r.date+'T00:00:00').toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'long',year:'numeric'})} · ${dist}K</div>
          ${r.source==='coach_plan'?`<div class="tag tag-blue" style="margin-top:7px">จากแผนซ้อมปัจจุบัน</div>`:''}
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <div style="text-align:right">
            <div style="font-family:var(--font-mono);font-size:28px;font-weight:800;line-height:1;color:${countdownColor}">${isPast ? 'เสร็จแล้ว' : daysLeft}</div>
            ${!isPast ? `<div style="font-size:10px;color:var(--text3)">วันที่เหลือ</div>` : ''}
          </div>
          ${r.source==='coach_plan'?'':`<button onclick="deleteRace(${r.id})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:4px">✕</button>`}
        </div>
      </div>
      ${!isPast ? `
      <!-- Readiness -->
      <div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)">สถานะแผน / ฐานซ้อม</div>
          <div style="font-size:12px;font-weight:700;color:${readColor}">${readLabel}</div>
        </div>
        <div style="height:8px;background:var(--bg2);border-radius:99px;overflow:hidden;margin-bottom:6px">
          <div style="height:100%;border-radius:99px;background:${readColor};width:${readiness}%;transition:width .5s"></div>
        </div>
        <div style="font-size:10px;color:var(--text3)">${training.note}</div>
      </div>
      <!-- Prediction -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${predictedTime ? `<div style="background:var(--bg);border-radius:10px;padding:10px 12px">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">เวลาที่คาดการณ์</div>
          <div style="font-family:var(--font-mono);font-size:18px;font-weight:800;color:var(--accent)">${formatTime(predictedTime)}</div>
          <div style="font-size:9px;color:var(--text3);margin-top:2px">จาก PR ปัจจุบัน</div>
        </div>` : ''}
        ${r.goal ? `<div style="background:var(--bg);border-radius:10px;padding:10px 12px">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">เป้าหมาย</div>
          <div style="font-family:var(--font-mono);font-size:18px;font-weight:800;color:var(--orange)">${r.goal}</div>
        </div>` : ''}
      </div>` : `<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">งานแข่งขันผ่านไปแล้ว</div>`}
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════
// HOOK into showPage + renderWeekStats
// ══════════════════════════════════════════════
// Calendar+Race are inline on dashboard, no separate page needed

// Patch renderWeekStats to also render pace trend + effort
const _origRWS = renderWeekStats;
renderWeekStats = function() {
  _origRWS.apply(this, arguments);
  // Render pace trend (uses all-time data)
  setTimeout(renderPaceTrend, 100);
  // Render effort score for the selected week
  const days = getWeekDates(_statsWeekOffset);
  const ds0 = toLocalDateStr(days[0]), ds6 = toLocalDateStr(days[6]);
  const wActs = getAllActivities().filter(w => (w.date||'') >= ds0 && (w.date||'') <= ds6);
  setTimeout(() => renderEffortScore(wActs), 100);
};


function showRaceAddPanel() {
  if (document.getElementById('race-add-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'race-add-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:910;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:16px';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:var(--r-xl);padding:22px;width:100%;max-width:400px;box-shadow:var(--shadow-lg)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:16px;font-weight:800">🏁 เพิ่มการแข่งขัน</div>
        <button onclick="document.getElementById('race-add-overlay').remove()" style="background:var(--bg2);border:none;border-radius:8px;color:var(--text2);font-size:16px;cursor:pointer;padding:4px 10px">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="form-group" style="margin:0"><label>ชื่องานแข่ง</label><input id="race-name-in" type="text" placeholder="เช่น Bangkok Marathon 2026"></div>
        <div class="form-group" style="margin:0"><label>วันที่แข่ง</label><input id="race-date-in" type="date"></div>
        <div class="form-group" style="margin:0"><label>ระยะทาง</label>
          <select id="race-dist-in" style="width:100%;padding:10px 12px;border-radius:var(--r);border:1.5px solid var(--border2);background:var(--bg);color:var(--text);font-size:14px">
            <option value="5">5K</option><option value="10" selected>10K</option>
            <option value="21.1">Half Marathon (21.1K)</option><option value="42.2">Full Marathon (42.2K)</option>
          </select>
        </div>
        <div class="form-group" style="margin:0"><label>เป้าเวลา (ไม่บังคับ)</label><input id="race-goal-in" type="text" placeholder="เช่น 50:00"></div>
      </div>
      <button class="btn btn-primary w100" style="margin-top:16px" onclick="addRace();document.getElementById('race-add-overlay')?.remove()">💾 บันทึก</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}
// ── END CALENDAR/RACE/TREND ──
// ── END NEW FEATURES ──
// ── STAT INFO MODAL ──
