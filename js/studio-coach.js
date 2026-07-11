(function(root) {
  'use strict';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  const typeClass = type => ['Tempo','Interval'].includes(type) ? 'quality' : type === 'Long' ? 'long' : type === 'Recovery' ? 'recovery' : type === 'Rest' ? 'rest' : 'easy';
  const label = type => ({Easy:'Easy aerobic',Recovery:'Recovery run',Tempo:'Tempo',Interval:'Intervals',Long:'Long run',Rest:'Rest / recovery'}[type] || type || 'Session');
  const dateText = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase();

  function renderStudioCoachBoard(plan) {
    const target = document.getElementById('coach-plan-days');
    if (!target || !Array.isArray(plan?.sessions)) return;
    let board = document.getElementById('studio-coach-board');
    if (!board) { board = document.createElement('section'); board.id = 'studio-coach-board'; target.parentNode.insertBefore(board, target); }
    const activities = typeof root.getAllActivities === 'function' ? root.getAllActivities() : [];
    const today = typeof root.toLocalDateStr === 'function' ? root.toLocalDateStr() : new Date().toISOString().slice(0,10);
    const weeks = [...new Set(plan.sessions.map(session => session.week || 1))];
    const caps = plan.inputAudit?.danielsQualityCaps;
    const capText = caps ? `R ${Math.round((caps.R?.percentOfWeekly || 0) * 100)}% / I ${Math.round((caps.I?.percentOfWeekly || 0) * 100)}% / T ${Math.round((caps.T?.percentOfWeekly || 0) * 100)}% weekly volume` : '';
    const recoveryText = plan.raceRecoveryPolicy?.easyDays ? `${plan.raceRecoveryPolicy.easyDays} Easy days after race` : '';
    const auditText = [capText, recoveryText].filter(Boolean).join(' | ');
    board.innerHTML = `<div class="studio-coach-heading"><div><span>PLAN BOARD</span><h2>${escapeHtml(plan.goal || 'Training plan')}</h2>${auditText ? `<small>${escapeHtml(auditText)}</small>` : ''}</div><div>${weeks.length} weeks · ${plan.sessions.filter(s=>s.type!=='Rest').length} sessions</div></div>` + weeks.map(week => {
      const sessions = plan.sessions.filter(session => (session.week || 1) === week);
      const phase = sessions[0]?.phase || plan.phaseSchedule?.find(item => item.week === week)?.phase || 'Build';
      return `<section class="studio-coach-week"><header><b>WEEK ${week}</b><span>${escapeHtml(phase)}</span></header><div class="studio-coach-days">${sessions.map((session,index) => {
        const done = !!plan.completedDates?.[session.date] || activities.some(activity => activity.date === session.date);
        const todayClass = session.date === today ? ' is-today' : '';
        const action = session.type === 'Rest' ? '' : `<div class="studio-coach-actions"><button onclick="showCoachSessionDetail(${plan.sessions.indexOf(session)})">Details</button>${!done ? `<button onclick="markDone('${session.date}')">Done</button>` : ''}</div>`;
        return `<article class="studio-coach-session ${typeClass(session.type)}${todayClass}${done ? ' is-done' : ''}"><small>${dateText(session.date)}</small><b>${escapeHtml(label(session.type))}</b><p>${escapeHtml(session.targetDist > 0 ? `${session.targetDist} km` : session.recoveryAdvice?.summary || 'Recovery')}</p>${session.targetHR ? `<em>${escapeHtml(session.targetHR)}</em>` : ''}${action}</article>`;
      }).join('')}</div></section>`;
    }).join('');
    target.classList.add('studio-coach-legacy-list');
  }
  root.renderStudioCoachBoard = renderStudioCoachBoard;
})(window);
