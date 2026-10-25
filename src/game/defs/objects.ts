import type { ItemId } from './items';

// Things standing in the world: plants, rocks, chests, springs and whatever
// the player builds. Kinds double as sprite names.

export type ObjectKind =
  | 'palm_tall' | 'palm_leaning' | 'palm_young'
  | 'tree_broadleaf' | 'tree_pine' | 'bush' | 'berry_bush' | 'mushroom'
  | 'stone_boulder' | 'stone_pebbles' | 'stone_mossy' | 'stalagmite'
  | 'log' | 'log_pile' | 'log_driftwood'
  | 'chest_closed' | 'chest_open' | 'spring'
  | 'campfire' | 'lean_to' | 'hut';

export interface Yield {
  item: ItemId;
  min: number;
  max: number;
  /** Chance (0..1) to get anything at all; defaults to 1. */
  chance?: number;
}

export interface Gather {
  /** "You shake the palm." */
  verb: string;
  yields: Yield[];
  /** Gone for good, turned into another object, or ready again after some turns. */
  after: { remove: true } | { becomes: ObjectKind } | { regrow: number };
}

export interface ObjectDef {
  kind: ObjectKind;
  name: string;
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
}

const def = (d: ObjectDef) => d;

export const OBJECTS: Record<ObjectKind, ObjectDef> = {
  palm_tall: def({
    kind: 'palm_tall', name: 'palm tree', depletedSprite: 'palm_tall_bare',
    gather: { verb: 'You shake the palm tree', yields: [{ item: 'coconut', min: 1, max: 2 }, { item: 'leaves', min: 1, max: 2 }], after: { regrow: 150 } },
  }),
  palm_leaning: def({
    kind: 'palm_leaning', name: 'palm tree', depletedSprite: 'palm_leaning_bare',
    gather: { verb: 'You shake the palm tree', yields: [{ item: 'coconut', min: 1, max: 2 }, { item: 'leaves', min: 1, max: 2 }], after: { regrow: 150 } },
  }),
  palm_young: def({
    kind: 'palm_young', name: 'young palm',
    gather: { verb: 'You pick some leaves', yields: [{ item: 'leaves', min: 1, max: 2 }], after: { regrow: 80 } },
  }),
  tree_broadleaf: def({
    kind: 'tree_broadleaf', name: 'tree', blocksSight: true,
    gather: { verb: 'You collect fallen branches', yields: [{ item: 'wood', min: 1, max: 2 }], after: { regrow: 70 } },
  }),
  tree_pine: def({
    kind: 'tree_pine', name: 'pine tree', blocksSight: true,
    gather: { verb: 'You collect fallen branches', yields: [{ item: 'wood', min: 1, max: 2 }], after: { regrow: 70 } },
  }),
  bush: def({
    kind: 'bush', name: 'bush',
    gather: { verb: 'You pick some leaves', yields: [{ item: 'leaves', min: 1, max: 1 }], after: { regrow: 90 } },
  }),
  berry_bush: def({
    kind: 'berry_bush', name: 'berry bush', depletedSprite: 'berry_bush_empty',
    gather: { verb: 'You pick berries', yields: [{ item: 'berries', min: 2, max: 3 }], after: { regrow: 120 } },
  }),
  mushroom: def({
    kind: 'mushroom', name: 'mushrooms',
    gather: { verb: 'You pick the mushrooms', yields: [{ item: 'mushroom', min: 1, max: 2 }], after: { remove: true } },
  }),
  stone_boulder: def({ kind: 'stone_boulder', name: 'boulder', blocksSight: true }),
  stone_mossy: def({ kind: 'stone_mossy', name: 'mossy stone', blocksSight: true }),
  stone_pebbles: def({
    kind: 'stone_pebbles', name: 'pebbles',
    gather: { verb: 'You pick up stones', yields: [{ item: 'stone', min: 1, max: 3 }], after: { remove: true } },
  }),
  stalagmite: def({ kind: 'stalagmite', name: 'stalagmite' }),
  log: def({
    kind: 'log', name: 'log',
    gather: { verb: 'You break up the log', yields: [{ item: 'wood', min: 2, max: 3 }], after: { remove: true } },
  }),
  log_pile: def({
    kind: 'log_pile', name: 'pile of logs', blocksSight: true,
    gather: { verb: 'You take wood from the pile', yields: [{ item: 'wood', min: 3, max: 4 }], after: { remove: true } },
  }),
  log_driftwood: def({
    kind: 'log_driftwood', name: 'driftwood',
    gather: { verb: 'You pick up the driftwood', yields: [{ item: 'wood', min: 1, max: 2 }], after: { remove: true } },
  }),
  chest_closed: def({
    kind: 'chest_closed', name: 'chest',
    gather: {
      verb: 'You open the chest',
      yields: [{ item: 'coconut', min: 1, max: 2 }, { item: 'wood', min: 2, max: 3 }, { item: 'stone', min: 1, max: 2, chance: 0.5 }],
      after: { becomes: 'chest_open' },
    },
  }),
  chest_open: def({ kind: 'chest_open', name: 'empty chest' }),
  spring: def({ kind: 'spring', name: 'spring', drink: 35 }),
  campfire: def({ kind: 'campfire', name: 'campfire', warmthRadius: 2, lightRadius: 5, frames: ['campfire', 'campfire_2'] }),
  lean_to: def({ kind: 'lean_to', name: 'lean-to', walkable: true, shelter: 0.6 }),
  hut: def({ kind: 'hut', name: 'hut', walkable: true, shelter: 1 }),
};

export interface WorldObject {
  kind: ObjectKind;
  /** Turn when a regrowing object can be gathered again. */
  readyAt?: number;
}
