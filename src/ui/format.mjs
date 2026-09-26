export const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const number = (value, digits=1) => value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('en-US',{maximumFractionDigits: digits});
export function sleepDuration(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const totalMinutes = Math.round(Math.max(0, Number(value)) * 60);
  const hours = Math.floor(totalMinutes / 60), minutes = totalMinutes % 60;
  return minutes ? `${hours} ชม. ${minutes} นาที` : `${hours} ชม.`;
}
export function clock(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return '—';
  const seconds = Math.round(Number(minutes)*60);
  const h = Math.floor(seconds/3600), m = Math.floor(seconds/60)%60, s = seconds%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}
export function effortLabel(value) {
  const rpe=Number(value);
  if (!Number.isFinite(rpe) || rpe<1 || rpe>10) return null;
  if (rpe<=3) return {label:'เบา',description:'เหมาะกับการฟื้นตัวหรือวิ่งสบาย'};
  if (rpe<=6) return {label:'ปานกลาง',description:'ออกแรงพอควร แต่ยังควบคุมได้'};
  if (rpe<=8) return {label:'หนัก',description:'เป็นงานคุณภาพ ควรคำนึงถึงการฟื้นตัว'};
  return {label:'หนักมาก',description:'ใช้แรงสูง ควรให้เวลาฟื้นตัวเพียงพอ'};
}
export function dateLabel(date, options = {}) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.valueOf()) ? 'ไม่ทราบวันที่' : parsed.toLocaleDateString('th-TH',{day:'numeric',month:'short',...options});
}
export const activityUrl = activity => `#activity/${encodeURIComponent(activity.id)}`;
export const sourceLabel = source => ({coros:'COROS',health_connect:'Health Connect',garmin:'Garmin',manual:'Manual',strava:'Strava',strava_recovered:'Strava archive',strava_archive:'Strava archive'}[source] || source);
