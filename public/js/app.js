import { S, G, esc, $, $$, api, save, approval, addPts, toast, openModal, closeAllModals, scene, logScene, clone, clamp, money, lvl, crew, outpostCfg, ANIMALS, LANDMARKS, DIPLOMACY, PT_KEYS } from './core.js';
import { STORY, encounter, modeHazard, advanceDays, consumeDay, killMembers, speed, drain, doHunt, doForage, logLine, PERISH_TEXT, checkDays } from './events.js';
import { quizGame } from './games.js';

const app = $('#app'), top = $('#topbar');

// ================= boot & auth =================
async function boot() {
  if (!S.token) return viewHome();
  try {
    const r = await api('/me');
    S.me = r.student; S.cfg = r.config; S.rev = r.rev;
    S.st = r.state && r.state.v ? r.state : newState();
    if (!r.state || !r.state.v) save(true);
    if (S.st.run && S.st.phase === 'travel') S.st.run.paused = true;
    render();
  } catch (e) { viewHome(e.message); }
}
G.logout = async (silent) => {
  stopTravel();
  try { if (!silent && S.token) await api('/logout', { method: 'POST' }); } catch { }
  localStorage.removeItem('lc_token'); S.token = ''; S.st = null; S.me = null;
  closeAllModals(); viewHome(silent ? 'Please log in again.' : '');
};
function newState() {
  return {
    v: 1, level: 1, phase: 'gate', finished: false,
    pts: Object.fromEntries(PT_KEYS.map(k => [k, 0])),
    logs: { animals: {}, landmarks: {}, notes: {} }, dip: {},
    party: S.cfg.game.startingParty, peakParty: S.cfg.game.startingParty, money: 0, gotGrant: false,
    inv: { food: 0, water: 0, ammo: 0, medkit: 0, gifts: 0, gear: 0, survey: 0, tools: 0, fur: 0, horses: 0, canoes: 0, moccasins: 0, crafts: 0, minerals: 0, kettle: 0, buttons: 0 },
    skills: { mapping: 0 }, crew: null, comp: {}, results: {}, run: null, snap: null
  };
}

function viewHome(err = '') {
  top.classList.add('hidden');
  app.innerHTML = `
    <div class="home-hero"><img src="/img/cover.jpg" alt="The Lewis and Clark Expedition: A Corps of Discovery Survival Simulation"></div>
    <div class="home-grid">
      <section class="frame">
        <h2>Your orders from the President</h2>
        <p>It is 1804. The United States has just bought the Louisiana Territory from France, and nobody knows what is out there. President Thomas Jefferson has chosen you to lead the Corps of Discovery from Camp Wood to the Pacific Ocean.</p>
        <p>Search for a Northwest Passage. Record the plants, animals and peoples you meet in your field journal. Keep your crew alive, spend the Congressional grant wisely and treat the nations you meet with respect. Every choice raises or lowers President Jefferson\u2019s approval.</p>
        <div class="river-box"><h4>Before you start</h4><p>Have your paper field journal and your expedition map ready. The game will tell you when to draw an animal or mark a landmark.</p></div>
      </section>
      <section class="frame">
        <div class="auth-tabs" role="tablist"><button class="on" data-t="login" role="tab">Log in</button><button data-t="register" role="tab">New explorer</button></div>
        <form id="auth">
          <label class="field">Explorer name<input name="username" autocomplete="username" required maxlength="30"></label>
          <label class="field">Password<input name="password" type="password" autocomplete="current-password" required></label>
          <label class="field reg hidden">Partner\u2019s name (optional)<input name="partner" maxlength="40" placeholder="Leave blank if you are playing alone"></label>
          <p class="err" id="auth-err">${esc(err)}</p>
          <button class="btn river big full" id="auth-go">Log in</button>
        </form>
        <p class="small muted center" style="margin-top:1rem">Teacher? <a href="/admin.html">Open the teacher page</a></p>
      </section>
    </div>`;
  let mode = 'login';
  $$('.auth-tabs button').forEach(b => b.addEventListener('click', () => {
    mode = b.dataset.t; $$('.auth-tabs button').forEach(x => x.classList.toggle('on', x === b));
    $('.reg').classList.toggle('hidden', mode !== 'register');
    $('#auth-go').textContent = mode === 'login' ? 'Log in' : 'Create explorer';
    $('[name=password]').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  }));
  $('#auth').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    $('#auth-err').textContent = '';
    try {
      const r = await api(mode === 'login' ? '/login' : '/register', { method: 'POST', body: Object.fromEntries(f) });
      S.token = r.token; localStorage.setItem('lc_token', r.token); boot();
    } catch (err) { $('#auth-err').textContent = err.message; }
  });
}

// ================= top bar =================
G.topbar = function () {
  const st = S.st; if (!st) return;
  const r = st.run, a = approval();
  top.classList.remove('hidden');
  const energy = r ? Math.round(r.energy) : 100;
  top.innerHTML = `
    <div class="brand">Corps of Discovery</div>
    <div class="tstat"><small>Explorer${S.me.partner ? 's' : ''}</small><b>${esc(S.me.username)}${S.me.partner ? ' &amp; ' + esc(S.me.partner) : ''}</b></div>
    <div class="tstat"><small>Level ${st.level}</small><b>${esc(lvl()?.name || '')}</b></div>
    ${r ? `<div class="tstat"><small>Day</small><b>${r.days} / ${r.maxDays}</b></div>` : ''}
    <div class="tstat"><small>Party size</small><b>${st.party}</b></div>
    <div class="tstat money"><small>Funds</small><b>${money(st.money)}</b></div>
    ${r ? `<div class="tstat"><small>Energy ${energy}%</small><div class="meter ${energy < 30 ? 'low' : ''}"><i style="width:${energy}%"></i></div></div>` : ''}
    <div class="jeff" title="President Jefferson\u2019s approval"><img src="/img/events/jefferson-icon.png" alt="">
      <div class="tstat"><small>Jefferson\u2019s approval ${a}</small><div class="meter"><i style="width:${clamp(a, 0, 100)}%"></i></div></div></div>
    <nav class="topnav">
      <button data-n="inv">Inventory</button><button data-n="journal">Journal</button><button data-n="board">Leaderboard</button><button data-n="out">Log out</button>
    </nav>`;
  top.querySelector('[data-n=inv]').onclick = viewInventory;
  top.querySelector('[data-n=journal]').onclick = viewJournal;
  top.querySelector('[data-n=board]').onclick = viewBoard;
  top.querySelector('[data-n=out]').onclick = () => G.logout(false);
};

