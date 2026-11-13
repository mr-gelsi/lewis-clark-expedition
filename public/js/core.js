// Shared state, API access, saving, scoring and scene (modal) helpers.
export const S = { token: localStorage.getItem('lc_token') || '', me: null, cfg: null, st: null, rev: 0, timer: null };
export const G = {}; // screen hooks registered by app.js (render, perish, ...)

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const rand = (n) => Math.floor(Math.random() * n);
export const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const money = (n) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method, headers: { 'content-type': 'application/json', ...(S.token ? { authorization: 'Bearer ' + S.token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch { data = { error: 'The server sent an unreadable reply.' }; }
  if (res.status === 401 && path !== '/login' && path !== '/admin/login') { G.logout && G.logout(true); }
  if (!res.ok && res.status !== 409) throw new Error(data.error || 'Request failed (' + res.status + ')');
  data.__status = res.status;
  return data;
}

// ---------- saving ----------
let saveTimer = null, saving = false, again = false;
export function save(now = false) {
  if (!S.st) return;
  clearTimeout(saveTimer);
  if (now) return doSave();
  saveTimer = setTimeout(doSave, 900);
}
async function doSave() {
  if (saving) { again = true; return; }
  saving = true;
  try {
    const r = await api('/state', { method: 'PUT', body: { state: S.st, rev: S.rev } });
    if (r.__status === 409) {
      G.stopTravel && G.stopTravel();
      S.st = r.state; S.rev = r.rev;
      toast('Your teacher updated your expedition. Loading the new version.');
      G.render && G.render();
    } else S.rev = r.rev;
  } catch (e) { toast('Could not save: ' + e.message); }
  saving = false;
  if (again) { again = false; doSave(); }
}

// ---------- scoring ----------
export const PT_KEYS = ['journal', 'mapping', 'diplomacy', 'survival', 'time', 'bonus', 'deaths', 'teacher'];
export function approval(st = S.st) {
  if (!st || !st.pts) return 0;
  return Math.round(PT_KEYS.reduce((t, k) => t + (Number(st.pts[k]) || 0), 0) * 10) / 10;
}
export function addPts(cat, n, reason) {
  if (!n) return;
  S.st.pts[cat] = Math.round(((S.st.pts[cat] || 0) + n) * 100) / 100;
  if (reason) toast(`${n > 0 ? '+' : ''}${Math.round(n * 10) / 10} Jefferson approval: ${reason}`);
  G.topbar && G.topbar();
}
export const ANIMALS = { bison: 'Bison', grizzly: 'Grizzly Bear', rattlesnake: 'Rattlesnake', elk: 'Elk', eagle: 'Bald Eagle' };
export const LANDMARKS = {
  campWood: 'Camp Wood', floydGrave: 'Floyd\u2019s Grave', fortMandan: 'Fort Mandan', missouriFork: 'Missouri Fork',
  greatFalls: 'Great Falls', shoshoneCamp: 'Shoshone Camp', nezPerce: 'Nez Perce Camp', fortClatsop: 'Fort Clatsop'
};
export const DIPLOMACY = { sacagawea: 'Treated Sacagawea\u2019s illness', toby: 'Hired guide Toby', summit: 'Traded respectfully with the Shoshone', vote: 'Held the democratic crew vote' };
export function grantDiplomacy(key) {
  if (S.st.dip[key]) return;
  S.st.dip[key] = true;
  addPts('diplomacy', S.cfg.scoring.diplomacy / Object.keys(DIPLOMACY).length, DIPLOMACY[key]);
}

// ---------- level helpers ----------
export const lvl = () => S.cfg.levels[S.st.level - 1];
export const crew = () => S.cfg.crews[S.st.crew] || null;
export const outpostCfg = (id) => S.cfg.outposts[id];

// ---------- toast ----------
let toastTimer;
export function toast(msg) {
  let el = $('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

// ---------- modal + scenes ----------
export function openModal(inner, { closable = false, onClose } = {}) {
  const root = $('#modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${inner}</div>`;
  root.appendChild(wrap);
  const close = () => { wrap.remove(); onClose && onClose(); };
  if (closable) {
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    const key = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', key); } };
    document.addEventListener('keydown', key);
  }
  const first = wrap.querySelector('button, input, select');
  if (first) setTimeout(() => first.focus(), 30);
  wrap.scrollTop = 0;
  return { el: wrap, close };
}
export function closeAllModals() { $('#modal-root').innerHTML = ''; }

// Journal background images have a blank pinned note to write on.
const JOURNAL = new Set(['basecamp', 'blisters', 'blizzard', 'freshwater-stream', 'frostbite', 'fur-traders', 'heatwave', 'native-encounter', 'rapids-event']);
const isJournal = (img) => img && JOURNAL.has(img.replace(/^.*\//, '').replace(/\.\w+$/, ''));

function choiceButtons(choices) {
  return choices.map((c, i) => `<button class="btn ${c.cls || ''}" data-i="${i}" ${c.disabled ? 'disabled' : ''}>${esc(c.label)}</button>`
    + (c.note ? `<div class="small muted">${esc(c.note)}</div>` : '')).join('');
}
/** Show a story scene and resolve with the chosen value. */
export function scene({ img, title, text = '', html = '', choices = [{ label: 'Continue journey', value: true }], epic = false }) {
  return new Promise((resolve) => {
    const body = (text ? text.split('\n\n').map(p => `<p>${esc(p)}</p>`).join('') : '') + html;
    let inner;
    if (isJournal(img)) {
      inner = `<div class="journal"><img src="/img/${img}" alt="">
        <div class="note"><h3>${esc(title)}</h3>${body}</div>
        <div class="page">${choiceButtons(choices)}</div></div>`;
    } else if (epic) {
      inner = `<div class="frame epic"><h1>${esc(title)}</h1>${img ? `<div class="ph"><img src="/img/${img}" alt=""></div>` : ''}
        <div style="max-width:720px;margin:0 auto">${body}</div><div class="choices" style="max-width:520px;margin:1rem auto 0">${choiceButtons(choices)}</div></div>`;
    } else {
      inner = `<div class="frame"><div class="${img ? 'photo-scene' : ''}">
        ${img ? `<div class="ph"><img src="/img/${img}" alt=""></div>` : ''}
        <div><h2>${esc(title)}</h2>${body}<div class="choices">${choiceButtons(choices)}</div></div></div></div>`;
    }
    const m = openModal(inner);
    m.el.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => {
      m.close(); resolve(choices[Number(b.dataset.i)].value);
    }));
  });
}

/** A field-journal or map logging page with a confirmation checkbox. */
export function logScene({ type, key, img, title, text }) {
  return new Promise((resolve) => {
    const what = type === 'animal' ? 'We drew this animal in our field journal and wrote a short description.'
      : type === 'map' ? 'We marked this place and our route on our expedition map.'
        : 'We wrote this in our field journal.';
    const inner = `<div class="frame"><div class="photo-scene">
      <div class="ph"><img src="/img/${img}" alt="${esc(title)}"></div>
      <div><h2>${esc(title)}</h2>${text.split('\n\n').map(p => `<p>${esc(p)}</p>`).join('')}
        <label class="check-line"><input type="checkbox" id="logck"> <span>${what}</span></label>
        <button class="btn moss big full" id="logbtn" disabled>${type === 'map' ? 'Logged on map and continue' : 'Logged and continue on journey'}</button>
      </div></div></div>`;
    const m = openModal(inner);
    const ck = m.el.querySelector('#logck'), btn = m.el.querySelector('#logbtn');
    ck.addEventListener('change', () => { btn.disabled = !ck.checked; });
    btn.addEventListener('click', () => {
      m.close();
      const st = S.st;
      if (type === 'animal' && !st.logs.animals[key]) {
        st.logs.animals[key] = true;
        addPts('journal', S.cfg.scoring.journal / Object.keys(ANIMALS).length, `${ANIMALS[key]} logged`);
      } else if (type === 'map' && !st.logs.landmarks[key]) {
        st.logs.landmarks[key] = true;
        const extra = st.inv.survey > 0 ? 1 : 0;
        addPts('mapping', S.cfg.scoring.mapping / Object.keys(LANDMARKS).length + extra, `${LANDMARKS[key]} mapped`);
      } else if (type === 'note') st.logs.notes[key] = true;
      save();
      resolve(true);
    });
  });
}
