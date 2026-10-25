// Everything the explorer can carry. Add an item here (and an `item_<id>`
// sprite) and it can be gathered, stored, eaten or used in recipes.

export type ItemId = 'coconut' | 'berries' | 'mushroom' | 'wood' | 'leaves' | 'stone';

export interface Food {
  food?: number;
  water?: number;
  energy?: number;
}

export interface ItemDef {
  id: ItemId;
  name: string;
  plural: string;
  /** Present when the item can be eaten; values are how much each need refills. */
  eat?: Food;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  coconut: { id: 'coconut', name: 'coconut', plural: 'coconuts', eat: { food: 18, water: 22 } },
  berries: { id: 'berries', name: 'handful of berries', plural: 'handfuls of berries', eat: { food: 12, water: 5 } },
  mushroom: { id: 'mushroom', name: 'mushroom', plural: 'mushrooms', eat: { food: 15, energy: 5 } },
  wood: { id: 'wood', name: 'piece of wood', plural: 'pieces of wood' },
  leaves: { id: 'leaves', name: 'big leaf', plural: 'big leaves' },
  stone: { id: 'stone', name: 'stone', plural: 'stones' },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export function itemLabel(id: ItemId, count: number): string {
  const def = ITEMS[id];
  return count === 1 ? `a ${def.name}` : `${count} ${def.plural}`;
}