// ================= router =================
function render() {
  stopTravel();
  G.topbar();
  const ph = S.st.phase;
  if (ph === 'gate') return viewGate();
  if (ph === 'info') return viewInfo();
  if (ph === 'start') return viewStart();
  if (ph === 'travel') return viewTravel();
  if (ph === 'complete') return viewComplete();
  if (ph === 'final') return viewFinal();
  if (ph === 'perished') return viewPerished();
  viewGate();
}
G.render = render;

// ================= gate =================
function viewGate() {
  const L = lvl();
  app.innerHTML = `<section class="frame level-card">
    <div class="lvl">Level ${L.num}</div><h1>${esc(L.name)}</h1>
    ${L.hasPassword ? `<p>Enter the level code from your teacher to continue.</p>
      <form id="gate" class="row" style="justify-content:center;max-width:420px;margin:0 auto">
        <input class="inp" name="code" placeholder="Level code" autocomplete="off" style="flex:1" aria-label="Level code" required>
        <button class="btn river">Unlock</button></form><p class="err" id="gate-err"></p>`
      : `<p>Your teacher has opened this level.</p><button class="btn river big" id="gate-open">Continue</button>`}
  </section>`;
  const go = async (code) => {
    try { await api('/unlock', { method: 'POST', body: { level: L.num, code } }); S.st.phase = 'info'; save(); render(); }
    catch (e) { const el = $('#gate-err'); if (el) el.textContent = e.message; else toast(e.message); }
  };
  $('#gate')?.addEventListener('submit', (e) => { e.preventDefault(); go(new FormData(e.target).get('code')); });
  $('#gate-open')?.addEventListener('click', () => go(''));
}

// ================= level info =================
function viewInfo() {
  const L = lvl(), st = S.st;
  const partyNote = L.num === 1 ? `${st.party} + your crew` : st.party;
  app.innerHTML = `<section class="frame level-card">
    <div class="lvl">Level ${L.num}</div><h1>${esc(L.name)}</h1>
    <div class="stats">
      <div class="stat-box"><div class="lbl">Party size</div><div class="val">${partyNote}</div></div>
      <div class="stat-box"><div class="lbl">Days to finish</div><div class="val">${L.maxDays}</div></div>
      <div class="stat-box"><div class="lbl">Starting location</div><div class="val" style="font-size:1.25rem">${esc(L.start)}</div></div>
      <div class="stat-box"><div class="lbl">Miles to travel</div><div class="val">${L.miles}</div></div>
      <div class="stat-box"><div class="lbl">Finish early and earn</div><div class="val">+1</div><div class="sub">approval for every ${S.cfg.game.earlyDaysPerPoint} unused days</div></div>
    </div>
    ${L.num === 1 && !st.gotGrant ? `<p>Congress has given you a grant of <b>${money(S.cfg.game.startingGrant)}</b> to outfit the expedition.</p>` : ''}
    <div class="river-box"><h3>Rumors of the land ahead</h3><p>${esc(L.rumors)}</p></div>
    <p class="muted">Every ${S.cfg.game.daysPerRation} days of travel uses 1 food and 1 water. If you run out, you must hunt or forage. If you run out of days, President Jefferson loses faith and you must restart the level.</p>
    <button class="btn river big" id="begin">Begin Level</button>
  </section>`;
  $('#begin').onclick = async () => {
    if (L.num === 1 && !st.gotGrant) { st.money += S.cfg.game.startingGrant; st.gotGrant = true; }
    st.run = { days: 0, miles: 0, maxDays: L.maxDays, energy: S.cfg.game.startingEnergy, mode: L.modes[0], hunts: 0, forages: 0, done: {}, flags: {}, log: [], started: false, timeBonusLost: false, quiz: {}, haggle: {} };
    st.phase = 'start';
    const snap = clone(st); snap.snap = null; st.snap = snap;
    save(true); render();
    if (L.num === 1 && !st.logs.landmarks.campWood) {
      await logScene({ type: 'map', key: 'campWood', img: 'maps/camp-wood.png', title: 'The trail begins: Camp Wood, May 14, 1804', text: 'Mark Camp Wood on your expedition map. This is where your journey starts.' });
      st.snap.logs = clone(st.logs); st.snap.pts = clone(st.pts); save(); render();
    }
  };
}

