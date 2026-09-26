import {canonicalWorkouts} from './canonical-activities.mjs';
export const finite = value => value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value);
export const positive = value => finite(value) > 0 ? Number(value) : null;
export const entries = value => Object.entries(value || {}).filter(([, row]) => row && typeof row === 'object');
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

export function periodBounds(date, period = 'week') {
  const start = new Date(`${date}T12:00:00`);
  const end = new Date(start);
  if (period === 'month') {
    start.setDate(1);
    end.setMonth(end.getMonth()+1, 0);
  } else {
    start.setDate(start.getDate() - (start.getDay()+6)%7);
    end.setTime(start.getTime());
    end.setDate(end.getDate()+6);
  }
  return {start: localDate(start), end: localDate(end)};
}

function normalizeLap(lap, index) {
  const distanceKm = positive(lap.distanceKm);
  const durationMin = positive(lap.durationMin);
  return {index: lap.index ?? index+1, distanceKm, durationMin,
    durationOrigin:lap.durationOrigin || 'recorded',
    pace: positive(lap.pace) ?? (distanceKm && durationMin ? durationMin/distanceKm : null),
    averageHr: positive(lap.averageHr), cadence: positive(lap.cadence)};
}

function resolveDetail(row, data) {
  if (row.corosDetail?.source === 'coros') return {...row.corosDetail, kind: 'kilometer-splits'};
  const key = `${row.source || 'manual'}_${row.sourceId || row._key || row.id || row.stravaId || ''}`;
  const stored = data.activity_details?.[key];
  if (stored) return {...stored, kind: 'recorded-laps'};
  if (row.healthConnectDetail) return {
    source: 'health_connect', kind: 'recorded-laps',
    laps: Object.values(row.healthConnectDetail.laps || {}).map((lap, index) => ({
      index: index+1, distanceKm: positive(lap.distanceMeters) ? lap.distanceMeters/1000 : null,
      durationMin: positive(lap.durationSeconds) ? lap.durationSeconds/60 : null,
    })),
  };
  const cached = data.strava_activity_details?.[row.stravaId || row.sourceId];
  if (cached) return {source: 'strava', kind: 'recorded-laps',
    laps: (cached.laps || []).map((lap, index) => ({index: index+1,
      distanceKm: positive(lap.distance) ? lap.distance/1000 : null,
      durationMin: positive(lap.moving_time) ? lap.moving_time/60 : null,
      averageHr: lap.average_heartrate,
      cadence: positive(lap.average_cadence) ? lap.average_cadence*2 : null,
    })), map: cached.detail?.map};
  if (Array.isArray(row.splits) && row.splits.length) return {
    source:'manual',kind:'manual-splits',laps:row.splits.map(lap=>{
      const match=/^(\d+):([0-5]\d)$/.exec(String(lap.pace || ''));
      const pace=match?Number(match[1])+Number(match[2])/60:null;
      const distanceKm=positive(row.dist) && positive(lap.km) ? Math.max(0,Math.min(1,row.dist-lap.km+1)):null;
      return {index:lap.km,distanceKm,pace,durationMin:distanceKm && pace ? distanceKm*pace:null,
        averageHr:lap.hr,durationOrigin:'derived-from-pace'};
    }),
  };
  return null;
}

export function normalizeActivity(key, row, data = {}, origin = 'workouts') {
  const raw = {...row, _key: key};
  const detail = resolveDetail(raw, data);
  const laps = Object.values(detail?.laps || {}).map(normalizeLap);
  const cadenceLaps = laps.filter(lap => lap.cadence && lap.durationMin);
  const duration = cadenceLaps.reduce((sum, lap) => sum+lap.durationMin, 0);
  const weighted = duration ? cadenceLaps.reduce((sum, lap) => sum+lap.cadence*lap.durationMin, 0)/duration : null;
  // Detail enrichment must not rewrite a Health Connect activity as COROS. The
  // top-level source is the writer that created the activity row and controls
  // provenance independently from display reconciliation.
  const source = row.source || detail?.source || 'manual';
  return {
    id: `${origin}:${key}`, key, origin, raw, name: row.name || row.purpose || row.type || 'Activity',
    date: row.date || '', type: row.type || 'run', source,
    sourceId: row.corosDetail?.sourceId || row.sourceId || row.stravaId || null,
    distanceKm: positive(row.dist), durationMin: positive(row.time),
    averageHr: positive(row.hr), cadence: positive(row.cad) ?? weighted,
    cadenceOrigin: positive(row.cad) ? 'summary' : weighted ? 'splits' : null,
    laps, lapKind: detail?.kind || null,
    route: detail?.track?.points || decodePolyline(detail?.map?.polyline || detail?.map?.summary_polyline),
    note: row.note || '', rpe: positive(row.rpe), shoe: row.shoe || '',
    startedAt: row.startTimeUtc || row.startTime || row.startTimestamp || row.startDateTime || '',
    aliases: [String(key)],
  };
}

