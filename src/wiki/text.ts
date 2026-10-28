import type { Temper } from '../game/defs/animals';
import type { PathId, SkillId } from '../game/defs/skills';
import type { Lang } from '../i18n';
import type { NeedId } from '../game/needs';
import type { ItemId } from '../game/defs/items';
import type { ItemGroup } from './data';

// The compendium's own words, in English and German. Names of things
// (items aside) come from the game's texts in src/i18n/, numbers from the
// game's registries; this file holds the explanations around them.
// Text may use **bold**.

export type Ground = 'sand' | 'grass' | 'cave' | 'scree' | 'snow' | 'ash';

export interface Chain {
  title: string;
  steps: string[];
}

export interface WikiWords {
  title: string;
  tagline: string;
  play: string;
  contents: string;
  island: (n: number) => string;
  hours: (h: number) => string;
  percent: (p: number) => string;
  /** Names for the items, as table entries. */
  items: Record<ItemId, string>;
  /** Where things grow and animals live: the scatter grounds, and the decks of the oil rig. */
  ground: Record<Ground | 'deck', string>;

  start: { title: string; intro: string; steps: string[] };
  needs: {
    title: string;
    intro: string;
    fill: string;
    drain: string;
    cards: Record<NeedId, { fill: string; drain: string }>;
    foodTitle: string;
    foodIntro: string;
    cols: { item: string; food: string; water: string; energy: string; from: string };
    foodTip: string;
  };
  health: { title: string; paras: string[] };
  time: {
    title: string;
    paras: string[];
    phases: { night: string; dawn: string; day: string; dusk: string };
    lowTide: string;
    highTide: string;
    bears: string;
    rowLight: string;
    rowTide: string;
    rowBears: string;
  };
  warmth: {
    title: string;
    paras: string[];
    cols: { place: string; target: string; rest: string; sleep: string };
    open: string;
    cave: string;
    fire: string;
    tip: string;
  };
  camp: {
    title: string;
    paras: string[];
    hutCost: string;
    roomsTitle: string;
    roomsIntro: string;
    cols: { room: string; cost: string; effect: string };
    workshop: (extra: number) => string;
    hearth: (bed: number, hearth: number) => string;
    barrel: (water: number) => string;
  };
  gather: {
    title: string;
    intro: string;
    cols: { what: string; gives: string; after: string; islands: string };
    regrow: (h: string) => string;
    gone: string;
    becomes: (name: string) => string;
    needs: (tool: string) => string;
    withTool: (tool: string) => string;
    chance: (p: number) => string;
    water: string;
    river: string;
    sea: string;
    waterRows: { spring: string; river: string; sea: string };
  };
  itemsSection: {
    title: string;
    intro: string;
    groups: Record<ItemGroup, string>;
    from: string;
    usedFor: string;
    fishing: string;
    goal: string;
    rawNote: string;
    toolNote: string;
  };
  build: {
    title: string;
    intro: string;
    cols: { what: string; cost: string; note: string };
    skill: (name: string) => string;
    atFire: string;
    onto: (name: string) => string;
    /** A building that goes up in trips on a site (the hut). */
    site: string;
    paras: string[];
  };
  skills: {
    title: string;
    intro: string;
    xpTitle: string;
    xpRows: string[];
    xp: string;
    pointsTitle: string;
    pointsIntro: string;
    point: (n: number) => string;
    pathsTitle: string;
    paths: Record<PathId, string>;
    cost: (n: number) => string;
    combo: Partial<Record<SkillId, string>>;
  };
  animals: {
    title: string;
    intro: string;
    tempers: Record<Temper, string>;
    lives: string;
    wild: string;
    harm: (damage: number, chance: number) => string;
    dog: string;
    sleeps: string;
    climbs: string;
    paras: string[];
  };
  dog: { title: string; paras: string[] };
  islands: {
    title: string;
    one: { title: string; paras: string[] };
    two: { title: string; paras: string[] };
    three: { title: string; paras: string[] };
    four: { title: string; paras: string[] };
    goalTitle: string;
    goalIntro: string;
    stageCols: { stage: string; cost: string };
    total: string;
    starsTitle: string;
    starsIntro: string;
  };
  together: { title: string; intro: string; chains: Chain[] };
  tips: { title: string; list: string[] };
  footer: string;
}

