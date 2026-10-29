import type { ItemId } from './items';
import type { ObjectKind } from './objects';
import type { SkillId } from './skills';

// Things the explorer can build from what they've gathered. A recipe either
// places an object in front of the explorer (`builds`) or puts an item in
// the bag (`makes`). Names and descriptions live in src/i18n/.

export type RecipeId = 'campfire' | 'lean_to' | 'hut' | 'store_crate' | 'pack_frame' | 'axe' | 'rope' | 'bridge' | 'fishing_rod' | 'cooked_fish' | 'ladder' | 'climbing_rope' | 'lantern' | 'lava_stones' | 'gangway' | 'platform' | 'rain_tank'
  | 'pickaxe' | 'shovel' | 'crowbar' | 'furnace' | 'smelt' | 'greenhouse' | 'water_maker' | 'fish_trap' | 'hold_upgrade'
  | 'solar_station' | 'galley' | 'machine_shop' | 'lamp_post' | 'fish_stew' | 'boat_motor';

export type Recipe = {
  id: RecipeId;
  cost: Partial<Record<ItemId, number>>;
  /** Another cost that works too, used when the explorer has not got `cost` (logs for the store crate's wood). */
  orCost?: Partial<Record<ItemId, number>>;
  /**
   * A big building that goes up in trips: the recipe places its site (for
   * `cost`, often nothing), and the site takes these materials one trip at a time.
   */
  siteCost?: Partial<Record<ItemId, number>>;
  /** A skill the explorer must have learned first. */
  skill?: SkillId;
  /** Only possible next to a campfire (cooking). */
  atFire?: true;
  /** Only possible next to an object of this kind (the furnace for smelting, the galley for stew). */
  near?: ObjectKind;
  /** Only once this building stands on the island (the rig habitat). */
  needsBuilt?: ObjectKind;
  /** Only on the oil rig. */
  rigOnly?: true;
  /**
   * Built on one of these objects next to the explorer, which it replaces (a
   * ladder on a rocky step). A broken gangway is mended across its whole gap.
   */
  onto?: ObjectKind[];
} & ({ builds: ObjectKind } | { makes: ItemId });

