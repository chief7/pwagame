import { dayNumber, minuteOfDay } from '../game/clock';
import { stageLevel, type StageId } from '../game/defs/levels';
import type { ObjectKind } from '../game/defs/objects';
import type { AnimalWords, ItemWords, ObjectWords, Strings } from './types';

const ITEM: ItemWords<{ one: string; many: string; short: [string, string] }> = {
  coconut: { one: 'coconut', many: 'coconuts', short: ['coconut', 'coconuts'] },
  berries: { one: 'handful of berries', many: 'handfuls of berries', short: ['berries', 'berries'] },
  mushroom: { one: 'mushroom', many: 'mushrooms', short: ['mushroom', 'mushrooms'] },
  wood: { one: 'piece of wood', many: 'pieces of wood', short: ['wood', 'wood'] },
  log: { one: 'log', many: 'logs', short: ['log', 'logs'] },
  leaves: { one: 'big leaf', many: 'big leaves', short: ['leaf', 'leaves'] },
  stone: { one: 'stone', many: 'stones', short: ['stone', 'stones'] },
  axe: { one: 'stone axe', many: 'stone axes', short: ['axe', 'axes'] },
  fish: { one: 'fish', many: 'fish', short: ['fish', 'fish'] },
  cooked_fish: { one: 'cooked fish', many: 'cooked fish', short: ['cooked fish', 'cooked fish'] },
  apple: { one: 'apple', many: 'apples', short: ['apple', 'apples'] },
  fishing_rod: { one: 'fishing rod', many: 'fishing rods', short: ['rod', 'rods'] },
  rope: { one: 'rope', many: 'ropes', short: ['rope', 'ropes'] },
  tar: { one: 'pot of tar', many: 'pots of tar', short: ['tar', 'tar'] },
  resin: { one: 'lump of resin', many: 'lumps of resin', short: ['resin', 'resin'] },
  glowcap: { one: 'glowcap', many: 'glowcaps', short: ['glowcap', 'glowcaps'] },
  crystal: { one: 'crystal', many: 'crystals', short: ['crystal', 'crystals'] },
  lantern: { one: 'crystal lantern', many: 'crystal lanterns', short: ['lantern', 'lanterns'] },
};

/** Name, and what gathering from it looks like ("You shake the palm tree"). */
const OBJECT: ObjectWords<{ name: string; gather?: string }> = {
  palm_tall: { name: 'palm tree', gather: 'You shake the palm tree' },
  palm_leaning: { name: 'palm tree', gather: 'You shake the palm tree' },
  palm_young: { name: 'young palm', gather: 'You pick some leaves' },
  tree_broadleaf: { name: 'tree', gather: 'You collect fallen branches' },
  tree_pine: { name: 'pine tree', gather: 'You collect fallen branches' },
  bush: { name: 'bush', gather: 'You pick some leaves' },
  berry_bush: { name: 'berry bush', gather: 'You pick berries' },
  mushroom: { name: 'mushrooms', gather: 'You pick the mushrooms' },
  stone_boulder: { name: 'boulder' },
  stone_mossy: { name: 'mossy stone' },
  stone_pebbles: { name: 'pebbles', gather: 'You pick up stones' },
  stalagmite: { name: 'stalagmite' },
  log: { name: 'log', gather: 'You break up the log' },
  log_pile: { name: 'pile of logs', gather: 'You take wood from the pile' },
  log_driftwood: { name: 'driftwood', gather: 'You pick up the driftwood' },
  chest_closed: { name: 'chest', gather: 'You open the chest' },
  chest_open: { name: 'empty chest' },
  spring: { name: 'spring' },
  campfire: { name: 'campfire' },
  lean_to: { name: 'lean-to' },
  hut: { name: 'hut' },
  bramble: { name: 'bramble thicket', gather: 'You chop through the brambles' },
  bridge_ns: { name: 'bridge' },
  bridge_ew: { name: 'bridge' },
  boat_wreck: { name: 'old boat wreck' },
  boat_hull: { name: 'boat' },
  boat_mast: { name: 'boat' },
  boat_sail: { name: 'boat' },
  boat_ready: { name: 'boat' },
  tree_spruce: { name: 'spruce', gather: 'You collect fallen branches' },
  tree_spruce_snow: { name: 'snowy spruce', gather: 'You shake off the snow and collect branches' },
  tree_birch: { name: 'birch', gather: 'You collect fallen branches' },
  tree_apple: { name: 'apple tree', gather: 'You pick apples' },
  fern: { name: 'fern', gather: 'You pick some fern leaves' },
  beacon_site: { name: 'old stone ring' },
  beacon_base: { name: 'beacon' },
  beacon_pyre: { name: 'beacon' },
  beacon_ready: { name: 'beacon' },
  ledge: { name: 'rocky step' },
  ledge_ladder: { name: 'ladder' },
  ice_wall: { name: 'wall of ice' },
  ice_wall_rope: { name: 'climbing rope' },
  barrel: { name: 'old tar barrel', gather: 'You scoop tar out of the old barrel' },
  barrel_empty: { name: 'empty barrel' },
  sandbar_ns: { name: 'sandbar' },
  sandbar_ew: { name: 'sandbar' },
  glowcap: { name: 'glowcaps', gather: 'You pick the glowing mushrooms' },
  crystal_cluster: { name: 'crystal cluster', gather: 'You break off some crystals' },
};

