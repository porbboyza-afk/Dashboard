import {loadSnapshot} from './adapters/snapshot.mjs';
import {healthExport,compareHealthBackup} from './domain/export.mjs';
import {backupPayload, activitiesCsv, inspectBackup} from './domain/backup.mjs';
import {buildModel, localDate, dataMode} from './domain/model.mjs';
import {freshnessNotice} from './domain/freshness.mjs';
import {escape as e, dateLabel} from './ui/format.mjs';
import {icon} from './ui/icons.mjs';
import {home} from './features/home.mjs';
import {workouts, activityDetail, intervalDetail} from './features/activities.mjs';
import {progress, health, plan, more, connections, backup} from './features/overview.mjs';
import {healthForm, healthFields, healthExtraFields, workoutForm, workoutContextFields, workoutIntervalFields, workoutSplitRow, workoutSplitsDisclosure, planSessionRow} from './ui/forms.mjs';
import {workoutFields, workoutPatch, wellnessPatch} from './domain/forms.mjs';
import {intervalSummary} from './domain/interval.mjs';
import {createManualPlan, summarizeDraftPlan, parsePlanFileContent} from './domain/manual-plan.mjs';
import {activityRow} from './ui/components.mjs';
import {shareView,bindShare} from './features/share.mjs';
import {races,settings,bindPersonal} from './features/personal.mjs';
import {bindRestore} from './features/restore.mjs';
import {registerPwa} from './ui/pwa.mjs';
import {sheetsView,bindSheets} from './features/sheets.mjs';

const main=document.querySelector('main');
let model=null;
let freshness='loading';
function showLoadError(message) {
  freshness=model ? 'stale' : 'error';
  document.querySelector('#connection-label').textContent=model ? 'ข้อมูลเก่า · Firebase ยังตอบไม่ได้' : 'ยังอ่านข้อมูลไม่ได้';
  const detail=message === 'Failed to fetch' ? 'เชื่อมต่อ Firebase ไม่ได้ กรุณาตรวจเครือข่ายแล้วลองใหม่' : message;
  document.querySelector('#data-notice').textContent=freshnessNotice(freshness,model?.readAt,detail);
  if (!model || main.querySelector('.loading-state')) main.innerHTML=`<section class="card empty"><h1>โหลด MyDash ไม่สำเร็จ</h1><p class="muted">${e(detail)}</p><button type="button" class="button" id="retry-load">ลองใหม่</button></section>`;
}
function markFresh(snapshot, notice) {
  model=buildModel(snapshot);
  freshness='fresh';
  document.querySelector('#connection-label').textContent=user ? 'MyDash Cloud · เชื่อมต่อแล้ว' : 'ข้อมูลจริง · สำเนาในเครื่อง';
  document.querySelector('#data-notice').textContent=notice;
}
function requireFreshCloud() {
  if(!navigator.onLine)throw new Error('ขณะนี้ออฟไลน์ กรุณาเชื่อมต่อและอ่านข้อมูลใหม่ก่อนบันทึก');
  if (!cloud || !user) throw new Error('กรุณาเข้าสู่ระบบก่อนบันทึก');
  if (freshness!=='fresh') throw new Error('ยังยืนยันข้อมูล Cloud ล่าสุดไม่ได้ จึงยังไม่บันทึกเพื่อป้องกันข้อมูลทับกัน');
}
main.addEventListener('click',event=>{if(event.target.closest('#retry-load')) location.reload();});
let period='week';
let sharePeriod='month';
let shareDate=localDate();
let periodDate=localDate();
let search='';
let preferences={};
let cloud=null;
let cloudReady=null;
let stopCloud=null;
let user=null;
let busy=false;
let healthBaseline={};
let workoutBaseline=null;
let accountGeneration=0;
const currentMode=dataMode(location, typeof localStorage !== 'undefined' ? localStorage : null);
const snapshotMode=currentMode==='snapshot';
// The private snapshot is a deliberate QA mode only; normal use must never show stale local data.
let preferCloud=currentMode==='cloud';
registerPwa();
window.addEventListener('offline',()=>showLoadError('ขณะนี้ออฟไลน์ ข้อมูลที่แสดงอาจเก่า กรุณาต่ออินเทอร์เน็ตและกดอ่านใหม่ก่อนบันทึก'));
try {preferences=JSON.parse(localStorage.getItem('mydash.performance.preferences')) || {};} catch {}

