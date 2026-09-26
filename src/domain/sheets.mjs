export function sheetsUrl(value){
  const url=String(value||'').trim();
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url))throw new Error('ใช้ Apps Script URL แบบ https://script.google.com/macros/s/.../exec เท่านั้น');
  return url;
}
export function sheetsRecords(data){
  return [['workout',data.workouts],['wellness',data.wellness]].flatMap(([type,rows])=>Object.values(rows||{}).filter(row=>row&&typeof row==='object').map(row=>{
    const {_key,...value}=row;return {action:'upsert',type,data:value};
  }));
}
export async function sendSheets({url,token,records,check,fetcher=fetch,onProgress=()=>{}}){
  sheetsUrl(url);if(!token)throw new Error('ยังไม่ได้ตั้งค่า token ของ Google Sheets');
  let sent=0;
  for(const record of records){
    check();
    await fetcher(url,{method:'POST',mode:'no-cors',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({token,...record}),signal:AbortSignal.timeout(20000)});
    check();onProgress(++sent,records.length);
  }
  return {sent,verified:false};
}