// ================= starting location =================
function viewStart() {
  const L = lvl(), st = S.st, r = st.run;
  const op = L.outpost;
  const special = L.num === 1 ? `<div class="note-box special"><h4>Expedition crew selection</h4><p>${st.crew ? `You hired: <b>${esc(crew().name)}</b>.` : 'Choose who will travel with you. You must decide before you depart.'}</p><button class="btn" id="b-crew">${st.crew ? 'Change crew' : 'Choose your crew'}</button></div>`
    : L.num === 2 ? `<div class="note-box special"><h4>Interpreter &amp; guide recruitment</h4><p>Two people at the fort have offered to join you at no cost.</p><button class="btn" id="b-recruit">Meet the interpreters</button></div>` : '';
  const modes = L.modes.map(m => `<option value="${m}" ${r.mode === m ? 'selected' : ''}>${esc(S.cfg.travel[m].label)}</option>`).join('');
  app.innerHTML = `<div class="loc">
    <div class="loc-img"><img src="/img/${L.startImage}" alt="${esc(L.start)}"></div>
    <section class="frame">
      <h1>Welcome to ${esc(L.start)}</h1>
      <p>${esc(L.intro)}</p>
      ${st.teacherNote ? `<p class="note-box small"><b>Note from your teacher:</b> ${esc(st.teacherNote)}</p>` : ''}
      <div class="actions">
        ${op ? '<button class="btn river" id="b-out">Go to the outpost</button>' : ''}
        <button class="btn" id="b-inv">Check inventory</button>
        <button class="btn" id="b-skill">Learn skills</button>
        <button class="btn moss" id="b-hunt">Go hunting</button>
        <button class="btn moss" id="b-forage">Go foraging</button>
      </div>
      ${special}
      <div class="river-box"><h3>Plan your journey</h3>
        <p>Day ${r.days} of ${r.maxDays}. ${L.miles} miles to travel.</p>
        <label class="field" style="color:#f1d995">Mode of travel<select id="mode" class="inp">${modes}</select></label>
        <p class="small" style="color:#d9e6ee">Food: ${st.inv.food} &nbsp; Water: ${st.inv.water} &nbsp; Ammunition: ${st.inv.ammo}</p>
        <button class="btn big" id="b-go" style="background:#f1d995;color:#2a1c11;border-color:#b88b3d;box-shadow:0 3px 0 #8a6a2c">Depart</button>
      </div>
    </section></div>`;
  $('#b-out')?.addEventListener('click', () => G.openOutpost(op));
  $('#b-inv').onclick = viewInventory;
  $('#b-skill').onclick = viewAcademy;
  $('#b-hunt').onclick = async () => { await doHunt(); render(); };
  $('#b-forage').onclick = async () => { await doForage(); if (S.st.phase === 'start') render(); };
  $('#b-crew')?.addEventListener('click', viewCrew);
  $('#b-recruit')?.addEventListener('click', viewRecruit);
  $('#mode').onchange = (e) => { r.mode = e.target.value; save(); };
  $('#b-go').onclick = depart;
}

async function depart() {
  const st = S.st, r = st.run, L = lvl();
  if (L.num === 1 && !st.crew) { await scene({ title: 'Choose a crew first', text: 'Visit the expedition crew selection before you leave Camp Wood.', choices: [{ label: 'OK', value: 1 }] }); return; }
  if (st.inv.food <= 0 || st.inv.water <= 0) {
    const go = await scene({ title: 'Leave without supplies?', text: `You have ${st.inv.food} food and ${st.inv.water} water. If either runs out on the trail you will have to hunt or forage immediately, and if that fails the expedition is lost.`, choices: [{ label: 'Stay and get supplies', value: false }, { label: 'Leave anyway', value: true }] });
    if (!go) return;
  }
  if (L.num === 4) {
    if (r.mode === 'canoe') {
      const c = await scene({ img: 'photos/canoe-burn.jpg', title: 'Making canoes', text: 'The Nez Perce offer to show you how they make dugout canoes. You could also carve them yourselves with your axes.',
        choices: [{ label: 'Use the Nez Perce burn-groove method', value: 'burn' }, { label: 'Carve them by hand with axes', value: 'axe' }] });
      if (c === 'burn') {
        r.maxDays += 5;
        await scene({ img: 'photos/canoe-burn.jpg', title: 'Fire and patience', text: 'The Nez Perce carve a shallow groove into each log and let controlled fires hollow it out. It saves your crew\u2019s strength, preserves your axes, and gives you 5 extra days on this level.' });
      } else {
        st.inv.tools = 0; r.energy = clamp(r.energy - 20, 1, 100);
        await scene({ img: 'photos/canoe-axe.jpg', title: 'Hard labor', text: 'Your men hack at the logs for days. Several axes snap and the crew is exhausted. (-20 energy, +4 days, iron tools broken)' });
        r.days += 4;
      }
      st.inv.canoes = Math.max(st.inv.canoes || 0, 1);
    } else {
      r.flags.l4foot = true; r.flags.noRest = true;
      await scene({ img: 'photos/hike.jpg', title: 'Setting out on foot', text: 'The crew is still weak from the mountains. You shoulder your packs and start walking west.' });
    }
  }
  r.started = true; r.paused = false; st.phase = 'travel';
  logLine(`Departed ${L.start} by ${S.cfg.travel[r.mode].label.toLowerCase()}.`);
  save(true); render();
}

// ================= crew & recruits =================
function viewCrew() {
  const st = S.st, crews = S.cfg.crews;
  const m = openModal(`<div class="frame"><button class="btn ghost modal-close" id="cx">Close</button>
    <h2>The Corps of Discovery interviews</h2><p>Choose who will travel with you. Funds available: <b>${money(st.money + (st.crew ? crews[st.crew].cost : 0))}</b>${st.crew ? ' (including a refund for your current crew)' : ''}.</p>
    <div class="inv-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${Object.entries(crews).map(([id, c]) => `
      <div class="note-box"><h3>${esc(c.name)}</h3><p><b>${c.cost ? money(c.cost) : 'Free'}</b> &middot; adds ${c.size} to your party</p><p>${esc(c.desc)}</p>
      <button class="btn ${st.crew === id ? 'moss' : 'river'} full" data-c="${id}">${st.crew === id ? 'Hired' : 'Hire'}</button></div>`).join('')}</div></div>`, { closable: true, onClose: render });
  m.el.querySelector('#cx').onclick = m.close;
  m.el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
    const id = b.dataset.c, c = crews[id];
    const refund = st.crew ? crews[st.crew].cost : 0;
    if (st.money + refund < c.cost) { toast('Not enough money for that crew.'); return; }
    st.money += refund - c.cost; st.crew = id;
    st.party = S.cfg.game.startingParty + c.size; st.peakParty = Math.max(st.party, S.cfg.game.startingParty);
    save(); m.close();
  });
}
function viewRecruit() {
  const st = S.st;
  const card = (key, img, name, text, perk) => `<div class="note-box"><img src="/img/photos/${img}" alt="${esc(name)}" style="width:100%;border:3px solid var(--bark);border-radius:4px;background:#fff">
    <h3 style="margin-top:.6rem">${esc(name)}</h3><p>${esc(text)}</p><p class="small muted">${esc(perk)}</p>
    <button class="btn ${st.comp[key] ? 'moss' : 'river'} full" data-k="${key}">${st.comp[key] ? 'Hired (click to release)' : 'Hire'}</button></div>`;
  const m = openModal(`<div class="frame"><button class="btn ghost modal-close" id="rx">Close</button><h2>Interpreter &amp; guide recruitment</h2>
    <p>While you wait for spring you could hire translators and guides to help you navigate and speak with the nations ahead. There is no cost.</p>
    <div class="photo-scene">${card('sacagawea', 'sacagawea.jpg', 'Sacagawea, age 16', 'Speaks Shoshone and Hidatsa. Expert in native foraging, edible plants and mountain navigation.', 'While she is with you, foraging gives 2 extra choices and fewer dangers.')}
    ${card('charbonneau', 'charbonneau.jpg', 'Toussaint Charbonneau, age 45', 'Speaks French and Hidatsa. Skilled fur trapper and hunter.', 'While he is with you, hunting gives 1 extra shot and he turns a miss into a hit.')}</div></div>`, { closable: true, onClose: render });
  m.el.querySelector('#rx').onclick = m.close;
  m.el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    st.comp[k] = !st.comp[k];
    st.party += st.comp[k] ? 1 : -1; st.peakParty = Math.max(st.peakParty, st.party);
    addPts('bonus', st.comp[k] ? S.cfg.scoring.recruit : -S.cfg.scoring.recruit, st.comp[k] ? 'Recruited a guide' : '');
    save(); m.close(); viewRecruit();
  });
}

