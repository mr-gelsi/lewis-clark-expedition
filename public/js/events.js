// Story moments, trail encounters and the helpers they use.
import { S, G, scene, logScene, addPts, grantDiplomacy, lvl, save, toast, clamp, rand } from './core.js';
import { surgeryGame, treeGame, rapidsGame, plantGame, tileGame, huntGame, forageGame } from './games.js';

export const PERISH_TEXT = 'Your expedition has failed, and your crew has become part of the uncharted wilderness.';

// ---------- engine helpers ----------
export function logLine(t) {
  const r = S.st.run; if (!r) return;
  r.log.unshift(`Day ${r.days}: ${t}`); r.log = r.log.slice(0, 40);
}
export function consumeDay() {
  const r = S.st.run, inv = S.st.inv;
  r.days++;
  if (r.days % S.cfg.game.daysPerRation === 0) {
    inv.food = Math.max(0, inv.food - 1);
    if (r.flags.route !== 'north') inv.water = Math.max(0, inv.water - 1); // snow gives water in the mountains
    else logLine('The crew melts snow for water.');
  }
}
/** Spend whole days without moving (camp, rest, delays). Returns false if the level failed. */
export async function advanceDays(n, why) {
  for (let i = 0; i < n; i++) consumeDay();
  if (why) logLine(`${why} (+${n} day${n > 1 ? 's' : ''})`);
  G.topbar && G.topbar();
  return checkDays();
}
export async function checkDays() {
  const r = S.st.run;
  if (r && r.days > r.maxDays) { await G.outOfDays(); return false; }
  return true;
}
export async function killMembers(n, reason) {
  const st = S.st;
  n = Math.min(n, st.party);
  if (n <= 0) return true;
  st.party -= n;
  addPts('deaths', -n * S.cfg.game.deathPenalty, `${n} member${n > 1 ? 's' : ''} of the Corps lost`);
  logLine(reason || `${n} member${n > 1 ? 's' : ''} of the party died.`);
  if (st.party <= 0) { await G.perish('No one is left alive to carry on the mission.'); return false; }
  return true;
}
export function speed() {
  const r = S.st.run, c = S.cfg.crews[S.st.crew], t = S.cfg.travel;
  let sp = t[r.mode]?.speed || 10;
  if (c && r.mode === 'foot') sp = c.footSpeed ?? sp;
  if (c && r.mode === 'canoe') sp = c.canoeSpeed ?? sp;
  if (S.st.skills.pace) sp = sp / 0.85;
  return Math.round(sp * 10) / 10;
}
export function drain() {
  const r = S.st.run, t = S.cfg.travel, c = S.cfg.crews[S.st.crew];
  if (r.flags.route === 'south') return t.southRouteDrain;
  if (r.flags.route === 'north') return t.northPassDrain;
  if (r.flags.l4foot) return t.level4FootDrain;
  let d = t[r.mode]?.drain ?? 1;
  d *= c ? (c.drainMult || 1) : 1;
  if (!(S.st.inv.gear > 0)) d *= t.noGearDrainMult;
  return Math.round(d * 100) / 100;
}

// ---------- hunting & foraging (used at outposts, on the trail, and when supplies run out) ----------
export async function doHunt() {
  const st = S.st, r = st.run;
  if (st.inv.ammo <= 0) {
    await scene({ title: 'No ammunition', text: st.run?.flags.betrayed ? 'Charbonneau took every last musket ball when he fled. You cannot hunt.' : 'You have no ammunition left. Buy more at an outpost or try foraging.', choices: [{ label: 'Back', value: 1 }] });
    return { food: 0 };
  }
  const res = await huntGame({ huntIndex: r.hunts });
  r.hunts++;
  st.inv.food += res.food; st.inv.fur = (st.inv.fur || 0) + res.furs;
  logLine(`Hunting party brought back ${res.food} food${res.furs ? ` and ${res.furs} fur${res.furs > 1 ? 's' : ''}` : ''}.`);
  if (r.started) await advanceDays(S.cfg.hunting.days);
  save(); G.topbar(); return res;
}
export async function doForage() {
  const st = S.st, r = st.run;
  const res = await forageGame({ forageIndex: r.forages, sacagawea: !!st.comp.sacagawea, betrayed: !!r.flags.betrayed, noWater: r.flags.route === 'south' });
  r.forages++;
  st.inv.food += res.food; st.inv.water += res.water;
  logLine(`Foraging found ${res.food} food and ${res.water} water.`);
  for (const e of res.events) {
    if (e === 'snake') { if (!(await killMembers(1, 'A rattlesnake bite killed a member of the party.'))) return res; }
    if (e === 'poison') { r.energy = clamp(r.energy - S.cfg.foraging.energyLoss, 0, 100); logLine('Poison plants sickened the crew.'); }
  }
  if (r.energy <= 0) { await G.exhausted(); return res; }
  if (r.started) await advanceDays(S.cfg.foraging.days);
  save(); G.topbar(); return res;
}

