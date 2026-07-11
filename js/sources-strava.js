// Sources and legacy Strava logic extracted from index.html.
const STRAVA_API='https://www.strava.com/api/v3';
const DEFAULT_ATHLETE_PROFILE={
  dob:'1993-09-29',maxHR:186,lthr:169,thresholdPace:'4:21',thresholdPower:357,
  easyHRMin:130,easyHRMax:142,z1Max:130,z2Max:145,z3Max:155,z4Max:169,z5Max:186,
  tempoFast:'4:55',tempoSlow:'5:05'
};
window._athleteProfile={...DEFAULT_ATHLETE_PROFILE};

function getAthleteProfile(){return {...DEFAULT_ATHLETE_PROFILE,...(window._athleteProfile||{})};}

function stravaConnect(){const sb=document.getElementById('strava-status-box');sb.innerHTML=`<div style="width:100%;display:flex;flex-direction:column;gap:8px"><p style="font-weight:700;font-size:12px;color:var(--text);margin-bottom:2px">Legacy Strava recovery connect</p><div class="text-xs c3">Primary sync is Health Connect. Use this only for old cache or one-time export recovery.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-strava btn-sm" onclick="stravaOpenAuthorize()">Open Strava auth</button><input type="text" id="strava-code-input" placeholder="Paste code=... here" style="flex:1;min-width:180px;font-size:11px"><button class="btn btn-strava btn-sm" onclick="stravaConnectCode()">Connect code</button></div><details><summary style="cursor:pointer;font-size:11px;color:var(--text2)">Advanced: paste refresh_token</summary><div style="display:flex;gap:8px;margin-top:8px"><input type="text" id="strava-token-input" placeholder="Paste refresh_token..." style="flex:1;font-size:11px"><button class="btn btn-ghost btn-sm" onclick="stravaConnectDirect()">Connect token</button></div></details></div>`;}
async function stravaGetAuthSettings(){
  const cfg=await window._fb.getData('settings')||{};
  const clientId=(cfg.stravaId||'').trim();
  const clientSecret=(cfg.stravaSecret||'').trim();
  const redirectUri=(cfg.stravaRedirect||'http://localhost').trim();
  if(!clientId||!clientSecret)throw new Error('Please save Client ID/Secret in Settings first');
  return {clientId,clientSecret,redirectUri};
}
async function stravaOpenAuthorize(){
  const popup=window.open('about:blank','_blank','noopener');
  try{
    const {clientId,redirectUri}=await stravaGetAuthSettings();
    const url=new URL('https://www.strava.com/oauth/authorize');
    url.searchParams.set('client_id',clientId);
    url.searchParams.set('redirect_uri',redirectUri);
    url.searchParams.set('response_type','code');
    url.searchParams.set('approval_prompt','force');
    url.searchParams.set('scope','activity:read,activity:read_all');
    if(popup)popup.location.href=url.toString();
    else window.location.href=url.toString();
    showToast('Authorize แล้วคัดลอก code=... กลับมาใส่ในช่อง Connect code');
  }catch(e){if(popup)popup.close();showToast('Error: '+e.message,'error');}
}
function stravaExtractCode(value=''){
  const text=String(value).trim();
  if(!text)return '';
  try{return new URL(text).searchParams.get('code')||text;}catch(_){return text.replace(/^code=/,'').trim();}
}
async function stravaExchangeCodeCall(code,clientId,clientSecret,redirectUri){
  const url='https://www.strava.com/oauth/token';
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:clientId,client_secret:clientSecret,code,grant_type:'authorization_code',redirect_uri:redirectUri})});
  if(!res.ok)throw await stravaBuildHttpError(res,url+'?grant_type=authorization_code');
  return await res.json();
}
async function stravaConnectCode(){
  const code=stravaExtractCode(document.getElementById('strava-code-input')?.value||'');
  if(!code){showToast('Paste authorization code first','error');return;}
  showLoading('Connecting Strava...');
  try{
    const {clientId,clientSecret,redirectUri}=await stravaGetAuthSettings();
    const exchanged=await stravaExchangeCodeCall(code,clientId,clientSecret,redirectUri);
    const scope=stravaNormalizeScope(exchanged.scope||'');
    if(!stravaHasActivityScope(scope))throw new Error(`Strava token missing activity scope. Accepted scope: ${scope||'none'}`);
    await stravaValidateActivityListAccess(exchanged.access_token);
    const athlete=exchanged.athlete||await stravaFetchJson(`${STRAVA_API}/athlete`,exchanged.access_token);
    await window._fb.removeData('strava_token').catch(()=>{});
    await window._fb.setData('strava_token',{access_token:exchanged.access_token,refresh_token:exchanged.refresh_token,expires_at:exchanged.expires_at,scope,athlete});
    showToast(`✅ Welcome ${athlete.firstname||'Strava'}!`);renderStravaPage();
  }catch(e){showToast('Error: '+e.message,'error');}
  finally{hideLoading();}
}
async function stravaConnectDirect(){
  const refreshToken=(document.getElementById('strava-token-input')?.value||'').trim();
  if(!refreshToken){showToast('Please paste Refresh Token','error');return;}
  showLoading('Verifying...');
  try{
    const {clientId,clientSecret}=await stravaGetAuthSettings();
    const exchanged=await stravaRefreshTokenCall(refreshToken,clientId,clientSecret);
    const athleteUrl=`${STRAVA_API}/athlete`;
    const res=await fetch(athleteUrl,{headers:{'Authorization':`Bearer ${exchanged.access_token}`}});
    if(!res.ok)throw await stravaBuildHttpError(res,athleteUrl);
    const athlete=await res.json();
    await window._fb.setData('strava_token',{access_token:exchanged.access_token,refresh_token:exchanged.refresh_token||refreshToken,expires_at:exchanged.expires_at,scope:stravaNormalizeScope(exchanged.scope||''),athlete});
    showToast(`✅ Welcome ${athlete.firstname}!`);renderStravaPage();
  }catch(e){showToast('Error: '+e.message,'error');}
  finally{hideLoading();}
}
async function stravaRefreshTokenCall(refreshToken,clientId,clientSecret){
  const url='https://www.strava.com/oauth/token';
  if(!refreshToken)throw new Error('Missing Strava refresh token. Disconnect and connect Strava again.');
  if(!clientId||!clientSecret)throw new Error('Missing Strava Client ID/Secret in Settings.');
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:String(clientId).trim(),client_secret:String(clientSecret).trim(),refresh_token:String(refreshToken).trim(),grant_type:'refresh_token'})});
  if(!res.ok)throw await stravaBuildHttpError(res,url);
  return await res.json();
}
async function stravaGetValidToken(){
  const td=await window._fb.getData('strava_token');
  if(!td?.access_token)return null;
  if((td.expires_at||0)-Math.floor(Date.now()/1000)>300)return td.access_token;
  if(!td.refresh_token){stravaTokenExpired();return null;}
  try{
    const {clientId,clientSecret}=await stravaGetAuthSettings();
    const r=await stravaRefreshTokenCall(td.refresh_token,clientId,clientSecret);
    await window._fb.setData('strava_token',{...td,access_token:r.access_token,refresh_token:r.refresh_token||td.refresh_token,expires_at:r.expires_at,scope:stravaNormalizeScope(r.scope||td.scope||'')});
    return r.access_token;
  }catch(e){
    if(e.status===400||e.status===401){
      await window._fb.removeData('strava_token').catch(()=>{});
      renderStravaPage();
      showToast('Strava token ใช้ไม่ได้แล้ว กรุณา Connect ใหม่ด้วย Open Strava auth','error');
    }else{
      showToast('Refresh failed: '+e.message,'error');
    }
    return null;
  }
}

function stravaNormalizeScope(scope=''){
  return String(scope).split(/[,\s]+/).map(item=>item.trim()).filter(Boolean).join(',');
}

function stravaHasActivityScope(scope=''){
  const parts=new Set(stravaNormalizeScope(scope).split(',').filter(Boolean));
  return parts.has('activity:read')||parts.has('activity:read_all');
}

async function stravaValidateActivityListAccess(token){
  const url=`${STRAVA_API}/athlete/activities?per_page=1`;
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
  captureStravaRateLimit(response);
  if(!response.ok)throw await stravaBuildHttpError(response,url);
  return response.json();
}

function captureStravaRateLimit(response){
  const limit=response.headers.get('X-ReadRateLimit-Limit')||response.headers.get('X-RateLimit-Limit');
  const usage=response.headers.get('X-ReadRateLimit-Usage')||response.headers.get('X-RateLimit-Usage');
  if(limit&&usage)localStorage.setItem('strava-rate-limit',JSON.stringify({limit,usage,updatedAt:Date.now()}));
}

async function stravaFetchJson(url,token){
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
  captureStravaRateLimit(response);
  if(!response.ok)throw await stravaBuildHttpError(response,url);
  return response.json();
}

function stravaEndpointLabel(url=''){
  if(url.includes('grant_type=authorization_code'))return 'authorization code exchange';
  if(url.includes('/oauth/token'))return 'token refresh';
  if(url.includes('/athlete/activities'))return 'activities list';
  if(/\/activities\/[^/]+\/streams/.test(url))return 'activity streams';
  if(/\/activities\/[^/]+\/laps/.test(url))return 'activity laps';
  if(/\/activities\/[^/?]+/.test(url))return 'activity detail';
  if(url.endsWith('/athlete'))return 'athlete profile';
  return 'request';
}