const ANIMAL: AnimalWords<{ name: string; shoo: string; hurt?: string; alert?: string }> = {
  crab: { name: 'crab', shoo: 'You shoo the crab away. It scuttles off sideways.' },
  turtle: { name: 'turtle', shoo: 'The turtle blinks at you slowly.' },
  monkey: { name: 'monkey', shoo: 'You shoo the monkey. It chatters and scampers off.' },
  piglet: { name: 'piglet', shoo: 'The piglet squeals and trots away.' },
  bat: { name: 'bat', shoo: 'The bat flutters past your ear.' },
  boar: {
    name: 'wild boar', shoo: 'You wave your arms. The boar snorts and trots off.',
    hurt: 'Oof! The wild boar bumps into you and knocks you over.', alert: 'A wild boar snorts and runs at you!',
  },
  snake: { name: 'snake', shoo: 'The snake hisses and slides away.', hurt: 'Ouch! The snake bites you.' },
  wasps: {
    name: 'wasps', shoo: 'You swat at the wasps. They buzz away.',
    hurt: 'Ouch! A wasp stings you.', alert: 'Bzzz! Wasps come after you. Run off the grass!',
  },
  bear: {
    name: 'cave bear', shoo: 'The cave bear grumbles and shuffles away.',
    hurt: 'The cave bear swipes at you!', alert: 'A cave bear growls and lumbers after you! Leave its cave.',
  },
  rabbit: { name: 'rabbit', shoo: 'The rabbit twitches its nose and hops away.' },
  squirrel: { name: 'squirrel', shoo: 'The squirrel chatters at you and runs up a tree.' },
  dog: { name: 'stray dog', shoo: 'The dog wags its tail.' },
  goat: {
    name: 'mountain goat', shoo: 'You wave your arms. The goat bleats and jumps away over the rocks.',
    hurt: 'Bonk! The mountain goat butts you with its horns.', alert: 'A mountain goat lowers its horns and runs at you!',
  },
};

const NEEDS = { health: 'Health', food: 'Food', water: 'Water', energy: 'Energy', warmth: 'Warmth' };

const a = (word: string) => (/^[aeiou]/.test(word) ? `an ${word}` : `a ${word}`);
const obj = (kind: ObjectKind) => OBJECT[kind].name;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function itemCount(id: keyof typeof ITEM, count: number): string {
  return count === 1 ? a(ITEM[id].one) : `${count} ${ITEM[id].many}`;
}

