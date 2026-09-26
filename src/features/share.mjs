import {periodBounds, summarize, localDate} from '../domain/model.mjs';
import {pageHeading} from '../ui/components.mjs';
import {escape as e, number, dateLabel} from '../ui/format.mjs';

export function shareSummary(model, period='month', date=localDate()) {
  const bounds=periodBounds(date,period);
  return {...summarize(model.activities,bounds),bounds};
}

export function shareView(model, period, date) {
  const data=shareSummary(model,period,date);
  return `${pageHeading('SHARE YOUR PROGRESS','แชร์สถิติ','เลือกช่วงเวลาและตรวจภาพก่อนดาวน์โหลดหรือแชร์')}<section class="card"><div class="period-toolbar"><label>ช่วงเวลา<select id="share-period"><option value="month" ${period==='month'?'selected':''}>เดือน</option><option value="week" ${period==='week'?'selected':''}>สัปดาห์</option></select></label><label>วันที่อ้างอิง<input type="date" id="share-date" value="${e(date)}"></label></div><p>${dateLabel(data.bounds.start)} – ${dateLabel(data.bounds.end,{year:'numeric'})}</p><p class="muted">${number(data.distanceKm,2)} km · ${data.count} กิจกรรม · ${number(data.durationMin,0)} นาที</p><canvas id="share-canvas" width="1080" height="1080" style="width:100%;max-width:540px;height:auto;display:block;margin:20px auto;border-radius:16px" aria-label="ภาพสถิติระยะทาง จำนวนกิจกรรม และเวลา"></canvas><div class="form-actions"><button type="button" class="button" id="download-share">ดาวน์โหลด PNG</button><button type="button" class="subtle-button" id="native-share" hidden>แชร์ภาพ</button></div><p class="form-status" role="status"></p></section>`;
}

export function drawShare(canvas,data) {
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#183f31';ctx.fillRect(0,0,1080,1080);
  ctx.fillStyle='#ff9958';ctx.fillRect(64,68,72,8);
  ctx.fillStyle='#fffefa';ctx.font='bold 48px system-ui';ctx.fillText('MYDASH · PERFORMANCE',64,145);
  ctx.font='30px system-ui';ctx.fillText(`${dateLabel(data.bounds.start)} – ${dateLabel(data.bounds.end,{year:'numeric'})}`,64,210,940);
  ctx.fillStyle='#ff9958';ctx.font='bold 148px system-ui';ctx.fillText(number(data.distanceKm,2),64,450,780);
  ctx.font='42px system-ui';ctx.fillText('กิโลเมตร',64,520);
  ctx.fillStyle='#fffefa';ctx.font='bold 62px system-ui';ctx.fillText(`${data.count} กิจกรรม`,64,685);
  ctx.font='44px system-ui';ctx.fillText(`${number(data.durationMin,0)} นาที`,64,770);
  ctx.fillStyle='#d1dbcc';ctx.font='27px system-ui';ctx.fillText('สถิติจากกิจกรรมที่บันทึกใน MyDash',64,980);
}

export function bindShare(model,period,date,onChange) {
  const canvas=document.querySelector('#share-canvas');if(!canvas)return;
  drawShare(canvas,shareSummary(model,period,date));
  document.querySelector('#share-period').onchange=event=>onChange(event.target.value,date);
  document.querySelector('#share-date').onchange=event=>{if(event.target.value)onChange(period,event.target.value);};
  const status=canvas.parentElement.querySelector('.form-status');
  const asBlob=()=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('สร้างภาพไม่สำเร็จ')),'image/png'));
  document.querySelector('#download-share').onclick=async()=>{
    try {const blob=await asBlob();const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`mydash-${period}-${date}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='ส่งภาพให้เบราว์เซอร์ดาวน์โหลดแล้ว';}
    catch(error){status.textContent=error.message;}
  };
  const button=document.querySelector('#native-share');
  const probe=new File([''],'mydash.png',{type:'image/png'});
  button.hidden=!navigator.canShare?.({files:[probe]});
  button.onclick=async()=>{try{const file=new File([await asBlob()],'mydash.png',{type:'image/png'});await navigator.share({files:[file],title:'MyDash'});}catch(error){status.textContent=error.name==='AbortError'?'ยกเลิกการแชร์แล้ว':'แชร์ไม่สำเร็จ กรุณาดาวน์โหลด PNG';}};
}
