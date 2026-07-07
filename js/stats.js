// Stats and fitness insights logic extracted from index.html.
let _statsWeekOffset=0,_statsMonthOffset=0;
function initStatsNav(){_statsWeekOffset=0;_statsMonthOffset=0;}
function navWeek(dir){_statsWeekOffset+=dir;document.getElementById('btn-week-next').disabled=_statsWeekOffset>=0;renderWeekStats();}
function goToCurrentWeek(){_statsWeekOffset=0;document.getElementById('btn-week-next').disabled=true;renderWeekStats();}
function navMonth(dir){_statsMonthOffset+=dir;document.getElementById('btn-month-next').disabled=_statsMonthOffset>=0;renderMonthStats();}
function goToCurrentMonth(){_statsMonthOffset=0;document.getElementById('btn-month-next').disabled=true;renderMonthStats();}
function renderCurrentStatsView(){
  if(document.getElementById('stats-week-view').style.display!=='none')renderWeekStats();
  else if(document.getElementById('stats-month-view').style.display!=='none')renderMonthStats();
  else renderStatsInsights();
}
function switchStatsTab(tab,el){
  document.querySelectorAll('#page-fitness-stats .seg-tab').forEach(t=>t.classList.remove('active'));el?.classList.add('active');
  document.getElementById('stats-week-view').style.display=tab==='week'?'block':'none';
  document.getElementById('stats-month-view').style.display=tab==='month'?'block':'none';
  document.getElementById('stats-insights-view').style.display=tab==='insights'?'block':'none';
  if(tab==='week')renderWeekStats();else if(tab==='month')renderMonthStats();else renderStatsInsights();
}

const charts={hrzone:null, paceTrend:null, stravaDistance:null, stravaPerformance:null, dashboardHealth:null, statsEfficiency:null};
const dayNamesTH=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getChartColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    grid: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)',
    tick: isDark ? '#636366' : '#AEAEB2',
    tooltip: isDark ? 'rgba(28,28,30,.95)' : 'rgba(255,255,255,.98)',
    tooltipBorder: isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)',
    tooltipText: isDark ? '#FFFFFF' : '#1C1C1E',
  };
}