function normalizeStrava(key, row, data) {
  if (row.dist != null) return normalizeActivity(key, {...row, source: row.source || 'strava'}, data, 'strava');
  return normalizeActivity(String(row.id || key), {
    ...row, date: (row.start_date_local || row.start_date || '').slice(0,10),
    source: 'strava', stravaId: row.id || key, sourceId: row.id || key,
    dist: finite(row.distance) == null ? null : row.distance/1000,
    time: finite(row.moving_time) == null ? null : row.moving_time/60,
    hr: row.average_heartrate, cad: positive(row.average_cadence) ? row.average_cadence*2 : null,
    type: String(row.type || '').toLowerCase(), startTime: row.start_date,
  }, data, 'strava');
}

export function activitiesFrom(data = {}) {
  const rows = [
    ...entries(data.workouts).map(([key, row]) => normalizeActivity(key, row, data)),
    ...entries(data.strava_activities).map(([key, row]) => normalizeStrava(key, row, data)),
  ];
  // Only collapse identity-proven copies. Similar daily totals alone are not identity.
  const identities = new Map();
  const result = [];
  for (const row of rows) {
    const family = row.source.startsWith('strava') ? 'strava' : row.source;
    const identity = row.sourceId ? `${family}:${row.sourceId}` : row.id;
    const previous = identities.get(identity);
    if (!previous) {identities.set(identity, row); result.push(row); continue;}
    previous.aliases.push(row.key);
    if (row.laps.length > previous.laps.length) {
      previous.laps = row.laps; previous.lapKind = row.lapKind;
      previous.cadence ??= row.cadence;
    }
  }
  return result.sort((a,b) => b.date.localeCompare(a.date) || String(b.startedAt).localeCompare(String(a.startedAt)) || a.id.localeCompare(b.id));
}

export function possibleDuplicatePairs(rows) {
  const pairs = [];
  for (let i=0; i<rows.length; i++) for (let j=i+1; j<rows.length; j++) {
    const a=rows[i], b=rows[j];
    if (!a.date || a.date!==b.date || a.type.toLowerCase()!==b.type.toLowerCase() || !a.distanceKm || !b.distanceKm || !a.durationMin || !b.durationMin) continue;
    if (a.source==='coros' && b.source==='coros' && a.sourceId!==b.sourceId) continue;
    const nearDistance=Math.abs(a.distanceKm-b.distanceKm)<=Math.max(.03,Math.max(a.distanceKm,b.distanceKm)*.05);
    const doubledDistance=Math.abs(Math.max(a.distanceKm,b.distanceKm)-2*Math.min(a.distanceKm,b.distanceKm))<=Math.max(.03,Math.max(a.distanceKm,b.distanceKm)*.03);
    const nearTime=Math.abs(a.durationMin-b.durationMin)<=Math.max(.3,Math.max(a.durationMin,b.durationMin)*.07);
    if ((nearDistance || doubledDistance) && nearTime) pairs.push([a.id,b.id]);
  }
  return pairs;
}

export function reconcileActivities(rows) {
  const matches=new Map();
  for (const coros of rows.filter(row=>row.source==='coros')) {
    const candidates=rows.filter(row=>row.source==='health_connect'
      && /healthsync/i.test(row.raw.sourceApp || '') && row.date===coros.date
      && row.type.toLowerCase()===coros.type.toLowerCase()
      && row.distanceKm && coros.distanceKm && Math.abs(row.distanceKm-coros.distanceKm)<.005
      && row.durationMin && coros.durationMin && Math.abs(row.durationMin-coros.durationMin)<.2
      && row.averageHr && coros.averageHr && Math.abs(row.averageHr-coros.averageHr)<=1);
    if (candidates.length===1) matches.set(coros.id,candidates[0]);
  }
  const hidden=new Set(),groups=[];
  for (const [id,other] of matches) {
    if ([...matches.values()].filter(row=>row.id===other.id).length!==1) continue;
    hidden.add(other.id);
    groups.push({primaryId:id,otherId:other.id,reason:'COROS + Health Sync: วัน ประเภท ระยะ เวลา และ HR ตรงกัน'});
  }
  return {activities:rows.filter(row=>!hidden.has(row.id)),groups};
}

