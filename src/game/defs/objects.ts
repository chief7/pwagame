import type { ItemId } from './items';
import type { RoomId } from './rooms';

// Things standing in the world: plants, rocks, chests, springs and whatever
// the player builds. Kinds double as sprite names. Names and gather texts
// live in src/i18n/.

export type ObjectKind =
  | 'palm_tall' | 'palm_leaning' | 'palm_young'
  | 'tree_broadleaf' | 'tree_pine' | 'bush' | 'berry_bush' | 'mushroom'
  | 'stone_boulder' | 'stone_pebbles' | 'stone_mossy' | 'stalagmite'
  | 'log' | 'log_pile' | 'log_driftwood'
  | 'chest_closed' | 'chest_open' | 'spring'
  | 'campfire' | 'lean_to' | 'hut' | 'hut_site' | 'store_crate'
  | 'bramble' | 'bridge_ns' | 'bridge_ew'
  | 'boat_wreck' | 'boat_hull' | 'boat_mast' | 'boat_sail' | 'boat_ready'
  | 'tree_spruce' | 'tree_spruce_snow' | 'tree_birch' | 'tree_apple' | 'fern'
  | 'beacon_site' | 'beacon_base' | 'beacon_pyre' | 'beacon_ready'
  | 'ledge' | 'ledge_ladder' | 'ice_wall' | 'ice_wall_rope'
  | 'barrel' | 'barrel_empty' | 'sandbar_ns' | 'sandbar_ew'
  | 'glowcap' | 'crystal_cluster'
  | 'lava_stones_ns' | 'lava_stones_ew' | 'steam_vent' | 'hot_spring'
  | 'balloon_site' | 'balloon_basket' | 'balloon_envelope' | 'balloon_ready'
  | 'gangway_ns' | 'gangway_ew' | 'gangway_end_n' | 'gangway_end_s' | 'gangway_end_e' | 'gangway_end_w'
  | 'scrap_pile' | 'rig_container' | 'diesel_drums' | 'diesel_drums_empty' | 'pallet' | 'old_net' | 'water_tank'
  | 'mussel_bed' | 'life_ring' | 'derrick' | 'crane' | 'crew_cabin' | 'balloon_crashed'
  | 'radio_hut' | 'radio_aerial' | 'radio_power' | 'radio_ready'
  | 'derrick_working' | 'fishing_boat_wreck' | 'fishing_boat'
  | 'supply_crate' | 'platform_deck'
  | 'storage_container_0' | 'storage_container_1' | 'storage_container_2' | 'storage_container_3' | 'storage_container_4'
  | 'storage_container_5' | 'storage_container_back'
  | 'ore_vein' | 'clay_bank' | 'sealed_crate' | 'furnace' | 'greenhouse' | 'water_maker' | 'fish_trap' | 'hold_upgrade'
  | 'solar_station_site' | 'galley_site' | 'machine_shop_site' | 'solar_station' | 'galley' | 'machine_shop' | 'lamp_post' | 'boat_motor';

export interface Yield {
  item: ItemId;
  min: number;
  max: number;
  /** Chance (0..1) to get anything at all; defaults to 1. */
  chance?: number;
  /** Only when the explorer carries this tool (logs need the axe). */
  tool?: ItemId;
}

export interface Gather {
  yields: Yield[];
  /** A tool the explorer must carry to gather at all. */
  needs?: ItemId;
  /** Gone for good, turned into another object, or ready again after some turns. */
  after: { remove: true } | { becomes: ObjectKind } | { regrow: number };
}

