import {escape as e} from './format.mjs';
import {localDate} from '../domain/model.mjs';
import {SESSION_TYPES,SESSION_TYPE_LABELS} from '../domain/manual-plan.mjs';

const input=(name,label,value='',options='')=>`<label>${e(label)}<input name="${name}" value="${e(value ?? '')}" ${options}></label>`;
export function workoutForm(activity=null) {
  const row=activity?.raw || {};
  return `<details class="card entry-disclosure"><summary>${activity?'แก้ไขบันทึกกิจกรรม':'+ บันทึกกิจกรรมด้วยตัวเอง'}</summary><form id="workout-form" data-key="${e(activity?.key || '')}"><p class="form-context muted">บันทึกเข้าสู่บัญชี MyDash ที่คุณเข้าสู่ระบบ</p><div class="form-grid">${input('name','ชื่อกิจกรรม',row.name || row.purpose || row.type || '', 'required maxlength="120"')}${input('date','วันที่',row.date || localDate(),'type="date" required')}<label>ประเภท<select name="type">${[['run','วิ่ง'],['interval','Interval'],['walk','เดิน'],['bike','จักรยาน'],['swim','ว่ายน้ำ'],['strength','เวทเทรนนิง']].map(([value,label])=>`<option value="${value}" ${row.type===value?'selected':''}>${label}</option>`).join('')}</select></label>${input('dist','ระยะทาง (km)',row.dist,'type="number" min="0.01" max="1000" step="any" required')}${input('time','เวลา (นาที เช่น 37.5)',row.time,'type="number" min="0.01" max="10080" step="any" required')}</div><div class="form-actions"><button class="button" type="submit">บันทึกกิจกรรม</button><button class="subtle-button" type="button" data-collapse>ยกเลิก</button></div><p class="form-status" role="status"></p><div id="workout-extra"><details><summary>รายละเอียดเพิ่มเติม</summary><div class="form-grid">${input('hr','HR เฉลี่ย',row.hr > 0 ? row.hr : '', 'type="number" min="30" max="240" step="any"')}${input('cad','Cadence (spm)',row.cad > 0 ? row.cad : '', 'type="number" min="1" max="300" step="any"')}${input('rpe','ความเหนื่อย RPE (1–10)',row.rpe > 0 ? row.rpe : '', 'type="number" min="1" max="10" step="any"')}${input('shoe','รองเท้า',row.shoe,'maxlength="150"')}</div><label>บันทึกเพิ่มเติม<textarea name="note" rows="3" maxlength="2000">${e(row.note || '')}</textarea></label></details></div></form></details>`;
}

export function healthForm(record={}, date=localDate()) {
  return `<details class="card entry-disclosure"><summary>+ บันทึกสุขภาพ / การนอน</summary><form id="health-form"><p class="form-context muted">แก้เฉพาะช่องที่ต้องการ ช่องที่ไม่เปลี่ยนจะคงข้อมูลซิงก์เดิม</p>${input('date','วันที่',date,'type="date" required')}<div id="health-fields">${healthFields(record)}</div><div class="form-actions"><button class="button" type="submit">บันทึกสุขภาพ</button><button class="subtle-button" type="button" data-collapse>ยกเลิก</button></div><p class="form-status" role="status"></p><div id="health-extra">${healthExtraFields(record)}</div></form></details>`;
}

export function healthFields(row={}) {
  return `<div class="form-grid">${input('sleepHours','เวลานอน (ชม. เช่น 7.5)',row.sleepHours,'type="number" min="0" max="24" step="any"')}${input('restingHR','Resting HR (bpm)',row.restingHR,'type="number" min="20" max="220" step="any"')}${input('hrv','HRV (ms)',row.hrv,'type="number" min="0" max="400" step="any"')}${input('fatigue','ความเหนื่อย (1–10)',row.fatigue,'type="number" min="1" max="10" step="any"')}</div>`;
}

