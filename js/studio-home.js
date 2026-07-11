(function(root) {
  'use strict';

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const todayKey = () => dateKey(new Date());
  const dateLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }).toUpperCase();

  function sessionStyle(session) {
    const type = session?.type || 'Rest';
    if (type === 'Tempo' || type === 'Interval') return 'quality';
    if (type === 'Long') return 'long';
    if (type === 'Recovery') return 'recovery';
    if (type === 'Rest') return 'rest';
    return 'easy';
  }

  function sessionTitle(session) {
    if (!session) return 'Open day';
    const names = { Easy: 'Easy aerobic', Recovery: 'Recovery run', Tempo: 'Tempo', Interval: 'Intervals', Long: 'Long run', Rest: 'Rest / recovery' };
    return names[session.type] || session.type || 'Session';
  }

  function sessionDetail(session) {
    if (!session || session.type === 'Rest') return session?.recoveryAdvice?.summary || 'Walk, mobility, and sleep focus';
    const pieces = [];
    if (session.targetDist > 0) pieces.push(`${session.targetDist} km`);
    if (session.targetPaceRange || session.targetPace) pieces.push(`pace ${session.targetPaceRange || session.targetPace}`);
    if (session.targetHR) pieces.push(`HR ${session.targetHR}`);
    return pieces.join(' · ') || session.workoutSpec?.mainSet || 'Open session details';
  }

  function weekDates() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(date);
      day.setDate(day.getDate() + index);
      return dateKey(day);
    });
  }

  function activityLine(activity) {
    const pace = activity.avgPace && root.formatPace ? ` · ${root.formatPace(activity.avgPace)}/km` : '';
    return `${number(activity.dist).toFixed(1)} km · ${Math.round(number(activity.time))} min${pace}`;
  }

  function render() {
    const host = document.getElementById('studio-home');
    if (!host) return;
    host.closest('.page')?.classList.add('studio-enabled');
    const activities = typeof root.getAllActivities === 'function' ? root.getAllActivities() : (root._workouts || []);
    const wellness = root.AppState?.get('wellness') || [];
    const plan = root.AppState?.get('coachPlan') || root._coachPlan || null;
    const today = todayKey();
    const readiness = typeof root.calculateReadiness === 'function' ? root.calculateReadiness() : { score: null, level: 'Add wellness data', today: null, load: {} };
    const decision = plan && typeof root.coachDailyDecision === 'function' ? root.coachDailyDecision(plan, today) : null;
    const todaySession = decision?.session || (plan?.sessions || []).find(session => session.date === today) || null;
    const hasPlan = !!plan?.sessions?.length;
    const todayState = decision?.status || (readiness.score >= 80 ? 'green' : readiness.score >= 60 ? 'yellow' : 'red');
    const weekStart = weekDates()[0];
    const weekly = root.MyDashTodayDashboard?.build({ activities, weekStart }) || { weeklyDistanceKm: 0, weeklyActivityCount: 0 };
    const load = readiness.load || {};
    const sleep = readiness.today?.sleepHours != null && root.formatSleepHours ? root.formatSleepHours(readiness.today.sleepHours, { compact: true }) : '—';
    const reason = decision?.reasons?.[0] || readiness.reasons?.[0] || 'Add a morning check-in to personalize today’s decision.';
    const schedule = weekDates().map(day => {
      const session = (plan?.sessions || []).find(item => item.date === day) || null;
      const activity = activities.find(item => item.date === day) || null;
      const isToday = day === today;
      const done = !!activity || !!plan?.completedDates?.[day];
      return `<article class="studio-day ${isToday ? 'is-today' : ''} ${done ? 'is-done' : ''}">
        <div class="studio-day-date">${dateLabel(day)}</div>
        <div class="studio-workout ${sessionStyle(session)}">
          <span>${session ? escapeHtml(session.type || 'SESSION') : 'OPEN'}</span>
          <b>${escapeHtml(sessionTitle(session))}</b>
          <small>${escapeHtml(sessionDetail(session))}</small>
        </div>
        ${done ? `<div class="studio-done">Completed${activity ? ` · ${escapeHtml(activityLine(activity))}` : ''}</div>` : ''}
      </article>`;
    }).join('');
    const history = activities.slice(0, 3).map(activity => `<div class="studio-story-row">
      <div class="studio-story-date">${escapeHtml((activity.date || '').slice(5).replace('-', '/')) || '—'}</div>
      <div><b>${escapeHtml(activity.name || activity.type || 'Activity')}</b><p>${escapeHtml(activityLine(activity))}</p></div>
      <button class="studio-icon-button" title="Post-run review" onclick="openPostRunReview('${escapeHtml(typeof root.postRunWorkoutKey === 'function' ? root.postRunWorkoutKey(activity) : activity._key || '')}')">Review</button>
    </div>`).join('') || '<p class="studio-empty">No activity yet. Add a run or sync Health Connect to begin.</p>';
    const signedIn = root._fb?.isSignedIn?.();
    const title = hasPlan ? sessionTitle(todaySession) : 'No active training plan';
    const intro = hasPlan ? sessionDetail(todaySession) : 'Create a goal-based plan to receive a daily session, recovery guidance, and a weekly board.';
    const sessionGuidance = hasPlan ? (decision?.applyLabel || 'Follow the planned effort. Stop or reduce if pain changes your stride.') : 'MyDash will not invent a workout when no plan exists. Create a plan first, or record an unplanned activity.';
    const primaryAction = hasPlan ? 'Open plan' : 'Create plan';
    host.innerHTML = `<div class="studio-date">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</div>
      <section class="studio-intro">
        <div><h1>Today: <em>${escapeHtml(title)}</em></h1><p>${escapeHtml(intro)}</p></div>
        <div class="studio-readiness ${todayState}"><span>MORNING CHECK-IN</span><strong>${readiness.score ?? '—'} / ${escapeHtml(readiness.level || 'No data')}</strong><small>${escapeHtml(reason)}</small></div>
      </section>
      ${!signedIn ? `<section class="studio-login"><div><b>Sync your training data</b><span>Sign in to load workouts, wellness, and your active plan.</span></div><button class="studio-primary" onclick="window._fb.loginGoogle()">Sign in with Google</button></section>` : ''}
      <section class="studio-today-grid">
        <article class="studio-session-card"><span>${hasPlan ? "TODAY'S SESSION" : 'PLAN STATUS'}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(sessionGuidance)}</p><div class="studio-pills"><i>${escapeHtml(hasPlan ? (todaySession?.targetHR || 'Use talk test') : 'No plan')}</i><i>${escapeHtml(hasPlan ? (todaySession?.targetPaceRange || todaySession?.targetPace || 'Controlled effort') : 'No prescribed effort')}</i><i>${escapeHtml(hasPlan ? (decision?.action || 'plan') : 'Create first')}</i></div><div class="studio-actions"><button class="studio-primary" onclick="${hasPlan ? 'openStudioPlan()' : "showPage('coach')"}">${primaryAction}</button><button class="studio-secondary" onclick="${hasPlan ? "showPage('wellness')" : "showPage('fitness-log')"}">${hasPlan ? 'Check in' : 'Log activity'}</button></div></article>
        <aside class="studio-signals"><div><b>${weekly.weeklyDistanceKm.toFixed(1)}</b><small>KM THIS WEEK</small></div><div><b>${weekly.weeklyActivityCount}</b><small>ACTIVITIES</small></div><div><b>${load.acwr == null ? '—' : load.acwr.toFixed(2)}</b><small>ACWR</small></div><div><b>${sleep}</b><small>SLEEP</small></div></aside>
      </section>
      <header class="studio-section-head"><h2>${escapeHtml(plan?.goal || 'Training week')}</h2><span>${plan ? `${plan.totalWeeks || '—'} weeks · ${plan.sessions?.filter(session => session.type !== 'Rest').length || 0} planned sessions` : 'Create a Coach plan to populate the board'}</span></header>
      <section class="studio-board">${schedule}</section>
      <section class="studio-bottom"><article class="studio-panel"><h3>RECENT TRAINING</h3>${history}</article><aside class="studio-panel"><h3>LOAD DISTRIBUTION</h3><div class="studio-load"><i style="width:${Math.min(100, Math.max(8, (load.acute || 0) / 6))}%"></i></div><p class="studio-panel-copy">7-day load: ${Math.round(load.acute || 0)} AU · ${load.acwr == null ? 'Build more history for ACWR' : `ACWR ${load.acwr.toFixed(2)}`}</p><div class="studio-coach-note"><b>Coach context</b>${escapeHtml(decision?.reasons?.join(' · ') || 'Your daily decision will appear here once you have wellness and plan data.')}</div></aside></section>`;
  }

  function init() {
    render();
    if (!root.AppState) return;
    ['workouts', 'coachPlan', 'wellness'].forEach(key => root.AppState.subscribe(key, render));
  }

  root.openStudioPlan = function openStudioPlan() {
    const plan = root.AppState?.get('coachPlan') || root._coachPlan;
    root.showPage('coach');
    if (typeof root.switchCoachTab === 'function') root.switchCoachTab('track', null);
    const today = todayKey();
    const index = (plan?.sessions || []).findIndex(session => session.date === today && session.type !== 'Rest');
    if (index >= 0 && typeof root.showCoachSessionDetail === 'function') {
      setTimeout(() => root.showCoachSessionDetail(index), 80);
    }
  };
  root.renderStudioHome = render;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
