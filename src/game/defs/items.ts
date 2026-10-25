// Everything the explorer can carry. Add an item here (plus an `item_<id>`
// sprite and its words in src/i18n/) and it can be gathered, stored, eaten
// or used in recipes.

export type ItemId =
  | 'coconut' | 'berries' | 'mushroom' | 'cooked_fish'
  | 'wood' | 'leaves' | 'stone' | 'fish'
  | 'axe' | 'fishing_rod';

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
}

export const ITEMS: Record<ItemId, ItemDef> = {
  coconut: { id: 'coconut', eat: { food: 18, water: 22 } },
  berries: { id: 'berries', eat: { food: 12, water: 5 } },
  mushroom: { id: 'mushroom', eat: { food: 15, energy: 5 } },
  cooked_fish: { id: 'cooked_fish', eat: { food: 24 } },
  wood: { id: 'wood' },
  leaves: { id: 'leaves' },
  stone: { id: 'stone' },
  fish: { id: 'fish', raw: true },
  axe: { id: 'axe', tool: true },
  fishing_rod: { id: 'fishing_rod', tool: true },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
