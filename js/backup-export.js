// Apps Script backup and export/import logic extracted from index.html.
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxyYeWVjX5VlNbusJ_nUlu4k6tEk2Jd5P9IP3VocAjiFH8ZUIXda6S8HeME6W6_s_PvFg/exec';
window.DEFAULT_GAS_URL = DEFAULT_GAS_URL;

async function saveBackupSettings() {
  const url = document.getElementById('set-gas-url').value.trim();
  const token = document.getElementById('set-gas-token').value.trim();
  if (url && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
    showToast('URL ต้องเป็น Apps Script Web App ที่ลงท้าย /exec', 'error'); return;
  }
  const cfg = await window._fb.getData('settings') || {};
  cfg.gasUrl = url; cfg.gasToken = token;
  await window._fb.setData('settings', cfg);
  showToast('✅ Backup settings saved');
}

async function getBackupSettings() {
  if (!window._fb?.getData) {
    return { url: DEFAULT_GAS_URL, token: '' };
  }
  const cfg = await window._fb.getData('settings') || {};
  return { url: cfg.gasUrl || DEFAULT_GAS_URL, token: cfg.gasToken || '' };
}

async function sendSheetsBackup(type, data, silent=false) {
  const {url, token} = await getBackupSettings();
  if (!url) { if (!silent) showToast('ยังไม่ได้ตั้งค่า Apps Script URL', 'error'); return false; }
  const queuedPayload={action:'upsert',type,data},payload={token,...queuedPayload};
  if(!navigator.onLine){queueSheetsBackup(queuedPayload);if(!silent)showToast('ออฟไลน์: เก็บเข้าคิวรอซิงก์','warn');return false;}
  try{
    await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},mode:'no-cors',body:JSON.stringify(payload)});
    localStorage.setItem('mydash-last-sheets-sync',String(Date.now()));
    if(document.getElementById('page-today')?.classList.contains('active'))renderDashboardSyncStatus();
    return true;
  }catch(e){queueSheetsBackup(queuedPayload);if(!silent)showToast('ส่งไม่สำเร็จ: เก็บเข้าคิวแล้ว','warn');return false;}
}
function queueSheetsBackup(payload){
  const q=JSON.parse(localStorage.getItem('mydash-sync-queue')||'[]');q.push(payload);
  localStorage.setItem('mydash-sync-queue',JSON.stringify(q.slice(-500)));renderSyncStatus();
}
async function flushSheetsQueue(){
  if(!navigator.onLine)return;
  if(!window._fb?.getData)return;
  const {url,token}=await getBackupSettings();if(!url)return;
  const q=JSON.parse(localStorage.getItem('mydash-sync-queue')||'[]');if(!q.length)return;
  const remaining=[];
  for(const payload of q){try{await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},mode:'no-cors',body:JSON.stringify({token,...payload})});}catch(e){remaining.push(payload);}}
  localStorage.setItem('mydash-sync-queue',JSON.stringify(remaining));renderSyncStatus();
}
function renderSyncStatus(){
  const q=JSON.parse(localStorage.getItem('mydash-sync-queue')||'[]');
  const el=document.getElementById('gas-status');
  if(el&&q.length)el.innerHTML=`<span style="color:var(--orange)">⏳ รอซิงก์ ${q.length} รายการ</span>`;
}
renderSyncStatus();
setTimeout(flushSheetsQueue,1500);
window.addEventListener('online',()=>{flushSheetsQueue();showToast('กลับมาออนไลน์ กำลังซิงก์ข้อมูล...');});

async function testSheetsBackup() {
  const status = document.getElementById('gas-status');
  try {
    if (status) status.textContent = 'Testing...';
    await sendSheetsBackup('ping', {date:toLocalDateStr(), createdAt:Date.now()});
    if (status) status.innerHTML = '<span style="color:var(--green)">✓ ส่งคำขอทดสอบแล้ว กรุณาตรวจชีต System_Log</span>';
  } catch(e) {
    if (status) status.innerHTML = `<span style="color:var(--red)">✕ ${e.message}</span>`;
  }
}

