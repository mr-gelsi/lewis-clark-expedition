// Default game settings. Teachers change these from the /admin page;
// their changes are stored in D1 and merged over these defaults.
export const DEFAULT_CONFIG = {
  version: 1,
  game: {
    secondsPerDay: 1,          // real seconds per travel day
    daysPerRation: 10,         // every N travel days uses 1 food + 1 water
    startingGrant: 2500,       // Congressional grant at the start of Level 1
    startingParty: 2,          // the two captains (the student players)
    deathPenalty: 1,           // approval lost for each party member who dies
    earlyDaysPerPoint: 5,      // +1 approval for every N unused days in a level
    startingEnergy: 100
  },
  travel: {
    foot:  { label: 'Overland hike on foot', speed: 10, drain: 1.0 },
    canoe: { label: 'River keelboat / canoe', speed: 15, drain: 0.5 },
    horse: { label: 'Pack horses', speed: 13, drain: 0.8 },
    noGearDrainMult: 1.5,      // drain multiplier if the party owns no travel gear
    campDays: 1, campEnergy: 25,
    restDays: 3,
    blisterChance: 3,          // % chance per day of a blister event when on foot (max once per level)
    rapidsChance: 3,           // % chance per day of a rapids event by canoe (max once per level)
    southRouteDrain: 9,        // Level 3 Southern Desert Route: energy lost per day
    northPassDrain: 4,         // Level 3 Northern Mountain Pass: energy lost per day
    level4FootDrain: 14        // Level 4: hiking from the Nez Perce camp
  },
  crews: {
    trappers: { name: 'Local Trappers', cost: 1000, size: 31, drainMult: 1, footSpeed: 10, canoeSpeed: 15,
      desc: 'High regional survival skills, but they demand higher government pay. You are not sure you can trust them.' },
    soldiers: { name: 'Trained Soldiers', cost: 700, size: 31, drainMult: 1, footSpeed: 10, canoeSpeed: 15,
      desc: 'Highly disciplined, excellent with firearms, and expert boat handlers.' },
    laborers: { name: 'Cheap Laborers', cost: 400, size: 31, drainMult: 1.25, footSpeed: 8, canoeSpeed: 12,
      desc: 'Not much to look at, but they will work for cheap.' },
    none: { name: 'No Crew', cost: 0, size: 0, drainMult: 10, footSpeed: 10, canoeSpeed: 15,
      desc: 'Save all your money for yourself.' }
  },
  levels: [
    {
      num: 1, name: 'Camp Wood', start: 'Camp Wood', password: '828000', gateOpen: false,
      maxDays: 170, miles: 1070, outpost: 'campWood', modes: ['foot'], encounterMiles: [700],
      events: { crewOutcome: 130, logBison: 500, floyd: 900 },
      intro: 'Camp Wood sits where the Missouri River pours into the Mississippi, just upriver from St. Louis. All winter the Corps has drilled, packed and repaired gear here. President Jefferson has asked you to cross the new Louisiana Territory, find a water route to the Pacific, and record every plant, animal and people you meet.',
      rumors: 'Traders say the land ahead is wide open prairie, flat and covered in tall grasses. Game is plentiful, but the summer sun is hard on a walking party and the mosquitoes are fierce.',
      startImage: 'photos/keelboat.jpg', travelImage: 'photos/forest.jpg'
    },
    {
      num: 2, name: 'Fort Mandan', start: 'Fort Mandan Trading Post', password: 'MANDAN', gateOpen: false,
      maxDays: 90, miles: 560, outpost: 'fortMandan', modes: ['canoe'], encounterMiles: [200],
      events: { logGrizzly: 120, fork: 305, fastRiver: 520, logRattlesnake: 540 },
      intro: 'The snow is melting around Fort Mandan. The Mandan and Hidatsa villages have traded corn and stories with you all winter. The river is open again and it is time to push west into country no American has mapped.',
      rumors: 'Hunters warn of enormous bears along the upper river that do not run from a rifle. Nobody agrees on which branch of the river leads to the mountains.',
      startImage: 'photos/fort-mandan.jpg', travelImage: 'photos/river-gorge.jpg'
    },
    {
      num: 3, name: 'Great Falls', start: 'Great Falls', password: 'FALLS', gateOpen: false,
      maxDays: 140, miles: 1200, outpost: null, modes: ['foot'], encounterMiles: [399],
      events: { sacagaweaIll: 450, logElk: 550, shoshone: 700 },
      intro: 'You have carried canoes and supplies around the thundering Great Falls of the Missouri. Ahead, the river narrows and the mountains rise. There is no trading post here, only what you carry and what the land provides.',
      rumors: 'The terrain ahead is rugged mountains that are hard to travel through. Snow comes early up high, and there is danger from animals. Some say a people called the Shoshone keep horses near the mountain passes.',
      startImage: 'photos/great-falls.jpg', travelImage: 'photos/mountains.jpg'
    },
    {
      num: 4, name: 'Nez Perce Camp', start: 'Nez Perce Canoe Outpost', password: 'NEZPERCE', gateOpen: false,
      maxDays: 100, miles: 1000, outpost: 'nezPerce', modes: ['foot', 'canoe'], encounterMiles: [50, 750],
      events: { rapids: 450, logEagle: 630, pacific: 980 },
      intro: 'The Nez Perce saved your starving crew and nursed them back to health. They say the rivers to the west run all the way to the great salt water. Your horses can stay with them while you go on by water.',
      rumors: 'The rivers west of here are swift and full of whitewater. Experienced paddlers can make fast time, but the crew is still weak from the mountains and a long walk could break them.',
      startImage: 'photos/nez-perce.jpg', travelImage: 'photos/columbia-2.jpg'
    }
  ],
  outposts: {
    campWood: {
      name: 'Camp Wood (St. Louis)', food: 5, water: 5, ammo: 2,
      buy: [
        { id: 'gear', name: 'Travel Gear', desc: 'Tents, compass, hatchets, soap, packs. Without it your crew tires 50% faster.', price: 700, qty: 1 },
        { id: 'ammo', name: 'Weapons & Ammunition', desc: 'Rifles, flints, musket balls and powder. Comes with 40 shots.', price: 700, qty: 40 },
        { id: 'gifts', name: 'Trade Gifts', desc: 'Mirrors, silk, beads and tobacco for the nations you meet.', price: 400, qty: 10 },
        { id: 'medkit', name: 'Medical Kit', desc: 'Medicine, surgery tools, mosquito nets.', price: 200, qty: 2 },
        { id: 'survey', name: 'Survey Equipment', desc: 'Surveyor compass, telescope, chronometer. +1 approval for each landmark you log.', price: 200, qty: 1 }
      ],
      sell: [ { id: 'fur', name: 'Furs', price: 25 }, { id: 'crafts', name: 'Native Crafts', price: 20 }, { id: 'minerals', name: 'Mineral Samples', price: 15 } ]
    },
    fortMandan: {
      name: 'Fort Mandan Trading Post', food: 15, water: 8, ammo: 3,
      buy: [
        { id: 'food', name: 'Corn & Millet', desc: '4 ration packs of dried corn and millet.', price: 50, qty: 4 },
        { id: 'fur', name: 'Bison Hides', desc: 'Warm robes for cold nights. Can be resold later.', price: 30, qty: 1 },
        { id: 'food', name: 'Dried Meat', desc: '3 ration packs of jerked bison.', price: 40, qty: 3 }
      ],
      sell: [ { id: 'tools', name: 'Iron Tools', price: 40 }, { id: 'gifts', name: 'Glass Beads & Tobacco', price: 35 } ]
    },
    shoshone: {
      name: 'Shoshone Village', food: 20, water: 12, ammo: 5,
      buy: [
        { id: 'horses', name: 'Pack Horse', desc: 'Carries gear over the mountains.', price: 60, qty: 1 },
        { id: 'moccasins', name: 'Leather Moccasins', desc: 'Soft, tough footwear. Blisters become much less likely.', price: 30, qty: 1 },
        { id: 'food', name: 'Dried Roots', desc: '3 ration packs of dried roots.', price: 45, qty: 3 }
      ],
      sell: [ { id: 'tools', name: 'Trade Knives', price: 30 }, { id: 'gifts', name: 'Mirrors', price: 30 }, { id: 'kettle', name: 'Copper Kettle', price: 40 } ]
    },
    nezPerce: {
      name: 'Nez Perce Canoe Outpost', food: 12, water: 6, ammo: 4,
      buy: [
        { id: 'canoes', name: 'Dugout Canoe', desc: 'A finished canoe, ready for the river.', price: 80, qty: 1 },
        { id: 'food', name: 'Dried Salmon', desc: '4 ration packs of smoked salmon.', price: 40, qty: 4 },
        { id: 'food', name: 'Camas Bulbs', desc: '3 ration packs of roasted camas.', price: 30, qty: 3 }
      ],
      sell: [ { id: 'gifts', name: 'Blue Beads', price: 30 }, { id: 'buttons', name: 'Brass Buttons', price: 10 }, { id: 'horses', name: 'Horses', price: 35 } ]
    }
  },
  haggle: { chance: 50, discount: 5, markup: 5, skilledChance: 75, skilledDiscount: 10 },
  // rate = how often this encounter is picked (relative %). success = good tiles out of 10.
  encounters: [
    { id: 'ambush', name: 'Hostile Ambush', rate: 5, success: 7 },
    { id: 'blizzard', name: 'Blizzard / Mountain Storm', rate: 10, success: 6 },
    { id: 'heat', name: 'Extreme Heat / River Drought', rate: 10, success: 7 },
    { id: 'cold', name: 'Extreme Cold / Frostbite', rate: 10, success: 7 },
    { id: 'spring', name: 'Freshwater Spring & Wild Game', rate: 10, success: 10 },
    { id: 'camp', name: 'Expedition Base Camp', rate: 30, success: 10 },
    { id: 'trappers', name: 'Stranded Fur Trappers', rate: 5, success: 10 },
    { id: 'delegation', name: 'Native Peace Delegation', rate: 5, success: 10 }
  ],
  skills: {
    mapping:  { name: 'Trail & River Mapping', cost: 50, tierCost: 200, maxTier: 3, desc: 'Each tier: +10% chance of finding freshwater springs and 5% less risk of extreme heat or cold.' },
    survival: { name: 'Wilderness Survival Training', cost: 100, desc: 'Turns 2 failure tiles into success tiles in blizzard, heat and cold encounters.' },
    defense:  { name: 'Tactical Defense Training', cost: 150, desc: 'Turns 2 failure tiles into success tiles in hostile ambush encounters.' },
    barter:   { name: 'Native Diplomacy & Barter', cost: 100, desc: 'Haggling succeeds 75% of the time and saves 10%.' },
    pace:     { name: 'Master Scout Pace Training', cost: 200, desc: 'Your crew covers ground 15% faster.' }
  },
  hunting: {
    animalsByHunt: [5, 3, 1], // animals hidden behind the 10 spots on hunt 1, 2, 3+ of a level
    shots: 3, days: 1,
    rations: { bird: 1, squirrel: 1, raccoon: 2, deer: 3, bear: 4, bison: 4 }
  },
  foraging: {
    layouts: [ { good: 6, bad: 2 }, { good: 8, bad: 5 }, { good: 10, bad: 8 } ], // pairs; cards = 2*(good+bad)
    choices: 10, sacagaweaBonus: 2, energyLoss: 25, days: 1
  },
  scoring: {
    journal: 30, mapping: 25, diplomacy: 20, survival: 15,
    funeral: 10, sacagaweaHealed: 15, vote: 20, noVote: -10, trappersShare: 15, recruit: 3
  },
  quiz: [
    { q: 'What was the Louisiana Territory?', a: ['A huge region of land west of the Mississippi River', 'A small colony on the Atlantic coast', 'An island in the Gulf of Mexico', 'A state in New England'], c: 0 },
    { q: 'Which country controlled the Louisiana Territory in 1801?', a: ['Great Britain', 'France', 'Mexico', 'Russia'], c: 1 },
    { q: 'Why was the port of New Orleans so important to Americans?', a: ['It was the nation\u2019s capital', 'Western farmers shipped their crops down the Mississippi through it', 'It was the only place to buy horses', 'It was where the Constitution was signed'], c: 1 },
    { q: 'What was Jefferson worried France would do?', a: ['Close the Mississippi and New Orleans to American trade', 'Invade Boston', 'Stop selling tea', 'Build a canal'], c: 0 },
    { q: 'What did Jefferson first try to buy from France?', a: ['All of Canada', 'The city of New Orleans', 'Florida and Texas', 'The Great Lakes'], c: 1 },
    { q: 'Why did Jefferson worry he could not buy land for the United States?', a: ['Congress had no money', 'The Constitution does not say the president can buy land', 'France refused to talk', 'Spain owned the land'], c: 1 },
    { q: 'Instead of a plain purchase, how did Jefferson make the deal official?', a: ['As a treaty approved by the Senate', 'As a royal decree', 'By winning a war', 'With a handshake only'], c: 0 },
    { q: 'How did France respond to the American offer?', a: ['It declared war', 'It offered to sell the entire Louisiana Territory', 'It offered only New Orleans for free', 'It ignored the offer'], c: 1 },
    { q: 'About how much did the United States pay for the Louisiana Purchase?', a: ['$15 million', '$2,500', '$1 billion', '$100'], c: 0 },
    { q: 'What did the Louisiana Purchase do to the size of the United States?', a: ['Cut it in half', 'Roughly doubled it', 'Made no difference', 'Tripled the number of states overnight'], c: 1 },
    { q: 'What had to happen to the territory before people could begin settling it?', a: ['It had to be explored and mapped', 'It had to be sold to Spain', 'It had to be fenced in', 'Nothing at all'], c: 0 },
    { q: 'Who led the expedition to explore the Louisiana Territory?', a: ['George Washington and John Adams', 'Meriwether Lewis and William Clark', 'Daniel Boone and Davy Crockett', 'Thomas Paine and Ben Franklin'], c: 1 },
    { q: 'What did Jefferson ask the explorers to report about?', a: ['Plants, animals, rivers, land and the Native peoples they met', 'Gold mines only', 'Only the weather', 'The best places for hotels'], c: 0 },
    { q: 'What discovery did Jefferson most hope the explorers would make?', a: ['A Northwest Passage, a water route to the Pacific', 'A lost city of gold', 'The North Pole', 'A new ocean'], c: 0 },
    { q: 'Why would a Northwest Passage have been so valuable?', a: ['It would make trade with Asia faster and easier', 'It would end all wars', 'It would stop winter', 'It would make farms bigger'], c: 0 },
    { q: 'Why did Jefferson send gifts for Native Americans with the expedition?', a: ['To build peace and trade along the route', 'To throw away extra money', 'To trick them into moving', 'Because the gifts were too heavy to keep'], c: 0 }
  ]
};

export const LEVEL_EVENT_LABELS = {
  crewOutcome: 'Crew selection outcome', logBison: 'Animal log: Bison', floyd: 'Sergeant Floyd\u2019s illness',
  logGrizzly: 'Animal log: Grizzly Bear + charge', fork: 'Fork of the Missouri', fastRiver: 'Fast river / waterfall', logRattlesnake: 'Animal log: Rattlesnake',
  sacagaweaIll: 'Sacagawea\u2019s illness', logElk: 'Animal log: Elk', shoshone: 'Shoshone summit + Bitterroot crossing',
  rapids: 'Columbia River rapids', logEagle: 'Animal log: Bald Eagle', pacific: 'Reaching the Pacific + crew vote'
};
