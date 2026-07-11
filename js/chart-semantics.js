(function(root){
  'use strict';
  const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
  root.renderPaceTrend=function(){
    const profile=typeof root.getAthleteProfile==='function'?root.getAthleteProfile():{};
    const easyMax=Number(profile.easyHRMax)||145;
    const activities=root.getAllActivities().filter(row=>{
      const purpose=String(row.purpose||'').toLowerCase();
      const isEasy=purpose==='easy'||purpose==='recovery'||(!purpose&&row.type!=='interval'&&Number(row.hr)>0&&Number(row.hr)<=easyMax);
      return isEasy&&Number(row.avgPace)>0&&Number(row.hr)>0&&Number(row.dist)>=3&&Number(row.time)>=20;
    });
    const weeks=Array.from({length:8},(_,index)=>{
      const days=root.getWeekDates(index-7),start=root.toLocalDateStr(days[0]),end=root.toLocalDateStr(days[6]);
      const samples=activities.filter(row=>row.date>=start&&row.date<=end);
      const values=samples.map(row=>1000/(Number(row.avgPace)*Number(row.hr))).filter(Number.isFinite);
      return {label:days[0].toLocaleDateString('en-GB',{day:'numeric',month:'short'}),value:mean(values),count:samples.length};
    });
    const data=weeks.map(week=>week.value===null?null:+week.value.toFixed(3));
    const badge=document.getElementById('pace-trend-badge');
    const chartCard=document.getElementById('chart-pace-trend')?.closest('.card');
    const chartLabel=chartCard?.querySelector('.card-label');
    if(chartLabel)chartLabel.textContent='Aerobic Efficiency (8 weeks)';
    const valid=data.filter(value=>value!==null);
    if(badge){
      if(valid.length<3){badge.textContent=`Need easy HR data (${valid.length}/3)`;badge.style.color='var(--text3)';}
      else{const half=Math.floor(valid.length/2),delta=mean(valid.slice(-half))-mean(valid.slice(0,half));badge.textContent=`${delta>.01?'Improving':'Stable'} · ${valid.length} runs`;badge.style.color=delta>.01?'var(--green)':'var(--text2)';}
    }
    const context=document.getElementById('chart-pace-trend')?.getContext('2d');if(!context)return;
    Chart.getChart(context)?.destroy();
    const colors=root.getChartColors();
    new Chart(context, {
      type: 'line',
      data: { labels: weeks.map(week => week.label), datasets: [{ label: 'Easy pace / HR efficiency', data, borderColor: '#B8FF5A', backgroundColor: 'rgba(184,245,90,.12)', fill: true, tension: .3, spanGaps: false, pointRadius: data.map(value => value === null ? 0 : 4) }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: item => item.parsed.y ? `Efficiency ${item.parsed.y.toFixed(3)} · ${weeks[item.dataIndex].count} qualifying runs` : 'No qualifying easy run' } } },
        scales: { x: { grid: { display: false }, ticks: { color: colors.tick, font: { size: 9 } } }, y: { grid: { color: colors.grid }, ticks: { color: colors.tick, font: { size: 9 } } } }
      }
    });
  };
})(window);