// ---------- trail encounters ----------
function pickEncounter() {
  const t = S.st.skills.mapping || 0;
  const list = S.cfg.encounters.map(e => {
    let rate = Number(e.rate) || 0;
    if (e.id === 'spring') rate += 10 * t;
    if (e.id === 'heat' || e.id === 'cold') rate = Math.max(0, rate - 5 * t);
    return { ...e, rate };
  });
  const total = list.reduce((s, e) => s + e.rate, 0);
  let x = Math.random() * total;
  for (const e of list) { x -= e.rate; if (x <= 0) return e; }
  return list[list.length - 1];
}
export async function encounter() {
  const st = S.st, inv = st.inv, e = pickEncounter();
  const weatherBoost = st.skills.survival ? 2 : 0;
  switch (e.id) {
    case 'ambush': {
      const ok = await tileGame({ title: 'Warriors surround the camp', intro: 'At dawn a band of armed warriors who do not know your intentions surrounds the camp. How you respond in the next few minutes matters.', successTiles: e.success + (st.skills.defense ? 2 : 0) + (inv.gifts > 0 ? 1 : 0), goodLabel: 'Peace', badLabel: 'Raid' });
      if (ok) { await scene({ img: 'events/native-encounter.jpg', title: 'Peace holds', text: 'Your men stand ready but keep their rifles lowered. You make the sign for peace and offer a small gift. After a long, tense silence the warriors ride away.' }); }
      else {
        const lost = Math.ceil((inv.gifts || 0) * 0.25); inv.gifts -= lost;
        await scene({ img: 'events/native-encounter.jpg', title: 'Raided', text: `In the confusion, a quarter of your trade supplies (${lost} gifts) are carried off. Tracking down your scattered horses and gear costs 10 days.` });
        return advanceDays(10, 'Recovering from the raid');
      }
      return true;
    }
    case 'blizzard': {
      const ok = await tileGame({ title: 'A mountain storm', intro: 'The sky turns the color of slate and the wind starts to howl. Snow is coming, and fast.', successTiles: e.success + weatherBoost });
      if (ok) { await scene({ img: 'events/blizzard.jpg', title: 'Sheltered from the storm', text: 'The crew finds a cliff overhang and keeps the fires burning through the night. By morning the storm has passed.' }); return true; }
      const lost = Math.ceil(inv.food * 0.25); inv.food -= lost;
      await scene({ img: 'events/blizzard.jpg', title: 'Snowed in', text: `The blizzard buries the trail. ${lost} food spoils or is lost in the drifts, and you are trapped for 25 days.` });
      return advanceDays(25, 'Snowed in by a blizzard');
    }
    case 'heat': {
      const ok = await tileGame({ title: 'Extreme heat', intro: 'The sun beats down day after day. Creeks have dried to cracked mud.', successTiles: e.success + weatherBoost });
      if (ok) { await scene({ img: 'events/heatwave.jpg', title: 'Careful with the water', text: 'You ration water carefully and travel in the cool of early morning. The crew stays hydrated.' }); return true; }
      inv.water = 0;
      await scene({ img: 'events/heatwave.jpg', title: 'The water is gone', text: 'The heat cracks your water barrels and what is left evaporates. You have no water. You must find some right away.' });
      return true;
    }
    case 'cold': {
      const ok = await tileGame({ title: 'Bitter cold', intro: 'The temperature drops far below freezing. Fingers and toes start to go numb.', successTiles: e.success + weatherBoost });
      if (ok) { await scene({ img: 'events/frostbite.jpg', title: 'Fires through the night', text: 'You send every spare hand to gather firewood. The crew huddles close and makes it through the night.' }); return true; }
      await scene({ img: 'events/frostbite.jpg', title: 'Frozen', text: 'There is not enough firewood. One by one the crew falls asleep in the cold and does not wake up.', choices: [{ label: 'Continue', value: 1 }] });
      await G.perish('The crew died of hypothermia.'); return false;
    }
    case 'spring':
      inv.food += 5; inv.water += 5;
      await scene({ img: 'events/freshwater-stream.jpg', title: 'A freshwater spring', text: 'You find a clear spring in a valley full of game. The crew fills every barrel and the hunters bring back plenty of meat.\n\n+5 food and +5 water.' });
      return true;
    case 'camp':
      await scene({ img: 'events/basecamp.jpg', title: 'Base camp', text: 'A quiet stretch of trail. You make a routine camp, repair moccasins and update your maps. Nothing is lost and you continue on your route.' });
      return true;
    case 'trappers': {
      const c = await scene({ img: 'events/fur-traders.jpg', title: 'Stranded fur trappers', text: 'You come upon a small camp of fur trappers. Their boat sank and they are out of food. They ask for help.',
        choices: [{ label: 'Share rations (lose 2 food and 2 water)', value: 'share' }, { label: 'Pass by', value: 'pass' }, { label: 'Demand payment for help', value: 'demand' }] });
      if (c === 'share') { inv.food = Math.max(0, inv.food - 2); inv.water = Math.max(0, inv.water - 2); addPts('bonus', S.cfg.scoring.trappersShare, 'Helped stranded trappers'); }
      if (c === 'demand') { S.st.run.energy = clamp(S.st.run.energy - 20, 0, 100); await scene({ img: 'events/fur-traders.jpg', title: 'A fight breaks out', text: 'The trappers take offense and a brawl breaks out. Your crew is bruised and worn out. (-20 energy)' }); if (S.st.run.energy <= 0) { await G.exhausted(); return false; } }
      return true;
    }
    case 'delegation':
      inv.food += 10; inv.gifts = (inv.gifts || 0) + 2;
      await scene({ img: 'events/native-encounter.jpg', title: 'A peace delegation', text: 'Leaders of a nearby nation ride out to welcome the Corps. You share a pipe, exchange speeches through hand signs and trade gifts.\n\n+10 dried meat and +2 trade gifts.' });
      return true;
  }
  return true;
}

