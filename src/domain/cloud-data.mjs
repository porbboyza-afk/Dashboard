export const dataPaths=['workouts','activity_details','wellness','wellness_sources/garmin','post_run_reviews',
  'coach_plans','coach_plan','active_coach_plan_id','sync_sources','strava_activities','strava_activity_details','training_analyses','races','settings/athleteProfile'];

export function selectCloudData(value) {
  const source=value && typeof value==='object' ? value : {};
  return Object.fromEntries(dataPaths.map(path=>[path,path.split('/').reduce((parent,key)=>parent?.[key],source) ?? null]));
}
