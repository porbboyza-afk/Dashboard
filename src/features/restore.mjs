import {inspectBackup} from '../domain/backup.mjs';
import {restoreEntries,applyRestore} from '../domain/restore.mjs';
import {normalizeBackup} from '../domain/legacy-backup.mjs';

export function bindRestore({model,requireCloud,save}){
  const input=document.querySelector('#backup-inspect-file');if(!input)return;
  input.closest('section').querySelector('p').textContent='รองรับ JSON รุ่น 2 และ MyDash Health Intelligence V4 ไม่เกิน 10 MB เพิ่มเฉพาะรายการที่หาย ไม่ทับข้อมูลเดิม ไม่เปลี่ยนแผนปัจจุบัน ไฟล์เก่าที่จับคู่ได้หลายรายการจะไม่ถูกนำเข้าโดยเดา';
  const output=document.querySelector('#backup-inspect-result');
  const button=document.createElement('button');button.type='button';button.className='button';button.textContent='ยืนยันกู้คืนเฉพาะรายการที่หาย';button.hidden=true;output.after(button);
  let candidate=null;
  input.addEventListener('change',async()=>{
    candidate=null;button.hidden=true;output.textContent='';const file=input.files?.[0];if(!file)return;
    try{
      if(file.size>10*1024*1024)throw new Error('ไฟล์เกิน 10 MB กรุณาแบ่งข้อมูลก่อน');
      const inspected=inspectBackup(await file.text());
      output.textContent=`อ่านไฟล์ได้: กิจกรรม ${inspected.workouts} · สุขภาพ ${inspected.wellness} · แผน ${inspected.plans} — `;
      const normalized=await normalizeBackup(inspected.payload,model.data);
      const entries=restoreEntries(normalized);
      const root={};for(const [path,value] of Object.entries(model.data)){let parent=root;const parts=path.split('/');const key=parts.pop();for(const part of parts)parent=parent[part]??={};parent[key]=value;}
      const {report}=applyRestore(root,entries);
      output.append(document.createTextNode(`เพิ่มได้ ${report.added} · เหมือนเดิม ${report.identical} · ข้อมูลชนกัน ${report.conflicts} (ข้าม ไม่ทับ) · แผนที่เพิ่มจะเก็บเป็น archived โดยไม่เปลี่ยนแผนปัจจุบัน`));
      const details=document.createElement('details');const title=document.createElement('summary');title.textContent='ดูรายการที่ข้ามเพราะข้อมูลต่างกัน';details.append(title);
      for(const item of report.items.filter(row=>row.state==='conflicts')){const line=document.createElement('p');line.textContent=item.path+'/'+item.key;details.append(line);}output.append(details);
      candidate=normalized;button.hidden=report.added===0;
    }catch(error){output.append(document.createTextNode(error.message));}
  });
  button.addEventListener('click',async()=>{
    try{
      requireCloud();if(!candidate)return;
      if(!confirm('เพิ่มเฉพาะรายการที่หายเข้าบัญชีที่เข้าสู่ระบบอยู่? ไม่ทับรายการเดิม ไม่เปลี่ยนแผนปัจจุบัน และไม่กู้คืนการตั้งค่า/token'))return;
      button.disabled=true;input.disabled=true;
      const result=await save(candidate);
      const currentOutput=document.querySelector('#backup-inspect-result');
      if(currentOutput)currentOutput.textContent=`กู้คืนและอ่านกลับแล้ว: เพิ่ม ${result.added} · เหมือนเดิม ${result.identical} · ข้ามข้อมูลชนกัน ${result.conflicts}`;button.hidden=true;candidate=null;
    }catch(error){output.textContent=error.message;}
    finally{button.disabled=false;input.disabled=false;}
  });
}
