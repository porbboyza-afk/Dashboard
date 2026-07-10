(function(root){
  'use strict';

  const METHODOLOGY_VERSION = 'mydash-running-2026.07.10';

  const PROFILES = {
    Base: {
      key:'Base', label:'Base Building', race:false, distanceKm:null,
      defaultWeeks:8, defaultWeeklyKm:{beginner:12,intermediate:24,advanced:40},
      minLongKm:5, maxLongKm:{beginner:10,intermediate:14,advanced:18}, longRatio:.32,
      thresholdWorkKm:{min:2.5,max:5}, specificWorkKm:{min:3,max:5},
      buildIntervals:[
        {intent:'hill_strength',reps:8,repSeconds:30,recoverySeconds:90,intensity:'hill_controlled'},
        {intent:'speed_skill',reps:8,repSeconds:20,recoverySeconds:70,intensity:'strides'}
      ],
      specificIntervals:[]
    },
    '5K': {
      key:'5K', label:'5K', race:true, distanceKm:5,
      defaultWeeks:8, defaultWeeklyKm:{beginner:15,intermediate:28,advanced:45},
      minLongKm:6, maxLongKm:{beginner:11,intermediate:15,advanced:19}, longRatio:.30,
      thresholdWorkKm:{min:3,max:5}, specificWorkKm:{min:3.2,max:5},
      buildIntervals:[
        {intent:'vo2',reps:8,repKm:.4,recoverySeconds:90,intensity:'current_5k'},
        {intent:'vo2',reps:6,repKm:.6,recoverySeconds:105,intensity:'current_5k'},
        {intent:'vo2',reps:5,repKm:.8,recoverySeconds:120,intensity:'current_5k'}
      ],
      specificIntervals:[
        {intent:'race_specific',reps:5,repKm:.8,recoverySeconds:120,intensity:'current_5k'},
        {intent:'race_specific',reps:4,repKm:1,recoverySeconds:150,intensity:'current_5k'},
        {intent:'race_specific',reps:5,repKm:1,recoverySeconds:150,intensity:'current_5k'}
      ]
    },
    '10K': {
      key:'10K', label:'10K', race:true, distanceKm:10,
      defaultWeeks:10, defaultWeeklyKm:{beginner:18,intermediate:32,advanced:52},
      minLongKm:7, maxLongKm:{beginner:13,intermediate:18,advanced:23}, longRatio:.32,
      thresholdWorkKm:{min:3,max:6}, specificWorkKm:{min:4,max:6},
      buildIntervals:[
        {intent:'vo2',reps:6,repKm:.4,recoverySeconds:90,intensity:'current_5k'},
        {intent:'vo2',reps:5,repKm:.8,recoverySeconds:120,intensity:'current_5k'},
        {intent:'race_specific',reps:5,repKm:1,recoverySeconds:90,intensity:'current_10k'}
      ],
      specificIntervals:[
        {intent:'race_specific',reps:5,repKm:1,recoverySeconds:90,intensity:'current_10k'},
        {intent:'race_specific',reps:3,repKm:1.6,recoverySeconds:150,intensity:'current_10k'},
        {intent:'race_specific',reps:3,repKm:2,recoverySeconds:180,intensity:'current_10k'}
      ]
    },
    Half: {
      key:'Half', label:'Half Marathon', race:true, distanceKm:21.0975,
      defaultWeeks:12, defaultWeeklyKm:{beginner:24,intermediate:40,advanced:65},
      minLongKm:9, maxLongKm:{beginner:18,intermediate:23,advanced:28}, longRatio:.35,
      thresholdWorkKm:{min:4,max:8}, specificWorkKm:{min:6,max:10},
      buildIntervals:[
        {intent:'vo2',reps:5,repKm:.8,recoverySeconds:120,intensity:'current_10k'},
        {intent:'threshold',reps:4,repKm:1,recoverySeconds:90,intensity:'threshold'},
        {intent:'threshold',reps:3,repKm:2,recoverySeconds:120,intensity:'threshold'}
      ],
      specificIntervals:[
        {intent:'race_specific',reps:3,repKm:2,recoverySeconds:120,intensity:'current_half'},
        {intent:'race_specific',reps:3,repKm:3,recoverySeconds:180,intensity:'current_half'},
        {intent:'race_specific',reps:2,repKm:5,recoverySeconds:240,intensity:'current_half'}
      ]
    },
    Marathon: {
      key:'Marathon', label:'Marathon', race:true, distanceKm:42.195,
      defaultWeeks:16, defaultWeeklyKm:{beginner:30,intermediate:48,advanced:75},
      minLongKm:12, maxLongKm:{beginner:26,intermediate:32,advanced:35}, longRatio:.38,
      thresholdWorkKm:{min:4,max:8}, specificWorkKm:{min:6,max:14},
      buildIntervals:[
        {intent:'threshold',reps:5,repKm:1,recoverySeconds:90,intensity:'threshold'},
        {intent:'threshold',reps:3,repKm:2,recoverySeconds:120,intensity:'threshold'},
        {intent:'threshold',reps:2,repKm:3,recoverySeconds:150,intensity:'threshold'}
      ],
      specificIntervals:[
        {intent:'race_specific',reps:3,repKm:3,recoverySeconds:180,intensity:'current_marathon'},
        {intent:'race_specific',reps:2,repKm:5,recoverySeconds:240,intensity:'current_marathon'},
        {intent:'race_specific',reps:1,repKm:12,recoverySeconds:0,intensity:'current_marathon'}
      ]
    }
  };

  function normalizeProfileKey(value){
    const raw=String(value||'10K').trim().toLowerCase().replace(/\s+/g,'');
    if(['base','basebuilding','general','generalfitness'].includes(raw))return 'Base';
    if(['5k','5km'].includes(raw))return '5K';
    if(['half','halfmarathon','hm','21k','21.1k'].includes(raw))return 'Half';
    if(['marathon','42k','42.2k'].includes(raw))return 'Marathon';
    return '10K';
  }

  function getProfile(value){
    return PROFILES[normalizeProfileKey(value)];
  }

  root.MyDashTraining=Object.assign(root.MyDashTraining||{}, {
    METHODOLOGY_VERSION,
    PROFILES,
    normalizeProfileKey,
    getProfile
  });
})(window);