function renderWeekStats(){
  const days=getWeekDates(_statsWeekOffset);
  const today=toLocalDateStr();
  const allWks=getAllActivities();
  const label=document.getElementById('week-nav-label');
  if(label){const s=days[0].toLocaleDateString('en-GB',{day:'numeric',month:'short'});const e=days[6].toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit'});label.textContent=_statsWeekOffset===0?`THIS WEEK · Mon ${s} – Sun ${e}`:`Mon ${s} – Sun ${e}`;}
  document.getElementById('btn-week-next').disabled=_statsWeekOffset>=0;
  let labels=[],data=[],totalDist=0,totalTime=0,dayCount=0,hrSum=0,hrCnt=0,cadSum=0,cadCnt=0;
  days.forEach((d,i)=>{
    const ds=toLocalDateStr(d);
    labels.push(dayNamesTH[i]+'\n'+d.toLocaleDateString('en-GB',{day:'numeric'}));
    const dayWks=allWks.filter(w=>w.date===ds);
    const dist=dayWks.reduce((s,w)=>s+parseFloat(w.dist||0),0);
    const time=dayWks.reduce((s,w)=>s+parseFloat(w.time||0),0);
    data.push(+dist.toFixed(2));totalDist+=dist;totalTime+=time;
    if(dayWks.length)dayCount++;
    dayWks.forEach(w=>{if(w.hr){hrSum+=w.hr;hrCnt++;}if(w.cad){cadSum+=w.cad;cadCnt++;}});
  });
  const pace=totalDist>0?totalTime/totalDist:0;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('stat-wk-dist',totalDist.toFixed(2));set('stat-wk-count',dayCount);set('stat-wk-time',Math.round(totalTime));set('stat-wk-pace',pace>0?formatPace(pace):'—');
  set('stat-wk-hr',hrCnt>0?Math.round(hrSum/hrCnt):'—');set('stat-wk-cad',cadCnt>0?Math.round(cadSum/cadCnt):'—');
  const loadMetrics=calculateLoadMetrics(allWks),atl=Math.round(loadMetrics.acute);set('stat-atl',`${atl} AU`);
  const loadRatio=loadMetrics.acwr;
  const atlFill=document.getElementById('atl-bar-fill');
  if(atlFill){
    atlFill.style.width=loadRatio===null?'0%':Math.min(100,(loadRatio/1.5)*100)+'%';
    atlFill.style.background=loadRatio===null||loadRatio<=1.3?'var(--green)':loadRatio<=1.5?'var(--orange)':'var(--red)';
  }
  const comparison=document.getElementById('atl-comparison');
  if(comparison){
    const provisionalStatus=atl<200?'เบา':atl<400?'ปานกลาง':atl<600?'ค่อนข้างหนัก':'หนักมาก';
    const status=loadRatio===null?`${provisionalStatus} (เกณฑ์เริ่มต้น)`:loadRatio<.8?'เบา / ลดโหลด':loadRatio<=1.3?'ปานกลาง / สมดุล':loadRatio<=1.5?'ค่อนข้างหนัก':'หนักมาก';
    comparison.textContent=loadRatio===null
      ? `${status} · ${atl} AU · มีประวัติ ${loadMetrics.historyDays} วัน`
      : `${status} · ฐาน 28 วัน ${Math.round(loadMetrics.chronicWeekly)} AU · ACWR ${loadRatio.toFixed(2)}`;
  }
  renderIntegratedHealth();

  if(charts.week)charts.week.destroy();
  const ctx=document.getElementById('chart-week-trend')?.getContext('2d');
  const c=getChartColors();
  if(ctx){
    charts.week=new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:'km',data,backgroundColor:data.map((_,i)=>{const ds=toLocalDateStr(days[i]);return ds===today?'rgba(52,199,89,.7)':(data[i]>0?'rgba(0,122,255,.65)':'rgba(0,122,255,.1)');}),borderRadius:8,borderSkipped:false,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>`${i.parsed.y} km`},backgroundColor:c.tooltip,borderColor:c.tooltipBorder,borderWidth:1,padding:10,titleColor:c.tooltipText,bodyColor:c.tooltipText,titleFont:{family:'IBM Plex Mono'},bodyFont:{family:'IBM Plex Mono'}}},scales:{y:{grid:{color:c.grid},ticks:{color:c.tick,font:{family:'IBM Plex Mono',size:10}},beginAtZero:true},x:{grid:{display:false},ticks:{color:c.tick,font:{family:'IBM Plex Mono',size:10}}}}}});
  }

  const bdEl=document.getElementById('week-day-breakdown');
  if(bdEl)bdEl.innerHTML=days.map((d,i)=>{
    const ds=toLocalDateStr(d);
    const dayWks=allWks.filter(w=>w.date===ds);
    const dist=dayWks.reduce((s,w)=>s+parseFloat(w.dist||0),0);
    const isToday=ds===today,isFuture=ds>today;
    let borderColor='var(--border)',bg='transparent',textColor='var(--text3)';
    if(dist>0){borderColor='rgba(52,199,89,.4)';bg='var(--green-light)';textColor='var(--green)';}
    if(isToday&&!dist){borderColor='rgba(0,122,255,.4)';bg='var(--accent-light)';textColor='var(--accent)';}
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:${bg};border-radius:9px;border:1.5px solid ${borderColor}">
      <div style="font-size:10px;font-weight:700;color:${textColor};width:26px;text-align:center;font-family:var(--font-mono)">${dayNamesTH[i].slice(0,2)}</div>
      <div style="font-size:10px;color:var(--text3);width:56px;font-family:var(--font-mono)">${d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>
      ${dist>0?`<div style="flex:1;font-size:13px;font-weight:700;color:var(--green)">${dist.toFixed(2)} <span style="font-size:10px;font-weight:500;color:var(--text2)">km</span></div>${dayWks[0]?.avgPace?`<div style="font-family:var(--font-mono);font-size:10px;color:var(--text2)">${formatPace(dayWks[0].avgPace)}</div>`:''}`:`<div style="flex:1;font-size:11px;color:var(--text3);opacity:${isFuture?'.5':'.4'}">${isFuture?'—':'Rest'}</div>`}
    </div>`;
  }).join('');
}

function getMonthBounds(offset){const now=new Date(),y=now.getFullYear(),m=now.getMonth()+offset;const start=new Date(y,m,1);return{start,year:start.getFullYear(),month:start.getMonth()};}
function renderMonthStats(){
  const{start,year,month}=getMonthBounds(_statsMonthOffset);
  const monthName=start.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  const allWks=getAllActivities();
  const label=document.getElementById('month-nav-label');
  if(label)label.textContent=_statsMonthOffset===0?`THIS MONTH · ${monthName.toUpperCase()}`:monthName.toUpperCase();
  document.getElementById('btn-month-next').disabled=_statsMonthOffset>=0;
  const monthWks=allWks.filter(w=>{if(!w.date)return false;const d=new Date(w.date+'T00:00:00');return d.getFullYear()===year&&d.getMonth()===month;});
  const totalDist=monthWks.reduce((s,w)=>s+parseFloat(w.dist||0),0);
  const totalTime=monthWks.reduce((s,w)=>s+parseFloat(w.time||0),0);
  const pace=totalDist>0?totalTime/totalDist:0;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('stat-mo-dist',totalDist.toFixed(2));set('stat-mo-count',monthWks.length);set('stat-mo-time',Math.round(totalTime));set('stat-mo-pace',pace>0?formatPace(pace):'—');

  // Build real Mon-Sun week buckets that overlap with this month
  const monthEnd=new Date(year,month+1,0); // last day of month
  // Find Monday on or before the 1st of month
  const firstMon=new Date(start);
  const dow=firstMon.getDay(); // 0=Sun,1=Mon,...
  firstMon.setDate(firstMon.getDate()-((dow+6)%7)); // roll back to Monday
  const weekBuckets=[];
  let wStart=new Date(firstMon);
  while(wStart<=monthEnd){
    const wEnd=new Date(wStart);wEnd.setDate(wEnd.getDate()+6);
    weekBuckets.push({start:new Date(wStart),end:new Date(wEnd),dist:0});
    wStart.setDate(wStart.getDate()+7);
  }
  monthWks.forEach(w=>{
    if(!w.date)return;
    const d=new Date(w.date+'T00:00:00');
    const bucket=weekBuckets.find(b=>d>=b.start&&d<=b.end);
    if(bucket)bucket.dist+=parseFloat(w.dist||0);
  });
  // Labels: "d/M" of Monday of each week
  const fmt=d=>`${d.getDate()}/${d.getMonth()+1}`;
  const wkLabels=weekBuckets.map(b=>fmt(b.start));
  const wkData=weekBuckets.map(b=>+b.dist.toFixed(2));
  const maxDist=Math.max(...wkData,1);

  if(charts.month)charts.month.destroy();
  const ctx=document.getElementById('chart-month-trend')?.getContext('2d');
  const c=getChartColors();
  if(ctx)charts.month=new Chart(ctx,{type:'bar',data:{labels:wkLabels,datasets:[{label:'km',data:wkData,backgroundColor:wkData.map(v=>v>0?'rgba(52,199,89,.7)':'rgba(52,199,89,.15)'),borderRadius:8,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>`${i.parsed.y.toFixed(2)} km`,title:ts=>`สัปดาห์ ${ts[0]}`},backgroundColor:c.tooltip,borderColor:c.tooltipBorder,borderWidth:1,padding:10,titleColor:c.tooltipText,bodyColor:c.tooltipText,titleFont:{family:'IBM Plex Mono'},bodyFont:{family:'IBM Plex Mono'}}},scales:{y:{grid:{color:c.grid},ticks:{color:c.tick,font:{family:'IBM Plex Mono',size:10},callback:v=>v+'km'},beginAtZero:true},x:{grid:{display:false},ticks:{color:c.tick,font:{family:'IBM Plex Mono',size:10}}}}}});

  renderHRZoneChart(monthWks);
  const listEl=document.getElementById('month-activity-list');
  const em={run:'🏃',interval:'⚡',bike:'🚴',swim:'🏊',walk:'🚶'};
  if(listEl){listEl.innerHTML=monthWks.length?[...monthWks].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(w=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 6px;border-bottom:1px solid var(--border);cursor:pointer;border-radius:8px;transition:background .15s" onclick="showActivityDetail(encodeURIComponent(JSON.stringify(${JSON.stringify(JSON.stringify(w))})))" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='transparent'"><span style="font-size:15px">${em[w.type]||'🏅'}</span><div style="flex:1"><div style="font-size:12px;font-weight:600">${parseFloat(w.dist||0).toFixed(2)} km${w.avgPace?' · '+formatPace(w.avgPace)+'/km':''}${sourceBadge(w,true)}</div><div style="font-size:10px;color:var(--text2);font-family:var(--font-mono)">${w.date}${w.name?' · '+w.name:''}</div></div>${w.hr?`<span style="font-size:11px;color:var(--red)">♥${w.hr}</span>`:''}<span style="color:var(--text3);font-size:14px">›</span></div>`).join(''):'<p class="text-sm c2">ไม่มีกิจกรรมเดือนนี้</p>';}
}

