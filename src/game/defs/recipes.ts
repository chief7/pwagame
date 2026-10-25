import type { ItemId } from './items';
import type { ObjectKind } from './objects';

// Things the explorer can build from what they've gathered. A recipe either
// places an object in front of the explorer (`builds`) or puts an item in
// the bag (`makes`). Names and descriptions live in src/i18n/.

export type RecipeId = 'campfire' | 'lean_to' | 'hut' | 'axe' | 'bridge';

export type Recipe = {
  id: RecipeId;
  cost: Partial<Record<ItemId, number>>;
} & ({ builds: ObjectKind } | { makes: ItemId });

export const RECIPES: Record<RecipeId, Recipe> = {
  campfire: { id: 'campfire', builds: 'campfire', cost: { wood: 3, stone: 2 } },
  lean_to: { id: 'lean_to', builds: 'lean_to', cost: { wood: 4, leaves: 5 } },
  hut: { id: 'hut', builds: 'hut', cost: { wood: 10, leaves: 8, stone: 4 } },
  axe: { id: 'axe', makes: 'axe', cost: { wood: 2, stone: 2, leaves: 1 } },
  // Faces the way the explorer does; game.ts turns it into bridge_ew when needed.
  bridge: { id: 'bridge', builds: 'bridge_ns', cost: { wood: 6, leaves: 3 } },
};

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];