function render({focus=false}={}) {
  const [route='home', encoded='']=location.hash.slice(1).split('/');
  const active=['activity','plan'].includes(route)?'workouts':['connections','backup','share','races','settings'].includes(route)?'more':route || 'home';
  document.querySelector('#main-navigation').innerHTML=[['home','home','Home'],['workouts','shoe','Workouts'],['health','heart','Health'],['progress','progress','Progress'],['more','user','More']].map(([key,name,label])=>`<a href="#${key}" ${active===key?'aria-current="page"':''}>${icon(name)}<span>${label}</span></a>`).join('');
  if (!model) return;
  let id='';
  try {id=decodeURIComponent(encoded);} catch {}
  const views={home:()=>home(model,preferences),workouts:()=>workouts(model,search),
    activity:()=>activityDetail(model,id),progress:()=>progress(model,period,periodDate),
    health:()=>health(model,id),plan:()=>plan(model),more:()=>more(model),connections:()=>connections(model),backup:()=>backup(model)};
  views.share=()=>shareView(model,sharePeriod,shareDate);
  views.races=()=>races(model);views.settings=()=>settings(model);
  try {main.innerHTML=(views[route] || views.home)();}
  catch(error) {
    main.innerHTML=`<section class="card empty"><h1>เปิดหน้านี้ไม่สำเร็จ</h1><p class="muted">${e(error.message)}</p><a class="button" href="#home">กลับหน้า Home</a></section>`;
    document.querySelector('#data-notice').textContent='เกิดข้อผิดพลาดในการแสดงหน้านี้';
    main.dataset.page=route;
    return;
  }
  main.dataset.page=route;
  if(route==='connections')main.insertAdjacentHTML('afterbegin','<section class="card"><h2>การซิงก์ที่ใช้งานอยู่</h2><p>Huawei Health → COROS → COROS Sync Bridge บน Windows → MyDash</p><p>เว็บนี้อ่านผลซิงก์ ไม่ได้สั่งตัวเชื่อมบน Windows ให้ทำงาน กด “อ่านใหม่” ด้านบนเพื่อรับข้อมูลล่าสุด หากต้องสั่งซิงก์ให้ใช้ทางลัด Sync COROS to MyDash บนเครื่องที่ติดตั้งตัวเชื่อม</p><p>ตัวเชื่อมต้องเปิดเครื่อง ลงชื่อเข้าใช้ Windows และออนไลน์ ปกติอ่านย้อนหลัง 9 วัน; การกู้ช่วงที่ขาดรองรับสูงสุด 30 วัน ไม่ดึงสุขภาพหรือ GPS ส่วน Health Connect เป็นอีกแหล่งข้อมูล ไม่ใช่ปุ่มซิงก์ COROS</p></section>');
  if(route==='settings'){main.insertAdjacentHTML('beforeend',sheetsView());bindSheets({cloud:()=>cloud,requireCloud:requireFreshCloud,model,onBusy:value=>busy=value});}
  workoutBaseline=null;
  const parents={plan:['workouts','กิจกรรม'],connections:['more','เพิ่มเติม'],backup:['more','เพิ่มเติม']};
  parents.share=['more','เพิ่มเติม'];
  parents.races=['more','เพิ่มเติม'];parents.settings=['more','เพิ่มเติม'];
  if(route==='more') main.querySelector('.menu-list').insertAdjacentHTML('beforeend','<a href="#races"><span><strong>การแข่งขัน</strong><small>วันแข่งและเป้าเวลา</small></span></a><a href="#settings"><span><strong>โปรไฟล์นักกีฬา</strong><small>ข้อมูลส่วนตัวและโซนการฝึก</small></span></a>');
  bindPersonal(model,{cloud:()=>cloud,save:async(form,operation)=>{
    const status=form.querySelector('.form-status');const controls=[...form.querySelectorAll('button')];
    try{requireFreshCloud();const generation=accountGeneration;busy=true;controls.forEach(b=>b.disabled=true);await operation();const snapshot=await cloud.readSnapshot();if(generation!==accountGeneration)throw new Error('บัญชีเปลี่ยน กรุณาอ่านข้อมูลใหม่');markFresh(snapshot,'บันทึกและอ่านกลับแล้ว');render();}
    catch(error){status.textContent=error.message;}finally{busy=false;controls.forEach(b=>b.disabled=false);}
  }});
  if(route==='more') main.querySelector('.menu-list').insertAdjacentHTML('beforeend','<a href="#share"><span><strong>แชร์สถิติ</strong><small>พรีวิวและดาวน์โหลดภาพสรุปกิจกรรม</small></span></a>');
  if(route==='share') bindShare(model,sharePeriod,shareDate,(period,date)=>{sharePeriod=period;shareDate=date;render();});
  if (route==='health' && id) parents.health=['health','สุขภาพ'];
  if (parents[route]) {
    const [destination,label]=parents[route];
    main.insertAdjacentHTML('afterbegin',`<a href="#${destination}" class="back-link">${icon('back')} กลับไป${label}</a>`);
  }
  if (route==='health') {
    healthBaseline=model.wellness.find(row=>row.date===localDate()) || {};
    main.querySelector('.metrics')?.insertAdjacentHTML('afterend',healthForm(healthBaseline));
  }
  if (route==='activity') {
    const activity=(model.rawActivities || model.activities).find(row=>row.id===id);
    workoutBaseline=activity?structuredClone(activity.raw):null;
    main.querySelector('.detail-metrics')?.insertAdjacentHTML('afterend',intervalDetail(activity));
    if (activity?.origin==='workouts') main.querySelector('.detail-metrics')?.insertAdjacentHTML('afterend',workoutForm(activity));
    const matched=model.matchedSources?.find(group=>group.primaryId===id || group.otherId===id);
    if (matched) {
      const otherId=matched.primaryId===id?matched.otherId:matched.primaryId;
      const other=model.rawActivities.find(row=>row.id===otherId);
      main.querySelector('.review-card')?.insertAdjacentHTML('beforebegin',`<section class="card"><h2>ข้อมูลกิจกรรมจากอีกแหล่ง</h2><p class="muted">จับคู่ COROS กับ Health Sync จากวัน ประเภท ระยะ เวลา และ HR โดยนับระยะเพียงครั้งเดียว ข้อมูลต้นฉบับทั้งสองยังอยู่</p>${activityRow(other)}</section>`);
    }
  }
  const editType=workoutBaseline?.type;
  const typeSelect=main.querySelector('#workout-form [name="type"]');
  if (editType && typeSelect && ![...typeSelect.options].some(option=>option.value===editType)) {
    typeSelect.add(new Option(`ต้นฉบับ: ${editType}`,editType,true,true));
  }
  const workoutExtra=main.querySelector('#workout-extra');
  workoutExtra?.insertAdjacentHTML('afterbegin',workoutIntervalFields(workoutBaseline || {}));
  workoutExtra?.insertAdjacentHTML('afterbegin',workoutContextFields(workoutBaseline || {}));
  const isImported=['coros','health_connect','strava'].includes(workoutBaseline?.source || workoutBaseline?.origin);
  const isManualRun=!workoutBaseline || (!isImported && ['run','interval'].includes(workoutBaseline.type || 'run'));
  if (isManualRun && !main.querySelector('#manual-splits')) {
    workoutExtra?.insertAdjacentHTML('beforeend',workoutSplitsDisclosure(workoutBaseline?.splits || []));
  }
  document.querySelector('#activity-search')?.addEventListener('input',event=>{
    search=event.target.value;
    const position=event.target.selectionStart;
    render();
    const input=document.querySelector('#activity-search');input.focus();input.setSelectionRange(position,position);
  });
  document.querySelectorAll('[data-period]').forEach(button=>button.addEventListener('click',()=>{period=button.dataset.period;render();}));
  document.querySelectorAll('[data-week]').forEach(button=>button.addEventListener('click',()=>{period='week';periodDate=button.dataset.week;render();document.querySelector('.period-toolbar')?.scrollIntoView({block:'start'});}));
  document.querySelector('#period-date')?.addEventListener('change',event=>{if(event.target.value){periodDate=event.target.value;render();}});
  document.querySelector('[data-action="goal"]')?.addEventListener('click',()=>{
    document.querySelector('[name="weeklyGoal"]').value=preferences.weeklyGoal || '';
    document.querySelector('#goal-dialog').showModal();
  });
  bindForms();
  if (focus) {window.scrollTo(0,0);main.focus({preventScroll:true});}
}