const en: WikiWords = {
  title: 'Island Compendium',
  tagline: 'Everything about the island: your needs, what you can gather and build, the skills, the animals, and how it all fits together.',
  play: 'Play the game',
  contents: 'Contents',
  island: (n) => `Island ${n}`,
  hours: (h) => (h >= 24 && h % 24 === 0 ? `${h / 24} ${h === 24 ? 'day' : 'days'}` : `${h} ${h === 1 ? 'hour' : 'hours'}`),
  percent: (p) => `${p}%`,
  items: {
    coconut: 'Coconut', berries: 'Berries', mushroom: 'Mushroom', cooked_fish: 'Cooked fish', apple: 'Apple',
    wood: 'Wood', log: 'Logs', leaves: 'Big leaves', stone: 'Stone', fish: 'Raw fish', rope: 'Rope',
    axe: 'Stone axe', fishing_rod: 'Fishing rod', tar: 'Tar', resin: 'Resin', sulphur: 'Sulphur',
    glowcap: 'Glowcap', crystal: 'Crystal', lantern: 'Crystal lantern', scrap: 'Scrap metal', diesel: 'Diesel', mussels: 'Mussels', pack_frame: 'Pack frame',
  },
  ground: { sand: 'beach', grass: 'forest', cave: 'caves', scree: 'scree', snow: 'snow', ash: 'ash', deck: 'rig decks' },

  start: {
    title: 'Your first day',
    intro: 'You wash up on a beach with nothing. The game moves on only when you act: every step is one turn, and a turn is six minutes on the island clock. Take your time.',
    steps: [
      '**Gather.** Walk into palms, bushes, logs and pebbles. Palms give coconuts (food and drink) and big leaves.',
      '**Drink.** Find a spring. Coconuts also give water, but the sea is too salty.',
      '**Build a campfire** (3 wood, 2 stones) before dark. It keeps you warm and lights the night.',
      '**Build a shelter.** A lean-to is cheap and quick. Sleep in it, and it becomes your home. Later, build a hut: your camp. It needs logs, and logs need the stone axe.',
      '**Sleep at night.** Nights are dark and cold. Sleep in your shelter next to your fire.',
      '**Grow.** Everything you gather and build gives XP. Spend skill points on skills, and learn the fishing rod first.',
    ],
  },
  needs: {
    title: 'Your five needs',
    intro: 'The bars at the top of the screen show five needs, each from 0 to 100. When a need drops below 25, its bar pulses and the log warns you.',
    fill: 'Fills up',
    drain: 'Goes down',
    cards: {
      health: { fill: 'Slowly, while Food and Water are both above 50 and no need is empty. Faster while you sleep, fastest in the hut bed.', drain: 'When another need is empty, and when wild animals hurt you.' },
      food: { fill: 'When you eat. Open the Bag and tap Eat.', drain: 'All the time: about 108 in a full day, half that while you sleep.' },
      water: { fill: 'At a spring, a hot spring or the river (+35 each sip), and from coconuts, apples and berries.', drain: 'As fast as Food. Out on the hot ash of island 3, up to 50% faster in the day.' },
      energy: { fill: 'When you sleep. Only the bed in your hut fills it all the way.', drain: 'Slowly while you are awake (about 60 in a day). Climbing ladders and ropes costs a little too.' },
      warmth: { fill: 'Next to a campfire or a hot spring, in a shelter or a cave, and in the daylight.', drain: 'At night out in the open, and on snow even in the day.' },
    },
    foodTitle: 'Food and drink',
    foodIntro: 'Each food fills these needs by the amount shown. You cannot eat when Food is almost full, unless the food also gives Water.',
    cols: { item: 'Food', food: 'Food', water: 'Water', energy: 'Energy', from: 'Where from' },
    foodTip: 'Fruit, berries and mushrooms fill you only a little. **Cooked fish is by far the best food**: three of them feed you for a whole day.',
  },
  health: {
    title: 'Health and fainting',
    paras: [
      'Nobody dies on the island. When your Health reaches 0, you **faint**. You wake up at home at 6:00 the next morning with everything still in your bag, and a hint tells you why you fainted.',
      'After fainting you have Health 50, at least 25 Food and 30 Water, Energy 70 and Warmth 80. Your **home** is the last shelter or cave where you slept; at the start it is the beach where you arrived.',
      'Each empty need takes 1 Health every turn. Health comes back only while **Food and Water are both above 50**, so an explorer who eats badly stays hurt.',
    ],
  },
  time: {
    title: 'Day, night and tides',
    paras: [
      'A day has 240 turns. A new island starts at 8:00 on day 1. At night you see only half as far, and the open ground gets very cold. Campfires light up 5 cells around them.',
      'On island 1, a sandbar leads to a little **tide islet**. The sandbar is dry only at low tide. If the water comes in while you are on it, you wade back to land, wet and cold (−15 Warmth). On the islet you can wait for the next low tide: it is never more than 6 hours away.',
    ],
    phases: { night: 'Night', dawn: 'Dawn', day: 'Day', dusk: 'Dusk' },
    lowTide: 'Low tide',
    highTide: 'High tide',
    bears: 'Cave bears sleep',
    rowLight: 'Light',
    rowTide: 'Tide (island 1)',
    rowBears: 'Cave bears',
  },
  warmth: {
    title: 'Warmth, fire and shelter',
    paras: [
      'Warmth always moves towards a target. The target depends on where you stand and how dark it is. It rises fast (+1.5 each turn) and falls slowly (−0.6 each turn).',
      'Within 2 cells of a campfire, the target is always 100.',
      'Where you sleep also matters. Only the **bed in your hut** gives a full rest. Everywhere else, you wake up when your Energy reaches the place’s limit. A shelter also makes sleep faster.',
    ],
    cols: { place: 'Where you are', target: 'Warmth at night', rest: 'Sleep fills Energy up to', sleep: 'Time from Energy 20' },
    open: 'Open ground',
    cave: 'Cave',
    fire: 'Next to a campfire',
    tip: 'On the snow of island 2 it is cold even in the day: open snow goes to 60 Warmth by day and to 0 at night. Bring wood for a fire.',
  },
  camp: {
    title: 'Your camp: the hut and its rooms',
    paras: [
      'The hut is big work, and each island has only one. First build its **frame**, then walk into the frame to give it the materials, in as many trips as you like. The hut is your **camp**: walk into it to go inside. The Hut panel shows the bed, the map wall and the rooms.',
      'The **bed** is the only place for a full rest, and Health comes back faster while you sleep in it. With the Cartographer skill, your map hangs on the wall.',
    ],
    hutCost: 'The hut costs',
    roomsTitle: 'Rooms',
    roomsIntro: 'From inside the hut, add rooms. Each room gives 1 XP for each item it costs, and you can see it on the hut from outside.',
    cols: { room: 'Room', cost: 'Costs', effect: 'What it does' },
    workshop: (extra) => `With the Rope maker skill, 2 leaves give ${2 + extra} ropes here.`,
    hearth: (bed, hearth) => `A fire on the hut’s own cell: cook fish there (also with the grill button), and it lights the night round the hut. Health comes back ${hearth}× as fast in your sleep, not ${bed}×.`,
    barrel: (water) => `Drink rain water from the barrel in the Hut panel: +${water} Water.`,
  },
  gather: {
    title: 'Gathering',
    intro: 'Walk into a plant, a rock or a chest to gather from it. Each time gives 1 XP. Some things grow back, some are gone for good.',
    cols: { what: 'What', gives: 'Gives', after: 'Afterwards', islands: 'Islands' },
    regrow: (h) => `Grows back in ${h}`,
    gone: 'Gone for good',
    becomes: (name) => `Becomes: ${name}`,
    needs: (tool) => `Needs the ${tool.toLowerCase()}`,
    withTool: (tool) => `with the ${tool.toLowerCase()}`,
    chance: (p) => `${p}% chance`,
    water: 'Water',
    river: 'River',
    sea: 'Sea',
    waterRows: {
      spring: 'Walk into it to drink: +35 Water.',
      river: 'Walk into it to drink: +35 Water. Build a bridge to cross it.',
      sea: 'Too salty to drink. With a fishing rod you can fish in it.',
    },
  },
  itemsSection: {
    title: 'Items',
    intro: 'Everything you carry goes into your bag. There is no limit to how much you can carry.',
    groups: { food: 'Food', material: 'Materials', rare: 'Rare goal materials', tool: 'Tools' },
    from: 'From',
    usedFor: 'Used for',
    fishing: 'fishing in the sea',
    goal: 'the island goal',
    rawNote: 'Raw: cook it at a campfire first.',
    toolNote: 'A tool stays in your bag and is never used up. You only need one.',
  },
  build: {
    title: 'Building',
    intro: 'Open the Build panel. It lists every recipe and shows what you still need. Building gives 1 XP for each item it costs (a campfire gives 5 XP).',
    cols: { what: 'What', cost: 'Costs', note: 'Good to know' },
    skill: (name) => `Learn the skill “${name}” first.`,
    atFire: 'Stand next to a campfire.',
    onto: (name) => `Stand next to a ${name.toLowerCase()}.`,
    site: 'First build its frame, then bring the materials in trips.',
    paras: [
      'Buildings go in front of you, in the way you face. A bridge goes straight ahead over the river (1 to 3 cells of water), and stepping stones over the lava flow of island 3. Items such as the axe and rope go into your bag.',
      'A building is never placed where it would cut off part of the island, so you can never lock yourself in.',
      'Your bag holds **30 heavy things**: wood, logs, stone, scrap and diesel. Food, leaves, rope, tools and rare materials weigh nothing. When the bag is full, you cannot gather more heavy things. Keep the rest in a **store crate** (one on each island). The skill Strong back adds 10, and a pack frame adds 15.',
    ],
  },
  skills: {
    title: 'XP and skills',
    intro: 'You earn XP (experience) for nearly everything you do. XP gives you skill points, and skill points let you learn skills in the Skills panel. A star on the Skills button shows that you have points to spend.',
    xpTitle: 'How you earn XP',
    xpRows: [
      '**Gather** from a plant, a rock or a chest: 1 XP.',
      '**Build or make** a recipe, or add a room to your hut: 1 XP for each item it costs (campfire 5, cook a fish 1).',
      '**Catch a fish**: 2 XP.',
      '**Give an item** to the island goal: 1 XP for each item.',
      '**Earn an island star**: 5 XP.',
    ],
    xp: 'XP',
    pointsTitle: 'Skill points',
    pointsIntro: 'The first skill point needs 10 XP. Each next point needs 5 XP more than the one before.',
    point: (n) => `Point ${n}`,
    pathsTitle: 'The three paths',
    paths: {
      build: 'Skills that let you build new things, or build them cheaper.',
      explorer: 'Skills that make the explorer tougher.',
      improve: 'Skills that make the island work better for you.',
    },
    cost: (n) => `${n} ${n === 1 ? 'point' : 'points'}`,
    combo: {
      fishing_rod: 'The most important skill: fish is the best food, and the boat needs 3 cooked fish.',
      handy_builder: 'Every recipe and hut room with wood costs 1 less: campfires, shelters, bridges, ladders.',
      rope_maker: 'The goals and the hut need a lot of rope. This halves the leaves. In a hut with a workshop, 2 leaves give 3 ropes.',
      cartographer: 'The map hangs on the wall of your hut. It shows huts, campfires, springs, the goal, the deep caves you found and where you saw cave bears.',
      small_sips: 'Good for long trips far from springs, and on the hot ash of island 3.',
      thick_skin: 'Helps on the cold snow of island 2.',
      night_eyes: 'You see up to 2 cells further at night.',
      sure_foot: 'Island 2 has many rocky steps and ice walls on the way up.',
      green_thumb: 'Plants grow back in 70% of the time.',
      patient_angler: 'Fish bite 70% of the time, not 40%. Great with the fishing rod.',
      animal_friend: 'Wild animals notice you 2 cells later, so you can walk past them more easily.',
      wild_sense: 'Red cells show where an animal would come after you. Walk around them.',
    },
  },
  animals: {
    title: 'Animals',
    intro: 'You cannot hurt animals. Walk into an animal to shoo it away for a few turns (a calm one does not care). Animals only react when they see you and you are close enough.',
    tempers: {
      calm: 'Calm: does not mind you at all.',
      shy: 'Shy: keeps away from you.',
      grumpy: 'Grumpy: if you stay next to it, it can hurt you. Then it runs away.',
      cheeky: 'Cheeky: when you carry food, it comes and takes one. It never takes what the island goal still needs.',
      charger: 'Charger: when it sees you, it runs at you, 2 cells a turn, and knocks you over. Then it trots off.',
      chaser: 'Chaser: follows you for 6 turns and stings while it is next to you. Leave the grass and it gives up at once.',
      stray: 'Stray: a lost dog. Bring it food to adopt it.',
    },
    lives: 'Lives in',
    wild: 'Wild: lives far from camp (25 cells or more).',
    harm: (damage, chance) => `Hurts: −${damage} Health (${chance}% chance each turn).`,
    dog: 'Your dog barks it away.',
    sleeps: 'Sleeps from 7:00 to 19:00. At night it follows you for a few steps, until you leave its cave.',
    climbs: 'Climbs over rocky steps and ice walls.',
    paras: [
      '**Wild animals** are the real danger. They live far from your camp, which is why explorers faint far from home. Stay away from them, or keep your Food and Water high so you heal.',
      'Wild sense (a skill) shows in red where an animal would come after you. Animal friend makes wild animals notice you later, and stops crabs and monkeys.',
    ],
  },
  dog: {
    title: 'The dog',
    paras: [
      'A stray dog lives far from camp on each island. **Walk into it with food in your bag** to adopt it. It eats one item (raw fish first) and follows you from then on, also to the next island.',
      'Your dog **barks away** crabs, monkeys, squirrels and snakes within 3 cells. Boars, goats, wasps and bears do not care.',
      'The dog needs **food and water** too. Feed it from the Bag (raw fish gives it 30 Food). It drinks when you drink near it, and by itself next to springs and rivers. If its food or water runs out, it is too tired to help, but it never dies. Look after it and it is happy again.',
      'Walk into your dog to swap places with it. If it gets lost, it runs back to you.',
    ],
  },
  islands: {
    title: 'The islands and their goals',
    one: {
      title: 'Island 1: the tropical island',
      paras: [
        'The island has three parts. You start on the **home coast**. A wall of **brambles** closes it off: make a stone axe to chop through. Behind it is the **wild forest**, and then a **river**: build a bridge to reach the **far side**, where most hills and caves are.',
        'Wide sandy beaches with palms, a forest of broadleaf and pine trees, and **three deep caves**. Coconuts, berries, mushrooms, fish and glowcaps are the food. Crabs, turtles, monkeys, piglets and bats live here, and far from camp boars, wasps, snakes and cave bears.',
        'An old **boat wreck** lies on a beach of the far side. Repair it and sail to the next island. The hull needs **tar** from the old barrels on the tide islet (walk over the sandbar at low tide).',
        'When the boat is ready, walk into it to set sail. You land on Pine Ridge and keep your bag, XP, skills, stars and your dog.',
      ],
    },
    two: {
      title: 'Island 2: Pine Ridge',
      paras: [
        'A cold island with a northern forest of spruces, birches, apple trees and ferns, a big mountain of cliffs and scree, and **two deep caves**. There are no coconuts here: apples, berries, mushrooms, fish and glowcaps are the food. Snow is cold even in the day: bring wood for a fire.',
        'Crabs, rabbits, squirrels and bats live here, and far from camp boars, wasps, cave bears and **mountain goats**. The goats climb over the rocky steps.',
        'An old stone ring stands on the snowy peak. Build a **signal beacon** on it and light it, so a passing ship takes you on board. On the way up, you cross a ring of **rocky steps** (build a ladder on one) and then a ring of **ice walls** (hang a climbing rope on one). The tinder needs **resin** from snowy spruces.',
        'When the beacon burns, a ship takes you on board. A storm drives it off course, and it puts you ashore on Ember Isle. You keep your bag, XP, skills, stars and your dog.',
      ],
    },
    three: {
      title: 'Island 3: Ember Isle',
      paras: [
        'A storm puts you ashore on a warm volcano island. Palms and a jungle grow on the low slopes; higher up is grey **ash** between black basalt cliffs. The ash is hot in the sun: out there in the day you get thirsty faster. Springs are few, but **hot springs** on the ash give water and warm you like a fire.',
        'A **lava flow** takes the place of the river. You cannot walk on lava: lay **stepping stones** (8 stones) across it. An old **balloon** lies on the crater rim, next to the lake of lava. Fix its basket and cloth, and build a burner. The burner needs **sulphur** from the steam vents near the crater. Then fly away!',
        'Coconuts, berries, mushrooms, fish and glowcaps from the **two deep caves** are the food. Crabs, turtles, monkeys, bats, shy **lizards** and cheeky **gulls** that snatch food live here. Far from camp live boars, wasps, snakes and **scorpions** that sting.',
        'When the balloon is ready, fly away over the sea. You keep your bag, XP, skills, stars and your dog.',
      ],
    },
    four: {
      title: 'Island 4: the old oil rig',
      paras: [
        'The wind drives your balloon far out to sea, and it comes down on an **old oil rig**. There is no land here: steel **platforms** stand on legs in the sea, joined by **gangways**. Gulls live on the decks.',
        'Some gangways are **broken** in the middle. Gather **scrap metal** from the scrap piles and build “Mend gangway” next to a broken end (6 scrap). Then you can cross.',
        'There are no trees and no springs. Drink at the **rain water tanks**. Fish from the decks, and pick **mussels** off the rig legs at the waterline. Old pallets give wood, and old fishing nets give rope. The **crew cabin** is your camp: sleep in its bed, and cook fish at its stove.',
        'The **radio room** stands on the platform furthest away. Mend its aerial, give its generator **diesel** from the old fuel drums, and fix the radio set. Then call for help.',
        'Repair the old **drilling tower** (12 scrap, 2 rope): its pump gives 2 diesel every half day. Repair the old **fishing boat** at the dock (10 scrap, 6 wood, 4 rope), then walk into it to open the sea chart. Sail to islands 1, 2 and 3 to fetch wood, stone, food and more. A trip takes 6 hours and 2 diesel. The **hold** carries 60 heavy things, and every island stays as you left it.',
        'After the call for help, walk into the radio to order **one crate each day**: food, building materials or fuel. About 2 hours later a helicopter drops it on the helipad. Build a **platform** (6 scrap, 2 wood) at the edge of the crew platform for more room, and a **rain tank** (6 scrap) for water.',
      ],
    },
    goalTitle: 'Goal stages',
    goalIntro: 'Walk into the goal to give it what you carry. You can bring things in as many trips as you like. The Build panel shows the next step.',
    stageCols: { stage: 'Step', cost: 'Needs' },
    total: 'All together',
    starsTitle: 'Island stars',
    starsIntro: 'Each island has three extra tasks. They never block the goal, and each star gives 5 XP.',
  },
  together: {
    title: 'How it all fits together',
    intro: 'Most things on the island help with something else. These chains show the most important ones.',
    chains: [
      { title: 'From fish to a full tummy', steps: ['Earn 10 XP', 'Learn “Fishing rod”', 'Make a fishing rod', 'Walk into the sea to fish', 'Cook the fish at a campfire', 'Best food, and supplies for the boat'] },
      { title: 'Opening up the island', steps: ['Wood, stones, a leaf', 'Make a stone axe', 'Chop through the brambles', 'Chop logs from trees', 'Build a bridge', 'Reach the far side and the boat'] },
      { title: 'A warm, safe home', steps: ['Campfire and lean-to', 'Collect for the hut (logs and rope)', 'Build the hut: your camp', 'Full rest in its bed', 'Add a workshop, hearth and rain barrel', 'Cook, drink and heal at home'] },
      { title: 'Rope for the goals', steps: ['Gather big leaves', 'Twist rope (2 leaves)', 'Rope maker: 2 ropes for 2 leaves', 'Mast, sail, beacon and balloon', 'Ladders and climbing ropes'] },
      { title: 'Up the volcano', steps: ['Gather stones', 'Lay stepping stones over the lava', 'Climb the hot ash (drink at the hot springs)', 'Scrape sulphur off the steam vents', 'Fix the old balloon', 'Fly away'] },
      { title: 'Across the rig', steps: ['Gather scrap from the piles', 'Mend a broken gangway (6 scrap)', 'Reach the next platform', 'Pour diesel out of the old drums', 'Repair the radio room', 'Call for help'] },
      { title: 'Into the deep caves', steps: ['Find a cave in the rocky hills', 'It is dark inside, even in the day', 'Pick glowcaps: food with lots of Energy', 'Break off crystals', 'Make a crystal lantern', 'See further in caves and at night'] },
      { title: 'Staying safe from wild animals', steps: ['Eat and drink well (above 50)', 'Health comes back', 'Wild sense shows danger', 'Animal friend: they notice you later', 'Your dog barks snakes away'] },
    ],
  },
  tips: {
    title: 'Tips',
    list: [
      'Build your first camp near a spring, and put the campfire next to your shelter.',
      'Choose the place for your hut well: you can build only one on each island. Near the coast is good for fishing.',
      'Keep some coconuts or apples in your bag for long trips: they give food and water.',
      'Give the goal what you have whenever you pass it. It remembers what it already got.',
      'Learn “Fishing rod” with your first skill point.',
      'At high tide, wait on the islet: its palm gives coconuts.',
      'Bears sleep in the day. Go into caves between 7:00 and 19:00.',
      'Each deep cave has a chest at its far end. Its glowcaps grow back.',
      'Monkeys and squirrels take food, but never what the goal still needs.',
    ],
  },
  footer: 'The numbers on this page come straight from the game, so they are always up to date.',
};