// ================= outpost / market =================
G.openOutpost = async function (id) {
  const st = S.st, r = st.run, op = outpostCfg(id);
  if (!op) return;
  if (!r.quiz[id]) {
    const ok = await quizGame({ need: st.level, place: op.name });
    if (!ok) return;
    r.quiz[id] = true; save();
  }
  return new Promise((resolve) => {
    const m = openModal(`<div class="frame" id="mk"></div>`, { closable: true, onClose: () => { save(); if (st.phase === 'start') render(); else G.topbar(); resolve(); } });
    const H = S.cfg.haggle;
    const haggleCfg = () => st.skills.barter ? { chance: H.skilledChance, disc: H.skilledDiscount } : { chance: H.chance, disc: H.discount };
    const priceOf = (key, base) => { const h = r.haggle[id + ':' + key]; return Math.round(base * (1 + (h || 0) / 100) * 100) / 100; };
    const draw = () => {
      const row = (key, name, desc, base, unit) => {
        const hk = r.haggle[id + ':' + key];
        return `<tr><td><b>${esc(name)}</b>${desc ? `<div class="small muted">${esc(desc)}</div>` : ''}</td>
          <td>${money(priceOf(key, base))}${unit ? ' ' + unit : ''}${hk ? `<div class="small ${hk < 0 ? 'ok-text' : 'err'}">${hk < 0 ? 'Haggled ' + hk + '%' : 'Marked up +' + hk + '%'}</div>` : ''}</td>
          <td><button class="btn ghost" data-h="${key}" data-base="${base}" ${hk !== undefined ? 'disabled' : ''}>Haggle</button></td>
          <td class="row"><input type="number" class="qty" min="1" value="1" data-q="${key}" aria-label="Quantity of ${esc(name)}"><button class="btn river" data-b="${key}">Buy</button></td></tr>`;
      };
      const items = op.buy.map((it, i) => ({ key: 'i' + i, ...it }));
      m.el.querySelector('#mk').innerHTML = `<button class="btn ghost modal-close" id="mx">Leave outpost</button>
        <h2>${esc(op.name)}</h2><p>Funds: <b>${money(st.money)}</b> &nbsp; Food: <b>${st.inv.food}</b> &nbsp; Water: <b>${st.inv.water}</b> &nbsp; Ammunition: <b>${st.inv.ammo}</b></p>
        <p class="small muted">You may haggle once per item: ${haggleCfg().chance}% chance of ${haggleCfg().disc}% off, otherwise the price goes up ${H.markup}%.</p>
        <h3>Supplies</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Item</th><th>Price</th><th></th><th>Buy</th></tr></thead><tbody>
        ${row('food', 'Food', 'Ration pack. 1 feeds the party for ' + S.cfg.game.daysPerRation + ' days.', op.food, 'each')}
        ${row('water', 'Water', 'Jug. 1 lasts the party ' + S.cfg.game.daysPerRation + ' days.', op.water, 'each')}
        ${row('ammo', 'Ammunition', 'One shot for hunting or defense.', op.ammo, 'each')}
        ${items.map(it => row(it.key, it.name + (it.qty > 1 ? ` (x${it.qty})` : ''), it.desc, it.price, '')).join('')}
        </tbody></table></div>
        <h3 style="margin-top:1rem">This outpost wants to buy</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Item</th><th>You have</th><th>They pay</th><th></th></tr></thead><tbody>
        ${op.sell.map((s, i) => `<tr><td>${esc(s.name)}</td><td>${st.inv[s.id] || 0}</td><td>${money(s.price)}</td><td><button class="btn" data-s="${i}" ${(st.inv[s.id] || 0) > 0 ? '' : 'disabled'}>Sell 1</button></td></tr>`).join('')}
        </tbody></table></div>`;
      m.el.querySelector('#mx').onclick = m.close;
      m.el.querySelectorAll('[data-h]').forEach(b => b.onclick = () => {
        const hc = haggleCfg();
        const win = Math.random() * 100 < hc.chance;
        r.haggle[id + ':' + b.dataset.h] = win ? -hc.disc : H.markup;
        toast(win ? `The trader agrees to ${hc.disc}% off.` : `The trader is insulted and raises the price ${H.markup}%.`);
        draw();
      });
      m.el.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
        const key = b.dataset.b;
        const q = Math.max(1, Math.floor(Number(m.el.querySelector(`[data-q="${key}"]`).value) || 1));
        let base, give;
        if (key === 'food' || key === 'water' || key === 'ammo') { base = op[key]; give = () => { st.inv[key] += q; }; }
        else { const it = items.find(x => x.key === key); base = it.price; give = () => { st.inv[it.id] = (st.inv[it.id] || 0) + it.qty * q; if (it.id === 'gear') st.inv.tools = (st.inv.tools || 0) + 3 * q; }; }
        const cost = Math.round(priceOf(key, base) * q * 100) / 100;
        if (cost > st.money + 1e-9) { toast('Not enough money.'); return; }
        st.money = Math.round((st.money - cost) * 100) / 100; give(); save(); G.topbar(); draw();
      });
      m.el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
        const s = op.sell[Number(b.dataset.s)];
        if ((st.inv[s.id] || 0) <= 0) return;
        st.inv[s.id]--; st.money = Math.round((st.money + s.price) * 100) / 100; save(); G.topbar(); draw();
      });
    };
    draw();
  });
};