async function load() {
  if (preferCloud && !user) {
    document.querySelector('#data-notice').textContent='กรุณาเข้าสู่ระบบเพื่ออ่านข้อมูลบัญชี';
    return;
  }
  const generation=accountGeneration;
  const button=document.querySelector('#reload-data');button.disabled=true;
  document.querySelector('#connection-label').textContent='กำลังอ่านข้อมูล';
  try {
    const snapshot=user ? await cloud.readSnapshot() : await loadSnapshot();
    if (generation!==accountGeneration) return;
    const nextModel=buildModel(snapshot);
    const timestamp=new Date(snapshot.readAt).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    model=nextModel;
    freshness='fresh';
    document.querySelector('#connection-label').textContent=user ? 'MyDash Cloud · เชื่อมต่อแล้ว' : 'ข้อมูลจริง · สำเนาในเครื่อง';
    document.querySelector('#data-notice').textContent=`อ่านจาก MyDash เมื่อ ${timestamp} · ตัวใหม่อยู่ระหว่างพัฒนา`;
    if (!document.querySelector('.entry-disclosure[open]')) render();
  } catch(error) {
    showLoadError(error.message);
  } finally {button.disabled=false;}
}

function bindForms() {
  document.querySelectorAll('[data-export-backup]').forEach(button=>button.addEventListener('click',()=>{
    const isCsv=button.dataset.exportBackup==='csv';
    const content=isCsv?activitiesCsv(model.activities):JSON.stringify(backupPayload(model),null,2);
    const url=URL.createObjectURL(new Blob([content],{type:isCsv?'text/csv;charset=utf-8':'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`mydash-${isCsv?'activities':'backup'}-${localDate()}.${isCsv?'csv':'json'}`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }));
  bindRestore({model,requireCloud:requireFreshCloud,save:async payload=>{
    requireFreshCloud();const generation=accountGeneration;busy=true;
    try{const report=await cloud.restoreBackup(payload);const snapshot=await cloud.readSnapshot();
      if(generation!==accountGeneration)throw new Error('บัญชีเปลี่ยน กรุณาอ่านข้อมูลใหม่');
      markFresh(snapshot,'กู้คืนเฉพาะรายการที่หายและอ่านกลับแล้ว');render();return report;
    }finally{busy=false;}
  }});
  document.querySelectorAll('[data-export-health]').forEach(button=>button.addEventListener('click',()=>{
    const file=healthExport(model.wellness,button.dataset.exportHealth);
    const url=URL.createObjectURL(new Blob([file.content],{type:file.mime}));
    const link=document.createElement('a');link.href=url;link.download=`mydash-health-${localDate()}.${file.extension}`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }));
  document.querySelector('#health-compare-file')?.addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    const output=document.querySelector('#health-compare-result');
    try {
      const rows=compareHealthBackup(await file.text(),model.wellness);
      const differences=rows.filter(row=>row.missing||row.changes.length);
      output.innerHTML=`<p>ตรวจ ${rows.length} วัน · ตรงกัน ${rows.length-differences.length} วัน · ต่างกัน ${differences.length} วัน</p>`+
        differences.map(row=>`<details><summary>${e(row.date)} · ${row.missing?'ไม่มีในแอปใหม่':row.changes.length+' ค่าต่างกัน'}</summary><div class="table-scroll"><table><thead><tr><th>ข้อมูล</th><th>ไฟล์แอปเก่า</th><th>แอปใหม่</th></tr></thead><tbody>${row.changes.map(change=>`<tr><td>${e(change.field)}</td><td>${e(JSON.stringify(change.before) ?? '—')}</td><td>${e(JSON.stringify(change.after) ?? '—')}</td></tr>`).join('')}</tbody></table></div></details>`).join('');
    } catch(error) {output.textContent=error.message;}
  });
  const workoutType=document.querySelector('#workout-form [name="type"]');
  const workoutDistance=document.querySelector('#workout-form [name="dist"]');
  if (workoutType && workoutDistance) {
    const workoutTime=document.querySelector('#workout-form [name="time"]');
    const workoutHr=document.querySelector('#workout-form [name="hr"]');
    const intervalFields=document.querySelector('#interval-fields');
    const preview=document.querySelector('#interval-preview');
    const syncDistanceRequirement=()=>{
      const interval=workoutType.value==='interval';
      workoutDistance.required=!interval && workoutType.value!=='strength';
      workoutTime.required=!interval;
      workoutDistance.readOnly=interval;
      workoutTime.readOnly=interval;
      workoutHr.readOnly=interval;
      intervalFields.hidden=!interval;
      const manualSplits=document.querySelector('#manual-splits');
      if (manualSplits) manualSplits.hidden=!['run','interval'].includes(workoutType.value);
      if (interval) updateIntervalPreview();
    };
    const updateIntervalPreview=()=>{
      if (workoutType.value!=='interval') return;
      try {
        const result=intervalSummary(Object.fromEntries(new FormData(workoutType.form)));
        if (!workoutBaseline?.interval || workoutType.form.dataset.intervalEdited==='true') {
          workoutDistance.value=result.dist;
          workoutTime.value=result.time;
          workoutHr.value=result.interval.repHR || '';
        }
        preview.textContent=`ผลรวม ${result.dist} km · ${result.time} นาที`;
      } catch(error) {
        if (!workoutBaseline?.interval || workoutType.form.dataset.intervalEdited==='true') {
          workoutDistance.value='';workoutTime.value='';
          workoutHr.value='';
        }
        preview.textContent=error.message;
      }
    };
    workoutType.addEventListener('change',syncDistanceRequirement);
    intervalFields.addEventListener('input',()=>{workoutType.form.dataset.intervalEdited='true';updateIntervalPreview();});
    syncDistanceRequirement();
  }
  const manualSplitsEl=document.querySelector('#manual-splits');
  if (manualSplitsEl) {
    const splitsList=manualSplitsEl.querySelector('#splits-list');
    const generateBtn=manualSplitsEl.querySelector('#btn-generate-splits');
    const addBtn=manualSplitsEl.querySelector('#btn-add-split');
    generateBtn?.addEventListener('click',()=>{
      const distInput=document.querySelector('#workout-form [name="dist"]');
      const dist=parseFloat(distInput?.value);
      if (!dist || dist<=0 || !Number.isFinite(dist)) {
        alert('กรุณาระบุระยะทางรวมก่อนสร้างช่องตามระยะ');
        return;
      }
      const totalRows=Math.ceil(dist);
      const existingPaces=[...splitsList.querySelectorAll('[name="splitPace"]')].map(i=>i.value);
      const existingHrs=[...splitsList.querySelectorAll('[name="splitHr"]')].map(i=>i.value);
      splitsList.innerHTML=Array.from({length:totalRows},(_,i)=>workoutSplitRow({
        km:i+1,pace:existingPaces[i] || '',hr:existingHrs[i] || ''
      },i)).join('');
    });
    addBtn?.addEventListener('click',()=>{
      const count=splitsList.querySelectorAll('.split-item').length;
      splitsList.insertAdjacentHTML('beforeend',workoutSplitRow({km:count+1,pace:'',hr:''},count));
    });
    splitsList?.addEventListener('click',event=>{
      const removeBtn=event.target.closest('[data-remove-split]');
      if (!removeBtn) return;
      removeBtn.closest('.split-item')?.remove();
      splitsList.querySelectorAll('.split-item').forEach((item,idx)=>{
        item.dataset.splitIndex=idx;
        const kmInput=item.querySelector('[name="splitKm"]');
        if (kmInput) kmInput.value=idx+1;
      });
    });
  }
  document.querySelectorAll('[data-collapse]').forEach(button=>button.addEventListener('click',()=>{
    button.closest('.entry-disclosure').open=false;
  }));
  document.querySelector('#health-form [name="date"]')?.addEventListener('change',event=>{
    healthBaseline=model.wellness.find(row=>row.date===event.target.value) || {};
    document.querySelector('#health-fields').innerHTML=healthFields(healthBaseline);
    document.querySelector('#health-extra').innerHTML=healthExtraFields(healthBaseline);
  });
  for (const id of ['workout-form','health-form']) document.getElementById(id)?.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.target;
    const status=form.querySelector('.form-status');
    if (!user || !cloud) {status.textContent='กรุณากดเข้าสู่ระบบก่อน ข้อมูลที่กรอกยังอยู่ในฟอร์ม';return;}
    if (freshness!=='fresh') {status.textContent='ยังยืนยันข้อมูล Cloud ล่าสุดไม่ได้ จึงยังไม่บันทึกเพื่อป้องกันข้อมูลทับกัน';return;}
    if (busy) return;
    const button=form.querySelector('[type="submit"]');
    try {
      busy=true;button.disabled=true;status.textContent='กำลังบันทึกและตรวจข้อมูลที่อ่านกลับ…';
      requireFreshCloud();const generation=accountGeneration;
      const formData=new FormData(form);
      const values=Object.fromEntries(formData);
      if (id==='workout-form') {
        if (form.querySelector('#manual-splits')) {
          values.splitKm=formData.getAll('splitKm');
          values.splitPace=formData.getAll('splitPace');
          values.splitHr=formData.getAll('splitHr');
        }
        // Retain the new key after a failed acknowledgement, so retry cannot duplicate it.
        if (!form.dataset.key) form.dataset.pendingKey ||= `manual_${crypto.randomUUID()}`;
        const fields=form.dataset.key ? workoutPatch(values,workoutBaseline,{intervalEdited:form.dataset.intervalEdited==='true'}) : workoutFields(values);
        await cloud.saveWorkout(fields,form.dataset.key || form.dataset.pendingKey,{create:!form.dataset.key});
      }
      else await cloud.saveWellness(wellnessPatch(values,healthBaseline),healthBaseline.key || values.date);
      const savedSnapshot=await cloud.readSnapshot();if(generation!==accountGeneration)throw new Error('บัญชีเปลี่ยน กรุณาอ่านข้อมูลใหม่');markFresh(savedSnapshot,'บันทึกสำเร็จและตรวจข้อมูลที่อ่านกลับแล้ว');
      form.closest('.entry-disclosure').open=false;
      render();
    } catch(error) {status.textContent=error.message || 'บันทึกไม่สำเร็จ';}
    finally {busy=false;button.disabled=false;}
  });

  const planForm=document.querySelector('#plan-form');
  const planSessionsList=document.querySelector('#plan-sessions-list');
  if (planForm && planSessionsList) {
    const getPlanDraftFromDOM=()=>{
      const dates=[...planForm.querySelectorAll('[name="sessionDate"]')].map(i=>i.value);
      const types=[...planForm.querySelectorAll('[name="sessionType"]')].map(i=>i.value);
      const dists=[...planForm.querySelectorAll('[name="sessionDist"]')].map(i=>i.value);
      const titles=[...planForm.querySelectorAll('[name="sessionTitle"]')].map(i=>i.value);
      const mainSets=[...planForm.querySelectorAll('[name="sessionMainSet"]')].map(i=>i.value);
      const warmups=[...planForm.querySelectorAll('[name="sessionWarmup"]')].map(i=>i.value);
      const cooldowns=[...planForm.querySelectorAll('[name="sessionCooldown"]')].map(i=>i.value);
      const notes=[...planForm.querySelectorAll('[name="sessionNotes"]')].map(i=>i.value);
      return dates.map((d,idx)=>({
        date:d,
        type:types[idx] || 'Easy',
        targetDist:dists[idx] || (types[idx]==='Rest'?0:5),
        title:titles[idx] || '',
        mainSet:mainSets[idx] || '',
        warmup:warmups[idx] || '',
        cooldown:cooldowns[idx] || '',
        notes:notes[idx] || ''
      }));
    };

    const updatePlanPreview=()=>{
      const draft=getPlanDraftFromDOM();
      const statsEl=document.querySelector('#plan-preview-stats');
      const contentEl=document.querySelector('#plan-preview-content');
      if (!contentEl) return;
      if (!draft.length) {
        if (statsEl) statsEl.textContent='—';
        contentEl.innerHTML='<p class="muted">ยังไม่มีเซสชัน กด "+ เพิ่มเซสชัน" เพื่อเริ่มกำหนดตารางฝึก</p>';
        return;
      }
      const summary=summarizeDraftPlan(draft);
      if (statsEl) statsEl.textContent=`${summary.totalWeeks} สัปดาห์ · รวม ${summary.totalDistanceKm} km`;
      if (summary.errors.length) {
        contentEl.innerHTML=`<p class="note" style="color:#b33c24;">พบข้อผิดพลาด: ${e(summary.errors[0])}</p>`;
        return;
      }
      contentEl.innerHTML=`<table><thead><tr><th>สัปดาห์</th><th>เริ่มสัปดาห์</th><th>เป้าระยะทาง</th><th>วันวิ่ง</th><th>วันพัก</th><th>เซสชัน</th></tr></thead><tbody>${summary.weeks.map(w=>`<tr><td>สัปดาห์ที่ ${w.week}</td><td>${dateLabel(w.startDate)}</td><td><strong>${w.targetVolumeKm} km</strong></td><td>${w.runningDays} วัน</td><td>${w.restDays} วัน</td><td>${w.sessions.map(s=>`<span class="source" style="margin-right:4px;">${e(s.type)} ${s.targetDist}k</span>`).join('')}</td></tr>`).join('')}</tbody></table>`;
    };

    const bindSessionEvents=rowEl=>{
      const typeSelect=rowEl.querySelector('[name="sessionType"]');
      const distInput=rowEl.querySelector('[name="sessionDist"]');
      typeSelect?.addEventListener('change',()=>{
        if (typeSelect.value==='Rest') {
          distInput.value=0;
          distInput.readOnly=true;
        } else {
          distInput.readOnly=false;
          if (Number(distInput.value)===0) distInput.value=5;
        }
        updatePlanPreview();
      });
      rowEl.addEventListener('input',updatePlanPreview);
      rowEl.querySelector('[data-remove-session]')?.addEventListener('click',()=>{
        rowEl.remove();
        planSessionsList.querySelectorAll('.session-item').forEach((item,idx)=>{
          item.dataset.sessionIndex=idx;
          const label=item.querySelector('strong');
          if (label) label.textContent=`เซสชันที่ ${idx+1}`;
        });
        updatePlanPreview();
      });
    };

    const addSession=(sessionData=null)=>{
      const existingItems=planSessionsList.querySelectorAll('.session-item');
      const index=existingItems.length;
      let nextDate=localDate();
      if (!sessionData && existingItems.length) {
        const lastDateInput=existingItems[existingItems.length-1].querySelector('[name="sessionDate"]');
        if (lastDateInput?.value) {
          const d=new Date(`${lastDateInput.value}T12:00:00`);
          d.setDate(d.getDate()+1);
          nextDate=localDate(d);
        }
      }
      const data=sessionData || {date:nextDate,type:'Easy',targetDist:5};
      planSessionsList.insertAdjacentHTML('beforeend',planSessionRow(data,index));
      const newRow=planSessionsList.lastElementChild;
      bindSessionEvents(newRow);
      updatePlanPreview();
    };

    document.querySelector('#plan-add-session')?.addEventListener('click',()=>addSession());

    if (!planSessionsList.children.length) {
      const today=new Date();
      for (let i=1;i<=3;i++) {
        const d=new Date(today);
        d.setDate(d.getDate()+i);
        addSession({date:localDate(d),type:i===3?'Long':'Easy',targetDist:i===3?10:5});
      }
    }

    planForm.addEventListener('submit',async event=>{
      event.preventDefault();
      const status=planForm.querySelector('.form-status');
      if (!user || !cloud) {status.textContent='เข้าสู่ระบบก่อนบันทึกแผน ข้อมูลในฟอร์มยังอยู่';return;}
      if (freshness!=='fresh') {status.textContent='ยังยืนยันข้อมูล Cloud ล่าสุดไม่ได้ จึงยังไม่บันทึกเพื่อป้องกันข้อมูลทับกัน';return;}
      if (busy) return;
      const button=planForm.querySelector('[type="submit"]');
      try {
        busy=true;button.disabled=true;
        status.textContent='กำลังตรวจสอบและสร้างตารางฝึก…';
        requireFreshCloud();const generation=accountGeneration;
        const draft=getPlanDraftFromDOM();
        const goal=planForm.querySelector('[name="planGoal"]')?.value || 'ตารางฝึกที่สร้างเอง';
        planForm.dataset.pendingPlanId ||= `manual_${crypto.randomUUID()}`;
        planForm.dataset.pendingCreatedAt ||= String(Date.now());
        const newPlan=createManualPlan(draft,{goal,id:planForm.dataset.pendingPlanId,createdAt:Number(planForm.dataset.pendingCreatedAt)});
        status.textContent='กำลังบันทึกลง MyDash Cloud…';
        await cloud.savePlan(newPlan);
        const saved=await cloud.readSnapshot();if(generation!==accountGeneration)throw new Error('บัญชีเปลี่ยน กรุณาอ่านข้อมูลใหม่');markFresh(saved,'เปิดใช้งานแผนใหม่สำเร็จและตรวจยืนยันข้อมูลแล้ว');
        planForm.closest('.entry-disclosure').open=false;
        render();
      } catch(err) {
        status.textContent=err.message || 'บันทึกแผนไม่สำเร็จ';
      } finally {
        busy=false;button.disabled=false;
      }
    });
  }

  const planImportForm=document.querySelector('#plan-import-form');
  const planFileInput=document.querySelector('#plan-file-input');
  if (planImportForm && planFileInput) {
    let importedDraftSessions=null;
    const previewCard=document.querySelector('#plan-import-preview-card');
    const previewStats=document.querySelector('#plan-import-stats');
    const previewContent=document.querySelector('#plan-import-preview-content');
    const goalInput=document.querySelector('#import-plan-goal');
    const submitBtn=document.querySelector('#btn-submit-import');
    const importStatus=planImportForm.querySelector('.form-status');

    planFileInput.addEventListener('change',async event=>{
      const file=event.target.files?.[0];
      if (!file) return;
      try {
        const text=await file.text();
        const parsed=parsePlanFileContent(text,file.name);
        importedDraftSessions=parsed.sessions;
        if (goalInput && !goalInput.value.trim() && parsed.goal) {
          goalInput.value=parsed.goal;
        }
        if (previewCard) previewCard.style.display='block';
        if (previewStats) previewStats.textContent=`${parsed.summary.totalWeeks} สัปดาห์ · ${parsed.summary.totalDistanceKm} km (${parsed.sessions.length} เซสชัน)`;
        if (parsed.summary.errors.length) {
          if (previewContent) previewContent.innerHTML=`<p class="note" style="color:#b33c24;">พบข้อผิดพลาดในไฟล์: ${e(parsed.summary.errors[0])}</p>`;
          if (submitBtn) submitBtn.disabled=true;
        } else {
          if (submitBtn) submitBtn.disabled=false;
          if (previewContent) previewContent.innerHTML=`<table><thead><tr><th>สัปดาห์</th><th>เริ่มสัปดาห์</th><th>เป้าระยะทาง</th><th>วันวิ่ง</th><th>วันพัก</th><th>เซสชัน</th></tr></thead><tbody>${parsed.summary.weeks.map(w=>`<tr><td>สัปดาห์ที่ ${w.week}</td><td>${dateLabel(w.startDate)}</td><td><strong>${w.targetVolumeKm} km</strong></td><td>${w.runningDays} วัน</td><td>${w.restDays} วัน</td><td>${w.sessions.map(s=>`<span class="source" style="margin-right:4px;">${e(s.type)} ${s.targetDist}k</span>`).join('')}</td></tr>`).join('')}</tbody></table>`;
        }
        if (importStatus) importStatus.textContent='';
      } catch(err) {
        if (previewCard) previewCard.style.display='block';
        if (previewStats) previewStats.textContent='เกิดข้อผิดพลาด';
        if (previewContent) previewContent.innerHTML=`<p class="note" style="color:#b33c24;">ไม่สามารถอ่านไฟล์ได้: ${e(err.message)}</p>`;
        if (submitBtn) submitBtn.disabled=true;
        importedDraftSessions=null;
      }
    });

    planImportForm.addEventListener('submit',async event=>{
      event.preventDefault();
      if (!importedDraftSessions || !importedDraftSessions.length) {
        if (importStatus) importStatus.textContent='กรุณาเลือกไฟล์ตารางฝึกซ้อมที่ถูกต้องก่อนบันทึก';
        return;
      }
      if (!user || !cloud) {if (importStatus) importStatus.textContent='เข้าสู่ระบบก่อนบันทึกแผน ข้อมูลในฟอร์มยังอยู่';return;}
      if (freshness!=='fresh') {if (importStatus) importStatus.textContent='ยังยืนยันข้อมูล Cloud ล่าสุดไม่ได้ จึงยังไม่บันทึกเพื่อป้องกันข้อมูลทับกัน';return;}
      if (busy) return;
      try {
        busy=true;if (submitBtn) submitBtn.disabled=true;
        requireFreshCloud();const generation=accountGeneration;
        if (importStatus) importStatus.textContent='กำลังสร้างและบันทึกตารางฝึก…';
        const goal=goalInput?.value?.trim() || planFileInput.files?.[0]?.name?.replace(/\.[^/.]+$/,'') || 'ตารางฝึกที่นำเข้าจากไฟล์';
        planImportForm.dataset.pendingPlanId ||= `import_${crypto.randomUUID()}`;
        planImportForm.dataset.pendingCreatedAt ||= String(Date.now());
        const newPlan=createManualPlan(importedDraftSessions,{goal,id:planImportForm.dataset.pendingPlanId,createdAt:Number(planImportForm.dataset.pendingCreatedAt)});
        if (importStatus) importStatus.textContent='กำลังบันทึกลง MyDash Cloud…';
        await cloud.savePlan(newPlan);
        const saved=await cloud.readSnapshot();if(generation!==accountGeneration)throw new Error('บัญชีเปลี่ยน กรุณาอ่านข้อมูลใหม่');markFresh(saved,'นำเข้าและเปิดใช้งานแผนใหม่สำเร็จและตรวจยืนยันข้อมูลแล้ว');
        planImportForm.closest('.entry-disclosure').open=false;
        render();
      } catch(err) {
        if (importStatus) importStatus.textContent=err.message || 'บันทึกแผนไม่สำเร็จ';
      } finally {
        busy=false;if (submitBtn) submitBtn.disabled=false;
      }
    });
  }

  document.querySelector('#archive-active-plan')?.addEventListener('click',async event=>{
    const planId=event.target.dataset.planId;
    if (!planId) return;
    if (!user || !cloud) {alert('เข้าสู่ระบบก่อนจัดเก็บแผน');return;}
    if (!confirm('คุณต้องการจัดเก็บแผนฝึกนี้ไปไว้ในประวัติแผนใช่หรือไม่?')) return;
    const button=event.target;
    button.disabled=true;
    try {
      requireFreshCloud();
      const generation=accountGeneration;
      await cloud.archivePlan(planId);
      const saved=await cloud.readSnapshot();if(generation!==accountGeneration)throw new Error('บัญชีเปลี่ยน กรุณาอ่านข้อมูลใหม่');markFresh(saved,'จัดเก็บแผนสำเร็จแล้ว');
      render();
    } catch(err) {
      alert(`จัดเก็บแผนไม่สำเร็จ: ${err.message}`);
    } finally {
      button.disabled=false;
    }
  });
}

async function initializeCloud() {
  if (cloudReady) return cloudReady;
  cloudReady=(async()=>{
      cloud=await import('./adapters/firebase.mjs');
      await new Promise(resolve=>{
      cloud.observeUser(async next=>{
        const hadUser=!!user;
        stopCloud?.();stopCloud=null;user=next;
        const generation=++accountGeneration;
        if (!next) {
          if (hadUser || preferCloud) {
            model=null;main.innerHTML='<section class="card empty"><h1>ออกจากระบบแล้ว</h1><p class="muted">เข้าสู่ระบบเพื่อดูข้อมูลบัญชีของคุณ</p></section>';
            document.querySelector('#data-notice').textContent='';
          }
          document.querySelector('#connection-label').textContent='ยังไม่ได้เข้าสู่ระบบ';
          document.querySelector('#cloud-login').textContent='เข้าสู่ระบบ';
          resolve();
          return;
        }
        preferCloud=true;
        try {localStorage.setItem('mydash.performance.source','cloud');} catch {}
        // Never carry a previous account's open form into a new account.
        model=null;main.innerHTML='<div class="loading-state">กำลังอ่านบัญชี MyDash…</div>';
        document.querySelector('#cloud-login').textContent='ออกจากระบบ';
        try {
          const snapshot=await cloud.readSnapshot();
          if (generation!==accountGeneration) return;
          markFresh(snapshot,'ข้อมูลจากบัญชี MyDash · ตัวใหม่อยู่ระหว่างทดสอบ');
          render();
          stopCloud=cloud.subscribe(snapshot=>{
            if (generation!==accountGeneration) return;
            markFresh(snapshot,'ข้อมูลจากบัญชี MyDash · ตัวใหม่อยู่ระหว่างทดสอบ');
            if (!busy && !document.querySelector('.entry-disclosure[open],form[data-dirty="true"]')) render();
          },error=>{if(generation===accountGeneration) showLoadError(error.message);});
        } catch(error) {
          if (generation===accountGeneration) showLoadError(error.message);
        }
        resolve();
      });
      });
  })().catch(error=>{cloudReady=null;throw error;});
  return cloudReady;
}

async function connectCloud() {
  const button=document.querySelector('#cloud-login');button.disabled=true;
  const signingOut=!!user;
  try {
    await initializeCloud();
    if (signingOut) await cloud.logout(); else if (!user) await cloud.login();
  } catch(error) {
    document.querySelector('#data-notice').textContent=`เข้าสู่ระบบไม่สำเร็จ (${error.code || error.message})`;
  } finally {button.disabled=false;}
}

document.querySelector('#reload-data').addEventListener('click',load);
document.querySelector('#cloud-login').addEventListener('click',connectCloud);
document.querySelector('[data-close-dialog]').addEventListener('click',()=>document.querySelector('#goal-dialog').close());
document.querySelector('#goal-form').addEventListener('submit',event=>{
  event.preventDefault();
  const value=Number(new FormData(event.target).get('weeklyGoal'));
  if (!Number.isFinite(value)||value<1||value>1000) return;
  try {
    const next={...preferences,weeklyGoal:value};
    localStorage.setItem('mydash.performance.preferences',JSON.stringify(next));preferences=next;
    document.querySelector('#goal-dialog').close();render();
  } catch {event.target.querySelector('.form-status').textContent='บันทึกไม่สำเร็จ เบราว์เซอร์ไม่อนุญาตพื้นที่จัดเก็บ';}
});
window.addEventListener('hashchange',()=>render({focus:true}));
render();
if (preferCloud) initializeCloud().catch(error=>{
  showLoadError(`เชื่อมต่อบัญชีไม่สำเร็จ (${error.code || error.message || 'network'})`);
});
else load();
