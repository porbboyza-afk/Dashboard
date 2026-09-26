function verifyFields(saved, patch) {
  for (const [field,value] of Object.entries(patch)) {
    if (!equalValue(firebaseValue(saved?.[field]),firebaseValue(value))) throw new Error('ข้อมูลที่อ่านกลับไม่ตรง กรุณาอ่านใหม่ก่อนบันทึกซ้ำ');
  }
}

// RTDB removes null/empty containers and may materialize numeric keys as arrays.
// Compare persisted meaning, not in-memory empty arrays that Firebase cannot store.
export function firebaseValue(value){
  if(value==null)return null;
  if(typeof value!=='object')return value;
  const fields=Object.entries(value).map(([key,item])=>[key,firebaseValue(item)]).filter(([,item])=>item!==null);
  return fields.length?Object.fromEntries(fields):null;
}

function equalValue(a,b) {
  if (a===b) return true;
  if (!a || !b || typeof a!=='object' || typeof b!=='object') return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length && keys.every(key=>Object.hasOwn(b,key) && equalValue(a[key],b[key]));
}

export function createRecordRepository({read,patch,atomic,now=Date.now}) {
  return {
    async workout(key, fields, {create=false}={}) {
      const path=`workouts/${key}`;
      const previous=await read(path);
      if (!create && !previous) throw new Error('ไม่พบกิจกรรมเดิม กรุณาอ่านข้อมูลใหม่');
      const changes={...fields,updatedAt:now()};
      if (!previous) Object.assign(changes,{source:'manual',createdAt:now()});
      await patch(path,changes);
      verifyFields(await read(path),changes);
      return key;
    },
    async wellness(key, fields) {
      const path=`wellness/${key}`;
      const previous=await read(path);
      const changes={...fields,updatedAt:now()};
      if (!previous) changes.createdAt=now();
      await patch(path,changes);
      verifyFields(await read(path),changes);
      return key;
    },
    async plan(planData, {mirrorLegacy=true}={}) {
      if (!planData?.planId) throw new Error('แผนต้องมี planId');
      if (planData.engineVersion!==2) throw new Error('ระบบรองรับเฉพาะ Coach Engine V2');
      const planId=planData.planId;
      const next={...planData,status:'active',updatedAt:now()};
      if (!atomic) throw new Error('การบันทึกแผนต้องรองรับการอัปเดตพร้อมกัน');
      const changes={ [`coach_plans/${planId}`]:next, active_coach_plan_id:planId };

      // Check current active pointer
      const currentActiveId=await read('active_coach_plan_id');

      // If there was an active plan with a valid pointer that is different, archive it
      if (currentActiveId && currentActiveId!==planId) {
        const oldPlan=await read(`coach_plans/${currentActiveId}`);
        if (oldPlan && oldPlan.status==='active') {
          changes[`coach_plans/${currentActiveId}/status`]='archived';
          changes[`coach_plans/${currentActiveId}/archivedAt`]=now();
        }
      }

      // Save new plan to coach_plans/{planId}

      // Set active pointer

      // Mirror legacy coach_plan
      if (mirrorLegacy) {
        changes.coach_plan=next;
      }
      await atomic(changes);

      // Read-back verification
      const savedPlan=await read(`coach_plans/${planId}`);
      verifyFields(savedPlan,next);
      if (!savedPlan || savedPlan.status!=='active') {
        throw new Error('บันทึกแผนไม่สำเร็จ: ข้อมูลที่อ่านกลับไม่ถูกต้อง');
      }
      const savedActiveId=await read('active_coach_plan_id');
      if (savedActiveId!==planId) {
        throw new Error('บันทึกแผนไม่สำเร็จ: pointer แผนที่เปิดใช้งานไม่อัปเดต');
      }
      return planId;
    },
    async archivePlan(planId) {
      if (!planId) throw new Error('กรุณาระบุรหัสแผนที่ต้องการจัดเก็บ');
      if (!atomic) throw new Error('การบันทึกแผนต้องรองรับการอัปเดตพร้อมกัน');
      if (!await read(`coach_plans/${planId}`)) throw new Error('ไม่พบแผนที่ต้องการจัดเก็บ');
      const changes={ [`coach_plans/${planId}/status`]:'archived', [`coach_plans/${planId}/archivedAt`]:now() };
      const currentActiveId=await read('active_coach_plan_id');
      if (currentActiveId===planId) {
        changes.active_coach_plan_id=null;
        changes.coach_plan=null;
      }
      await atomic(changes);
      if ((await read(`coach_plans/${planId}`))?.status!=='archived') throw new Error('อ่านกลับไม่พบสถานะแผนที่จัดเก็บ');
      const savedActiveId=await read('active_coach_plan_id');
      if (savedActiveId===planId) {
        throw new Error('จัดเก็บแผนไม่สำเร็จ: pointer แผนยังคงอยู่');
      }
      return planId;
    },
  };
}
