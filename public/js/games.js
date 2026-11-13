// Interactive mini-games. Each returns a Promise with the result.
import { S, esc, shuffle, rand, openModal, toast, clamp } from './core.js';

// ---------- simple scenery drawings ----------
const SCENERY = {
  tree: `<svg viewBox="0 0 100 100"><rect x="45" y="62" width="10" height="30" fill="#5a3c26"/><path d="M50 8 L78 50 L64 50 L84 72 L16 72 L36 50 L22 50 Z" fill="#2f5a3a"/><path d="M50 8 L64 30 L36 30 Z" fill="#3e7149"/></svg>`,
  bush: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="72" rx="40" ry="22" fill="#4e7a3a"/><ellipse cx="34" cy="62" rx="20" ry="18" fill="#5f8c45"/><ellipse cx="64" cy="60" rx="22" ry="19" fill="#5a8641"/><circle cx="40" cy="66" r="3" fill="#8f2f1e"/><circle cx="62" cy="70" r="3" fill="#8f2f1e"/></svg>`,
  rock: `<svg viewBox="0 0 100 100"><path d="M12 88 L22 58 L40 46 L62 50 L80 62 L90 88 Z" fill="#7d7468"/><path d="M40 46 L62 50 L56 66 L30 70 Z" fill="#958b7d"/><rect x="8" y="86" width="86" height="6" fill="#5b6f3e"/></svg>`,
  grass: `<svg viewBox="0 0 100 100"><g stroke="#c2b25a" stroke-width="4" stroke-linecap="round" fill="none"><path d="M20 92 Q22 60 14 40"/><path d="M32 92 Q34 56 40 34"/><path d="M46 92 Q44 50 50 26"/><path d="M58 92 Q60 58 68 38"/><path d="M72 92 Q74 64 84 48"/></g><g stroke="#8aa063" stroke-width="4" stroke-linecap="round" fill="none"><path d="M26 92 Q28 66 22 52"/><path d="M52 92 Q54 62 58 46"/><path d="M66 92 Q64 70 60 56"/></g></svg>`,
  log: `<svg viewBox="0 0 100 100"><rect x="10" y="64" width="80" height="20" rx="10" fill="#6b4a2f"/><ellipse cx="88" cy="74" rx="6" ry="10" fill="#a07850"/><path d="M20 70 H70 M24 78 H80" stroke="#4a311e" stroke-width="2"/></svg>`
};
function treeSvg(sick) {
  // diseased trees have pale fungus marks if you look closely
  return `<svg viewBox="0 0 90 120"><rect x="40" y="78" width="10" height="38" fill="#5a3c26"/>
    ${sick ? '<circle cx="44" cy="92" r="2.2" fill="#e6dcae"/><circle cx="47" cy="100" r="1.8" fill="#e6dcae"/><circle cx="43" cy="106" r="1.5" fill="#e6dcae"/>' : ''}
    <path d="M45 6 L72 52 L60 52 L80 82 L10 82 L30 52 L18 52 Z" fill="${sick ? '#40633f' : '#2f5a3a'}"/>
    <path d="M45 6 L58 30 L32 30 Z" fill="#3e7149"/></svg>`;
}

// ---------- HUNT ----------
const ANIMAL_POOL = ['bird', 'squirrel', 'squirrel', 'raccoon', 'raccoon', 'deer', 'deer', 'bear', 'bison'];
export function huntGame({ huntIndex }) {
  return new Promise((resolve) => {
    const cfg = S.cfg.hunting, st = S.st;
    const nAnimals = cfg.animalsByHunt[Math.min(huntIndex, cfg.animalsByHunt.length - 1)] ?? 1;
    const kinds = ['tree', 'bush', 'rock', 'grass', 'tree', 'bush', 'rock', 'grass', 'log', 'tree'];
    const spots = shuffle(kinds.map(k => ({ k, animal: null, shot: false })));
    shuffle([...spots.keys()]).slice(0, nAnimals).forEach(i => { spots[i].animal = ANIMAL_POOL[rand(ANIMAL_POOL.length)]; });
    const bonusShot = st.comp.charbonneau ? 1 : 0;
    let shots = Math.min(cfg.shots + bonusShot, st.inv.ammo);
    let food = 0, furs = 0, converted = false;
    const m = openModal(`<div class="frame">
      <div class="mg-head"><h2>Hunting for food</h2>
      <div class="mg-stats">Shots left <b id="h-shots">${shots}</b> Ammunition <b id="h-ammo">${st.inv.ammo}</b> Food found <b id="h-food">0</b></div></div>
      <p>Animals may be hiding behind the trees, bushes, rocks and grass. Click a spot to take a shot. ${bonusShot ? 'Toussaint Charbonneau is with you: you get an extra shot and he turns your first miss into a hit.' : ''}</p>
      ${shots === 0 ? '<p class="err">You have no ammunition. You cannot hunt.</p>' : ''}
      <div class="hunt-field" id="field">${spots.map((s, i) => `<button class="spot" data-i="${i}" aria-label="Shoot at the ${s.k}">${SCENERY[s.k]}</button>`).join('')}</div>
      <p id="h-msg" class="muted" style="margin-top:.6rem"></p>
      <button class="btn moss big" id="h-done">${shots === 0 ? 'Go back' : 'Finish hunt'}</button></div>`);
    const upd = () => { m.el.querySelector('#h-shots').textContent = shots; m.el.querySelector('#h-ammo').textContent = st.inv.ammo; m.el.querySelector('#h-food').textContent = food; };
    const reveal = (i) => {
      const s = spots[i]; s.shot = true;
      const btn = m.el.querySelector(`[data-i="${i}"]`);
      const r = cfg.rations[s.animal] || 1;
      btn.insertAdjacentHTML('beforeend', `<img class="animal" src="/img/animals/${s.animal}.png" alt="${s.animal}"><span class="tag">+${r} food</span>`);
      btn.disabled = true;
      food += r; if (['deer', 'bear', 'bison'].includes(s.animal)) furs++;
    };
    m.el.querySelectorAll('.spot').forEach(b => b.addEventListener('click', () => {
      if (shots <= 0) return;
      const i = Number(b.dataset.i); if (spots[i].shot) return;
      shots--; st.inv.ammo--;
      if (spots[i].animal) { reveal(i); m.el.querySelector('#h-msg').textContent = `Hit! You bagged a ${spots[i].animal}.`; }
      else {
        spots[i].shot = true; b.classList.add('miss'); b.disabled = true;
        const left = spots.findIndex(s => s.animal && !s.shot);
        if (bonusShot && !converted && left >= 0) { converted = true; reveal(left); m.el.querySelector('#h-msg').textContent = `You missed, but Charbonneau spotted a ${spots[left].animal} and brought it down.`; }
        else m.el.querySelector('#h-msg').textContent = 'Nothing there. The shot echoes across the land.';
      }
      upd();
      if (shots <= 0) { m.el.querySelectorAll('.spot').forEach(x => x.disabled = true); m.el.querySelector('#h-done').textContent = 'Finish hunt'; }
    }));
    m.el.querySelector('#h-done').addEventListener('click', () => { m.close(); resolve({ food, furs }); });
  });
}

// ---------- FORAGE (memory match) ----------
const GOOD = [
  { id: 'acorns', name: 'Acorns' }, { id: 'wild-rice', name: 'Wild Rice' }, { id: 'potatoes', name: 'Wild Potatoes' },
  { id: 'blueberries', name: 'Blueberries' }, { id: 'spring', name: 'Small Spring', water: true }, { id: 'river', name: 'Small River', water: true },
  { id: 'sunflower', name: 'Sunflower Seeds' }
];
const BAD = [{ id: 'mushroom', name: 'Poison Mushroom' }, { id: 'poison-ivy', name: 'Poison Ivy' }, { id: 'rattlesnake', name: 'Rattlesnake' }];
export function forageGame({ forageIndex, sacagawea, betrayed, noWater }) {
  return new Promise((resolve) => {
    const fc = S.cfg.foraging, st = S.st;
    const lay = fc.layouts[Math.min(forageIndex, fc.layouts.length - 1)];
    let good = lay.good, bad = lay.bad, choices = fc.choices;
    if (sacagawea) { choices += fc.sacagaweaBonus; if (bad > 0) { bad--; good++; } }
    if (betrayed) { bad += good; good = 0; }
    const goodPool = GOOD.filter(g => !(noWater && g.water));
    const pairs = [];
    for (let i = 0; i < good; i++) pairs.push(goodPool[i % goodPool.length]);
    const bp = shuffle([...BAD]);
    for (let i = 0; i < bad; i++) pairs.push(bp[i % bp.length]);
    const cards = shuffle(pairs.flatMap((p, i) => [{ ...p, pair: i }, { ...p, pair: i }]));
    let open = [], lock = false, food = 0, water = 0, events = [];
    const m = openModal(`<div class="frame">
      <div class="mg-head"><h2>Foraging</h2><div class="mg-stats">Choices left <b id="f-ch">${choices}</b> Food <b id="f-food">0</b> Water <b id="f-water">0</b></div></div>
      <p>Turn over two cards at a time. A matching pair is harvested. Edible plants and fresh water help you, but watch out for poison mushrooms, poison ivy and rattlesnakes.${sacagawea ? ' Sacagawea is with you: you get extra choices and fewer dangers.' : ''}</p>
      <div class="cards" id="cards">${cards.map((c, i) => `<button class="card" data-i="${i}" aria-label="Face-down card"><div class="in"><div class="face back"><img src="/img/cards/back.png" alt=""></div><div class="face front"><img src="/img/cards/${c.id}.png" alt="${esc(c.name)}"></div></div></button>`).join('')}</div>
      <p id="f-msg" class="muted" style="margin-top:.6rem"></p>
      <button class="btn moss big" id="f-done">Finish foraging</button></div>`);
    const upd = () => { m.el.querySelector('#f-ch').textContent = choices; m.el.querySelector('#f-food').textContent = food; m.el.querySelector('#f-water').textContent = water; };
    const msg = (t) => { m.el.querySelector('#f-msg').textContent = t; };
    m.el.querySelectorAll('.card').forEach(b => b.addEventListener('click', async () => {
      const i = Number(b.dataset.i);
      if (lock || choices <= 0 || b.classList.contains('up')) return;
      b.classList.add('up'); b.setAttribute('aria-label', cards[i].name); open.push(i);
      if (open.length < 2) return;
      lock = true; choices--;
      const [a, c] = open; open = [];
      if (cards[a].pair === cards[c].pair) {
        const k = cards[a];
        [a, c].forEach(x => m.el.querySelector(`[data-i="${x}"]`).classList.add('matched'));
        if (BAD.some(x => x.id === k.id)) {
          if (k.id === 'rattlesnake') { events.push('snake'); msg('A rattlesnake strikes! One member of your party dies.'); }
          else { events.push('poison'); msg(`${k.name}! The crew falls sick and loses ${fc.energyLoss}% of its energy.`); }
        } else if (k.water) { water++; msg(`You found a ${k.name.toLowerCase()}. +1 water.`); }
        else { food++; msg(`You gathered ${k.name.toLowerCase()}. +1 food.`); }
      } else {
        await new Promise(r => setTimeout(r, 900));
        [a, c].forEach(x => { const el = m.el.querySelector(`[data-i="${x}"]`); el.classList.remove('up'); el.setAttribute('aria-label', 'Face-down card'); });
      }
      upd(); lock = false;
      if (choices <= 0) msg((m.el.querySelector('#f-msg').textContent || '') + ' You are out of choices.');
    }));
    m.el.querySelector('#f-done').addEventListener('click', () => { m.close(); resolve({ food, water, events }); });
  });
}

// ---------- 10-tile encounter pick ----------
export function tileGame({ title, intro, successTiles, goodLabel = 'Safe', badLabel = 'Trouble' }) {
  return new Promise((resolve) => {
    const n = clamp(successTiles, 0, 10);
    const tiles = shuffle([...Array(10)].map((_, i) => i < n));
    const m = openModal(`<div class="frame"><h2>${esc(title)}</h2><p>${esc(intro)}</p><p><b>Choose one tile to decide your fate.</b></p>
      <div class="tiles">${tiles.map((_, i) => `<button class="tile" data-i="${i}" aria-label="Tile ${i + 1}">?</button>`).join('')}</div>
      <p id="t-msg" style="margin-top:.8rem"></p><button class="btn moss big hidden" id="t-go">Continue</button></div>`);
    let picked = -1;
    m.el.querySelectorAll('.tile').forEach(b => b.addEventListener('click', () => {
      if (picked >= 0) return;
      picked = Number(b.dataset.i);
      m.el.querySelectorAll('.tile').forEach((t, i) => { t.classList.add(tiles[i] ? 'good' : 'badt'); t.textContent = tiles[i] ? goodLabel : badLabel; t.disabled = true; });
      b.classList.add('picked');
      m.el.querySelector('#t-msg').innerHTML = tiles[picked] ? '<span class="ok-text">Success!</span>' : '<span class="err">Things go badly.</span>';
      m.el.querySelector('#t-go').classList.remove('hidden');
    }));
    m.el.querySelector('#t-go').addEventListener('click', () => { m.close(); resolve(tiles[picked]); });
  });
}

// ---------- surgery board ----------
const SPOTS = [
  { id: 'head', x: 50, y: 13, r: 12, text: 'You check his head. He is burning with fever.' },
  { id: 'chest', x: 50, y: 37, r: 12, text: 'His heart is racing. You can hear his shallow breaths.' },
  { id: 'belly', x: 50, y: 52, r: 11, text: 'You cut near the lower right of his belly. It is swollen and hot to the touch.' },
  { id: 'larm', x: 16, y: 55, r: 9, text: 'You try bleeding him from the arm, the way doctors of 1804 were taught. He grows weaker.' },
  { id: 'rarm', x: 84, y: 55, r: 9, text: 'You check the pulse in his wrist. It is faint.' },
  { id: 'leg', x: 38, y: 78, r: 10, text: 'His legs are cold and clammy. The infection is spreading.' },
  { id: 'foot', x: 68, y: 92, r: 9, text: 'You rub his feet to keep him warm. It does not help.' }
];
export function surgeryGame() {
  return new Promise((resolve) => {
    let left = 3; const lines = [];
    const m = openModal(`<div class="frame"><h2>Attempt surgery</h2><div class="surgery-wrap">
      <div class="body-board">${'<img src="/img/events/surgery.png" alt="Cartoon patient on a wooden board">'}${SPOTS.map(s => `<button class="hot" data-id="${s.id}" style="left:${s.x - s.r}%;top:${s.y - s.r / 2}%;width:${s.r * 2}%;aspect-ratio:1" aria-label="${s.id}"></button>`).join('')}</div>
      <div><p>You sedate Floyd with laudanum and lay out the tools from your medical kit. Click where you will work. You have three choices.</p>
      <p><b>Choices left: <span id="s-left">3</span></b></p><div id="s-log" class="note-box"><p class="muted">No cuts made yet.</p></div>
      <button class="btn danger big hidden" id="s-go" style="margin-top:1rem">See what happens</button></div></div></div>`);
    m.el.querySelectorAll('.hot').forEach(b => b.addEventListener('click', () => {
      if (left <= 0 || b.classList.contains('used')) return;
      b.classList.add('used'); left--;
      lines.push(SPOTS.find(s => s.id === b.dataset.id).text);
      m.el.querySelector('#s-left').textContent = left;
      m.el.querySelector('#s-log').innerHTML = lines.map(l => `<p>${esc(l)}</p>`).join('');
      if (left === 0) m.el.querySelector('#s-go').classList.remove('hidden');
    }));
    m.el.querySelector('#s-go').addEventListener('click', () => { m.close(); resolve(true); });
  });
}

// ---------- tree harvest (Fort Mandan / Fort Clatsop) ----------
export function treeGame({ fortName }) {
  return new Promise((resolve) => {
    const trees = shuffle([...Array(15)].map((_, i) => i < 3));
    let safe = 0, sick = 0, done = false;
    const m = openModal(`<div class="frame"><div class="mg-head"><h2>Cut timber for ${esc(fortName)}</h2>
      <div class="mg-stats">Good logs <b id="t-safe">0</b>/8 Diseased trees cut <b id="t-sick">0</b>/3</div></div>
      <p>Harvest 8 healthy trees. Three of these trees are diseased and rotten inside. Look closely at the trunks before you swing the axe. If you cut 3 diseased trees before you have 8 good logs, the delay costs you all of your early-finish bonus for this level.</p>
      <div class="trees">${trees.map((s, i) => `<button class="tree" data-i="${i}" aria-label="Tree ${i + 1}">${treeSvg(s)}</button>`).join('')}</div>
      <p id="tr-msg" style="margin-top:.6rem"></p><button class="btn moss big hidden" id="tr-go">Build the fort</button></div>`);
    m.el.querySelectorAll('.tree').forEach(b => b.addEventListener('click', () => {
      if (done || b.classList.contains('cut')) return;
      const i = Number(b.dataset.i); b.classList.add('cut'); b.disabled = true;
      if (trees[i]) { sick++; b.classList.add('sick'); b.insertAdjacentHTML('beforeend', '<div class="stamp"><span>Rotten</span></div>'); }
      else { safe++; b.insertAdjacentHTML('beforeend', '<div class="stamp"><span>Good log</span></div>'); }
      m.el.querySelector('#t-safe').textContent = safe; m.el.querySelector('#t-sick').textContent = sick;
      if (safe >= 8 || sick >= 3) {
        done = true;
        m.el.querySelector('#tr-msg').innerHTML = safe >= 8 ? '<span class="ok-text">You have all the timber you need.</span>'
          : '<span class="err">Too many rotten trees. Hauling in new timber takes extra time and costs your early-finish bonus.</span>';
        m.el.querySelector('#tr-go').classList.remove('hidden');
      }
    }));
    m.el.querySelector('#tr-go').addEventListener('click', () => { m.close(); resolve(safe >= 8); });
  });
}

// ---------- Columbia River rapids ----------
export function rapidsGame() {
  return new Promise((resolve) => {
    const tiles = shuffle([...Array(20)].map((_, i) => i < 6)); // true = rock
    let waves = 0, rocks = 0, done = false;
    const m = openModal(`<div class="frame"><div class="mg-head"><h2>Columbia River rapids</h2>
      <div class="mg-stats">Safe waves <b id="r-w">0</b>/7 Rocks hit <b id="r-r">0</b>/3</div></div>
      <p>The river roars through a narrow gorge. Pick your line through the whitewater one stretch at a time. Find 7 safe waves before you strike 3 hidden rocks, or the canoes capsize and you lose a quarter of your supplies.</p>
      <div class="river-grid">${tiles.map((_, i) => `<button class="rtile" data-i="${i}" aria-label="Stretch ${i + 1}"></button>`).join('')}</div>
      <p id="r-msg" style="margin-top:.6rem"></p><button class="btn moss big hidden" id="r-go">Continue</button></div>`);
    m.el.querySelectorAll('.rtile').forEach(b => b.addEventListener('click', () => {
      if (done || b.disabled) return;
      const i = Number(b.dataset.i); b.disabled = true;
      if (tiles[i]) { rocks++; b.classList.add('rock'); b.textContent = 'Rock'; } else { waves++; b.classList.add('wave'); b.textContent = 'Wave'; }
      m.el.querySelector('#r-w').textContent = waves; m.el.querySelector('#r-r').textContent = rocks;
      if (waves >= 7 || rocks >= 3) {
        done = true;
        m.el.querySelector('#r-msg').innerHTML = waves >= 7 ? '<span class="ok-text">You shoot the rapids and glide into calm water.</span>' : '<span class="err">CRACK! The canoes slam into the rocks and flip.</span>';
        m.el.querySelector('#r-go').classList.remove('hidden');
      }
    }));
    m.el.querySelector('#r-go').addEventListener('click', () => { m.close(); resolve(waves >= 7); });
  });
}

// ---------- medicine plants (Sacagawea) ----------
const PLANT_ICONS = {
  bark: '<svg viewBox="0 0 60 60"><rect x="18" y="6" width="24" height="48" rx="4" fill="#6b4a2f"/><path d="M24 10 V50 M30 8 V52 M36 10 V50" stroke="#3f2a18" stroke-width="2"/></svg>',
  salts: '<svg viewBox="0 0 60 60"><path d="M10 50 L20 30 L30 40 L40 22 L50 50 Z" fill="#e8e2d0" stroke="#9b917a" stroke-width="2"/><circle cx="24" cy="46" r="3" fill="#c9c0a8"/></svg>',
  petals: '<svg viewBox="0 0 60 60"><g fill="#c76a8a"><ellipse cx="30" cy="16" rx="7" ry="11"/><ellipse cx="30" cy="44" rx="7" ry="11"/><ellipse cx="16" cy="30" rx="11" ry="7"/><ellipse cx="44" cy="30" rx="11" ry="7"/></g><circle cx="30" cy="30" r="6" fill="#e8c04a"/></svg>',
  needles: '<svg viewBox="0 0 60 60"><g stroke="#2f5a3a" stroke-width="3" stroke-linecap="round"><path d="M30 54 V8"/><path d="M30 14 L18 22 M30 14 L42 22 M30 26 L16 34 M30 26 L44 34 M30 38 L18 46 M30 38 L42 46"/></g></svg>',
  mud: '<svg viewBox="0 0 60 60"><ellipse cx="30" cy="38" rx="22" ry="12" fill="#6e5a43"/><ellipse cx="24" cy="34" rx="6" ry="3" fill="#85705a"/></svg>',
  feather: '<svg viewBox="0 0 60 60"><path d="M14 50 C20 30 34 12 50 8 C46 26 32 42 14 50 Z" fill="#8c7b66"/><path d="M14 50 L44 14" stroke="#4a3b2b" stroke-width="2"/></svg>'
};
export function plantGame() {
  return new Promise((resolve) => {
    const kinds = [
      { id: 'bark', name: 'Tree Bark', need: true }, { id: 'salts', name: 'Mineral Salts', need: true }, { id: 'petals', name: 'Flower Petals', need: true },
      { id: 'needles', name: 'Pine Needles' }, { id: 'mud', name: 'River Mud' }, { id: 'feather', name: 'Hawk Feather' }
    ];
    const cards = shuffle(kinds.flatMap(k => [{ ...k }, { ...k }]));
    let tries = 9, open = [], lock = false; const found = new Set();
    const m = openModal(`<div class="frame"><div class="mg-head"><h2>Gather medicine for Sacagawea</h2>
      <div class="mg-stats">Tries left <b id="p-t">${tries}</b> Found <b id="p-f">0</b>/3</div></div>
      <p>Using the first aid kit and what the land offers, you need three things: <b>tree bark</b>, <b>mineral salts</b> and <b>flower petals</b>. Turn over two cards at a time to find matching pairs of each.</p>
      <div class="cards">${cards.map((c, i) => `<button class="card" data-i="${i}" aria-label="Face-down card"><div class="in"><div class="face back"><img src="/img/cards/back.png" alt=""></div><div class="face front"><div class="lbl-card">${PLANT_ICONS[c.id]}<span>${esc(c.name)}</span></div></div></div></button>`).join('')}</div>
      <p id="p-msg" style="margin-top:.6rem"></p><button class="btn moss big hidden" id="p-go">Continue</button></div>`);
    const finish = (ok) => { m.el.querySelector('#p-msg').innerHTML = ok ? '<span class="ok-text">You have everything you need for the medicine.</span>' : '<span class="err">You could not find all three in time.</span>'; m.el.querySelector('#p-go').classList.remove('hidden'); lock = true; };
    m.el.querySelectorAll('.card').forEach(b => b.addEventListener('click', async () => {
      const i = Number(b.dataset.i);
      if (lock || b.classList.contains('up')) return;
      b.classList.add('up'); open.push(i);
      if (open.length < 2) return;
      lock = true; tries--;
      const [a, c] = open; open = [];
      if (cards[a].id === cards[c].id) {
        [a, c].forEach(x => m.el.querySelector(`[data-i="${x}"]`).classList.add('matched'));
        if (cards[a].need) found.add(cards[a].id);
      } else {
        await new Promise(r => setTimeout(r, 900));
        [a, c].forEach(x => m.el.querySelector(`[data-i="${x}"]`).classList.remove('up'));
      }
      m.el.querySelector('#p-t').textContent = tries; m.el.querySelector('#p-f').textContent = found.size;
      lock = false;
      if (found.size === 3) finish(true); else if (tries <= 0) finish(false);
    }));
    m.el.querySelector('#p-go').addEventListener('click', () => { m.close(); resolve(found.size === 3); });
  });
}

// ---------- knowledge quiz (unlocks a market) ----------
export function quizGame({ need, place }) {
  return new Promise((resolve) => {
    const qs = S.cfg.quiz.filter(q => q && q.q && Array.isArray(q.a) && q.a.length >= 2);
    if (!qs.length) return resolve(true);
    let streak = 0, last = -1;
    const m = openModal(`<div class="frame" id="quiz"></div>`, { closable: true, onClose: () => resolve(streak >= need) });
    const box = m.el.querySelector('#quiz');
    const ask = (feedback = '') => {
      let qi; do { qi = rand(qs.length); } while (qs.length > 1 && qi === last); last = qi;
      const q = qs[qi];
      const order = shuffle(q.a.map((t, i) => ({ t, i })));
      box.innerHTML = `<button class="btn ghost modal-close" id="qx">Close</button><h2>Trader\u2019s questions at ${esc(place)}</h2>
        <p>The traders will only do business with explorers who know why they are here. Answer ${need} question${need > 1 ? 's' : ''} in a row correctly to open the market.</p>
        <div class="streak">${[...Array(need)].map((_, i) => `<i class="${i < streak ? 'on' : ''}"></i>`).join('')}</div>
        ${feedback}
        <h3 style="margin-top:.8rem">${esc(q.q)}</h3>
        <div class="quiz-opts">${order.map(o => `<button class="btn ghost" data-i="${o.i}">${esc(o.t)}</button>`).join('')}</div>`;
      box.querySelector('#qx').addEventListener('click', () => m.close());
      box.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => {
        if (Number(b.dataset.i) === Number(q.c)) {
          streak++;
          if (streak >= need) { m.close(); toast('Market unlocked!'); return; }
          ask('<p class="ok-text">Correct! Keep going.</p>');
        } else {
          streak = 0;
          ask(`<p class="err">Not quite. The answer was: ${esc(q.a[q.c])}. Your streak starts over.</p>`);
        }
      }));
    };
    ask();
  });
}