/** "20 pieces of wood and 6 stones". */
function itemList(items: [keyof typeof ITEM, number][]): string {
  const parts = items.map(([id, n]) => itemCount(id, n));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts.join('');
}

/** What the goal of a stage's island is called: "boat", "beacon". */
const goalName = (stage: StageId) => (stageLevel(stage) === 2 ? 'beacon' : 'boat');

/** "17:00". */
function time(turn: number): string {
  const m = Math.floor(minuteOfDay(turn));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

function clock(turn: number): string {
  return `Day ${dayNumber(turn)} · ${time(turn)}`;
}

export const en: Strings = {
  lang: 'en',
  name: 'English',
  ui: {
    bag: 'Bag',
    build: 'Build',
    sleep: 'Sleep',
    close: 'Close',
    chooseExplorer: 'Choose your explorer',
    female: 'Female',
    male: 'Male',
    yourBag: 'Your bag',
    bagEmpty: 'Your bag is empty. Bump into plants, logs and stones to gather things.',
    eat: 'Eat',
    forBuilding: 'For building',
    tool: 'A tool. Keep it in your bag.',
    buildHint: 'Buildings go in front of you.',
    changeExplorer: 'Change explorer',
    newIsland: 'New island',
    confirmNewIsland: 'Tap again to confirm',
    resetProgress: 'Reset all progress',
    byFire: 'By the fire',
    grill: (n) => `Grill a fish (${n} left)`,
    inCave: 'In a cave',
    inShelter: (kind) => `In your ${obj(kind)}`,
    dawn: 'dawn',
    dusk: 'dusk',
    night: 'night',
    lowTide: 'low tide',
    highTide: 'high tide',
    skills: 'Skills',
    learn: 'Learn',
    learned: 'Learned',
    raw: 'Raw. Cook it at a campfire.',
    skillsHint: 'Gather, build and fish to earn XP. XP gives you skill points to learn skills.',
    skillPoints: (n) => `${n} skill ${n === 1 ? 'point' : 'points'}`,
    xpToNext: (have, need) => `XP ${have} / ${need} to the next point`,
    skillCost: (n) => `Costs ${n} ${n === 1 ? 'point' : 'points'}`,
    goalMissing: 'This island has no boat. Start a new island in your bag to get one.',
    goalStep: (index, count, stage) => `Step ${index + 1} of ${count}: ${en.stages[stage]}`,
    notYet: 'Not yet',
    endTitle: 'You did it!',
    endText: 'A ship saw your beacon and took you on board. The next island is coming soon! Until then, you can stay here or start a new island.',
    stay: 'Stay on this island',
    yourDog: 'Your dog',
    dogNeeds: (food, water) => `Food ${food} · Water ${water}`,
    dogTired: 'Tired. Give it food, and walk past water so it can drink.',
    map: 'Map',
    yourMap: 'Your map',
    mapSigns: { you: 'You', hut: 'Hut', fire: 'Campfire', spring: 'Spring', goal: 'Goal', bear: 'Bears', cave: 'Cave' },
    feedDog: 'Feed dog',
    islandStars: 'Island stars',
    endStars: (n, of) => `Stars: ${n} of ${of}`,
    oldIsland: 'Your island is from an older version. A new island 1 has a little tide island with more to find. You keep your bag, XP, skills and dog.',
    keepProgress: 'New island, keep progress',
    hut: 'Hut',
    yourHut: 'Your hut',
    bed: 'Bed',
    bedNote: 'Sleep here for a full rest. Health comes back faster.',
    lookAtMap: 'Look',
    mapNote: 'Your map of everything you explored.',
    noMap: 'An empty nail. Learn the Cartographer skill to hang a map of the island here.',
    hutMapRemark: 'Learn the Cartographer skill, and a map of the island hangs on its wall.',
    workbenchNote: (n) => `Make ${n} rope from 2 big leaves here.`,
    makeRope: 'Make rope',
    hearthNote: 'Cook fish here. Health comes back faster while you sleep.',
    cook: 'Cook',
    barrelNote: 'Fresh rain water from the roof. +35 water.',
    drink: 'Drink',
    addRoom: 'Add a room',
  },
  rooms: {
    workshop: { name: 'Workshop', description: 'A workbench. Rope you make in your hut gives 1 more.' },
    hearth: { name: 'Hearth', description: 'A fire inside. Cook fish at home, and heal faster in your sleep.' },
    barrel: { name: 'Rain barrel', description: 'Catches rain from the roof, so you can drink at home.' },
  },
  stars: {
    chests: { name: 'Treasure hunter', task: 'Open every chest on this island.' },
    fish: { name: 'Angler', task: 'Catch 5 fish on this island.' },
    explore: { name: 'Explorer', task: 'Explore 3/4 of this island.' },
    safe: { name: 'Safe and sound', task: 'Go 3 days in a row without fainting.' },
  },
  rareHints: {
    tar: 'Tar: old barrels stand on a little island off the coast. Walk over the sandbar at low tide (5–11 and 17–23 o’clock).',
    resin: 'Resin: shake the snowy spruces high up on the mountain.',
  },
  levels: {
    1: {
      goalTitle: 'Island goal: repair the boat',
      goalFind: 'Find the old boat. It lies on a beach on the far side of the island.',
      goalHint: 'Walk into the boat to give it what you carry.',
      goalReady: 'The boat is ready! Walk into it to set sail.',
      goalSailed: 'You sailed away from this island.',
      sailTitle: 'Set sail?',
      sailText: 'The boat is ready. Do you want to sail to a new island? You take your bag and your skills with you.',
      setSail: 'Set sail!',
    },
    2: {
      goalTitle: 'Island goal: light a beacon',
      goalFind: 'Climb the mountain. Find the old stone ring on the snowy peak.',
      goalHint: 'Walk into the beacon to give it what you carry.',
      goalReady: 'The beacon is ready! Walk into it to light it.',
      goalSailed: 'A ship took you away from this island.',
      sailTitle: 'Light the beacon?',
      sailText: 'The beacon is ready. Do you want to light it, so a passing ship sees you?',
      setSail: 'Light it!',
    },
  },
  clock,
  needs: NEEDS,
  recipes: {
    campfire: { name: 'Campfire', description: 'Keeps you warm and lights up the night.' },
    lean_to: { name: 'Lean-to', description: 'A simple shelter for trips. Warmer nights, but only the bed in a hut gives a full rest.' },
    hut: { name: 'Hut', description: 'Your camp. A bed for a full rest, and you can add rooms from inside. One on each island.' },
    axe: { name: 'Stone axe', description: 'Chops logs from trees and clears brambles.' },
    rope: { name: 'Rope', description: 'Twisted from big leaves. You need rope for the island goal.' },
    bridge: { name: 'Bridge', description: 'Crosses a river up to 3 steps wide. Face the water to build it.' },
    fishing_rod: { name: 'Fishing rod', description: 'Walk into the sea with it to catch fish.' },
    cooked_fish: { name: 'Cook a fish', description: 'Stand next to a campfire. Cooked fish is tasty food.' },
    ladder: { name: 'Ladder', description: 'Gets you up a rocky step in the mountains. Stand next to the step to build it.' },
    climbing_rope: { name: 'Climbing rope', description: 'Gets you up a wall of ice near the peak. Stand next to the wall to build it.' },
    lantern: { name: 'Crystal lantern', description: 'Cave crystals glow in a little wooden frame. You see further in dark caves and at night.' },
  },
  paths: { build: 'Building', explorer: 'Explorer', improve: 'Improving' },
  objectName: (kind) => cap(OBJECT[kind].name),
  animalName: (kind) => cap(ANIMAL[kind].name),
  stages: { hull: 'Hull', mast: 'Mast', sail: 'Sail', supplies: 'Supplies', base: 'Stone base', pyre: 'Wood pile', tinder: 'Tinder' },
  skills: {
    small_sips: { name: 'Small sips', description: 'Your water goes down 20% slower.' },
    small_appetite: { name: 'Small appetite', description: 'Your food goes down 20% slower.' },
    thick_skin: { name: 'Thick skin', description: 'You lose warmth 30% slower.' },
    fishing_rod: { name: 'Fishing rod', description: 'You can build a fishing rod. Walk into the sea with it to fish.' },
    patient_angler: { name: 'Patient angler', description: 'Fish bite more often.' },
    handy_builder: { name: 'Handy builder', description: 'Everything you build costs 1 wood less.' },
    green_thumb: { name: 'Green thumb', description: 'Plants grow back faster.' },
    night_eyes: { name: 'Night eyes', description: 'You see further at night.' },
    animal_friend: { name: 'Animal friend', description: "Crabs don't pinch you, and monkeys don't take your food. Wild animals notice you later." },
    rope_maker: { name: 'Rope maker', description: 'You twist 2 ropes from 2 big leaves, not 1.' },
    sure_foot: { name: 'Sure foot', description: 'Climbing a ladder or a rope does not make you tired.' },
    cartographer: { name: 'Cartographer', description: 'In a hut, look at a map of everything you explored.' },
    wild_sense: { name: 'Wild sense', description: 'You see where animals would come after you or hurt you. These places look red.' },
  },
  itemStack: (id, count) => `${count} × ${ITEM[id].many}`,
  itemCount,
  float(amount, what) {
    const label = 'item' in what ? ITEM[what.item].short[Math.abs(amount) === 1 ? 0 : 1] : 'need' in what ? what.need : 'XP';
    return `${amount > 0 ? '+' : ''}${amount} ${label}`;
  },
  message(msg) {
    switch (msg.key) {
      case 'arrive': return 'You wash up on a quiet island. Gather food and water, and build a shelter before night.';
      case 'seaSalty': return 'The sea is too salty to drink. Look for fresh water.';
      case 'mapHint': return 'Your map hangs on the hut wall. Tap Map to look at it.';
      case 'stepInto': return `You step into the ${obj(msg.obj)}. A good place to sleep.`;
      case 'enterHut': return 'You go inside your hut.';
      case 'oneHut': return 'You already have a hut on this island. Add rooms to it from inside.';
      case 'roomBuilt': return `You add ${a(en.rooms[msg.room].name.toLowerCase())} to your hut.`;
      case 'notInHut': return 'You can only do that inside your hut.';
      case 'drinkBarrel': return 'You drink fresh rain water from the barrel. Lovely!';
      case 'restLimit': return `You can't rest any more here (Energy ${msg.cap}). Only the bed in your hut gives a full rest.`;
      case 'tooFull': return "You're too full to eat that.";
      case 'eat': return `You eat ${itemCount(msg.item, 1)}. Yum!`;
      case 'build': return `You build ${a(obj(msg.obj))}.`;
      case 'make': return `You make ${itemCount(msg.item, msg.count ?? 1)}.`;
      case 'needMaterials': return 'You need more materials.';
      case 'noRoom': return 'There is no room to build here.';
      case 'noBridgeSpot': return 'Stand at a river and face the water. A bridge can cross up to 3 steps.';
      case 'haveTool': return `You already have ${a(ITEM[msg.item].one)}.`;
      case 'needTool': return `The ${obj(msg.obj)} is too thorny to clear by hand. You need ${a(ITEM[msg.item].one)}.`;
      case 'notSleepy': return "You're not sleepy right now.";
      case 'fallAsleep': if (msg.obj === 'hut') return 'You snuggle into your bed and fall asleep.';
        return `You curl up in the ${msg.obj ? obj(msg.obj) : 'cave'} and fall asleep.`;
      case 'dozeOff': return 'You lie down on the ground and doze off.';
      case 'wake': {
        const text = {
          rested: 'You wake up feeling rested.',
          restless: 'You wake up, but not fully rested. Only the bed in your hut gives a full rest.',
          cold: 'Brr! Too cold to sleep. A fire or a shelter would help.',
          hungry: 'Your rumbling tummy wakes you up.',
          thirsty: 'You wake up thirsty.',
          none: 'You wake up.',
        }[msg.reason];
        return `${text} (${clock(msg.turn)})`;
      }
      case 'notThirsty': return "You're not thirsty.";
      case 'drink': return 'You drink the cool, fresh water. Lovely!';
      case 'drinkRiver': return 'You scoop up some cool river water. Lovely!';
      case 'look': {
        const name = a(obj(msg.obj));
        return `${name[0].toUpperCase()}${name.slice(1)}.`;
      }
      case 'nothingLeft': return `The ${obj(msg.obj)} has nothing left. Come back later.`;
      case 'gather': {
        const verb = msg.used ? `You chop at the ${obj(msg.obj)}` : OBJECT[msg.obj].gather ?? 'You search';
        const list = msg.got.map(([item, n]) => itemCount(item, n)).join(' and ');
        const hint = msg.lack ? ` With ${a(ITEM[msg.lack.tool].one)} you could also chop ${ITEM[msg.lack.item].many}.` : '';
        return (list ? `${verb} and get ${list}.` : `${verb}, but find nothing.`) + hint;
      }
      case 'shoo': return ANIMAL[msg.animal].shoo;
      case 'low': return {
        food: 'Your tummy rumbles. Time to find something to eat.',
        water: msg.level === 2 ? "You're thirsty. Drink at a spring or the river." : "You're thirsty. Look for a spring or a coconut.",
        energy: "You're getting sleepy. A rest would help.",
        warmth: "Brr, you're getting cold. A fire or a shelter would help.",
      }[msg.need];
      case 'faint': return 'You feel woozy and sit down for a rest…';
      case 'wakeAtCamp': return 'You wake up back at camp the next morning, feeling better.';
      case 'faintWhy': {
        if (!msg.empty.length) return 'Wild animals hurt you too often. Keep away from them, and eat and drink well to heal.';
        const tips = {
          food: 'Eat berries, coconuts or fish.',
          water: 'Drink at a spring or a river.',
          energy: 'Sleep at night, best in a shelter.',
          warmth: 'At night, stay by a fire or in a shelter.',
        };
        const names = msg.empty.map((need) => NEEDS[need].toLowerCase());
        const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
        return `You fainted because your ${list} ran out. ${msg.empty.map((need) => tips[need]).join(' ')}`;
      }
      case 'pinch': return `Ouch! The ${ANIMAL[msg.animal].name} pinched you.`;
      case 'hurt': return ANIMAL[msg.animal].hurt ?? `Ouch! The ${ANIMAL[msg.animal].name} hurt you.`;
      case 'alert': return ANIMAL[msg.animal].alert ?? `The ${ANIMAL[msg.animal].name} comes after you!`;
      case 'snatch': return `The cheeky ${ANIMAL[msg.animal].name} snatched ${itemCount(msg.item, 1)}!`;
      case 'cook': return `You cook over the fire and get ${itemCount(msg.item, 1)}. Smells great!`;
      case 'needFire': return 'Stand next to a campfire to cook.';
      case 'needSkill': return `Learn the skill “${en.skills[msg.skill].name}” first.`;
      case 'needPoints': return 'You need more skill points. Gather and build to earn them.';
      case 'skillPoint': return 'You feel more skilled! You got a skill point.';
      case 'learn': return `You learned: ${en.skills[msg.skill].name}.`;
      case 'catch': return 'You cast your line… and catch a fish!';
      case 'noBite': return 'Nothing bites. Try again!';
      case 'goalFound': return msg.obj === 'beacon_site'
        ? 'You find an old ring of stones on the peak! A beacon here could call a ship.'
        : 'You find an old boat wreck on the beach! Maybe you can fix it and sail away.';
      case 'goalNeeds': return `The ${goalName(msg.stage)} needs ${itemList(msg.left)} for the ${en.stages[msg.stage].toLowerCase()}.`;
      case 'goalGive': return `You give the ${goalName(msg.stage)} ${itemList(msg.given)}. It still needs ${itemList(msg.left)}.`;
      case 'goalStage': return {
        hull: 'The hull is finished! Now the boat needs a mast.',
        mast: 'The mast stands tall! Now the boat needs a sail.',
        sail: 'The sail is up! Now pack food for the trip.',
        supplies: 'The supplies are on board. The boat is ready to sail!',
        base: 'The stone base is finished! Now pile up wood on it.',
        pyre: 'The wood pile stands tall! Now it needs dry tinder.',
        tinder: 'The tinder is in. The beacon is ready to light!',
      }[msg.stage];
      case 'goalReady': return msg.level === 2 ? 'The beacon is ready to light.' : 'The boat is ready to sail.';
      case 'sailAway': return msg.level === 2
        ? 'You light the beacon. Smoke rises high into the sky, and soon a ship comes to take you on board!'
        : 'You push the boat into the waves and sail away!';
      case 'landIsland': return 'After a long trip, your boat lands on a new island. Tall trees and snowy mountains! It is colder here.';
      case 'dogSniff': return 'A stray dog sniffs your hand. It looks hungry. Bring it something to eat.';
      case 'dogAdopt': return `You give the dog ${itemCount(msg.item, 1)}. It wags its tail and follows you. You have a dog!`;
      case 'dogBark': return `Woof! Your dog barks, and the ${ANIMAL[msg.animal].name} runs away.`;
      case 'dogFeed': return `Your dog eats ${itemCount(msg.item, 1)} and wags its tail.`;
      case 'dogFull': return 'Your dog is not hungry.';
      case 'dogFar': return 'Your dog is too far away. Go to it first.';
      case 'dogLow': return msg.need === 'food'
        ? 'Your dog is hungry. Feed it from your bag.'
        : 'Your dog is thirsty. Walk past a spring or the river.';
      case 'dogTired': return 'Your dog is too hungry or thirsty to help. It trails slowly behind you.';
      case 'dogBack': return 'Your dog jumps up, happy again!';
      case 'snowCold': return 'Brr! The snow is cold, even in the day. A fire or a shelter helps up here.';
      case 'caveEnter': return msg.lantern
        ? 'You step into a deep cave. Your crystal lantern lights the way.'
        : 'You step into a deep cave. It is dark in here, even in the day.';
      case 'tooSteep': return `The ${obj(msg.obj)} is too steep to climb. Build ${a(obj(msg.way))} on it.`;
      case 'noStep': return `Stand next to ${a(obj(msg.obj))} to build this.`;
      case 'climb': return msg.easy
        ? `You climb over the step with the ${obj(msg.obj)}. Easy!`
        : `You climb over the step with the ${obj(msg.obj)}. Phew, hard work!`;
      case 'tideOut': return 'The tide goes out. The sandbar to the little island is dry now.';
      case 'tideIn': return 'The tide comes in. The sandbar goes under water.';
      case 'tideHigh': return `The sandbar is under water. Low tide comes back at ${time(msg.turn)}.`;
      case 'tideWade': return 'The tide comes in! You wade back to dry land. Brr, wet and cold.';
      case 'star': return `You earned a star: ${en.stars[msg.star].name}!`;
      case 'legacy': return msg.text;
    }
  },
};