async function syncAllToSheets() {
  showLoading('Syncing to Google Sheets...');
  try {
    for (const w of AppState.get('workouts')) await sendSheetsBackup('workout', {...w, _key:undefined}, true);
    for (const w of AppState.get('wellness')) await sendSheetsBackup('wellness', {...w, _key:undefined}, true);
    showToast('✅ Sync completed');
  } catch(e) { showToast('Sync failed: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

async function exportMyDashJSON() {
  let stravaActivities=[],stravaDetails={};
  try{
    const activities=await window._fb.getData('strava_activities');
    stravaActivities=activities?(Array.isArray(activities)?activities:Object.values(activities)):[];
    stravaDetails=await window._fb.getData('strava_activity_details')||{};
  }catch(error){console.warn('Strava backup:',error);}
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 'MyDash Health Intelligence V4',
    workouts: AppState.get('workouts').map(({_key,...v})=>v),
    wellness: AppState.get('wellness').map(({_key,...v})=>v),
    coachPlan: AppState.get('coachPlan'),
    stravaActivities,
    stravaDetails
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mydash-backup-${toLocalDateStr()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function csvCell(value){const s=typeof value==='object'?JSON.stringify(value??''):String(value??'');return `"${s.replace(/"/g,'""')}"`;}
function exportActivitiesCSV(){
  const rows=getAllActivities();
  const headers=['date','source','type','purpose','distance_km','time_min','avg_pace','avg_hr','cadence','rpe','session_load','shoe','surface','temperature','weather','pain','pain_location','feeling','note'];
  const lines=[headers.map(csvCell).join(',')];
  rows.forEach(w=>lines.push([w.date,w.source||'firebase',w.type,w.purpose,w.dist,w.time,w.avgPace?formatPace(w.avgPace):'',w.hr,w.cad,w.rpe,sessionLoad(w),w.shoe,w.surface,w.temperature,w.weather,w.pain,w.painLocation,w.feeling,w.note].map(csvCell).join(',')));
  const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`mydash-activities-${toLocalDateStr()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function restoreMyDashJSON(event){
  const file=event.target.files?.[0];if(!file)return;
  try{
    const payload=JSON.parse(await file.text());
    if(!Array.isArray(payload.workouts)&&!Array.isArray(payload.wellness))throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
    if(!confirm(`นำกลับ ${payload.workouts?.length||0} activities และ ${payload.wellness?.length||0} wellness records? ข้อมูลวันที่ซ้ำจะถูกอัปเดต`))return;
    showLoading('Restoring backup...');
    for(const w of payload.workouts||[]){
      const raw=`${w.date||'unknown'}|${w.createdAt||''}|${w.type||''}|${w.dist||''}|${w.time||''}`;
      const id='restore-'+btoa(unescape(encodeURIComponent(raw))).replace(/[^a-z0-9]/gi,'').slice(0,60);
      await window._fb.setData(`workouts/${id}`,w);
    }
    for(const w of payload.wellness||[])if(w.date)await window._fb.setData(`wellness/${w.date}`,w);
    if(payload.coachPlan?.engineVersion===2&&window.MyDashCoachRepository)await window.MyDashCoachRepository.savePlan(payload.coachPlan);
    else if(payload.coachPlan)await window._fb.setData('coach_plan',payload.coachPlan);
    if(Array.isArray(payload.stravaActivities))await window._fb.setData('strava_activities',payload.stravaActivities);
    if(payload.stravaDetails&&typeof payload.stravaDetails==='object')await window._fb.setData('strava_activity_details',payload.stravaDetails);
    showToast('✅ Restore completed');
  }catch(e){showToast('Restore failed: '+e.message,'error');}
  finally{hideLoading();event.target.value='';}
}

// ── INIT ──
document.getElementById('today-date-label').textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
