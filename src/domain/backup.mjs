function csvCell(value) {
  let text = typeof value === 'object' ? JSON.stringify(value ?? '') : String(value ?? '');
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"','""')}"`;
}

function records(value) {
  return Object.entries(value || {}).filter(([,row]) => row && typeof row === 'object').map(([key,row]) => ({...structuredClone(row),_key:key}));
}

export function backupPayload(model, exportedAt = new Date().toISOString()) {
  const data = model?.data || {};
  return {
    format: 'MyDash Performance backup', version: 2, exportedAt,
    sourceReadAt: model?.readAt ?? null, sourceMode: model?.mode ?? 'unknown',
    workouts: records(data.workouts), wellness: records(data.wellness),
    coachPlans: records(data.coach_plans),
    activeCoachPlanId: typeof data.active_coach_plan_id === 'string' ? data.active_coach_plan_id : null,
    stravaActivities: records(data.strava_activities),
    stravaDetails: structuredClone(data.strava_activity_details || {}),
    activityDetails: structuredClone(data.activity_details || {}),
    wellnessGarmin: structuredClone(data['wellness_sources/garmin'] || {}),
    postRunReviews: structuredClone(data.post_run_reviews || {}),
    trainingAnalyses: structuredClone(data.training_analyses || {}),
    coachPlan: structuredClone(data.coach_plan || null),
    races: structuredClone(data.races || {}),
  };
}

export function activitiesCsv(activities = []) {
  const headers = ['date','source','type','name','distance_km','time_min','avg_hr','cadence','rpe','shoe','note'];
  const rows = activities.map(activity => [activity.date,activity.source,activity.type,activity.name,activity.distanceKm,activity.durationMin,activity.averageHr,activity.cadence,activity.rpe,activity.shoe,activity.note]);
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function inspectBackup(text) {
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error('ไฟล์สำรองไม่ใช่ JSON ที่อ่านได้'); }
  if (!payload || typeof payload !== 'object') throw new Error('รูปแบบไฟล์สำรองไม่ถูกต้อง');
  const workouts = Array.isArray(payload.workouts) ? payload.workouts : [];
  const wellness = Array.isArray(payload.wellness) ? payload.wellness : [];
  if (!Array.isArray(payload.workouts) && !Array.isArray(payload.wellness)) throw new Error('ไม่พบรายการกิจกรรมหรือสุขภาพในไฟล์สำรอง');
  return {payload, workouts: workouts.length, wellness: wellness.length, plans: Array.isArray(payload.coachPlans) ? payload.coachPlans.length : 0};
}
