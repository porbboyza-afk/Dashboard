import {pageHeading} from '../ui/components.mjs';
import {escape as e,dateLabel,number} from '../ui/format.mjs';
import {localDate} from '../domain/model.mjs';
import {raceFields,profileDefinitions,profilePatch} from '../domain/personal.mjs';
export function races(model){
  const rows=Object.entries(model.data.races || {}).filter(([,r])=>r && typeof r==='object').sort((a,b)=>String(a[1].date).localeCompare(String(b[1].date)));
  return `${pageHeading('RACES','การแข่งขัน','เก็บวันแข่ง ระยะทาง และเป้าเวลาของคุณ')}<details class="card entry-disclosure"><summary>เพิ่มการแข่งขัน</summary><form id="race-form"><div class="form-grid"><label>ชื่องาน<input name="name" required maxlength="200"></label><label>วันที่<input name="date" type="date" required></label><label>ระยะ km<input name="dist" type="number" min="0.1" max="1000" step="any" required></label><label>เป้าเวลา (ไม่บังคับ)<input name="goal" placeholder="50:00"></label></div><button class="button">บันทึกการแข่งขัน</button><p class="form-status" role="status"></p></form></details>${rows.map(([key,r])=>`<section class="card"><h2>${e(r.name)}</h2><p>${dateLabel(r.date,{year:'numeric'})} · ${number(r.dist,2)} km</p>${r.goal?`<p>เป้าเวลา ${e(r.goal)}</p>`:''}<p class="muted">${r.date<localDate()?'วันที่แข่งขันผ่านไปแล้ว':'กำลังจะมาถึง'}</p><button class="subtle-button" data-delete-race="${e(key)}">ลบการแข่งขัน</button></section>`).join('') || '<section class="card">ยังไม่มีการแข่งขันที่บันทึกไว้</section>'}`;
}
export function settings(model){
  const profile=model.data['settings/athleteProfile'] || {};
  return `${pageHeading('YOUR PROFILE','โปรไฟล์นักกีฬา','ค่าที่คุณบันทึกไว้สำหรับใช้อ้างอิง')}<details class="card entry-disclosure"><summary>แก้ไขโปรไฟล์</summary><form id="profile-form"><div class="form-grid">${profileDefinitions.map(([key,label,type])=>`<label>${e(label)}<input name="${key}" type="${type}" value="${e(profile[key])}" ${type==='number'?'step="any"':''}></label>`).join('')}</div><button class="button">บันทึกโปรไฟล์</button><p class="form-status" role="status"></p></form></details><section class="card"><h2>การเชื่อมต่ออุปกรณ์</h2><a href="#connections" class="button">ดูสถานะการซิงก์</a></section>`;
}
export function bindPersonal(model,{save,cloud}){
  const race=document.querySelector('#race-form');
  race?.addEventListener('submit',async event=>{event.preventDefault();try{const fields=raceFields(Object.fromEntries(new FormData(race)));race.dataset.pendingKey ||= crypto.randomUUID();await save(race,()=>race.dataset.editKey?cloud().editRace(fields,race.dataset.editKey,model.data.races[race.dataset.editKey]):cloud().saveRace(fields,race.dataset.pendingKey));}catch(error){race.querySelector('.form-status').textContent=error.message;}});
  document.querySelectorAll('[data-delete-race]').forEach(button=>{
    const edit=document.createElement('button');edit.type='button';edit.className='subtle-button';edit.textContent='แก้ไขการแข่งขัน';edit.dataset.editRace=button.dataset.deleteRace;
    edit.onclick=()=>{const key=edit.dataset.editRace,row=model.data.races[key];race.dataset.editKey=key;for(const field of ['name','date','dist','goal'])race.elements[field].value=row[field]??'';race.closest('details').open=true;race.closest('details').querySelector('summary').textContent='แก้ไขการแข่งขัน';race.scrollIntoView({block:'start'});};button.before(edit);
  });
  const profile=document.querySelector('#profile-form');
  profile?.addEventListener('submit',async event=>{event.preventDefault();try{const patch=profilePatch(Object.fromEntries(new FormData(profile)),model.data['settings/athleteProfile']);await save(profile,()=>cloud().saveProfile(patch));}catch(error){profile.querySelector('.form-status').textContent=error.message;}});
  document.querySelectorAll('[data-delete-race]').forEach(button=>button.addEventListener('click',async()=>{
    if(!confirm('ลบการแข่งขันนี้ออกจากบัญชี?'))return;
    let status=button.parentElement.querySelector('.form-status');if(!status){status=document.createElement('p');status.className='form-status';button.parentElement.append(status);}
    await save(button.parentElement,()=>cloud().deleteRace(button.dataset.deleteRace,model.data.races[button.dataset.deleteRace]));
  }));
}