async function stravaBuildHttpError(response,url=''){
  const label=stravaEndpointLabel(url);
  let apiMessage='';
  try{
    const body=await response.clone().json();
    const details=Array.isArray(body?.errors)?body.errors.map(item=>[item.resource,item.field,item.code].filter(Boolean).join('.')).filter(Boolean).join(', '):'';
    apiMessage=[body?.message,details].filter(Boolean).join(' / ');
  }catch(_){}
  const isInactiveApp = /Application\.Status\.Inactive/i.test(apiMessage);
  const hint=response.status===404
    ? `not found. Check Strava scope/activity privacy, or reconnect with activity:read_all${apiMessage?`. Strava says: ${apiMessage}`:''}`
    : response.status===403
      ? isInactiveApp
        ? `forbidden. Your Strava API application is inactive; activate it in Strava Developer settings or use an active app before syncing${apiMessage?`. Strava says: ${apiMessage}`:''}`
        : `forbidden. Reconnect Strava and accept activity:read_all, then sync again${apiMessage?`. Strava says: ${apiMessage}`:''}`
      : response.status===400&&label==='authorization code exchange'
        ? `bad request. The Strava code is one-time use or expired; press Open Strava auth again and paste the fresh code${apiMessage?`. Strava says: ${apiMessage}`:''}`
      : response.status===400&&label==='token refresh'
        ? `bad request. Saved refresh token or Client ID/Secret is no longer valid; disconnect and connect Strava again${apiMessage?`. Strava says: ${apiMessage}`:''}`
        : apiMessage;
  const message=`Strava ${label} HTTP ${response.status}${hint?`: ${hint}`:''}`;
  console.warn('Strava API failed',{status:response.status,label,url});
  const error=new Error(message);
  error.status=response.status;
  error.label=label;
  error.apiMessage=apiMessage;
  return error;
}

function normalizeStravaStreams(raw){
  const result={};
  if(Array.isArray(raw))raw.forEach(stream=>{if(stream?.type)result[stream.type]=stream.data||[];});
  else Object.entries(raw||{}).forEach(([key,stream])=>{result[key]=Array.isArray(stream)?stream:(stream?.data||[]);});
  return result;
}

function lapPaceMinutes(lap){
  const speed=+lap.average_speed||(+lap.distance>0&&+lap.moving_time>0?lap.distance/lap.moving_time:0);
  return speed>0?1000/speed/60:null;
}

function sessionTypeFromProfile(activity,laps,profile){
  const usable=laps.filter(lap=>(+lap.distance||0)>=100&&(+lap.moving_time||0)>=30);
  const core=usable.length>=3?usable.slice(1,-1):usable;
  const totalTime=core.reduce((sum,lap)=>sum+(+lap.moving_time||0),0);
  const weighted=(field)=>totalTime?core.reduce((sum,lap)=>sum+(+lap[field]||0)*(+lap.moving_time||0),0)/totalTime:null;
  const avgHR=weighted('average_heartrate')||(+activity.average_heartrate||null);
  const avgSpeed=weighted('average_speed')||(+activity.average_speed||0);
  const avgPace=avgSpeed>0?1000/avgSpeed/60:(+activity.distance>0&&+activity.moving_time>0?activity.moving_time/activity.distance*1000/60:null);
  const tempoFast=paceStrToDecimal(profile.tempoFast),tempoSlow=paceStrToDecimal(profile.tempoSlow);
  const scores={recovery:0,easy:0,steady:0,tempo:0,threshold:0};
  const evidence=[];
  if(avgHR){
    if(avgHR<=profile.z1Max){scores.recovery+=55;evidence.push(`HR ช่วงหลัก ${Math.round(avgHR)} อยู่ Z1`);}
    else if(avgHR<=profile.easyHRMax){scores.easy+=58;evidence.push(`HR ช่วงหลัก ${Math.round(avgHR)} อยู่ Easy ส่วนตัว`);}
    else if(avgHR<=profile.z2Max){scores.easy+=45;scores.steady+=15;evidence.push(`HR ช่วงหลัก ${Math.round(avgHR)} อยู่ Z2 สูง`);}
    else if(avgHR<=profile.z3Max){scores.steady+=55;evidence.push(`HR ช่วงหลัก ${Math.round(avgHR)} อยู่ Z3`);}
    else if(avgHR<=profile.z4Max){scores.tempo+=50;scores.threshold+=15;evidence.push(`HR ช่วงหลัก ${Math.round(avgHR)} อยู่ Z4`);}
    else{scores.threshold+=55;evidence.push(`HR ช่วงหลัก ${Math.round(avgHR)} อยู่ Z5`);}
  }
  if(avgPace){
    if(avgPace>=5.75){scores.recovery+=30;}
    else if(avgPace>=5.33){scores.easy+=30;}
    else if(avgPace>tempoSlow){scores.steady+=30;}
    else if(avgPace>=tempoFast&&avgPace<=tempoSlow){scores.tempo+=38;evidence.push(`Pace ช่วงหลัก ${formatPace(avgPace)} อยู่ช่วง Tempo ที่ตั้งไว้`);}
    else if(avgPace>=paceStrToDecimal(profile.thresholdPace)){scores.threshold+=30;}
    else{scores.threshold+=35;}
  }
  const name=(activity.name||'').toLowerCase();
  if(/recovery|ฟื้น|เบามาก/.test(name))scores.recovery+=15;
  if(/easy|base|เบา/.test(name))scores.easy+=15;
  if(/steady|aerobic/.test(name))scores.steady+=15;
  if(/tempo|threshold|เทมโป/.test(name))scores.tempo+=18;
  const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  const [type,top]=ranked[0],second=ranked[1]?.[1]||0;
  const confidence=clamp(Math.round(45+top*.55+(top-second)*.35),35,95);
  return {type,confidence,evidence,avgHR,avgPace,scores};
}

function analyzeStravaIntervals(activity,laps=[],streams={},profile=getAthleteProfile()){
  const usable=laps.filter(lap=>(+lap.distance||0)>=100&&(+lap.moving_time||0)>=30);
  const speeds=usable.map(lap=>+lap.average_speed||(+lap.distance/(+lap.moving_time||1))).filter(value=>value>0);
  const sorted=[...speeds].sort((a,b)=>a-b);
  const median=sorted.length?sorted[Math.floor(sorted.length/2)]:0;
  const max=Math.max(0,...speeds),min=Math.min(...speeds.filter(Boolean));
  const rangeRatio=min>0?max/min:1;
  let alternating=0,lastRole='';
  const roles=usable.map((lap,index)=>{
    const speed=+lap.average_speed||(+lap.distance/(+lap.moving_time||1));
    let role=speed>median*1.08?'work':speed<median*.92?'recovery':'steady';
    if(index===0&&role!=='work')role='warmup';
    if(index===usable.length-1&&role!=='work')role='cooldown';
    if((lastRole==='work'&&role==='recovery')||(lastRole==='recovery'&&role==='work'))alternating++;
    if(role==='work'||role==='recovery')lastRole=role;
    return role;
  });
  const workLaps=usable.filter((_,index)=>roles[index]==='work');
  const recoveryLaps=usable.filter((_,index)=>roles[index]==='recovery');
  let confidence=0;
  const reasons=[];
  if(activity?.workout_type!=null){confidence+=18;reasons.push('Strava ระบุว่าเป็น Workout');}
  if(/interval|repeat|rep|speed|tempo|threshold|vo2/i.test(activity?.name||'')){confidence+=14;reasons.push('ชื่อกิจกรรมมีรูปแบบงานคุณภาพ');}
  if(usable.length>=5){confidence+=12;reasons.push(`มี ${usable.length} laps`);}
  if(alternating>=2){confidence+=32;reasons.push('พบช่วงเร็วสลับพัก');}
  else if(alternating===1){confidence+=14;}
  if(rangeRatio>=1.2){confidence+=18;reasons.push('ความเร็วระหว่างช่วงแตกต่างชัด');}
  if(workLaps.length>=2){confidence+=10;}
  confidence=clamp(Math.round(confidence),0,100);
  const steadyClassification=sessionTypeFromProfile(activity,usable,profile);
  const detectedType=confidence>=65?'interval':confidence>=40?'possible_interval':steadyClassification.type;
  if(confidence<40)reasons.push(...steadyClassification.evidence);
  const finalConfidence=confidence>=40?confidence:steadyClassification.confidence;
  const workPaces=workLaps.map(lapPaceMinutes).filter(Number.isFinite);
  const workMean=workPaces.length?workPaces.reduce((sum,value)=>sum+value,0)/workPaces.length:null;
  const consistency=workMean&&workPaces.length>1
    ?clamp(Math.round(100-(Math.sqrt(workPaces.reduce((sum,value)=>sum+Math.pow(value-workMean,2),0)/workPaces.length)/workMean*100)*5),0,100)
    :null;
  const paceFade=workPaces.length>=2?(workPaces.at(-1)-workPaces[0])/workPaces[0]*100:null;
  const hrDrops=[];
  usable.forEach((lap,index)=>{
    if(roles[index]==='work'&&roles[index+1]==='recovery'&&lap.average_heartrate&&usable[index+1]?.average_heartrate){
      hrDrops.push(lap.average_heartrate-usable[index+1].average_heartrate);
    }
  });
  const hrRecovery=hrDrops.length?hrDrops.reduce((sum,value)=>sum+value,0)/hrDrops.length:null;
  return {
    analysisVersion:2,detectedType,confidence:finalConfidence,reasons,roles,
    workCount:workLaps.length,recoveryCount:recoveryLaps.length,
    consistency,paceFade,hrRecovery,
    steadyMetrics:{avgHR:steadyClassification.avgHR,avgPace:steadyClassification.avgPace,scores:steadyClassification.scores},
    profileSnapshot:profile,
    analyzedAt:Date.now(),userType:null,confirmed:false
  };
}

