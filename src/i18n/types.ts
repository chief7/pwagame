import type { AnimalKind } from '../game/defs/animals';
import type { ItemId } from '../game/defs/items';
import type { ObjectKind } from '../game/defs/objects';
import type { RecipeId } from '../game/defs/recipes';
import type { FloatWhat, Msg } from '../game/messages';
import type { NeedId } from '../game/needs';

export type Lang = 'en' | 'de';

/** Every word the player can see, in one language. */
export interface Strings {
  lang: Lang;
  /** The language's own name, for the switch button ("Deutsch"). */
  name: string;
  ui: {
    bag: string;
    build: string;
    sleep: string;
    close: string;
    chooseExplorer: string;
    female: string;
    male: string;
    yourBag: string;
    bagEmpty: string;
    eat: string;
    forBuilding: string;
    /** Bag note for tools. */
    tool: string;
    buildHint: string;
    changeExplorer: string;
    newIsland: string;
    confirmNewIsland: string;
    byFire: string;
    inCave: string;
    /** HUD line while standing in a shelter: "In your hut". */
    inShelter(kind: ObjectKind): string;
    dawn: string;
    dusk: string;
    night: string;
  };
  /** "Day 2 · 6:00". */
  clock(turn: number): string;
  needs: Record<NeedId, string>;
  recipes: Record<RecipeId, { name: string; description: string }>;
  /** Bag line: "3 × coconuts". */
  itemStack(id: ItemId, count: number): string;
  /** "a coconut", "3 pieces of wood". */
  itemCount(id: ItemId, count: number): string;
  /** Floating numbers and food notes: "+2 wood", "+18 food". */
  float(amount: number, what: FloatWhat): string;
  message(msg: Msg): string;
}

/** The English and German files must cover every object and animal. */
export type ObjectWords<T> = Record<ObjectKind, T>;
export type AnimalWords<T> = Record<AnimalKind, T>;
export type ItemWords<T> = Record<ItemId, T>;
