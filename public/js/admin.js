// Teacher Control Room
const A = { token: localStorage.getItem('lc_teacher') || '', cfg: null, defaults: null, tab: 'students', dirty: false };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const main = $('#adm');
const EVENT_LABELS = {
  crewOutcome: 'Crew selection outcome', logBison: 'Animal log: Bison', floyd: 'Sergeant Floyd\u2019s illness',
  logGrizzly: 'Animal log: Grizzly + charge', fork: 'Fork of the Missouri', fastRiver: 'Fast river / waterfall', logRattlesnake: 'Animal log: Rattlesnake',
  sacagaweaIll: 'Sacagawea\u2019s illness', logElk: 'Animal log: Elk', shoshone: 'Shoshone summit + Bitterroot',
  rapids: 'Columbia River rapids', logEagle: 'Animal log: Bald Eagle', pacific: 'Pacific Ocean + crew vote'
};

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, { method, headers: { 'content-type': 'application/json', ...(A.token ? { authorization: 'Bearer ' + A.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = {}; try { data = await res.json(); } catch { }
  if (res.status === 401 && path !== '/admin/login') { logout(); throw new Error('Session expired. Log in again.'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function toast(msg) {
  let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.remove('hidden'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hidden'), 3000);
}
function modal(inner) {
  const w = document.createElement('div'); w.className = 'modal-wrap';
  w.innerHTML = `<div class="modal"><div class="frame">${inner}</div></div>`;
  $('#modal-root').appendChild(w);
  w.addEventListener('click', e => { if (e.target === w) w.remove(); });
  return { el: w, close: () => w.remove() };
}
function logout() { A.token = ''; localStorage.removeItem('lc_teacher'); viewLogin(); }
$('#to-game').onclick = () => { location.href = '/'; };
$('#logout').onclick = logout;

function viewLogin(err = '') {
  $('#logout').classList.add('hidden');
  main.innerHTML = `<section class="frame" style="max-width:480px;margin:2rem auto"><h1>Teacher log in</h1>
    <form id="lf"><label class="field">Teacher password<input type="password" name="password" required autocomplete="current-password"></label>
    <p class="err">${esc(err)}</p><button class="btn river big full">Log in</button></form>
    <p class="small muted">The password is the <b>TEACHER_PASSWORD</b> value set in your Cloudflare Pages project.</p></section>`;
  $('#lf').onsubmit = async (e) => {
    e.preventDefault();
    try { const r = await api('/admin/login', { method: 'POST', body: { password: new FormData(e.target).get('password') } }); A.token = r.token; localStorage.setItem('lc_teacher', r.token); start(); }
    catch (er) { viewLogin(er.message); }
  };
}

async function start() {
  if (!A.token) return viewLogin();
  try { const r = await api('/admin/config'); A.cfg = r.config; A.defaults = r.defaults; }
  catch (e) { return viewLogin(e.message); }
  $('#logout').classList.remove('hidden');
  render();
}
const TABS = { students: 'Students', levels: 'Levels & codes', travel: 'Travel & crews', outposts: 'Outpost prices', encounters: 'Encounters & skills', scoring: 'Scoring, hunting & foraging', quiz: 'Quiz questions' };
function render() {
  main.innerHTML = `<div class="adm-tabs">${Object.entries(TABS).map(([k, v]) => `<button data-t="${k}" class="${A.tab === k ? 'on' : ''}">${v}</button>`).join('')}</div><div id="tab"></div>`;
  $$('.adm-tabs button').forEach(b => b.onclick = () => { if (A.tab !== 'students') collect(); A.tab = b.dataset.t; render(); });
  if (A.tab === 'students') return viewStudents();
  const t = $('#tab');
  t.innerHTML = `<section class="frame">${({ levels: tabLevels, travel: tabTravel, outposts: tabOutposts, encounters: tabEncounters, scoring: tabScoring, quiz: tabQuiz })[A.tab]()}
    <div class="savebar"><button class="btn moss big" id="save">Save settings</button><button class="btn ghost" id="reset">Reset everything to defaults</button><span id="dirty"></span></div></section>`;
  $('#save').onclick = saveCfg;
  $('#reset').onclick = async () => {
    if (!confirm('Reset ALL game settings (codes, prices, rates, quiz) to the original defaults?')) return;
    const r = await api('/admin/config/reset', { method: 'POST' }); A.cfg = r.config; toast('Settings reset to defaults.'); render();
  };
  t.addEventListener('input', () => { A.dirty = true; $('#dirty').textContent = 'Unsaved changes'; });
  bindQuiz();
}

// ---------- generic fields ----------
const get = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), A.cfg);
function set(path, val) { const ks = path.split('.'); let o = A.cfg; ks.slice(0, -1).forEach(k => { o = o[k]; }); o[ks[ks.length - 1]] = val; }
function f(path, label, type = 'number', help = '') {
  const v = get(path);
  let input;
  if (type === 'bool') input = `<input type="checkbox" data-p="${path}" data-type="bool" ${v ? 'checked' : ''} style="width:auto;display:inline-block;margin-right:.4rem">`;
  else if (type === 'textarea') input = `<textarea class="inp" data-p="${path}" data-type="text">${esc(v)}</textarea>`;
  else if (type === 'list') input = `<input class="inp" data-p="${path}" data-type="list" value="${esc((v || []).join(', '))}">`;
  else input = `<input class="inp" ${type === 'number' ? 'type="number" step="any"' : ''} data-p="${path}" data-type="${type}" value="${esc(v)}">`;
  return type === 'bool' ? `<label class="field">${input}${esc(label)}${help ? `<div class="help">${esc(help)}</div>` : ''}</label>`
    : `<label class="field">${esc(label)}${input}${help ? `<div class="help">${esc(help)}</div>` : ''}</label>`;
}
function collect() {
  $$('[data-p]').forEach(el => {
    const t = el.dataset.type; let v;
    if (t === 'bool') v = el.checked;
    else if (t === 'number') v = el.value === '' ? 0 : Number(el.value);
    else if (t === 'list') v = el.value.split(',').map(x => x.trim()).filter(Boolean).map(x => (isNaN(Number(x)) ? x : Number(x)));
    else v = el.value;
    set(el.dataset.p, v);
  });
}
async function saveCfg() {
  collect();
  try { const r = await api('/admin/config', { method: 'PUT', body: { config: A.cfg } }); A.cfg = r.config; A.dirty = false; toast('Settings saved. Students get them the next time they load the game.'); render(); }
  catch (e) { toast(e.message); }
}

// ---------- tabs ----------
function tabLevels() {
  return `<h2>Levels &amp; codes</h2><p class="muted">Set the code students type to unlock each level, or open the gate so no code is needed. Event miles control where each story moment happens.</p>
  ${A.cfg.levels.map((L, i) => `<fieldset><legend>Level ${L.num}: ${esc(L.name)}</legend><div class="fgrid">
    ${f(`levels.${i}.name`, 'Level name', 'text')}${f(`levels.${i}.start`, 'Starting location', 'text')}
    ${f(`levels.${i}.password`, 'Level code', 'text')}${f(`levels.${i}.gateOpen`, 'Gate open (no code needed)', 'bool')}
    ${f(`levels.${i}.maxDays`, 'Maximum travel days')}${f(`levels.${i}.miles`, 'Level distance (miles)')}
    ${f(`levels.${i}.encounterMiles`, 'Random encounter miles', 'list', 'Comma separated, e.g. 50, 750')}
    ${f(`levels.${i}.modes`, 'Travel modes offered at start', 'list', 'foot, canoe, horse')}
    ${Object.keys(L.events).map(k => f(`levels.${i}.events.${k}`, `${EVENT_LABELS[k] || k}: mile`)).join('')}
  </div>${f(`levels.${i}.intro`, 'Starting location description', 'textarea')}${f(`levels.${i}.rumors`, 'Rumors / level instructions (shown on the level info page)', 'textarea')}</fieldset>`).join('')}
  <fieldset><legend>Game-wide</legend><div class="fgrid">
    ${f('game.startingGrant', 'Starting Congressional grant ($)')}${f('game.secondsPerDay', 'Real seconds per travel day')}
    ${f('game.daysPerRation', 'Travel days per food + water')}${f('game.earlyDaysPerPoint', 'Unused days per +1 approval')}
    ${f('game.deathPenalty', 'Approval lost per death')}${f('game.startingParty', 'Starting party (the captains)')}
  </div></fieldset>`;
}
function tabTravel() {
  const t = 'travel';
  return `<h2>Travel &amp; crews</h2>
  <fieldset><legend>Travel modes</legend><div class="fgrid">
    ${['foot', 'canoe', 'horse'].map(m => f(`${t}.${m}.speed`, `${A.cfg.travel[m].label}: miles/day`) + f(`${t}.${m}.drain`, `${A.cfg.travel[m].label}: energy lost/day`)).join('')}
    ${f('travel.noGearDrainMult', 'Energy multiplier without travel gear')}
    ${f('travel.campDays', 'Make camp: days used')}${f('travel.campEnergy', 'Make camp: energy restored')}${f('travel.restDays', 'Full rest: days used')}
    ${f('travel.blisterChance', 'Blister chance per day on foot (%)')}${f('travel.rapidsChance', 'Rapids chance per day by canoe (%)')}
    ${f('travel.southRouteDrain', 'L3 Southern Desert Route energy/day', 'number', 'Set high so it cannot be finished')}
    ${f('travel.northPassDrain', 'L3 Northern Pass energy/day', 'number', 'Exhaustion here triggers the Nez Perce rescue')}
    ${f('travel.level4FootDrain', 'L4 hiking energy/day', 'number', 'Set high so hiking from Nez Perce fails')}
  </div></fieldset>
  ${Object.entries(A.cfg.crews).map(([id, c]) => `<fieldset><legend>Crew: ${esc(c.name)}</legend><div class="fgrid">
    ${f(`crews.${id}.name`, 'Name', 'text')}${f(`crews.${id}.cost`, 'Cost ($)')}${f(`crews.${id}.size`, 'Adds to party')}
    ${f(`crews.${id}.drainMult`, 'Energy drain multiplier')}${f(`crews.${id}.footSpeed`, 'Miles/day on foot')}${f(`crews.${id}.canoeSpeed`, 'Miles/day by canoe')}
  </div>${f(`crews.${id}.desc`, 'Description students see', 'textarea')}</fieldset>`).join('')}`;
}
function tabOutposts() {
  return `<h2>Outpost prices</h2><p class="muted">Change what each outpost charges and pays.</p>
  ${Object.entries(A.cfg.outposts).map(([id, o]) => `<fieldset><legend>${esc(o.name)}</legend><div class="fgrid">
    ${f(`outposts.${id}.food`, 'Food per ration ($)')}${f(`outposts.${id}.water`, 'Water per jug ($)')}${f(`outposts.${id}.ammo`, 'Ammunition per shot ($)')}</div>
    <h4>For sale</h4>${o.buy.map((b, i) => `<div class="fgrid">${f(`outposts.${id}.buy.${i}.name`, 'Item', 'text')}${f(`outposts.${id}.buy.${i}.price`, 'Price ($)')}${f(`outposts.${id}.buy.${i}.qty`, 'Quantity per purchase')}${f(`outposts.${id}.buy.${i}.desc`, 'Description', 'text')}</div>`).join('')}
    <h4>Outpost buys</h4><div class="fgrid">${o.sell.map((s, i) => f(`outposts.${id}.sell.${i}.price`, `${s.name} ($)`)).join('')}</div></fieldset>`).join('')}
  <fieldset><legend>Haggling</legend><div class="fgrid">${f('haggle.chance', 'Success chance (%)')}${f('haggle.discount', 'Discount on success (%)')}${f('haggle.markup', 'Markup on failure (%)')}${f('haggle.skilledChance', 'With barter skill: chance (%)')}${f('haggle.skilledDiscount', 'With barter skill: discount (%)')}</div></fieldset>`;
}
function tabEncounters() {
  return `<h2>Encounters &amp; skills</h2><p class="muted">Rate is how often an encounter is chosen compared with the others. Success tiles is how many of the 10 tiles are good (10 = always succeeds).</p>
  <fieldset><legend>Trail encounters</legend>${A.cfg.encounters.map((e, i) => `<div class="fgrid">${f(`encounters.${i}.name`, 'Encounter', 'text')}${f(`encounters.${i}.rate`, 'Rate')}${f(`encounters.${i}.success`, 'Success tiles (of 10)')}</div>`).join('')}</fieldset>
  <fieldset><legend>Scout Academy</legend>${Object.entries(A.cfg.skills).map(([id, s]) => `<div class="fgrid">${f(`skills.${id}.name`, 'Skill', 'text')}${f(`skills.${id}.cost`, 'Cost ($)')}${id === 'mapping' ? f('skills.mapping.tierCost', 'Extra cost per tier ($)') : ''}</div>`).join('')}</fieldset>`;
}
function tabScoring() {
  const s = 'scoring';
  return `<h2>Scoring, hunting &amp; foraging</h2>
  <fieldset><legend>Jefferson\u2019s approval</legend><div class="fgrid">
    ${f(`${s}.journal`, 'Journal points (all 5 animals)')}${f(`${s}.mapping`, 'Mapping points (all 8 landmarks)')}${f(`${s}.diplomacy`, 'Diplomacy points (4 achievements)')}${f(`${s}.survival`, 'Survival bonus (max)')}
    ${f(`${s}.funeral`, 'Floyd funeral')}${f(`${s}.sacagaweaHealed`, 'Sacagawea healed')}${f(`${s}.vote`, 'Democratic vote')}${f(`${s}.noVote`, 'No vote (use a negative)')}${f(`${s}.trappersShare`, 'Shared with stranded trappers')}${f(`${s}.recruit`, 'Each interpreter recruited')}
  </div></fieldset>
  <fieldset><legend>Hunting</legend><div class="fgrid">
    ${f('hunting.animalsByHunt', 'Animals hidden on hunt 1, 2, 3+', 'list')}${f('hunting.shots', 'Shots per hunt')}${f('hunting.days', 'Days per hunt on the trail')}
    ${Object.keys(A.cfg.hunting.rations).map(k => f(`hunting.rations.${k}`, `Food from a ${k}`)).join('')}</div></fieldset>
  <fieldset><legend>Foraging</legend><div class="fgrid">
    ${A.cfg.foraging.layouts.map((l, i) => f(`foraging.layouts.${i}.good`, `Forage ${i + 1}: good pairs`) + f(`foraging.layouts.${i}.bad`, `Forage ${i + 1}: bad pairs`)).join('')}
    ${f('foraging.choices', 'Choices per forage')}${f('foraging.sacagaweaBonus', 'Extra choices with Sacagawea')}${f('foraging.energyLoss', 'Energy lost to poison (%)')}${f('foraging.days', 'Days per forage on the trail')}</div></fieldset>`;
}
function tabQuiz() {
  return `<h2>Quiz questions</h2><p class="muted">Students must answer questions in a row to open an outpost market (Level 1: 1 in a row, Level 2: 2, and so on). Mark the correct answer.</p>
  <div id="quiz">${A.cfg.quiz.map((q, i) => `<div class="qitem"><div class="row"><b>Question ${i + 1}</b><span class="spacer"></span><button class="btn ghost" data-del="${i}">Delete</button></div>
    <input class="inp" data-p="quiz.${i}.q" data-type="text" value="${esc(q.q)}" style="width:100%;margin-top:.3rem" aria-label="Question ${i + 1}">
    <div class="ans">${[0, 1, 2, 3].map(j => `<input type="radio" name="c${i}" data-c="${i}" value="${j}" ${Number(q.c) === j ? 'checked' : ''} aria-label="Correct answer ${j + 1}"><input class="inp" data-p="quiz.${i}.a.${j}" data-type="text" value="${esc(q.a[j] || '')}" placeholder="Answer ${j + 1}">`).join('')}</div></div>`).join('')}</div>
  <button class="btn river" id="addq">Add a question</button>`;
}
function bindQuiz() {
  if (A.tab !== 'quiz') return;
  A.cfg.quiz.forEach(q => { while (q.a.length < 4) q.a.push(''); });
  $$('[data-c]').forEach(r => r.onchange = () => { A.cfg.quiz[Number(r.dataset.c)].c = Number(r.value); });
  $$('[data-del]').forEach(b => b.onclick = () => { collect(); A.cfg.quiz.splice(Number(b.dataset.del), 1); render(); });
  $('#addq').onclick = () => { collect(); A.cfg.quiz.push({ q: 'New question', a: ['', '', '', ''], c: 0 }); render(); };
  const orig = saveCfg;
  $('#save').onclick = async () => { collect(); A.cfg.quiz = A.cfg.quiz.map(q => ({ ...q, a: q.a.filter(x => String(x).trim()) })).filter(q => q.q && q.a.length >= 2); await orig(); };
}

// ---------- students ----------
async function viewStudents() {
  const t = $('#tab');
  t.innerHTML = `<section class="frame"><div class="row"><h2 style="margin:0">Student roster</h2><span class="spacer"></span><button class="btn" id="refresh">Refresh</button><button class="btn river" id="add">Add student</button></div>
    <p class="muted">Approval is President Jefferson\u2019s score. Use Adjust to award journal or map points, give extra money or days, or leave a note the student will see.</p>
    <div class="tbl-wrap" id="roster">Loading\u2026</div></section>`;
  $('#refresh').onclick = viewStudents;
  $('#add').onclick = addStudent;
  try {
    const { rows } = await api('/admin/students');
    $('#roster').innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>Explorer</th><th>Partner</th><th>Level</th><th>Status</th><th>Day</th><th>Miles</th><th>Party</th><th>Funds</th><th>Approval</th><th>Actions</th></tr></thead><tbody>
      ${rows.map(s => `<tr><td><b>${esc(s.username)}</b></td><td>${esc(s.partner)}</td><td>${s.finished ? 'Done' : s.level}</td><td>${esc(s.phase || 'not started')}</td><td>${s.days}</td><td>${s.miles}</td><td>${s.party}</td><td>$${Number(s.money).toFixed(2)}</td><td><b>${s.approval}</b></td>
      <td class="row" style="flex-wrap:nowrap"><button class="btn ghost" data-a="view" data-id="${s.id}">View</button><button class="btn" data-a="adjust" data-id="${s.id}">Adjust</button><button class="btn ghost" data-a="more" data-id="${s.id}" data-n="${esc(s.username)}">More</button></td></tr>`).join('')}
      </tbody></table>` : '<p style="padding:1rem">No students yet. Students create their own explorer on the game page, or you can add them here.</p>';
    $$('[data-a]').forEach(b => b.onclick = () => ({ view: viewStudent, adjust: adjustStudent, more: moreStudent })[b.dataset.a](Number(b.dataset.id), b.dataset.n));
  } catch (e) { $('#roster').textContent = e.message; }
}
function addStudent() {
  const m = modal(`<h2>Add a student</h2><form id="af"><label class="field">Explorer name<input name="username" required></label><label class="field">Password<input name="password" required></label><label class="field">Partner (optional)<input name="partner"></label><p class="err" id="ae"></p><div class="row"><button class="btn river">Add</button><button type="button" class="btn ghost" id="ac">Cancel</button></div></form>`);
  $('#ac', m.el).onclick = m.close;
  $('#af', m.el).onsubmit = async (e) => { e.preventDefault(); try { await api('/admin/students', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); m.close(); toast('Student added.'); viewStudents(); } catch (er) { $('#ae', m.el).textContent = er.message; } };
}
async function viewStudent(id) {
  const { student, state: s } = await api('/admin/students/' + id);
  if (!s || !s.pts) { modal(`<h2>${esc(student.username)}</h2><p>This student has not started the game yet.</p>`); return; }
  const list = (o) => Object.keys(o || {}).join(', ') || 'none';
  modal(`<h2>${esc(student.username)}${student.partner ? ' &amp; ' + esc(student.partner) : ''}</h2>
    <div class="photo-scene"><div><table class="tbl"><tbody>
      <tr><td>Level</td><td>${s.level} (${esc(s.phase)})</td></tr><tr><td>Day</td><td>${s.run ? `${s.run.days} / ${s.run.maxDays}` : '-'}</td></tr>
      <tr><td>Miles</td><td>${s.run ? Math.round(s.run.miles) : '-'}</td></tr><tr><td>Energy</td><td>${s.run ? Math.round(s.run.energy) + '%' : '-'}</td></tr>
      <tr><td>Party</td><td>${s.party} (peak ${s.peakParty})</td></tr><tr><td>Crew</td><td>${esc(s.crew || 'none')}</td></tr>
      <tr><td>Guides</td><td>${esc(Object.keys(s.comp || {}).filter(k => s.comp[k]).join(', ') || 'none')}</td></tr>
      <tr><td>Funds</td><td>$${Number(s.money).toFixed(2)}</td></tr>
      <tr><td>Inventory</td><td class="small">${esc(Object.entries(s.inv || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', '))}</td></tr>
    </tbody></table></div><div><table class="tbl"><tbody>
      ${Object.entries(s.pts).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${Math.round(v * 10) / 10}</td></tr>`).join('')}
      <tr><td>Animals</td><td class="small">${esc(list(s.logs?.animals))}</td></tr><tr><td>Landmarks</td><td class="small">${esc(list(s.logs?.landmarks))}</td></tr>
    </tbody></table>${s.run?.log?.length ? `<h4 style="margin-top:.8rem">Recent trail log</h4><div class="travel-log">${s.run.log.slice(0, 15).map(l => `<div>${esc(l)}</div>`).join('')}</div>` : ''}</div></div>`);
}
function adjustStudent(id) {
  const m = modal(`<h2>Adjust explorer</h2><p class="muted">Enter positive or negative amounts. Leave blank for no change.</p><form id="jf"><div class="fgrid">
    <label class="field">Approval points<input class="inp" type="number" step="any" name="points"></label>
    <label class="field">Money ($)<input class="inp" type="number" step="any" name="money"></label>
    <label class="field">Extra days on this level<input class="inp" type="number" name="days"></label>
    <label class="field">Food<input class="inp" type="number" name="food"></label>
    <label class="field">Water<input class="inp" type="number" name="water"></label>
    <label class="field">Energy<input class="inp" type="number" name="energy"></label></div>
    <label class="field">Note to the student (shown at their starting location)<input class="inp" name="note" maxlength="200"></label>
    <p class="err" id="je"></p><div class="row"><button class="btn moss">Apply</button><button type="button" class="btn ghost" id="jc">Cancel</button></div></form>`);
  $('#jc', m.el).onclick = m.close;
  $('#jf', m.el).onsubmit = async (e) => { e.preventDefault(); try { await api(`/admin/students/${id}/adjust`, { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); m.close(); toast('Explorer updated.'); viewStudents(); } catch (er) { $('#je', m.el).textContent = er.message; } };
}
function moreStudent(id, name) {
  const m = modal(`<h2>${esc(name)}</h2>
    <div class="choices">
      <button class="btn" data-x="level">Restart their current level</button>
      <div class="row"><select class="inp" id="jl" style="width:auto">${[1, 2, 3, 4].map(n => `<option>${n}</option>`).join('')}</select><button class="btn" data-x="jump">Move them to the start of this level</button></div>
      <div class="row"><input class="inp" id="np" placeholder="New password" style="width:auto"><button class="btn" data-x="pw">Reset password</button></div>
      <button class="btn danger" data-x="all">Erase all progress (start over)</button>
      <button class="btn danger" data-x="del">Delete this explorer</button>
      <button class="btn ghost" data-x="close">Close</button></div><p class="err" id="me"></p>`);
  m.el.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
    const x = b.dataset.x;
    try {
      if (x === 'close') return m.close();
      if (x === 'level') await api(`/admin/students/${id}/reset`, { method: 'POST', body: { scope: 'level' } });
      if (x === 'jump') await api(`/admin/students/${id}/reset`, { method: 'POST', body: { scope: 'jump', level: Number($('#jl', m.el).value) } });
      if (x === 'pw') await api(`/admin/students/${id}/password`, { method: 'POST', body: { password: $('#np', m.el).value } });
      if (x === 'all') { if (!confirm(`Erase all of ${name}'s progress?`)) return; await api(`/admin/students/${id}/reset`, { method: 'POST', body: { scope: 'all' } }); }
      if (x === 'del') { if (!confirm(`Delete ${name} permanently?`)) return; await api(`/admin/students/${id}`, { method: 'DELETE' }); }
      m.close(); toast('Done.'); viewStudents();
    } catch (e) { $('#me', m.el).textContent = e.message; }
  });
}

window.addEventListener('beforeunload', (e) => { if (A.dirty) { e.preventDefault(); e.returnValue = ''; } });
start();