// random travel-mode hazards (once per level)
export async function modeHazard() {
  const r = S.st.run, t = S.cfg.travel;
  if (r.flags.hazardDone || r.flags.route || r.flags.l4foot) return true;
  if (r.mode === 'foot') {
    const chance = (S.st.inv.moccasins > 0 ? t.blisterChance / 3 : t.blisterChance) / 100;
    if (Math.random() >= chance) return true;
    r.flags.hazardDone = true; G.stopTravel();
    const c = await scene({ img: 'events/blisters.jpg', title: 'Blisters', text: 'After weeks of walking, many of the men have raw, bleeding blisters. Some can barely put on their moccasins.',
      choices: [{ label: 'Rest 2 days and treat their feet', value: 'rest' }, { label: 'Push on through the pain (-15 energy)', value: 'push' }] });
    if (c === 'rest') { r.energy = clamp(r.energy + 10, 0, 100); return advanceDays(2, 'Treating blisters'); }
    r.energy = clamp(r.energy - 15, 0, 100);
    if (r.energy <= 0) { await G.exhausted(); return false; }
    return true;
  }
  if (r.mode === 'canoe') {
    if (Math.random() >= t.rapidsChance / 100) return true;
    r.flags.hazardDone = true; G.stopTravel();
    const c = await scene({ img: 'events/rapids-event.jpg', title: 'Rapids ahead', text: 'White water churns around a bend in the river. You could carry the boats around on land, or try to run straight through.',
      choices: [{ label: 'Carry the boats around (+2 days)', value: 'portage' }, { label: 'Run the rapids', value: 'run' }] });
    if (c === 'portage') return advanceDays(2, 'Portaging around rapids');
    if (Math.random() < 0.6) { await scene({ img: 'events/rapids-event.jpg', title: 'Through the rapids', text: 'Paddles flash and the boats shoot through the spray. Everyone is soaked but safe.' }); return true; }
    const lost = Math.ceil(S.st.inv.food * 0.1); S.st.inv.food -= lost; r.energy = clamp(r.energy - 10, 0, 100);
    await scene({ img: 'events/rapids-event.jpg', title: 'Swamped', text: `A boat swamps and the crew drags it to shore. ${lost} food is ruined and everyone is exhausted. (-10 energy)` });
    if (r.energy <= 0) { await G.exhausted(); return false; }
    return true;
  }
  return true;
}

