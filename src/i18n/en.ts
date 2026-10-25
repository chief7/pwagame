import { dayNumber, minuteOfDay } from '../game/clock';
import type { ObjectKind } from '../game/defs/objects';
import type { AnimalWords, ItemWords, ObjectWords, Strings } from './types';

const ITEM: ItemWords<{ one: string; many: string; short: [string, string] }> = {
  coconut: { one: 'coconut', many: 'coconuts', short: ['coconut', 'coconuts'] },
  berries: { one: 'handful of berries', many: 'handfuls of berries', short: ['berries', 'berries'] },
  mushroom: { one: 'mushroom', many: 'mushrooms', short: ['mushroom', 'mushrooms'] },
  wood: { one: 'piece of wood', many: 'pieces of wood', short: ['wood', 'wood'] },
  leaves: { one: 'big leaf', many: 'big leaves', short: ['leaf', 'leaves'] },
  stone: { one: 'stone', many: 'stones', short: ['stone', 'stones'] },
  axe: { one: 'stone axe', many: 'stone axes', short: ['axe', 'axes'] },
  fish: { one: 'fish', many: 'fish', short: ['fish', 'fish'] },
  cooked_fish: { one: 'cooked fish', many: 'cooked fish', short: ['cooked fish', 'cooked fish'] },
  fishing_rod: { one: 'fishing rod', many: 'fishing rods', short: ['rod', 'rods'] },
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
};

const ANIMAL: AnimalWords<{ name: string; shoo: string }> = {
  crab: { name: 'crab', shoo: 'You shoo the crab away. It scuttles off sideways.' },
  turtle: { name: 'turtle', shoo: 'The turtle blinks at you slowly.' },
  monkey: { name: 'monkey', shoo: 'You shoo the monkey. It chatters and scampers off.' },
  piglet: { name: 'piglet', shoo: 'The piglet squeals and trots away.' },
  bat: { name: 'bat', shoo: 'The bat flutters past your ear.' },
};

const NEEDS = { health: 'Health', food: 'Food', water: 'Water', energy: 'Energy', warmth: 'Warmth' };

const a = (word: string) => (/^[aeiou]/.test(word) ? `an ${word}` : `a ${word}`);
const obj = (kind: ObjectKind) => OBJECT[kind].name;

function itemCount(id: keyof typeof ITEM, count: number): string {
  return count === 1 ? a(ITEM[id].one) : `${count} ${ITEM[id].many}`;
}