async function fetchStravaActivityDetail(activity,token,{force=false}={}){
  if(!activity?.id)return null;
  const path=`strava_activity_details/${activity.id}`;
  if(!force){
    const cached=await window._fb.getData(path);
    if(cached?.detail&&cached?.laps&&cached.analysisVersion<2){
      cached.analysis=analyzeStravaIntervals(cached.detail,cached.laps,cached.streams||{},getAthleteProfile());
      cached.analysisVersion=2;cached.fetchedAt=Date.now();
      await window._fb.setData(path,cached);
      return cached;
    }
    if(cached?.analysisVersion===2)return cached;
  }
  const id=activity.id;
  const results=await Promise.allSettled([
    stravaFetchJson(`${STRAVA_API}/activities/${id}`,token),
    stravaFetchJson(`${STRAVA_API}/activities/${id}/laps`,token),
    stravaFetchJson(`${STRAVA_API}/activities/${id}/streams?keys=time,distance,velocity_smooth,heartrate,cadence,altitude,moving&key_by_type=true`,token)
  ]);
  const detail=results[0].status==='fulfilled'?results[0].value:activity;
  const laps=results[1].status==='fulfilled'?results[1].value:[];
  const streamRaw=results[2].status==='fulfilled'?results[2].value:{};
  if(results.every(result=>result.status==='rejected')){
    const payload={
      activityId:id,analysisVersion:2,fetchedAt:Date.now(),
      detail:activity,laps:[],streams:{},
      analysis:analyzeStravaIntervals(activity,[],{},getAthleteProfile()),
      fetchStatus:{detail:'rejected',laps:'rejected',streams:'rejected'},
      fetchError:results[0].reason?.message||'Strava detail unavailable'
    };
    await window._fb.setData(path,payload);
    return payload;
  }
  const streams=normalizeStravaStreams(streamRaw);
  const analysis=analyzeStravaIntervals(detail,laps,streams,getAthleteProfile());
  const payload={
    activityId:id,analysisVersion:2,fetchedAt:Date.now(),
    detail,laps,streams,analysis,
    fetchStatus:{
      detail:results[0].status,laps:results[1].status,streams:results[2].status
    }
  };
  await window._fb.setData(path,payload);
  return payload;
}

async function enrichNewStravaActivities(activities,previousActivities,token){
  const previousIds=new Set((previousActivities||[]).map(activity=>String(activity.id)));
  const isInitialSync=!previousIds.size;
  const newActivities=(activities||[]).filter(activity=>!previousIds.has(String(activity.id)));
  const targets=(isInitialSync?newActivities.slice(0,2):newActivities).slice(0,3);
  let success=0;
  for(const activity of targets){
    try{await fetchStravaActivityDetail(activity,token);success++;}
    catch(error){console.warn('Strava detail sync failed',activity.id,error);}
  }
  return {found:newActivities.length,enriched:success,deferred:Math.max(0,newActivities.length-targets.length)};
}

async function stravaSync(){
  const btn=document.getElementById('btn-strava-sync'),oldHTML=btn?.innerHTML;
  if(btn){btn.innerHTML='⏳ Syncing...';btn.disabled=true;}
  try{
    let at=await stravaGetValidToken();if(!at)return;
    const previousRaw=await window._fb.getData('strava_activities');
    const previousActivities=previousRaw?(Array.isArray(previousRaw)?previousRaw:Object.values(previousRaw)):[];
    const activitiesUrl=`${STRAVA_API}/athlete/activities?per_page=100`;
    let res=await fetch(activitiesUrl,{headers:{'Authorization':`Bearer ${at}`}});
    captureStravaRateLimit(res);
    if(res.status===401){const td=await window._fb.getData('strava_token');const {clientId,clientSecret}=await stravaGetAuthSettings();const r=await stravaRefreshTokenCall(td.refresh_token,clientId,clientSecret);await window._fb.setData('strava_token',{...td,access_token:r.access_token,refresh_token:r.refresh_token||td.refresh_token,expires_at:r.expires_at,scope:stravaNormalizeScope(r.scope||td.scope||'')});at=r.access_token;res=await fetch(activitiesUrl,{headers:{'Authorization':`Bearer ${at}`}});}
    if(!res.ok)throw await stravaBuildHttpError(res,activitiesUrl);
    const acts=await res.json();
    await window._fb.setData('strava_activities',acts);
    const detailResult=await enrichNewStravaActivities(acts,previousActivities,at);
    window._stravaDetailCache=await window._fb.getData('strava_activity_details')||{};
    await window._fb.setData('strava_last_sync',Date.now());
    renderStravaActivities(acts);matchWorkoutsToPlan(true);
    showToast(`✅ Synced ${acts.length} activities · ละเอียด ${detailResult.enriched} รายการ`);
  }catch(e){showToast('Error: '+e.message,'error');}
  finally{if(btn){btn.innerHTML=oldHTML;btn.disabled=false;}}
}
function stravaTokenExpired(){showToast('⚠️ Token expired — reconnect','error');window._fb.removeData('strava_token').catch(()=>{});renderStravaPage();}
async function stravaDisconnect(){if(!confirm('Disconnect Strava?'))return;await window._fb.removeData('strava_token');await window._fb.removeData('strava_activities');renderStravaPage();showToast('Disconnected');}
async function renderStravaPage(){
  const td=await window._fb.getData('strava_token');
  const sb=document.getElementById('strava-status-box'),cb=document.getElementById('btn-strava-connect'),db=document.getElementById('btn-strava-disconnect'),sync=document.getElementById('btn-strava-sync');
  if(td?.access_token){
    const a=td.athlete||{};
    sb.style.cssText='background:rgba(252,76,2,.1);border:1.5px solid rgba(252,76,2,.3);border-radius:var(--r);padding:8px 14px;display:flex;align-items:center;gap:10px';
    sb.innerHTML=`<div style="width:8px;height:8px;border-radius:50%;background:var(--strava)"></div><div><div style="font-weight:700;color:var(--strava);font-size:12px">${a.firstname||''} ${a.lastname||''}</div><div style="font-size:10px;color:var(--text2)">${td.refresh_token?'🔄 Auto-refresh':'⚠️ Manual'}</div></div>`;
    cb.style.display='none';db.style.display='block';sync.style.display='inline-flex';
    document.getElementById('strava-guide-box').style.display='none';
    const cached=await window._fb.getData('strava_activities');
    window._stravaDetailCache=await window._fb.getData('strava_activity_details')||{};
    if(cached)renderStravaActivities(Array.isArray(cached)?cached:Object.values(cached));
    else document.getElementById('strava-activities-list').innerHTML='<p class="text-sm c2">Press Sync to load activities</p>';
    const lastSync=await window._fb.getData('strava_last_sync');
    const lastSyncEl=document.getElementById('strava-last-sync');
    if(lastSyncEl)lastSyncEl.textContent=lastSync?`ซิงค์ล่าสุด ${new Date(lastSync).toLocaleString('th-TH')}`:'ยังไม่เคยซิงค์';
  }else{
    sb.style.cssText='background:var(--surface);border-radius:var(--r);padding:8px 14px;display:flex;align-items:center;gap:8px;border:1.5px solid var(--border)';
    sb.innerHTML='<div style="width:7px;height:7px;border-radius:50%;background:var(--text3)"></div><span style="font-size:12px;color:var(--text2)">Not connected</span>';
    cb.style.display='block';db.style.display='none';sync.style.display='none';
    document.getElementById('strava-guide-box').style.display='block';
    document.getElementById('strava-week-strip').style.display='none';
  }
}

let stravaVisibleLimit=10;
let stravaFilteredActs=[];

function switchStravaTab(tab,element){
  document.querySelectorAll('#strava-tabs .seg-tab').forEach(item=>item.classList.remove('active'));
  element?.classList.add('active');
  const overview=document.getElementById('strava-overview-view');
  const activities=document.getElementById('strava-activities-view');
  if(overview)overview.style.display=tab==='overview'?'block':'none';
  if(activities)activities.style.display=tab==='activities'?'block':'none';
  if(tab==='overview')setTimeout(()=>renderStravaOverview(window._stravaAllActs||[]),50);
  else applyStravaFilters();
  document.querySelector('.main')?.scrollTo({top:0,behavior:'smooth'});
}

function stravaWeekSummary(acts,start){
  const end=new Date(start);end.setDate(end.getDate()+7);
  const rows=acts.filter(a=>{const d=stravaLocalDate(a);return d&&d>=start&&d<end;});
  const runs=rows.filter(a=>a.type==='Run'&&a.distance>0);
  const hrs=rows.map(a=>+a.average_heartrate).filter(Number.isFinite);
  return {
    rows,
    distance:rows.reduce((sum,a)=>sum+(+a.distance||0),0)/1000,
    pace:runs.length?runs.reduce((sum,a)=>sum+a.moving_time/a.distance*1000,0)/runs.length:0,
    hr:hrs.length?hrs.reduce((sum,value)=>sum+value,0)/hrs.length:0
  };
}

