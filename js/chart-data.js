(function(root){
  'use strict';
  const numeric=value=>Number.isFinite(Number(value))?Number(value):0;
  function averageHrZoneSessions(activities,zones){
    const counts=zones.map(()=>0);let coverage=0;
    (activities||[]).forEach(activity=>{const hr=numeric(activity.hr);if(!hr)return;const index=zones.findIndex(zone=>hr>=zone.min&&hr<=zone.max);if(index>=0){counts[index]+=1;coverage+=1;}});
    return {unit:'sessions by average HR',coverage,counts,emptyReason:coverage?'':'No activities with average HR in this period'};
  }
  function chartMeta({unit='',coverage=0,emptyReason=''}){return {unit,coverage,emptyReason,confidence:coverage>=8?'high':coverage>=3?'medium':'low'};}
  root.MyDashChartData={averageHrZoneSessions,chartMeta};
})(window);