function clock(turn: number): string {
  const m = Math.floor(minuteOfDay(turn));
  return `Day ${dayNumber(turn)} · ${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
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
    byFire: 'By the fire',
    inCave: 'In a cave',
    inShelter: (kind) => `In your ${obj(kind)}`,
    dawn: 'dawn',
    dusk: 'dusk',
    night: 'night',
    skills: 'Skills',
    learn: 'Learn',
    learned: 'Learned',
    raw: 'Raw. Cook it at a campfire.',
    skillsHint: 'Gather, build and fish to earn XP. XP gives you skill points to learn skills.',
    skillPoints: (n) => `${n} skill ${n === 1 ? 'point' : 'points'}`,
    xpToNext: (have, need) => `XP ${have} / ${need} to the next point`,
    skillCost: (n) => `Costs ${n} ${n === 1 ? 'point' : 'points'}`,
  },
  clock,
  needs: NEEDS,
  recipes: {
    campfire: { name: 'Campfire', description: 'Keeps you warm and lights up the night.' },
    lean_to: { name: 'Lean-to', description: 'A simple shelter. Sleep here to rest well and stay warmer.' },
    hut: { name: 'Hut', description: 'A cosy home. Toasty nights and the best sleep.' },
    axe: { name: 'Stone axe', description: 'Chops through brambles, and gets you more wood from trees.' },
    bridge: { name: 'Bridge', description: 'Crosses a river up to 3 steps wide. Face the water to build it.' },
    fishing_rod: { name: 'Fishing rod', description: 'Walk into the sea with it to catch fish.' },
    cooked_fish: { name: 'Cook a fish', description: 'Stand next to a campfire. Cooked fish is tasty food.' },
  },
  paths: { survival: 'Survival', craft: 'Crafting', explorer: 'Explorer' },
  skills: {
    small_sips: { name: 'Small sips', description: 'Your water goes down 20% slower.' },
    small_appetite: { name: 'Small appetite', description: 'Your food goes down 20% slower.' },
    thick_skin: { name: 'Thick skin', description: 'You lose warmth 30% slower.' },
    fishing_rod: { name: 'Fishing rod', description: 'You can build a fishing rod. Walk into the sea with it to fish.' },
    patient_angler: { name: 'Patient angler', description: 'Fish bite more often.' },
    handy_builder: { name: 'Handy builder', description: 'Everything you build costs 1 wood less.' },
    green_thumb: { name: 'Green thumb', description: 'Plants grow back faster.' },
    night_eyes: { name: 'Night eyes', description: 'You see further at night.' },
    animal_friend: { name: 'Animal friend', description: "Crabs don't pinch you, and monkeys don't take your food." },
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
      case 'stepInto': return `You step into the ${obj(msg.obj)}. A good place to sleep.`;
      case 'tooFull': return "You're too full to eat that.";
      case 'eat': return `You eat ${itemCount(msg.item, 1)}. Yum!`;
      case 'build': return `You build ${a(obj(msg.obj))}.`;
      case 'make': return `You make ${a(ITEM[msg.item].one)}.`;
      case 'needMaterials': return 'You need more materials.';
      case 'noRoom': return 'There is no room to build here.';
      case 'noBridgeSpot': return 'Stand at a river and face the water. A bridge can cross up to 3 steps.';
      case 'haveTool': return `You already have ${a(ITEM[msg.item].one)}.`;
      case 'needTool': return `The ${obj(msg.obj)} is too thorny to clear by hand. You need ${a(ITEM[msg.item].one)}.`;
      case 'notSleepy': return "You're not sleepy right now.";
      case 'fallAsleep': return `You curl up in the ${msg.obj ? obj(msg.obj) : 'cave'} and fall asleep.`;
      case 'dozeOff': return 'You lie down on the ground and doze off.';
      case 'wake': {
        const text = {
          rested: 'You wake up feeling rested.',
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
        const verb = OBJECT[msg.obj].gather ?? 'You search';
        const list = msg.got.map(([item, n]) => itemCount(item, n)).join(' and ');
        return list ? `${verb} and get ${list}.` : `${verb}, but find nothing.`;
      }
      case 'shoo': return ANIMAL[msg.animal].shoo;
      case 'low': return {
        food: 'Your tummy rumbles. Time to find something to eat.',
        water: "You're thirsty. Look for a spring or a coconut.",
        energy: "You're getting sleepy. A rest would help.",
        warmth: "Brr, you're getting cold. A fire or a shelter would help.",
      }[msg.need];
      case 'faint': return 'You feel woozy and sit down for a rest…';
      case 'wakeAtCamp': return 'You wake up back at camp, feeling better. Remember to eat, drink and keep warm!';
      case 'pinch': return `Ouch! The ${ANIMAL[msg.animal].name} pinched you.`;
      case 'snatch': return `The cheeky ${ANIMAL[msg.animal].name} snatched ${itemCount(msg.item, 1)}!`;
      case 'cook': return `You cook over the fire and get ${itemCount(msg.item, 1)}. Smells great!`;
      case 'needFire': return 'Stand next to a campfire to cook.';
      case 'needSkill': return `Learn the skill “${en.skills[msg.skill].name}” first.`;
      case 'needPoints': return 'You need more skill points. Gather and build to earn them.';
      case 'skillPoint': return 'You feel more skilled! You got a skill point.';
      case 'learn': return `You learned: ${en.skills[msg.skill].name}.`;
      case 'catch': return 'You cast your line… and catch a fish!';
      case 'noBite': return 'Nothing bites. Try again!';
      case 'legacy': return msg.text;
    }
  },
};