function manualSessionType(workout){
  const purpose=(workout.purpose||'').toLowerCase();
  if(workout.type==='interval'||purpose==='interval')return {type:'interval',confidence:100,confirmed:true,detailed:false};
  if(['recovery','easy','tempo'].includes(purpose))return {type:purpose,confidence:100,confirmed:true,detailed:false};
  if(purpose==='long')return {type:'steady',confidence:80,confirmed:true,detailed:false};
  const activity={
    name:workout.name||workout.note||'',average_heartrate:+workout.hr||null,
    average_speed:workout.avgPace?1000/(workout.avgPace*60):0,
    distance:(+workout.dist||0)*1000,moving_time:(+workout.time||0)*60
  };
  const result=sessionTypeFromProfile(activity,[],getAthleteProfile());
  return {type:result.type,confidence:result.confidence,confirmed:false,detailed:false};
}

async function getClassifiedActivitiesForInsights(){
  const cutoff=dateDaysAgo(55);
  const activities=getAllActivities().filter(row=>row.date&&new Date(`${row.date}T12:00:00`)>=cutoff);
  let details=window._stravaDetailCache||{};
  if(!Object.keys(details).length){
    try{details=await window._fb.getData('strava_activity_details')||{};window._stravaDetailCache=details;}catch(error){}
  }
  return activities.map(activity=>{
    if(activity.source==='strava'&&activity.stravaId){
      const payload=details[activity.stravaId];
      const analysis=payload?.analysis;
      if(analysis){
        return {...activity,sessionType:analysis.userType||analysis.detectedType,classificationConfidence:analysis.confidence||0,classificationConfirmed:!!analysis.confirmed,hasDetail:true};
      }
    }
    const inferred=manualSessionType(activity);
    return {...activity,sessionType:inferred.type,classificationConfidence:inferred.confidence,classificationConfirmed:inferred.confirmed,hasDetail:inferred.detailed};
  });
}

