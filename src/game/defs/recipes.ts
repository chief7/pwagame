import type { ItemId } from './items';
import type { ObjectKind } from './objects';
import type { SkillId } from './skills';

// Things the explorer can build from what they've gathered. A recipe either
// places an object in front of the explorer (`builds`) or puts an item in
// the bag (`makes`). Names and descriptions live in src/i18n/.

export type RecipeId = 'campfire' | 'lean_to' | 'hut' | 'axe' | 'rope' | 'bridge' | 'fishing_rod' | 'cooked_fish' | 'ladder' | 'climbing_rope' | 'lantern';

export type Recipe = {
  id: RecipeId;
  cost: Partial<Record<ItemId, number>>;
  /** A skill the explorer must have learned first. */
  skill?: SkillId;
  /** Only possible next to a campfire (cooking). */
  atFire?: true;
  /** Built on this object in front of the explorer, which it replaces (a ladder on a rocky step). */
  onto?: ObjectKind;
} & ({ builds: ObjectKind } | { makes: ItemId });

export const RECIPES: Record<RecipeId, Recipe> = {
  campfire: { id: 'campfire', builds: 'campfire', cost: { wood: 3, stone: 2 } },
  lean_to: { id: 'lean_to', builds: 'lean_to', cost: { wood: 4, leaves: 5 } },
  hut: { id: 'hut', builds: 'hut', cost: { log: 6, wood: 2, leaves: 8, stone: 4 } },
  axe: { id: 'axe', makes: 'axe', cost: { wood: 2, stone: 2, leaves: 1 } },
  rope: { id: 'rope', makes: 'rope', cost: { leaves: 2 } },
  // Faces the way the explorer does; game.ts turns it into bridge_ew when needed.
  bridge: { id: 'bridge', builds: 'bridge_ns', cost: { log: 3, wood: 2, leaves: 3 } },
  fishing_rod: { id: 'fishing_rod', makes: 'fishing_rod', cost: { wood: 3, leaves: 2 }, skill: 'fishing_rod' },
  cooked_fish: { id: 'cooked_fish', makes: 'cooked_fish', cost: { fish: 1 }, atFire: true },
  // Island 2: ways up the steep steps.
  ladder: { id: 'ladder', builds: 'ledge_ladder', onto: 'ledge', cost: { wood: 4, rope: 2 } },
  climbing_rope: { id: 'climbing_rope', builds: 'ice_wall_rope', onto: 'ice_wall', cost: { wood: 1, rope: 4 } },
  // From the crystals of the deep caves: you see further in caves and at night.
  lantern: { id: 'lantern', makes: 'lantern', cost: { crystal: 3, wood: 1, rope: 1 } },
};

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];