export function healthExtraFields(row={}) {
  return `<details><summary>สุขภาพเพิ่มเติม</summary><div class="form-grid">${input('spo2','SpO₂ (%)',row.spo2,'type="number" min="0" max="100" step="any"')}${input('sleepQuality','คุณภาพการนอน (1–10)',row.sleepQuality,'type="number" min="1" max="10" step="any"')}${input('stress','ความเครียด (1–10)',row.stress,'type="number" min="1" max="10" step="any"')}${input('weight','น้ำหนัก (kg)',row.weight,'type="number" min="1" max="500" step="any"')}${input('bodyFat','ไขมันในร่างกาย (%)',row.bodyFat,'type="number" min="0" max="100" step="any"')}${input('soreness','อาการปวดเมื่อย (0–10)',row.soreness,'type="number" min="0" max="10" step="any"')}${input('mood','อารมณ์ (1–10)',row.mood,'type="number" min="1" max="10" step="any"')}${input('bloodPressure','ความดันโลหิต',row.bloodPressure,'maxlength="150"')}${input('painLocation','ตำแหน่งที่ปวด',row.painLocation,'maxlength="150"')}<label>สถานะสุขภาพ<select name="healthStatus"><option value="" ${!row.healthStatus?'selected':''}>ยังไม่ระบุ</option>${[['normal','ปกติ'],['sick','ป่วย'],['injured','บาดเจ็บ']].map(([value,label])=>`<option value="${value}" ${row.healthStatus===value?'selected':''}>${label}</option>`).join('')}</select></label></div><label>บันทึกเพิ่มเติม<textarea name="note" rows="3" maxlength="2000">${e(row.note || '')}</textarea></label></details>`;
}

export function workoutContextFields(row={}) {
  return `<details><summary>บริบทการฝึกและสภาพแวดล้อม</summary><div class="form-grid"><label>เป้าหมายการฝึก<select name="purpose"><option value="" ${!row.purpose?'selected':''}>ยังไม่ระบุ</option>${[['easy','Easy'],['recovery','Recovery'],['tempo','Tempo'],['interval','Interval'],['long','Long Run'],['race','Race'],['strength','Strength'],['other','Other']].map(([value,label])=>`<option value="${value}" ${row.purpose===value?'selected':''}>${label}</option>`).join('')}</select></label>${input('stride','ความยาวก้าว (m)',row.stride,'type="number" min="0.01" max="5" step="any"')}<label>พื้นผิว<select name="surface"><option value="" ${!row.surface?'selected':''}>ยังไม่ระบุ</option>${['Road','Track','Trail','Treadmill','Pool','Indoor'].map(value=>`<option ${row.surface===value?'selected':''}>${value}</option>`).join('')}</select></label>${input('temperature','อุณหภูมิ (°C)',row.temperature,'type="number" min="-20" max="60" step="any"')}${input('weather','สภาพอากาศ',row.weather,'maxlength="60"')}${input('pain','อาการเจ็บ (0–10)',row.pain,'type="number" min="0" max="10" step="any"')}${input('painLocation','ตำแหน่งที่เจ็บ',row.painLocation,'maxlength="80"')}${input('feeling','ความรู้สึกหลังออกกำลังกาย',row.feeling,'maxlength="160"')}</div></details>`;
}

export function workoutIntervalFields(row={}) {
  const interval=row.interval || {};
  return `<section id="interval-fields" class="card interval-fields" hidden><h3>โครงสร้าง Interval</h3><p class="muted small">กรอกช่วงเร็วและช่วงพัก ผลรวมระยะกับเวลาจะคำนวณให้อัตโนมัติ</p><div class="form-grid">${input('ivReps','จำนวนรอบ',interval.reps,'type="number" min="1" max="30" step="1"')}${input('ivRepDist','ระยะต่อรอบ (km)',interval.repDist,'type="number" min="0.01" max="100" step="any"')}${input('ivRepPace','เพซช่วงเร็ว (นาที:วินาที /km)',interval.repPace,'placeholder="4:30"')}${input('ivRepHr','HR ช่วงเร็ว',interval.repHR || '','type="number" min="30" max="240"')}${input('ivRestTime','เวลาพักต่อรอบ (นาที)',interval.restTime,'type="number" min="0" max="120" step="any"')}${input('ivRestHr','HR ช่วงพัก',interval.restHR || '','type="number" min="30" max="240"')}</div><details><summary>วอร์มอัปและคูลดาวน์</summary><div class="form-grid">${input('ivWuDist','ระยะวอร์มอัป (km)',interval.warmup?.dist,'type="number" min="0" max="100" step="any"')}${input('ivWuTime','เวลาวอร์มอัป (นาที)',interval.warmup?.time,'type="number" min="0" max="180" step="any"')}${input('ivWuPace','เพซวอร์มอัป',interval.warmup?.pace,'placeholder="6:30"')}${input('ivCdDist','ระยะคูลดาวน์ (km)',interval.cooldown?.dist,'type="number" min="0" max="100" step="any"')}${input('ivCdTime','เวลาคูลดาวน์ (นาที)',interval.cooldown?.time,'type="number" min="0" max="180" step="any"')}${input('ivCdPace','เพซคูลดาวน์',interval.cooldown?.pace,'placeholder="6:30"')}</div></details><p id="interval-preview" class="note" role="status">กรอกจำนวนรอบ ระยะต่อรอบ และเพซ เพื่อดูผลรวม</p></section>`;
}

