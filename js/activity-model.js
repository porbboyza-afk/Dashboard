(function(root) {
  'use strict';

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));
  }

  function sourceMeta(workoutOrSource) {
    const source = typeof workoutOrSource === 'string' ? workoutOrSource : (workoutOrSource?.source || 'manual');
    const sourceApp = typeof workoutOrSource === 'object' ? String(workoutOrSource.sourceApp || '').toLowerCase() : '';
    if (source === 'health_connect') return { label: sourceApp.includes('garmin') ? 'GARMIN' : 'HC', title: 'Health Connect', color: 'var(--green)', bg: 'rgba(52,199,89,.14)' };
    if (source === 'strava_recovered') return { label: 'STRAVA LEGACY', title: 'Recovered Strava cache', color: 'var(--strava)', bg: 'rgba(252,76,2,.15)' };
    if (source === 'strava_archive') return { label: 'STRAVA ARCHIVE', title: 'Strava archive import', color: 'var(--strava)', bg: 'rgba(252,76,2,.15)' };
    if (source === 'strava') return { label: 'STRAVA API', title: 'Legacy Strava API', color: 'var(--strava)', bg: 'rgba(252,76,2,.15)' };
    return { label: 'MANUAL', title: 'Manual / MyDash Cloud', color: 'var(--accent)', bg: 'var(--accent-light)' };
  }

  function sourceBadge(workoutOrSource, compact = false) {
    const meta = sourceMeta(workoutOrSource);
    return `<span title="${escapeHTML(meta.title)}" style="display:inline-flex;align-items:center;vertical-align:middle;font-size:${compact ? '8' : '9'}px;background:${meta.bg};color:${meta.color};border-radius:999px;padding:${compact ? '1px 5px' : '2px 7px'};font-weight:800;margin-left:5px;letter-spacing:.2px">${meta.label}</span>`;
  }

  function workoutFingerprint(workout) {
    return `${workout.date || ''}|${String(workout.type || '').toLowerCase()}|${Math.round(parseFloat(workout.dist || 0) * 20)}|${Math.round(parseFloat(workout.time || 0))}`;
  }

  function activitySourcePriority(workout) {
    const source = workout?.source || 'manual';
    if (source === 'health_connect') return 50;
    if (source === 'manual' || !workout?.source) return 45;
    if (source === 'strava_recovered') return 30;
    if (source === 'strava_archive') return 25;
    if (source === 'strava') return 20;
    return 10;
  }

  function activitySourceKey(workout) {
    return `${workout?.source || 'manual'}:${workout?._key || workout?.id || workout?.stravaId || workout?.date || ''}`;
  }

  function isStravaLike(workout) {
    return ['strava', 'strava_recovered', 'strava_archive'].includes(workout?.source || '');
  }

  function isDuplicateCandidate(first, second) {
    if (!first || !second || first === second || (first.date || '') !== (second.date || '')) return false;
    const firstSource = first.source || 'manual';
    const secondSource = second.source || 'manual';
    if (firstSource === secondSource || !(isStravaLike(first) || isStravaLike(second))) return false;

    const firstDistance = parseFloat(first.dist || 0);
    const secondDistance = parseFloat(second.dist || 0);
    const firstTime = parseFloat(first.time || 0);
    const secondTime = parseFloat(second.time || 0);
    if (!firstDistance || !secondDistance || !firstTime || !secondTime) return false;

    const distanceDifference = Math.abs(firstDistance - secondDistance);
    const timeDifference = Math.abs(firstTime - secondTime);
    return distanceDifference <= 0.25
      && distanceDifference / Math.max(firstDistance, secondDistance) <= 0.04
      && timeDifference <= 180
      && timeDifference / Math.max(firstTime, secondTime) <= 0.06;
  }

  function duplicateCandidatePairs(activities = [...(root._workouts || []), ...(root._stravaWorkouts || [])]) {
    const rows = activities.filter(workout => workout?.date).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const pairs = [];
    for (let index = 0; index < rows.length; index += 1) {
      for (let candidateIndex = index + 1; candidateIndex < rows.length; candidateIndex += 1) {
        if (rows[candidateIndex].date !== rows[index].date) break;
        if (!isDuplicateCandidate(rows[index], rows[candidateIndex])) continue;

        const primary = activitySourcePriority(rows[index]) >= activitySourcePriority(rows[candidateIndex]) ? rows[index] : rows[candidateIndex];
        const duplicate = primary === rows[index] ? rows[candidateIndex] : rows[index];
        pairs.push({
          primary,
          duplicate,
          reason: 'same-day distance/time near match',
          distDiff: +Math.abs((parseFloat(rows[index].dist) || 0) - (parseFloat(rows[candidateIndex].dist) || 0)).toFixed(2),
          timeDiff: Math.round(Math.abs((parseFloat(rows[index].time) || 0) - (parseFloat(rows[candidateIndex].time) || 0)))
        });
      }
    }
    return pairs;
  }

  function getAllActivities() {
    const seen = new Map();
    [...(root._workouts || []), ...(root._stravaWorkouts || [])].forEach(workout => {
      const fingerprint = workoutFingerprint(workout);
      const previous = seen.get(fingerprint);
      if (!previous || activitySourcePriority(workout) > activitySourcePriority(previous)) {
        seen.set(fingerprint, { ...workout, _dedupedWith: previous ? [...(previous._dedupedWith || []), previous.source || 'manual'] : workout._dedupedWith });
      } else {
        previous._dedupedWith = [...(previous._dedupedWith || []), workout.source || 'manual'];
      }
    });

    const merged = [...seen.values()];
    duplicateCandidatePairs().forEach(pair => {
      const primaryKey = activitySourceKey(pair.primary);
      const target = merged.find(workout => activitySourceKey(workout) === primaryKey || workoutFingerprint(workout) === workoutFingerprint(pair.primary));
      if (!target) return;
      target._possibleDuplicates = [...(target._possibleDuplicates || []), {
        source: pair.duplicate.source || 'manual',
        key: pair.duplicate._key || pair.duplicate.id || '',
        dist: pair.duplicate.dist,
        time: pair.duplicate.time,
        reason: pair.reason,
        distDiff: pair.distDiff,
        timeDiff: pair.timeDiff
      }];
    });

    return merged.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  Object.assign(root, {
    escapeHTML,
    sourceMeta,
    sourceBadge,
    workoutFingerprint,
    activitySourcePriority,
    activitySourceKey,
    isStravaLike,
    isDuplicateCandidate,
    duplicateCandidatePairs,
    getAllActivities,
  });
})(window);
