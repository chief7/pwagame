import type { ObjectKind } from './objects';

// Everything the explorer can carry. Add an item here (plus an `item_<id>`
// sprite and its words in src/i18n/) and it can be gathered, stored, eaten
// or used in recipes.

export type ItemId =
  | 'coconut' | 'berries' | 'mushroom' | 'cooked_fish' | 'apple'
  | 'wood' | 'log' | 'leaves' | 'stone' | 'fish' | 'rope'
  | 'axe' | 'fishing_rod'
  | 'tar' | 'resin'
  | 'glowcap' | 'crystal' | 'lantern';

export interface Food {
  food?: number;
  water?: number;
  energy?: number;
}

export interface ItemDef {
  id: ItemId;
  /** Present when the item can be eaten; values are how much each need refills. */
  eat?: Food;
  /** Kept in the bag and used by gathering; you only ever need one. */
  tool?: true;
  /** Not edible yet: it has to be cooked at a campfire first. */
  raw?: true;
  /**
   * A rare material for the island goal that only these objects give. An
   * island without any of them (an old save) does not ask the goal for it.
   */
  rareFrom?: ObjectKind[];
}

export const ITEMS: Record<ItemId, ItemDef> = {
  coconut: { id: 'coconut', eat: { food: 10, water: 18 } },
  berries: { id: 'berries', eat: { food: 7, water: 4 } },
  mushroom: { id: 'mushroom', eat: { food: 9, energy: 5 } },
  cooked_fish: { id: 'cooked_fish', eat: { food: 40, energy: 10 } },
  apple: { id: 'apple', eat: { food: 12, water: 8 } },
  wood: { id: 'wood' },
  // Chopped from trees with the axe; the big builds need them.
  log: { id: 'log' },
  leaves: { id: 'leaves' },
  stone: { id: 'stone' },
  fish: { id: 'fish', raw: true },
  rope: { id: 'rope' },
  axe: { id: 'axe', tool: true },
  fishing_rod: { id: 'fishing_rod', tool: true },
  // Rare goal materials: tar from the old barrels on the tide islet, resin from snowy spruces.
  tar: { id: 'tar', rareFrom: ['barrel', 'barrel_empty'] },
  resin: { id: 'resin', rareFrom: ['tree_spruce_snow'] },
  // Only in the deep caves: glowcaps (the food with the most Energy) and
  // crystals for the crystal lantern, which lights up caves and the night.
  glowcap: { id: 'glowcap', eat: { food: 6, water: 4, energy: 15 } },
  crystal: { id: 'crystal' },
  lantern: { id: 'lantern', tool: true },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