const de: WikiWords = {
  title: 'Insel-Handbuch',
  tagline: 'Alles über die Insel: deine Bedürfnisse, was du sammeln und bauen kannst, die Talente, die Tiere und wie alles zusammenpasst.',
  play: 'Zum Spiel',
  contents: 'Inhalt',
  island: (n) => `Insel ${n}`,
  hours: (h) => (h >= 24 && h % 24 === 0 ? `${h / 24} ${h === 24 ? 'Tag' : 'Tagen'}` : `${String(h).replace('.', ',')} ${h === 1 ? 'Stunde' : 'Stunden'}`),
  percent: (p) => `${p} %`,
  items: {
    coconut: 'Kokosnuss', berries: 'Beeren', mushroom: 'Pilz', cooked_fish: 'Gebratener Fisch', apple: 'Apfel',
    wood: 'Holz', log: 'Holzstämme', leaves: 'Große Blätter', stone: 'Stein', fish: 'Roher Fisch', rope: 'Seil',
    axe: 'Steinaxt', fishing_rod: 'Angelrute', tar: 'Teer', resin: 'Harz', sulphur: 'Schwefel',
    glowcap: 'Leuchtpilz', crystal: 'Kristall', lantern: 'Kristalllaterne', scrap: 'Schrott', diesel: 'Diesel', mussels: 'Muscheln', pack_frame: 'Kraxe',
  },
  ground: { sand: 'Strand', grass: 'Wald', cave: 'Höhlen', scree: 'Geröll', snow: 'Schnee', ash: 'Asche', deck: 'Decks der Bohrinsel' },

  start: {
    title: 'Dein erster Tag',
    intro: 'Du wirst ohne alles an einen Strand gespült. Das Spiel geht nur weiter, wenn du etwas tust: Jeder Schritt ist ein Zug, und ein Zug sind sechs Minuten auf der Inseluhr. Lass dir Zeit.',
    steps: [
      '**Sammle.** Lauf gegen Palmen, Büsche, Baumstämme und Kiesel. Palmen geben Kokosnüsse (Essen und Trinken) und große Blätter.',
      '**Trink.** Such eine Quelle. Kokosnüsse geben auch Wasser, aber das Meer ist zu salzig.',
      '**Bau ein Lagerfeuer** (3 Holz, 2 Steine), bevor es dunkel wird. Es hält dich warm und macht die Nacht hell.',
      '**Bau einen Unterschlupf.** Ein Unterstand ist billig und schnell gebaut. Schlaf darin, dann wird er dein Zuhause. Später baust du eine Hütte: dein Lager. Für sie brauchst du Holzstämme, und dafür die Steinaxt.',
      '**Schlaf in der Nacht.** Nächte sind dunkel und kalt. Schlaf in deinem Unterschlupf neben deinem Feuer.',
      '**Werde besser.** Alles, was du sammelst und baust, gibt EP. Gib Talentpunkte für Talente aus. Lerne zuerst die Angelrute.',
    ],
  },
  needs: {
    title: 'Deine fünf Bedürfnisse',
    intro: 'Die Balken oben zeigen fünf Bedürfnisse, jedes von 0 bis 100. Sinkt eines unter 25, pulsiert sein Balken und das Protokoll warnt dich.',
    fill: 'Steigt',
    drain: 'Sinkt',
    cards: {
      health: { fill: 'Langsam, solange Essen und Wasser beide über 50 sind und nichts leer ist. Im Schlaf schneller, im Bett der Hütte am schnellsten.', drain: 'Wenn ein anderes Bedürfnis leer ist, und wenn wilde Tiere dir wehtun.' },
      food: { fill: 'Wenn du isst. Öffne die Tasche und tippe auf Essen.', drain: 'Die ganze Zeit: etwa 108 an einem ganzen Tag, im Schlaf nur halb so viel.' },
      water: { fill: 'An einer Quelle, einer heißen Quelle oder am Fluss (+35 je Schluck) und durch Kokosnüsse, Äpfel und Beeren.', drain: 'So schnell wie Essen. Draußen auf der heißen Asche von Insel 3 am Tag bis zu 50 % schneller.' },
      energy: { fill: 'Wenn du schläfst. Nur das Bett in deiner Hütte füllt sie ganz.', drain: 'Langsam, solange du wach bist (etwa 60 am Tag). Klettern an Leitern und Seilen kostet auch etwas.' },
      warmth: { fill: 'Neben einem Lagerfeuer oder einer heißen Quelle, in einem Unterschlupf oder einer Höhle und bei Tageslicht.', drain: 'Nachts im Freien, und auf Schnee auch am Tag.' },
    },
    foodTitle: 'Essen und Trinken',
    foodIntro: 'Jedes Essen füllt diese Bedürfnisse um den gezeigten Wert. Wenn Essen fast voll ist, kannst du nichts essen, außer es gibt auch Wasser.',
    cols: { item: 'Essen', food: 'Essen', water: 'Wasser', energy: 'Energie', from: 'Woher' },
    foodTip: 'Obst, Beeren und Pilze machen nur ein bisschen satt. **Gebratener Fisch ist mit Abstand das beste Essen**: Drei davon reichen für einen ganzen Tag.',
  },
  health: {
    title: 'Leben und Ohnmacht',
    paras: [
      'Auf der Insel stirbt niemand. Wenn dein Leben 0 erreicht, wirst du **ohnmächtig**. Du wachst am nächsten Morgen um 6:00 zu Hause auf, mit allem in deiner Tasche, und ein Hinweis sagt dir, warum es passiert ist.',
      'Danach hast du 50 Leben, mindestens 25 Essen und 30 Wasser, 70 Energie und 80 Wärme. Dein **Zuhause** ist der letzte Unterschlupf oder die letzte Höhle, wo du geschlafen hast. Am Anfang ist es der Strand, an dem du angekommen bist.',
      'Jedes leere Bedürfnis kostet jeden Zug 1 Leben. Leben kommt nur zurück, solange **Essen und Wasser beide über 50** sind. Wer schlecht isst, bleibt also verletzt.',
    ],
  },
  time: {
    title: 'Tag, Nacht und Gezeiten',
    paras: [
      'Ein Tag hat 240 Züge. Eine neue Insel beginnt um 8:00 an Tag 1. Nachts siehst du nur halb so weit, und im Freien wird es sehr kalt. Lagerfeuer machen 5 Felder um sich herum hell.',
      'Auf Insel 1 führt eine Sandbank zu einer kleinen **Gezeiteninsel**. Die Sandbank ist nur bei Ebbe trocken. Kommt die Flut, während du darauf stehst, watest du zurück an Land, nass und kalt (−15 Wärme). Auf der kleinen Insel kannst du auf die nächste Ebbe warten: Sie ist nie mehr als 6 Stunden entfernt.',
    ],
    phases: { night: 'Nacht', dawn: 'Morgen', day: 'Tag', dusk: 'Abend' },
    lowTide: 'Ebbe',
    highTide: 'Flut',
    bears: 'Höhlenbären schlafen',
    rowLight: 'Licht',
    rowTide: 'Gezeiten (Insel 1)',
    rowBears: 'Höhlenbären',
  },
  warmth: {
    title: 'Wärme, Feuer und Unterschlupf',
    paras: [
      'Wärme bewegt sich immer auf ein Ziel zu. Das Ziel hängt davon ab, wo du stehst und wie dunkel es ist. Sie steigt schnell (+1,5 je Zug) und sinkt langsam (−0,6 je Zug).',
      'Bis 2 Felder neben einem Lagerfeuer ist das Ziel immer 100.',
      'Auch wo du schläfst, ist wichtig. Nur das **Bett in deiner Hütte** lässt dich ganz ausschlafen. Überall sonst wachst du auf, wenn deine Energie die Grenze des Ortes erreicht. Ein Unterschlupf macht den Schlaf auch schneller.',
    ],
    cols: { place: 'Wo du bist', target: 'Wärme in der Nacht', rest: 'Schlaf füllt Energie bis', sleep: 'Dauer ab Energie 20' },
    open: 'Im Freien',
    cave: 'Höhle',
    fire: 'Neben einem Lagerfeuer',
    tip: 'Auf dem Schnee von Insel 2 ist es auch am Tag kalt: Auf offenem Schnee sinkt die Wärme am Tag auf 60 und nachts auf 0. Nimm Holz für ein Feuer mit.',
  },
  camp: {
    title: 'Dein Lager: die Hütte und ihre Räume',
    paras: [
      'Die Hütte ist viel Arbeit, und auf jeder Insel gibt es nur eine. Bau zuerst ihr **Gerüst**, dann lauf dagegen, um ihm die Dinge zu geben, so oft du willst. Die Hütte ist dein **Lager**: Lauf hinein, um sie zu betreten. Das Hütten-Fenster zeigt das Bett, die Kartenwand und die Räume.',
      'Nur im **Bett** schläfst du dich ganz aus, und dort kommt dein Leben im Schlaf schneller zurück. Mit dem Talent Kartograf hängt deine Karte an der Wand.',
    ],
    hutCost: 'Die Hütte kostet',
    roomsTitle: 'Räume',
    roomsIntro: 'In der Hütte baust du Räume an. Jeder Raum gibt 1 EP für jedes Teil, das er kostet, und du siehst ihn von außen an der Hütte.',
    cols: { room: 'Raum', cost: 'Kostet', effect: 'Was er tut' },
    workshop: (extra) => `Mit dem Talent Seilmacher geben 2 Blätter hier ${2 + extra} Seile.`,
    hearth: (bed, hearth) => `Ein Feuer in der Hütte: Brate dort Fisch (auch mit dem Grill-Knopf), und es macht die Nacht um die Hütte hell. Im Schlaf kommt dein Leben ${hearth}-mal so schnell zurück, nicht nur ${bed}-mal.`,
    barrel: (water) => `Trink im Hütten-Fenster aus der Tonne: +${water} Wasser.`,
  },
  gather: {
    title: 'Sammeln',
    intro: 'Lauf gegen eine Pflanze, einen Stein oder eine Truhe, um etwas zu sammeln. Jedes Mal gibt es 1 EP. Manches wächst nach, manches ist für immer weg.',
    cols: { what: 'Was', gives: 'Gibt', after: 'Danach', islands: 'Inseln' },
    regrow: (h) => `Wächst nach in ${h}`,
    gone: 'Für immer weg',
    becomes: (name) => `Wird zu: ${name}`,
    needs: (tool) => `Braucht die ${tool}`,
    withTool: (tool) => `mit der ${tool}`,
    chance: (p) => `${p} % Chance`,
    water: 'Wasser',
    river: 'Fluss',
    sea: 'Meer',
    waterRows: {
      spring: 'Lauf dagegen, um zu trinken: +35 Wasser.',
      river: 'Lauf dagegen, um zu trinken: +35 Wasser. Bau eine Brücke, um ihn zu überqueren.',
      sea: 'Zu salzig zum Trinken. Mit einer Angelrute kannst du darin angeln.',
    },
  },
  itemsSection: {
    title: 'Gegenstände',
    intro: 'Alles, was du trägst, kommt in deine Tasche. Du kannst so viel tragen, wie du willst.',
    groups: { food: 'Essen', material: 'Material', rare: 'Seltenes Material für das Inselziel', tool: 'Werkzeuge' },
    from: 'Von',
    usedFor: 'Für',
    fishing: 'Angeln im Meer',
    goal: 'das Inselziel',
    rawNote: 'Roh: Brate ihn zuerst am Lagerfeuer.',
    toolNote: 'Ein Werkzeug bleibt in deiner Tasche und geht nie kaputt. Du brauchst nur eins.',
  },
  build: {
    title: 'Bauen',
    intro: 'Öffne das Bauen-Fenster. Es zeigt jedes Rezept und was dir noch fehlt. Bauen gibt 1 EP für jedes Teil, das es kostet (ein Lagerfeuer gibt 5 EP).',
    cols: { what: 'Was', cost: 'Kostet', note: 'Gut zu wissen' },
    skill: (name) => `Lerne zuerst das Talent „${name}“.`,
    atFire: 'Stell dich neben ein Lagerfeuer.',
    onto: (name) => `Stell dich daneben (${name}).`,
    site: 'Bau zuerst das Gerüst, dann bring die Dinge in mehreren Wegen.',
    paras: [
      'Gebäude entstehen vor dir, in die Richtung, in die du schaust. Eine Brücke geht geradeaus über den Fluss (1 bis 3 Felder Wasser), Trittsteine über den Lavastrom von Insel 3. Dinge wie die Axt und Seile kommen in deine Tasche.',
      'Ein Gebäude wird nie so gebaut, dass es einen Teil der Insel absperrt. Du kannst dich also nie selbst einsperren.',
      'Deine Tasche trägt **30 schwere Dinge**: Holz, Holzstämme, Steine, Schrott und Diesel. Essen, Blätter, Seile, Werkzeuge und seltene Materialien wiegen nichts. Wenn die Tasche voll ist, kannst du keine schweren Dinge mehr sammeln. Bewahr den Rest in einer **Vorratskiste** auf (eine pro Insel). Das Talent Starker Rücken gibt 10 dazu, eine Kraxe 15.',
    ],
  },
  skills: {
    title: 'EP und Talente',
    intro: 'Für fast alles, was du tust, bekommst du EP (Erfahrungspunkte). EP geben dir Talentpunkte, und mit Talentpunkten lernst du Talente im Talente-Fenster. Ein Stern auf dem Talente-Knopf zeigt, dass du Punkte ausgeben kannst.',
    xpTitle: 'So bekommst du EP',
    xpRows: [
      '**Sammeln** an einer Pflanze, einem Stein oder einer Truhe: 1 EP.',
      '**Bauen** eines Rezepts oder eines Raums in der Hütte: 1 EP für jedes Teil, das es kostet (Lagerfeuer 5, Fisch braten 1).',
      '**Einen Fisch fangen**: 2 EP.',
      '**Dem Inselziel etwas geben**: 1 EP für jedes Teil.',
      '**Einen Inselstern verdienen**: 5 EP.',
    ],
    xp: 'EP',
    pointsTitle: 'Talentpunkte',
    pointsIntro: 'Der erste Talentpunkt braucht 10 EP. Jeder nächste Punkt braucht 5 EP mehr als der davor.',
    point: (n) => `Punkt ${n}`,
    pathsTitle: 'Die drei Pfade',
    paths: {
      build: 'Talente, mit denen du Neues bauen kannst oder billiger baust.',
      explorer: 'Talente, die dich als Entdecker stärker machen.',
      improve: 'Talente, mit denen die Insel besser für dich arbeitet.',
    },
    cost: (n) => `${n} ${n === 1 ? 'Punkt' : 'Punkte'}`,
    combo: {
      fishing_rod: 'Das wichtigste Talent: Fisch ist das beste Essen, und das Boot braucht 3 gebratene Fische.',
      handy_builder: 'Jedes Rezept und jeder Hüttenraum mit Holz kostet 1 weniger: Lagerfeuer, Unterschlupf, Brücken, Leitern.',
      rope_maker: 'Die Inselziele und die Hütte brauchen viele Seile. So brauchst du nur halb so viele Blätter. In einer Hütte mit Werkstatt geben 2 Blätter 3 Seile.',
      cartographer: 'Die Karte hängt an der Wand deiner Hütte. Sie zeigt Hütten, Lagerfeuer, Quellen, das Ziel, die tiefen Höhlen, die du gefunden hast, und wo du Höhlenbären gesehen hast.',
      small_sips: 'Gut für lange Wege weit weg von Quellen, und auf der heißen Asche von Insel 3.',
      thick_skin: 'Hilft auf dem kalten Schnee von Insel 2.',
      night_eyes: 'Du siehst nachts bis zu 2 Felder weiter.',
      sure_foot: 'Auf Insel 2 gibt es auf dem Weg nach oben viele Felsstufen und Eiswände.',
      green_thumb: 'Pflanzen wachsen in 70 % der Zeit nach.',
      patient_angler: 'Fische beißen in 70 % der Fälle an, nicht in 40 %. Super mit der Angelrute.',
      animal_friend: 'Wilde Tiere bemerken dich 2 Felder später, so kommst du leichter an ihnen vorbei.',
      wild_sense: 'Rote Felder zeigen, wo ein Tier dich verfolgen würde. Geh um sie herum.',
    },
  },
  animals: {
    title: 'Tiere',
    intro: 'Du kannst Tieren nicht wehtun. Lauf gegen ein Tier, um es für ein paar Züge zu verscheuchen (ein ruhiges Tier stört das nicht). Tiere reagieren nur, wenn sie dich sehen und du nah genug bist.',
    tempers: {
      calm: 'Ruhig: Du bist ihm ganz egal.',
      shy: 'Scheu: Es hält Abstand zu dir.',
      grumpy: 'Grantig: Wenn du neben ihm bleibst, kann es dir wehtun. Dann läuft es weg.',
      cheeky: 'Frech: Wenn du Essen trägst, kommt es und nimmt dir eins weg. Was das Inselziel noch braucht, nimmt es nie.',
      charger: 'Stürmer: Wenn es dich sieht, rennt es auf dich zu, 2 Felder je Zug, und wirft dich um. Dann trabt es davon.',
      chaser: 'Verfolger: Folgt dir 6 Züge lang und sticht, solange es neben dir ist. Verlass das Gras, dann gibt es sofort auf.',
      stray: 'Streuner: ein verlorener Hund. Bring ihm Essen, dann gehört er zu dir.',
    },
    lives: 'Lebt in',
    wild: 'Wild: lebt weit weg vom Lager (25 Felder oder mehr).',
    harm: (damage, chance) => `Tut weh: −${damage} Leben (${chance} % Chance je Zug).`,
    dog: 'Dein Hund verbellt es.',
    sleeps: 'Schläft von 7:00 bis 19:00. Nachts folgt es dir ein paar Schritte, bis du seine Höhle verlässt.',
    climbs: 'Klettert über Felsstufen und Eiswände.',
    paras: [
      '**Wilde Tiere** sind die echte Gefahr. Sie leben weit weg von deinem Lager. Darum werden Entdecker weit weg von zu Hause ohnmächtig. Halte Abstand, oder halte Essen und Wasser hoch, damit du heilst.',
      'Spürsinn (ein Talent) zeigt rot, wo ein Tier dich verfolgen würde. Tierfreund sorgt dafür, dass wilde Tiere dich später bemerken, und hält Krabben und Affen fern.',
    ],
  },
  dog: {
    title: 'Der Hund',
    paras: [
      'Auf jeder Insel lebt ein streunender Hund weit weg vom Lager. **Lauf mit Essen in der Tasche gegen ihn**, dann gehört er zu dir. Er frisst ein Teil (am liebsten rohen Fisch) und folgt dir ab dann, auch auf die nächste Insel.',
      'Dein Hund **verbellt** Krabben, Affen, Eichhörnchen und Schlangen bis 3 Felder weit. Wildschweine, Ziegen, Wespen und Bären stört das nicht.',
      'Auch der Hund braucht **Essen und Wasser**. Füttere ihn aus der Tasche (roher Fisch gibt ihm 30 Essen). Er trinkt, wenn du in seiner Nähe trinkst, und von selbst neben Quellen und Flüssen. Ist sein Essen oder Wasser leer, ist er zu müde zum Helfen, aber er stirbt nie. Kümmere dich um ihn, dann ist er wieder fröhlich.',
      'Lauf gegen deinen Hund, um mit ihm den Platz zu tauschen. Wenn er zurückbleibt, rennt er wieder zu dir.',
    ],
  },
  islands: {
    title: 'Die Inseln und ihre Ziele',
    one: {
      title: 'Insel 1: die Tropeninsel',
      paras: [
        'Die Insel hat drei Teile. Du beginnst an der **Heimatküste**. Eine Wand aus **Dornengestrüpp** sperrt sie ab: Bau eine Steinaxt, um dich durchzuschlagen. Dahinter liegt der **wilde Wald** und dann ein **Fluss**: Bau eine Brücke zur **anderen Seite**, wo die meisten Hügel und Höhlen sind.',
        'Breite Sandstrände mit Palmen, ein Wald aus Laubbäumen und Kiefern und **drei tiefe Höhlen**. Kokosnüsse, Beeren, Pilze, Fisch und Leuchtpilze sind das Essen. Hier leben Krabben, Schildkröten, Affen, Ferkel und Fledermäuse, und weit weg vom Lager Wildschweine, Wespen, Schlangen und Höhlenbären.',
        'Ein altes **Bootswrack** liegt an einem Strand auf der anderen Seite. Repariere es und segle zur nächsten Insel. Der Rumpf braucht **Teer** aus den alten Fässern auf der Gezeiteninsel (geh bei Ebbe über die Sandbank).',
        'Wenn das Boot fertig ist, lauf dagegen, um loszusegeln. Du landest auf dem Kiefernkamm und behältst deine Tasche, EP, Fähigkeiten, Sterne und deinen Hund.',
      ],
    },
    two: {
      title: 'Insel 2: Kiefernkamm',
      paras: [
        'Eine kalte Insel mit einem Nadelwald aus Fichten, Birken, Apfelbäumen und Farnen, einem großen Berg aus Klippen und Geröll und **zwei tiefen Höhlen**. Hier gibt es keine Kokosnüsse: Äpfel, Beeren, Pilze, Fisch und Leuchtpilze sind das Essen. Schnee ist auch am Tag kalt: Nimm Holz für ein Feuer mit.',
        'Hier leben Krabben, Hasen, Eichhörnchen und Fledermäuse, und weit weg vom Lager Wildschweine, Wespen, Höhlenbären und **Bergziegen**. Die Ziegen klettern über die Felsstufen.',
        'Auf dem verschneiten Gipfel steht ein alter Steinkreis. Bau darauf ein **Leuchtfeuer** und zünde es an, damit ein Schiff dich an Bord holt. Auf dem Weg nach oben kommst du über einen Ring aus **Felsstufen** (bau eine Leiter daran) und dann über einen Ring aus **Eiswänden** (häng ein Kletterseil daran). Der Zunder braucht **Harz** von verschneiten Fichten.',
        'Wenn das Leuchtfeuer brennt, holt dich ein Schiff an Bord. Ein Sturm treibt es vom Kurs ab, und es setzt dich auf der Glutinsel an Land. Du behältst deine Tasche, EP, Fähigkeiten, Sterne und deinen Hund.',
      ],
    },
    three: {
      title: 'Insel 3: Glutinsel',
      paras: [
        'Ein Sturm setzt dich auf einer warmen Vulkaninsel an Land. Unten wachsen Palmen und ein Dschungel; weiter oben liegt graue **Asche** zwischen schwarzen Basaltfelsen. Die Asche ist heiß in der Sonne: Dort bekommst du am Tag schneller Durst. Es gibt nur wenige Quellen, aber **heiße Quellen** auf der Asche geben Wasser und wärmen dich wie ein Feuer.',
        'Ein **Lavastrom** ersetzt den Fluss. Auf Lava kannst du nicht laufen: Leg **Trittsteine** (8 Steine) darüber. Ein alter **Ballon** liegt am Kraterrand, neben dem Lavasee. Repariere Korb und Hülle und bau einen Brenner. Der Brenner braucht **Schwefel** von den Dampflöchern am Krater. Dann flieg davon!',
        'Kokosnüsse, Beeren, Pilze, Fisch und Leuchtpilze aus den **zwei tiefen Höhlen** sind das Essen. Hier leben Krabben, Schildkröten, Affen, Fledermäuse, scheue **Eidechsen** und freche **Möwen**, die dir Essen klauen. Weit weg vom Lager leben Wildschweine, Wespen, Schlangen und **Skorpione**, die stechen.',
        'Wenn der Ballon fertig ist, flieg über das Meer davon. Du behältst deine Tasche, EP, Fähigkeiten, Sterne und deinen Hund.',
      ],
    },
    four: {
      title: 'Insel 4: die alte Bohrinsel',
      paras: [
        'Der Wind treibt deinen Ballon weit aufs Meer hinaus, und er landet auf einer **alten Bohrinsel**. Hier gibt es kein Land: **Plattformen** aus Stahl stehen auf Beinen im Meer, verbunden durch **Stege**. Auf den Decks leben Möwen.',
        'Manche Stege sind in der Mitte **kaputt**. Sammle **Schrott** von den Schrotthaufen und bau „Steg reparieren“ neben einem kaputten Ende (6 Schrott). Dann kommst du hinüber.',
        'Es gibt keine Bäume und keine Quellen. Trink an den **Regenwassertanks**. Angle von den Decks aus, und pflück **Muscheln** von den Beinen der Bohrinsel. Alte Paletten geben Holz, und alte Fischernetze geben Seil. Die **Mannschaftskabine** ist dein Lager: Schlaf in ihrem Bett und brate Fisch auf ihrem Herd.',
        'Der **Funkraum** steht auf der Plattform, die am weitesten weg ist. Richte seine Antenne auf, gib seinem Generator **Diesel** aus den alten Ölfässern und repariere das Funkgerät. Dann ruf Hilfe.',
        'Repariere den alten **Bohrturm** (12 Schrott, 2 Seile): Seine Pumpe gibt jeden halben Tag 2 Diesel. Repariere das alte **Fischerboot** am Anleger (10 Schrott, 6 Holz, 4 Seile), dann lauf dagegen, um die Seekarte zu öffnen. Fahr zu den Inseln 1, 2 und 3 und hol Holz, Steine, Essen und mehr. Eine Fahrt dauert 6 Stunden und braucht 2 Diesel. Der **Laderaum** trägt 60 schwere Dinge, und jede Insel bleibt so, wie du sie verlassen hast.',
        'Nach dem Hilferuf lauf gegen das Funkgerät, um **jeden Tag eine Kiste** zu bestellen: Essen, Baumaterial oder Treibstoff. Etwa 2 Stunden später wirft ein Hubschrauber sie auf dem Landeplatz ab. Bau eine **Plattform** (6 Schrott, 2 Holz) am Rand der Mannschaftsplattform für mehr Platz, und einen **Regentank** (6 Schrott) für Wasser.',
      ],
    },
    goalTitle: 'Schritte zum Ziel',
    goalIntro: 'Lauf gegen das Ziel, um ihm zu geben, was du dabeihast. Du kannst so oft kommen, wie du willst. Das Bauen-Fenster zeigt den nächsten Schritt.',
    stageCols: { stage: 'Schritt', cost: 'Braucht' },
    total: 'Alles zusammen',
    starsTitle: 'Inselsterne',
    starsIntro: 'Jede Insel hat drei Zusatzaufgaben. Sie halten dich nie vom Ziel ab, und jeder Stern gibt 5 EP.',
  },
  together: {
    title: 'Wie alles zusammenpasst',
    intro: 'Fast alles auf der Insel hilft bei etwas anderem. Diese Ketten zeigen die wichtigsten.',
    chains: [
      { title: 'Vom Fisch zum vollen Bauch', steps: ['10 EP sammeln', 'Talent „Angelrute“ lernen', 'Angelrute bauen', 'Ins Meer laufen und angeln', 'Fisch am Lagerfeuer braten', 'Bestes Essen und Vorräte für das Boot'] },
      { title: 'Die Insel öffnen', steps: ['Holz, Steine, ein Blatt', 'Steinaxt bauen', 'Durch das Dornengestrüpp', 'Holzstämme von Bäumen schlagen', 'Brücke bauen', 'Zur anderen Seite und zum Boot'] },
      { title: 'Ein warmes, sicheres Zuhause', steps: ['Lagerfeuer und Unterstand', 'Für die Hütte sammeln (Holzstämme und Seile)', 'Hütte bauen: dein Lager', 'Im Bett ganz ausschlafen', 'Werkstatt, Kamin und Regentonne anbauen', 'Zu Hause braten, trinken und heilen'] },
      { title: 'Seile für die Inselziele', steps: ['Große Blätter sammeln', 'Seil drehen (2 Blätter)', 'Seilmacher: 2 Seile für 2 Blätter', 'Mast, Segel, Leuchtfeuer und Ballon', 'Leitern und Kletterseile'] },
      { title: 'Auf den Vulkan', steps: ['Steine sammeln', 'Trittsteine über die Lava legen', 'Über die heiße Asche steigen (trink an den heißen Quellen)', 'Schwefel von den Dampflöchern kratzen', 'Den alten Ballon reparieren', 'Davonfliegen'] },
      { title: 'Über die Bohrinsel', steps: ['Schrott von den Haufen sammeln', 'Einen kaputten Steg reparieren (6 Schrott)', 'Zur nächsten Plattform', 'Diesel aus den alten Fässern füllen', 'Den Funkraum reparieren', 'Hilfe rufen'] },
      { title: 'In die tiefen Höhlen', steps: ['Finde eine Höhle in den Felshügeln', 'Drinnen ist es dunkel, auch am Tag', 'Pflück Leuchtpilze: Essen mit viel Energie', 'Brich Kristalle ab', 'Bau eine Kristalllaterne', 'Sieh weiter in Höhlen und nachts'] },
      { title: 'Sicher vor wilden Tieren', steps: ['Gut essen und trinken (über 50)', 'Leben kommt zurück', 'Spürsinn zeigt die Gefahr', 'Tierfreund: Sie bemerken dich später', 'Dein Hund verbellt Schlangen'] },
    ],
  },
  tips: {
    title: 'Tipps',
    list: [
      'Bau dein erstes Lager nahe an einer Quelle, und stell das Lagerfeuer neben deinen Unterschlupf.',
      'Wähl den Platz für deine Hütte gut: Auf jeder Insel kannst du nur eine bauen. Nahe an der Küste kannst du gut angeln.',
      'Nimm für lange Wege Kokosnüsse oder Äpfel mit: Sie geben Essen und Wasser.',
      'Gib dem Ziel, was du hast, wann immer du vorbeikommst. Es merkt sich, was es schon bekommen hat.',
      'Lerne mit deinem ersten Talentpunkt die „Angelrute“.',
      'Bei Flut warte auf der Gezeiteninsel: Ihre Palme gibt Kokosnüsse.',
      'Bären schlafen am Tag. Geh zwischen 7:00 und 19:00 in Höhlen.',
      'Jede tiefe Höhle hat ganz hinten eine Truhe. Ihre Leuchtpilze wachsen nach.',
      'Affen und Eichhörnchen nehmen Essen, aber nie das, was das Ziel noch braucht.',
    ],
  },
  footer: 'Die Zahlen auf dieser Seite kommen direkt aus dem Spiel, sie sind also immer aktuell.',
};

export const WIKI: Record<Lang, WikiWords> = { en, de };