// ---------- story moments ----------
// Each returns true to keep traveling, false if the level ended or failed.
export const STORY = {
  // ===== LEVEL 1 =====
  async crewOutcome() {
    if (S.st.crew !== 'trappers') return true;
    await scene({ img: 'photos/trappers.jpg', title: 'Betrayed', text: 'You wake to the click of rifle hammers. The trappers you hired have turned on you. They tie your hands, take every rifle, every barrel of food and every coin of the Congressional grant, and vanish into the trees.\n\nYou are left for dead in the wilderness.', choices: [{ label: 'Continue', value: 1 }] });
    await G.perish('The trappers you hired robbed you and left you for dead. Maybe the cheapest-looking deal was not the only one to worry about.');
    return false;
  },
  async logBison() {
    return logScene({ type: 'animal', key: 'bison', img: 'photos/bison.jpg', title: 'New animal: Bison',
      text: 'The prairie is covered with an enormous shaggy creature. The herds stretch to the horizon, and they could be valuable for both meat and hides.\n\nDraw a bison in your physical field journal and write a short description of it.' });
  },
  async floyd() {
    const st = S.st;
    const c = await scene({ img: 'photos/floyd.jpg', title: 'Sergeant Floyd is sick', text: 'Sergeant Charles Floyd is doubled over with terrible pain in his stomach. Every bump of the boat makes him cry out. You think it may be acute appendicitis, which can be deadly, but no one in the Corps has ever performed surgery.',
      choices: [{ label: 'Hope he gets better on his own', value: 'wait' }, { label: 'Sedate him and attempt surgery', value: 'surgery', disabled: !(st.inv.medkit > 0), note: st.inv.medkit > 0 ? '' : 'You need a medical kit to attempt surgery.' }] });
    if (c === 'surgery') {
      st.inv.medkit--;
      await surgeryGame();
      await scene({ img: 'photos/floyd.jpg', title: 'Floyd dies', text: 'You get him open, but your fears are confirmed. His appendix has already burst and spread infection through his body. There is nothing anyone in 1804 could have done. Floyd dies on the operating table.' });
    } else {
      await scene({ img: 'photos/floyd.jpg', title: 'Floyd dies', text: 'The next day Floyd seems better and says the pain is gone. That night he is struck with a burning fever. Shaking and covered in sweat, he whispers, "I am going away. Please write me a letter." These are his last words.' });
    }
    if (!(await killMembers(1, 'Sergeant Charles Floyd died.'))) return false;
    const f = await scene({ img: 'photos/floyd-funeral.jpg', title: 'What to do for Floyd', text: 'The men are shaken. Charles Floyd is the first member of the Corps to die.',
      choices: [{ label: 'Bury him quickly to save time', value: 'quick' }, { label: 'Hold a respectful funeral and mark his grave (+2 days)', value: 'funeral' }] });
    if (f === 'funeral') {
      addPts('bonus', S.cfg.scoring.funeral, 'Honored Sergeant Floyd');
      if (!(await advanceDays(2, 'Funeral for Sergeant Floyd'))) return false;
      await logScene({ type: 'map', key: 'floydGrave', img: 'maps/floyd-grave.png', title: 'Mark Floyd\u2019s grave: August 20, 1804', text: 'You bury Floyd on a high bluff above the river and mark the spot with a cedar post.\n\nMark Floyd\u2019s grave and your route so far on your expedition map.' });
    }
    return true;
  },

  // ===== LEVEL 2 =====
  async logGrizzly() {
    const st = S.st;
    await logScene({ type: 'animal', key: 'grizzly', img: 'photos/grizzly.jpg', title: 'New animal: Grizzly Bear', text: 'Huge footprints line the riverbanks. Then you see it: a massive brown bear with a hump on its shoulders and long claws.\n\nDraw a grizzly bear in your physical field journal and write a short description of it.' });
    const c = await scene({ img: 'photos/grizzly-face.jpg', title: 'The grizzly charges!', text: 'As you finish your sketch, sticks snap behind you. A grizzly weighing more than 600 pounds bursts out of the brush and charges straight at the expedition.',
      choices: [{ label: 'Flee!', value: 'flee' }, { label: 'Stand and shoot', value: 'shoot', disabled: st.inv.ammo < 12, note: st.inv.ammo < 12 ? `It will take about 12 shots. You only have ${st.inv.ammo}.` : '' }] });
    if (c === 'shoot') {
      st.inv.ammo -= 12; st.inv.food += 6; st.inv.fur = (st.inv.fur || 0) + 1;
      await scene({ img: 'photos/grizzly-face.jpg', title: 'The bear goes down', text: 'Rifles crack again and again. It takes 12 shots before the great bear finally falls. The crew gets 6 days of rations and a heavy fur from it.' });
      return true;
    }
    await scene({ img: 'photos/grizzly-face.jpg', title: 'Scattered', text: 'You yell to run and the men scatter. The bear catches two of them before it finally loses interest. It takes three days to regroup and recover.' });
    if (!(await killMembers(2, 'A grizzly bear killed two men.'))) return false;
    st.run.energy = clamp(st.run.energy - 25, 0, 100);
    if (st.run.energy <= 0) { await G.exhausted(); return false; }
    return advanceDays(3, 'Regrouping after the bear attack');
  },
  async fork() {
    const r = S.st.run;
    const c = await scene({ img: 'photos/fork.jpg', title: 'A fork in the river', text: 'The river splits in two. The north branch looks clearer and resembles the Missouri you have been following. The south branch is swift and narrow with lots of rocks. Your men argue about which way to go.',
      choices: [{ label: 'Go north: everyone thinks it is this way', value: 'north' }, { label: 'Go south: swift, narrow and rocky', value: 'south' }] });
    await logScene({ type: 'map', key: 'missouriFork', img: 'maps/missouri-fork.png', title: 'Log the fork on your map', text: 'Mark the place where the Missouri River splits into two branches.' });
    if (c === 'north') {
      r.flags.north = true;
      await scene({ img: 'photos/blackfeet.jpg', title: 'Wrong way', text: 'The north branch carries you along for days. Then it narrows and dead-ends near Blackfeet territory. This is not the Missouri. You have to turn around and paddle back to the fork, adding 50 miles to your journey.' });
      logLine('Turned back from the north fork. +50 miles.');
    } else logLine('Took the south fork.');
    return true;
  },
  async fastRiver() {
    const r = S.st.run;
    const c = await scene({ img: 'photos/river-gorge.jpg', title: 'The river is getting fast', text: 'Soon you hear a dull roar in the distance. The current is pulling harder and harder and it is getting difficult to steer.',
      choices: [{ label: 'Stay on the river', value: 'river' }, { label: 'Get out and hike the rest of the way', value: 'hike' }] });
    if (c === 'river') {
      const ok = await scene({ img: 'photos/great-falls.jpg', title: 'A waterfall!', text: 'Too late, you see where the roar is coming from. The river drops off the edge of an enormous waterfall. The boats tip and you are thrown into the churning water.', choices: [{ label: 'Swim for the shore!', value: Math.random() < 0.5 }] });
      if (!ok) { await G.perish('You were swept over the falls.'); return false; }
      await scene({ img: 'photos/falls-camp.jpg', title: 'You made it to shore', text: 'Gasping, you drag yourselves onto the rocks. The boats are gone over the falls. From here you go on foot.' });
    } else {
      await scene({ img: 'photos/hike.jpg', title: 'On foot', text: 'You pull the canoes ashore and hike around the roaring water. The men grumble, but you know it is for their safety.' });
    }
    r.mode = 'foot'; logLine('Now traveling on foot.');
    return true;
  },
  async logRattlesnake() {
    return logScene({ type: 'animal', key: 'rattlesnake', img: 'photos/rattlesnake.jpg', title: 'New animal: Rattlesnake', text: 'Your men jump back yelling. Coiled on the trail is a snake with a rattle on the end of its tail that buzzes when it is angry.\n\nDraw a rattlesnake in your physical field journal and write a short description of it.' });
  },

  // ===== LEVEL 3 =====
  async sacagaweaIll() {
    const st = S.st;
    if (!st.comp.sacagawea) return true;
    const c = await scene({ img: 'photos/sacagawea-ill.jpg', title: 'Sacagawea is sick', text: 'Sacagawea has fallen dangerously ill. She has a high fever and cannot travel. Her knowledge of this land will be critical, and the crew watches to see what you will do.',
      choices: [{ label: 'Try bloodletting', value: 'blood' }, { label: 'Use the first aid kit and gather healing plants', value: 'aid', disabled: !(st.inv.medkit > 0), note: st.inv.medkit > 0 ? '' : 'You have no medical kit left.' }] });
    let healed = false;
    if (c === 'aid') { st.inv.medkit--; healed = await plantGame(); }
    if (healed) {
      addPts('bonus', S.cfg.scoring.sacagaweaHealed, 'Saved Sacagawea');
      grantDiplomacy('sacagawea');
      await scene({ img: 'photos/sacagawea.jpg', title: 'Sacagawea recovers', text: 'After a few days of medicine made from bark, mineral salts and flower petals, her fever breaks. Sacagawea is soon back on her feet, pointing out landmarks she remembers from her childhood.' });
      return true;
    }
    await scene({ img: 'photos/sacagawea-ill.jpg', title: 'Sacagawea dies', text: c === 'blood' ? 'Bloodletting, a common medical practice of the time, only weakens her further. Sacagawea dies in the night.' : 'Without the right medicine her fever worsens. Sacagawea dies in the night.' });
    st.comp.sacagawea = false;
    if (!(await killMembers(1, 'Sacagawea died.'))) return false;
    if (st.comp.charbonneau) {
      st.comp.charbonneau = false; st.party = Math.max(0, st.party - 1);
      st.inv.food = 0; st.inv.water = 0; st.inv.ammo = 0; st.run.flags.betrayed = true;
      await scene({ img: 'photos/campfire.jpg', title: 'Charbonneau disappears', text: 'Grieving and angry, Toussaint Charbonneau slips away in the night. In the morning you discover he took all of your food, all of your water and every bit of ammunition.' });
    }
    return true;
  },
  async logElk() {
    return logScene({ type: 'animal', key: 'elk', img: 'photos/elk.jpg', title: 'New animal: Elk', text: 'You meet a giant animal. It is not as thick as the bison, but it is taller, with huge antlers that fork out from the top of its head.\n\nDraw an elk in your physical field journal and write a short description of it.' });
  },
  async shoshone() {
    const st = S.st, r = st.run;
    await scene({ img: 'photos/shoshone-meet.jpg', title: 'The Shoshone', text: st.comp.sacagawea
      ? 'A group of Shoshone riders appears on a ridge. Suddenly Sacagawea begins to cry with joy. Their leader, Chief Cameahwait, is her brother! She was taken from her people in a raid when she was twelve. Now you must win the trust of the whole tribe.'
      : 'A group of Shoshone riders appears on a ridge, watching you with weapons ready. With no one to translate, you must rely on hand signs and good judgment to win their trust.' });
    const steps = [
      { q: 'How do you approach the Shoshone camp?', good: 'Approach with kindness and patience', bad: 'Approach confident and tough' },
      { q: 'They show you their horses and goods.', good: 'Compliment the quality of their items', bad: 'Haggle hard to get a good deal' },
      { q: 'The trading begins.', good: 'Ask thoughtful questions about the items', bad: 'Act like you are not very interested' },
      { q: 'It is time to close the deal.', good: 'Offer to form an alliance through the trade', bad: 'Tell them how much you will miss the valuable things you are giving up' }
    ];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      let ok = false;
      while (!ok) {
        const opts = [{ label: s.good, value: true }, { label: s.bad, value: false }];
        if (Math.random() < 0.5) opts.reverse();
        ok = await scene({ img: 'photos/shoshone-camp.jpg', title: `Diplomacy, step ${i + 1} of 4`, text: s.q, choices: opts });
        if (!ok) {
          await scene({ img: 'photos/shoshone-camp.jpg', title: 'The council grows cold', text: 'The Shoshone leaders exchange looks and walk away. You must wait two days before they will talk again.', choices: [{ label: 'Wait and try again', value: 1 }] });
          if (!(await advanceDays(2, 'Waiting for the Shoshone council'))) return false;
        }
      }
    }
    st.inv.horses = (st.inv.horses || 0) + st.party;
    st.comp.toby = true; st.party += 1; st.peakParty = Math.max(st.peakParty, st.party);
    grantDiplomacy('summit'); grantDiplomacy('toby');
    await scene({ img: 'photos/horses.jpg', title: 'An alliance', text: `The Shoshone agree to trade. They give you a pack horse for every member of the party (${st.party - 1} horses) and an experienced mountain guide the men call Toby, who has traveled to the great western waters before.` });
    await logScene({ type: 'map', key: 'shoshoneCamp', img: 'maps/shoshone.png', title: 'Log the Shoshone camp: August 13, 1805', text: 'Mark the Shoshone village and your route on your expedition map.' });
    const visit = await scene({ img: 'photos/shoshone-camp.jpg', title: 'The Shoshone village', text: 'Before you leave, the village offers to trade more supplies.', choices: [{ label: 'Visit the village market', value: true }, { label: 'Continue without trading', value: false }] });
    if (visit) await G.openOutpost('shoshone');
    await logScene({ type: 'note', key: 'noPassage', img: 'photos/mountains.jpg', title: 'There is no Northwest Passage', text: 'Before you set out, Toby warns you: no water route crosses the Continental Divide. The great hope of President Jefferson, an easy river road to the Pacific, does not exist. Only land routes cross these mountains.\n\nWrite "No Northwest Passage" in your physical field journal and explain what Toby told you.' });
    const route = await scene({ img: 'photos/bitterroot.jpg', title: 'Crossing the Bitterroot Mountains', text: 'Toby says there are two ways west. Your party will travel by horse from here.',
      choices: [{ label: 'Southern Desert Route: flat and easy riding', value: 'south' }, { label: 'Northern Mountain Pass: steep, snowy and slow', value: 'north' }] });
    r.mode = 'horse'; r.flags.route = route; r.flags.noRest = true;
    logLine(route === 'south' ? 'Heading south across the desert.' : 'Climbing into the Bitterroot Mountains.');
    if (route === 'south') await scene({ img: 'photos/desert.jpg', title: 'Into the desert', text: 'The ground is flat and the horses move well. But there is no water anywhere. Your barrels begin to run low almost at once.' });
    else await scene({ img: 'photos/snow-climb.jpg', title: 'Into the mountains', text: 'The trail climbs into deep snow. At least there is plenty of snow to melt for water, so you will not need your water barrels. But the cold and the steep climb are wearing the crew down fast, and there is nowhere to stop and rest.' });
    return true;
  },

  // ===== LEVEL 4 =====
  async rapids() {
    const st = S.st, r = st.run;
    if (r.mode !== 'canoe') return true;
    const ok = await rapidsGame();
    if (ok) { await scene({ img: 'photos/columbia.jpg', title: 'Master paddlers', text: 'Your crew has become skilled with the canoes. You shoot through the Columbia\u2019s whitewater and keep every bit of your supplies.' }); return true; }
    const inv = st.inv; const lose = (k) => { const n = Math.ceil((inv[k] || 0) * 0.25); inv[k] = (inv[k] || 0) - n; return n; };
    const f = lose('food'), w = lose('water'); lose('ammo'); lose('gifts'); lose('medkit');
    r.mode = 'foot';
    await scene({ img: 'photos/columbia-2.jpg', title: 'Capsized!', text: `The canoes flip and the river swallows a quarter of your supplies, including ${f} food and ${w} water. The canoes are wrecked. You will have to travel the rest of the way on foot.` });
    logLine('Canoes wrecked in the rapids. Now on foot.');
    return true;
  },
  async logEagle() {
    return logScene({ type: 'animal', key: 'eagle', img: 'photos/bald-eagle.jpg', title: 'New animal: Bald Eagle', text: 'A great eagle with a snow-white head and a hooked yellow beak watches from a tree above the river.\n\nDraw a bald eagle in your physical field journal and write a short description of it.' });
  },
  async pacific() {
    await scene({ img: 'photos/pacific.jpg', epic: true, title: 'Ocean in view! O! the joy!',
      text: 'The river widens, the air smells of salt, and the roar ahead is not rapids but waves. After more than 4,000 miles, two winters and countless dangers, the Corps of Discovery has reached the Pacific Ocean.\n\nThe men cheer, fire their rifles into the air and throw their hats. You have crossed a continent. President Jefferson will hear about this.',
      choices: [{ label: 'Celebrate with the crew!', value: 1 }] });
    const v = await scene({ img: 'photos/vote.jpg', title: 'Where should we spend the winter?', text: 'Winter is coming and the Corps needs a place to build its quarters. You could decide yourself, as captains always have. Or you could do something no American expedition has done before: let everyone vote, including York, an enslaved African American man, and Sacagawea, a Native American woman.',
      choices: [{ label: 'Hold a democratic vote of the whole crew', value: 'vote' }, { label: 'Tell the group where to build', value: 'order' }] });
    if (v === 'vote') {
      addPts('bonus', S.cfg.scoring.vote, 'Held a democratic vote'); grantDiplomacy('vote');
      await scene({ img: 'photos/vote.jpg', title: 'The Corps votes', text: 'One by one, every member of the Corps casts a vote, including York and Sacagawea. The crew chooses the south side of the Columbia, where elk are plentiful. It is a remarkable moment in American history.' });
    } else {
      addPts('bonus', S.cfg.scoring.noVote, 'Did not let the crew vote');
      await scene({ img: 'photos/vote.jpg', title: 'Orders given', text: 'You pick the spot yourself. The crew obeys, but some grumble that after everything they have been through together, they deserved a say.' });
    }
    return true;
  },

  // ===== level endings =====
  async end() {
    const n = S.st.level;
    if (n === 1) {
      await scene({ img: 'photos/winter-sky.jpg', title: 'Winter is coming', text: 'It is November. The days are short, snow covers the ground and the river is starting to freeze. You have reached the villages of the Mandan and Hidatsa people. This is where you will build a V-shaped winter fort with 8 cabins, a 16-foot wall, fireplaces and beds.' });
      const ok = await treeGame({ fortName: 'Fort Mandan' });
      if (!ok) S.st.run.timeBonusLost = true;
      await scene({ img: 'photos/fort-mandan.jpg', title: 'Fort Mandan is built', text: 'After a month of hard work the fort stands strong against the winter. It is a safe place to wait for spring.' });
      await logScene({ type: 'map', key: 'fortMandan', img: 'maps/fort-mandan.png', title: 'Log Fort Mandan: completed November 20, 1804', text: 'Mark Fort Mandan and your route on your expedition map.' });
    } else if (n === 2) {
      await scene({ img: 'photos/great-falls.jpg', title: 'The Great Falls of the Missouri', text: 'You reach a series of waterfalls larger than any the crew has ever seen. It will take weeks to carry everything around them, but first you stop to take in the view.' });
      await logScene({ type: 'map', key: 'greatFalls', img: 'maps/great-falls.png', title: 'Map the Great Falls: June 1805', text: 'Mark the Great Falls and your route on your expedition map. Write a description of the falls in your journal.' });
    } else if (n === 3) {
      await STORY.nezPerceRescue(true);
    } else if (n === 4) {
      await scene({ img: 'photos/vote.jpg', title: 'Building winter quarters', text: 'You have reached the spot chosen for your winter fort near the Pacific coast. It rains nearly every day. You must harvest timber and build quickly.' });
      const ok = await treeGame({ fortName: 'Fort Clatsop' });
      if (!ok) S.st.run.timeBonusLost = true;
      await scene({ img: 'photos/fort-clatsop.jpg', title: 'Fort Clatsop', text: 'Fort Clatsop is finished: two rows of cabins facing a parade ground, surrounded by a wall of logs. The Corps will spend the winter here, making salt, sewing moccasins and finishing their maps and journals for President Jefferson.' });
      await logScene({ type: 'map', key: 'fortClatsop', img: 'maps/fort-clatsop.png', title: 'Log your final winter quarters', text: 'Mark Fort Clatsop on your master expedition map. This is the end of the trail west.' });
      await scene({ img: 'photos/captains.jpg', epic: true, title: 'You made it!', text: 'Congratulations, Captains! You led the Corps of Discovery safely across the continent. In the spring you will have a safe trip back east to report to President Jefferson.', choices: [{ label: 'See President Jefferson\u2019s evaluation', value: 1 }] });
    }
    return true;
  },
  async nezPerceRescue(arrived) {
    if (!arrived) await scene({ img: 'photos/snow-forest.jpg', title: 'Starving in the snow', text: 'The crew can go no farther. Men collapse in the snow, too weak to stand. You have eaten some of the horses and there is nothing left.\n\nThen, through the trees, come riders. A people who call themselves the Nez Perce have found you.', choices: [{ label: 'Continue', value: 1 }] });
    await scene({ img: 'photos/nez-perce.jpg', title: 'Rescued by the Nez Perce', text: 'The Nez Perce bring the starving crew down from the mountains to their village. They give you food, shelter and care until your strength returns. They have quite literally saved your lives. October 6, 1805.' });
    await logScene({ type: 'map', key: 'nezPerce', img: 'maps/nez-perce.png', title: 'Log the Nez Perce camp: October 6, 1805', text: 'Mark the Nez Perce village and your route on your expedition map.' });
    return true;
  }
};

export { rand };
