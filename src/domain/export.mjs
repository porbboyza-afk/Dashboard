const cell = value => {
  let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+@\-\t\r]/.test(text)) text="'"+text;
  return `"${text.replaceAll('"','""')}"`;
};

export function healthExport(rows, format='csv', exportedAt=new Date().toISOString()) {
  const ordered=[...rows].sort((a,b)=>a.date.localeCompare(b.date));
  if (format==='json') return {content:JSON.stringify({exportedAt,version:'MyDash Health Intelligence V4',wellness:ordered},null,2),mime:'application/json',extension:'json'};
  const first=['date','sleepHours','restingHR','hrv','spo2','sources'];
  const fields=[...first,...new Set(ordered.flatMap(Object.keys).filter(key=>!first.includes(key)&&key!=='key'))];
  return {content:'\uFEFF'+[fields,...ordered.map(row=>fields.map(key=>row[key]))].map(row=>row.map(cell).join(',')).join('\r\n'),mime:'text/csv;charset=utf-8',extension:'csv'};
}

export function compareHealthBackup(text, current) {
  const comparable=value=>JSON.stringify(value === '' || value == null ? null : value);
  const payload=JSON.parse(text);
  if (!Array.isArray(payload.wellness)) throw new Error('ไฟล์ต้องเป็น MyDash JSON ที่มีข้อมูล wellness');
  const live=new Map(current.map(row=>[row.date,row]));
  return payload.wellness.map(row=>{
    if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error('พบวันที่สุขภาพไม่ถูกต้องในไฟล์');
    const match=live.get(row.date);
    const changes=Object.keys(row).filter(key=>!['date','_key','key','sources','source','updatedAt','createdAt'].includes(key))
      .filter(key=>comparable(row[key])!==comparable(match?.[key]))
      .map(key=>({field:key,before:row[key],after:match?.[key]}));
    return {date:row.date,missing:!match,changes};
  }).sort((a,b)=>b.date.localeCompare(a.date));
}
