import type { AnimalKind } from '../game/defs/animals';
import type { ItemId } from '../game/defs/items';
import type { StageId } from '../game/defs/levels';
import type { ObjectKind } from '../game/defs/objects';
import type { RecipeId } from '../game/defs/recipes';
import type { PathId, SkillId } from '../game/defs/skills';
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
    skills: string;
    learn: string;
    learned: string;
    /** Bag note for food that must be cooked first. */
    raw: string;
    skillsHint: string;
    /** "2 skill points". */
    skillPoints(n: number): string;
    /** "XP 12 / 25 to the next point". */
    xpToNext(have: number, need: number): string;
    /** "Costs 2 points". */
    skillCost(n: number): string;
    /** The goal card in the Build panel. */
    goalTitle: string;
    goalFind: string;
    goalMissing: string;
    /** "Step 2 of 4: Mast". */
    goalStep(index: number, count: number, stage: StageId): string;
    goalHint: string;
    goalReady: string;
    goalSailed: string;
    /** The question before leaving, and the screen after. */
    sailTitle: string;
    sailText: string;
    setSail: string;
    notYet: string;
    endTitle: string;
    endText: string;
    stay: string;
  };
  /** "Day 2 · 6:00". */
  clock(turn: number): string;
  needs: Record<NeedId, string>;
  recipes: Record<RecipeId, { name: string; description: string }>;
  paths: Record<PathId, string>;
  skills: Record<SkillId, { name: string; description: string }>;
  /** Names of the goal's stages: "Hull". */
  stages: Record<StageId, string>;
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
