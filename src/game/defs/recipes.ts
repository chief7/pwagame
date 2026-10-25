import type { ItemId } from './items';
import type { ObjectKind } from './objects';

// Things the explorer can build from what they've gathered. Each recipe
// places an object in front of the explorer.

export type RecipeId = 'campfire' | 'lean_to' | 'hut';

export interface Recipe {
  id: RecipeId;
  name: string;
  description: string;
  cost: Partial<Record<ItemId, number>>;
  builds: ObjectKind;
}

export const RECIPES: Record<RecipeId, Recipe> = {
  campfire: {
    id: 'campfire', name: 'Campfire', builds: 'campfire',
    description: 'Keeps you warm and lights up the night.',
    cost: { wood: 3, stone: 2 },
  },
  lean_to: {
    id: 'lean_to', name: 'Lean-to', builds: 'lean_to',
    description: 'A simple shelter. Sleep here to rest well and stay warmer.',
    cost: { wood: 4, leaves: 5 },
  },
  hut: {
    id: 'hut', name: 'Hut', builds: 'hut',
    description: 'A cosy home. Toasty nights and the best sleep.',
    cost: { wood: 10, leaves: 8, stone: 4 },
  },
};

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];
