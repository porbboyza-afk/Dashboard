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
    if (source === 'garmin') return { label: 'GARMIN DIRECT', title: 'Garmin Direct', color: 'var(--green)', bg: 'rgba(52,199,89,.14)' };
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
    if (source === 'garmin') return 60;
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

  function activityPace(workout) {
    const dist = parseFloat(workout?.dist || 0);
    const time = parseFloat(workout?.time || 0);
    if (dist <= 0 || time <= 0) return null;
    return time / dist;
  }

  function isPaceAnomaly(workout) {
    const dist = parseFloat(workout?.dist || 0);
    const pace = activityPace(workout);
    const type = String(workout?.type || '').toLowerCase();
    if (type === 'walk') return pace !== null && pace < 4.5;
    if (dist >= 1.0 && pace !== null && pace < 3.75) return true;
    return dist >= 0.5 && pace !== null && pace < 3.4;
  }

  function isDuplicateCandidate(first, second) {
    if (!first || !second || first === second || (first.date || '') !== (second.date || '')) return false;
    const firstKey = activitySourceKey(first);
    const secondKey = activitySourceKey(second);
    if (firstKey && secondKey && firstKey === secondKey) return false;

    const firstDistance = parseFloat(first.dist || 0);
    const secondDistance = parseFloat(second.dist || 0);
    const firstTime = parseFloat(first.time || 0);
    const secondTime = parseFloat(second.time || 0);
    if (!firstDistance || !secondDistance || !firstTime || !secondTime) return false;

    const distanceDifference = Math.abs(firstDistance - secondDistance);
    const timeDifference = Math.abs(firstTime - secondTime);
    const maxDistance = Math.max(firstDistance, secondDistance);
    const maxTime = Math.max(firstTime, secondTime);

    // 1. Near match / rounding difference across same or different sources
    const isNearMatch = (distanceDifference <= 0.35 || distanceDifference / maxDistance <= 0.05)
      && (timeDifference <= 3.5 || timeDifference / maxTime <= 0.07);
    if (isNearMatch) return true;

    // 2. Double-distance anomaly (e.g. 6 km vs 12 km in same duration)
    const isDoubleDistanceMatch = (timeDifference <= 3.5 || timeDifference / maxTime <= 0.06)
      && (Math.abs(firstDistance - 2 * secondDistance) <= 0.6 || Math.abs(secondDistance - 2 * firstDistance) <= 0.6);
    if (isDoubleDistanceMatch) return true;

    return false;
  }

  function pickPrimaryWorkout(first, second) {
    const anomalyFirst = isPaceAnomaly(first);
    const anomalySecond = isPaceAnomaly(second);
    if (anomalyFirst && !anomalySecond) return second;
    if (anomalySecond && !anomalyFirst) return first;

    const prioFirst = activitySourcePriority(first);
    const prioSecond = activitySourcePriority(second);
    if (prioFirst > prioSecond) return first;
    if (prioSecond > prioFirst) return second;

    const score = w => (w.hr ? 2 : 0) + (w.cadence ? 1 : 0) + (w.cal ? 1 : 0);
    return score(first) >= score(second) ? first : second;
  }

  function duplicateRoundingRegression() {
    return isDuplicateCandidate(
      { date: '2026-07-09', type: 'run', source: 'garmin', dist: 1.33, time: 9 },
      { date: '2026-07-09', type: 'run', source: 'health_connect', dist: 1.32889, time: 8.9667 }
    );
  }

  function duplicateCandidatePairs(activities = [...(root._workouts || []), ...(root._stravaWorkouts || [])]) {
    const rows = activities.filter(workout => workout?.date).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const pairs = [];
    for (let index = 0; index < rows.length; index += 1) {
      for (let candidateIndex = index + 1; candidateIndex < rows.length; candidateIndex += 1) {
        if (rows[candidateIndex].date !== rows[index].date) break;
        if (!isDuplicateCandidate(rows[index], rows[candidateIndex])) continue;

        const primary = pickPrimaryWorkout(rows[index], rows[candidateIndex]);
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
      if (!previous || pickPrimaryWorkout(workout, previous) === workout) {
        seen.set(fingerprint, { ...workout, _dedupedWith: previous ? [...(previous._dedupedWith || []), previous.source || 'manual'] : workout._dedupedWith });
      } else {
        previous._dedupedWith = [...(previous._dedupedWith || []), workout.source || 'manual'];
      }
    });

    const merged = [...seen.values()];
    const suppressed = new Set();
    duplicateCandidatePairs(merged).forEach(pair => {
      const primaryKey = activitySourceKey(pair.primary);
      suppressed.add(activitySourceKey(pair.duplicate));
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

    return merged.filter(workout => !suppressed.has(activitySourceKey(workout))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  Object.assign(root, {
    escapeHTML,
    sourceMeta,
    sourceBadge,
    workoutFingerprint,
    activityPace,
    isPaceAnomaly,
    pickPrimaryWorkout,
    activitySourcePriority,
    activitySourceKey,
    isStravaLike,
    isDuplicateCandidate,
    duplicateRoundingRegression,
    duplicateCandidatePairs,
    getAllActivities,
  });
})(window);
