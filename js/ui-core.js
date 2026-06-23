function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('mydash-theme', newTheme);
  const toggle = document.getElementById('theme-toggle');
  const label = document.getElementById('theme-label');
  if (toggle) {
    if (newTheme === 'dark') toggle.classList.add('dark');
    else toggle.classList.remove('dark');
  }
  if (label) label.textContent = newTheme === 'dark' ? 'Dark Mode' : 'Light Mode';
  rebuildCharts();
}

function initTheme() {
  const saved = localStorage.getItem('mydash-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const toggle = document.getElementById('theme-toggle');
  const label = document.getElementById('theme-label');
  if (toggle && saved === 'dark') toggle.classList.add('dark');
  if (label) label.textContent = saved === 'dark' ? 'Dark Mode' : 'Light Mode';
}

function rebuildCharts() {
  if (document.getElementById('page-fitness-stats')?.classList.contains('active')) {
    setTimeout(renderCurrentStatsView, 50);
  }
  if (document.getElementById('page-wellness')?.classList.contains('active')) {
    if (document.getElementById('wellness-analytics-view')?.style.display !== 'none') {
      setTimeout(renderWellnessAnalytics, 50);
    }
  }
  if (document.getElementById('page-strava')?.classList.contains('active') &&
      document.getElementById('strava-overview-view')?.style.display !== 'none') {
    setTimeout(() => renderStravaOverview(window._stravaAllActs || []), 50);
  }
  if (document.getElementById('page-today')?.classList.contains('active')) {
    setTimeout(renderDashboardHomeInsights, 50);
  }
}

function showLoading(msg='Loading') {
  document.getElementById('loading-msg').textContent = msg;
  document.getElementById('loading-overlay').classList.add('show');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.remove('show');
}

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type}`;
  t.style.display = 'block';
  clearTimeout(t._to);
  t._to = setTimeout(() => t.style.display = 'none', 3500);
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id)?.classList.add('active');
  document.querySelector(`.nav-item[data-page="${id}"]`)?.classList.add('active');
  if (id === 'today') renderTodayStats();
  if (id === 'fitness-log') document.getElementById('f-date').value = toLocalDateStr();
  if (id === 'fitness-stats') {
    initStatsNav();
    renderCurrentStatsView();
  }
  if (id === 'wellness') setTimeout(renderWellness, 50);
  if (id === 'strava') renderStravaPage();
  if (id === 'coach') {
    const sd = document.getElementById('coach-start-date');
    if (sd && !sd._listenerAdded) {
      sd.addEventListener('change', updateCoachEndDate);
      sd._listenerAdded = true;
    }
    if (sd) sd.value = toLocalDateStr();
    updateCoachEndDate();
    renderCoachTracking();
  }
}

initTheme();