export interface ObjectDef {
  kind: ObjectKind;
  /** Shelters can be walked into; everything else blocks. */
  walkable?: boolean;
  blocksSight?: boolean;
  gather?: Gather;
  /** Sprite while waiting to regrow. */
  depletedSprite?: string;
  /** Bump to drink: how much Water each sip gives. */
  drink?: number;
  /** Standing here counts as shelter (0..1): warmer nights, better sleep. */
  shelter?: number;
  /** The most Energy a sleep here gives (only the hut bed gives a full 100). */
  rest?: number;
  /** Warms everyone within this many cells. */
  warmthRadius?: number;
  /** Lights up this many cells at night (and in dark caves), unless it is picked and regrowing. */
  lightRadius?: number;
  /** Animation frames (sprite names), cycled by the renderer. */
  frames?: string[];
  /** Built over river cells rather than on the ground (over the lava flow with `onLava`). */
  bridge?: true;
  /** A bridge that crosses lava instead of the river: the stepping stones of island 3. */
  onLava?: true;
  /** A steep step: blocks the way until the explorer builds a way up onto it (a recipe with `onto`). */
  steep?: true;
  /** A way up a steep step: walking onto it is tiring (costs Energy). */
  climb?: true;
  /** The island's goal (see levels.ts): walking into it hands over materials. */
  goal?: true;
  /**
   * A building site: walking into it hands over what the recipe that builds
   * it still needs (its `siteCost`), and then it becomes this object.
   */
  site?: ObjectKind;
  /** What a site placed by world generation (an old wreck to repair) takes; a built site takes its recipe's `siteCost`. */
  siteCost?: Partial<Record<ItemId, number>>;
  /** The fishing boat: walking into it opens the sea chart and the cargo hold. */
  boat?: true;
  /** A crate the helicopter dropped: a store that goes away when it is empty. */
  dropped?: true;
  /** Built on a sea cell next to a rig deck, in front of the explorer (the fish trap). */
  onSea?: true;
  /** Not an object: building it makes the boat's hold bigger. */
  holdUpgrade?: true;
  /** Not an object: building it puts the outboard motor on the fishing boat. */
  boatMotor?: true;
  /** Not an object: building it lays a new deck cell on the sea (a platform on the rig). */
  deck?: true;
  /** A store: walking into it opens the Store panel (see Game.storeItem). */
  store?: true;
  /**
   * One cell of a big object that covers many cells (the rig's storage
   * container): the way, in cells, towards its main piece. Walking into any
   * piece works like walking into the main piece.
   */
  partOf?: [number, number];
  /** Draws nothing: another piece of the same big object draws over this cell. */
  noSprite?: true;
  /** Walkable over the sea: a gangway between the platforms of the oil rig. */
  overSea?: true;
  /**
   * A broken end of a gangway, on a sea cell: it blocks the way until the
   * explorer repairs the gangway (the recipe with `onto`). The value is the
   * way the gangway runs, so the repair fills the whole gap.
   */
  broken?: 'ns' | 'ew';
  /**
   * A sandbar on sea cells: walkable at low tide only (see clock.ts). At
   * high tide it shows its `<kind>_wet` sprite.
   */
  tidal?: true;
  /**
   * A finished goal after the explorer used it (the lit beacon): its frames, how far its light reaches,
   * and the picture for the goal card and end screen when that is not the first frame.
   */
  done?: { frames: string[]; lightRadius: number; icon?: string };
}

const def = (d: ObjectDef) => d;

/** What a tree gives: a branch by hand, more wood and logs with the axe. */
const TREE_WOOD: Yield[] = [
  { item: 'wood', min: 1, max: 1 },
  { item: 'wood', min: 0, max: 1, tool: 'axe' },
  { item: 'log', min: 1, max: 2, tool: 'axe' },
];

