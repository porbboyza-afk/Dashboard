(function(root){
  'use strict';

  const METHODOLOGY_VERSION = 'mydash-running-2026.07.19.3';

  // Daniels, Running Formula 4e: reference ceilings for individual quality
  // sessions. The engine records these, but prescribes T/I work with a
  // goal-specific time-at-intensity ladder rather than truncating every
  // workout solely from a weekly-distance percentage.
  const DANIELS_QUALITY_CAPS = {
    R:{label:'Repetition',percentOfWeekly:.05,maxKm:8},
    I:{label:'Interval',percentOfWeekly:.08,maxKm:10},
    T:{label:'Threshold',percentOfWeekly:.10,maxKm:null}
  };
  const DANIELS_RACE_RECOVERY = {easyDaysPer3Km:1};

  const PROFILES = {
    Base: {
      key:'Base', label:'Base Building', race:false, distanceKm:null,
      defaultWeeks:8, defaultWeeklyKm:{beginner:12,intermediate:24,advanced:40},
      minLongKm:5, maxLongKm:{beginner:9,intermediate:12,advanced:15}, longRatio:.32, maxLongRatio:.50,
      longRunTargets:{Base:{beginner:7,intermediate:9,advanced:11},Build:{beginner:8,intermediate:10,advanced:13},Specific:{beginner:9,intermediate:12,advanced:15}},
      qualityBudgetKm:{Base:0,Build:5,Specific:4,Taper:2}, continuousTempoRatio:.75,
      thresholdWorkKm:{min:2.5,max:5}, specificWorkKm:{min:3,max:5},
      buildIntervals:[
        {intent:'hill_strength',reps:8,repSeconds:30,recoverySeconds:90,intensity:'hill_controlled'},
        {intent:'speed_skill',reps:8,repSeconds:20,recoverySeconds:70,intensity:'strides'}
      ],
      specificIntervals:[],
      daniels:{qualityCaps:DANIELS_QUALITY_CAPS,qualityEmphasis:['easy_aerobic','strides_or_hills']}
    },
    '5K': {
      key:'5K', label:'5K', race:true, distanceKm:5,
      defaultWeeks:8, defaultWeeklyKm:{beginner:15,intermediate:28,advanced:45},
      minLongKm:6, maxLongKm:{beginner:8,intermediate:11,advanced:13}, longRatio:.36, maxLongRatio:.50,
      longRunTargets:{Base:{beginner:7,intermediate:9,advanced:10},Build:{beginner:8,intermediate:10,advanced:12},Specific:{beginner:8,intermediate:11,advanced:13}},
      qualityBudgetKm:{Base:0,Build:4,Specific:5,Taper:2.5}, continuousTempoRatio:.60,
      qualityWorkMinutes:{I:{Build:{beginner:10,intermediate:16,advanced:20},Specific:{beginner:12,intermediate:20,advanced:24},Taper:{beginner:8,intermediate:10,advanced:12}},T:{Build:{beginner:16,intermediate:20,advanced:24},Specific:{beginner:18,intermediate:25,advanced:30},Taper:{beginner:10,intermediate:12,advanced:15}}},
      thresholdWorkKm:{min:3,max:5}, specificWorkKm:{min:3.2,max:5},
      thresholdIntervals:[
        {intent:'threshold',reps:3,repKm:1,recoverySeconds:75,intensity:'threshold'},
        {intent:'threshold',reps:4,repKm:1,recoverySeconds:75,intensity:'threshold'}
      ],
      buildIntervals:[
        {intent:'vo2',reps:8,repKm:.4,recoverySeconds:90,intensity:'interval'},
        {intent:'vo2',reps:6,repKm:.6,recoverySeconds:105,intensity:'interval'},
        {intent:'vo2',reps:5,repKm:.8,recoverySeconds:120,intensity:'interval'}
      ],
      repetitionIntervals:[
        {intent:'repetition',reps:6,repKm:.2,recoverySeconds:100,intensity:'repetition'},
        {intent:'repetition',reps:4,repKm:.3,recoverySeconds:120,intensity:'repetition'}
      ],
      specificIntervals:[
        {intent:'race_specific',reps:5,repKm:.8,recoverySeconds:120,intensity:'current_5k'},
        {intent:'race_specific',reps:4,repKm:1,recoverySeconds:105,sets:2,repsPerSet:2,setRecoverySeconds:180,intensity:'current_5k'},
        {intent:'race_specific',reps:5,repKm:1,recoverySeconds:150,intensity:'current_5k'}
      ],
      daniels:{qualityCaps:DANIELS_QUALITY_CAPS,raceRecovery:DANIELS_RACE_RECOVERY,phaseRoles:{Base:'easy_plus_strides',Build:'repetition_first',Specific:['interval_primary','threshold_emphasis']},baseLongRunMaxWeeklyRatio:.25}
    },
    '10K': {
      key:'10K', label:'10K', race:true, distanceKm:10,
      defaultWeeks:10, defaultWeeklyKm:{beginner:18,intermediate:32,advanced:52},
      minLongKm:7, maxLongKm:{beginner:10,intermediate:14,advanced:16}, longRatio:.38, maxLongRatio:.52,
      longRunTargets:{Base:{beginner:8,intermediate:12,advanced:14},Build:{beginner:9,intermediate:13,advanced:15},Specific:{beginner:10,intermediate:14,advanced:16}},
      qualityBudgetKm:{Base:0,Build:5,Specific:8,Taper:3}, continuousTempoRatio:.60,
      qualityWorkMinutes:{I:{Build:{beginner:10,intermediate:18,advanced:22},Specific:{beginner:14,intermediate:22,advanced:26},Taper:{beginner:8,intermediate:10,advanced:12}},T:{Build:{beginner:18,intermediate:28,advanced:32},Specific:{beginner:28,intermediate:40,advanced:45},Taper:{beginner:10,intermediate:12,advanced:15}}},
      thresholdWorkKm:{min:3,max:8}, specificWorkKm:{min:4,max:8},
      thresholdIntervals:[
        {intent:'threshold',reps:3,repKm:1.5,recoverySeconds:90,intensity:'threshold'},
        {intent:'threshold',reps:3,repKm:2,recoverySeconds:120,intensity:'threshold'}
      ],
      buildIntervals:[
        {intent:'vo2',reps:6,repKm:.4,recoverySeconds:90,intensity:'interval'},
        {intent:'vo2',reps:5,repKm:.8,recoverySeconds:120,intensity:'interval'},
        {intent:'race_specific',reps:4,repKm:1,recoverySeconds:105,intensity:'current_10k'}
      ],
      repetitionIntervals:[
        {intent:'repetition',reps:8,repKm:.2,recoverySeconds:100,intensity:'repetition'},
        {intent:'repetition',reps:4,repKm:.4,recoverySeconds:120,intensity:'repetition'}
      ],
      specificIntervals:[
        {intent:'race_specific',reps:5,repKm:1,recoverySeconds:105,intensity:'current_10k'},
        {intent:'race_specific',reps:6,repKm:1,recoverySeconds:105,sets:2,repsPerSet:3,setRecoverySeconds:180,intensity:'current_10k'},
        {intent:'race_specific',reps:5,repKm:1.2,recoverySeconds:150,intensity:'current_10k'}
      ],
      daniels:{qualityCaps:DANIELS_QUALITY_CAPS,raceRecovery:DANIELS_RACE_RECOVERY,phaseRoles:{Base:'easy_plus_strides',Build:'repetition_first',Specific:['interval_primary','threshold_emphasis']},baseLongRunMaxWeeklyRatio:.25}
    },
    Half: {
      key:'Half', label:'Half Marathon', race:true, distanceKm:21.0975,
      defaultWeeks:12, defaultWeeklyKm:{beginner:24,intermediate:40,advanced:65},
      minLongKm:9, maxLongKm:{beginner:16,intermediate:20,advanced:23}, longRatio:.40, maxLongRatio:.52,
      longRunTargets:{Base:{beginner:12,intermediate:15,advanced:17},Build:{beginner:14,intermediate:18,advanced:20},Specific:{beginner:16,intermediate:20,advanced:23}},
      qualityBudgetKm:{Base:0,Build:6,Specific:10,Taper:4}, continuousTempoRatio:.65,
      qualityWorkMinutes:{I:{Build:{beginner:10,intermediate:16,advanced:20},Specific:{beginner:12,intermediate:18,advanced:22},Taper:{beginner:8,intermediate:10,advanced:12}},T:{Build:{beginner:18,intermediate:26,advanced:32},Specific:{beginner:22,intermediate:35,advanced:40},Taper:{beginner:10,intermediate:14,advanced:16}}},
      thresholdWorkKm:{min:4,max:8}, specificWorkKm:{min:6,max:10},
      thresholdIntervals:[
        {intent:'threshold',reps:3,repKm:2,recoverySeconds:120,intensity:'threshold'},
        {intent:'threshold',reps:4,repKm:2,recoverySeconds:120,intensity:'threshold'}
      ],
      buildIntervals:[
        {intent:'vo2',reps:5,repKm:.8,recoverySeconds:120,intensity:'interval'},
        {intent:'threshold',reps:4,repKm:1,recoverySeconds:90,intensity:'threshold'},
        {intent:'threshold',reps:3,repKm:2,recoverySeconds:120,intensity:'threshold'}
      ],
      specificIntervals:[
        {intent:'race_specific',reps:3,repKm:2,recoverySeconds:120,intensity:'current_half'},
        {intent:'race_specific',reps:3,repKm:3,recoverySeconds:180,intensity:'current_half'},
        {intent:'race_specific',reps:2,repKm:5,recoverySeconds:240,intensity:'current_half'}
      ],
      daniels:{
        qualityCaps:DANIELS_QUALITY_CAPS,
        raceRecovery:DANIELS_RACE_RECOVERY,
        qualityEmphasis:['long_endurance','threshold','repetition_or_interval'],
        taper:{longRunFraction:.67,thresholdWorkout:'3 x 1 km T / 2 min recovery',daysBeforeRace:3}
      }
    },
    Marathon: {
      key:'Marathon', label:'Marathon', race:true, distanceKm:42.195,
      defaultWeeks:16, defaultWeeklyKm:{beginner:30,intermediate:48,advanced:75},
      minLongKm:12, maxLongKm:{beginner:26,intermediate:32,advanced:32}, longRatio:.42, maxLongRatio:.55,
      longRunTargets:{Base:{beginner:18,intermediate:22,advanced:24},Build:{beginner:22,intermediate:28,advanced:30},Specific:{beginner:26,intermediate:32,advanced:32}},
      qualityBudgetKm:{Base:0,Build:6,Specific:12,Taper:5}, continuousTempoRatio:.70,
      qualityWorkMinutes:{T:{Build:{beginner:18,intermediate:28,advanced:34},Specific:{beginner:22,intermediate:35,advanced:40},Taper:{beginner:10,intermediate:14,advanced:16}}},
      thresholdWorkKm:{min:4,max:8}, specificWorkKm:{min:6,max:14},
      thresholdIntervals:[
        {intent:'threshold',reps:3,repKm:2,recoverySeconds:120,intensity:'threshold'},
        {intent:'threshold',reps:2,repKm:3,recoverySeconds:150,intensity:'threshold'}
      ],
      buildIntervals:[
        {intent:'threshold',reps:5,repKm:1,recoverySeconds:90,intensity:'threshold'},
        {intent:'threshold',reps:3,repKm:2,recoverySeconds:120,intensity:'threshold'},
        {intent:'threshold',reps:2,repKm:3,recoverySeconds:150,intensity:'threshold'}
      ],
      specificIntervals:[
        {intent:'race_specific',reps:3,repKm:3,recoverySeconds:180,intensity:'current_marathon'},
        {intent:'race_specific',reps:2,repKm:5,recoverySeconds:240,intensity:'current_marathon'},
        {intent:'race_specific',reps:1,repKm:12,recoverySeconds:0,intensity:'current_marathon'}
      ],
      daniels:{qualityCaps:DANIELS_QUALITY_CAPS,raceRecovery:DANIELS_RACE_RECOVERY,qualityEmphasis:['threshold','marathon_specific']}
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
    DANIELS_QUALITY_CAPS,
    DANIELS_RACE_RECOVERY,
    PROFILES,
    normalizeProfileKey,
    getProfile
  });
})(window);
