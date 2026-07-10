(function(root){
  'use strict';

  const DEFAULT_AI_PROXY_URL = 'https://mydash-ai-proxy.porbboyza.workers.dev';

  const AppState = (() => {
    const data = {
      workouts: [],
      stravaWorkouts: [],
      stravaActs: [],
      coachPlan: null,
      postRunReviews: [],
      wellness: [],

      deepseekKey: '',
      aiProxyUrl: DEFAULT_AI_PROXY_URL,
      appReady: false,
    };
    const listeners = {};
    const pending = {};

    return {
      get(key) {
        return data[key];
      },

      set(key, value) {
        data[key] = value;
        if (listeners[key]) {
          listeners[key].forEach(cb => {
            try {
              cb(value);
            } catch (error) {
              console.warn(`AppState[${key}] subscriber error:`, error);
            }
          });
        }
      },

      subscribe(key, cb) {
        if (!listeners[key]) listeners[key] = [];
        listeners[key].push(cb);
        return () => {
          listeners[key] = listeners[key].filter(fn => fn !== cb);
        };
      },

      isPending(key) {
        return !!pending[key];
      },

      setPending(key, val) {
        pending[key] = val;
      },

      debug() {
        console.table(Object.fromEntries(Object.entries(data).map(([key, value]) => [
          key,
          Array.isArray(value) ? `Array(${value.length})` : value
        ])));
      }
    };
  })();

  root.DEFAULT_AI_PROXY_URL = DEFAULT_AI_PROXY_URL;
  root.AppState = AppState;

  Object.defineProperties(root, {
    _workouts: { get: () => AppState.get('workouts'), set: value => AppState.set('workouts', value), configurable: true },
    _stravaWorkouts: { get: () => AppState.get('stravaWorkouts'), set: value => AppState.set('stravaWorkouts', value), configurable: true },
    _stravaActs: { get: () => AppState.get('stravaActs'), set: value => AppState.set('stravaActs', value), configurable: true },
    _coachPlan: { get: () => AppState.get('coachPlan'), set: value => AppState.set('coachPlan', value), configurable: true },
    _postRunReviews: { get: () => AppState.get('postRunReviews'), set: value => AppState.set('postRunReviews', value), configurable: true },
    _wellness: { get: () => AppState.get('wellness'), set: value => AppState.set('wellness', value), configurable: true },

    _deepseekKey: { get: () => AppState.get('deepseekKey'), set: value => AppState.set('deepseekKey', value), configurable: true },
    _aiProxyUrl: { get: () => AppState.get('aiProxyUrl'), set: value => AppState.set('aiProxyUrl', value), configurable: true },
    _appReady: { get: () => AppState.get('appReady'), set: value => AppState.set('appReady', value), configurable: true },
  });
})(window);
