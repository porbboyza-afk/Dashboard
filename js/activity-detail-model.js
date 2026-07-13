(function(root) {
  'use strict';

  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const activityKey = workout => `${workout?.source || 'manual'}_${workout?.sourceId || workout?._key || workout?.id || workout?.stravaId || ''}`;
  const detailFor = workout => {
    const key = activityKey(workout);
    const garmin = root.AppState?.get('activityDetails') || {};
    if (garmin[key]) return garmin[key];
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
    const type = work.length >= 3 && recovery.length >= 1 ? 'interval' : work.length >= 2 ? 'tempo' : 'steady';
    return {detail, laps, type, confidence: laps.length ? Math.min(95, 45 + laps.length * 7) : 0,
      workMinutes:+work.reduce((sum,lap)=>sum+finite(lap.durationMin),0).toFixed(1), recoveryMinutes:+recovery.reduce((sum,lap)=>sum+finite(lap.durationMin),0).toFixed(1),
      averagePace:weighted('pace'), averageHr:weighted('averageHr'), hrDrift, coverage:detail?.coverage || {laps:false,map:false,streams:false}};
  }

  function lapRows(analysis) {
    if (!analysis.laps.length) return '<div class="text-sm c2">No lap detail from this source yet.</div>';
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

  root.MyDashActivityAnalysis = {activityKey, detailFor, analyze};
  root.showActivityDetail = function(encoded) {
    let workout; try { workout = typeof encoded === 'object' ? encoded : JSON.parse(decodeURIComponent(encoded)); } catch (_) { try { workout = JSON.parse(encoded); } catch (_) { return; } }
    const analysis = analyze(workout); const reviewKey = String(root.postRunWorkoutKey(workout)).replace(/'/g, "\\'"); document.getElementById('act-detail-overlay')?.remove();
    const overlay=document.createElement('div'); overlay.id='act-detail-overlay'; overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:910;display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML=`<div style="background:var(--surface);width:min(860px,100%);max-height:90vh;overflow:auto;border-radius:8px;padding:20px"><div class="flex justify-between items-center"><div><div class="card-label">Activity Detail</div><h2 style="margin:4px 0">${root.escapeHTML(workout.name||workout.type||'Activity')} · ${root.escapeHTML(workout.date||'')}</h2></div><button class="btn btn-sm" onclick="document.getElementById('act-detail-overlay').remove()">Close</button></div><div class="grid g3 mt-16"><div class="card"><div class="card-label">Summary</div><strong>${workout.dist||0} km · ${workout.avgPace?root.formatPace(workout.avgPace):'--'}/km</strong><div class="text-sm c2 mt-4">HR ${workout.hr||'--'} · Cad ${workout.cad||'--'}</div></div><div class="card"><div class="card-label">Workout Analysis</div><strong>${analysis.type.toUpperCase()} · ${analysis.confidence}%</strong><div class="text-sm c2 mt-4">Work ${analysis.workMinutes} min · Recovery ${analysis.recoveryMinutes} min</div></div><div class="card"><div class="card-label">HR Drift</div><strong>${analysis.hrDrift===null?'--':analysis.hrDrift+'%'}</strong><div class="text-sm c2 mt-4">Calculated from first vs second half</div></div></div><div class="card mt-16"><div class="card-label">GPS Route</div>${routePreview(analysis.detail)}</div><div class="card mt-16"><div class="card-label">Laps / Splits</div>${lapRows(analysis)}</div><div class="flex gap-8 mt-16"><button class="btn btn-primary btn-sm" onclick="document.getElementById('act-detail-overlay').remove();openPostRunReview('${reviewKey}')">Open Post-Run Review</button><span class="text-sm c2">Map ${analysis.coverage.map?'available in source data':'not available'} · Streams ${analysis.coverage.streams?'available':'not imported yet'}</span></div></div>`;
    document.body.appendChild(overlay); overlay.addEventListener('click', event => {if(event.target===overlay) overlay.remove();});
  };
})(window);