// ================= scout academy =================
function viewAcademy() {
  const st = S.st, sk = S.cfg.skills;
  const m = openModal(`<div class="frame" id="ac"></div>`, { closable: true, onClose: () => { if (st.phase === 'start') render(); } });
  const draw = () => {
    m.el.querySelector('#ac').innerHTML = `<button class="btn ghost modal-close" id="ax">Close</button><h2>Scout Academy</h2>
      <p>Spend Congressional funds on training for your crew. Funds: <b>${money(st.money)}</b></p>
      <div class="inv-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">${Object.entries(sk).map(([id, s]) => {
        const tier = id === 'mapping' ? (st.skills.mapping || 0) : null;
        const owned = id === 'mapping' ? tier >= (s.maxTier || 3) : !!st.skills[id];
        const cost = id === 'mapping' ? s.cost + tier * s.tierCost : s.cost;
        return `<div class="note-box"><h4>${esc(s.name)}${id === 'mapping' ? ` (tier ${tier}/${s.maxTier || 3})` : ''}</h4><p class="small">${esc(s.desc)}</p>
          <button class="btn ${owned ? 'moss' : 'river'} full" data-k="${id}" ${owned ? 'disabled' : ''}>${owned ? 'Learned' : 'Learn for ' + money(cost)}</button></div>`;
      }).join('')}</div>`;
    m.el.querySelector('#ax').onclick = m.close;
    m.el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const id = b.dataset.k, s = sk[id];
      const cost = id === 'mapping' ? s.cost + (st.skills.mapping || 0) * s.tierCost : s.cost;
      if (st.money < cost) { toast('Not enough money.'); return; }
      st.money -= cost;
      if (id === 'mapping') st.skills.mapping = (st.skills.mapping || 0) + 1; else st.skills[id] = true;
      toast(`${s.name} learned.`); save(); G.topbar(); draw();
    });
  };
  draw();
}

