// Share stats card logic extracted from index.html.
let _sharePeriod = 'month';
let _shareStyle  = 'dark';

const SHARE_STYLES = {
  dark:   { bg: ['#0a0a0a','#1a1a2e'], accent: '#007AFF', text: '#ffffff', sub: 'rgba(255,255,255,.55)', card: 'rgba(255,255,255,.07)', strava: '#FC4C02' },
  light:  { bg: ['#f0f4ff','#e8edf5'], accent: '#007AFF', text: '#1c1c1e', sub: 'rgba(0,0,0,.45)',       card: 'rgba(0,0,0,.06)',         strava: '#FC4C02' },
  strava: { bg: ['#1a0a00','#2d1200'], accent: '#FC4C02', text: '#ffffff', sub: 'rgba(255,255,255,.55)', card: 'rgba(252,76,2,.12)',       strava: '#FC4C02' },
};

function showShareStatsModal() {
  document.getElementById('share-stats-overlay').style.display = 'block';
  document.body.style.overflow = 'hidden';
  // Hide native share if not supported
  if (!navigator.share) document.getElementById('btn-share-native').style.display = 'none';
  setTimeout(() => renderShareCanvas(), 100);
}
function closeShareStats() {
  document.getElementById('share-stats-overlay').style.display = 'none';
  document.body.style.overflow = '';
}
function selectSharePeriod(p, el) {
  _sharePeriod = p;
  document.querySelectorAll('.share-period-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderShareCanvas();
}
function selectShareStyle(s, el) {
  _shareStyle = s;
  document.querySelectorAll('.share-style-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderShareCanvas();
}

function getShareData() {
  const all = getAllActivities();
  const now = new Date();
  let filtered, label;

  if (_sharePeriod === 'month') {
    const y = now.getFullYear(), m = now.getMonth();
    filtered = all.filter(w => { const d = new Date(w.date+'T00:00:00'); return d.getFullYear()===y && d.getMonth()===m; });
    label = now.toLocaleDateString('th-TH', {month:'long', year:'numeric'});
  } else if (_sharePeriod === 'last3') {
    const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth()-3);
    filtered = all.filter(w => new Date(w.date+'T00:00:00') >= cutoff);
    label = '3 เดือนที่ผ่านมา';
  } else if (_sharePeriod === 'year') {
    filtered = all.filter(w => new Date(w.date+'T00:00:00').getFullYear() === now.getFullYear());
    label = 'ปี ' + (now.getFullYear()+543);
  } else {
    filtered = all;
    label = 'ทั้งหมด';
  }

  const runs = filtered.filter(w => w.type === 'run' || w.type === 'Run');
  const totalDist = filtered.reduce((s,w) => s+parseFloat(w.dist||0), 0);
  const totalTime = filtered.reduce((s,w) => s+parseFloat(w.time||0), 0);
  const avgHR = runs.filter(w=>w.hr>0).length ? Math.round(runs.filter(w=>w.hr>0).reduce((s,w)=>s+w.hr,0)/runs.filter(w=>w.hr>0).length) : 0;
  const paces = runs.filter(w=>w.avgPace>0).map(w=>w.avgPace);
  const avgPace = paces.length ? paces.reduce((a,b)=>a+b,0)/paces.length : 0;
  const longest = Math.max(0, ...filtered.map(w=>parseFloat(w.dist||0)));

  // Monthly bar chart data (last 6 months)
  const months = [];
  for (let i=5; i>=0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const y2 = d.getFullYear(), m2 = d.getMonth();
    const dist = all.filter(w=>{ const wd=new Date(w.date+'T00:00:00'); return wd.getFullYear()===y2&&wd.getMonth()===m2; }).reduce((s,w)=>s+parseFloat(w.dist||0),0);
    months.push({ label: d.toLocaleDateString('th-TH',{month:'short'}), dist: parseFloat(dist.toFixed(2)) });
  }

  return { label, totalDist: totalDist.toFixed(2), totalTime: Math.round(totalTime), activities: filtered.length, avgHR, avgPace, longest: longest.toFixed(2), months };
}

function renderShareCanvas() {
  const canvas = document.getElementById('share-canvas');
  const W = 1080, H = 1080;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const st = SHARE_STYLES[_shareStyle];
  const data = getShareData();

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, st.bg[0]);
  grad.addColorStop(1, st.bg[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255,255,255,.03)';
  ctx.lineWidth = 1;
  for (let x=0; x<W; x+=60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y=0; y<H; y+=60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Top accent bar
  const barGrad = ctx.createLinearGradient(0,0,W,0);
  barGrad.addColorStop(0, st.accent);
  barGrad.addColorStop(1, st.strava);
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, W, 8);

  // Header — show period label big, no "MyDash"
  ctx.fillStyle = st.text;
  ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';
  ctx.fillText(data.label, 80, 110);
  ctx.fillStyle = st.strava;
  ctx.font = 'bold 32px system-ui';
  ctx.fillText('● Strava', 80, 158);

  // ── Big stats row ──
  const statsY = 220;
  const stats = [
    { val: data.totalDist, unit: 'km', label: 'ระยะทางรวม', color: st.accent },
    { val: data.activities, unit: 'ครั้ง', label: 'กิจกรรม', color: st.strava },
    { val: data.longest, unit: 'km', label: 'ไกลสุด', color: '#30D158' },
    { val: data.avgHR||'—', unit: data.avgHR?'bpm':'', label: 'HR เฉลี่ย', color: '#FF453A' },
  ];

  stats.forEach((s, i) => {
    const x = 80 + i * 240;
    // Card bg
    roundRect(ctx, x-20, statsY-20, 210, 210, 20);
    ctx.fillStyle = st.card;
    ctx.fill();
    // Value
    ctx.fillStyle = s.color;
    ctx.font = `bold ${String(s.val).length > 4 ? 64 : 72}px 'SF Mono', monospace, system-ui`;
    ctx.fillText(s.val, x, statsY+90);
    // Unit
    ctx.fillStyle = st.sub;
    ctx.font = '500 28px system-ui';
    ctx.fillText(s.unit, x, statsY+130);
    // Label
    ctx.fillStyle = st.sub;
    ctx.font = '400 26px system-ui';
    ctx.fillText(s.label, x, statsY+175);
  });

  // ── Monthly bar chart ──
  const chartX = 80, chartY = 530, chartW = W-160, chartH = 300;
  ctx.fillStyle = st.card;
  roundRect(ctx, chartX-20, chartY-40, chartW+40, chartH+80, 24);
  ctx.fill();

  ctx.fillStyle = st.text;
  ctx.font = 'bold 32px system-ui';
  ctx.fillText('📈 ระยะทาง 6 เดือน', chartX, chartY-4);

  const maxDist = Math.max(...data.months.map(m=>m.dist), 1);
  const barW = (chartW - 60) / data.months.length - 16;

  data.months.forEach((m, i) => {
    const bx = chartX + i*(barW+16);
    const bh = (m.dist/maxDist) * (chartH-60);
    const by = chartY + chartH - bh - 8;
    const isLast = i === data.months.length-1;

    // Bar
    const bGrad = ctx.createLinearGradient(0, by, 0, by+bh);
    bGrad.addColorStop(0, isLast ? st.accent : st.strava);
    bGrad.addColorStop(1, isLast ? st.accent+'88' : st.strava+'44');
    roundRect(ctx, bx, by, barW, bh, 8);
    ctx.fillStyle = bGrad;
    ctx.fill();

    // km label on bar
    if (m.dist > 0) {
      ctx.fillStyle = isLast ? '#fff' : st.sub;
      ctx.font = `bold ${barW > 80 ? 22 : 18}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(m.dist, bx+barW/2, by-10);
    }
    // Month label
    ctx.fillStyle = isLast ? st.text : st.sub;
    ctx.font = `${isLast?'bold ':''  }26px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText(m.label, bx+barW/2, chartY+chartH+32);
    ctx.textAlign = 'left';
  });

  // Accent bottom bar
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, H-8, W, 8);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

function downloadShareCard() {
  const canvas = document.getElementById('share-canvas');
  const a = document.createElement('a');
  a.download = `mydash-stats-${_sharePeriod}-${Date.now()}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
  showToast('✅ บันทึกรูปแล้ว!');
}

async function shareCard() {
  const canvas = document.getElementById('share-canvas');
  canvas.toBlob(async blob => {
    try {
      await navigator.share({ files: [new File([blob], 'mydash-stats.png', {type:'image/png'})], title: 'MyDash Stats' });
    } catch(e) { downloadShareCard(); }
  }, 'image/png');
}