export function wellnessFrom(data = {}) {
  const byDate = new Map();
  for (const [date, domains] of entries(data['wellness_sources/garmin'])) {
    const sleepMinutes=finite(domains.sleep?.sleepMinutes);
    const record={date,
      sleepHours:sleepMinutes == null ? null : sleepMinutes/60,
      restingHR:finite(domains.heart_rates?.restingHr), hrv:finite(domains.hrv?.lastNightAvgMs),
      spo2:finite(domains.spo2?.averagePct) ?? finite(domains.spo2?.latestPct)};
    record.sources=Object.entries(record).some(([field,value])=>field!=='date' && value != null) ? ['garmin'] : [];
    byDate.set(date,record);
  }
  for (const [key, record] of entries(data.wellness)) {
    const date = record.date || key;
    const merged = {...(byDate.get(date) || {}), date, key};
    for (const [field, value] of Object.entries(record)) if (value !== '' && value != null) merged[field]=value;
    const stated=Array.isArray(record.sources) ? record.sources : record.source ? [record.source] : [];
    const normalized=stated.map(source=>String(source).trim().toLowerCase()).filter(Boolean);
    if (record.healthConnectSyncedAt != null && !normalized.includes('health_connect')) normalized.push('health_connect');
    if (Array.isArray(record.garminDomains) && record.garminDomains.length && !normalized.includes('garmin')) normalized.push('garmin');
    merged.sources=[...new Set([...(byDate.get(date)?.sources || []),...(normalized.length ? normalized : ['manual'])])];
    byDate.set(date, merged);
  }
  return [...byDate.values()].sort((a,b)=>b.date.localeCompare(a.date));
}

export function activePlanFrom(data = {}) {
  const id = data.active_coach_plan_id;
  if (!id || typeof id !== 'string') return null;
  const plan = data.coach_plans?.[id];
  return plan?.status === 'active' ? plan : null;
}

export function reviewFor(activity, data = {}) {
  return entries(data.post_run_reviews).map(([key,review])=>({...review,key}))
    .find(review => activity.aliases.includes(String(review.workoutKey || review.key))) || null;
}

export function summarize(rows, bounds = null) {
  const selected = bounds ? rows.filter(row => row.date >= bounds.start && row.date <= bounds.end) : rows;
  return {rows: selected, count: selected.length,
    distanceKm: selected.reduce((sum,row)=>sum+(row.distanceKm || 0),0),
    durationMin: selected.reduce((sum,row)=>sum+(row.durationMin || 0),0)};
}

// All screens consume the canonical history, including past Health Connect workouts.
export function trainingActivities(rows = []) {
  return rows;
}

// Health Connect exercise rows before the cutover are retained as evidence, but
// are not training totals: several dates contain duplicate or fragmented rows.
export function legacyHealthConnectActivities(rows = []) {
  return rows.filter(row=>row.source==='health_connect');
}

// A wellness row can contain values written by more than one historical bridge.
// We retain every value, but never present a mixed row as a clean Health Connect
// measurement. Garmin's scheduled writer was disabled on 2026-09-14.
export function wellnessSourceState(row = {}) {
  const sources=new Set(row.sources || []);
  const healthConnect=sources.has('health_connect');
  const garmin=sources.has('garmin');
  if (healthConnect && garmin) return 'mixed_legacy';
  if (healthConnect) return 'health_connect';
  if (garmin) return 'garmin_legacy';
  return 'manual';
}

export function cleanHealthConnectStreak(rows = []) {
  let days=0;
  for (const row of rows) {
    if (wellnessSourceState(row)!=='health_connect') break;
    days+=1;
  }
  return days;
}

export function buildModel(snapshot) {
  const data = snapshot.data || {};
  const rawActivities=activitiesFrom(data);
  const inputs=[...entries(data.workouts).map(([key,row])=>({...row,_key:key})),
    ...entries(data.strava_activities).map(([key,row])=>normalizeStrava(key,row,data).raw)];
  const activities=canonicalWorkouts(inputs).map(row=>normalizeActivity(row._key,row,data,
    data.workouts?.[row._key] ? 'workouts' : 'strava'));
  const groups=[];
  return {activities, wellness: wellnessFrom(data), plan: activePlanFrom(data),
    rawActivities,matchedSources:groups,
    plans: entries(data.coach_plans).map(([key, row])=>({...row,key})),
    possibleDuplicates: possibleDuplicatePairs(activities), data,
    readAt: snapshot.readAt, mode: snapshot.mode};
}

export function dataMode(loc = typeof location !== 'undefined' ? location : null, _storage = null) {
  if (!loc) return 'cloud';
  const hostname = loc.hostname || '';
  const search = loc.search || '';
  const isLocal = ['localhost', '127.0.0.1'].includes(hostname);
  if (isLocal && new URLSearchParams(search).get('mode') === 'snapshot') {
    return 'snapshot';
  }
  return 'cloud';
}

import {decodePolyline} from './polyline.mjs';