function setStravaDelta(id,current,previous,inverse=false,suffix='%'){
  const element=document.getElementById(id);if(!element)return;
  if(!previous){element.textContent='ยังไม่มีช่วงก่อนหน้า';element.style.color='var(--text3)';return;}
  const pct=(current-previous)/previous*100;
  const good=inverse?pct<=0:pct>=0;
  element.textContent=`${pct>=0?'↑':'↓'} ${Math.abs(pct).toFixed(0)}${suffix} จากสัปดาห์ก่อน`;
  element.style.color=good?'var(--green)':'var(--orange)';
}

// Retained only for reference while the Sources surface is migrated; the later renderer is authoritative.
function renderStravaOverviewLegacy(acts){
  if(!acts?.length)return;
  const currentStart=getThisWeekStart();
  const previousStart=new Date(currentStart);previousStart.setDate(previousStart.getDate()-7);
  const current=stravaWeekSummary(acts,currentStart);
  const previous=stravaWeekSummary(acts,previousStart);
  const strip=document.getElementById('strava-week-strip');if(strip)strip.style.display='grid';
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  set('sv-dist',current.distance.toFixed(2));set('sv-count',current.rows.length);
  set('sv-pace',current.pace?formatPace(current.pace/60):'—');set('sv-hr',current.hr?Math.round(current.hr):'—');
  setStravaDelta('sv-dist-delta',current.distance,previous.distance);
  setStravaDelta('sv-count-delta',current.rows.length,previous.rows.length);
  setStravaDelta('sv-pace-delta',current.pace,previous.pace,true);
  setStravaDelta('sv-hr-delta',current.hr,previous.hr,true);

  const labels=[],distances=[],paces=[],hrs=[];
  for(let offset=7;offset>=0;offset--){
    const start=new Date(currentStart);start.setDate(start.getDate()-offset*7);
    const summary=stravaWeekSummary(acts,start);
    labels.push(start.toLocaleDateString('th-TH',{day:'numeric',month:'short'}));
    distances.push(+summary.distance.toFixed(1));
    paces.push(summary.pace?+(summary.pace/60).toFixed(2):null);
    hrs.push(summary.hr?Math.round(summary.hr):null);
  }
  const colors=getChartColors();
  if(charts.stravaDistance)charts.stravaDistance.destroy();
  const distanceContext=document.getElementById('chart-strava-distance')?.getContext('2d');
  if(distanceContext)charts.stravaDistance=new Chart(distanceContext,{type:'bar',data:{labels,datasets:[{label:'km',data:distances,backgroundColor:'rgba(252,76,2,.65)',borderRadius:7}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:colors.tick,font:{size:9}}},y:{beginAtZero:true,grid:{color:colors.grid},ticks:{color:colors.tick,font:{size:9}}}}}});
  if(charts.stravaPerformance)charts.stravaPerformance.destroy();
  const performanceContext=document.getElementById('chart-strava-performance')?.getContext('2d');
  if(performanceContext)charts.stravaPerformance=new Chart(performanceContext,{
    type:'line',
    data:{labels,datasets:[
      {
        label:'Pace /km',data:paces,borderColor:'#007AFF',backgroundColor:'rgba(0,122,255,.10)',
        borderWidth:3,pointBackgroundColor:'#007AFF',pointBorderColor:'#FFFFFF',pointBorderWidth:1.5,
        pointRadius:4,pointHoverRadius:6,pointStyle:'circle',fill:true,tension:.3,spanGaps:true,yAxisID:'y'
      },
      {
        label:'HR bpm',data:hrs,borderColor:'#FF2D55',backgroundColor:'transparent',
        borderWidth:2.5,borderDash:[7,5],pointBackgroundColor:'#FF2D55',pointBorderColor:'#FFFFFF',pointBorderWidth:1.5,
        pointRadius:4,pointHoverRadius:6,pointStyle:'triangle',fill:false,tension:.3,spanGaps:true,yAxisID:'y1'
      }
    ]},
    options:{
      responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{labels:{color:colors.tick,usePointStyle:true,boxWidth:10,padding:18,font:{size:10}}}},
      scales:{
        x:{grid:{display:false},ticks:{color:colors.tick,font:{size:9}}},
        y:{reverse:true,grid:{color:colors.grid},ticks:{color:'#007AFF',callback:value=>formatPace(value),font:{size:9}},title:{display:true,text:'PACE /KM',color:'#007AFF',font:{size:9,weight:'bold'}}},
        y1:{position:'right',grid:{display:false},ticks:{color:'#FF2D55',font:{size:9}},title:{display:true,text:'HR BPM',color:'#FF2D55',font:{size:9,weight:'bold'}}}
      }
    }
  });
  renderStravaPRs(acts);
}

function renderStravaPRs(acts){
  const runs=acts.filter(a=>a.type==='Run'&&a.distance>0&&a.moving_time>0);
  const targets=[['5K',5],['10K',10],['Half',21.0975]];
  const element=document.getElementById('strava-pr-grid');if(!element)return;
  element.innerHTML=targets.map(([label,km])=>{
    const candidates=runs.filter(a=>a.distance/1000>=km*.95).map(a=>({activity:a,seconds:a.moving_time/(a.distance/1000)*km})).sort((a,b)=>a.seconds-b.seconds);
    if(!candidates.length)return `<div class="strava-pr"><div class="stat-label">${label}</div><div class="c3">ยังไม่มีข้อมูล</div></div>`;
    const best=candidates[0],minutes=Math.floor(best.seconds/60),seconds=Math.round(best.seconds%60);
    return `<div class="strava-pr"><div class="stat-label">${label} estimate</div><div style="font:30px/1 var(--font-display);color:var(--strava)">${minutes}:${String(seconds).padStart(2,'0')}</div><div class="text-xs c3 mt-8">${formatStravaLocal(best.activity,'th-TH',{day:'numeric',month:'numeric',year:'numeric'})} · ${best.activity.name||'Run'}</div></div>`;
  }).join('');
}

function setStravaOverviewState({connected=false,hasData=false}={}){
  const empty=document.getElementById('strava-empty-state');
  const strip=document.getElementById('strava-week-strip');
  const chartsWrap=document.getElementById('strava-overview-charts');
  const prCard=document.getElementById('strava-pr-card');
  if(empty)empty.style.display=!connected?'block':'none';
  if(strip)strip.style.display=hasData?'grid':'none';
  if(chartsWrap)chartsWrap.style.display=hasData?'grid':'none';
  if(prCard)prCard.style.display=hasData?'block':'none';
}

function sourceCountBy(workouts, field, value){
  return (workouts||[]).filter(w=>w?.[field]===value).length;
}

function sourceRelativeTime(ms){
  if(!ms)return 'never';
  return new Date(ms).toLocaleString('th-TH');
}

function recoveryStatusCounts(recovery){
  return Object.values(recovery||{}).reduce((acc,row)=>{
    const status=row?.status||'unknown';
    acc[status]=(acc[status]||0)+1;
    return acc;
  },{});
}

function renderSourcesOverview({healthStatus={},recovery={},workouts=[],stravaToken=null,stravaActivities=[]}={}){
  const card=document.getElementById('sources-overview-card');if(!card)return;
  const healthCount=sourceCountBy(workouts,'source','health_connect');
  const recoveredCount=sourceCountBy(workouts,'source','strava_recovered');
  const archiveCount=sourceCountBy(workouts,'source','strava_archive')+sourceCountBy(workouts,'source','strava');
  const manualCount=(workouts||[]).filter(w=>!['health_connect','strava_recovered','strava_archive','strava'].includes(w?.source)).length;
  const recoveryCounts=recoveryStatusCounts(recovery);
  const stagedTotal=Object.keys(recovery||{}).length;
  const duplicateCount=recoveryCounts.duplicate_candidate||0;
  const liveDuplicatePairs=typeof duplicateCandidatePairs==='function'?duplicateCandidatePairs():[];
  const reviewCount=recoveryCounts.review_later||0;
  const restoredStageCount=recoveryCounts.restore_candidate||0;
  const healthReady=healthCount>0||healthStatus?.last_sync;
  const stravaActive=!!stravaToken?.access_token;
  const sourceApps=[...new Set((workouts||[]).filter(w=>w?.source==='health_connect'&&w.sourceApp).map(w=>w.sourceApp))];
  const healthSub=healthStatus?.last_sync
    ? `Last sync ${sourceRelativeTime(healthStatus.last_sync)} · scanned ${healthStatus.scanned||0}, imported ${healthStatus.imported||0}, skipped ${healthStatus.skipped||0}`
    : 'Use the Android companion to sync Garmin data through Health Connect.';
  const appText=sourceApps.length?`Source app: ${escapeHTML(sourceApps.join(', '))}`:'Source app will appear after sync.';
  card.innerHTML=`
    <div class="card-label">Sync source status</div>
    <div class="strava-overview-grid mb-16" style="display:grid">
      <div class="stat-card">
        <div class="stat-label">Primary Source</div>
        <div style="font-size:20px;font-weight:900;color:${healthReady?'var(--green)':'var(--orange)'}">Health Connect</div>
        <div class="text-xs c3 mt-8">${escapeHTML(healthSub)}</div>
        <div class="text-xs c3 mt-8">${appText}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Health Workouts</div>
        <span class="stat-value" style="font-size:28px">${healthCount}</span>
        <span class="stat-unit">saved</span>
      </div>
      <div class="stat-card">
        <div class="stat-label">Recovered Strava</div>
        <span class="stat-value" style="font-size:28px">${recoveredCount}</span>
        <span class="stat-unit">saved</span>
        <div class="text-xs c3 mt-8">Live possible duplicates: ${liveDuplicatePairs.length}</div>
        <div class="text-xs c3 mt-8">${stagedTotal} staged · ${duplicateCount} duplicate · ${reviewCount} review</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Legacy Strava API</div>
        <div style="font-size:20px;font-weight:900;color:${stravaActive?'var(--strava)':'var(--text3)'}">${stravaActive?'Connected':'Inactive'}</div>
        <div class="text-xs c3 mt-8">${stravaActivities.length} cached · ${archiveCount} archive workouts · ${manualCount} manual/local workouts</div>
      </div>
    </div>
    <div class="empty-state" style="border-style:solid">
      <div class="empty-state-title">Current plan</div>
      <div class="empty-state-copy">Use Garmin -> Health Connect -> MyDash Sync as the daily path. Keep Strava for legacy cache, archive import, and review-only duplicate handling. Do not blindly merge staged Strava rows into workouts.</div>
      <div class="empty-actions mt-12">
        <button class="btn btn-green btn-sm" onclick="showToast('Open the Android MyDash Sync app, then tap Sync last 30 days.')">Health Connect sync</button>
        <button class="btn btn-ghost btn-sm" onclick="showPage('fitness-log')">View workouts</button>
        <button class="btn btn-ghost btn-sm" onclick="showToast('${stagedTotal} staged Strava records: ${duplicateCount} duplicates, ${reviewCount} review later, ${restoredStageCount} restored candidates logged.')">Recovery summary</button>
      </div>
    </div>`;
}

