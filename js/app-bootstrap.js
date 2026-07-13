(function(root) {
  'use strict';

  function byDateDescending(data) {
    return data
      ? Object.entries(data)
        .map(([key, value]) => ({ _key: key, ...value }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      : [];
  }

  function startRealtimeListeners() {
    root._fb.listen('workouts', data => {
      root.AppState.set('workouts', byDateDescending(data));
    });
    root._fb.listen('activity_details', data => {
      root.AppState.set('activityDetails', data || {});
    });
    root._fb.listen('coach_plan', data => {
      if (data) {
        root.AppState.set('coachPlan', data);
        return;
      }
      // V2 plans are versioned under coach_plans. Keep Today and Coach on the same active plan.
      if (root.MyDashCoachRepository?.loadActivePlan) {
        root.MyDashCoachRepository.loadActivePlan()
          .then(plan => root.AppState.set('coachPlan', plan || null))
          .catch(error => console.warn('Active Coach plan:', error.message));
      } else {
        root.AppState.set('coachPlan', null);
      }
    });
    root._fb.listen('post_run_reviews', data => {
      root.AppState.set('postRunReviews', byDateDescending(data));
    });
    root._fb.listen('wellness', data => {
      root.AppState.set('manualWellness', byDateDescending(data));
      mergeWellnessSources();
    });
    root._fb.listen('wellness_sources/garmin', data => {
      root.AppState.set('garminWellness', data || {});
      mergeWellnessSources();
    });
    root._fb.listen('strava_activities', data => {
      if (!data) return;
      const activities = Array.isArray(data) ? data : Object.values(data);
      root.renderStravaActivities(activities);
    });
  }

  function finite(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function garminWellnessByDate(data) {
    return Object.entries(data || {}).map(([date, domains]) => {
      const sleep = domains?.sleep || {}, hrv = domains?.hrv || {}, heart = domains?.heart_rates || {};
      const stress = domains?.stress || {}, battery = domains?.body_battery || {}, spo2 = domains?.spo2 || {};
      const sleepMinutes = finite(sleep.sleepMinutes), sleepScore = finite(sleep.sleepScore), averageStress = finite(stress.averageStress);
      return {
        _key: `garmin_${date}`, date, source: 'garmin', garminDomains: Object.keys(domains || {}),
        sleepHours: sleepMinutes === null ? null : +(sleepMinutes / 60).toFixed(2),
        sleepQuality: sleepScore === null ? null : Math.max(1, Math.min(10, +(sleepScore / 10).toFixed(1))),
        hrv: finite(hrv.lastNightAvgMs), restingHR: finite(heart.restingHr),
        spo2: finite(spo2.averagePct) ?? finite(spo2.latestPct),
        stress: averageStress === null ? null : Math.max(1, Math.min(10, +(averageStress / 10).toFixed(1))),
        bodyBattery: finite(battery.endLevel), bodyBatteryCharged: finite(battery.charged), bodyBatteryDrained: finite(battery.drained),
      };
    });
  }

  function mergeWellnessSources() {
    const manual = root.AppState.get('manualWellness') || [];
    const garmin = garminWellnessByDate(root.AppState.get('garminWellness'));
    const dates = new Set([...manual.map(row => row.date), ...garmin.map(row => row.date)].filter(Boolean));
    const merged = [...dates].map(date => {
      const auto = garmin.find(row => row.date === date) || {date};
      const entered = manual.find(row => row.date === date);
      if (!entered) return auto;
      const result = {...auto, ...entered, sources: auto.source === 'garmin' ? ['garmin', entered.source || 'manual'] : [entered.source || 'manual']};
      Object.entries(auto).forEach(([key, value]) => {
        if (entered[key] === null || entered[key] === '' || entered[key] === undefined) result[key] = value;
      });
      return result;
    }).sort((a,b) => (b.date || '').localeCompare(a.date || ''));
    root.AppState.set('wellness', merged);
  }

  async function appReady(user) {
    if (!user) {
      const overlay = document.getElementById('loading-overlay');
      if (overlay) overlay.style.display = 'none';
      root.showPage('today');
      root.renderTodayStats();
      root.renderIntegratedHealth();
      root.renderDashboardHomeInsights();
      root.renderDashboardSyncStatus();
      return;
    }

    root.hideLoading();
    root.showPage('today');
    try {
      const config = await root._fb.getData('settings') || {};
      if (config.deepseekKey) {
        root.AppState.set('deepseekKey', config.deepseekKey);
        const keyInput = document.getElementById('set-deepseek-key');
        if (keyInput) keyInput.value = config.deepseekKey;
        const status = document.getElementById('deepseek-key-status');
        if (status) status.innerHTML = '<span style="color:var(--green)">Ready</span>';
      }

      root.AppState.set('aiProxyUrl', config.aiProxyUrl || root.DEFAULT_AI_PROXY_URL);
      const setValue = (id, value) => {
        const element = document.getElementById(id);
        if (element && value) element.value = value;
      };
      setValue('set-ai-proxy-url', config.aiProxyUrl || root.DEFAULT_AI_PROXY_URL);
      setValue('set-strava-id', config.stravaId);
      setValue('set-strava-secret', config.stravaSecret);
      setValue('set-strava-redirect', config.stravaRedirect);
      setValue('set-gas-url', config.gasUrl || root.DEFAULT_GAS_URL);
      setValue('set-gas-token', config.gasToken);
      root.loadAthleteProfile(config.athleteProfile);
    } catch (error) {
      console.warn('Settings:', error.message);
    }

    try {
      startRealtimeListeners();
    } catch (error) {
      root.showToast(`Firebase: ${error.message}`, 'error');
    }
  }

  function registerUiSubscriptions() {
    const { AppState } = root;

    AppState.subscribe('workouts', () => {
      root.renderRecentWorkouts();
      root.renderTodayStats();
      root.renderIntegratedHealth();
      if (document.getElementById('page-fitness-stats')?.classList.contains('active')) root.renderCurrentStatsView();
      if (document.getElementById('page-post-run-review')?.classList.contains('active')) root.renderPostRunReview();
      root.matchWorkoutsToPlan(true);
    });

    AppState.subscribe('stravaWorkouts', () => {
      root.renderTodayStats();
      root.renderIntegratedHealth();
      if (document.getElementById('page-fitness-stats')?.classList.contains('active')) root.renderCurrentStatsView();
      root.matchWorkoutsToPlan(true);
    });

    AppState.subscribe('coachPlan', () => {
      if (document.getElementById('page-coach')?.classList.contains('active')) root.renderCoachTracking();
      if (document.getElementById('page-post-run-review')?.classList.contains('active')) root.renderPostRunReview();
    });

    AppState.subscribe('postRunReviews', () => {
      if (document.getElementById('page-post-run-review')?.classList.contains('active')) root.renderPostRunReview();
    });

    AppState.subscribe('wellness', () => {
      root.renderWellness();
      if (document.getElementById('page-post-run-review')?.classList.contains('active')) root.renderPostRunReview();
      root.renderIntegratedHealth();
      if (document.getElementById('page-today')?.classList.contains('active')) root.renderDashboardHomeInsights();
    });

    AppState.subscribe('deepseekKey', key => {
      if (key) console.info('[AppState] DeepSeek API key loaded');
    });
  }

  root.AppBootstrap = {
    appReady,
    startRealtimeListeners,
    registerUiSubscriptions,
    mergeWellnessSources,
  };
  root._appReady = appReady;
  registerUiSubscriptions();
})(window);
