import type { AnimalKind } from '../game/defs/animals';
import type { ItemId } from '../game/defs/items';
import type { LevelId, StageId, StarId } from '../game/defs/levels';
import type { ObjectKind } from '../game/defs/objects';
import type { RecipeId } from '../game/defs/recipes';
import type { RoomId } from '../game/defs/rooms';
import type { PathId, SkillId } from '../game/defs/skills';
import type { OrderId } from '../game/game';
import type { FloatWhat, Msg } from '../game/messages';
import type { NeedId } from '../game/needs';

export type Lang = 'en' | 'de';

/** The signs on the Cartographer's map; each is drawn by the sprite `map_<sign>`. */
export type MapSign = 'you' | 'hut' | 'fire' | 'spring' | 'goal' | 'bear' | 'cave';

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
    /** Start over from nothing: new island, no skills, choose the explorer again. */
    resetProgress: string;
    byFire: string;
    /** The grill button above the campfire: "Grill a fish (3 left)". */
    grill(n: number): string;
    inCave: string;
    /** HUD line while standing in a shelter: "In your hut". */
    inShelter(kind: ObjectKind): string;
    dawn: string;
    dusk: string;
    night: string;
    /** HUD, once the explorer has seen the sandbar. */
    lowTide: string;
    highTide: string;
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
    /** The goal card in the Build panel (more words for each island in `levels`). */
    goalMissing: string;
    /** "Step 2 of 4: Mast". */
    goalStep(index: number, count: number, stage: StageId): string;
    /** The question before leaving, and the screen after the last island. */
    notYet: string;
    endTitle: string;
    endText: string;
    stay: string;
    /** The dog's row in the Bag panel. */
    yourDog: string;
    dogNeeds(food: number, water: number): string;
    dogTired: string;
    feedDog: string;
    /** The Map button and panel (Cartographer, in a hut). */
    map: string;
    yourMap: string;
    /** What each sign on the map means. */
    mapSigns: Record<MapSign, string>;
    /** The island stars on the goal card, and on the end screen: "Stars: 4 of 6". */
    islandStars: string;
    endStars(n: number, of: number): string;
    /** On an island from before the tide islet: start a new island 1 and keep bag, XP, skills and dog. */
    oldIsland: string;
    keepProgress: string;
    /** The Hut button and the Hut panel: the bed, the map wall, the rooms and adding a room. */
    hut: string;
    yourHut: string;
    /** The Hut panel title in the crew cabin on the oil rig. */
    yourCabin: string;
    bed: string;
    bedNote: string;
    lookAtMap: string;
    mapNote: string;
    /** On the map wall without the Cartographer skill. */
    noMap: string;
    /** Under the hut in the Build panel, before the Cartographer skill. */
    hutMapRemark: string;
    /** The workbench row: "Make 2 rope from 2 big leaves". */
    workbenchNote(n: number): string;
    makeRope: string;
    hearthNote: string;
    cook: string;
    barrelNote: string;
    drink: string;
    addRoom: string;
    /** The load row in the Bag and Store panels: "Load", "18 / 30 heavy things". */
    load: string;
    loadOf(have: number, limit: number): string;
    loadNote: string;
    /** The Store panel. */
    store: string;
    notAtStore: string;
    inBag: string;
    inStore: string;
    bagEmptyShort: string;
    storeEmpty: string;
    heavy: string;
    putOne: string;
    putAll: string;
    takeOne: string;
    takeAll: string;
    /** A building that goes up in trips (the hut): how it works, and what its site still needs. */
    siteNote: string;
    siteLeft: string;
    /** The sea chart of the fishing boat, and its hold. */
    chart: string;
    chartNote(diesel: number, aboard: number): string;
    islandName(level: LevelId): string;
    sailTo: string;
    beenThere: string;
    newPlace: string;
    hold: string;
    holdNote: string;
    inHold: string;
    holdEmpty: string;
    /** The Radio panel: supply crates by helicopter. */
    radio: string;
    radioNote: string;
    order: string;
    orders: Record<OrderId, string>;
  };
  /** Rooms the explorer can add to the hut. */
  rooms: Record<RoomId, { name: string; description: string }>;
  /** The same rooms in the crew cabin on the oil rig: a workbench, a stove, a water tank. */
  cabinRooms: Record<RoomId, { name: string; description: string }>;
  /** Each island star: its name, and what to do for it. */
  stars: Record<StarId, { name: string; task: string }>;
  /** Goal card hints for the rare materials: where to find them. */
  rareHints: Partial<Record<ItemId, string>>;
  /** Each island's goal: the goal card, and the question before leaving. */
  levels: Record<LevelId, {
    goalTitle: string;
    goalFind: string;
    goalHint: string;
    goalReady: string;
    goalSailed: string;
    sailTitle: string;
    sailText: string;
    setSail: string;
  }>;
  /** "Day 2 · 6:00". */
  clock(turn: number): string;
  needs: Record<NeedId, string>;
  recipes: Record<RecipeId, { name: string; description: string }>;
  paths: Record<PathId, string>;
  skills: Record<SkillId, { name: string; description: string }>;
  /** Names as a heading or list entry, with no article: "Young palm", "Junge Palme". */
  objectName(kind: ObjectKind): string;
  animalName(kind: AnimalKind): string;
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