export const RECIPES: Record<RecipeId, Recipe> = {
  campfire: { id: 'campfire', builds: 'campfire', cost: { wood: 3, stone: 2 } },
  lean_to: { id: 'lean_to', builds: 'lean_to', cost: { wood: 4, leaves: 5 } },
  // The camp: only one on each island, and it is big work. More than a bag
  // can carry, so it is built on a site that takes the materials in trips.
  hut: { id: 'hut', builds: 'hut_site', cost: {}, siteCost: { log: 24, wood: 12, leaves: 30, stone: 20, rope: 8 } },
  // Keeps what you do not carry: one on each island. Logs work in place of the wood,
  // for a bag full of logs (saves from before the carry limit).
  store_crate: { id: 'store_crate', builds: 'store_crate', cost: { wood: 6, rope: 2 }, orCost: { log: 6, rope: 2 } },
  // Carry more heavy things; needs the Pack frame skill.
  pack_frame: { id: 'pack_frame', makes: 'pack_frame', cost: { wood: 4, rope: 3 }, skill: 'pack_frame' },
  axe: { id: 'axe', makes: 'axe', cost: { wood: 2, stone: 2, leaves: 1 } },
  rope: { id: 'rope', makes: 'rope', cost: { leaves: 2 } },
  // Faces the way the explorer does; game.ts turns it into bridge_ew when needed.
  bridge: { id: 'bridge', builds: 'bridge_ns', cost: { log: 3, wood: 2, leaves: 3 } },
  // Island 3: flat stones laid across the lava flow, like a bridge (and turned the same way).
  lava_stones: { id: 'lava_stones', builds: 'lava_stones_ns', cost: { stone: 8 } },
  fishing_rod: { id: 'fishing_rod', makes: 'fishing_rod', cost: { wood: 3, leaves: 2 }, skill: 'fishing_rod' },
  cooked_fish: { id: 'cooked_fish', makes: 'cooked_fish', cost: { fish: 1 }, atFire: true },
  // Island 2: ways up the steep steps.
  ladder: { id: 'ladder', builds: 'ledge_ladder', onto: ['ledge'], cost: { wood: 4, rope: 2 } },
  climbing_rope: { id: 'climbing_rope', builds: 'ice_wall_rope', onto: ['ice_wall'], cost: { wood: 1, rope: 4 } },
  // From the crystals of the deep caves: you see further in caves and at night.
  lantern: { id: 'lantern', makes: 'lantern', cost: { crystal: 3, wood: 1, rope: 1 } },
  // Island 4: mend a broken gangway between two platforms of the rig with scrap metal.
  gangway: { id: 'gangway', builds: 'gangway_ew', onto: ['gangway_end_n', 'gangway_end_s', 'gangway_end_e', 'gangway_end_w'], cost: { scrap: 6 } },
  // Island 4: a new cell of deck at the edge of the crew platform, and a tank that catches rain.
  platform: { id: 'platform', builds: 'platform_deck', cost: { scrap: 6, wood: 2 } },
  rain_tank: { id: 'rain_tank', builds: 'water_tank', cost: { scrap: 6 } },
  // The rig's workshop: tools for the islands, and buildings for the rig.
  pickaxe: { id: 'pickaxe', makes: 'pickaxe', cost: { scrap: 4, wood: 2 } },
  shovel: { id: 'shovel', makes: 'shovel', cost: { scrap: 3, wood: 2 } },
  crowbar: { id: 'crowbar', makes: 'crowbar', cost: { scrap: 3 } },
  furnace: { id: 'furnace', builds: 'furnace', cost: { clay: 12, stone: 6 }, rigOnly: true },
  smelt: { id: 'smelt', makes: 'steel_plate', cost: { iron_ore: 2, coal: 1 }, near: 'furnace' },
  greenhouse: { id: 'greenhouse', builds: 'greenhouse', cost: { steel_plate: 4, clay: 10, wood: 4 }, rigOnly: true },
  water_maker: { id: 'water_maker', builds: 'water_maker', cost: { steel_plate: 4, spare_part: 2 }, rigOnly: true },
  fish_trap: { id: 'fish_trap', builds: 'fish_trap', cost: { steel_plate: 2, rope: 2 }, rigOnly: true },
  // Next to the fishing boat: 30 more heavy things in its hold, two times.
  hold_upgrade: { id: 'hold_upgrade', builds: 'hold_upgrade', cost: { steel_plate: 4, spare_part: 2 } },
  // The rig habitat: each building needs a special part from the helicopter,
  // goes up on a steel frame in trips, and opens more to build and order.
  solar_station: {
    id: 'solar_station', builds: 'solar_station_site', cost: {}, siteCost: { solar_panel: 2, steel_plate: 4, scrap: 6 }, rigOnly: true,
  },
  galley: {
    id: 'galley', builds: 'galley_site', cost: {}, siteCost: { cooker: 1, steel_plate: 4, wood: 6 }, rigOnly: true, needsBuilt: 'solar_station',
  },
  machine_shop: {
    id: 'machine_shop', builds: 'machine_shop_site', cost: {}, siteCost: { motor: 1, steel_plate: 6, scrap: 4 }, rigOnly: true, needsBuilt: 'solar_station',
  },
  // What the habitat buildings open: lamps on the decks, stew in the galley, a motor for the boat.
  lamp_post: { id: 'lamp_post', builds: 'lamp_post', cost: { scrap: 3 }, rigOnly: true, needsBuilt: 'solar_station' },
  fish_stew: { id: 'fish_stew', makes: 'fish_stew', cost: { fish: 1, vegetables: 2, mussels: 2 }, rigOnly: true, near: 'galley' },
  boat_motor: { id: 'boat_motor', builds: 'boat_motor', cost: { motor: 1, steel_plate: 2 }, rigOnly: true, needsBuilt: 'machine_shop' },
};

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];