async function renderStravaPage(){
  const [td,healthStatus,recovery,workoutsData,cached]=await Promise.all([
    window._fb.getData('strava_token').catch(()=>null),
    window._fb.getData('sync_sources/health_connect').catch(()=>({})),
    window._fb.getData('imports/strava_cache_recovery').catch(()=>({})),
    window._fb.getData('workouts').catch(()=>({})),
    window._fb.getData('strava_activities').catch(()=>null)
  ]);
  const workouts=workoutsData?(Array.isArray(workoutsData)?workoutsData.filter(Boolean):Object.values(workoutsData)):[];
  const legacyActs=cached?(Array.isArray(cached)?cached:Object.values(cached)):[];
  renderSourcesOverview({healthStatus:healthStatus||{},recovery:recovery||{},workouts,stravaToken:td,stravaActivities:legacyActs});
  const sb=document.getElementById('strava-status-box'),cb=document.getElementById('btn-strava-connect'),db=document.getElementById('btn-strava-disconnect'),sync=document.getElementById('btn-strava-sync');
  if(td?.access_token){
    const a=td.athlete||{};
    sb.style.cssText='background:rgba(252,76,2,.1);border:1.5px solid rgba(252,76,2,.3);border-radius:var(--r);padding:8px 14px;display:flex;align-items:center;gap:10px';
    sb.innerHTML=`<div style="width:8px;height:8px;border-radius:50%;background:var(--strava)"></div><div><div style="font-weight:700;color:var(--strava);font-size:12px">${a.firstname||''} ${a.lastname||''}</div><div style="font-size:10px;color:var(--text2)">${td.refresh_token?'🔄 Auto-refresh':'⚠️ Manual'}</div></div>`;
    cb.style.display='none';db.style.display='block';sync.style.display='inline-flex';
    document.getElementById('strava-guide-box').style.display='none';
    window._stravaDetailCache=await window._fb.getData('strava_activity_details')||{};
    if(legacyActs.length){
      setStravaOverviewState({connected:true,hasData:true});
      renderStravaActivities(legacyActs);
    } else {
      setStravaOverviewState({connected:true,hasData:false});
      document.getElementById('strava-activities-list').innerHTML=`<div class="empty-state"><div class="empty-state-title">Legacy Strava connected</div><div class="empty-state-copy">This path is kept for recovery only. Daily sync should use Garmin through Health Connect.</div><div class="empty-actions"><button class="btn btn-strava btn-sm" onclick="stravaSync()">Legacy sync once</button></div></div>`;
    }
    const lastSync=await window._fb.getData('strava_last_sync');
    const lastSyncEl=document.getElementById('strava-last-sync');
    if(lastSyncEl)lastSyncEl.textContent=lastSync?`ซิงก์ล่าสุด ${new Date(lastSync).toLocaleString('th-TH')}`:'ยังไม่เคยซิงก์';
  }else{
    sb.style.cssText='background:var(--surface);border-radius:var(--r);padding:8px 14px;display:flex;align-items:center;gap:8px;border:1.5px solid var(--border)';
    sb.innerHTML='<div style="width:7px;height:7px;border-radius:50%;background:var(--text3)"></div><span style="font-size:12px;color:var(--text2)">Not connected</span>';
    cb.style.display='block';db.style.display='none';sync.style.display='none';
    document.getElementById('strava-guide-box').style.display='block';
    setStravaOverviewState({connected:false,hasData:false});
    document.getElementById('strava-activities-list').innerHTML='<div class="empty-state"><div class="empty-state-title">Legacy Strava inactive</div><div class="empty-state-copy">Strava API is no longer the primary path. Use this section only for old cache, paid one-time export, or archive import review.</div></div>';
  }
}

function renderStravaOverview(acts){
  if(!acts?.length){
    setStravaOverviewState({connected:document.getElementById('btn-strava-connect')?.style.display==='none',hasData:false});
    return;
  }
  setStravaOverviewState({connected:true,hasData:true});
  const currentStart=getThisWeekStart();
  const previousStart=new Date(currentStart);previousStart.setDate(previousStart.getDate()-7);
  const current=stravaWeekSummary(acts,currentStart);
  const previous=stravaWeekSummary(acts,previousStart);
  const strip=document.getElementById('strava-week-strip');if(strip)strip.style.display='grid';
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  set('sv-dist',current.distance.toFixed(2));set('sv-count',current.rows.length);
  set('sv-pace',current.pace?formatPace(current.pace/60):'—');set('sv-hr',current.hr?Math.round(current.hr):'—');
  setStravaDelta('sv-dist-delta',current.distance,previous.distance);
  setStravaDelta('sv-count-delta',current.rows.length,previous.rows.length);
  setStravaDelta('sv-pace-delta',current.pace,previous.pace,true);
  setStravaDelta('sv-hr-delta',current.hr,previous.hr,true);

  const labels=[],distances=[],paces=[],hrs=[];
  for(let offset=7;offset>=0;offset--){
    const start=new Date(currentStart);start.setDate(start.getDate()-offset*7);
    const summary=stravaWeekSummary(acts,start);
    labels.push(start.toLocaleDateString('th-TH',{day:'numeric',month:'short'}));
    distances.push(+summary.distance.toFixed(1));
    paces.push(summary.pace?+(summary.pace/60).toFixed(2):null);
    hrs.push(summary.hr?Math.round(summary.hr):null);
  }
  const colors=getChartColors();
  if(charts.stravaDistance)charts.stravaDistance.destroy();
  const distanceContext=document.getElementById('chart-strava-distance')?.getContext('2d');
  if(distanceContext)charts.stravaDistance=new Chart(distanceContext,{type:'bar',data:{labels,datasets:[{label:'km',data:distances,backgroundColor:'rgba(252,76,2,.65)',borderRadius:7}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:colors.tick,font:{size:9}}},y:{beginAtZero:true,grid:{color:colors.grid},ticks:{color:colors.tick,font:{size:9}}}}}});
  if(charts.stravaPerformance)charts.stravaPerformance.destroy();
  const performanceContext=document.getElementById('chart-strava-performance')?.getContext('2d');
  if(performanceContext)charts.stravaPerformance=new Chart(performanceContext,{
    type:'line',
    data:{labels,datasets:[
      {label:'Pace /km',data:paces,borderColor:'#007AFF',backgroundColor:'rgba(0,122,255,.10)',borderWidth:3,pointBackgroundColor:'#007AFF',pointBorderColor:'#FFFFFF',pointBorderWidth:1.5,pointRadius:4,pointHoverRadius:6,pointStyle:'circle',fill:true,tension:.3,spanGaps:true,yAxisID:'y'},
      {label:'HR bpm',data:hrs,borderColor:'#FF2D55',backgroundColor:'transparent',borderWidth:2.5,borderDash:[7,5],pointBackgroundColor:'#FF2D55',pointBorderColor:'#FFFFFF',pointBorderWidth:1.5,pointRadius:4,pointHoverRadius:6,pointStyle:'triangle',fill:false,tension:.3,spanGaps:true,yAxisID:'y1'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:colors.tick,usePointStyle:true,boxWidth:10,padding:18,font:{size:10}}}},scales:{x:{grid:{display:false},ticks:{color:colors.tick,font:{size:9}}},y:{reverse:true,grid:{color:colors.grid},ticks:{color:'#007AFF',callback:value=>formatPace(value),font:{size:9}},title:{display:true,text:'PACE /KM',color:'#007AFF',font:{size:9,weight:'bold'}}},y1:{position:'right',grid:{display:false},ticks:{color:'#FF2D55',font:{size:9}},title:{display:true,text:'HR BPM',color:'#FF2D55',font:{size:9,weight:'bold'}}}}}
  });
  renderStravaPRs(acts);
}