async function renderStatsInsights(){
  const mixElement=document.getElementById('stats-training-mix');if(!mixElement)return;
  mixElement.innerHTML='<div class="text-sm c2">กำลังวิเคราะห์...</div>';
  const activities=await getClassifiedActivitiesForInsights();
  const types=['recovery','easy','steady','tempo','threshold','interval'];
  const labels={recovery:'Recovery',easy:'Easy',steady:'Steady',tempo:'Tempo',threshold:'Threshold',interval:'Interval'};
  const colors={recovery:'#5AC8FA',easy:'#34C759',steady:'#0E7490',tempo:'#AF52DE',threshold:'#FF2D55',interval:'#FC4C02'};
  const totals=Object.fromEntries(types.map(type=>[type,{minutes:0,count:0}]));
  activities.forEach(activity=>{
    const type=types.includes(activity.sessionType)?activity.sessionType:'steady';
    totals[type].minutes+=+activity.time||0;totals[type].count++;
  });
  const classifiedMinutes=types.reduce((sum,type)=>sum+totals[type].minutes,0);
  const segments=types.filter(type=>totals[type].minutes>0).map(type=>{
    const percent=classifiedMinutes?totals[type].minutes/classifiedMinutes*100:0;
    return `<div class="training-mix-segment" style="width:${percent}%;background:${colors[type]}" title="${labels[type]} ${percent.toFixed(0)}%"></div>`;
  }).join('');
  mixElement.innerHTML=classifiedMinutes?`
    <div class="training-mix-bar">${segments}</div>
    <div class="training-mix-legend">${types.map(type=>`<div class="training-mix-item"><div class="stat-label" style="color:${colors[type]}">${labels[type]}</div><div class="mono bold">${totals[type].minutes.toFixed(0)} min</div><div class="text-xs c3">${totals[type].count} sessions</div></div>`).join('')}</div>`
    :'<div class="text-sm c2">ยังไม่มีข้อมูลจำแนกใน 8 สัปดาห์ล่าสุด</div>';

  const easyMinutes=totals.recovery.minutes+totals.easy.minutes;
  const qualityMinutes=classifiedMinutes-easyMinutes;
  const easyPercent=classifiedMinutes?easyMinutes/classifiedMinutes*100:0;
  const qualityPercent=classifiedMinutes?qualityMinutes/classifiedMinutes*100:0;
  const set=(id,value)=>{const element=document.getElementById(id);if(element)element.textContent=value;};
  set('stats-easy-pct',classifiedMinutes?`${easyPercent.toFixed(0)}%`:'—');
  set('stats-quality-pct',classifiedMinutes?`${qualityPercent.toFixed(0)}%`:'—');
  const balance=document.getElementById('stats-balance-note');
  if(balance)balance.textContent=!classifiedMinutes?'ข้อมูลยังไม่พอ'
    :easyPercent>=75&&easyPercent<=85?'ใกล้สมดุล 80/20'
    :easyPercent<75?'สัดส่วนงานคุณภาพค่อนข้างสูง':'สัดส่วนงานเบาสูง เหมาะกับ Base/Recovery';

  renderStatsEfficiencyChart(activities);
  renderStatsConfidence(activities);
  const notes=document.getElementById('stats-insight-notes');
  const insightNotes=[];
  if(classifiedMinutes){
    insightNotes.push([easyPercent>=75?'':'warn',`งานเบา ${easyPercent.toFixed(0)}% · งานคุณภาพ ${qualityPercent.toFixed(0)}% จากเวลาซ้อมทั้งหมด`]);
    const tempoCount=totals.tempo.count+totals.threshold.count+totals.interval.count;
    insightNotes.push([tempoCount<=2?'':'warn',`มี Tempo/Threshold/Interval ${tempoCount} เซสชันใน 8 สัปดาห์ล่าสุด`]);
  }
  const confirmed=activities.filter(activity=>activity.classificationConfirmed).length;
  insightNotes.push(['',`ประเภทที่คุณยืนยันแล้ว ${confirmed}/${activities.length} เซสชัน ผลจะน่าเชื่อถือขึ้นเมื่อยืนยันกิจกรรมสำคัญ`]);
  if(notes)notes.innerHTML=insightNotes.map(([level,text])=>`<div class="wellness-alert ${level}">${text}</div>`).join('');
}

