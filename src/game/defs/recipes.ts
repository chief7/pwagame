import type { ItemId } from './items';
import type { ObjectKind } from './objects';

// Things the explorer can build from what they've gathered. Each recipe
// places an object in front of the explorer. Names and descriptions live in
// src/i18n/.

export type RecipeId = 'campfire' | 'lean_to' | 'hut';

export interface Recipe {
  id: RecipeId;
  cost: Partial<Record<ItemId, number>>;
  builds: ObjectKind;
}

export const RECIPES: Record<RecipeId, Recipe> = {
  campfire: { id: 'campfire', builds: 'campfire', cost: { wood: 3, stone: 2 } },
  lean_to: { id: 'lean_to', builds: 'lean_to', cost: { wood: 4, leaves: 5 } },
  hut: { id: 'hut', builds: 'hut', cost: { wood: 10, leaves: 8, stone: 4 } },
};

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];