function applyStravaFilters(){
  const all=window._stravaAllActs||[];
  const type=document.getElementById('strava-filter-type')?.value||'all';
  const days=+(document.getElementById('strava-filter-days')?.value||0);
  const search=(document.getElementById('strava-filter-search')?.value||'').trim().toLowerCase();
  const cutoff=days?dateDaysAgo(days-1):null;
  stravaFilteredActs=all.filter(a=>{
    const matchesType=type==='all'||a.type===type;
    const localDate=stravaLocalDate(a);
    const matchesDate=!cutoff||(localDate&&localDate>=cutoff);
    const matchesSearch=!search||(a.name||'').toLowerCase().includes(search);
    return matchesType&&matchesDate&&matchesSearch;
  });
  stravaVisibleLimit=10;
  renderStravaActivityCards();
}

function loadMoreStrava(){stravaVisibleLimit+=10;renderStravaActivityCards();}

function renderStravaActivityCards(){
  const container=document.getElementById('strava-activities-list');if(!container)return;
  const visible=stravaFilteredActs.slice(0,stravaVisibleLimit);
  window._stravaVisibleActs=visible;
  const result=document.getElementById('strava-filter-result');if(result)result.textContent=`พบ ${stravaFilteredActs.length} กิจกรรม · แสดง ${visible.length}`;
  const more=document.getElementById('strava-load-more');if(more)more.style.display=visible.length<stravaFilteredActs.length?'flex':'none';
  if(!visible.length){container.innerHTML='<div class="card text-sm c2">ไม่พบกิจกรรมตามตัวกรอง</div>';return;}
  const emoji={Run:'🏃',Ride:'🚴',Swim:'🏊',Walk:'🚶',Hike:'🥾',WeightTraining:'🏋️',Workout:'💪'};
  container.innerHTML=visible.map((a,index)=>{
    const distance=(a.distance/1000).toFixed(2),minutes=Math.floor(a.moving_time/60);
    const pace=(a.type==='Run'||a.type==='Walk')&&a.distance>0?formatPace(a.moving_time/a.distance*1000/60):'';
    const date=formatStravaLocal(a,'th-TH',{weekday:'short',day:'numeric',month:'short'});
    const cachedAnalysis=window._stravaDetailCache?.[a.id]?.analysis;
    const effectiveType=cachedAnalysis?.userType||cachedAnalysis?.detectedType;
    const typeLabels={interval:'INTERVAL',possible_interval:'POSSIBLE INTERVAL',recovery:'RECOVERY',easy:'EASY',steady:'STEADY',tempo:'TEMPO',threshold:'THRESHOLD'};
    const typeColors={interval:'var(--strava)',possible_interval:'var(--orange)',recovery:'#5AC8FA',easy:'var(--green)',steady:'var(--teal)',tempo:'var(--purple)',threshold:'var(--red)'};
    const analysisBadge=effectiveType
      ?`<span style="font-size:9px;padding:2px 7px;border-radius:999px;background:var(--bg2);color:${typeColors[effectiveType]||'var(--text2)'};font-weight:800">${typeLabels[effectiveType]||effectiveType.toUpperCase()} ${cachedAnalysis.confidence}%</span>`:'';
    return `<div class="card" style="padding:14px;cursor:pointer" onclick="openStravaDetail(${index})">
      <div class="flex justify-between gap-12">
        <div style="min-width:0"><div class="text-xs c3">${date} · ${emoji[a.type]||'🏅'} ${a.type}</div><div class="act-name" style="font-size:15px;font-weight:800;margin-top:3px">${a.name||'Activity'}</div><div class="mt-8">${analysisBadge}</div></div><span class="c3">›</span>
      </div>
      <div class="act-stats mt-12">
        <div><div class="stat-label">Distance</div><div class="mono bold">${distance} km</div></div>
        <div><div class="stat-label">Time</div><div class="mono bold">${minutes} min</div></div>
        ${pace?`<div><div class="stat-label">Pace</div><div class="mono bold">${pace}/km</div></div>`:''}
        ${a.average_heartrate?`<div><div class="stat-label">HR</div><div class="mono bold" style="color:var(--red)">${Math.round(a.average_heartrate)} bpm</div></div>`:''}
      </div>
    </div>`;
  }).join('');
}