// ================= inventory / journal / leaderboard =================
const INV_LABELS = { food: 'Food (ration packs)', water: 'Water (jugs)', ammo: 'Ammunition (shots)', medkit: 'Medical kits', gifts: 'Trade gifts', gear: 'Travel gear', survey: 'Survey equipment', tools: 'Iron tools', fur: 'Furs', horses: 'Horses', canoes: 'Canoes', moccasins: 'Moccasins', crafts: 'Native crafts', minerals: 'Mineral samples', kettle: 'Copper kettles', buttons: 'Brass buttons' };
function viewInventory() {
  const st = S.st, c = crew();
  const comps = [st.comp.sacagawea && 'Sacagawea', st.comp.charbonneau && 'Toussaint Charbonneau', st.comp.toby && 'Toby (guide)'].filter(Boolean);
  const skills = Object.entries(S.cfg.skills).filter(([id]) => id === 'mapping' ? st.skills.mapping > 0 : st.skills[id]).map(([id, s]) => s.name + (id === 'mapping' ? ` (tier ${st.skills.mapping})` : ''));
  const m = openModal(`<div class="frame"><button class="btn ghost modal-close" id="ix">Close</button><h2>Inventory</h2>
    <div class="stats"><div class="stat-box"><div class="lbl">Party size</div><div class="val">${st.party}</div></div>
    <div class="stat-box"><div class="lbl">Funds</div><div class="val">${money(st.money)}</div></div>
    <div class="stat-box"><div class="lbl">Crew</div><div class="val" style="font-size:1.1rem">${esc(c ? c.name : 'None yet')}</div></div>
    ${st.run ? `<div class="stat-box"><div class="lbl">Energy</div><div class="val">${Math.round(st.run.energy)}%</div></div>` : ''}</div>
    <div class="inv-grid">${Object.entries(INV_LABELS).filter(([k]) => (st.inv[k] || 0) > 0 || ['food', 'water', 'ammo', 'medkit', 'gifts', 'gear'].includes(k)).map(([k, l]) => `<div class="stat-box"><div class="lbl">${l}</div><div class="val">${st.inv[k] || 0}</div></div>`).join('')}</div>
    <p style="margin-top:1rem"><b>Guides with you:</b> ${comps.length ? esc(comps.join(', ')) : 'none'}</p>
    <p><b>Skills:</b> ${skills.length ? esc(skills.join(', ')) : 'none'}</p></div>`, { closable: true });
  m.el.querySelector('#ix').onclick = m.close;
}
function viewJournal() {
  const st = S.st, p = st.pts;
  const li = (obj, logged) => Object.entries(obj).map(([k, n]) => `<li>${logged[k] ? '\u2713' : '\u25cb'} ${logged[k] ? esc(n) : '<span class="muted">Not yet discovered</span>'}</li>`).join('');
  const m = openModal(`<div class="frame"><button class="btn ghost modal-close" id="jx">Close</button><h2>Expedition record</h2>
    <div class="photo-scene"><div><h3>Animals logged</h3><ul>${li(ANIMALS, st.logs.animals)}</ul>
      <h3>Landmarks mapped</h3><ul>${li(LANDMARKS, st.logs.landmarks)}</ul></div>
      <div><h3>Jefferson\u2019s approval</h3><table class="tbl"><tbody>
      <tr><td>Journal</td><td>${r1(p.journal)} / ${S.cfg.scoring.journal}</td></tr><tr><td>Mapping</td><td>${r1(p.mapping)}</td></tr>
      <tr><td>Diplomacy</td><td>${r1(p.diplomacy)} / ${S.cfg.scoring.diplomacy}</td></tr><tr><td>Time efficiency</td><td>${r1(p.time)}</td></tr>
      <tr><td>Decisions and events</td><td>${r1(p.bonus)}</td></tr><tr><td>Lives lost</td><td>${r1(p.deaths)}</td></tr>
      ${p.survival ? `<tr><td>Survival bonus</td><td>${r1(p.survival)}</td></tr>` : ''}${p.teacher ? `<tr><td>Teacher points</td><td>${r1(p.teacher)}</td></tr>` : ''}
      <tr><th>Total</th><th>${approval()}</th></tr></tbody></table>
      ${st.run?.log?.length ? `<h3 style="margin-top:1rem">Trail log</h3><div class="travel-log">${st.run.log.map(l => `<div>${esc(l)}</div>`).join('')}</div>` : ''}</div></div></div>`, { closable: true });
  m.el.querySelector('#jx').onclick = m.close;
}
const r1 = (n) => Math.round((n || 0) * 10) / 10;
async function viewBoard() {
  const m = openModal(`<div class="frame"><button class="btn ghost modal-close" id="lx">Close</button><h2>Leaderboard</h2><div id="lb">Loading\u2026</div></div>`, { closable: true });
  m.el.querySelector('#lx').onclick = m.close;
  try {
    const r = await api('/leaderboard');
    m.el.querySelector('#lb').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Explorers</th><th>Level</th><th>Approval</th></tr></thead><tbody>
      ${r.rows.map((x, i) => `<tr ${x.username === r.me ? 'style="background:#e3eccf"' : ''}><td>${i + 1}</td><td>${esc(x.username)}${x.partner ? ' &amp; ' + esc(x.partner) : ''}</td><td>${x.finished ? 'Finished' : x.level}</td><td>${x.approval}</td></tr>`).join('')}
      </tbody></table></div>`;
  } catch (e) { m.el.querySelector('#lb').textContent = e.message; }
}

// ================= travel =================
function levelEvents() {
  const L = lvl(), r = S.st.run;
  const fork = L.events.fork;
  const shift = (m) => (r.flags.north && fork != null && m > fork ? 50 : 0);
  const list = Object.entries(L.events).map(([key, mile]) => ({ key, mile: Number(mile) + shift(Number(mile)) }));
  (L.encounterMiles || []).forEach((mile, i) => list.push({ key: 'enc' + i, mile: Number(mile) + shift(Number(mile)) }));
  const dist = distance();
  list.push({ key: 'end', mile: dist });
  return list.filter(e => e.mile <= dist).sort((a, b) => a.mile - b.mile);
}
function distance() { const L = lvl(); return L.miles + (S.st.run.flags.north ? 50 : 0); }
function stopTravel() { if (S.timer) { clearInterval(S.timer); S.timer = null; } }
G.stopTravel = stopTravel;
function startTravel() {
  stopTravel();
  S.st.run.paused = false;
  S.timer = setInterval(tick, Math.max(150, S.cfg.game.secondsPerDay * 1000));
  updateTravel();
}
let busy = false;
async function tick() {
  const st = S.st, r = st.run;
  if (busy || st.phase !== 'travel' || r.paused) return;
  busy = true;
  try {
    const before = r.miles;
    let after = before + speed();
    const next = levelEvents().find(e => !r.done[e.key] && e.mile > before && e.mile <= after) || levelEvents().find(e => !r.done[e.key] && e.mile <= before);
    if (next) after = Math.max(before, next.mile);
    r.miles = Math.min(after, distance());
    consumeDay();
    r.energy = clamp(r.energy - drain(), 0, 100);
    updateTravel();
    if (r.energy <= 0) { stopTravel(); await G.exhausted(); return; }
    if (r.days > r.maxDays) { stopTravel(); await G.outOfDays(); return; }
    if (next) { stopTravel(); await runEvent(next); return; }
    const hadTimer = !!S.timer;
    if (!(await modeHazard())) return;
    if (hadTimer && !S.timer && S.st === st && st.phase === 'travel') { // a hazard paused the trip
      if (outOfSupplies()) { await starving(); return; }
      renderTravelIfNeeded(); startTravel(); return;
    }
    if (outOfSupplies()) { stopTravel(); await starving(); return; }
    if (r.days % 5 === 0) save();
  } finally { busy = false; }
}
async function runEvent(ev) {
  const st = S.st, r = st.run;
  r.done[ev.key] = true;
  let keep = true;
  if (ev.key.startsWith('enc')) keep = await encounter();
  else if (STORY[ev.key]) keep = await STORY[ev.key]();
  if (S.st !== st || st.phase !== 'travel') return; // level failed / restarted
  if (ev.key === 'end') { await G.completeLevel(); return; }
  save();
  if (keep !== false) {
    if (outOfSupplies()) { renderTravelIfNeeded(); return starving(); }
    renderTravelIfNeeded(); startTravel();
  }
}
function renderTravelIfNeeded() { if (!$('#tv')) viewTravel(false); else updateTravel(); }

function outOfSupplies() {
  const st = S.st;
  return st.inv.food <= 0 || (st.inv.water <= 0 && st.run.flags.route !== 'north');
}
async function starving() {
  const st = S.st, inv = st.inv;
  renderTravelIfNeeded();
  const needFood = inv.food <= 0, needWater = inv.water <= 0 && st.run.flags.route !== 'north';
  const what = needFood && needWater ? 'food and water' : needFood ? 'food' : 'water';
  const c = await scene({ img: 'photos/campfire.jpg', title: `Out of ${what}!`, text: `Your ${what} ${needFood && needWater ? 'are' : 'is'} gone. The expedition must find more right now or perish.${needWater ? ' Hunting will not find water; foraging can turn up springs and small rivers.' : ''}`,
    choices: [{ label: 'Go hunting', value: 'hunt', disabled: inv.ammo <= 0, note: inv.ammo <= 0 ? 'No ammunition.' : '' }, { label: 'Go foraging', value: 'forage' }] });
  if (c === 'hunt') await doHunt(); else await doForage();
  if (S.st.phase !== 'travel') return;
  if (outOfSupplies()) {
    await G.perish(`You could not find enough ${inv.water <= 0 ? 'water' : 'food'}.`);
    return;
  }
  save(); renderTravelIfNeeded(); startTravel();
}

G.exhausted = async function () {
  stopTravel();
  const r = S.st.run;
  if (r.flags.route === 'north') { await STORY.nezPerceRescue(false); r.miles = distance(); await G.completeLevel(); return; }
  if (r.flags.route === 'south') { await G.perish('The desert has no water. Your crew and horses collapse from thirst.'); return; }
  await G.perish('Your crew collapsed from exhaustion. Rest more often, and choose your crew and travel mode carefully.');
};
G.perish = async function (reason) {
  stopTravel();
  const st = S.st;
  st.phase = 'perished'; st.perishReason = reason || '';
  closeAllModals(); save(true); render();
};
G.outOfDays = async function () {
  stopTravel();
  const st = S.st;
  st.phase = 'perished'; st.perishReason = `You used more than ${st.run.maxDays} days. President Jefferson has lost faith in this part of the mission and withdraws all the approval you earned on this level.`;
  st.outOfDays = true;
  closeAllModals(); save(true); render();
};
function viewPerished() {
  const st = S.st;
  app.innerHTML = `<section class="frame level-card">
    <h1>${st.outOfDays ? 'Out of time' : 'Expedition failed'}</h1>
    <div class="ph" style="border:6px solid var(--bark-dark);border-radius:8px;overflow:hidden;margin:1rem 0"><img src="/img/photos/${st.outOfDays ? 'winter-sky' : 'frozen'}.jpg" alt="" style="display:block;width:100%"></div>
    <p style="font-size:1.25rem;margin:0 auto 1rem"><b>${esc(PERISH_TEXT)}</b></p>
    <p style="margin:0 auto 1rem">${esc(st.perishReason || '')}</p>
    <button class="btn river big" id="restart">Restart Level ${st.level}</button></section>`;
  $('#restart').onclick = restartLevel;
}
function restartLevel() {
  const st = S.st, snap = st.snap;
  if (!snap) { st.phase = 'info'; st.outOfDays = false; save(true); render(); return; }
  const teacher = st.pts.teacher || 0, note = st.teacherNote;
  const next = clone(snap); next.snap = clone(snap); next.pts.teacher = teacher; next.teacherNote = note;
  next.phase = 'start'; next.outOfDays = false; next.perishReason = '';
  S.st = next; save(true); render();
}

function viewTravel(autostart = true) {
  const st = S.st, r = st.run, L = lvl();
  app.innerHTML = `<div class="travel" id="tv">
    <div>
      <div class="scene"><img src="/img/${L.travelImage}" alt="">
        <div class="day-counter"><small>Day</small><span id="tv-day">${r.days}</span> / ${r.maxDays}</div>
        <div class="route"><svg viewBox="0 0 1000 70" preserveAspectRatio="none" aria-hidden="true">
          <path d="M10 40 C120 10 200 62 320 38 S520 12 620 40 S820 64 990 30" fill="none" stroke="#2c5a74" stroke-width="6" stroke-linecap="round" opacity=".35"/>
          <path id="tv-path" d="M10 40 C120 10 200 62 320 38 S520 12 620 40 S820 64 990 30" fill="none" stroke="#2c5a74" stroke-width="6" stroke-linecap="round" stroke-dasharray="2000" stroke-dashoffset="2000"/>
          <circle id="tv-dot" r="11" fill="#b88b3d" stroke="#37251a" stroke-width="3" cx="10" cy="40"/></svg>
          <div class="rlabels"><span>${esc(L.start)}</span><span id="tv-miles"></span><span>Uncharted</span></div></div>
      </div>
      <h3 style="color:var(--parchment-light);margin-top:1rem">Trail log</h3>
      <div class="travel-log" id="tv-log"></div>
    </div>
    <aside class="frame">
      <h2>On the trail</h2>
      <p class="muted" id="tv-mode"></p>
      <div class="gauges">
        <div class="gauge"><div class="lbl">Energy</div><div class="val" id="g-en"></div><div class="meter"><i id="g-enbar"></i></div></div>
        <div class="gauge"><div class="lbl">Party</div><div class="val" id="g-party"></div></div>
        <div class="gauge"><div class="lbl">Food</div><div class="val" id="g-food"></div></div>
        <div class="gauge"><div class="lbl">Water</div><div class="val" id="g-water"></div></div>
      </div>
      <div class="travel-btns">
        <button class="btn river" id="t-pause">Pause</button>
        <button class="btn" id="t-camp">Make camp (${S.cfg.travel.campDays} day)</button>
        <button class="btn" id="t-rest">Rest ${S.cfg.travel.restDays} days</button>
        <button class="btn moss" id="t-hunt">Hunt</button>
        <button class="btn moss" id="t-forage">Forage</button>
        <button class="btn ghost" id="t-inv">Inventory</button>
      </div>
      <p class="small muted" id="t-note"></p>
    </aside></div>`;
  $('#t-pause').onclick = () => { if (r.paused || !S.timer) startTravel(); else { stopTravel(); r.paused = true; save(); updateTravel(); } };
  const pauseFor = async (fn) => { const was = !!S.timer; stopTravel(); r.paused = true; await fn(); if (S.st.phase === 'travel' && S.st.run === r) { updateTravel(); if (was) startTravel(); } };
  $('#t-camp').onclick = () => pauseFor(async () => { r.energy = clamp(r.energy + S.cfg.travel.campEnergy, 0, 100); await advanceDays(S.cfg.travel.campDays, 'Made camp'); });
  $('#t-rest').onclick = () => pauseFor(async () => { r.energy = 100; await advanceDays(S.cfg.travel.restDays, 'Rested and recovered'); });
  $('#t-hunt').onclick = () => pauseFor(doHunt);
  $('#t-forage').onclick = () => pauseFor(doForage);
  $('#t-inv').onclick = viewInventory;
  updateTravel();
  if (autostart && !r.paused) startTravel();
}
function updateTravel() {
  const st = S.st, r = st.run; if (!r || !$('#tv')) return;
  const dist = distance(), frac = clamp(r.miles / dist, 0, 1);
  $('#tv-day').textContent = r.days;
  $('#tv-miles').textContent = `${Math.round(r.miles)} of ${dist} miles`;
  const path = $('#tv-path');
  if (path) {
    const len = path.getTotalLength();
    path.style.strokeDasharray = len; path.style.strokeDashoffset = len * (1 - frac);
    const p = path.getPointAtLength(len * frac); $('#tv-dot').setAttribute('cx', p.x); $('#tv-dot').setAttribute('cy', p.y);
  }
  $('#tv-mode').textContent = `${S.cfg.travel[r.mode].label}: about ${speed()} miles a day.`;
  $('#g-en').textContent = Math.round(r.energy) + '%';
  $('#g-enbar').style.width = r.energy + '%';
  $('#g-enbar').parentElement.classList.toggle('low', r.energy < 30);
  $('#g-party').textContent = st.party; $('#g-food').textContent = st.inv.food; $('#g-water').textContent = st.inv.water;
  $('#tv-log').innerHTML = r.log.map(l => `<div>${esc(l)}</div>`).join('') || '<div class="muted">The journey begins.</div>';
  $('#t-pause').textContent = S.timer ? 'Pause' : 'Continue journey';
  $('#t-rest').disabled = !!r.flags.noRest; $('#t-camp').disabled = !!r.flags.noRest;
  $('#t-note').textContent = r.flags.noRest ? 'There is nowhere safe to stop and rest here.' : 'Tip: rest before your energy runs out. Each rest uses days.';
  G.topbar();
}

// ================= level complete & final =================
G.completeLevel = async function () {
  stopTravel();
  const st = S.st, r = st.run, L = lvl();
  const left = Math.max(0, r.maxDays - r.days);
  const pts = r.timeBonusLost ? 0 : Math.floor(left / S.cfg.game.earlyDaysPerPoint);
  if (pts) addPts('time', pts, `Finished ${left} days early`);
  st.results[L.num] = { days: r.days, maxDays: r.maxDays, daysLeft: left, timePts: pts, lostBonus: !!r.timeBonusLost, approval: approval() };
  closeAllModals();
  if (L.num >= S.cfg.levels.length) {
    const surv = Math.round(S.cfg.scoring.survival * clamp(st.party / Math.max(1, st.peakParty), 0, 1) * 10) / 10;
    st.pts.survival = surv; st.finished = true; st.phase = 'final';
  } else st.phase = 'complete';
  save(true); render();
};
function viewComplete() {
  const st = S.st, L = lvl(), res = st.results[L.num] || {};
  app.innerHTML = `<section class="frame level-card">
    <div class="lvl">Level ${L.num} complete</div><h1>${esc(L.name)} is behind you</h1>
    <div class="stats">
      <div class="stat-box"><div class="lbl">Days used</div><div class="val">${res.days} / ${res.maxDays}</div></div>
      <div class="stat-box"><div class="lbl">Early-finish bonus</div><div class="val">+${res.timePts || 0}</div>${res.lostBonus ? '<div class="sub">Lost while building the fort</div>' : ''}</div>
      <div class="stat-box"><div class="lbl">Party size</div><div class="val">${st.party}</div></div>
      <div class="stat-box"><div class="lbl">Jefferson\u2019s approval</div><div class="val">${approval()}</div></div>
    </div>
    <p>Make sure your field journal and map are up to date. When your teacher gives you the next level code, continue on.</p>
    <button class="btn river big" id="next">Continue to Level ${L.num + 1}</button></section>`;
  $('#next').onclick = () => { st.level++; st.phase = 'gate'; st.run = null; st.snap = null; save(true); render(); };
}
function viewFinal() {
  const st = S.st, p = st.pts, sc = S.cfg.scoring;
  const total = approval();
  const verdict = total >= 90 ? 'Outstanding service to the nation' : total >= 70 ? 'Distinguished service' : total >= 50 ? 'Faithful service' : 'Service completed';
  app.innerHTML = `<section class="frame epic no-print"><h1>President Jefferson\u2019s evaluation</h1>
    <div class="ph"><img src="/img/photos/jefferson.jpg" alt="Thomas Jefferson" style="max-height:340px;width:auto;margin:0 auto"></div>
    <div class="breakdown"><table class="tbl"><tbody>
      <tr><td>Journal points (animals logged)</td><td>${r1(p.journal)} / ${sc.journal}</td></tr>
      <tr><td>Mapping points (landmarks)</td><td>${r1(p.mapping)} / ${sc.mapping}${p.mapping > sc.mapping ? ' with survey bonus' : ''}</td></tr>
      <tr><td>Diplomacy points</td><td>${r1(p.diplomacy)} / ${sc.diplomacy}</td></tr>
      <tr><td>Survival bonus (${st.party} of ${st.peakParty} still with you)</td><td>${r1(p.survival)} / ${sc.survival}</td></tr>
      <tr><td>Time efficiency</td><td>${r1(p.time)}</td></tr>
      <tr><td>Decisions and events</td><td>${r1(p.bonus)}</td></tr>
      <tr><td>Lives lost</td><td>${r1(p.deaths)}</td></tr>
      ${p.teacher ? `<tr><td>Teacher points</td><td>${r1(p.teacher)}</td></tr>` : ''}
      <tr><th>Final approval</th><th>${total}</th></tr></tbody></table></div>
    <button class="btn river big" onclick="window.print()">Print your certificate</button></section>
    <section class="cert"><p>The President of the United States</p><h1>Presidential Commendation</h1>
      <p>is hereby awarded to</p><h2>${esc(S.me.username)}${S.me.partner ? ' and ' + esc(S.me.partner) : ''}</h2>
      <p>Captain${S.me.partner ? 's' : ''} of the Corps of Discovery, for leading the expedition from Camp Wood to Fort Clatsop on the Pacific Ocean, documenting ${Object.keys(st.logs.animals).length} new animals and mapping ${Object.keys(st.logs.landmarks).length} landmarks of the American West.</p>
      <p><b>${verdict}</b> &middot; Final approval: ${total}</p>
      <div class="sig">Th: Jefferson</div><p class="small">President of the United States</p></section>`;
}

window.addEventListener('beforeunload', () => { if (S.st) { stopTravel(); } });
boot();
