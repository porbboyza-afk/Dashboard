function toLocalDateStr(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Strava's start_date_local is a wall-clock time for the activity location.
// It commonly ends in "Z", but must not be parsed as UTC: doing so adds the
// browser offset again and turns Sunday evening into Monday in Thailand.
function stravaLocalParts(activity) {
  const value = String(activity?.start_date_local || '');
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/);
  if (match) {
    return {
      year: +match[1], month: +match[2], day: +match[3],
      hour: +(match[4] || 0), minute: +(match[5] || 0), second: +(match[6] || 0)
    };
  }
  if (!activity?.start_date) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(activity.start_date));
  const get = type => +(parts.find(part => part.type === type)?.value || 0);
  return {
    year: get('year'), month: get('month'), day: get('day'),
    hour: get('hour'), minute: get('minute'), second: get('second')
  };
}

function stravaLocalDate(activity) {
  const p = stravaLocalParts(activity);
  return p ? new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) : null;
}

function stravaLocalDateStr(activity) {
  const p = stravaLocalParts(activity);
  return p
    ? `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`
    : '';
}

function formatStravaLocal(activity, locale='th-TH', options={}) {
  const p = stravaLocalParts(activity);
  if (!p) return '—';
  const wallClockAsUtc = new Date(Date.UTC(
    p.year, p.month - 1, p.day, p.hour, p.minute, p.second
  ));
  return wallClockAsUtc.toLocaleString(locale, {...options, timeZone:'UTC'});
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d;
}

function getWeekDates(offsetWeeks = 0) {
  const monday = getMondayOfWeek(new Date());
  monday.setDate(monday.getDate() + offsetWeeks * 7);
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getThisWeekStart() {
  return getMondayOfWeek(new Date());
}
