import {escape as e, number, clock, dateLabel, activityUrl, sourceLabel} from './format.mjs';
import {icon} from './icons.mjs';

export function pageHeading(eyebrow, title, description='', action='') {
  return `<div class="page-heading"><div><p class="eyebrow">${e(eyebrow)}</p><h1>${e(title)}</h1>${description ? `<p class="muted">${e(description)}</p>` : ''}</div>${action}</div>`;
}

export function empty(title, description, action='') {
  return `<div class="empty"><span class="empty-icon">${icon('route')}</span><h3>${e(title)}</h3><p class="muted">${e(description)}</p>${action}</div>`;
}

export function activityRow(activity) {
  return `<a class="activity-row" href="${activityUrl(activity)}"><span class="activity-icon">${icon('shoe')}</span><span class="activity-name"><strong>${e(activity.name)}</strong><small>${dateLabel(activity.date)} <span class="source">${e(sourceLabel(activity.source))}</span></small></span><span class="activity-stat"><strong>${number(activity.distanceKm,2)} <small>km</small></strong><small>${clock(activity.distanceKm && activity.durationMin ? activity.durationMin/activity.distanceKm : null)} /km</small></span>${icon('arrow','chevron')}</a>`;
}

export function metric(iconName, title, value, unit='', href='', caption='') {
  const tag = href ? 'a' : 'div';
  return `<${tag} class="metric" ${href ? `href="${href}"` : ''}>${icon(iconName)}<span>${e(title)}</span><strong>${e(value)} <small>${e(unit)}</small></strong>${caption ? `<small class="muted">${e(caption)}</small>` : ''}</${tag}>`;
}

export function splitChart(laps) {
  const rows = laps.filter(lap => lap.pace && lap.distanceKm);
  if (rows.length < 2) return '';
  if (rows.some((lap,index)=>Number(lap.index)!==index+1)) return '';
  const total = rows.reduce((sum,row)=>sum+row.distanceKm,0);
  const values=rows.map(row=>row.pace), min=Math.min(...values)-.3, max=Math.max(...values)+.3;
  let distance=0;
  const points=rows.map(row=>{
    distance+=row.distanceKm;
    return `${48+distance/total*520},${18+(row.pace-min)/(max-min)*116}`;
  });
  const first=points[0].split(',');
  return `<svg class="pace-chart" viewBox="0 0 600 172" role="img" aria-label="เพซเฉลี่ยแต่ละช่วงจากข้อมูลกิจกรรม"><defs><linearGradient id="pace-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f47736" stop-opacity=".24"/><stop offset="1" stop-color="#f47736" stop-opacity="0"/></linearGradient></defs>${[0,.5,1].map(t=>`<line x1="48" x2="574" y1="${18+t*116}" y2="${18+t*116}" stroke="#dedfd9"/><text x="0" y="${22+t*116}" fill="#54605c" font-size="11">${clock(min+t*(max-min))}</text>`).join('')}<path d="M${first[0]},144 L${points.join(' L')} L${points.at(-1).split(',')[0]},144 Z" fill="url(#pace-fill)"/><polyline points="${points.join(' ')}" fill="none" stroke="#f06b2b" stroke-width="3" stroke-linejoin="round"/>${points.map(p=>`<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="3" fill="#f06b2b"/>`).join('')}<text x="48" y="165" fill="#54605c" font-size="11">0 km</text><text x="544" y="165" fill="#54605c" font-size="11">${number(total,2)} km</text></svg><p class="chart-caption">เพซเฉลี่ยรายช่วง • กราฟนี้ไม่ใช่เพซทุกวินาที</p>`;
}

export function splitTable(activity) {
  if (!activity.laps.length) return empty('ไม่มีข้อมูลรอบวิ่ง','แหล่งข้อมูลนี้ส่งมาเฉพาะรายละเอียดสรุปกิจกรรม');
  return `<p class="muted">${activity.lapKind==='kilometer-splits' ? 'ช่วงระยะทางจาก COROS รวมช่วงท้ายที่ไม่เต็มกิโลเมตร' : activity.lapKind==='manual-splits'?'รอบที่กรอกเอง • เวลาแต่ละช่วงคำนวณจากเพซและระยะ':'รอบที่แหล่งข้อมูลบันทึกไว้'}</p><div class="table-scroll"><table><thead><tr><th>ช่วง</th><th>ระยะ km</th><th>เวลา</th><th>เพซ /km</th><th>HR</th><th>Cadence</th></tr></thead><tbody>${activity.laps.map(lap=>`<tr><td>${e(lap.index)}</td><td>${number(lap.distanceKm,2)}</td><td>${clock(lap.durationMin)}</td><td>${clock(lap.pace)}</td><td>${number(lap.averageHr,0)}</td><td>${number(lap.cadence,0)}</td></tr>`).join('')}</tbody></table></div>`;
}
