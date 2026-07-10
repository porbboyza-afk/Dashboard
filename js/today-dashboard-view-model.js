(function(root) {
  'use strict';

  function number(value) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function localDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function computeStreak(activities = [], now = new Date()) {
    if (!activities.length) return 0;
    const days = new Set(activities.map(activity => activity?.date).filter(Boolean));
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const cursor = new Date(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (!days.has(localDateString(today)) && !days.has(localDateString(yesterday))) return 0;
    if (!days.has(localDateString(today))) cursor.setDate(cursor.getDate() - 1);

    let streak = 0;
    while (days.has(localDateString(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function computePR(activities = []) {
    const records = { '5k': null, '10k': null, longest: null };
    activities.forEach(activity => {
      const distance = number(activity?.dist);
      const pace = number(activity?.avgPace);
      if (distance >= 4.9 && pace > 0 && (!records['5k'] || pace < records['5k'].pace)) records['5k'] = { pace, date: activity.date, dist: distance };
      if (distance >= 9.8 && pace > 0 && (!records['10k'] || pace < records['10k'].pace)) records['10k'] = { pace, date: activity.date, dist: distance };
      if (!records.longest || distance > records.longest.dist) records.longest = { dist: distance, date: activity.date, pace };
    });
    return records;
  }

  function loadLevel(metrics = {}) {
    const acute = Math.round(number(metrics.acute));
    if (metrics.acwr !== null && metrics.acwr !== undefined) {
      if (metrics.acwr < 0.8) return { label: 'เบา', color: 'var(--accent)' };
      if (metrics.acwr <= 1.3) return { label: 'ปานกลาง', color: 'var(--green)' };
      if (metrics.acwr <= 1.5) return { label: 'ค่อนข้างหนัก', color: 'var(--orange)' };
      return { label: 'หนักมาก', color: 'var(--red)' };
    }
    if (acute < 200) return { label: 'เบา', color: 'var(--accent)' };
    if (acute < 400) return { label: 'ปานกลาง', color: 'var(--green)' };
    if (acute < 600) return { label: 'ค่อนข้างหนัก', color: 'var(--orange)' };
    return { label: 'หนักมาก', color: 'var(--red)' };
  }

  function build({ activities = [], weekStart = '' } = {}) {
    const weeklyActivities = activities
      .filter(activity => (activity?.date || '') >= weekStart)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const totalDistance = weeklyActivities.reduce((sum, activity) => sum + number(activity.dist), 0);

    return {
      weekStart,
      weeklyActivityCount: weeklyActivities.length,
      weeklyDistanceKm: Math.round(totalDistance * 100) / 100,
      recentActivities: weeklyActivities.slice(0, 5),
    };
  }

  root.MyDashTodayDashboard = { build, computeStreak, computePR, loadLevel };
  root.computeStreak = computeStreak;
  root.computePR = computePR;
})(window);
