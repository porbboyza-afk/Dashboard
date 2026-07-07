// AI News/Q&A logic extracted from index.html.
async function askNewsAI(){const q=document.getElementById('news-query')?.value?.trim();if(!q){showToast('กรุณาพิมพ์คำถาม','error');return;}await askDeepSeek(q,'คุณคือผู้เชี่ยวชาญรอบด้าน ตอบเป็นภาษาไทย ชัดเจน กระชับ','btn-news','news-output');document.getElementById('news-output').style.display='block';}
function setNewsQ(q){document.getElementById('news-query').value=q;}

// ── STRAVA ──
let newsChatMessages = [];
let newsLatestSources = [];
let pinnedNewsNotes = JSON.parse(localStorage.getItem('mydash-news-notes') || '[]');
const NEWS_SYSTEM_PROMPT = 'คุณคือผู้ช่วย AI ส่วนตัวของผู้ใช้ ตอบเป็นภาษาไทย ชัดเจน ใช้งานจริงได้ ถ้าไม่แน่ใจให้บอกว่าไม่แน่ใจ และห้ามอ้างว่ามีข้อมูลล่าสุดถ้าไม่ได้รับข้อมูลมา';

function escapeHtmlText(value='') {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function renderNewsSidePanel() {
  const sourcesBox = document.getElementById('news-sources');
  if (sourcesBox) {
    sourcesBox.innerHTML = newsLatestSources.length ? newsLatestSources.map((item, index) => `
      <div class="news-item">
        <div class="news-item-title">${escapeHtmlText(item.title)}</div>
        <div class="news-item-meta">${escapeHtmlText(item.source || 'Google News')} · ${escapeHtmlText(item.pubDate || '')}</div>
        <div class="flex gap-8 flex-wrap">
          <button class="btn btn-ghost btn-sm" onclick="pinNewsSource(${index})">Pin</button>
          <button class="btn btn-primary btn-sm" onclick="summarizeNewsSource(${index})">Summarize</button>
          <a class="btn btn-ghost btn-sm" href="${escapeHtmlText(item.link)}" target="_blank" rel="noopener">Open</a>
        </div>
      </div>
    `).join('') : '<div class="text-xs c3" style="margin-top:8px">ถามข่าวก่อน แล้ว sources จะขึ้นตรงนี้</div>';
  }
  const notesBox = document.getElementById('news-notes');
  if (notesBox) {
    notesBox.innerHTML = pinnedNewsNotes.length ? pinnedNewsNotes.map((note, index) => `
      <div class="news-item">
        <div class="news-item-title">${escapeHtmlText(note.title || 'Personal note')}</div>
        <div class="news-item-meta">${escapeHtmlText(note.source || 'Note')} · ${escapeHtmlText(note.createdAt || '')}</div>
        ${note.note ? `<div class="text-xs c2 mb-8">${escapeHtmlText(note.note)}</div>` : ''}
        <div class="flex gap-8 flex-wrap">
          ${note.link ? `<a class="btn btn-ghost btn-sm" href="${escapeHtmlText(note.link)}" target="_blank" rel="noopener">Open</a>` : ''}
          <button class="btn btn-primary btn-sm" onclick="summarizePinnedNews(${index})">Summarize</button>
          <button class="btn btn-ghost btn-sm" onclick="deletePinnedNews(${index})">Remove</button>
        </div>
      </div>
    `).join('') : '<div class="text-xs c3" style="margin-top:8px">ยังไม่มีโน้ตที่ปักหมุด</div>';
  }
}

function persistPinnedNewsNotes() {
  localStorage.setItem('mydash-news-notes', JSON.stringify(pinnedNewsNotes.slice(0, 80)));
  renderNewsSidePanel();
}

function pinNewsSource(index) {
  const item = newsLatestSources[index];
  if (!item) return;
  pinnedNewsNotes = [{
    title: item.title,
    source: item.source || 'Google News',
    link: item.link,
    pubDate: item.pubDate || '',
    snippet: item.snippet || '',
    createdAt: new Date().toLocaleString('th-TH'),
    note: ''
  }, ...pinnedNewsNotes.filter(note => note.link !== item.link)].slice(0, 80);
  persistPinnedNewsNotes();
  showToast('Pinned news note');
}

function saveManualNewsNote() {
  const input = document.getElementById('news-note-input');
  const note = input?.value?.trim();
  if (!note) return showToast('พิมพ์โน้ตก่อน', 'error');
  pinnedNewsNotes = [{
    title: note.slice(0, 80),
    source: 'Personal note',
    link: '',
    snippet: '',
    createdAt: new Date().toLocaleString('th-TH'),
    note
  }, ...pinnedNewsNotes].slice(0, 80);
  if (input) input.value = '';
  persistPinnedNewsNotes();
}

function deletePinnedNews(index) {
  pinnedNewsNotes.splice(index, 1);
  persistPinnedNewsNotes();
}

function clearPinnedNewsNotes() {
  if (!confirm('ลบ pinned notes ทั้งหมด?')) return;
  pinnedNewsNotes = [];
  persistPinnedNewsNotes();
}

async function summarizeNewsSource(index) {
  const item = newsLatestSources[index];
  if (!item) return;
  await summarizeNewsItem(item);
}

async function summarizePinnedNews(index) {
  const item = pinnedNewsNotes[index];
  if (!item) return;
  await summarizeNewsItem(item);
}

async function summarizeNewsItem(item) {
  try {
    const prompt = [
      'สรุปข่าวนี้ให้หน่อย',
      `หัวข้อ: ${item.title || '-'}`,
      `แหล่งข่าว: ${item.source || '-'}`,
      `วันที่: ${item.pubDate || '-'}`,
      `ลิงก์: ${item.link || '-'}`,
      `เนื้อหาย่อ: ${item.snippet || item.note || '-'}`
    ].join('\n');
    newsChatMessages.push({role:'user', content:`สรุปข่าวที่ปักไว้: ${item.title || item.note || 'note'}`});
    renderNewsChat();
    const data = await callNewsChat([
      {role:'system', content:'คุณคือผู้ช่วยสรุปข่าว ตอบภาษาไทยแบบกระชับ แยกเป็น: ประเด็นสำคัญ, ทำไมถึงสำคัญ, สิ่งที่ควรติดตามต่อ และข้อจำกัดของข้อมูล'},
      {role:'user', content: prompt}
    ]);
    const reply = data?.choices?.[0]?.message?.content || 'สรุปไม่สำเร็จ';
    newsChatMessages.push({role:'assistant', content:reply});
    renderNewsChat();
  } catch (error) {
    const msg = error.message || String(error);
    newsChatMessages.push({role:'assistant', content:`ขัดข้อง: ${msg}`});
    renderNewsChat();
    showToast(msg, 'error');
  }
}

function renderNewsChat() {
  const box = document.getElementById('news-chat');
  if (!box) return;
  box.style.display = 'block';
  if (!newsChatMessages.length) {
    box.innerHTML = '<div class="ai-msg system">เริ่มถามได้เลย ระบบจะจำบริบทระหว่างเปิดหน้านี้</div>';
    return;
  }
  box.innerHTML = newsChatMessages.map(msg => {
    const cls = msg.role === 'user' ? 'user' : 'assistant';
    return `<div class="ai-msg ${cls}">${mdToHtml(msg.content || '')}</div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
  renderNewsSidePanel();
}

function clearNewsChat() {
  newsChatMessages = [];
  newsLatestSources = [];
  const out = document.getElementById('news-output');
  if (out) { out.style.display = 'none'; out.innerHTML = ''; }
  renderNewsChat();
}

async function callNewsChat(messages, options={}) {
  const proxyUrl = (AppState.get('aiProxyUrl') || '').trim() || DEFAULT_AI_PROXY_URL;
  const model = AppState.get('deepseekModel') || 'deepseek-chat';
  const useSearch = options.useSearch !== false;
  const maxTokens = options.maxTokens || 4096;
  const temperature = options.temperature ?? 0.7;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);
  try {
    if (proxyUrl) {
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({model, messages, use_search: useSearch, max_tokens: maxTokens, temperature}),
        signal: controller.signal
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || errorData?.message || `Proxy Error: ${res.status}`);
      }
      return await res.json();
    }
    const key = AppState.get('deepseekKey');
    if (!key) {
      showToast('กรุณาตั้งค่า DeepSeek API Key หรือ AI Proxy URL ก่อน', 'error');
      showPage('settings');
      return null;
    }
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`},
      body: JSON.stringify({model, messages, stream: false, max_tokens: maxTokens, temperature}),
      signal: controller.signal
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `API Error: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function askNewsAI() {
  const input = document.getElementById('news-query');
  const q = input?.value?.trim();
  if (!q) { showToast('กรุณาพิมพ์คำถาม','error'); return; }
  if (input) input.value = '';
  newsChatMessages.push({role:'user', content:q});
  renderNewsChat();

  const btn = document.getElementById('btn-news');
  const oldHTML = btn?.innerHTML;
  if (btn) { btn.innerHTML = 'Thinking...'; btn.disabled = true; }
  const status = document.getElementById('news-ai-status');
  if (status) status.textContent = ((AppState.get('aiProxyUrl') || '').trim() || DEFAULT_AI_PROXY_URL)
    ? 'Proxy mode: searching recent news before answering'
    : 'Direct mode: no web/news search; answers may stop at model knowledge cutoff';

  try {
    const trimmed = newsChatMessages.slice(-12);
    const data = await callNewsChat([{role:'system', content:NEWS_SYSTEM_PROMPT}, ...trimmed]);
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) throw new Error('AI ไม่ส่งคำตอบกลับมา');
    newsLatestSources = Array.isArray(data?.search_results) ? data.search_results : [];
    newsChatMessages.push({role:'assistant', content:reply});
    renderNewsChat();
  } catch (error) {
    let msg = error.name === 'AbortError' ? 'การเชื่อมต่อหมดเวลา' : (error.message || String(error));
    if (/failed to fetch/i.test(msg)) {
      msg = 'เชื่อมต่อ AI Proxy ไม่ได้ ตรวจสอบ AI Proxy URL, CORS ของ Worker, หรืออินเทอร์เน็ต แล้วลองใหม่';
    }
    newsChatMessages.push({role:'assistant', content:`ขัดข้อง: ${msg}`});
    renderNewsChat();
    showToast(msg, 'error');
  } finally {
    if (btn) { btn.innerHTML = oldHTML; btn.disabled = false; }
  }
}

async function askDeepSeek(userPrompt, systemMsg='', btnId='', outId='') {
  if (!userPrompt?.trim()) {
    showToast('กรุณากรอกข้อความ', 'warning');
    return null;
  }
  const btn = btnId ? document.getElementById(btnId) : null;
  const out = outId ? document.getElementById(outId) : null;
  const oldHTML = btn?.innerHTML;
  if (btn) { btn.innerHTML = 'Thinking...'; btn.disabled = true; }
  if (out) {
    out.style.display = 'block';
    out.innerHTML = '<span style="opacity:.4;font-style:italic;font-size:12px">กำลังประมวลผล...</span>';
  }
  try {
    const data = await callNewsChat([
      {role:'system', content: systemMsg || 'คุณคือผู้ช่วยอัจฉริยะ ตอบเป็นภาษาไทย กระชับ ตรงประเด็น'},
      {role:'user', content: userPrompt.trim()}
    ]);
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) throw new Error('AI ไม่ส่งคำตอบกลับมา');
    if (out) out.innerHTML = mdToHtml(reply);
    return reply;
  } catch (error) {
    const msg = error.name === 'AbortError' ? 'การเชื่อมต่อหมดเวลา' : (error.message || String(error));
    if (out) out.innerHTML = `<span style="color:var(--red)">⚠️ ${msg}</span>`;
    else showToast(`AI Error: ${msg}`, 'error');
    return null;
  } finally {
    if (btn) { btn.innerHTML = oldHTML; btn.disabled = false; }
  }
}
