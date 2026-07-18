// Central, cached interpretation layer. Raw workout imports remain immutable.
(function(root) {
  'use strict';

  const ANALYSIS_VERSION = 1;
  const SESSION_TYPES = ['recovery', 'easy', 'long', 'steady', 'tempo', 'threshold', 'interval', 'other'];
  const TYPE_LABELS = { recovery: 'Recovery', easy: 'Easy', long: 'Long run', steady: 'Steady', tempo: 'Tempo', threshold: 'Threshold', interval: 'Interval', other: 'Other' };

  const number = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const normalizeType = value => SESSION_TYPES.includes(String(value || '').toLowerCase()) ? String(value).toLowerCase() : 'other';
  const safeKey = value => String(value || 'unknown').replace(/[.#$/\[\]]/g, '_');
  const activityKey = activity => safeKey(`${activity?.source || 'manual'}_${activity?.sourceId || activity?._key || activity?.id || activity?.stravaId || activity?.healthConnectId || `${activity?.date || ''}_${activity?.dist || ''}_${activity?.time || ''}`}`);
  const hash = value => {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
    return (result >>> 0).toString(36);
  };
  const revision = activity => hash(JSON.stringify({
    date: activity?.date, dist: activity?.dist, time: activity?.time, avgPace: activity?.avgPace,
    hr: activity?.hr, cad: activity?.cad, rpe: activity?.rpe, type: activity?.type, purpose: activity?.purpose,
    name: activity?.name, weather: activity?.weather, temperature: activity?.temperature, surface: activity?.surface,
    feeling: activity?.feeling, pain: activity?.pain, note: activity?.note, updatedAt: activity?.updatedAt
  }));
  const dateOnly = value => String(value || '').slice(0, 10);
  const dateDistance = (left, right) => Math.round((new Date(`${dateOnly(left)}T12:00:00`) - new Date(`${dateOnly(right)}T12:00:00`)) / 86400000);

  function analyses() {
    return root.AppState?.get('trainingAnalyses') || {};
  }

  function currentPlan() {
    return root.AppState?.get('coachPlan') || root._coachPlan || null;
  }

  function wellnessForDate(date) {
    return (root.AppState?.get('wellness') || root._wellness || []).find(row => row.date === date) || null;
  }

  function planSessionsNear(date, days = 1) {
    return (currentPlan()?.sessions || []).filter(session => Math.abs(dateDistance(session.date, date)) <= days).map(session => ({
      date: session.date, type: session.type || 'Rest', intent: session.intent || '', targetDistanceKm: number(session.targetDist),
      targetPace: session.targetPaceRange || session.targetPace || '', priority: session.priority || 'normal',
      completed: !!session.completed
    }));
  }

  function deterministic(activity) {
    const purpose = String(activity?.purpose || '').toLowerCase();
    if (SESSION_TYPES.includes(purpose)) return { type: purpose, confidence: 100, evidence: ['ระบุประเภทโดยผู้บันทึกกิจกรรม'], source: 'manual' };
    if (String(activity?.type || '').toLowerCase() === 'interval') return { type: 'interval', confidence: 100, evidence: ['ชนิดกิจกรรมถูกบันทึกเป็น interval'], source: 'manual' };

    const detail = root.MyDashActivityAnalysis?.analyze?.(activity);
    if (detail?.laps?.length) {
      const type = normalizeType(detail.type);
      const evidence = [];
      if (detail.workMinutes > 0) evidence.push(`มีช่วง work ${detail.workMinutes} นาที`);
      if (detail.recoveryMinutes > 0) evidence.push(`มีช่วง recovery ${detail.recoveryMinutes} นาที`);
      if (detail.hrDrift !== null) evidence.push(`HR drift ${detail.hrDrift}%`);
      return { type, confidence: Math.min(90, Number(detail.confidence) || 55), evidence: evidence.length ? evidence : ['วิเคราะห์จาก Garmin laps'], source: 'garmin_laps' };
    }

    if (typeof root.sessionTypeFromProfile === 'function') {
      const inferred = root.sessionTypeFromProfile({
        name: activity?.name || activity?.note || '', average_heartrate: number(activity?.hr),
        average_speed: number(activity?.avgPace) ? 1000 / (number(activity.avgPace) * 60) : 0,
        distance: (number(activity?.dist) || 0) * 1000, moving_time: (number(activity?.time) || 0) * 60
      }, [], root.getAthleteProfile?.());
      return { type: normalizeType(inferred?.type), confidence: Math.min(70, Number(inferred?.confidence) || 40), evidence: ['ประเมินจาก pace/HR เทียบ Athlete Profile'], source: 'profile' };
    }
    return { type: 'other', confidence: 0, evidence: ['ข้อมูลไม่พอสำหรับจำแนก'], source: 'unknown' };
  }

  function classification(activity) {
    const stored = analyses()[activityKey(activity)] || {};
    if (stored.override?.type) return { type: normalizeType(stored.override.type), confidence: 100, evidence: ['คุณยืนยันประเภทนี้แล้ว'], source: 'user', confirmed: true, activityKey: activityKey(activity) };
    if (stored.activityRevision === revision(activity) && stored.classification?.type) {
      return { ...stored.classification, type: normalizeType(stored.classification.type), confirmed: false, activityKey: activityKey(activity) };
    }
    return { ...deterministic(activity), confirmed: false, activityKey: activityKey(activity) };
  }

  function contextActivity(activity) {
    const date = dateOnly(activity?.date);
    const wellness = wellnessForDate(date);
    const weather = [activity?.weather, number(activity?.temperature) === null ? '' : `${number(activity.temperature)}C`, activity?.surface].filter(Boolean).join(' / ') || 'not logged';
    return {
      key: activityKey(activity), date, source: activity?.source || 'manual', name: activity?.name || '',
      distanceKm: number(activity?.dist), durationMin: number(activity?.time), averagePace: number(activity?.avgPace), averageHr: number(activity?.hr), cadence: number(activity?.cad),
      rpe: number(activity?.rpe), feeling: activity?.feeling || '', pain: activity?.pain || '', note: activity?.note || '', weather,
      currentClassification: classification(activity), wellness: wellness ? {
        sleepHours: number(wellness.sleepHours), restingHr: number(wellness.restingHR), hrv: number(wellness.hrv), stress: number(wellness.stress),
        fatigue: number(wellness.fatigue), soreness: number(wellness.soreness), bodyBattery: number(wellness.bodyBattery)
      } : null,
      plannedSessions: planSessionsNear(date)
    };
  }

  function surroundingLoad(activity, allActivities) {
    return allActivities.filter(row => {
      const delta = dateDistance(row.date, activity.date);
      return delta >= -3 && delta <= 1 && activityKey(row) !== activityKey(activity);
    }).sort((a, b) => String(a.date).localeCompare(String(b.date))).map(row => ({
      date: row.date, distanceKm: number(row.dist), durationMin: number(row.time), averagePace: number(row.avgPace), averageHr: number(row.hr),
      classification: classification(row).type, source: row.source || 'manual'
    }));
  }

  function parseJson(content) {
    const raw = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('AI did not return structured analysis');
    return JSON.parse(raw.slice(start, end + 1));
  }

  function validateAssessment(value, fallback) {
    if (!value || typeof value !== 'object') return fallback;
    return {
      type: normalizeType(value.sessionType || value.type || fallback.type),
      confidence: Math.max(0, Math.min(100, Math.round(number(value.confidence) ?? fallback.confidence ?? 0))),
      evidence: Array.isArray(value.evidence) ? value.evidence.map(item => String(item).slice(0, 180)).slice(0, 4) : fallback.evidence,
      context: String(value.context || '').slice(0, 280), source: 'ai'
    };
  }

  async function saveAssessment(activity, assessment) {
    const key = activityKey(activity);
    const existing = analyses()[key] || {};
    const record = {
      ...existing, version: ANALYSIS_VERSION, activityKey: key, activityRevision: revision(activity), generatedAt: Date.now(),
      classification: assessment
    };
    await root._fb.setData(`training_analyses/${key}`, record);
    return record;
  }

  async function setOverride(key, type) {
    if (!root._fb?.setData || (typeof root._fb.isSignedIn === 'function' && !root._fb.isSignedIn())) {
      throw new Error('กรุณา Sign in ก่อนบันทึกประเภทเซสชัน');
    }
    const activity = (root.getAllActivities?.() || []).find(row => activityKey(row) === key);
    if (!activity) throw new Error('ไม่พบกิจกรรมที่ต้องการแก้ประเภท');
    const existing = analyses()[key] || {};
    const override = type ? { type: normalizeType(type), confirmedAt: Date.now() } : null;
    await root._fb.setData(`training_analyses/${key}`, {
      ...existing, version: ANALYSIS_VERSION, activityKey: key, activityRevision: revision(activity), override, updatedAt: Date.now()
    });
  }

  function periodFacts(activities) {
    const all = root.getAllActivities?.() || [];
    return activities.map(activity => ({ ...contextActivity(activity), surroundingLoad: surroundingLoad(activity, all) }));
  }

  function reportMarkdown(report) {
    const observations = Array.isArray(report?.observations) ? report.observations.map(item => `- ${item}`).join('\n') : '';
    const limitations = Array.isArray(report?.limitations) ? report.limitations.map(item => `- ${item}`).join('\n') : '';
    return [
      report?.summary ? `**ภาพรวม**\n${report.summary}` : '',
      observations ? `**สิ่งที่เห็นจากข้อมูล**\n${observations}` : '',
      report?.next48h ? `**24-48 ชั่วโมงถัดไป**\n${report.next48h}` : '',
      limitations ? `**ข้อจำกัดของข้อมูล**\n${limitations}` : ''
    ].filter(Boolean).join('\n\n');
  }

  async function analyzePeriod({ label, activities }) {
    if (!root._fb?.setData || (typeof root._fb.isSignedIn === 'function' && !root._fb.isSignedIn())) {
      throw new Error('กรุณา Sign in ก่อนให้ AI วิเคราะห์และบันทึกผล');
    }
    const facts = periodFacts(activities);
    const readiness = root.calculateReadiness?.() || {};
    const prompt = [
      'You are MyDash Training Analyst. Return valid JSON only. Do not browse the web and do not invent weather, injuries, or missing data.',
      'Classify each activity using only the supplied facts. A slower pace can be intentional because of heat, wind, terrain, recovery, fatigue, or an off-plan workout. Do not call a plan deviation a failure unless facts show a problem.',
      'Allowed sessionType values: recovery, easy, long, steady, tempo, threshold, interval, other.',
      'If evidence is weak, keep confidence low and say what is missing. A user-confirmed classification always wins and must not be contradicted.',
      `Selected period: ${label}`,
      `Current readiness facts: ${JSON.stringify({ score: readiness.score ?? null, acute: readiness.load?.acute ?? null, chronicWeekly: readiness.load?.chronicWeekly ?? null, acwr: readiness.load?.acwr ?? null })}`,
      `Activities and local context: ${JSON.stringify(facts)}`,
      'Return exactly this JSON shape: {"activities":[{"key":"...","sessionType":"easy","confidence":0,"evidence":["..."],"context":"..."}],"report":{"summary":"...","observations":["..."],"next48h":"...","limitations":["..."]}}'
    ].join('\n\n');
    const data = await root.callNewsChat([
      { role: 'system', content: 'You are a cautious running coach. Reply in Thai with valid JSON only.' },
      { role: 'user', content: prompt }
    ], { useSearch: false, maxTokens: 1800, timeoutMs: 60000, temperature: 0.25 });
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI ไม่ส่งผลวิเคราะห์กลับมา');
    const parsed = parseJson(content);
    const responseByKey = new Map((parsed.activities || []).map(item => [String(item.key || ''), item]));
    await Promise.all(activities.map(activity => {
      const key = activityKey(activity), saved = analyses()[key] || {};
      if (saved.override?.type) return Promise.resolve(saved);
      return saveAssessment(activity, validateAssessment(responseByKey.get(key), deterministic(activity)));
    }));
    return { markdown: reportMarkdown(parsed.report), report: parsed.report || {}, activities: facts };
  }

  root.MyDashTrainingAnalyst = {
    version: ANALYSIS_VERSION, activityKey, revision, classification, contextActivity, periodFacts, analyzePeriod, setOverride,
    types: SESSION_TYPES, labels: TYPE_LABELS
  };
})(window);
