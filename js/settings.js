// Settings and athlete profile logic extracted from index.html.
async function saveDeepSeekKey(){const key=document.getElementById('set-deepseek-key').value.trim();if(!key){showToast('Please enter API Key','error');return;}showLoading('Saving...');try{AppState.set('deepseekKey',key);const cfg=await window._fb.getData('settings')||{};cfg.deepseekKey=key;await window._fb.setData('settings',cfg);document.getElementById('deepseek-key-status').innerHTML='<span style="color:var(--green)">✓ Saved & Ready</span>';showToast('✅ API Key saved!');}catch(e){showToast('Error: '+e.message,'error');}finally{hideLoading();}}
async function saveStravaSettings(){showLoading('Saving...');try{const cfg=await window._fb.getData('settings')||{};cfg.stravaId=document.getElementById('set-strava-id').value;cfg.stravaSecret=document.getElementById('set-strava-secret').value;cfg.stravaRedirect=document.getElementById('set-strava-redirect').value;await window._fb.setData('settings',cfg);showToast('✅ Strava settings saved!');}catch(e){showToast('Error: '+e.message,'error');}finally{hideLoading();}}

async function saveDeepSeekKey(){const key=document.getElementById('set-deepseek-key').value.trim();const proxy=document.getElementById('set-ai-proxy-url')?.value.trim()||DEFAULT_AI_PROXY_URL;if(!key&&!proxy){showToast('Please enter API Key or AI Proxy URL','error');return;}showLoading('Saving...');try{AppState.set('deepseekKey',key);AppState.set('aiProxyUrl',proxy);const cfg=await window._fb.getData('settings')||{};cfg.deepseekKey=key;cfg.aiProxyUrl=proxy;await window._fb.setData('settings',cfg);document.getElementById('set-ai-proxy-url').value=proxy;document.getElementById('deepseek-key-status').innerHTML='<span style="color:var(--green)">✓ Proxy mode ready</span>';showToast('AI settings saved');}catch(e){showToast('Error: '+e.message,'error');}finally{hideLoading();}}

function loadAthleteProfile(profile){
  window._athleteProfile={...DEFAULT_ATHLETE_PROFILE,...(profile||{})};
  const mapping={
    'profile-dob':'dob','profile-max-hr':'maxHR','profile-lthr':'lthr',
    'profile-threshold-pace':'thresholdPace','profile-threshold-power':'thresholdPower',
    'profile-easy-hr-min':'easyHRMin','profile-easy-hr-max':'easyHRMax',
    'profile-z1':'z1Max','profile-z2':'z2Max','profile-z3':'z3Max','profile-z4':'z4Max','profile-z5':'z5Max',
    'profile-tempo-fast':'tempoFast','profile-tempo-slow':'tempoSlow'
  };
  Object.entries(mapping).forEach(([id,key])=>{const element=document.getElementById(id);if(element)element.value=window._athleteProfile[key]??'';});
  const status=document.getElementById('athlete-profile-status');if(status)status.textContent='กำลังใช้โซนส่วนตัวสำหรับประเมินเซสชัน';
}

async function saveAthleteProfile(){
  const number=id=>{const value=+document.getElementById(id)?.value;return Number.isFinite(value)?value:null;};
  const profile={
    dob:document.getElementById('profile-dob')?.value||DEFAULT_ATHLETE_PROFILE.dob,
    maxHR:number('profile-max-hr'),lthr:number('profile-lthr'),
    thresholdPace:document.getElementById('profile-threshold-pace')?.value.trim(),
    thresholdPower:number('profile-threshold-power'),
    easyHRMin:number('profile-easy-hr-min'),easyHRMax:number('profile-easy-hr-max'),
    z1Max:number('profile-z1'),z2Max:number('profile-z2'),z3Max:number('profile-z3'),z4Max:number('profile-z4'),z5Max:number('profile-z5'),
    tempoFast:document.getElementById('profile-tempo-fast')?.value.trim(),
    tempoSlow:document.getElementById('profile-tempo-slow')?.value.trim(),
    updatedAt:Date.now()
  };
  if(!(profile.z1Max<profile.z2Max&&profile.z2Max<profile.z3Max&&profile.z3Max<profile.z4Max&&profile.z4Max<=profile.z5Max)){
    showToast('ขอบเขต HR Zone ต้องเรียงจากต่ำไปสูง','error');return;
  }
  if(profile.easyHRMin>profile.easyHRMax||!paceStrToDecimal(profile.tempoFast)||!paceStrToDecimal(profile.tempoSlow)){
    showToast('ตรวจช่วง Easy HR และ Tempo Pace','error');return;
  }
  showLoading('Saving athlete profile...');
  try{
    const cfg=await window._fb.getData('settings')||{};cfg.athleteProfile=profile;
    await window._fb.setData('settings',cfg);loadAthleteProfile(profile);
    const details=await window._fb.getData('strava_activity_details')||{};
    for(const [id,payload] of Object.entries(details)){
      if(!payload?.detail||!payload?.laps)continue;
      const old=payload.analysis||{};
      const analysis=analyzeStravaIntervals(payload.detail,payload.laps,payload.streams||{},profile);
      analysis.userType=old.userType||null;analysis.confirmed=!!old.confirmed;analysis.confirmedAt=old.confirmedAt||null;
      payload.analysis=analysis;payload.analysisVersion=2;
      await window._fb.setData(`strava_activity_details/${id}`,payload);
    }
    window._stravaDetailCache=await window._fb.getData('strava_activity_details')||{};
    renderStravaActivityCards();
    showToast('บันทึก Athlete Profile และประเมินกิจกรรมใหม่แล้ว');
  }catch(error){showToast(error.message,'error');}
  finally{hideLoading();}
}

// ── WELLNESS + GOOGLE SHEETS BACKUP ──