function renderStatsEfficiencyChart(activities){
  const aerobic=activities.filter(activity=>['recovery','easy','steady'].includes(activity.sessionType)&&+activity.avgPace>0&&+activity.hr>0);
  const weekStarts=Array.from({length:8},(_,index)=>{const date=getThisWeekStart();date.setDate(date.getDate()-(7-index)*7);return date;});
  const labels=[],values=[];
  weekStarts.forEach(start=>{
    const end=new Date(start);end.setDate(end.getDate()+7);
    const rows=aerobic.filter(activity=>{const date=new Date(`${activity.date}T12:00:00`);return date>=start&&date<end;});
    const efficiencies=rows.map(activity=>(1000/(activity.avgPace*60))/activity.hr).filter(Number.isFinite);
    labels.push(start.toLocaleDateString('th-TH',{day:'numeric',month:'short'}));
    values.push(efficiencies.length?efficiencies.reduce((sum,value)=>sum+value,0)/efficiencies.length:null);
  });
  if(charts.statsEfficiency)charts.statsEfficiency.destroy();
  const context=document.getElementById('chart-stats-efficiency')?.getContext('2d');
  if(context){
    const colors=getChartColors();
    charts.statsEfficiency=new Chart(context,{type:'line',data:{labels,datasets:[{label:'Speed per HR',data:values,borderColor:'#0E7490',backgroundColor:'rgba(14,116,144,.12)',fill:true,tension:.3,spanGaps:true,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:colors.tick,font:{size:9}}},y:{grid:{color:colors.grid},ticks:{color:colors.tick,font:{size:9}}}}}});
  }
  const valid=values.filter(Number.isFinite),note=document.getElementById('stats-efficiency-note');
  if(note){
    if(valid.length<2)note.textContent=`มีข้อมูลที่ใช้ได้ ${aerobic.length} เซสชัน ต้องมีอย่างน้อย 2 สัปดาห์`;
    else{
      const change=(valid.at(-1)-valid[0])/valid[0]*100;
      note.textContent=`ประสิทธิภาพ ${change>=0?'ดีขึ้น':'ลดลง'} ${Math.abs(change).toFixed(1)}% ระหว่างสัปดาห์แรกกับล่าสุด · ยิ่งสูงยิ่งดี`;
    }
  }
}

