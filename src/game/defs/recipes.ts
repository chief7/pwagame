import type { ItemId } from './items';
import type { ObjectKind } from './objects';
import type { SkillId } from './skills';

// Things the explorer can build from what they've gathered. A recipe either
// places an object in front of the explorer (`builds`) or puts an item in
// the bag (`makes`). Names and descriptions live in src/i18n/.

export type RecipeId = 'campfire' | 'lean_to' | 'hut' | 'axe' | 'rope' | 'bridge' | 'fishing_rod' | 'cooked_fish' | 'ladder' | 'climbing_rope' | 'lantern' | 'lava_stones' | 'gangway';

export type Recipe = {
  id: RecipeId;
  cost: Partial<Record<ItemId, number>>;
  /** A skill the explorer must have learned first. */
  skill?: SkillId;
  /** Only possible next to a campfire (cooking). */
  atFire?: true;
  /**
   * Built on one of these objects next to the explorer, which it replaces (a
   * ladder on a rocky step). A broken gangway is mended across its whole gap.
   */
  onto?: ObjectKind[];
} & ({ builds: ObjectKind } | { makes: ItemId });

export const RECIPES: Record<RecipeId, Recipe> = {
  campfire: { id: 'campfire', builds: 'campfire', cost: { wood: 3, stone: 2 } },
  lean_to: { id: 'lean_to', builds: 'lean_to', cost: { wood: 4, leaves: 5 } },
  // The camp: only one on each island, and it is big work.
  hut: { id: 'hut', builds: 'hut', cost: { log: 24, wood: 12, leaves: 30, stone: 20, rope: 8 } },
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
};

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];
