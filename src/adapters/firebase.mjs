import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getDatabase,ref,get,onValue,update,set,runTransaction} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import config from './firebase-config.mjs';
import {createRecordRepository} from '../domain/repository.mjs';
import {selectCloudData} from '../domain/cloud-data.mjs';
import {restoreEntries,applyRestore,equalData} from '../domain/restore.mjs';
import {sheetsUrl,sheetsRecords,sendSheets} from '../domain/sheets.mjs';

export async function readSheetsSettings(){
  const target=userRef('settings');const cfg=(await get(target)).val()||{};
  return {url:cfg.gasUrl||'',hasToken:!!cfg.gasToken};
}
export async function saveSheetsSettings({url,token}){
  const fields={gasUrl:sheetsUrl(url)};if(token.trim())fields.gasToken=token.trim();
  const target=userRef('settings');await update(target,fields);const saved=(await get(target)).val();
  if(!Object.entries(fields).every(([key,value])=>saved?.[key]===value))throw new Error('อ่านกลับการตั้งค่าไม่ตรง');
}
export async function backupSheets(data,ping,onProgress){
  const uid=auth.currentUser?.uid;const target=userRef('settings');const cfg=(await get(target)).val()||{};
  return sendSheets({url:cfg.gasUrl,token:cfg.gasToken,records:ping?[{type:'ping',data:{date:new Date().toISOString()}}]:sheetsRecords(data),onProgress,check:()=>{if(!navigator.onLine||auth.currentUser?.uid!==uid)throw new Error('ออฟไลน์หรือบัญชีเปลี่ยน จึงหยุดส่ง');}});
}

const app=initializeApp(config,'performance');
const auth=getAuth(app);
const db=getDatabase(app);
const paths=['workouts','activity_details','wellness','wellness_sources/garmin','post_run_reviews',
  'coach_plans','active_coach_plan_id','sync_sources','strava_activities','strava_activity_details','training_analyses'];