export function workoutSplitRow(split={}, index=0) {
  const km = split.km ?? (index + 1);
  const pace = split.pace ?? '';
  const hr = split.hr ?? '';
  return `<div class="card split-item" data-split-index="${index}" style="margin-top:8px; padding:10px; border:1px solid var(--border); background:var(--card); display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
    <label style="flex:0 0 75px;">กม. ที่
      <input name="splitKm" type="number" min="1" step="1" value="${e(km)}" required style="width:100%;">
    </label>
    <label style="flex:1 1 130px;">เพซ (นาที:วินาที /km)
      <input name="splitPace" type="text" placeholder="5:30" value="${e(pace)}" style="width:100%;">
    </label>
    <label style="flex:1 1 110px;">HR เฉลี่ย (bpm)
      <input name="splitHr" type="number" min="30" max="240" placeholder="145" value="${e(hr)}" style="width:100%;">
    </label>
    <button type="button" class="subtle-button" data-remove-split style="color:#b33c24; border-color:#e2c5bd; min-height:36px; padding:4px 10px; margin-bottom:2px;">✕ ลบ</button>
  </div>`;
}

export function workoutSplitsDisclosure(existingSplits = []) {
  const rows = Array.isArray(existingSplits) ? existingSplits : [];
  return `<details class="card entry-disclosure" id="manual-splits" style="margin-top:12px;">
    <summary>รอบวิ่งรายกิโลเมตร (ไม่บังคับ)</summary>
    <div style="margin-top:10px;">
      <p class="form-context muted" style="margin-bottom:10px;">บันทึกเพซและ HR รายกิโลเมตร หรือกดปุ่มเพื่อสร้างช่องตามระยะทางรวม</p>
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <button type="button" class="button" id="btn-generate-splits" style="font-size:0.85rem; padding:6px 12px;">สร้างช่องตามระยะ</button>
        <button type="button" class="subtle-button" id="btn-add-split" style="font-size:0.85rem; padding:6px 12px;">+ เพิ่มรอบ</button>
      </div>
      <div id="splits-list">
        ${rows.map((split, i) => workoutSplitRow(split, i)).join('')}
      </div>
    </div>
  </details>`;
}

export function planSessionRow(session={}, index=0) {
  const type=session.type || 'Easy';
  const dist=type==='Rest'?0:(session.targetDist ?? 5);
  return `<div class="card session-item" data-session-index="${index}" style="margin-top:12px; border:1px solid var(--border); background:var(--card);">
    <div class="section-heading" style="margin-bottom:8px;">
      <strong>เซสชันที่ ${index+1}</strong>
      <button type="button" class="subtle-button" data-remove-session="${index}" style="color:#b33c24; border-color:#e2c5bd; min-height:32px; padding:2px 8px;">✕ ลบ</button>
    </div>
    <div class="form-grid">
      <label>วันที่
        <input name="sessionDate" type="date" value="${e(session.date || localDate())}" required>
      </label>
      <label>ประเภท
        <select name="sessionType">
          ${SESSION_TYPES.map(t=>`<option value="${t}" ${t===type?'selected':''}>${SESSION_TYPE_LABELS[t] || t}</option>`).join('')}
        </select>
      </label>
      <label>ระยะทางเป้าหมาย (km)
        <input name="sessionDist" type="number" min="0" max="200" step="any" value="${dist}" ${type==='Rest'?'readonly':''} required>
      </label>
      <label>หัวข้อ / รายละเอียดสั้น
        <input name="sessionTitle" type="text" maxlength="120" value="${e(session.title || '')}" placeholder="เช่น วิ่งสบายคุมโซน 2">
      </label>
    </div>
    <details>
      <summary style="font-size:0.85rem; padding:6px 0;">รายละเอียดการซ้อมเพิ่มเติม (ชุดหลัก/วอร์ม/คูลดาวน์)</summary>
      <div class="form-grid">
        <label>ชุดหลัก (Main Set)
          <input name="sessionMainSet" type="text" maxlength="2000" value="${e(session.mainSet || '')}" placeholder="เช่น 5 km @ 5:30/km">
        </label>
        <label>วอร์มอัป
          <input name="sessionWarmup" type="text" maxlength="1000" value="${e(session.warmup || '')}" placeholder="เช่น เดินเร็ว + ยืดเหยียด 10 นาที">
        </label>
        <label>คูลดาวน์
          <input name="sessionCooldown" type="text" maxlength="1000" value="${e(session.cooldown || '')}" placeholder="เช่น จ็อกเบา 5 นาที + ยืดกล้ามเนื้อ">
        </label>
        <label>หมายเหตุ
          <input name="sessionNotes" type="text" maxlength="2000" value="${e(session.notes || '')}" placeholder="หมายเหตุสำหรับนักวิ่ง">
        </label>
      </div>
    </details>
  </div>`;
}

