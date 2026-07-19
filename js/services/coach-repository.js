(function(root){
  'use strict';

  function firebase(){
    if(!root._fb)throw new Error('Firebase client is not ready');
    return root._fb;
  }
  function safeId(value){return String(value||'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,100);}
  function requirePlan(plan){
    if(!plan?.planId)throw new Error('V2 plan requires planId');
    if(plan.engineVersion!==2)throw new Error('Versioned persistence requires Coach Engine V2');
    return plan;
  }
  async function savePlan(plan,{mirrorLegacy=true}={}){
    const next={...requirePlan(plan),status:'active',updatedAt:plan.updatedAt||Date.now()};
    const id=safeId(next.planId);
    await firebase().setData(`coach_plans/${id}`,next);
    await firebase().setData('active_coach_plan_id',id);
    if(mirrorLegacy)await firebase().setData('coach_plan',next);
    return next;
  }
  async function saveRevision(plan,{mirrorLegacy=true}={}){
    requirePlan(plan);
    const currentRevision=parseInt(String(plan.revisionId||'r1').replace(/\D/g,''))||1;
    const revisionNumber=currentRevision+1;
    return savePlan({...plan,revisionId:`r${revisionNumber}`,updatedAt:Date.now()},{mirrorLegacy});
  }
  async function replaceActivePlan(plan,{mirrorLegacy=true}={}){
    const current=await loadActivePlan();
    const saved=await savePlan(plan,{mirrorLegacy});
    if(current?.planId&&current.planId!==saved.planId){
      const id=safeId(current.planId);
      await firebase().setData(`coach_plans/${id}/status`,'archived');
      await firebase().setData(`coach_plans/${id}/archivedAt`,Date.now());
    }
    return saved;
  }
  async function archivePlan(plan){
    if(plan?.planId&&plan.engineVersion===2){
      const id=safeId(plan.planId);
      await firebase().setData(`coach_plans/${id}/status`,'archived');
      await firebase().setData(`coach_plans/${id}/archivedAt`,Date.now());
    }
    await firebase().removeData('active_coach_plan_id');
    await firebase().removeData('coach_plan');
  }
  async function loadActivePlan(){
    const id=await firebase().getData('active_coach_plan_id');
    if(!id)return null;
    const plan=await firebase().getData(`coach_plans/${safeId(id)}`);
    return plan?.status==='active'?plan:null;
  }

  root.MyDashCoachRepository={savePlan,saveRevision,replaceActivePlan,archivePlan,loadActivePlan,safeId};
})(window);