function within(timeoutMs, operation, message) {
  let timer;
  return Promise.race([
    operation,
    new Promise((_, reject) => { timer=setTimeout(() => reject(new Error(message)), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));
}

function userRef(path) {
  if (!auth.currentUser) throw new Error('กรุณาเข้าสู่ระบบก่อนบันทึก');
  return ref(db,`users/${auth.currentUser.uid}/${path}`);
}
function safeKey(key) {
  if (typeof key!=='string'||!key||/[.#$\[\]/]/.test(key)) throw new Error('รหัสข้อมูลไม่ถูกต้อง');
  return key;
}
function selectedData(value) {
  return selectCloudData(value);
}
async function readViaRest(uid) {
  const active=auth.currentUser;
  if (!active || active.uid!==uid) throw new Error('บัญชีเปลี่ยนแปลง กรุณาอ่านข้อมูลใหม่');
  const token=await active.getIdToken();
  const endpoint=`${config.databaseURL}/users/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(token)}`;
  const response=await fetch(endpoint,{cache:'no-store',referrerPolicy:'no-referrer'});
  if (!response.ok) throw new Error(`Firebase อ่านข้อมูลไม่สำเร็จ (${response.status})`);
  return response.json();
}

async function readViaSdk(uid) {
  const active=auth.currentUser;
  if (!active || active.uid!==uid) throw new Error('บัญชีเปลี่ยนแปลง กรุณาอ่านข้อมูลใหม่');
  const snapshot=await get(ref(db,`users/${uid}`));
  return snapshot.val();
}

async function readViaRealtime(uid) {
  const active=auth.currentUser;
  if (!active || active.uid!==uid) throw new Error('บัญชีเปลี่ยนแปลง กรุณาอ่านข้อมูลใหม่');
  return new Promise((resolve,reject)=>{
    onValue(ref(db,`users/${uid}`),snapshot=>resolve(snapshot.val()),reject,{onlyOnce:true});
  });
}

async function readUser(uid) {
  // REST was the only read path before. A transient fetch/CORS failure then left
  // a signed-in user with an unusable app even though the Firebase SDK was ready.
  const rest=within(12000,readViaRest(uid),'REST timeout');
  const sdk=within(12000,readViaSdk(uid),'SDK timeout');
  const realtime=within(12000,readViaRealtime(uid),'Realtime timeout');
  try {
    return await Promise.any([rest,sdk,realtime]);
  } catch (failure) {
    const errors=(failure?.errors || []).map(error=>error?.message).filter(Boolean);
    if (errors.length && errors.every(message=>/timeout/i.test(message))) {
      throw new Error('Firebase Database ไม่ตอบจากเครือข่ายนี้ กรุณาลองใหม่ภายหลัง');
    }
    throw new Error(errors.length ? `อ่านข้อมูล MyDash ไม่สำเร็จ (${errors.join(' · ')})` : 'อ่านข้อมูล MyDash ไม่สำเร็จ กรุณาลองใหม่');
  }
}

export const login=()=>signInWithPopup(auth,new GoogleAuthProvider());
export const logout=()=>signOut(auth);
export const observeUser=callback=>onAuthStateChanged(auth,callback);

export async function readSnapshot() {
  const uid=auth.currentUser?.uid;
  if (!uid) throw new Error('กรุณาเข้าสู่ระบบ');
  const value=await readUser(uid);
  if (uid!==auth.currentUser?.uid) throw new Error('บัญชีเปลี่ยนแปลง กรุณาอ่านข้อมูลใหม่');
  return {schemaVersion:1,mode:'cloud',readAt:new Date().toISOString(),data:selectedData(value)};
}

export function subscribe(onSnapshot,onError) {
  const uid=auth.currentUser?.uid;
  if (!uid) throw new Error('กรุณาเข้าสู่ระบบ');
  const refresh=async()=>{
    try {
      const value=await readUser(uid);
      onSnapshot({schemaVersion:1,mode:'cloud',readAt:new Date().toISOString(),data:selectedData(value)});
    } catch(error) { onError(error); }
  };
  const timer=setInterval(refresh,60000);
  return ()=>clearInterval(timer);
}

function repository() {
  const uid=auth.currentUser?.uid;
  if (!uid) throw new Error('กรุณาเข้าสู่ระบบก่อนบันทึก');
  const scoped=path=>{
    if (auth.currentUser?.uid!==uid) throw new Error('บัญชีเปลี่ยนระหว่างบันทึก กรุณาอ่านข้อมูลใหม่');
    return ref(db,`users/${uid}/${path}`);
  };
  return createRecordRepository({
    atomic:changes=>update(scoped(''),changes),
    read:async path=>(await get(scoped(path))).val(),
    patch:async (path,fields)=>{
      if (fields!==null && typeof fields==='object' && !Array.isArray(fields)) {
        return update(scoped(path),fields);
      }
      return set(scoped(path),fields);
    },
  });
}

export const saveWorkout=(fields,key,options)=>repository().workout(safeKey(key),fields,options);
export const saveWellness=(fields,key)=>repository().wellness(safeKey(key),fields);
export const savePlan=(planData,options)=>repository().plan(planData,options);
export const archivePlan=planId=>repository().archivePlan(safeKey(planId));

export async function saveProfile(fields){
  const target=userRef('settings/athleteProfile');
  await update(target,fields);
  const saved=(await get(target)).val() || {};
  if(!Object.entries(fields).every(([k,v])=>(saved[k]??null)===v))throw new Error('อ่านกลับโปรไฟล์ไม่ตรง');
}
export async function saveRace(fields,key){
  const target=userRef('races/'+safeKey(key));
  const result=await runTransaction(target,current=>current==null?{...fields,id:key}:current,{applyLocally:false});
  const saved=(await get(target)).val();
  if(!result.committed || !Object.entries(fields).every(([k,v])=>saved?.[k]===v))throw new Error('บันทึกการแข่งขันไม่สำเร็จหรือรหัสถูกใช้งานแล้ว');
}
export async function deleteRace(key,expected){
  const target=userRef('races/'+safeKey(key));
  const result=await runTransaction(target,current=>{
    if(current==null)return null;
    if(!equalData(current,expected))return;
    return null;
  },{applyLocally:false});
  if(!result.committed || (await get(target)).exists())throw new Error('ข้อมูลเปลี่ยนแล้ว กรุณาอ่านใหม่ก่อนลบ');
}
export async function editRace(fields,key,expected){
  const target=userRef('races/'+safeKey(key));await get(target);
  const result=await runTransaction(target,current=>current==null?null:equalData(current,expected)?{...current,...fields}:undefined,{applyLocally:false});
  if(!result.committed)throw new Error('ข้อมูลการแข่งขันเปลี่ยนแล้ว กรุณาอ่านใหม่ก่อนแก้ไข');
  const saved=(await get(target)).val();if(!Object.entries(fields).every(([k,v])=>saved?.[k]===v))throw new Error('อ่านกลับการแข่งขันไม่ตรง');
}

export async function restoreBackup(payload){
  const entries=restoreEntries(payload);
  const uid=auth.currentUser?.uid;
  if(!uid)throw new Error('กรุณาเข้าสู่ระบบก่อนบันทึก');
  const token=await auth.currentUser.getIdToken();
  const endpoint=`${config.databaseURL}/users/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(token)}`;
  const checkAccount=()=>{if(auth.currentUser?.uid!==uid)throw new Error('บัญชีเปลี่ยน กรุณาอ่านข้อมูลใหม่');};
  const request=async options=>{
    checkAccount();
    const response=await fetch(endpoint,{cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000),...options});
    checkAccount();return response;
  };
  // REST conditional write avoids racing the SDK's root read listeners.
  // If another writer changes ANY field, Firebase rejects the entire write (412).
  for(let attempt=0;attempt<4;attempt++){
    const response=await request({headers:{'X-Firebase-ETag':'true'}});
    if(!response.ok)throw new Error('อ่านข้อมูลก่อนกู้คืนไม่สำเร็จ');
    const etag=response.headers.get('ETag');if(!etag)throw new Error('ไม่พบเวอร์ชันข้อมูล จึงไม่เขียนทับ');
    const {next,report}=applyRestore(await response.json(),entries);
    if(!report.added)return report;
    const written=await request({method:'PUT',headers:{'Content-Type':'application/json','if-match':etag},body:JSON.stringify(next)});
    if(written.status===412)continue;
    if(!written.ok)throw new Error('กู้คืนยังยืนยันไม่ได้ กรุณาอ่านใหม่และตรวจไฟล์อีกครั้ง');
    const accepted=await written.json();
    const reread=await request({});if(!reread.ok)throw new Error('บันทึกแล้วแต่อ่านกลับไม่สำเร็จ กรุณาตรวจไฟล์อีกครั้ง');
    const saved=await reread.json();
    for(const item of report.items.filter(row=>row.state==='added')){
      const expected=item.path.split('/').reduce((value,key)=>value?.[key],accepted)?.[item.key];
      const actual=item.path.split('/').reduce((value,key)=>value?.[key],saved)?.[item.key];
      if(!equalData(actual,expected))throw new Error('กู้คืนแล้วแต่อ่านกลับไม่ตรง กรุณาอ่านใหม่และตรวจไฟล์อีกครั้ง');
    }
    return report;
  }
  throw new Error('ข้อมูลเปลี่ยนพร้อมกันหลายครั้ง ยังไม่ได้กู้คืน กรุณาตรวจไฟล์ใหม่');
}