function renderStatsConfidence(activities){
  const total=activities.length||1;
  const classified=activities.filter(activity=>activity.sessionType).length;
  const confirmed=activities.filter(activity=>activity.classificationConfirmed).length;
  const detailed=activities.filter(activity=>activity.hasDetail).length;
  const withHR=activities.filter(activity=>+activity.hr>0).length;
  const withPace=activities.filter(activity=>+activity.avgPace>0).length;
  const score=Math.round(classified/total*35+confirmed/total*20+detailed/total*20+withHR/total*15+withPace/total*10);
  const set=(id,value)=>{const element=document.getElementById(id);if(element)element.textContent=value;};
  set('stats-confidence-score',score);
  const bar=document.getElementById('stats-confidence-bar');if(bar){bar.style.width=`${score}%`;bar.style.background=score>=75?'var(--green)':score>=50?'var(--orange)':'var(--red)';}
  const details=document.getElementById('stats-confidence-details');
  if(details)details.innerHTML=[
    ['จำแนกประเภท',`${classified}/${activities.length}`],['ยืนยันแล้ว',`${confirmed}/${activities.length}`],
    ['มี Laps/Streams',`${detailed}/${activities.length}`],['มี HR',`${withHR}/${activities.length}`],['มี Pace',`${withPace}/${activities.length}`]
  ].map(([label,value])=>`<div class="wellness-summary-item"><span class="c2">${label}</span><span>${value}</span></div>`).join('');
}