export const OBJECTS: Record<ObjectKind, ObjectDef> = {
  palm_tall: def({
    kind: 'palm_tall', depletedSprite: 'palm_tall_bare',
    gather: { yields: [{ item: 'coconut', min: 1, max: 2 }, { item: 'leaves', min: 1, max: 2 }], after: { regrow: 240 } },
  }),
  palm_leaning: def({
    kind: 'palm_leaning', depletedSprite: 'palm_leaning_bare',
    gather: { yields: [{ item: 'coconut', min: 1, max: 2 }, { item: 'leaves', min: 1, max: 2 }], after: { regrow: 240 } },
  }),
  palm_young: def({
    kind: 'palm_young',
    gather: { yields: [{ item: 'leaves', min: 1, max: 2 }], after: { regrow: 80 } },
  }),
  tree_broadleaf: def({
    kind: 'tree_broadleaf', blocksSight: true,
    gather: { yields: TREE_WOOD, after: { regrow: 70 } },
  }),
  tree_pine: def({
    kind: 'tree_pine', blocksSight: true,
    gather: { yields: TREE_WOOD, after: { regrow: 70 } },
  }),
  bush: def({
    kind: 'bush',
    gather: { yields: [{ item: 'leaves', min: 1, max: 1 }], after: { regrow: 90 } },
  }),
  berry_bush: def({
    kind: 'berry_bush', depletedSprite: 'berry_bush_empty',
    gather: { yields: [{ item: 'berries', min: 2, max: 3 }], after: { regrow: 200 } },
  }),
  mushroom: def({
    kind: 'mushroom',
    gather: { yields: [{ item: 'mushroom', min: 1, max: 2 }], after: { remove: true } },
  }),
  stone_boulder: def({ kind: 'stone_boulder', blocksSight: true }),
  stone_mossy: def({ kind: 'stone_mossy', blocksSight: true }),
  stone_pebbles: def({
    kind: 'stone_pebbles',
    gather: { yields: [{ item: 'stone', min: 1, max: 3 }], after: { remove: true } },
  }),
  stalagmite: def({ kind: 'stalagmite' }),
  log: def({
    kind: 'log',
    gather: { yields: [{ item: 'wood', min: 2, max: 3 }], after: { remove: true } },
  }),
  log_pile: def({
    kind: 'log_pile', blocksSight: true,
    gather: { yields: [{ item: 'wood', min: 3, max: 4 }], after: { remove: true } },
  }),
  log_driftwood: def({
    kind: 'log_driftwood',
    gather: { yields: [{ item: 'wood', min: 1, max: 2 }], after: { remove: true } },
  }),
  chest_closed: def({
    kind: 'chest_closed',
    gather: {
      yields: [{ item: 'coconut', min: 1, max: 2 }, { item: 'wood', min: 2, max: 3 }, { item: 'stone', min: 1, max: 2, chance: 0.5 }],
      after: { becomes: 'chest_open' },
    },
  }),
  chest_open: def({ kind: 'chest_open' }),
  spring: def({ kind: 'spring', drink: 35 }),
  campfire: def({ kind: 'campfire', warmthRadius: 2, lightRadius: 5, frames: ['campfire', 'campfire_2'] }),
  lean_to: def({ kind: 'lean_to', walkable: true, shelter: 0.6, rest: 75 }),
  hut: def({ kind: 'hut', walkable: true, shelter: 1, rest: 100 }),
  // The hut goes up in trips: its frame first, then the materials.
  hut_site: def({ kind: 'hut_site', site: 'hut' }),
  store_crate: def({ kind: 'store_crate', store: true }),
  bramble: def({
    kind: 'bramble',
    gather: { yields: [{ item: 'wood', min: 1, max: 1 }, { item: 'leaves', min: 1, max: 1 }], needs: 'axe', after: { remove: true } },
  }),
  bridge_ns: def({ kind: 'bridge_ns', walkable: true, bridge: true }),
  bridge_ew: def({ kind: 'bridge_ew', walkable: true, bridge: true }),
  boat_wreck: def({ kind: 'boat_wreck', goal: true }),
  boat_hull: def({ kind: 'boat_hull', goal: true }),
  boat_mast: def({ kind: 'boat_mast', goal: true }),
  boat_sail: def({ kind: 'boat_sail', goal: true }),
  boat_ready: def({ kind: 'boat_ready', goal: true, frames: ['boat_ready', 'boat_ready_2'] }),
  // Island 2: the northern forest and the beacon on the peak.
  tree_spruce: def({
    kind: 'tree_spruce', blocksSight: true,
    gather: { yields: TREE_WOOD, after: { regrow: 70 } },
  }),
  tree_spruce_snow: def({
    kind: 'tree_spruce_snow', blocksSight: true,
    gather: {
      yields: [...TREE_WOOD, { item: 'resin', min: 1, max: 1, chance: 0.5 }],
      after: { regrow: 70 },
    },
  }),
  tree_birch: def({
    kind: 'tree_birch', blocksSight: true,
    gather: {
      yields: [...TREE_WOOD, { item: 'leaves', min: 1, max: 1, chance: 0.5 }],
      after: { regrow: 70 },
    },
  }),
  tree_apple: def({
    kind: 'tree_apple', blocksSight: true, depletedSprite: 'tree_apple_bare',
    gather: { yields: [{ item: 'apple', min: 1, max: 3 }], after: { regrow: 200 } },
  }),
  fern: def({
    kind: 'fern',
    gather: { yields: [{ item: 'leaves', min: 1, max: 2 }], after: { regrow: 90 } },
  }),
  beacon_site: def({ kind: 'beacon_site', goal: true }),
  beacon_base: def({ kind: 'beacon_base', goal: true }),
  beacon_pyre: def({ kind: 'beacon_pyre', goal: true }),
  beacon_ready: def({
    kind: 'beacon_ready', goal: true, frames: ['beacon_ready', 'beacon_ready_2'],
    done: { frames: ['beacon_lit', 'beacon_lit_2'], lightRadius: 7 },
  }),
  // Island 2: steep steps on the way up to the peak, and the ways up them.
  ledge: def({ kind: 'ledge', steep: true }),
  ledge_ladder: def({ kind: 'ledge_ladder', walkable: true, climb: true }),
  ice_wall: def({ kind: 'ice_wall', steep: true }),
  ice_wall_rope: def({ kind: 'ice_wall_rope', walkable: true, climb: true }),
  // Island 1: the tide islet, its sandbar and the old tar barrels on it.
  barrel: def({
    kind: 'barrel',
    gather: { yields: [{ item: 'tar', min: 2, max: 2 }], after: { becomes: 'barrel_empty' } },
  }),
  barrel_empty: def({ kind: 'barrel_empty' }),
  sandbar_ns: def({ kind: 'sandbar_ns', walkable: true, tidal: true }),
  sandbar_ew: def({ kind: 'sandbar_ew', walkable: true, tidal: true }),
  // The deep caves: glowing mushrooms that grow back, and crystals.
  glowcap: def({
    kind: 'glowcap', depletedSprite: 'glowcap_picked', frames: ['glowcap', 'glowcap_2'], lightRadius: 1,
    gather: { yields: [{ item: 'glowcap', min: 2, max: 3 }], after: { regrow: 160 } },
  }),
  crystal_cluster: def({
    kind: 'crystal_cluster',
    gather: { yields: [{ item: 'crystal', min: 1, max: 2 }], after: { remove: true } },
  }),
  // Island 3: stepping stones over the lava flow, the sulphur vents, hot springs and the balloon.
  lava_stones_ns: def({ kind: 'lava_stones_ns', walkable: true, bridge: true, onLava: true }),
  lava_stones_ew: def({ kind: 'lava_stones_ew', walkable: true, bridge: true, onLava: true }),
  steam_vent: def({
    kind: 'steam_vent', depletedSprite: 'steam_vent_spent', frames: ['steam_vent', 'steam_vent_2'],
    gather: { yields: [{ item: 'sulphur', min: 1, max: 2 }], after: { regrow: 150 } },
  }),
  hot_spring: def({ kind: 'hot_spring', drink: 35, warmthRadius: 1, frames: ['hot_spring', 'hot_spring_2'] }),
  balloon_site: def({ kind: 'balloon_site', goal: true }),
  balloon_basket: def({ kind: 'balloon_basket', goal: true }),
  balloon_envelope: def({ kind: 'balloon_envelope', goal: true }),
  // After the flight only the stakes it was tied to are left.
  balloon_ready: def({
    kind: 'balloon_ready', goal: true, frames: ['balloon_ready', 'balloon_ready_2'],
    done: { frames: ['balloon_gone'], lightRadius: 0, icon: 'balloon_ready' },
  }),
  // Island 4, the old oil rig: gangways between the platforms, some broken.
  gangway_ns: def({ kind: 'gangway_ns', walkable: true, overSea: true }),
  gangway_ew: def({ kind: 'gangway_ew', walkable: true, overSea: true }),
  gangway_end_n: def({ kind: 'gangway_end_n', broken: 'ns' }),
  gangway_end_s: def({ kind: 'gangway_end_s', broken: 'ns' }),
  gangway_end_e: def({ kind: 'gangway_end_e', broken: 'ew' }),
  gangway_end_w: def({ kind: 'gangway_end_w', broken: 'ew' }),
  scrap_pile: def({
    kind: 'scrap_pile',
    gather: { yields: [{ item: 'scrap', min: 2, max: 3 }], after: { remove: true } },
  }),
  rig_container: def({ kind: 'rig_container', blocksSight: true }),
  diesel_drums: def({
    kind: 'diesel_drums',
    gather: { yields: [{ item: 'diesel', min: 2, max: 2 }], after: { becomes: 'diesel_drums_empty' } },
  }),
  diesel_drums_empty: def({ kind: 'diesel_drums_empty' }),
  pallet: def({
    kind: 'pallet',
    gather: { yields: [{ item: 'wood', min: 2, max: 3 }], after: { remove: true } },
  }),
  old_net: def({
    kind: 'old_net',
    gather: { yields: [{ item: 'rope', min: 1, max: 2 }], after: { remove: true } },
  }),
  // Rain water caught in a tank: drink like at a spring.
  water_tank: def({ kind: 'water_tank', drink: 35 }),
  // Mussels grow on the rig's legs, in the sea under the edge of a deck.
  mussel_bed: def({
    kind: 'mussel_bed', depletedSprite: 'mussel_bed_picked',
    gather: { yields: [{ item: 'mussels', min: 2, max: 3 }], after: { regrow: 200 } },
  }),
  life_ring: def({ kind: 'life_ring' }),
  // The old drilling tower: repaired, its pump brings up diesel again and again.
  derrick: def({ kind: 'derrick', blocksSight: true, site: 'derrick_working', siteCost: { scrap: 12, rope: 2 } }),
  derrick_working: def({
    kind: 'derrick_working', blocksSight: true, depletedSprite: 'derrick_idle', frames: ['derrick_working', 'derrick_working_2'],
    gather: { yields: [{ item: 'diesel', min: 2, max: 2 }], after: { regrow: 120 } },
  }),
  // An old fishing boat at the rig's dock: repaired, it sails between the rig and the islands.
  fishing_boat_wreck: def({ kind: 'fishing_boat_wreck', site: 'fishing_boat', siteCost: { scrap: 10, wood: 6, rope: 4 } }),
  fishing_boat: def({ kind: 'fishing_boat', boat: true }),
  // A supply crate from the radio, on the helipad: take out what you need.
  supply_crate: def({ kind: 'supply_crate', store: true, dropped: true }),
  // The rig's big storage container, 6 × 2 cells: one store, whichever cell you walk into.
  // The main piece is the front row's left end; the back row has no sprite (the front pieces reach over it).
  storage_container_0: def({ kind: 'storage_container_0', blocksSight: true, store: true }),
  storage_container_1: def({ kind: 'storage_container_1', blocksSight: true, partOf: [-1, 0] }),
  storage_container_2: def({ kind: 'storage_container_2', blocksSight: true, partOf: [-2, 0] }),
  storage_container_3: def({ kind: 'storage_container_3', blocksSight: true, partOf: [-3, 0] }),
  storage_container_4: def({ kind: 'storage_container_4', blocksSight: true, partOf: [-4, 0] }),
  storage_container_5: def({ kind: 'storage_container_5', blocksSight: true, partOf: [-5, 0] }),
  storage_container_back: def({ kind: 'storage_container_back', blocksSight: true, partOf: [0, 1], noSprite: true }),
  // Only for the recipe: the platform recipe lays a deck cell, not an object.
  platform_deck: def({ kind: 'platform_deck', deck: true }),
  // Island 2: rocks with iron and coal (the pickaxe); island 1: clay at the river (the shovel);
  // every island: old crates the crowbar opens. They grow back slowly, the crates do not.
  ore_vein: def({
    kind: 'ore_vein', blocksSight: true, depletedSprite: 'ore_vein_mined',
    gather: { yields: [{ item: 'iron_ore', min: 1, max: 2 }, { item: 'coal', min: 1, max: 1, chance: 0.5 }], needs: 'pickaxe', after: { regrow: 300 } },
  }),
  clay_bank: def({
    kind: 'clay_bank', depletedSprite: 'clay_bank_dug',
    gather: { yields: [{ item: 'clay', min: 2, max: 3 }], needs: 'shovel', after: { regrow: 200 } },
  }),
  sealed_crate: def({
    kind: 'sealed_crate',
    gather: {
      yields: [{ item: 'spare_part', min: 1, max: 1 }, { item: 'coconut', min: 1, max: 2, chance: 0.5 }, { item: 'rope', min: 1, max: 2, chance: 0.5 }],
      needs: 'crowbar', after: { remove: true },
    },
  }),
  // The rig's buildings.
  furnace: def({ kind: 'furnace', lightRadius: 2, frames: ['furnace', 'furnace_2'] }),
  greenhouse: def({
    kind: 'greenhouse', blocksSight: true, depletedSprite: 'greenhouse_picked',
    gather: { yields: [{ item: 'vegetables', min: 2, max: 3 }], after: { regrow: 120 } },
  }),
  water_maker: def({ kind: 'water_maker', drink: 35 }),
  fish_trap: def({
    kind: 'fish_trap', onSea: true, depletedSprite: 'fish_trap_empty',
    gather: { yields: [{ item: 'fish', min: 1, max: 2 }], after: { regrow: 100 } },
  }),
  hold_upgrade: def({ kind: 'hold_upgrade', holdUpgrade: true }),
  // The rig habitat: steel frames that take what their recipe's siteCost needs, then the buildings.
  solar_station_site: def({ kind: 'solar_station_site', site: 'solar_station' }),
  galley_site: def({ kind: 'galley_site', site: 'galley' }),
  machine_shop_site: def({ kind: 'machine_shop_site', site: 'machine_shop' }),
  solar_station: def({ kind: 'solar_station' }),
  galley: def({ kind: 'galley', blocksSight: true, lightRadius: 1, frames: ['galley', 'galley_2'] }),
  machine_shop: def({ kind: 'machine_shop', blocksSight: true }),
  lamp_post: def({ kind: 'lamp_post', lightRadius: 3 }),
  boat_motor: def({ kind: 'boat_motor', boatMotor: true }),
  crane: def({ kind: 'crane', blocksSight: true }),
  // The camp on the rig: a bed for a full rest, and a little stove to cook on.
  crew_cabin: def({ kind: 'crew_cabin', walkable: true, shelter: 1, rest: 100, warmthRadius: 0, lightRadius: 2 }),
  balloon_crashed: def({ kind: 'balloon_crashed' }),
  radio_hut: def({ kind: 'radio_hut', goal: true }),
  radio_aerial: def({ kind: 'radio_aerial', goal: true }),
  radio_power: def({ kind: 'radio_power', goal: true }),
  radio_ready: def({ kind: 'radio_ready', goal: true, frames: ['radio_ready', 'radio_ready_2'], lightRadius: 2 }),
};

/** Objects the explorer can get past by building, clearing or waiting for low tide: brambles, steep steps, sandbars, broken gangways. */
export function canBeOpened(kind: ObjectKind): boolean {
  const def = OBJECTS[kind];
  return kind === 'bramble' || !!def.steep || !!def.tidal || !!def.broken;
}

export interface WorldObject {
  kind: ObjectKind;
  /** Turn when a regrowing object can be gathered again. */
  readyAt?: number;
  /** The rooms added to a hut (see rooms.ts). */
  rooms?: RoomId[];
  /** What a store crate holds. */
  store?: Partial<Record<ItemId, number>>;
  /** What a building site already got. */
  given?: Partial<Record<ItemId, number>>;
}
