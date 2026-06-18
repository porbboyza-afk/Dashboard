const SCHEMAS = {
  workout: {
    sheet: 'Activities',
    headers: ['id','date','type','purpose','distance_km','time_min','avg_pace','avg_hr','cadence','rpe','session_load','shoe','surface','temperature','weather','pain','pain_location','feeling','note','splits_json','interval_json','created_at','updated_at','raw_json']
  },
  wellness: {
    sheet: 'Daily_Wellness',
    headers: ['id','date','weight_kg','resting_hr','hrv','spo2','blood_pressure','health_status','sleep_hours','sleep_quality','fatigue','stress','soreness','mood','pain_location','note','recovery_score','created_at','updated_at','raw_json']
  }
};

function doGet() {
  return output({ok:true,service:'MyDash Health Intelligence',time:new Date().toISOString()});
}

function doPost(e) {
  try {
    const payload=JSON.parse(e.postData?.contents||'{}');
    verifyToken(payload.token);
    if(payload.type==='ping'){logEvent('PING',payload.data);return output({ok:true});}
    const schema=SCHEMAS[payload.type];
    if(!schema)throw new Error('Unsupported type');
    upsert(schema,payload.type,payload.data||{});
    return output({ok:true,type:payload.type});
  } catch(error) {
    logEvent('ERROR',{message:error.message});
    return output({ok:false,error:error.message});
  }
}

function verifyToken(token) {
  const expected=PropertiesService.getScriptProperties().getProperty('MYDASH_BACKUP_TOKEN');
  if(!expected||token!==expected)throw new Error('Unauthorized');
}

function spreadsheet() {
  const id=PropertiesService.getScriptProperties().getProperty('MYDASH_SHEET_ID');
  if(!id)throw new Error('MYDASH_SHEET_ID is not configured');
  return SpreadsheetApp.openById(id);
}

function ensureSheet(name,headers) {
  const sheet=spreadsheet().getSheetByName(name)||spreadsheet().insertSheet(name);
  if(sheet.getLastRow()===0)sheet.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

function stableId(type,data) {
  if(type==='wellness'&&data.date)return `wellness-${data.date}`;
  const raw=`${type}|${data.date||''}|${data.createdAt||''}|${data.dist||''}|${data.time||''}`;
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw)).slice(0,20);
}

function upsert(schema,type,data) {
  const id=data.id||stableId(type,data),now=new Date().toISOString();
  const rows={
    workout:[id,data.date||'',data.type||'',data.purpose||'',data.dist??'',data.time??'',data.avgPace??'',data.hr??'',data.cad??'',data.rpe??'',sessionLoad(data),data.shoe||'',data.surface||'',data.temperature??'',data.weather||'',data.pain??'',data.painLocation||'',data.feeling||'',data.note||'',JSON.stringify(data.splits||[]),JSON.stringify(data.interval||null),iso(data.createdAt),now,JSON.stringify(data)],
    wellness:[id,data.date||'',data.weight??'',data.restingHR??'',data.hrv??'',data.spo2??'',data.bloodPressure||'',data.healthStatus||'',data.sleepHours??'',data.sleepQuality??'',data.fatigue??'',data.stress??'',data.soreness??'',data.mood??'',data.painLocation||'',data.note||'',data.recoveryScore??'',iso(data.createdAt),now,JSON.stringify(data)]
  };
  upsertRow(ensureSheet(schema.sheet,schema.headers),id,rows[type]);
}

function sessionLoad(data) {
  const minutes=Number(data.time||0);if(!minutes)return 0;
  if(data.rpe)return Math.round(minutes*Number(data.rpe));
  const hr=Number(data.hr||0),intensity=hr?(hr<130?2:hr<145?3:hr<160?5:hr<175?7:9):(data.type==='interval'?7:data.type==='run'?4:3);
  return Math.round(minutes*intensity);
}

function upsertRow(sheet,id,row) {
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try {
    const count=sheet.getLastRow()-1;
    if(count>0){
      const ids=sheet.getRange(2,1,count,1).getDisplayValues().flat();
      const index=ids.indexOf(String(id));
      if(index>=0){sheet.getRange(index+2,1,1,row.length).setValues([row]);return;}
    }
    sheet.appendRow(row);
  } finally { lock.releaseLock(); }
}

function logEvent(event,data) {
  try { ensureSheet('System_Log',['timestamp','event','data']).appendRow([new Date().toISOString(),event,JSON.stringify(data||{})]); } catch(_) {}
}
function iso(value){if(!value)return'';const d=new Date(value);return isNaN(d.getTime())?'':d.toISOString();}
function output(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
