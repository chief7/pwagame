import { ANIMALS, ANIMAL_KINDS, type AnimalKind } from '../game/defs/animals';
import { ITEMS, ITEM_IDS, type ItemId } from '../game/defs/items';
import { LEVELS, type StageId } from '../game/defs/levels';
import { OBJECTS, type Gather, type ObjectKind, type Yield } from '../game/defs/objects';
import { RECIPES, RECIPE_IDS, type RecipeId } from '../game/defs/recipes';
import { ISLET_OBJECTS, SCATTER } from '../game/worldgen';

// What the compendium shows, read from the game's own registries so its
// tables never fall behind the game. No DOM here, so it can be tested.

/** Objects that the world generator places on every island outside its scatter table. */
const EVERYWHERE: ObjectKind[] = ['chest_closed', 'spring', 'bramble'];

/** The islands where an object can be found in the wild. */
export function objectIslands(kind: ObjectKind): number[] {
  const islands: number[] = [];
  for (const level of LEVELS) {
    const scatter = Object.values(SCATTER[level.biome]).flat().some(([k]) => k === kind);
    const islet = level.level === 1 && ISLET_OBJECTS.includes(kind);
    const goalMaterial = level.biome === 'mountain' && kind === 'tree_spruce_snow';
    if (scatter || islet || goalMaterial || EVERYWHERE.includes(kind)) islands.push(level.level);
  }
  return islands;
}

/** One line of the gathering table: objects that look and work the same share a line. */
export interface GatherRow {
  kinds: ObjectKind[];
  gather: Gather;
  islands: number[];
}

export function gatherRows(): GatherRow[] {
  const rows: GatherRow[] = [];
  for (const kind of Object.keys(OBJECTS) as ObjectKind[]) {
    const gather = OBJECTS[kind].gather;
    if (!gather) continue;
    const islands = objectIslands(kind);
    const same = rows.find((r) => JSON.stringify(r.gather) === JSON.stringify(gather));
    if (!same) rows.push({ kinds: [kind], gather, islands });
    else {
      same.kinds.push(kind);
      same.islands = [...new Set([...same.islands, ...islands])].sort();
    }
  }
  return rows;
}

/** Where an item comes from: objects that give it, and recipes that make it. */
export interface ItemSource {
  objects: ObjectKind[];
  recipes: RecipeId[];
  /** Fishing in the sea. */
  fishing: boolean;
}

export function itemSources(id: ItemId): ItemSource {
  const objects = (Object.keys(OBJECTS) as ObjectKind[]).filter((kind) => {
    const g = OBJECTS[kind].gather;
    return !!g && (g.yields.some((y) => y.item === id) || g.bonus?.item === id);
  });
  const recipes = RECIPE_IDS.filter((r) => 'makes' in RECIPES[r] && (RECIPES[r] as { makes: ItemId }).makes === id);
  return { objects, recipes, fishing: id === 'fish' };
}

/** Items grouped as the Bag panel thinks of them. */
export type ItemGroup = 'food' | 'material' | 'rare' | 'tool';

export function itemGroup(id: ItemId): ItemGroup {
  const def = ITEMS[id];
  if (def.tool) return 'tool';
  if (def.rareFrom) return 'rare';
  if (def.eat) return 'food';
  return 'material';
}

export function itemsIn(group: ItemGroup): ItemId[] {
  return ITEM_IDS.filter((id) => itemGroup(id) === group);
}

/** The sprite that shows a recipe: what it builds or makes. */
export function recipeSprite(id: RecipeId): string {
  const r = RECIPES[id];
  return 'builds' in r ? r.builds : `item_${r.makes}`;
}

/** Every item a goal stage or a recipe asks for, to show what a material is good for. */
export function itemUses(id: ItemId): { recipes: RecipeId[]; stages: StageId[] } {
  return {
    recipes: RECIPE_IDS.filter((r) => (RECIPES[r].cost[id] ?? 0) > 0),
    stages: LEVELS.flatMap((l) => l.stages.filter((s) => (s.cost[id] ?? 0) > 0).map((s) => s.id)),
  };
}

/** Animals in the order the compendium lists them: island 1 first, the friendly ones first. */
export function animalsByIsland(level: number): AnimalKind[] {
  return ANIMAL_KINDS
    .filter((kind) => kind !== 'dog' && (ANIMALS[kind].islands ?? [1]).includes(level))
    .sort((a, b) => Number(!!ANIMALS[a].wild) - Number(!!ANIMALS[b].wild));
}

/** Turns as hours of game time: one turn is six minutes. */
export function turnsToHours(turns: number): number {
  return turns / 10;
}

/** A yield as "1–2", or "2" when it never changes. */
export function yieldRange(y: Yield): string {
  return y.min === y.max ? `${y.min}` : `${y.min}–${y.max}`;
}