function renderStravaActivities(acts){
  AppState.set('stravaWorkouts', (acts||[]).map(a=>({date:stravaLocalDateStr(a),dist:+(a.distance/1000).toFixed(2),time:+(a.moving_time/60).toFixed(1),hr:a.average_heartrate?Math.round(a.average_heartrate):0,cad:a.average_cadence?Math.round(a.average_cadence*2):0,avgPace:a.distance>0?a.moving_time/a.distance*1000/60:0,type:a.type==='Run'?'run':a.type==='Ride'?'bike':a.type==='Swim'?'swim':'run',name:a.name,source:'strava_archive',stravaId:a.id,archiveOnly:true})));
  window._stravaAllActs=acts||[];
  AppState.set('stravaActs',acts||[]);
  renderStravaOverview(acts||[]);
  applyStravaFilters();
  return;
  // Note: renderTodayStats + matchWorkoutsToPlan are triggered by AppState subscriber above
  const strip=document.getElementById('strava-week-strip');
  if(strip&&acts?.length){
    strip.style.display='grid';
    const cutoffStr=toLocalDateStr(getThisWeekStart());
    const wk=acts.filter(a=>stravaLocalDateStr(a)>=cutoffStr);
    const wkDist=wk.reduce((s,a)=>s+a.distance/1000,0);
    const wkHR=wk.filter(a=>a.average_heartrate).map(a=>a.average_heartrate);
    const wkPaceSec=wk.filter(a=>a.distance>0&&a.type==='Run').map(a=>a.moving_time/a.distance*1000);
    const avgPace=wkPaceSec.length?wkPaceSec.reduce((s,p)=>s+p,0)/wkPaceSec.length:0;
    document.getElementById('sv-dist').textContent=wkDist.toFixed(2);
    document.getElementById('sv-count').textContent=wk.length;
    document.getElementById('sv-pace').textContent=avgPace>0?formatPace(avgPace/60):'—';
    document.getElementById('sv-hr').textContent=wkHR.length?Math.round(wkHR.reduce((s,h)=>s+h,0)/wkHR.length):'—';
  }
  const c=document.getElementById('strava-activities-list');
  if(!acts?.length){c.innerHTML='<p class="text-sm c2">No activities</p>';return;}
  AppState.set('stravaActs', acts);
  const em={Run:'🏃',Ride:'🚴',Swim:'🏊',Walk:'🚶',Hike:'🥾',WeightTraining:'🏋️',Workout:'💪'};
  const typeCol={Run:'var(--accent)',Ride:'var(--green)',Swim:'#5AC8FA',Walk:'var(--text2)',Hike:'var(--orange)'};
  c.innerHTML=acts.slice(0,20).map((a,idx)=>{
    const dist=(a.distance/1000).toFixed(2),mins=Math.floor(a.moving_time/60),secs=a.moving_time%60;
    const paceSec=a.distance>0?a.moving_time/a.distance*1000:0;
    const pace=(a.type==='Run'||a.type==='Walk')&&paceSec>0?formatPace(paceSec/60):'';
    const hr=a.average_heartrate?Math.round(a.average_heartrate):0;
    const elev=a.total_elevation_gain?Math.round(a.total_elevation_gain):0;
    const cad=a.average_cadence?Math.round(a.average_cadence*2):0;
    const dateStr=formatStravaLocal(a,'en-GB',{weekday:'short',day:'numeric',month:'short'});
    const color=typeCol[a.type]||'var(--text2)';
    // Map thumbnail: use Leaflet mini-map or static placeholder with polyline
    const hasMap = !!(a.map?.summary_polyline);
    const mapThumb = hasMap
      ? `<div id="smap-${idx}" class="smap-thumb" style="width:100px;min-width:100px;height:100%;min-height:110px;background:var(--bg2);border-left:1px solid var(--border);position:relative;overflow:hidden;flex-shrink:0">
           <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;color:var(--text3);font-size:11px">
             <span style="font-size:22px">🗺️</span><span>แตะดูแผนที่</span>
           </div>
         </div>`
      : `<div class="smap-thumb" style="width:70px;min-width:70px;background:var(--bg2);border-left:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;opacity:.35">
           <span style="font-size:28px">🏃</span>
         </div>`;
    return `<div style="background:var(--surface);border:1.5px solid var(--border);border-radius:var(--r-lg);overflow:hidden;transition:all .2s;cursor:pointer;display:flex;max-width:100%" onclick="openStravaDetail(${idx})" onmouseover="this.style.borderColor='var(--border2)';this.style.boxShadow='var(--shadow)'" onmouseout="this.style.borderColor='var(--border)';this.style.boxShadow='none'">
      <div style="padding:12px;flex:1;min-width:0;overflow:hidden">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
          <div style="min-width:0;flex:1"><div style="font-size:10px;color:var(--text3);margin-bottom:3px;letter-spacing:.5px">${dateStr} · ${em[a.type]||'🏅'} <span style="color:${color};font-weight:700">${a.type.toUpperCase()}</span></div><div class="act-name" style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.name}</div></div>
          <span style="color:var(--text3);font-size:16px;flex-shrink:0;margin-left:6px">›</span>
        </div>
        <div class="act-stats" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${dist>0?`<div><div style="font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin-bottom:2px">Dist</div><div style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:${color}">${dist}<span style="font-size:9px;color:var(--text2);margin-left:2px">km</span></div></div>`:''}
          ${pace?`<div><div style="font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin-bottom:2px">Pace</div><div style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:var(--green)">${pace}<span style="font-size:9px;color:var(--text2);margin-left:2px">/km</span></div></div>`:''}
          <div><div style="font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin-bottom:2px">Time</div><div style="font-family:var(--font-mono);font-size:16px;font-weight:700">${mins}<span style="font-size:9px;color:var(--text2);margin-left:2px">m</span></div></div>
          ${hr?`<div><div style="font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin-bottom:2px">HR</div><div style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:var(--red)">${hr}<span style="font-size:9px;color:var(--text2);margin-left:2px">bpm</span></div></div>`:''}
        </div>
      </div>
      ${mapThumb}
    </div>`;
  }).join('');
  // Load mini Leaflet maps for each card with polyline
  loadLeaflet(() => {
    acts.slice(0,20).forEach((a, idx) => {
      if (!a.map?.summary_polyline) return;
      const el = document.getElementById(`smap-${idx}`);
      if (!el) return;
      // Destroy existing Leaflet instance if already initialized
      if (el._leaflet_id) {
        try { L.map(el).remove(); } catch(e) {}
        el._leaflet_id = null;
      }
      el.innerHTML = '';
      try {
        const coords = decodePolyline(a.map.summary_polyline);
        if (!coords.length) return;
        const miniMap = L.map(el, { zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false, doubleClickZoom:false, touchZoom:false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(miniMap);
        const line = L.polyline(coords, { color:'#FC4C02', weight:3 }).addTo(miniMap);
        miniMap.fitBounds(line.getBounds(), { padding:[8,8] });
        L.circleMarker(coords[0], { radius:5, color:'#34C759', fillColor:'#34C759', fillOpacity:1, weight:2 }).addTo(miniMap);
        L.circleMarker(coords[coords.length-1], { radius:5, color:'#FF3B30', fillColor:'#FF3B30', fillOpacity:1, weight:2 }).addTo(miniMap);
      } catch(e) { console.warn('minimap error', e); }
    });
  });
}

let stravaDetailChart=null;

async function openStravaDetail(idx){
  const activity=(window._stravaVisibleActs||window._stravaActs||[])[idx];if(!activity)return;
  const existing=document.getElementById('strava-detail-overlay');if(existing)existing.remove();
  const overlay=document.createElement('div');overlay.id='strava-detail-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(8px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML=`<div style="background:var(--surface);border:1.5px solid var(--border);border-radius:var(--r-xl);padding:20px;max-width:760px;width:100%;max-height:92vh;overflow-y:auto;box-shadow:var(--shadow-lg)">
    <div class="flex justify-between gap-12 mb-16">
      <div><div style="font-size:20px;font-weight:800">${activity.name||'Strava Activity'}</div><div class="text-xs c2 mt-8">${formatStravaLocal(activity,'th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div></div>
      <button onclick="closeStravaDetail()" class="btn btn-ghost btn-xs">✕</button>
    </div>
    <div id="strava-detail-content"><div style="padding:40px;text-align:center;color:var(--text2)">⏳ กำลังโหลด Laps และ Streams...</div></div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',event=>{if(event.target===overlay)closeStravaDetail();});
  window._activeStravaActivity=activity;
  try{
    let payload=await window._fb.getData(`strava_activity_details/${activity.id}`);
    if(!payload?.analysisVersion){
      const token=await stravaGetValidToken();if(!token)throw new Error('ไม่พบ Strava access token');
      payload=await fetchStravaActivityDetail(activity,token);
    }
    window._activeStravaDetail=payload;
    renderStravaDetailModal('overview');
  }catch(error){
    console.warn(error);
    window._activeStravaDetail=null;
    renderStravaDetailModal('overview',error.message);
  }
}

function closeStravaDetail(){
  if(stravaDetailChart){stravaDetailChart.destroy();stravaDetailChart=null;}
  document.getElementById('strava-detail-overlay')?.remove();
}

function switchStravaDetailTab(tab,button){
  document.querySelectorAll('.strava-detail-tab').forEach(item=>item.classList.toggle('active',item===button));
  renderStravaDetailPanel(tab);
}

function renderStravaDetailModal(activeTab='overview',error=''){
  const content=document.getElementById('strava-detail-content');if(!content)return;
  content.innerHTML=`
    <div class="strava-detail-tabs">
      <button class="strava-detail-tab ${activeTab==='overview'?'active':''}" onclick="switchStravaDetailTab('overview',this)">Overview</button>
      <button class="strava-detail-tab ${activeTab==='laps'?'active':''}" onclick="switchStravaDetailTab('laps',this)">Laps</button>
      <button class="strava-detail-tab ${activeTab==='streams'?'active':''}" onclick="switchStravaDetailTab('streams',this)">Pace & HR</button>
      <button class="strava-detail-tab ${activeTab==='analysis'?'active':''}" onclick="switchStravaDetailTab('analysis',this)">Session Analysis</button>
    </div>
    ${error?`<div class="wellness-alert warn mb-12">โหลดข้อมูลละเอียดไม่ได้: ${error} · ยังดูข้อมูล Summary ได้ตามปกติ</div>`:''}
    <div id="strava-detail-panel"></div>`;
  renderStravaDetailPanel(activeTab);
}

function renderStravaDetailPanel(tab){
  if(stravaDetailChart){stravaDetailChart.destroy();stravaDetailChart=null;}
  const panel=document.getElementById('strava-detail-panel');if(!panel)return;
  const activity=window._activeStravaActivity||{};
  const payload=window._activeStravaDetail;
  const detail=payload?.detail||activity;
  if(tab==='overview'){
    const distance=(+detail.distance/1000||0).toFixed(2),minutes=Math.floor((+detail.moving_time||0)/60),seconds=(+detail.moving_time||0)%60;
    const pace=detail.distance>0?formatPace(detail.moving_time/detail.distance*1000/60):'—';
    panel.innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px">
        ${sbox('Distance',distance+' km','var(--accent)')}${sbox('Time',minutes+':'+String(seconds).padStart(2,'0'),'var(--green)')}
        ${sbox('Pace',pace+'/km','#007AFF')}${detail.average_heartrate?sbox('HR Avg',Math.round(detail.average_heartrate)+' bpm','#FF2D55'):''}
        ${detail.average_cadence?sbox('Cadence',Math.round(detail.average_cadence*2)+' spm','var(--text2)'):''}
        ${detail.total_elevation_gain?sbox('Elevation',Math.round(detail.total_elevation_gain)+' m','var(--green)'):''}
      </div>
      <div class="wellness-summary-list mb-16">
        <div class="wellness-summary-item"><span class="c2">Strava sport type</span><span>${detail.sport_type||detail.type||'—'}</span></div>
        <div class="wellness-summary-item"><span class="c2">Workout type</span><span>${detail.workout_type??'ไม่ระบุ'}</span></div>
        <div class="wellness-summary-item"><span class="c2">Device</span><span>${detail.device_name||detail.external_id||'—'}</span></div>
        <div class="wellness-summary-item"><span class="c2">ข้อมูลละเอียด</span><span>${payload?`${payload.laps?.length||0} laps · streams cached`:'Summary only'}</span></div>
      </div>
      ${detail.description?`<div class="ai-box" style="display:block;margin-bottom:14px">${detail.description}</div>`:''}
      <div class="flex gap-8 flex-wrap">
        <a href="https://www.strava.com/activities/${detail.id||activity.id}" target="_blank" class="btn btn-strava btn-sm" style="text-decoration:none">ดูบน Strava</a>
        ${payload?`<button class="btn btn-ghost btn-sm" onclick="refreshActiveStravaDetail()">โหลดข้อมูลละเอียดใหม่</button>`:''}
      </div>`;
  }else if(tab==='laps'){
    if(!payload?.laps?.length){panel.innerHTML='<div class="card text-sm c2">กิจกรรมนี้ไม่มีข้อมูล Lap หรือยังโหลดรายละเอียดไม่สำเร็จ</div>';return;}
    const usable=payload.laps.filter(lap=>(+lap.distance||0)>=100&&(+lap.moving_time||0)>=30);
    const roles=payload.analysis?.roles||[];
    panel.innerHTML=`<div style="overflow-x:auto"><table class="strava-lap-table"><thead><tr><th>Lap</th><th>Role</th><th>Distance</th><th>Time</th><th>Pace</th><th>HR</th><th>Cadence</th></tr></thead><tbody>${usable.map((lap,index)=>{
      const role=roles[index]||'steady',time=+lap.moving_time||0;
      return `<tr><td>${lap.lap_index??index+1}</td><td><span class="strava-lap-role ${role}">${role}</span></td><td>${(+lap.distance/1000).toFixed(2)} km</td><td>${Math.floor(time/60)}:${String(time%60).padStart(2,'0')}</td><td>${formatPace(lapPaceMinutes(lap))}</td><td>${lap.average_heartrate?Math.round(lap.average_heartrate):'—'}</td><td>${lap.average_cadence?Math.round(lap.average_cadence*2):'—'}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }else if(tab==='streams'){
    if(!payload?.streams?.time?.length){panel.innerHTML='<div class="card text-sm c2">ไม่มี Streams สำหรับกิจกรรมนี้</div>';return;}
    panel.innerHTML='<div class="strava-stream-chart"><canvas id="chart-strava-detail-stream"></canvas></div><div class="text-xs c3 mt-8">เส้นสีน้ำเงิน = Pace · เส้นชมพูประ = HR</div>';
    setTimeout(()=>renderStravaDetailStreamChart(payload.streams),20);
  }else{
    renderStravaIntervalAnalysis(panel,payload,activity);
  }
}

function renderStravaDetailStreamChart(streams){
  const time=streams.time||[],velocity=streams.velocity_smooth||[],heart=streams.heartrate||[];
  const step=Math.max(1,Math.ceil(time.length/500)),labels=[],paces=[],hrs=[];
  for(let index=0;index<time.length;index+=step){
    labels.push((time[index]/60).toFixed(0));
    paces.push(velocity[index]>0?1000/velocity[index]/60:null);
    hrs.push(heart[index]??null);
  }
  const context=document.getElementById('chart-strava-detail-stream')?.getContext('2d');if(!context)return;
  const colors=getChartColors();
  stravaDetailChart=new Chart(context,{type:'line',data:{labels,datasets:[
    {label:'Pace /km',data:paces,borderColor:'#007AFF',borderWidth:2,pointRadius:0,tension:.15,spanGaps:true,yAxisID:'y'},
    {label:'HR bpm',data:hrs,borderColor:'#FF2D55',borderDash:[6,4],borderWidth:2,pointRadius:0,tension:.15,spanGaps:true,yAxisID:'y1'}
  ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:colors.tick,usePointStyle:true,font:{size:10}}}},scales:{
    x:{grid:{display:false},ticks:{color:colors.tick,maxTicksLimit:8,font:{size:9}},title:{display:true,text:'MINUTES',color:colors.tick}},
    y:{reverse:true,grid:{color:colors.grid},ticks:{color:'#007AFF',callback:value=>formatPace(value),font:{size:9}}},
    y1:{position:'right',grid:{display:false},ticks:{color:'#FF2D55',font:{size:9}}}
  }}});
}

function renderStravaIntervalAnalysis(panel,payload,activity){
  if(!payload?.analysis){panel.innerHTML='<div class="card text-sm c2">ยังไม่มีผลวิเคราะห์เซสชัน</div>';return;}
  const analysis=payload.analysis;
  const effective=analysis.userType||analysis.detectedType;
  const labels={interval:'Interval',possible_interval:'อาจเป็น Interval',recovery:'Recovery',easy:'Easy',steady:'Steady',tempo:'Tempo',threshold:'Threshold'};
  const colors={interval:'var(--strava)',possible_interval:'var(--orange)',recovery:'#5AC8FA',easy:'var(--green)',steady:'var(--teal)',tempo:'var(--purple)',threshold:'var(--red)'};
  const label=labels[effective]||effective;
  const color=colors[effective]||'var(--text)';
  panel.innerHTML=`
    <div class="card mb-16">
      <div class="flex gap-16 items-center">
        <div class="strava-analysis-score" style="border-color:${color}"><div style="font:30px/1 var(--font-display);color:${color}">${analysis.confidence}</div><div class="text-xs c3">confidence</div></div>
        <div><div style="font-size:18px;font-weight:800;color:${color}">${label}</div><div class="text-sm c2 mt-8">${analysis.confirmed?'คุณยืนยันประเภทนี้แล้ว':'ระบบประเมินจาก HR, Pace และรูปแบบ Laps ตาม Athlete Profile'}</div></div>
      </div>
    </div>
    <div class="wellness-kpis mb-16">
      <div class="wellness-kpi"><div class="stat-label">Work reps</div><div class="wellness-kpi-value">${analysis.workCount??'—'}</div></div>
      <div class="wellness-kpi"><div class="stat-label">Consistency</div><div class="wellness-kpi-value">${analysis.consistency??'—'}${analysis.consistency!=null?'%':''}</div></div>
      <div class="wellness-kpi"><div class="stat-label">Pace fade</div><div class="wellness-kpi-value">${analysis.paceFade==null?'—':`${analysis.paceFade>=0?'+':''}${analysis.paceFade.toFixed(1)}%`}</div></div>
      <div class="wellness-kpi"><div class="stat-label">HR recovery</div><div class="wellness-kpi-value">${analysis.hrRecovery==null?'—':`${analysis.hrRecovery.toFixed(0)}`}</div><div class="wellness-kpi-note">bpm ระหว่างช่วงพัก</div></div>
    </div>
    <div class="card mb-16"><div class="card-label">เหตุผลที่ระบบใช้</div><div class="wellness-alerts">${(analysis.reasons||[]).map(reason=>`<div class="wellness-alert">${reason}</div>`).join('')||'<div class="text-sm c2">ยังไม่มีสัญญาณชัด</div>'}</div></div>
    <div class="card">
      <div class="card-label">ยืนยันประเภทเซสชัน</div>
      <div class="text-sm c2 mb-12">การยืนยันจะเก็บเป็นข้อมูลเสริม ยังไม่เปลี่ยน Training Load และ Readiness หลักในระยะนี้</div>
      <div class="flex gap-8 flex-wrap">
        <button class="btn btn-ghost btn-sm" onclick="confirmStravaClassification('${activity.id}','recovery')">Recovery</button>
        <button class="btn btn-green btn-sm" onclick="confirmStravaClassification('${activity.id}','easy')">Easy</button>
        <button class="btn btn-ghost btn-sm" onclick="confirmStravaClassification('${activity.id}','steady')">Steady</button>
        <button class="btn btn-ghost btn-sm" onclick="confirmStravaClassification('${activity.id}','tempo')">Tempo</button>
        <button class="btn btn-danger btn-sm" onclick="confirmStravaClassification('${activity.id}','threshold')">Threshold</button>
        <button class="btn btn-strava btn-sm" onclick="confirmStravaClassification('${activity.id}','interval')">ยืนยัน Interval</button>
        <button class="btn btn-ghost btn-sm" onclick="confirmStravaClassification('${activity.id}',null)">ใช้ผลอัตโนมัติ</button>
      </div>
    </div>`;
}

async function confirmStravaClassification(activityId,type){
  const payload=window._activeStravaDetail;if(!payload)return;
  payload.analysis.userType=type;
  payload.analysis.confirmed=type!==null;
  payload.analysis.confirmedAt=Date.now();
  await window._fb.setData(`strava_activity_details/${activityId}/analysis`,payload.analysis);
  window._stravaDetailCache=window._stravaDetailCache||{};
  window._stravaDetailCache[activityId]=payload;
  renderStravaActivityCards();
  showToast(type?`บันทึกประเภท ${type} แล้ว`:'กลับไปใช้ผลอัตโนมัติแล้ว');
  renderStravaDetailPanel('analysis');
}

async function refreshActiveStravaDetail(){
  const activity=window._activeStravaActivity;if(!activity)return;
  const panel=document.getElementById('strava-detail-panel');if(panel)panel.innerHTML='<div style="padding:30px;text-align:center">⏳ กำลังโหลดใหม่...</div>';
  try{
    const token=await stravaGetValidToken();if(!token)throw new Error('ไม่พบ token');
    window._activeStravaDetail=await fetchStravaActivityDetail(activity,token,{force:true});
    renderStravaDetailModal('overview');
  }catch(error){showToast(error.message,'error');renderStravaDetailModal('overview',error.message);}
}

function sbox(label,value,color){return `<div style="background:var(--bg);border-radius:var(--r);padding:12px"><div style="font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text3);margin-bottom:6px">${label}</div><div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:${color}">${value}</div></div>`;}
let _leafletLoaded=false;
function loadLeaflet(cb){if(_leafletLoaded){cb();return;}const css=document.createElement('link');css.rel='stylesheet';css.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';document.head.appendChild(css);const js=document.createElement('script');js.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';js.onload=()=>{_leafletLoaded=true;cb();};document.head.appendChild(js);}
function decodePolyline(encoded){const coords=[];let index=0,lat=0,lng=0;while(index<encoded.length){let b,shift=0,result=0;do{b=encoded.charCodeAt(index++)-63;result|=(b&0x1f)<<shift;shift+=5;}while(b>=0x20);lat+=(result&1)?~(result>>1):(result>>1);shift=0;result=0;do{b=encoded.charCodeAt(index++)-63;result|=(b&0x1f)<<shift;shift+=5;}while(b>=0x20);lng+=(result&1)?~(result>>1):(result>>1);coords.push([lat/1e5,lng/1e5]);}return coords;}
async function stravaAnalyze(){const cached=await window._fb.getData('strava_activities');const acts=cached?(Array.isArray(cached)?cached:Object.values(cached)):[];if(!acts.length){showToast('Please sync first','error');return;}const summary=acts.slice(0,15).map(a=>`[${formatStravaLocal(a,'en-GB',{day:'2-digit',month:'2-digit',year:'numeric'})}] ${a.type} ${(a.distance/1000).toFixed(2)}km ${Math.floor(a.moving_time/60)}min${a.average_heartrate?' HR'+Math.round(a.average_heartrate):''}`).join('\n');await askDeepSeek(`Strava (${acts.length} activities):\n${summary}\n\nวิเคราะห์ Training Load จุดแข็งและคำแนะนำ 3 ข้อ`,'คุณคือโค้ชวิ่ง วิเคราะห์เป็นภาษาไทย','btn-strava-analyze','strava-ai-output');document.getElementById('strava-ai-output').style.display='block';}


// ── ACTIVITY DETAIL POPUP ──