async function analyzeFitnessAI(period='week'){
  const allWks=getAllActivities();
  let wks=[],periodLabel='';
  if(period==='week'){const days=getWeekDates(_statsWeekOffset);const ds0=toLocalDateStr(days[0]),ds6=toLocalDateStr(days[6]);wks=allWks.filter(w=>w.date>=ds0&&w.date<=ds6);periodLabel=`week ${ds0} to ${ds6}`;}
  else{const{year,month}=getMonthBounds(_statsMonthOffset);wks=allWks.filter(w=>{if(!w.date)return false;const d=new Date(w.date+'T00:00:00');return d.getFullYear()===year&&d.getMonth()===month;});periodLabel=`month ${new Date(year,month,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'})}`;}
  const totalDist=wks.reduce((s,w)=>s+parseFloat(w.dist||0),0);
  const totalTime=wks.reduce((s,w)=>s+parseFloat(w.time||0),0);
  const avgPace=totalDist>0?totalTime/totalDist:0;
  const avgHR=wks.filter(w=>w.hr).length?Math.round(wks.filter(w=>w.hr).reduce((s,w)=>s+w.hr,0)/wks.filter(w=>w.hr).length):0;
  const summary=wks.length>0?wks.sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(w=>`[${w.date}] ${w.type||'run'} ${w.dist}km ${w.time}min${w.hr?' HR'+w.hr:''}${w.avgPace?' Pace'+formatPace(w.avgPace):''}${w.rpe?' RPE'+w.rpe:''}${w.pain?' Pain'+w.pain:''}`).join('\n'):'No data in this period';
  const statsLine=wks.length>0?`\n\nSummary: ${wks.length} sessions · ${totalDist.toFixed(2)}km · ${Math.round(totalTime)}min · Pace ${formatPace(avgPace)}${avgHR?' · HR '+avgHR+' bpm':''}`:'' ;
  const wellness=(AppState.get('wellness')||[]).filter(r=>!wks.length||wks.some(w=>w.date===r.date)).slice(0,14).map(r=>`[${r.date}] Sleep ${r.sleepHours??'-'}h RHR ${r.restingHR??'-'} HRV ${r.hrv??'-'} Fatigue ${r.fatigue??'-'} Stress ${r.stress??'-'} Pain ${r.soreness??'-'} Recovery ${calculateRecoveryScore(r)??'-'}`).join('\n');
  const readiness=calculateReadiness();
  const prompt=`Activity data for ${periodLabel}:\n${summary}${statsLine}\n\nWellness:\n${wellness||'No wellness data'}\n\nCurrent integrated metrics: Readiness ${readiness.score}/100, Acute load ${Math.round(readiness.load.acute)}, Chronic weekly ${Math.round(readiness.load.chronicWeekly)}, ACWR ${readiness.load.acwr?.toFixed(2)??'n/a'}, Monotony ${readiness.load.monotony.toFixed(2)}.\n\n${wks.length===0?'No activity data available. Explain what should be logged.':'Analyze together:\n1. Training load and recovery balance\n2. Pace/HR efficiency and consistency\n3. Sleep, RHR, HRV, fatigue and pain risk signals\n4. Specific recommendation for the next 24–48 hours\n5. Three actionable changes. Do not diagnose disease.'}`;
  await askDeepSeek(prompt,'คุณคือนักสรีรวิทยาและโค้ชวิ่ง วิเคราะห์เป็นภาษาไทย ตรงประเด็น',period==='week'?'btn-analyze-wk':'btn-analyze-mo',period==='week'?'ai-stats-output':'ai-month-output');
}

// ── AI COACH DATE HELPERS ──
