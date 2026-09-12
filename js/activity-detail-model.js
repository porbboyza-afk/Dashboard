(function(root) {
  'use strict';

  const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const activityKey = workout => `${workout?.source || 'manual'}_${workout?.sourceId || workout?._key || workout?.id || workout?.stravaId || ''}`;
  const detailFor = workout => {
    if (workout?.corosDetail?.source === 'coros' && Array.isArray(workout.corosDetail.laps)) return workout.corosDetail;
    const key = activityKey(workout);
    const garmin = root.AppState?.get('activityDetails') || {};
    if (garmin[key]) return garmin[key];
    const health = workout?.healthConnectDetail;
    if (health) return {source:'health_connect', healthConnectDetail:health,
      laps:Object.values(health.laps || {}).map((lap,index)=>({index:index+1,
        distanceKm:finite(lap.distanceMeters)===null?null:lap.distanceMeters/1000,
        durationMin:finite(lap.durationSeconds)===null?null:lap.durationSeconds/60,
        pace:lap.distanceMeters>0&&lap.durationSeconds>0?lap.durationSeconds/60/(lap.distanceMeters/1000):null})),
      coverage:{laps:!!Object.values(health.laps||{}).length,map:false,streams:false}};
    const strava = root._stravaDetailCache?.[workout?.stravaId];
    return strava ? {source:'strava', sourceId:String(workout.stravaId), laps:(strava.laps || []).map((lap, index) => ({
      index:index + 1, distanceKm:finite(lap.distance) ? +(lap.distance / 1000).toFixed(4) : null,
      durationMin:finite(lap.moving_time) ? +(lap.moving_time / 60).toFixed(3) : null,
      pace:finite(lap.distance) && finite(lap.moving_time) ? +(lap.moving_time / 60 / (lap.distance / 1000)).toFixed(4) : null,
      averageHr:finite(lap.average_heartrate), cadence:finite(lap.average_cadence) ? +(lap.average_cadence * 2).toFixed(0) : null,
      elevationGainM:finite(lap.total_elevation_gain), lapType:'lap'
    })), map:strava.detail?.map?.summary_polyline ? {polyline:strava.detail.map.summary_polyline} : null, coverage:{laps:!!strava.laps?.length,map:!!strava.detail?.map?.summary_polyline,streams:!!strava.streams} } : null;
  };

  function classifyLap(lap, baseline) {
    const pace = finite(lap.pace), hr = finite(lap.averageHr);
    if (!pace) return 'unknown';
    if (baseline && pace <= baseline * .91) return 'work';
    if (baseline && pace >= baseline * 1.09) return 'recovery';
    if (hr && hr >= 165) return 'tempo';
    return 'steady';
  }

  function analyze(workout) {
    const detail = detailFor(workout);
    const laps = (detail?.laps || []).filter(lap => finite(lap.distanceKm) && finite(lap.durationMin)).map(lap => ({...lap}));
    const paces = laps.map(lap => finite(lap.pace)).filter(Boolean).sort((a,b) => a-b);
    const baseline = paces.length ? paces[Math.floor(paces.length / 2)] : finite(workout?.avgPace);
    laps.forEach(lap => lap.role = classifyLap(lap, baseline));
    const work = laps.filter(lap => lap.role === 'work' || lap.role === 'tempo');
    const recovery = laps.filter(lap => lap.role === 'recovery');
    const weighted = field => {
      const rows = laps.filter(lap => finite(lap[field]) !== null);
      const weight = rows.reduce((sum, lap) => sum + finite(lap.durationMin), 0);
      return weight ? rows.reduce((sum, lap) => sum + finite(lap[field]) * finite(lap.durationMin), 0) / weight : null;
    };
    const first = laps.slice(0, Math.floor(laps.length / 2)), second = laps.slice(Math.floor(laps.length / 2));
    const avgHr = rows => { const values = rows.map(row => finite(row.averageHr)).filter(Boolean); return values.length ? values.reduce((a,b)=>a+b,0)/values.length : null; };
    const firstHr=avgHr(first), secondHr=avgHr(second);
    const hrDrift=firstHr&&secondHr ? +((secondHr-firstHr)/firstHr*100).toFixed(1) : null;
    const type = !laps.length ? 'unknown' : work.length >= 3 && recovery.length >= 1 ? 'interval' : work.length >= 2 ? 'tempo' : 'steady';
    return {detail, laps, type, confidence: laps.length ? Math.min(95, 45 + laps.length * 7) : 0,
      workMinutes:+work.reduce((sum,lap)=>sum+finite(lap.durationMin),0).toFixed(1), recoveryMinutes:+recovery.reduce((sum,lap)=>sum+finite(lap.durationMin),0).toFixed(1),
      averagePace:weighted('pace'), averageHr:weighted('averageHr'), averageCadence:weighted('cadence'), hrDrift, coverage:detail?.coverage || {laps:false,map:false,streams:false}};
  }

  function lapRows(analysis) {
    if(analysis.detail?.healthConnectDetail && root.postRunHealthConnectLaps)return root.postRunHealthConnectLaps(analysis.detail);
    if (!analysis.laps.length) return '<div class="text-sm c2">No lap detail from this source yet.</div>';
    if(analysis.detail?.source==='coros' && root.postRunCorosLaps)return root.postRunCorosLaps(analysis.detail);
    return `<table class="strava-lap-table"><thead><tr><th>Lap</th><th>Role</th><th>Pace</th><th>HR</th><th>Cad</th></tr></thead><tbody>${analysis.laps.map(lap => `<tr><td>${lap.index}</td><td>${lap.role}</td><td>${lap.pace ? root.formatPace(lap.pace) : '--'}</td><td>${lap.averageHr ? Math.round(lap.averageHr) : '--'}</td><td>${lap.cadence ? Math.round(lap.cadence) : '--'}</td></tr>`).join('')}</tbody></table>`;
  }

  function routePreview(detail) {
    const points = detail?.track?.points || [];
    if (points.length < 2) return '<div class="text-sm c2">GPS route is not available for this activity.</div>';
    const lat = points.map(point => point.lat), lng = points.map(point => point.lng);
    const minLat=Math.min(...lat), maxLat=Math.max(...lat), minLng=Math.min(...lng), maxLng=Math.max(...lng);
    const spanLat=maxLat-minLat || .0001, spanLng=maxLng-minLng || .0001;
    const path=points.map((point,index)=>`${index?'L':'M'} ${16+(point.lng-minLng)/spanLng*328} ${184-(point.lat-minLat)/spanLat*168}`).join(' ');
    return `<svg viewBox="0 0 360 200" role="img" aria-label="GPS route preview" style="width:100%;height:200px;background:var(--bg);border-radius:8px"><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${16+(points[0].lng-minLng)/spanLng*328}" cy="${184-(points[0].lat-minLat)/spanLat*168}" r="6" fill="var(--green)"/><circle cx="${16+(points.at(-1).lng-minLng)/spanLng*328}" cy="${184-(points.at(-1).lat-minLat)/spanLat*168}" r="6" fill="var(--red)"/></svg><div class="text-xs c3 mt-4">GPS route preview · ${points.length} sampled points · green start / red finish</div>`;
  }

  function reviewPreview(workout) {
    if (typeof root.buildPostRunFacts !== 'function') return '';
    const facts=root.buildPostRunFacts(workout);
    const comparison=facts.targetComparison||{};
    const verdict=typeof root.postRunLocalVerdict==='function'?root.postRunLocalVerdict(facts):null;
    const saved=typeof root.postRunReviewFor==='function'?root.postRunReviewFor(workout):null;
    const stale=!!saved&&!!root.MyDashReviewMatcher?.isReviewStale(saved,facts);
    return `<div class="card mt-16"><div class="flex justify-between items-center gap-8 flex-wrap"><div><div class="card-label">Post-Run Review</div><strong>${root.escapeHTML(verdict?.label||'Review this session')}</strong><div class="text-sm c2 mt-4">${root.escapeHTML(facts.planMatch?.label||'No matched plan session')}</div></div><span class="text-sm c2">${stale?'Review needs refresh':saved?.aiSummary?'Review saved':'Not reviewed yet'}</span></div><div class="grid g2 mt-12"><div class="text-sm c2">Plan vs actual<br><strong>${comparison.actualDist||0} / ${comparison.targetDist||'--'} km</strong><br>${comparison.actualPace?root.formatPace(comparison.actualPace):'--'} / ${root.escapeHTML(comparison.targetPace||'--')}</div><div class="text-sm c2">Recovery context<br><strong>Readiness ${facts.readiness?.score??'--'}/100</strong><br>RPE ${facts.subjective?.rpe||'--'} · Pain ${facts.subjective?.pain||0}/10</div></div><div id="postrun-ai-output" class="ai-box mt-12" style="display:${saved?.aiSummary&&!stale?'block':'none'}">${saved?.aiSummary&&!stale?root.mdToHtml(saved.aiSummary):''}</div><div class="flex gap-8 mt-12 flex-wrap"><button class="btn btn-primary btn-sm" id="btn-postrun-ai">${saved?.aiSummary&&!stale?'Refresh AI Review':'Generate AI Review'}</button><button class="btn btn-ghost btn-sm" type="button" data-open-full-review>Open full review</button></div></div>`;
  }

  root.MyDashActivityAnalysis = {activityKey, detailFor, analyze};
  root.bindActivityDetails = function(container, activities) {
    container?.querySelectorAll('[data-activity-index]').forEach(element => {
      const workout=activities[Number(element.dataset.activityIndex)];
      if(!workout)return;
      const open=event=>{
        if(event?.target?.closest('[data-activity-index]')!==element)return;
        if(event?.target?.closest('[data-edit-index],[data-delete-index]'))return;
        root.showActivityDetail(workout);
      };
      element.addEventListener('click',open);
      if(element.tagName!=='BUTTON'){
        element.setAttribute('role','button');element.tabIndex=0;
        element.addEventListener('keydown',event=>{if(event.target===element&&['Enter',' '].includes(event.key)){event.preventDefault();open(event);}});
      }
    });
  };
  root.showActivityDetail = function(encoded) {
    let workout; try { workout = typeof encoded === 'object' ? encoded : JSON.parse(decodeURIComponent(encoded)); } catch (_) { try { workout = JSON.parse(encoded); } catch (_) { return; } }
    if(!workout||typeof workout!=='object')return;
    const analysis = analyze(workout); const reviewKey = String(root.postRunWorkoutKey(workout)).replace(/'/g, "\\'"); document.getElementById('act-detail-overlay')?.remove();
    const overlay=document.createElement('div'); overlay.id='act-detail-overlay'; overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:910;display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML=`<div style="background:var(--surface);width:min(860px,100%);max-height:90vh;overflow:auto;border-radius:8px;padding:20px"><div class="flex justify-between items-center"><div><div class="card-label">Activity Detail</div><h2 style="margin:4px 0">${root.escapeHTML(workout.name||workout.type||'Activity')} · ${root.escapeHTML(workout.date||'')}</h2></div><button class="btn btn-sm" onclick="document.getElementById('act-detail-overlay').remove()">Close</button></div><div class="grid g3 mt-16"><div class="card"><div class="card-label">Summary</div><strong>${workout.dist||0} km · ${workout.avgPace?root.formatPace(workout.avgPace):'--'}/km</strong><div class="text-sm c2 mt-4">HR ${workout.hr||'--'} · Cad ${workout.cad||'--'}</div></div><div class="card"><div class="card-label">Workout Analysis</div><strong>${analysis.type.toUpperCase()} · ${analysis.confidence}%</strong><div class="text-sm c2 mt-4">Work ${analysis.workMinutes} min · Recovery ${analysis.recoveryMinutes} min</div></div><div class="card"><div class="card-label">HR Drift</div><strong>${analysis.hrDrift===null?'--':analysis.hrDrift+'%'}</strong><div class="text-sm c2 mt-4">Calculated from first vs second half</div></div></div>${reviewPreview(workout)}<div class="card mt-16"><div class="card-label">GPS Route</div>${routePreview(analysis.detail)}</div><div class="card mt-16"><div class="card-label">Laps / Splits</div>${lapRows(analysis)}</div><div class="text-sm c2 mt-16">Map ${analysis.coverage.map?'available in source data':'not available'} · Streams ${analysis.coverage.streams?'available':'not imported yet'}</div></div>`;
    const summary=overlay.querySelector('.grid .card');
    const summaryMetrics=summary?.querySelector('.text-sm');
    const summaryHr=finite(workout.hr) ?? analysis.averageHr;
    const summaryCadence=finite(workout.cad) ?? analysis.averageCadence;
    if(summaryMetrics) summaryMetrics.textContent=`HR ${summaryHr===null?'--':Math.round(summaryHr)} · Cad ${summaryCadence===null?'--':Math.round(summaryCadence)} spm`;
    const duration=document.createElement('div');duration.className='text-sm c2 mt-4';
    duration.textContent=`เวลา ${finite(workout.time)===null?'--':Number(workout.time).toFixed(2)} นาที`;
    summary?.appendChild(duration);
    const notes=document.createElement('div');notes.className='text-sm c2 mt-4';
    notes.textContent=[workout.rpe?`RPE ${workout.rpe}/10`:'',workout.shoe,workout.note].filter(Boolean).join(' · ');
    summary?.appendChild(notes);
    if(!analysis.laps.length){const card=overlay.querySelectorAll('.grid .card')[1];card.querySelector('strong').textContent='ยังไม่มีข้อมูลรอบสำหรับวิเคราะห์';card.querySelector('.text-sm').textContent='ดูสรุปกิจกรรมได้ตามข้อมูลที่ต้นทางส่งมา';}
    overlay.querySelector('#btn-postrun-ai')?.addEventListener('click',()=>root.generatePostRunAIReview(root.postRunWorkoutKey(workout)));
    overlay.querySelector('[data-open-full-review]')?.addEventListener('click',()=>{overlay.remove();root.openPostRunReview(root.postRunWorkoutKey(workout));});
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Activity Detail');
    const previousFocus=document.activeElement;
    overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){overlay.remove();previousFocus?.focus();}});
    document.body.appendChild(overlay);overlay.querySelector('button')?.focus();overlay.addEventListener('click', event => {if(event.target===overlay) overlay.remove();});
  };
})(window);
