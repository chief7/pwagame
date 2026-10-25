import type { ItemId } from './items';

// Things standing in the world: plants, rocks, chests, springs and whatever
// the player builds. Kinds double as sprite names. Names and gather texts
// live in src/i18n/.

export type ObjectKind =
  | 'palm_tall' | 'palm_leaning' | 'palm_young'
  | 'tree_broadleaf' | 'tree_pine' | 'bush' | 'berry_bush' | 'mushroom'
  | 'stone_boulder' | 'stone_pebbles' | 'stone_mossy' | 'stalagmite'
  | 'log' | 'log_pile' | 'log_driftwood'
  | 'chest_closed' | 'chest_open' | 'spring'
  | 'campfire' | 'lean_to' | 'hut'
  | 'bramble' | 'bridge_ns' | 'bridge_ew'
  | 'boat_wreck' | 'boat_hull' | 'boat_mast' | 'boat_sail' | 'boat_ready'
  | 'tree_spruce' | 'tree_spruce_snow' | 'tree_birch' | 'tree_apple' | 'fern'
  | 'beacon_site' | 'beacon_base' | 'beacon_pyre' | 'beacon_ready';

export interface Yield {
  item: ItemId;
  min: number;
  max: number;
  /** Chance (0..1) to get anything at all; defaults to 1. */
  chance?: number;
}

export interface Gather {
  yields: Yield[];
  /** A tool the explorer must carry to gather at all. */
  needs?: ItemId;
  /** Extra items when the explorer carries a tool. */
  bonus?: { tool: ItemId; item: ItemId; amount: number };
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
  /** Warms everyone within this many cells. */
  warmthRadius?: number;
  /** Lights up this many cells at night. */
  lightRadius?: number;
  /** Animation frames (sprite names), cycled by the renderer. */
  frames?: string[];
  /** Built over river cells rather than on the ground. */
  bridge?: true;
  /** The island's goal (see levels.ts): walking into it hands over materials. */
  goal?: true;
}

const def = (d: ObjectDef) => d;

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
    gather: { yields: [{ item: 'wood', min: 1, max: 2 }], bonus: { tool: 'axe', item: 'wood', amount: 1 }, after: { regrow: 70 } },
  }),
  tree_pine: def({
    kind: 'tree_pine', blocksSight: true,
    gather: { yields: [{ item: 'wood', min: 1, max: 2 }], bonus: { tool: 'axe', item: 'wood', amount: 1 }, after: { regrow: 70 } },
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
  lean_to: def({ kind: 'lean_to', walkable: true, shelter: 0.6 }),
  hut: def({ kind: 'hut', walkable: true, shelter: 1 }),
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
    gather: { yields: [{ item: 'wood', min: 1, max: 2 }], bonus: { tool: 'axe', item: 'wood', amount: 1 }, after: { regrow: 70 } },
  }),
  tree_spruce_snow: def({
    kind: 'tree_spruce_snow', blocksSight: true,
    gather: { yields: [{ item: 'wood', min: 1, max: 2 }], bonus: { tool: 'axe', item: 'wood', amount: 1 }, after: { regrow: 70 } },
  }),
  tree_birch: def({
    kind: 'tree_birch', blocksSight: true,
    gather: {
      yields: [{ item: 'wood', min: 1, max: 2 }, { item: 'leaves', min: 1, max: 1, chance: 0.5 }],
      bonus: { tool: 'axe', item: 'wood', amount: 1 }, after: { regrow: 70 },
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
  beacon_ready: def({ kind: 'beacon_ready', goal: true, frames: ['beacon_ready', 'beacon_ready_2'] }),
};

export interface WorldObject {
  kind: ObjectKind;
  /** Turn when a regrowing object can be gathered again. */
  readyAt?: number;
}