export function planBuilderForm(existingPlan=null) {
  const defaultGoal=existingPlan?.goal || 'ตารางฝึกที่สร้างเอง';
  return `<details class="card entry-disclosure" id="plan-disclosure"><summary>+ สร้างตารางฝึกใหม่ด้วยตัวเอง (Manual Plan Builder)</summary><form id="plan-form"><p class="form-context muted">สร้างและกำหนดตารางฝึกซ้อมรายวันด้วยตัวเอง คำนวณเป้าระยะทางรายสัปดาห์ให้อัตโนมัติ</p><div class="form-grid"><label style="grid-column:1 / -1;">ชื่อแผน / เป้าหมายการฝึก<input name="planGoal" type="text" maxlength="150" value="${e(defaultGoal)}" placeholder="เช่น ตารางเตรียมวิ่งมาราธอน 16 สัปดาห์" required></label></div><div class="section-heading" style="margin-top:1.2rem;"><h3>รายการเซสชันฝึกซ้อม</h3><button type="button" class="button" id="plan-add-session" style="margin-top:0;">+ เพิ่มเซสชัน</button></div><div id="plan-sessions-list"></div><section id="plan-preview-card" class="card" style="margin-top:1.2rem; background:var(--card);"><div class="section-heading"><h3>พรีวิวเป้าระยะทางรายสัปดาห์</h3><span id="plan-preview-stats" class="source">—</span></div><div id="plan-preview-content" class="table-scroll"><p class="muted">ยังไม่มีเซสชัน กด "+ เพิ่มเซสชัน" เพื่อเริ่มกำหนดตารางฝึก</p></div></section><div class="form-actions" style="margin-top:1.5rem;"><button class="button" type="submit">บันทึกและเปิดใช้งานแผนนี้</button><button class="subtle-button" type="button" data-collapse>ยกเลิก</button></div><p class="form-status" role="status"></p></form></details>`;
}

export function planImportForm() {
  return `<details class="card entry-disclosure" id="plan-import-disclosure" style="margin-top:14px;">
    <summary>📥 + นำเข้าตารางฝึกซ้อมจากไฟล์ (.csv, .json)</summary>
    <form id="plan-import-form">
      <p class="form-context muted">นำเข้าไฟล์ตารางฝึกซ้อมจาก Excel, Google Sheets (.csv) หรือไฟล์สำรอง (.json) ระบบจะพาร์สและคำนวณสัปดาห์ให้อัตโนมัติ</p>
      <div class="form-grid" style="margin-top:12px;">
        <label style="grid-column:1 / -1;">เลือกไฟล์ตารางฝึกซ้อม (.csv หรือ .json)
          <input type="file" id="plan-file-input" accept=".csv,.json,text/csv,application/json" style="padding:8px;">
        </label>
        <label style="grid-column:1 / -1;">ชื่อแผน / เป้าหมาย
          <input name="importPlanGoal" id="import-plan-goal" type="text" maxlength="150" placeholder="ชื่อแผน (หรือใช้ชื่อไฟล์อัตโนมัติ)">
        </label>
      </div>
      <section id="plan-import-preview-card" class="card" style="margin-top:1.2rem; background:var(--card); display:none;">
        <div class="section-heading">
          <h3>พรีวิวตารางซ้อมที่นำเข้า</h3>
          <span id="plan-import-stats" class="source">—</span>
        </div>
        <div id="plan-import-preview-content" class="table-scroll"></div>
      </section>
      <div class="form-actions" style="margin-top:1.5rem;">
        <button class="button" type="submit" id="btn-submit-import" disabled>บันทึกและเปิดใช้งานแผนนี้</button>
        <button class="subtle-button" type="button" data-collapse>ยกเลิก</button>
      </div>
      <p class="form-status" role="status"></p>
    </form>
  </details>`;
}
