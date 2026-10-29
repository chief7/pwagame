import { facingDelta, facingFor, PLAYER_ID, type Animal, type Dog, type Player } from './actors';
import { CAVE_FLOOR, caveMask, findCaves, type Cave } from './caves';
import { daylight, dayNumber, isLowTide, isNight, minuteOfDay, nextLowTide, phase, turnsUntilMorning, TURNS_PER_DAY } from './clock';
import { ANIMALS, islandAnimals, type AnimalKind } from './defs/animals';
import { ITEMS, type ItemId } from './defs/items';
import { goalProgress, levelDef, nextLevel, type GoalStage, type LevelId, type StarId } from './defs/levels';
import { canBeOpened, OBJECTS, type ObjectKind, type WorldObject } from './defs/objects';
import { RECIPE_IDS, RECIPES, type RecipeId } from './defs/recipes';
import { HABITAT, ORDERS, type OrderId } from './defs/orders';
import { hutSprite, ROOMS, type RoomId } from './defs/rooms';
import { pointsForXp, SKILLS, skillBefore, type SkillId } from './defs/skills';
import { computeFov } from './fov';
import { Inventory } from './inventory';
import { GameMap, Tile } from './map';
import type { FloatWhat, Msg, WakeReason } from './messages';
import { freshNeeds, LOW, tickNeeds, type NeedId, type Needs } from './needs';
import { BRIDGE_SPAN, DIRS, distanceMap, reachWithBridges } from './pathing';
import { Rng } from './rng';
import { generateWorld, WORLD_HEIGHT, WORLD_WIDTH } from './worldgen';

const LOG_LIMIT = 100;
/** Caves keep out the wind: they count as this much shelter. */
const CAVE_SHELTER = 0.5;
const RESPAWN_EVERY = 50;
const SLEEP_LIMIT = 200;
/** The most Energy a sleep gives out in the open and in a cave; shelters set their own (`rest`). */
export const OPEN_REST = 50;
export const CAVE_REST = 60;
/** Health comes back this much faster asleep in a hut bed, and in a hut with a hearth. */
export const BED_HEAL = 2;
export const HEARTH_HEAL = 3;
/** Extra rope from the rope recipe at the workbench. */
export const WORKSHOP_ROPE = 1;
/** Water from one drink at the rain barrel. */
export const BARREL_DRINK = 35;
/** How far the hearth lights the night round the hut. */
const HEARTH_LIGHT = 2;
/** Default chance per turn that a grumpy animal next to you hurts you. */
const HIT_CHANCE = 0.5;
/** Default turns an animal runs off after it hurt you. */
const FLEE_AFTER_HIT = 4;
/** Cells a charging animal runs in one turn. */
const CHARGE_STEPS = 2;
/** Turns a chasing animal follows you before it gives up. */
const CHASE_TURNS = 6;
/** Cells later that wild animals notice you with Animal friend (but at least 1). */
const FRIEND_NOTICE_LESS = 2;
/** Water from one drink at the river, the same as a spring. */
const RIVER_DRINK = 35;
/** XP for each gather, and for each fish caught. Building gives 1 XP per item it costs. */
const GATHER_XP = 1;
const CATCH_XP = 2;
/** Chance that a fish bites, without and with the Patient angler skill. */
const BITE_CHANCE = 0.4;
const PATIENT_BITE_CHANCE = 0.7;
/** How fast needs drop with the Explorer skills (1 is normal). */
const SMALL_SIPS = 0.8;
const SMALL_APPETITE = 0.8;
const THICK_SKIN = 0.7;
/** Plants regrow in this share of the time with Green thumb. */
const GREEN_THUMB = 0.7;
/** Extra cells the explorer sees at night with Night eyes. */
const NIGHT_EYES = 2;
/** Extra cells the explorer sees at night and in deep caves with the crystal lantern. */
const LANTERN_SIGHT = 2;
/** How much colder it is out in the open on snow, day and night (see warmthTarget). */
const SNOW_CHILL = 40;
/** On island 3, Water drops up to this share faster out on the hot ash by day (see tickNeeds). */
const ASH_HEAT = 0.5;
/** How far lava lights the night round it. */
const LAVA_LIGHT = 1;
/** Energy it costs to climb onto a ladder or a climbing rope. */
const CLIMB_ENERGY = 2;
/** Ropes from one rope recipe with Rope maker. */
const ROPE_MAKER = 2;
/** Turns a shooed (or barked at) animal runs away. */
const SHOO_TURNS = 8;
/** How much the dog's Food and Water drop each turn (half while you sleep). */
const DOG_HUNGER = 0.3;
const DOG_THIRST = 0.35;
/** The dog's Food and Water when you adopt it, before the snack you give it. */
const DOG_START_FOOD = 40;
const DOG_START_WATER = 60;
/** Food a dog gets from a raw fish: people must cook it first, dogs don't. */
const DOG_RAW_FISH = 30;
/** Water the dog gets from one drink. */
const DOG_DRINK = 50;
/** The dog drinks along with you when it is this close. */
const DOG_DRINK_RANGE = 3;
/** You can feed the dog when it is this close. */
const DOG_REACH = 2;
/** Cells round the dog where it barks small nuisance animals away. */
const DOG_BARK_RANGE = 3;
/** This far behind, the dog gives up walking and catches up at once (after fainting, sailing…). */
const DOG_LOST = 12;
/** A cave bear seen this close to a place already on the map adds no new place. */
const BEAR_SPOT_GAP = 6;
/** Turns a prowling bear follows you before it gives up (it stops at once when you leave its cave). */
const PROWL_TURNS = 5;
/** Warmth lost when the tide comes in and you have to wade back to dry land. */
const WADE_CHILL = 15;
/** Island stars: fish to catch, share of the ground to explore, days in a row without fainting, and the XP a star gives. */
const STAR_FISH = 5;
const STAR_EXPLORE = 0.75;
const STAR_SAFE_DAYS = 3;
const STAR_XP = 5;
/** How many heavy things the bag holds, and how many more with Strong back and with the pack frame. */
export const BAG_LOAD = 30;
export const STRONG_BACK_LOAD = 10;
export const PACK_FRAME_LOAD = 15;
/** How many heavy things the fishing boat's hold carries. */
export const HOLD_LOAD = 60;
/** A boat trip between the rig and an island: how long it takes (6 hours), and the diesel it burns. */
export const VOYAGE_TURNS = 60;
export const VOYAGE_DIESEL = 2;
/** With the boat motor: half the time (3 hours), and half the diesel. */
export const MOTOR_VOYAGE_TURNS = 30;
export const MOTOR_VOYAGE_DIESEL = 1;
/** A new platform cell must be this close to the crew cabin. */
export const PLATFORM_RANGE = 6;
/** The bigger hold: 30 more heavy things each time, at most two times. */
export const HOLD_UPGRADE = 30;
export const HOLD_UPGRADES = 2;
/**
 * What the rig's tools find on the islands, placed when the explorer first
 * comes to an island (also one from before the rig): ore veins on scree by
 * the cliffs of island 2, clay banks by the river of island 1, and sealed
 * crates on islands 1 to 3, far from home.
 */
export const WORKSHOP_STOCK: Partial<Record<LevelId, [ObjectKind, number][]>> = {
  1: [['clay_bank', 6], ['sealed_crate', 4]],
  2: [['ore_vein', 8], ['sealed_crate', 4]],
  3: [['sealed_crate', 4]],
};
/** Sealed crates are at least this far from home. */
const CRATE_DISTANCE = 12;
/** The rig's storage container is this many cells wide (and 2 deep). */
export const STORAGE_WIDTH = 6;
/** What may stand where the storage container goes: it takes their place (they only decorate the rig). */
const STORAGE_REPLACES: ObjectKind[] = ['rig_container', 'life_ring'];
/** Loose things the storage container may move to another cell when there is no other room. */
const STORAGE_MOVES: ObjectKind[] = ['scrap_pile', 'pallet', 'old_net', 'chest_closed', 'chest_open', 'diesel_drums', 'diesel_drums_empty'];
export const SAVE_VERSION = 14;

export type Tone = 'info' | 'good' | 'warn' | 'loot';

export interface LogEntry {
  msg: Msg;
  tone: Tone;
}

export type TravelResult = 'moved' | 'arrived' | 'blocked';

type Items = Partial<Record<ItemId, number>>;

/** The camp of an island: the hut, or the crew cabin on the oil rig. Both have a bed, rooms and a map wall. */
export function isCamp(kind: ObjectKind): boolean {
  return kind === 'hut' || kind === 'crew_cabin';
}

/** What a store crate holds, and what a building site already got (in the save). */
export interface ObjectStock {
  store?: Items;
  given?: Items;
}

/** How far the island's goal has come, for the goal card in the Build panel. */
export type GoalState =
  /** An island from before goals: it has no goal object. */
  | { state: 'missing' }
  | { state: 'find' }
  /** Building stage `index` of `count` on the goal object `obj`; `left` is what it still needs. */
  | { state: 'build'; obj: ObjectKind; stage: GoalStage; index: number; count: number; left: Items }
  | { state: 'ready' }
  | { state: 'sailed' };

/** One of the island's stars: earned, and how far along it is (`have` of `need`). */
export interface StarState {
  id: StarId;
  done: boolean;
  have: number;
  need: number;
}

/**
 * What happened during a turn, in order, for the UI to animate. `late`
 * marks things that happened in the animals' half of the turn.
 */
export type GameEvent = { late: boolean } & (
  | { type: 'move'; id: number; fromX: number; fromY: number; toX: number; toY: number }
  | { type: 'lunge'; id: number; x: number; y: number; targetX: number; targetY: number }
  /** The explorer casts the fishing rod towards (targetX, targetY). */
  | { type: 'cast'; id: number; x: number; y: number; targetX: number; targetY: number }
  | { type: 'hit'; id: number; x: number; y: number; damage: number }
  | { type: 'float'; x: number; y: number; amount: number; what: FloatWhat; tone: Tone }
  | { type: 'sparkle'; x: number; y: number }
  /** The helicopter flies over the rig and drops a supply crate at (x, y). */
  | { type: 'drop'; x: number; y: number }
  | { type: 'fade' }
);
type EventData = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'late'> : never) : never;

/** Needs that get a warning when they run low. */
const WARN_NEEDS = ['food', 'water', 'energy', 'warmth'] as const;

/** An island the explorer is not on, as they left it. */
interface Island {
  level: LevelId;
  map: GameMap;
  objects: Map<number, WorldObject>;
  home: { x: number; y: number };
  goalGiven: Items;
  bearSpots: number[];
  fishHere: number;
  /** The sea cell where the fishing boat lay when the explorer sailed off. */
  dock?: number;
}

/** An island in the save: its map as text, like the island the explorer is on. */
export interface SavedIsland {
  level: LevelId;
  width: number;
  height: number;
  tiles: string;
  explored: string;
  objects: SavedObject[];
  home: { x: number; y: number };
  goalGiven: Items;
  bearSpots: number[];
  fishHere: number;
  dock?: number;
}

/** Cell, kind, then the turn it regrows (0: none), a hut's rooms, and what a store or site holds. */
type SavedObject = [number, ObjectKind, number?, RoomId[]?, ObjectStock?];

function saveObjects(objects: Map<number, WorldObject>): SavedObject[] {
  return [...objects].map(([i, o]): SavedObject => {
    if (o.store || o.given) {
      const stock: ObjectStock = {};
      if (o.store) stock.store = { ...o.store };
      if (o.given) stock.given = { ...o.given };
      return [i, o.kind, o.readyAt ?? 0, [...(o.rooms ?? [])], stock];
    }
    if (o.rooms?.length) return [i, o.kind, o.readyAt ?? 0, [...o.rooms]];
    return o.readyAt ? [i, o.kind, o.readyAt] : [i, o.kind];
  });
}

function loadObjects(saved: SavedObject[]): Map<number, WorldObject> {
  return new Map(saved.map(([i, kind, readyAt, rooms, stock]) => {
    const obj: WorldObject = { kind };
    if (readyAt) obj.readyAt = readyAt;
    if (rooms?.length) obj.rooms = rooms;
    if (stock?.store) obj.store = stock.store;
    if (stock?.given) obj.given = stock.given;
    return [i, obj];
  }));
}

function saveMap(map: GameMap): { width: number; height: number; tiles: string; explored: string } {
  return {
    width: map.width,
    height: map.height,
    tiles: String.fromCharCode(...map.tiles.map((t) => t + 48)),
    explored: Array.from(map.explored, (e) => (e ? '1' : '0')).join(''),
  };
}

function loadMap(saved: { width: number; height: number; tiles: string; explored: string }): GameMap {
  const map = new GameMap(saved.width, saved.height);
  for (let i = 0; i < map.tiles.length; i++) {
    map.tiles[i] = saved.tiles.charCodeAt(i) - 48;
    map.explored[i] = saved.explored.charCodeAt(i) === 49 ? 1 : 0;
  }
  return map;
}

export interface SaveData {
  v: number;
  seed: number;
  rng: number;
  turn: number;
  nextId: number;
  width: number;
  height: number;
  tiles: string;
  explored: string;
  /**
   * Cell, kind, then the turn it regrows (0: none) and a hut's rooms, when
   * there are any, then what a store crate holds and a building site got.
   */
  objects: SavedObject[];
  animals: Animal[];
  player: Player;
  home: { x: number; y: number };
  needs: Needs;
  inventory: Partial<Record<ItemId, number>>;
  xp: number;
  skills: SkillId[];
  /** The island's number; each has its own goal (see levels.ts). */
  level: LevelId;
  /** What the explorer has handed over for the goal's current stage. */
  goalGiven: Items;
  sailed: boolean;
  dog: Dog | null;
  /** Cells of this island where the explorer saw a cave bear (for the Cartographer's map). */
  bearSpots: number[];
  /** Island stars earned, on this island and the ones before. */
  stars: [LevelId, StarId][];
  /** Fish caught on this island (for its fish star). */
  fishHere: number;
  /** The turn the explorer last fainted, or landed on this island (for the star for days without fainting). */
  safeSince: number;
  warned: NeedId[];
  log: LogEntry[];
  /** The other islands the explorer has been to (not the one they are on). */
  islands: SavedIsland[];
  /** Islands the explorer left on their goal. */
  left: LevelId[];
  /** What the fishing boat's hold carries. */
  hold: Items;
  /** The crate ordered on the radio and the turn it comes, and the day of the last order. */
  delivery: { order: OrderId } | null;
  orderDay: number;
  /** How often the boat's hold was made bigger. */
  holdUpgrades: number;
  /** The fishing boat has its outboard motor. */
  boatMotor: boolean;
  /** Islands that got their ore veins, clay banks and sealed crates. */
  stocked: LevelId[];
}

export class Game {
  readonly seed: number;
  readonly rng: Rng;
  map: GameMap;
  /** Everything standing in the world, by cell index. */
  objects: Map<number, WorldObject>;
  animals: Animal[] = [];
  readonly player: Player;
  /** Where the explorer wakes up after fainting: the last shelter slept in, or the start. */
  home: { x: number; y: number };
  needs: Needs = freshNeeds();
  inventory = new Inventory();
  /** Experience from gathering, building and fishing; it earns skill points. */
  xp = 0;
  skills = new Set<SkillId>();
  level: LevelId = 1;
  goalGiven: Items = {};
  /** The explorer used the last island's goal (called for help on the rig's radio). */
  sailed = false;
  /** Islands the explorer left on their goal: those goals are used up. */
  left = new Set<LevelId>();
  /** What the fishing boat's hold carries; it goes wherever the boat goes. */
  hold: Items = {};
  /** The other islands the explorer has been to, as they left them. */
  private islands = new Map<LevelId, Island>();
  /** The crate ordered on the radio: the helicopter brings it when the explorer steps on the helipad. */
  delivery: { order: OrderId } | null = null;
  /** The day of the last order (0: none yet). */
  orderDay = 0;
  /** How often the boat's hold was made bigger (see HOLD_UPGRADE). */
  holdUpgrades = 0;
  /** The fishing boat has its outboard motor (see MOTOR_VOYAGE_TURNS). */
  boatMotor = false;
  /** Islands that got their ore veins, clay banks and sealed crates. */
  private stocked = new Set<LevelId>();
  /** The adopted dog, or null before you find one. */
  dog: Dog | null = null;
  /** Cells where the explorer saw a cave bear on this island, at least BEAR_SPOT_GAP apart. */
  bearSpots: number[] = [];
  stars: [LevelId, StarId][] = [];
  fishHere = 0;
  safeSince = 0;
  turn = 0;
  log: LogEntry[] = [];
  sleeping = false;
  private nextId = PLAYER_ID + 1;
  private warned = new Set<NeedId>();
  /** Events since the UI last called takeEvents(). */
  private events: GameEvent[] = [];
  private animalsActing = false;
  /** The explorer walked into the finished goal: the UI asks whether to set sail. */
  private sailAsked = false;
  /** The explorer walked into the hut: the UI shows its inside. */
  private hutAsked = false;
  /** The explorer walked into a store crate: the UI shows the Store panel. */
  private storeAsked = false;
  /** The explorer walked into the fishing boat: the UI shows the sea chart and the hold. */
  private chartAsked = false;
  /** The explorer walked into the working radio after calling for help: the UI shows the Radio panel. */
  private radioAsked = false;
  /** climberDist() of this turn. */
  private climbDist: { turn: number; dist: Int32Array } | null = null;
  /** The deep caves of this map (found from its tiles, which never change). */
  private caveCache: { map: GameMap; caves: Cave[]; mask: Uint8Array } | null = null;
  private lavaCache: { map: GameMap; cells: [number, number, number][] } | null = null;

  constructor(seed = (Math.random() * 2 ** 32) >>> 0, save?: SaveData) {
    this.seed = seed;
    this.rng = new Rng(seed);
    if (save) {
      this.rng.state32 = save.rng;
      this.map = loadMap(save);
      this.objects = loadObjects(save.objects);
      for (const island of save.islands) {
        this.islands.set(island.level, {
          level: island.level,
          map: loadMap(island),
          objects: loadObjects(island.objects),
          home: island.home,
          goalGiven: island.goalGiven,
          bearSpots: island.bearSpots,
          fishHere: island.fishHere,
          dock: island.dock,
        });
      }
      this.left = new Set(save.left);
      this.hold = save.hold;
      // Older saves also keep the turn of the drop: it is not used now.
      this.delivery = save.delivery && { order: save.delivery.order };
      this.orderDay = save.orderDay;
      this.holdUpgrades = save.holdUpgrades;
      this.boatMotor = save.boatMotor;
      this.stocked = new Set(save.stocked);
      this.animals = save.animals;
      this.player = save.player;
      this.home = save.home;
      this.needs = save.needs;
      this.inventory = Inventory.from(save.inventory);
      this.xp = save.xp;
      this.skills = new Set(save.skills.filter((id) => id in SKILLS));
      this.level = save.level;
      this.goalGiven = save.goalGiven;
      // A save from when its island was the last one: the next island is there now.
      this.sailed = save.sailed && !nextLevel(save.level);
      this.dog = save.dog;
      this.bearSpots = save.bearSpots;
      this.stars = save.stars;
      this.fishHere = save.fishHere;
      this.safeSince = save.safeSince;
      this.turn = save.turn;
      this.nextId = save.nextId;
      this.warned = new Set(save.warned);
      this.log = save.log;
    } else {
      const world = generateWorld(this.rng);
      this.map = world.map;
      this.objects = world.objects;
      this.player = { id: PLAYER_ID, x: world.start.x, y: world.start.y, facing: 'down' };
      this.home = { ...world.start };
      this.inventory.add('coconut', 2);
      this.stockIsland();
      this.populate();
      this.message({ key: 'arrive' }, 'info');
    }
    if (save) {
      this.stockIsland();
      this.placeStorage();
    }
    this.updateFov();
  }

  /**
   * A new island 1 that keeps what the explorer carries, their XP, skills,
   * stars and dog. For players whose island is from before the tide islet.
   */
  static newIslandKeeping(old: Game): Game {
    const game = new Game();
    game.inventory = Inventory.from(old.inventory.toJSON());
    game.xp = old.xp;
    game.skills = new Set(old.skills);
    game.stars = old.stars.map(([level, star]) => [level, star]);
    if (old.dog) {
      game.animals = game.animals.filter((a) => ANIMALS[a.kind].temper !== 'stray');
      game.dog = { ...old.dog, id: game.nextId++, napping: false };
      game.dogToPlayer();
    }
    return game;
  }

  // ---- Testing aids (the cheat panel of preview builds, see src/cheats.ts) ----

  /** Go straight to a new island of this level, as if you had sailed there. Keeps the bag, XP, skills and dog. */
  jumpToIsland(level: LevelId): void {
    this.sailed = false;
    this.landOn(level);
  }

  /**
   * Put the explorer (and the dog) on the free cell nearest to cell `i`, and
   * mark that cell explored. Returns false when there is no free cell near it.
   */
  teleportNear(i: number): boolean {
    const tx = i % this.map.width;
    const ty = (i - tx) / this.map.width;
    let best: { x: number; y: number } | null = null;
    for (let r = 0; r <= 6 && !best; r++) {
      for (let dy = -r; dy <= r && !best; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = tx + dx;
          const y = ty + dy;
          if (!this.isPassable(x, y) || this.animalAt(x, y) || this.dogAt(x, y)) continue;
          best = { x, y };
          break;
        }
      }
    }
    if (!best) return false;
    this.emit({ type: 'fade' });
    this.player.x = best.x;
    this.player.y = best.y;
    this.map.explored[i] = 1;
    this.dogToPlayer();
    this.updateFov();
    return true;
  }

  /** Jump the clock forward to the next time it is `hour` o'clock. */
  skipToHour(hour: number): void {
    for (let i = 0; i < TURNS_PER_DAY; i++) {
      this.turn++;
      if (minuteOfDay(this.turn) === hour * 60) break;
    }
    this.emit({ type: 'fade' });
    this.updateFov();
  }

  /** Mark the whole island as explored. */
  revealMap(): void {
    this.map.explored.fill(1);
  }

  /** The sandbar cells of this island (none on island 2 and on islands from before the tide islet). */
  private sandbarCells(): number[] {
    const cells: number[] = [];
    for (const [i, obj] of this.objects) if (OBJECTS[obj.kind].tidal) cells.push(i);
    return cells;
  }

  /** Whether this island has something that gives a rare goal material (tar, resin). */
  private hasSource(item: ItemId): boolean {
    const from = ITEMS[item].rareFrom;
    if (!from) return true;
    for (const obj of this.objects.values()) if (from.includes(obj.kind)) return true;
    return false;
  }

  // ---- Queries -------------------------------------------------------------

  objectAt(x: number, y: number): WorldObject | undefined {
    return this.map.inBounds(x, y) ? this.objects.get(this.map.idx(x, y)) : undefined;
  }

  /** Sprite name to draw for the object at a cell (regrowing plants look bare, huts show their rooms). */
  objectSprite(obj: WorldObject, frame = 0): string {
    const def = OBJECTS[obj.kind];
    if (obj.kind === 'hut') return hutSprite(obj.rooms, frame);
    if (obj.kind === 'fishing_boat' && this.boatMotor) return 'fishing_boat_motor';
    if (def.tidal && !this.lowTide) return `${obj.kind}_wet`;
    if (obj.readyAt !== undefined && obj.readyAt > this.turn && def.depletedSprite) return def.depletedSprite;
    return obj.kind;
  }

  animalAt(x: number, y: number): Animal | undefined {
    return this.animals.find((a) => a.x === x && a.y === y);
  }

  dogAt(x: number, y: number): boolean {
    return !!this.dog && this.dog.x === x && this.dog.y === y;
  }

  /** How much Food an item gives the dog (0 if it won't eat it). Dogs eat raw fish too. */
  dogFoodValue(id: ItemId): number {
    return id === 'fish' ? DOG_RAW_FISH : ITEMS[id].eat?.food ?? 0;
  }

  /** What in the bag the dog can eat: raw fish first, then the least filling food. */
  dogFoods(): ItemId[] {
    return this.inventory
      .entries()
      .map(([id]) => id)
      .filter((id) => this.dogFoodValue(id) > 0)
      .sort((a, b) => (a === 'fish' ? -1 : b === 'fish' ? 1 : this.dogFoodValue(a) - this.dogFoodValue(b)));
  }

  /** Floor that nothing solid stands on, or a bridge. Ignores animals. */
  isPassable(x: number, y: number): boolean {
    const obj = this.objectAt(x, y);
    if (this.map.isFlow(x, y)) return !!obj && !!OBJECTS[obj.kind].bridge;
    if (this.map.get(x, y) === Tile.Water) {
      if (!obj) return false;
      const def = OBJECTS[obj.kind];
      return def.tidal ? this.lowTide : !!def.overSea;
    }
    if (!this.map.isFloor(x, y)) return false;
    return !obj || !!OBJECTS[obj.kind].walkable;
  }

  visibleAnimals(): Animal[] {
    return this.animals.filter((a) => this.map.isVisible(a.x, a.y));
  }

  /** With Cartographer, the explorer keeps a map on the wall of every hut. */
  canReadMap(): boolean {
    return this.has('cartographer') && !!this.hutHere();
  }

  /** The hut the explorer is in, or null. */
  hutHere(): WorldObject | null {
    const obj = this.objectAt(this.player.x, this.player.y);
    return obj && isCamp(obj.kind) ? obj : null;
  }

  /** The explorer is in a hut that has this room. */
  hasRoom(id: RoomId): boolean {
    return !!this.hutHere()?.rooms?.includes(id);
  }

  /** This island already has a hut (the camp), or its building site: there is only one. */
  hasHut(): boolean {
    for (const obj of this.objects.values()) if (isCamp(obj.kind) || obj.kind === 'hut_site') return true;
    return false;
  }

  /** This island already has a store crate: there is only one. */
  hasStore(): boolean {
    for (const obj of this.objects.values()) if (OBJECTS[obj.kind].store && !OBJECTS[obj.kind].dropped) return true;
    return false;
  }

  /** The cell of the store (a store crate, a dropped supply crate or the storage container) next to the explorer, or -1. */
  private storeCell(): number {
    for (const [dx, dy] of DIRS) {
      const main = this.mainPiece(this.player.x + dx, this.player.y + dy);
      if (main && OBJECTS[main.obj.kind].store) return this.map.idx(main.x, main.y);
    }
    return -1;
  }

  /** The object at a cell, or the main piece of the big object it is part of (see `partOf`). */
  private mainPiece(x: number, y: number): { x: number; y: number; obj: WorldObject } | null {
    for (let k = 0; k < 3; k++) {
      const obj = this.objectAt(x, y);
      if (!obj) return null;
      const part = OBJECTS[obj.kind].partOf;
      if (!part) return { x, y, obj };
      x += part[0];
      y += part[1];
    }
    return null;
  }

  /** The bag is full: say so, and on the rig point to the storage container. */
  private tooHeavy(): void {
    this.message(this.storageCell() >= 0 ? { key: 'tooHeavy', container: true } : { key: 'tooHeavy' }, 'info');
  }

  /** The explorer, the dog or an animal stands here. */
  private someoneAt(x: number, y: number): boolean {
    return (x === this.player.x && y === this.player.y) || this.dogAt(x, y) || !!this.animalAt(x, y);
  }

  /** The cell of the storage container's main piece on this island, or -1. */
  private storageCell(): number {
    for (const [i, obj] of this.objects) if (obj.kind === 'storage_container_0') return i;
    return -1;
  }

  /**
   * Put the big storage container on the rig, if it is not there yet (new
   * rigs, and rigs from saves before it). It wants 6 × 2 deck cells, no
   * gangway or boat round them and a free deck cell in front, as near the
   * crew cabin as it can, and must leave the whole rig reachable. Rusty
   * containers and life rings only decorate the rig: it takes their place
   * if there is no other room. Last of all it moves loose things (scrap,
   * pallets, nets, chests, drums) to the nearest free deck cell.
   */
  private placeStorage(): void {
    if (levelDef(this.level).biome !== 'rig' || this.storageCell() >= 0) return;
    const { map } = this;
    const w = map.width;
    let cabin = { x: this.home.x, y: this.home.y };
    for (const [i, obj] of this.objects) if (obj.kind === 'crew_cabin') cabin = { x: i % w, y: (i - (i % w)) / w };
    // What it costs to put the container here: 1 for each decoration it replaces, 10 for each thing in front, 100 for each thing it moves.
    const spots: { x: number; y: number; cost: number; far: number }[] = [];
    for (let y = 1; y < map.height - 2; y++) {
      for (let x = 1; x < w - STORAGE_WIDTH; x++) {
        let cost = 0;
        let front = false;
        let ok = true;
        for (let cy = y - 1; ok && cy <= y + 2; cy++) {
          for (let cx = x - 1; ok && cx <= x + STORAGE_WIDTH; cx++) {
            const inside = cy >= y && cy <= y + 1 && cx >= x && cx < x + STORAGE_WIDTH;
            const obj = this.objectAt(cx, cy);
            if (inside) {
              if (map.get(cx, cy) !== Tile.Deck || this.someoneAt(cx, cy)) ok = false;
              else if (obj) {
                if (STORAGE_REPLACES.includes(obj.kind)) cost += 1;
                else if (STORAGE_MOVES.includes(obj.kind)) cost += 100;
                else ok = false;
              }
            } else if (obj && (OBJECTS[obj.kind].overSea || OBJECTS[obj.kind].broken || obj.kind.startsWith('fishing_boat'))) {
              ok = false;
            } else if (cy === y + 2 && cx >= x && cx < x + STORAGE_WIDTH) {
              // A free deck cell in front to walk in from; things in front would hide its side.
              if (map.get(cx, cy) === Tile.Deck && !obj) front = true;
              if (obj) cost += 10;
            }
          }
        }
        if (ok && front) spots.push({ x, y, cost, far: Math.abs(x + STORAGE_WIDTH / 2 - cabin.x) + Math.abs(y - cabin.y) });
      }
    }
    spots.sort((a, b) => a.cost - b.cost || a.far - b.far);
    const inside = (cx: number, cy: number, x: number, y: number) => cx >= x && cx < x + STORAGE_WIDTH && cy >= y && cy <= y + 1;
    for (const { x, y } of spots) {
      const before = new Map<number, WorldObject>();
      const moved: number[] = [];
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < STORAGE_WIDTH; dx++) {
          const i = map.idx(x + dx, y + dy);
          const obj = this.objects.get(i);
          if (obj) before.set(i, obj);
          const kind: ObjectKind = dy === 0 ? 'storage_container_back' : `storage_container_${dx}` as ObjectKind;
          this.objects.set(i, { kind });
        }
      }
      // Loose things go to the nearest free deck cell.
      for (const [i, obj] of before) {
        if (!STORAGE_MOVES.includes(obj.kind)) continue;
        const ox = i % w;
        const oy = (i - ox) / w;
        let best = -1;
        let bestFar = Infinity;
        for (let k = 0; k < map.tiles.length; k++) {
          const kx = k % w;
          const ky = (k - kx) / w;
          const far = Math.abs(kx - ox) + Math.abs(ky - oy);
          if (far >= bestFar || map.tiles[k] !== Tile.Deck || this.objects.has(k) || inside(kx, ky, x, y)) continue;
          if (this.someoneAt(kx, ky) || (ky === y + 2 && kx >= x && kx < x + STORAGE_WIDTH)) continue;
          best = k;
          bestFar = far;
        }
        if (best >= 0) {
          this.objects.set(best, obj);
          moved.push(best);
        }
      }
      if (this.allReachableFrom(this.home.x, this.home.y)) return;
      for (const k of moved) this.objects.delete(k);
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < STORAGE_WIDTH; dx++) this.objects.delete(map.idx(x + dx, y + dy));
      for (const [i, obj] of before) this.objects.set(i, obj);
    }
  }

  /** The store next to the explorer, or null. */
  storeNear(): WorldObject | null {
    const i = this.storeCell();
    return i < 0 ? null : this.objects.get(i)!;
  }

  /** How many heavy things the explorer carries (see ITEMS `heavy`). */
  get load(): number {
    return this.inventory.entries().reduce((sum, [id, n]) => sum + (ITEMS[id].heavy ? n : 0), 0);
  }

  /** How many heavy things the bag holds: more with Strong back and with the pack frame. */
  get loadLimit(): number {
    return BAG_LOAD + (this.has('strong_back') ? STRONG_BACK_LOAD : 0) + (this.inventory.count('pack_frame') > 0 ? PACK_FRAME_LOAD : 0);
  }

  /** The most Energy a sleep at (x, y) gives: only the bed in a hut gives a full rest. */
  restCap(x: number, y: number): number {
    const obj = this.objectAt(x, y);
    const rest = obj ? OBJECTS[obj.kind].rest ?? 0 : 0;
    return Math.max(rest, this.map.get(x, y) === Tile.CaveFloor ? CAVE_REST : OPEN_REST);
  }

  /** 0 in the open, up to 1 inside a hut. */
  shelterAt(x: number, y: number): number {
    const obj = this.objectAt(x, y);
    const built = obj ? OBJECTS[obj.kind].shelter ?? 0 : 0;
    return Math.max(built, this.map.get(x, y) === Tile.CaveFloor ? CAVE_SHELTER : 0);
  }

  /** The deep caves of this island: big caves with only a few ways in (see caves.ts). */
  caves(): Cave[] {
    return this.caveData().caves;
  }

  private caveData(): { caves: Cave[]; mask: Uint8Array } {
    if (this.caveCache?.map !== this.map) {
      const caves = findCaves(this.map);
      this.caveCache = { map: this.map, caves, mask: caveMask(this.map, caves) };
    }
    return this.caveCache;
  }

  /** On the floor of a deep cave: dark there, also in the day. */
  inCave(x: number, y: number): boolean {
    return this.map.inBounds(x, y) && this.caveData().mask[this.map.idx(x, y)] === CAVE_FLOOR;
  }

  /** Daylight at a cell: none in a deep cave and on the rock round it. */
  daylightAt(x: number, y: number): number {
    return this.map.inBounds(x, y) && this.caveData().mask[this.map.idx(x, y)] ? 0 : this.daylight;
  }

  /** The explorer carries the crystal lantern. */
  get hasLantern(): boolean {
    return this.inventory.count('lantern') > 0;
  }

  /** Campfires and other light sources (the lit beacon, glowcaps that are not picked, lava): [x, y, radius]. */
  lights(): [number, number, number][] {
    const out: [number, number, number][] = this.lavaLights();
    for (const [i, obj] of this.objects) {
      const def = OBJECTS[obj.kind];
      if (obj.readyAt !== undefined && obj.readyAt > this.turn) continue;
      const r = this.goalUsed && def.done ? def.done.lightRadius : obj.rooms?.includes('hearth') ? HEARTH_LIGHT : def.lightRadius;
      if (r) out.push([i % this.map.width, Math.floor(i / this.map.width), r]);
    }
    return out;
  }

  /** Every lava cell glows a little at night. Worked out once per island. */
  private lavaLights(): [number, number, number][] {
    if (this.lavaCache?.map !== this.map) {
      const cells: [number, number, number][] = [];
      for (let i = 0; i < this.map.tiles.length; i++) {
        if (this.map.tiles[i] === Tile.Lava) cells.push([i % this.map.width, Math.floor(i / this.map.width), LAVA_LIGHT]);
      }
      this.lavaCache = { map: this.map, cells };
    }
    return [...this.lavaCache.cells];
  }

  /** An object of this kind stands next to the explorer (the furnace for smelting, the galley for stew). */
  nextTo(kind: ObjectKind): boolean {
    return DIRS.some(([dx, dy]) => this.objectAt(this.player.x + dx, this.player.y + dy)?.kind === kind);
  }

  /** This building stands on this island; with `orSite`, its frame counts too. */
  hasBuilt(kind: ObjectKind, orSite = false): boolean {
    for (const obj of this.objects.values()) {
      if (obj.kind === kind || (orSite && OBJECTS[obj.kind].site === kind)) return true;
    }
    return false;
  }

  /** The habitat buildings that stand on the rig (none away from it). */
  habitatBuilt(): ObjectKind[] {
    return levelDef(this.level).biome === 'rig' ? HABITAT.filter((kind) => this.hasBuilt(kind)) : [];
  }

  /**
   * Put what the rig's tools find on this island (see WORKSHOP_STOCK), the
   * first time the explorer is here. Nothing may cut off part of the island.
   */
  private stockIsland(): void {
    const stock = WORKSHOP_STOCK[this.level];
    if (!stock || this.stocked.has(this.level)) return;
    this.stocked.add(this.level);
    const { map } = this;
    const w = map.width;
    const near = (x: number, y: number, tile: Tile) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.get(x + dx, y + dy) === tile);
    const fits: Partial<Record<ObjectKind, (x: number, y: number) => boolean>> = {
      ore_vein: (x, y) => map.get(x, y) === Tile.Scree && near(x, y, Tile.Rock),
      clay_bank: (x, y) => (map.get(x, y) === Tile.Grass || map.get(x, y) === Tile.Sand) && near(x, y, Tile.River),
      sealed_crate: (x, y) => map.isFloor(x, y) && map.get(x, y) !== Tile.CaveFloor &&
        Math.max(Math.abs(x - this.home.x), Math.abs(y - this.home.y)) >= CRATE_DISTANCE,
    };
    for (const [kind, count] of stock) {
      const fit = fits[kind]!;
      const cells: number[] = [];
      for (let i = 0; i < map.tiles.length; i++) {
        const x = i % w;
        const y = (i - x) / w;
        if (!this.objects.has(i) && fit(x, y) && !this.animalAt(x, y) && !(x === this.player.x && y === this.player.y)) cells.push(i);
      }
      let placed = 0;
      for (const i of this.rng.shuffle(cells)) {
        if (placed >= count) break;
        this.objects.set(i, { kind });
        if (this.allReachableFrom(this.home.x, this.home.y)) placed++;
        else this.objects.delete(i);
      }
    }
  }

  nearFire(x: number, y: number): boolean {
    return this.nearestFire(x, y) !== null;
  }

  /** The closest fire (or hearth) whose warmth reaches (x, y), or null if none does. */
  nearestFire(x: number, y: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const [i, obj] of this.objects) {
      // A hearth is a fire too, but only for whoever is inside the hut.
      const r = OBJECTS[obj.kind].warmthRadius ?? (obj.rooms?.includes('hearth') ? 0 : undefined);
      if (r === undefined) continue;
      const fx = i % this.map.width;
      const fy = Math.floor(i / this.map.width);
      const d = Math.max(Math.abs(fx - x), Math.abs(fy - y));
      if (d <= r && d < bestDist) {
        best = { x: fx, y: fy };
        bestDist = d;
      }
    }
    return best;
  }

  /** Low tide: the sandbar to the tide islet is dry. */
  get lowTide(): boolean {
    return isLowTide(this.turn);
  }

  /** The explorer has seen the sandbar, so the HUD and the log talk about the tide. */
  tideKnown(): boolean {
    return this.sandbarCells().some((i) => this.map.explored[i]);
  }

  /** An island 1 from before the tide islet: a new island 1 has more to find. */
  get oldIsland(): boolean {
    return this.level === 1 && !this.sandbarCells().length;
  }

  /** A nocturnal animal (the cave bear) sleeps through the day, unless something woke it. */
  asleep(a: Animal): boolean {
    return !!ANIMALS[a.kind].nocturnal && this.phase === 'day' && !a.flee && !a.chase;
  }

  get daylight(): number {
    return daylight(this.turn);
  }

  get phase() {
    return phase(this.turn);
  }

  /** How far the explorer can see: less at night and in deep caves. */
  get sightRadius(): number {
    const day = this.daylightAt(this.player.x, this.player.y);
    const extra = (this.has('night_eyes') ? NIGHT_EYES : 0) + (this.hasLantern ? LANTERN_SIGHT : 0);
    return Math.round(4 + 4 * day + extra * (1 - day));
  }

  has(skill: SkillId): boolean {
    return this.skills.has(skill);
  }

  /** Skill points earned and not spent yet. */
  get skillPoints(): number {
    const spent = [...this.skills].reduce((sum, id) => sum + SKILLS[id].cost, 0);
    return pointsForXp(this.xp) - spent;
  }

  /** Why a skill can't be learned right now, or null if it can. */
  skillProblem(id: SkillId): Msg | null {
    const before = skillBefore(id);
    if (before && !this.has(before)) return { key: 'needSkill', skill: before };
    if (this.skillPoints < SKILLS[id].cost) return { key: 'needPoints' };
    return null;
  }

  /**
   * What a recipe costs the explorer now (Handy builder saves a piece of
   * wood): its `orCost` when they have that and not the usual cost.
   */
  recipeCost(id: RecipeId): Items {
    const { cost, orCost } = RECIPES[id];
    const usual = this.withSkills(cost);
    if (!orCost || this.inventory.hasAll(usual)) return usual;
    const other = this.withSkills(orCost);
    return this.inventory.hasAll(other) ? other : usual;
  }

  /** What a building site of this recipe takes, in trips (Handy builder works here too). */
  siteCost(id: RecipeId): Items {
    return this.withSkills(RECIPES[id].siteCost ?? {});
  }

  /** What a hut room costs the explorer now (Handy builder works here too). */
  roomCost(id: RoomId): Items {
    return this.withSkills(ROOMS[id].cost);
  }

  private withSkills(base: Items): Items {
    const cost = { ...base };
    if (this.has('handy_builder') && cost.wood) {
      cost.wood--;
      if (!cost.wood) delete cost.wood;
    }
    return cost;
  }

  /** How many items a recipe that `makes` an item gives now (Rope maker twists 2 ropes, the workbench one more). */
  recipeMakes(id: RecipeId): number {
    if (id !== 'rope') return 1;
    return (this.has('rope_maker') ? ROPE_MAKER : 1) + (this.hasRoom('workshop') ? WORKSHOP_ROPE : 0);
  }

  /** Why a room can't be added to the hut right now, or null if it can. */
  roomProblem(id: RoomId): Msg | null {
    const hut = this.hutHere();
    if (!hut || hut.rooms?.includes(id)) return { key: 'notInHut' };
    if (!this.inventory.hasAll(this.roomCost(id))) return { key: 'needMaterials' };
    return null;
  }

  /** Why a recipe can't be built right now, or null if it can. */
  buildProblem(id: RecipeId): Msg | null {
    const recipe = RECIPES[id];
    if (recipe.skill && !this.has(recipe.skill)) return { key: 'needSkill', skill: recipe.skill };
    if ('builds' in recipe && (recipe.builds === 'hut' || recipe.builds === 'hut_site') && this.hasHut()) return { key: 'oneHut' };
    if ('builds' in recipe && OBJECTS[recipe.builds].store && this.hasStore()) return { key: 'oneStore' };
    if ('makes' in recipe && ITEMS[recipe.makes].tool && this.inventory.count(recipe.makes) > 0) {
      return { key: 'haveTool', item: recipe.makes };
    }
    if (recipe.rigOnly && levelDef(this.level).biome !== 'rig') return { key: 'rigOnly' };
    if (recipe.needsBuilt && !this.hasBuilt(recipe.needsBuilt)) return { key: 'needBuilding', obj: recipe.needsBuilt };
    if ('builds' in recipe) {
      // Each habitat building stands only once on the rig (its frame counts too).
      const building = OBJECTS[recipe.builds].site ?? recipe.builds;
      if (HABITAT.includes(building) && this.hasBuilt(building, true)) return { key: 'oneBuilding', obj: building };
    }
    if ('builds' in recipe && OBJECTS[recipe.builds].holdUpgrade && this.holdUpgrades >= HOLD_UPGRADES) return { key: 'holdMax' };
    if ('builds' in recipe && OBJECTS[recipe.builds].boatMotor && this.boatMotor) return { key: 'haveMotor' };
    if (!this.inventory.hasAll(this.recipeCost(id))) return { key: 'needMaterials' };
    if (recipe.atFire && !this.nearFire(this.player.x, this.player.y)) return { key: 'needFire' };
    if (recipe.near && !this.nextTo(recipe.near)) return { key: 'needNear', obj: recipe.near };
    if ('builds' in recipe && !this.buildSpot(recipe.builds, recipe.onto)) {
      if (recipe.onto) return { key: 'noStep', obj: recipe.onto[0] };
      const built = OBJECTS[recipe.builds];
      if (built.holdUpgrade || built.boatMotor) return { key: 'noBoat' };
      if (built.onSea) return { key: 'noSeaSpot' };
      return built.deck ? { key: 'noDeckSpot' } : built.onLava ? { key: 'noLavaSpot' } : built.bridge ? { key: 'noBridgeSpot' } : { key: 'noRoom' };
    }
    return null;
  }

  /** Where the island's goal stands, or -1 on islands from before goals. */
  private goalCell(): number {
    for (const [i, obj] of this.objects) if (OBJECTS[obj.kind].goal) return i;
    return -1;
  }

  /** This island's goal is used: the explorer left on it, or called for help on the last one. */
  get goalUsed(): boolean {
    return this.left.has(this.level) || (this.sailed && !nextLevel(this.level));
  }

  goal(): GoalState {
    if (this.goalUsed) return { state: 'sailed' };
    const i = this.goalCell();
    if (i < 0) return { state: 'missing' };
    if (!this.map.explored[i]) return { state: 'find' };
    const def = levelDef(this.level);
    const obj = this.objects.get(i)!.kind;
    const done = goalProgress(def, obj);
    if (done >= def.stages.length) return { state: 'ready' };
    const stage = def.stages[done];
    return { state: 'build', obj, stage, index: done, count: def.stages.length, left: this.goalLeft(stage) };
  }

  /**
   * What a stage costs on this island. A rare material (tar, resin) is left
   * out on an island with nothing that gives it: an island from an old save.
   */
  stageCost(stage: GoalStage): Items {
    const cost: Items = {};
    for (const [item, n] of Object.entries(stage.cost) as [ItemId, number][]) {
      if (this.hasSource(item)) cost[item] = n;
    }
    return cost;
  }

  private goalLeft(stage: GoalStage): Items {
    const left: Items = {};
    for (const [item, n] of Object.entries(this.stageCost(stage)) as [ItemId, number][]) {
      const still = n - (this.goalGiven[item] ?? 0);
      if (still > 0) left[item] = still;
    }
    return left;
  }

  /** What the goal's current stage still needs; nothing before it is found or once it is done. */
  private goalStillNeeds(): Items {
    const goal = this.goal();
    return goal.state === 'build' ? goal.left : {};
  }

  /** True once after the explorer walked into the finished goal. */
  takeSailRequest(): boolean {
    const asked = this.sailAsked;
    this.sailAsked = false;
    return asked;
  }

  /** Hand over (and forget) everything that happened since the last call. */
  takeEvents(): GameEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  // ---- Actions (each returns true when time passed) ------------------------------

  /** Step, or bump into whatever is there: gather, drink, open, shoo. */
  move(dx: number, dy: number): boolean {
    const p = this.player;
    p.facing = facingFor(dx, dy, p.facing);
    const nx = p.x + dx;
    const ny = p.y + dy;
    const animal = this.animalAt(nx, ny);
    if (animal) {
      if (ANIMALS[animal.kind].temper === 'stray') {
        if (!this.adopt(animal)) return false;
      } else {
        this.shoo(animal);
      }
      this.endTurn();
      return true;
    }
    const dog = this.dog;
    if (dog && this.dogAt(nx, ny)) {
      // Walking into your dog swaps places, so it never blocks the way.
      this.emit({ type: 'move', id: dog.id, fromX: dog.x, fromY: dog.y, toX: p.x, toY: p.y });
      this.turnDog(dog, p.x - dog.x);
      dog.x = p.x;
      dog.y = p.y;
      this.emit({ type: 'move', id: p.id, fromX: p.x, fromY: p.y, toX: nx, toY: ny });
      p.x = nx;
      p.y = ny;
      this.endTurn();
      return true;
    }
    const obj = this.objectAt(nx, ny);
    if (obj && !OBJECTS[obj.kind].walkable) {
      if (!this.interact(nx, ny, obj)) return false;
      this.endTurn();
      return true;
    }
    if (!this.isPassable(nx, ny)) {
      if (this.map.get(nx, ny) === Tile.River) {
        this.emit({ type: 'lunge', id: p.id, x: p.x, y: p.y, targetX: nx, targetY: ny });
        if (!this.drink(RIVER_DRINK, { key: 'drinkRiver' })) return false;
        this.endTurn();
        return true;
      }
      if (this.map.get(nx, ny) === Tile.Lava) {
        // Too hot to step on: nothing happens, no time passes.
        this.message({ key: 'lavaHot' }, 'info');
        return false;
      }
      if (obj && OBJECTS[obj.kind].tidal) {
        // High tide: the sandbar is under water until the next low tide.
        this.message({ key: 'tideHigh', turn: nextLowTide(this.turn) }, 'info');
        return false;
      }
      if (this.map.get(nx, ny) === Tile.Water) {
        if (this.inventory.count('fishing_rod') > 0) {
          this.fish(nx, ny);
          this.endTurn();
          return true;
        }
        this.message({ key: 'seaSalty' }, 'info');
      }
      return false;
    }
    this.emit({ type: 'move', id: p.id, fromX: p.x, fromY: p.y, toX: nx, toY: ny });
    const onSnow = this.map.get(p.x, p.y) === Tile.Snow;
    const onAsh = this.map.get(p.x, p.y) === Tile.Ash;
    const inCave = this.inCave(p.x, p.y);
    p.x = nx;
    p.y = ny;
    if (obj && isCamp(obj.kind)) {
      this.message(obj.kind === 'hut' ? { key: 'enterHut' } : { key: 'enterHut', obj: obj.kind }, 'info');
      this.hutAsked = true;
    } else if (obj && OBJECTS[obj.kind].shelter) {
      this.message({ key: 'stepInto', obj: obj.kind }, 'info');
    } else if (obj && OBJECTS[obj.kind].climb) this.climb(nx, ny, obj.kind);
    else if (!onSnow && this.map.get(nx, ny) === Tile.Snow) this.message({ key: 'snowCold' }, 'warn');
    else if (!onAsh && this.map.get(nx, ny) === Tile.Ash && this.daylight > 0.5) this.message({ key: 'ashHot' }, 'warn');
    else if (!inCave && this.inCave(nx, ny)) this.message(this.hasLantern ? { key: 'caveEnter', lantern: true } : { key: 'caveEnter' }, 'info');
    this.endTurn();
    return true;
  }

  /** Climbing onto a ladder or a climbing rope is hard work, unless you are sure-footed. */
  private climb(x: number, y: number, kind: ObjectKind): void {
    if (this.has('sure_foot')) {
      this.message({ key: 'climb', obj: kind, easy: true }, 'info');
      return;
    }
    this.needs.energy = Math.max(0, this.needs.energy - CLIMB_ENERGY);
    this.emit({ type: 'float', x, y, amount: -CLIMB_ENERGY, what: { need: 'energy' }, tone: 'info' });
    this.message({ key: 'climb', obj: kind }, 'info');
  }

  /** One step along the shortest known path to (tx, ty), through explored ground only. */
  travelStep(tx: number, ty: number): TravelResult {
    const p = this.player;
    if (p.x === tx && p.y === ty) return 'arrived';
    if (!this.isPassable(tx, ty) || !this.map.isExplored(tx, ty)) return 'blocked';
    const dist = distanceMap(this.map, tx, ty, (x, y) => this.isPassable(x, y) && this.map.isExplored(x, y));
    let best: readonly [number, number] | null = null;
    let bestDist = Infinity;
    for (const [dx, dy] of DIRS) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (!this.map.inBounds(nx, ny) || this.animalAt(nx, ny)) continue;
      const d = dist[this.map.idx(nx, ny)];
      if (d >= 0 && d < bestDist) {
        best = [dx, dy];
        bestDist = d;
      }
    }
    if (!best || !this.move(best[0], best[1])) return 'blocked';
    return p.x === tx && p.y === ty ? 'arrived' : 'moved';
  }

  wait(): boolean {
    this.endTurn();
    return true;
  }

  eat(id: ItemId): boolean {
    const food = ITEMS[id].eat;
    if (!food || this.inventory.count(id) === 0) return false;
    if (this.needs.food >= 98 && (food.water ?? 0) === 0) {
      this.message({ key: 'tooFull' }, 'info');
      return false;
    }
    this.inventory.take(id);
    const gains: [NeedId, number][] = [];
    for (const need of ['food', 'water', 'energy'] as const) {
      const amount = food[need];
      if (!amount) continue;
      this.needs[need] = Math.min(100, this.needs[need] + amount);
      gains.push([need, amount]);
    }
    this.message({ key: 'eat', item: id }, 'good');
    const [need, amount] = gains[0];
    this.emit({ type: 'float', x: this.player.x, y: this.player.y, amount, what: { need }, tone: 'good' });
    this.endTurn();
    return true;
  }

  /** Give the dog something to eat from the bag. It has to be close by. */
  feedDog(id: ItemId): boolean {
    const dog = this.dog;
    const value = this.dogFoodValue(id);
    if (!dog || !value || this.inventory.count(id) === 0) return false;
    const p = this.player;
    if (Math.max(Math.abs(dog.x - p.x), Math.abs(dog.y - p.y)) > DOG_REACH) {
      this.message({ key: 'dogFar' }, 'info');
      return false;
    }
    if (dog.food >= 98) {
      this.message({ key: 'dogFull' }, 'info');
      return false;
    }
    this.inventory.take(id);
    dog.food = Math.min(100, dog.food + value);
    this.emit({ type: 'lunge', id: p.id, x: p.x, y: p.y, targetX: dog.x, targetY: dog.y });
    this.emit({ type: 'float', x: dog.x, y: dog.y, amount: value, what: { need: 'food' }, tone: 'good' });
    this.message({ key: 'dogFeed', item: id }, 'good');
    this.cheerUpDog();
    this.endTurn();
    return true;
  }

  build(id: RecipeId): boolean {
    const recipe = RECIPES[id];
    const problem = this.buildProblem(id);
    if (problem) {
      this.message(problem, 'info');
      return false;
    }
    const cost = this.recipeCost(id);
    this.inventory.takeAll(cost);
    const xp = Object.values(cost).reduce((sum, n) => sum + (n ?? 0), 0);
    const p = this.player;
    if ('makes' in recipe) {
      // Cooking: reach towards the fire.
      const fire = recipe.atFire ? this.nearestFire(p.x, p.y) : null;
      if (fire) this.emit({ type: 'lunge', id: p.id, x: p.x, y: p.y, targetX: fire.x, targetY: fire.y });
      const count = this.recipeMakes(id);
      this.inventory.add(recipe.makes, count);
      this.emit({ type: 'float', x: p.x, y: p.y, amount: count, what: { item: recipe.makes }, tone: 'good' });
      this.emit({ type: 'sparkle', x: p.x, y: p.y });
      if (recipe.atFire) this.message({ key: 'cook', item: recipe.makes }, 'good');
      else this.message(count > 1 ? { key: 'make', item: recipe.makes, count } : { key: 'make', item: recipe.makes }, 'good');
      this.gainXp(xp, p.x, p.y);
      this.endTurn();
      return true;
    }
    const spot = this.buildSpot(recipe.builds, recipe.onto)!;
    if (OBJECTS[spot.kind].holdUpgrade) {
      this.holdUpgrades++;
      const [boat] = spot.cells;
      this.emit({ type: 'sparkle', x: boat.x, y: boat.y });
      this.message({ key: 'holdUpgraded', limit: this.holdLimit }, 'good');
      this.gainXp(xp, boat.x, boat.y);
      this.endTurn();
      return true;
    }
    if (OBJECTS[spot.kind].boatMotor) {
      this.boatMotor = true;
      const [boat] = spot.cells;
      this.emit({ type: 'sparkle', x: boat.x, y: boat.y });
      this.message({ key: 'motorFitted' }, 'good');
      this.gainXp(xp, boat.x, boat.y);
      this.endTurn();
      return true;
    }
    if (OBJECTS[spot.kind].deck) {
      // A new cell of deck: the tile changes, nothing stands on it.
      const [cell] = spot.cells;
      this.map.change(cell.x, cell.y, Tile.Deck);
      this.emit({ type: 'sparkle', x: cell.x, y: cell.y });
      this.emit({ type: 'lunge', id: p.id, x: p.x, y: p.y, targetX: cell.x, targetY: cell.y });
      this.message({ key: 'platformBuilt' }, 'good');
      this.gainXp(xp, cell.x, cell.y);
      this.endTurn();
      return true;
    }
    const mends = !!OBJECTS[this.objectAt(spot.cells[0].x, spot.cells[0].y)?.kind ?? spot.kind].broken;
    for (const cell of spot.cells) {
      this.objects.set(this.map.idx(cell.x, cell.y), { kind: spot.kind });
      this.emit({ type: 'sparkle', x: cell.x, y: cell.y });
    }
    const [first] = spot.cells;
    this.emit({ type: 'lunge', id: p.id, x: p.x, y: p.y, targetX: first.x, targetY: first.y });
    this.message(mends ? { key: 'gangwayMended' } : { key: 'build', obj: spot.kind }, 'good');
    this.gainXp(xp, first.x, first.y);
    this.endTurn();
    return true;
  }

  /** Add a room to the hut the explorer is in. */
  addRoom(id: RoomId): boolean {
    const problem = this.roomProblem(id);
    if (problem) {
      this.message(problem, 'info');
      return false;
    }
    const hut = this.hutHere()!;
    const cost = this.roomCost(id);
    this.inventory.takeAll(cost);
    hut.rooms = [...(hut.rooms ?? []), id];
    const p = this.player;
    this.emit({ type: 'sparkle', x: p.x, y: p.y });
    this.message(hut.kind === 'crew_cabin' ? { key: 'roomBuilt', room: id, cabin: true } : { key: 'roomBuilt', room: id }, 'good');
    this.gainXp(Object.values(cost).reduce((sum, n) => sum + (n ?? 0), 0), p.x, p.y);
    this.endTurn();
    return true;
  }

  /** Drink from the rain barrel of the hut the explorer is in. */
  drinkBarrel(): boolean {
    if (!this.hasRoom('barrel')) {
      this.message({ key: 'notInHut' }, 'info');
      return false;
    }
    if (!this.drink(BARREL_DRINK, { key: 'drinkBarrel' })) return false;
    this.endTurn();
    return true;
  }

  /** True once after the explorer walked into a store crate: the UI then shows the Store panel. */
  takeStoreRequest(): boolean {
    const asked = this.storeAsked;
    this.storeAsked = false;
    return asked;
  }

  /** Put up to n of an item from the bag into the store crate next to the explorer. Takes no time. */
  storeItem(id: ItemId, n: number): boolean {
    const store = this.storeNear();
    const count = Math.min(n, this.inventory.count(id));
    if (!store || count <= 0) return false;
    this.inventory.take(id, count);
    store.store = { ...store.store, [id]: (store.store?.[id] ?? 0) + count };
    return true;
  }

  /** Take up to n of an item from the store crate into the bag, as much as the bag can carry. Takes no time. */
  takeItem(id: ItemId, n: number): boolean {
    const store = this.storeNear();
    const have = store?.store?.[id] ?? 0;
    if (!store || have <= 0) return false;
    const room = ITEMS[id].heavy ? this.loadLimit - this.load : Infinity;
    if (room <= 0) {
      this.tooHeavy();
      return false;
    }
    const count = Math.min(n, have, room);
    this.inventory.add(id, count);
    const left = have - count;
    const rest = { ...store.store };
    if (left > 0) rest[id] = left;
    else delete rest[id];
    store.store = rest;
    // An empty supply crate is folded up and gone.
    if (OBJECTS[store.kind].dropped && !Object.keys(rest).length) this.objects.delete(this.storeCell());
    return true;
  }

  // ---- The radio ---------------------------------------------------------------------

  /** True once after the explorer walked into the working radio: the UI then shows the Radio panel. */
  takeRadioRequest(): boolean {
    const asked = this.radioAsked;
    this.radioAsked = false;
    return asked;
  }

  /** The explorer stands at the working radio and has called for help: they can order crates. */
  get atRadio(): boolean {
    if (!this.sailed || this.level !== 4) return false;
    return DIRS.some(([dx, dy]) => this.objectAt(this.player.x + dx, this.player.y + dy)?.kind === 'radio_ready');
  }

  /**
   * Why nothing can be ordered now (not at the radio, a crate on its way),
   * or with an order, why that one cannot: its building is missing, a free
   * crate was ordered today, or the bag lacks its price.
   */
  orderProblem(id?: OrderId): Msg | null {
    if (!this.atRadio) return { key: 'noRadio' };
    if (this.delivery) return { key: 'onTheWay' };
    if (!id) return null;
    const { opensAfter, price } = ORDERS[id];
    if (opensAfter && !this.hasBuilt(opensAfter)) return { key: 'orderLocked', obj: opensAfter };
    if (!price && this.orderDay === dayNumber(this.turn)) return { key: 'orderedToday' };
    if (price && !this.inventory.hasAll(price)) return { key: 'needPrice' };
    return null;
  }

  /**
   * Order a crate on the radio: the helicopter drops it when the explorer
   * steps on the helipad. A special part is paid from the bag now; a free
   * crate counts as the order of the day. Takes no time.
   */
  order(id: OrderId): boolean {
    const problem = this.orderProblem(id);
    if (problem) {
      this.message(problem, 'info');
      return false;
    }
    const { price } = ORDERS[id];
    if (price) {
      this.inventory.takeAll(price);
      for (const [item, n] of Object.entries(price) as [ItemId, number][]) {
        this.emit({ type: 'float', x: this.player.x, y: this.player.y, amount: -n, what: { item }, tone: 'info' });
      }
    } else {
      this.orderDay = dayNumber(this.turn);
    }
    this.delivery = { order: id };
    this.message({ key: 'ordered', order: id }, 'good');
    return true;
  }

  /** Once the explorer is on the helipad, the helicopter drops the ordered crate on a free cell of it (the middle if it can). */
  private deliver(): void {
    if (!this.delivery || this.level !== 4 || this.map.tiles[this.map.idx(this.player.x, this.player.y)] !== Tile.Helipad) return;
    const pad: number[] = [];
    for (let i = 0; i < this.map.tiles.length; i++) {
      if (this.map.tiles[i] !== Tile.Helipad || this.objects.has(i)) continue;
      // Not on anyone's head.
      const someone = [this.player, ...this.animals, ...(this.dog ? [this.dog] : [])].some((a) => this.map.idx(a.x, a.y) === i);
      if (!someone) pad.push(i);
    }
    const middle = (i: number) => [1, -1, this.map.width, -this.map.width].every((d) => this.map.tiles[i + d] === Tile.Helipad);
    const at = pad.find(middle) ?? pad[0];
    if (at === undefined) return;
    this.objects.set(at, { kind: 'supply_crate', store: { ...ORDERS[this.delivery.order].contents } });
    const x = at % this.map.width;
    this.emit({ type: 'drop', x, y: (at - x) / this.map.width });
    this.emit({ type: 'sparkle', x, y: (at - x) / this.map.width });
    this.message({ key: 'delivered', order: this.delivery.order }, 'good');
    this.delivery = null;
  }

  /** True once after the explorer walked into a hut: the UI then shows its inside. */
  takeHutRequest(): boolean {
    const asked = this.hutAsked;
    this.hutAsked = false;
    return asked;
  }

  /**
   * Leave the island on the finished goal. The boat of island 1 takes the
   * explorer to the next island; on the last island play can go on here.
   */
  sail(): boolean {
    if (!this.goalUsed && this.goal().state !== 'ready') return false;
    this.emit({ type: 'fade' });
    if (this.goalUsed) return true;
    this.checkStars();
    this.message({ key: 'sailAway', level: this.level }, 'good');
    const next = nextLevel(this.level);
    if (!next) {
      this.sailed = true;
      return true;
    }
    this.left.add(this.level);
    // The boat of island 1 sails off with the explorer; the lit beacon and the balloon's stakes stay.
    const goal = this.goalCell();
    if (goal >= 0 && !OBJECTS[this.objects.get(goal)!.kind].done) this.objects.delete(goal);
    this.landOn(next);
    return true;
  }

  // ---- The fishing boat --------------------------------------------------------------

  /** The fishing boat next to the explorer, as its cell, or -1. */
  private boatCell(): number {
    for (const [dx, dy] of DIRS) {
      const x = this.player.x + dx;
      const y = this.player.y + dy;
      const obj = this.objectAt(x, y);
      if (obj && OBJECTS[obj.kind].boat) return this.map.idx(x, y);
    }
    return -1;
  }

  /** The explorer stands next to the fishing boat. */
  boatNear(): boolean {
    return this.boatCell() >= 0;
  }

  /** True once after the explorer walked into the fishing boat: the UI then shows the sea chart. */
  takeChartRequest(): boolean {
    const asked = this.chartAsked;
    this.chartAsked = false;
    return asked;
  }

  /** The islands the explorer has been to, besides this one. */
  visited(level: LevelId): boolean {
    return this.islands.has(level);
  }

  /** How many heavy things the hold can carry: more with each upgrade. */
  get holdLimit(): number {
    return HOLD_LOAD + this.holdUpgrades * HOLD_UPGRADE;
  }

  /** How many heavy things the hold carries. */
  get holdLoad(): number {
    return (Object.entries(this.hold) as [ItemId, number][]).reduce((sum, [id, n]) => sum + (ITEMS[id].heavy ? n : 0), 0);
  }

  /** Diesel for a trip: in the bag and in the hold. */
  get dieselAboard(): number {
    return this.inventory.count('diesel') + (this.hold.diesel ?? 0);
  }

  /** How long a boat trip takes, and the diesel it burns: less with the motor. */
  get voyageTurns(): number {
    return this.boatMotor ? MOTOR_VOYAGE_TURNS : VOYAGE_TURNS;
  }

  get voyageDiesel(): number {
    return this.boatMotor ? MOTOR_VOYAGE_DIESEL : VOYAGE_DIESEL;
  }

  /** Why the boat cannot sail to this island now, or null if it can. */
  voyageProblem(to: LevelId): Msg | null {
    if (!this.boatNear()) return { key: 'noBoat' };
    if (to === this.level) return { key: 'hereAlready' };
    if (this.dieselAboard < this.voyageDiesel) return { key: 'needDiesel', n: this.voyageDiesel };
    return null;
  }

  /**
   * Sail the fishing boat to another island (or back to the rig). The trip
   * burns diesel (from the hold first) and takes hours, and needs go down on
   * the way. The boat moors next to the explorer on arrival; its hold comes along.
   */
  voyage(to: LevelId): boolean {
    const problem = this.voyageProblem(to);
    if (problem) {
      this.message(problem, 'info');
      return false;
    }
    const diesel = this.voyageDiesel;
    const turns = this.voyageTurns;
    const fromHold = Math.min(diesel, this.hold.diesel ?? 0);
    this.takeFromHold('diesel', fromHold);
    this.inventory.take('diesel', diesel - fromHold);
    const dock = this.boatCell();
    this.objects.delete(dock);
    for (let i = 0; i < turns; i++) {
      this.turn++;
      tickNeeds(this.needs, {
        sleeping: false,
        shelter: 0.6,
        nearFire: false,
        daylight: this.daylight,
        thirst: this.has('small_sips') ? SMALL_SIPS : 1,
        hunger: this.has('small_appetite') ? SMALL_APPETITE : 1,
        chill: this.has('thick_skin') ? THICK_SKIN : 1,
        cold: 0,
        heat: 0,
        heal: 1,
      });
    }
    this.emit({ type: 'fade' });
    this.landOn(to, dock);
    this.message({ key: 'voyage', level: to, ...(this.boatMotor && { motor: true as const }) }, 'good');
    if (this.needs.health <= 0) this.faint();
    return true;
  }

  private takeFromHold(id: ItemId, n: number): void {
    const left = (this.hold[id] ?? 0) - n;
    const hold = { ...this.hold };
    if (left > 0) hold[id] = left;
    else delete hold[id];
    this.hold = hold;
  }

  /** Put up to n of an item from the bag into the boat's hold, as much as it carries. Takes no time. */
  loadItem(id: ItemId, n: number): boolean {
    const room = ITEMS[id].heavy ? this.holdLimit - this.holdLoad : Infinity;
    if (!this.boatNear() || this.inventory.count(id) <= 0) return false;
    if (room <= 0) {
      this.message({ key: 'holdFull' }, 'info');
      return false;
    }
    const count = Math.min(n, this.inventory.count(id), room);
    this.inventory.take(id, count);
    this.hold = { ...this.hold, [id]: (this.hold[id] ?? 0) + count };
    return true;
  }

  /** Take up to n of an item from the hold into the bag, as much as the bag can carry. Takes no time. */
  unloadItem(id: ItemId, n: number): boolean {
    const have = this.hold[id] ?? 0;
    if (!this.boatNear() || have <= 0) return false;
    const room = ITEMS[id].heavy ? this.loadLimit - this.load : Infinity;
    if (room <= 0) {
      this.tooHeavy();
      return false;
    }
    const count = Math.min(n, have, room);
    this.inventory.add(id, count);
    this.takeFromHold(id, count);
    return true;
  }

  /**
   * Put the fishing boat on a sea cell next to land, near (x, y), and the
   * explorer on that land: at `dock` if it is given and still free.
   */
  private moor(x: number, y: number, dock?: number): void {
    const free = (i: number) => this.map.tiles[i] === Tile.Water && !this.objects.has(i);
    let sea = dock !== undefined && free(dock) ? dock : -1;
    if (sea < 0) {
      // The nearest sea cell (no sandbar, no gangway) next to free floor.
      const dist = distanceMap(this.map, x, y, (cx, cy) => this.isPassable(cx, cy));
      let best = Infinity;
      for (let i = 0; i < this.map.tiles.length; i++) {
        if (!free(i)) continue;
        const cx = i % this.map.width;
        const cy = (i - cx) / this.map.width;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const d = dist[this.map.idx(cx + dx, cy + dy)];
          if (this.map.inBounds(cx + dx, cy + dy) && d >= 0 && d < best && !this.objectAt(cx + dx, cy + dy)) {
            best = d;
            sea = i;
          }
        }
      }
    }
    if (sea < 0) return;
    this.objects.set(sea, { kind: 'fishing_boat' });
    const sx = sea % this.map.width;
    const sy = (sea - sx) / this.map.width;
    const land = [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]
      .map(([dx, dy]) => ({ x: sx + dx, y: sy + dy }))
      .find((c) => this.isPassable(c.x, c.y) && !this.animalAt(c.x, c.y));
    if (land) {
      this.player.x = land.x;
      this.player.y = land.y;
    }
  }

  /**
   * Arrive on a new island with everything you carry, your XP and skills,
   * and your needs as they are, at 8:00 the next day.
   */
  private landOn(level: LevelId, dock?: number): void {
    // Keep the island the explorer leaves, as it is.
    this.islands.set(this.level, {
      level: this.level, map: this.map, objects: this.objects, home: this.home,
      goalGiven: this.goalGiven, bearSpots: this.bearSpots, fishHere: this.fishHere, ...(dock !== undefined && { dock }),
    });
    const kept = this.islands.get(level);
    this.islands.delete(level);
    this.level = level;
    if (kept) {
      this.map = kept.map;
      this.objects = kept.objects;
      this.home = kept.home;
      this.goalGiven = kept.goalGiven;
      this.bearSpots = kept.bearSpots;
      this.fishHere = kept.fishHere;
    } else {
      const world = generateWorld(this.rng, WORLD_WIDTH, WORLD_HEIGHT, level);
      this.map = world.map;
      this.objects = world.objects;
      this.home = { ...world.start };
      this.goalGiven = {};
      this.bearSpots = [];
      this.fishHere = 0;
    }
    this.player.x = this.home.x;
    this.player.y = this.home.y;
    this.player.facing = 'down';
    // By boat, the explorer lands where the boat moors (where it was left, if they were here before).
    if (dock !== undefined) this.moor(this.home.x, this.home.y, kept?.dock);
    this.stockIsland();
    this.placeStorage();
    this.sailAsked = false;
    if (dock === undefined) this.turn = Math.ceil((this.turn + 1) / TURNS_PER_DAY) * TURNS_PER_DAY;
    this.animals = [];
    this.safeSince = this.turn;
    this.dogToPlayer();
    this.populate();
    this.warned.clear();
    this.updateFov();
    if (dock === undefined) this.message({ key: 'landIsland', level }, 'good');
  }

  /** Fill a new island with its animals (no stray dog once you have one). */
  private populate(): void {
    for (const kind of this.islandAnimals()) {
      for (let n = 0; n < ANIMALS[kind].population; n++) this.spawnAnimal(kind, false);
    }
  }

  /** Spend skill points on a skill. Takes no time. */
  learn(id: SkillId): boolean {
    if (this.has(id)) return false;
    const problem = this.skillProblem(id);
    if (problem) {
      this.message(problem, 'info');
      return false;
    }
    this.skills.add(id);
    this.emit({ type: 'sparkle', x: this.player.x, y: this.player.y });
    this.message({ key: 'learn', skill: id }, 'good');
    return true;
  }

  /**
   * Sleep until rested. Shelter makes sleep quicker and keeps you warm;
   * sleeping in one also makes it home.
   */
  sleep(): boolean {
    if (this.needs.energy >= 95) {
      this.message({ key: 'notSleepy' }, 'info');
      return false;
    }
    const p = this.player;
    const cap = this.restCap(p.x, p.y);
    if (this.needs.energy >= cap) {
      this.message({ key: 'restLimit', cap }, 'info');
      return false;
    }
    const shelter = this.shelterAt(p.x, p.y);
    const obj = this.objectAt(p.x, p.y);
    if (shelter > 0) {
      this.home = { x: p.x, y: p.y };
      this.message({ key: 'fallAsleep', obj: obj?.kind }, 'info');
    } else {
      this.message({ key: 'dozeOff' }, 'info');
    }
    const keep = this.events.length;
    this.sleeping = true;
    if (this.dog) {
      // The dog comes over and lies down next to you for the night.
      this.dogToPlayer();
      this.dog.napping = true;
    }
    let reason: WakeReason = 'none';
    for (let i = 0; i < SLEEP_LIMIT && this.sleeping; i++) {
      this.endTurn();
      if (!this.sleeping) break; // fainted
      if (this.needs.energy >= cap && cap < 100) {
        // Away from the hut bed, sleep only goes so far.
        this.needs.energy = cap;
        reason = 'restless';
      } else if (this.needs.energy >= 100) reason = 'rested';
      else if (this.needs.warmth < 12) reason = 'cold';
      else if (this.needs.food <= 0) reason = 'hungry';
      else if (this.needs.water <= 0) reason = 'thirsty';
      if (reason !== 'none') break;
    }
    this.sleeping = false;
    // The UI only needs to show the night passing, not every animal step.
    this.events.length = keep;
    this.emit({ type: 'fade' });
    this.message({ key: 'wake', reason, turn: this.turn }, reason === 'cold' ? 'warn' : 'good');
    return true;
  }

  private islandAnimals(): AnimalKind[] {
    return islandAnimals(this.level).filter((kind) => !this.dog || ANIMALS[kind].temper !== 'stray');
  }

  // ---- Interactions ------------------------------------------------------------------

  private interact(x: number, y: number, obj: WorldObject): boolean {
    this.emit({ type: 'lunge', id: this.player.id, x: this.player.x, y: this.player.y, targetX: x, targetY: y });
    // A piece of a big object (the storage container) works like its main piece.
    if (OBJECTS[obj.kind].partOf) {
      const main = this.mainPiece(x, y);
      if (main) ({ x, y, obj } = main);
    }
    const def = OBJECTS[obj.kind];

    if (def.store) {
      this.storeAsked = true;
      this.message(obj.kind === 'storage_container_0' ? { key: 'openStore', container: true } : { key: 'openStore' }, 'info');
      return false;
    }
    if (def.site) return this.workOnSite(x, y, obj);
    if (def.drink) {
      const msg: Msg = obj.kind === 'hot_spring' ? { key: 'drink', warm: true } : obj.kind === 'water_tank' ? { key: 'drink', tank: true } : { key: 'drink' };
      return this.drink(def.drink, msg);
    }
    if (def.goal) {
      if (this.atRadio && obj.kind === 'radio_ready') {
        this.radioAsked = true;
        this.message({ key: 'openRadio' }, 'info');
        return false;
      }
      if (!this.left.has(this.level)) return this.workOnGoal(x, y, obj);
      this.message({ key: 'look', obj: obj.kind }, 'info');
      return false;
    }
    if (def.boat) {
      this.chartAsked = true;
      this.message({ key: 'openChart' }, 'info');
      return false;
    }
    if (def.broken) {
      this.message({ key: 'gangwayBroken' }, 'info');
      return false;
    }
    if (def.steep) {
      const recipe = RECIPE_IDS.map((id) => RECIPES[id]).find((r) => r.onto?.includes(obj.kind));
      const way = recipe && 'builds' in recipe ? recipe.builds : obj.kind;
      this.message({ key: 'tooSteep', obj: obj.kind, way }, 'info');
      return false;
    }

    const gather = def.gather;
    if (!gather) {
      this.message({ key: 'look', obj: obj.kind }, 'info');
      return false;
    }
    if (gather.needs && this.inventory.count(gather.needs) === 0) {
      this.message({ key: 'needTool', obj: obj.kind, item: gather.needs }, 'info');
      return false;
    }
    if (obj.readyAt !== undefined && obj.readyAt > this.turn) {
      this.message({ key: 'nothingLeft', obj: obj.kind }, 'info');
      return false;
    }
    // A full bag takes no more heavy things (one gather can still go a little over).
    const heavy = gather.yields.some((y) => ITEMS[y.item].heavy && (!y.tool || this.inventory.count(y.tool) > 0));
    if (heavy && this.load >= this.loadLimit) {
      this.tooHeavy();
      return false;
    }

    const got: [ItemId, number][] = [];
    let used: ItemId | undefined;
    let lack: { tool: ItemId; item: ItemId } | undefined;
    for (const y0 of gather.yields) {
      if (y0.tool && this.inventory.count(y0.tool) === 0) {
        // Tell the explorer what the tool would give, but not for more of what they already get.
        if (!lack && !gather.yields.some((o) => !o.tool && o.item === y0.item)) lack = { tool: y0.tool, item: y0.item };
        continue;
      }
      if (y0.tool) used = y0.tool;
      if (y0.chance !== undefined && !this.rng.chance(y0.chance)) continue;
      const n = this.rng.int(y0.min, y0.max);
      if (n <= 0) continue;
      const same = got.find(([item]) => item === y0.item);
      if (same) same[1] += n;
      else got.push([y0.item, n]);
    }
    for (const [item, n] of got) {
      this.inventory.add(item, n);
      this.emit({ type: 'float', x, y, amount: n, what: { item }, tone: 'loot' });
    }
    this.message({ key: 'gather', obj: obj.kind, got, ...(used && { used }), ...(lack && { lack }) }, 'loot');
    this.gainXp(GATHER_XP, x, y);

    const after = gather.after;
    if ('remove' in after) this.objects.delete(this.map.idx(x, y));
    else if ('becomes' in after) {
      obj.kind = after.becomes;
      this.emit({ type: 'sparkle', x, y });
    } else obj.readyAt = this.turn + Math.round(after.regrow * (this.has('green_thumb') ? GREEN_THUMB : 1));
    return true;
  }

  /**
   * Hand the goal everything its current stage still needs from the bag.
   * When the stage is complete the goal turns into its next form. Walking
   * into the finished goal asks to set sail instead.
   */
  private workOnGoal(x: number, y: number, obj: WorldObject): boolean {
    const def = levelDef(this.level);
    const done = goalProgress(def, obj.kind);
    if (done >= def.stages.length) {
      this.sailAsked = true;
      this.message({ key: 'goalReady', level: this.level }, 'good');
      return false;
    }
    const stage = def.stages[done];
    const given: [ItemId, number][] = [];
    for (const [item, still] of Object.entries(this.goalLeft(stage)) as [ItemId, number][]) {
      const n = Math.min(still, this.inventory.count(item));
      if (n <= 0) continue;
      this.inventory.take(item, n);
      this.goalGiven[item] = (this.goalGiven[item] ?? 0) + n;
      given.push([item, n]);
      this.emit({ type: 'float', x, y, amount: -n, what: { item }, tone: 'info' });
    }
    const left = Object.entries(this.goalLeft(stage)) as [ItemId, number][];
    if (!given.length) {
      this.message({ key: 'goalNeeds', stage: stage.id, left }, 'info');
      return false;
    }
    this.gainXp(given.reduce((sum, [, n]) => sum + n, 0), x, y);
    if (left.length) {
      this.message({ key: 'goalGive', stage: stage.id, given, left }, 'good');
      return true;
    }
    obj.kind = stage.becomes;
    this.goalGiven = {};
    this.emit({ type: 'sparkle', x, y });
    this.message({ key: 'goalStage', stage: stage.id }, 'good');
    return true;
  }

  /**
   * Hand a building site what it still needs from the bag. When it has
   * everything, it becomes its building (the hut).
   */
  private workOnSite(x: number, y: number, obj: WorldObject): boolean {
    const cost = this.siteCostOf(obj.kind);
    if (!cost) return false;
    const leftOf = () => (Object.entries(cost) as [ItemId, number][])
      .map(([item, n]): [ItemId, number] => [item, n - (obj.given?.[item] ?? 0)])
      .filter(([, n]) => n > 0);
    const given: [ItemId, number][] = [];
    for (const [item, still] of leftOf()) {
      const n = Math.min(still, this.inventory.count(item));
      if (n <= 0) continue;
      this.inventory.take(item, n);
      obj.given = { ...obj.given, [item]: (obj.given?.[item] ?? 0) + n };
      given.push([item, n]);
      this.emit({ type: 'float', x, y, amount: -n, what: { item }, tone: 'info' });
    }
    const left = leftOf();
    const site = obj.kind;
    if (!given.length) {
      this.message({ key: 'siteNeeds', obj: site, left }, 'info');
      return false;
    }
    this.gainXp(given.reduce((sum, [, n]) => sum + n, 0), x, y);
    if (left.length) {
      this.message({ key: 'siteGive', obj: site, given, left }, 'good');
      return true;
    }
    obj.kind = OBJECTS[site].site!;
    delete obj.given;
    this.emit({ type: 'sparkle', x, y });
    if (HABITAT.includes(obj.kind)) {
      this.message({ key: 'habitatBuilt', obj: obj.kind, built: this.habitatBuilt().length, of: HABITAT.length }, 'good');
    } else {
      this.message({ key: 'siteDone', obj: obj.kind }, 'good');
    }
    return true;
  }

  /** What a site of this kind takes in all: its own `siteCost`, or that of the recipe that builds it. */
  private siteCostOf(kind: ObjectKind): Items | null {
    const own = OBJECTS[kind].siteCost;
    if (own) return this.withSkills(own);
    const recipe = RECIPE_IDS.find((id) => {
      const r = RECIPES[id];
      return 'builds' in r && r.builds === kind && r.siteCost;
    });
    return recipe ? this.siteCost(recipe) : null;
  }

  /** What a building site still needs, or null if (x, y) is no site. */
  siteLeft(x: number, y: number): Items | null {
    const obj = this.objectAt(x, y);
    if (!obj || !OBJECTS[obj.kind].site) return null;
    const cost = this.siteCostOf(obj.kind);
    if (!cost) return null;
    const left: Items = {};
    for (const [item, n] of Object.entries(cost) as [ItemId, number][]) {
      const still = n - (obj.given?.[item] ?? 0);
      if (still > 0) left[item] = still;
    }
    return left;
  }

  /** Cast the fishing rod into the sea at (x, y). Always takes a turn. */
  private fish(x: number, y: number): void {
    const p = this.player;
    this.emit({ type: 'cast', id: p.id, x: p.x, y: p.y, targetX: x, targetY: y });
    if (!this.rng.chance(this.has('patient_angler') ? PATIENT_BITE_CHANCE : BITE_CHANCE)) {
      this.message({ key: 'noBite' }, 'info');
      return;
    }
    this.inventory.add('fish');
    this.fishHere++;
    this.emit({ type: 'float', x, y, amount: 1, what: { item: 'fish' }, tone: 'loot' });
    this.message({ key: 'catch' }, 'loot');
    this.gainXp(CATCH_XP, x, y);
  }

  /** Add experience, floating it at (x, y), and say so when it earns a skill point. */
  private gainXp(amount: number, x: number, y: number): void {
    if (amount <= 0) return;
    const before = pointsForXp(this.xp);
    this.xp += amount;
    this.emit({ type: 'float', x, y, amount, what: { xp: true }, tone: 'good' });
    if (pointsForXp(this.xp) > before) {
      this.emit({ type: 'sparkle', x: this.player.x, y: this.player.y });
      this.message({ key: 'skillPoint' }, 'good');
    }
  }

  private drink(amount: number, msg: Msg): boolean {
    if (this.needs.water >= 98) {
      this.message({ key: 'notThirsty' }, 'info');
      return false;
    }
    this.needs.water = Math.min(100, this.needs.water + amount);
    this.message(msg, 'good');
    this.emit({ type: 'float', x: this.player.x, y: this.player.y, amount, what: { need: 'water' }, tone: 'good' });
    const dog = this.dog;
    if (dog && Math.max(Math.abs(dog.x - this.player.x), Math.abs(dog.y - this.player.y)) <= DOG_DRINK_RANGE) this.dogDrinks();
    return true;
  }

  /**
   * The stray dog eats a snack from the bag and becomes your dog. Without
   * anything for it to eat it only sniffs your hand, and no time passes.
   */
  private adopt(a: Animal): boolean {
    const p = this.player;
    this.emit({ type: 'lunge', id: p.id, x: p.x, y: p.y, targetX: a.x, targetY: a.y });
    const [item] = this.dogFoods();
    if (!item) {
      this.message({ key: 'dogSniff' }, 'info');
      return false;
    }
    this.inventory.take(item);
    this.animals = this.animals.filter((other) => other !== a);
    this.dog = {
      id: a.id, x: a.x, y: a.y, facing: a.x > p.x ? 'left' : 'right',
      food: Math.min(100, DOG_START_FOOD + this.dogFoodValue(item)), water: DOG_START_WATER, tired: false,
    };
    this.emit({ type: 'sparkle', x: a.x, y: a.y });
    this.message({ key: 'dogAdopt', item }, 'good');
    return true;
  }

  private dogDrinks(): void {
    const dog = this.dog!;
    if (dog.water >= 98) return;
    dog.water = Math.min(100, dog.water + DOG_DRINK);
    this.emit({ type: 'float', x: dog.x, y: dog.y, amount: DOG_DRINK, what: { need: 'water' }, tone: 'good' });
    this.cheerUpDog();
  }

  /** A tired dog that has Food and Water again follows you properly. */
  private cheerUpDog(): void {
    const dog = this.dog!;
    if (!dog.tired || dog.food <= 0 || dog.water <= 0) return;
    dog.tired = false;
    this.message({ key: 'dogBack' }, 'good');
  }

  private shoo(a: Animal): void {
    const def = ANIMALS[a.kind];
    this.emit({ type: 'lunge', id: this.player.id, x: this.player.x, y: this.player.y, targetX: a.x, targetY: a.y });
    this.message({ key: 'shoo', animal: a.kind }, 'info');
    if (def.temper !== 'calm') a.flee = SHOO_TURNS;
    a.chase = 0;
  }

  /**
   * Where a new building goes: in front of the explorer if free, else the
   * nearest free neighbour. A bridge goes straight ahead across the river
   * instead, facing the way the explorer does. A way up a step (`onto`)
   * goes on such a step in front, else on the nearest one next to the explorer.
   * Mending a broken gangway fills the whole gap between its two broken ends.
   */
  private buildSpot(kind: ObjectKind, onto?: ObjectKind[]): { kind: ObjectKind; cells: { x: number; y: number }[] } | null {
    const p = this.player;
    const [fx, fy] = facingDelta(p.facing);
    if (OBJECTS[kind].deck) {
      const cell = this.deckSpot(fx, fy);
      return cell ? { kind, cells: [cell] } : null;
    }
    if (OBJECTS[kind].holdUpgrade || OBJECTS[kind].boatMotor) {
      const boat = this.boatCell();
      return boat < 0 ? null : { kind, cells: [{ x: boat % this.map.width, y: Math.floor(boat / this.map.width) }] };
    }
    if (OBJECTS[kind].onSea) {
      // On the sea in front of the explorer (else next to them), who stands on a deck.
      const here = this.map.get(p.x, p.y);
      if (here !== Tile.Deck && here !== Tile.Helipad) return null;
      const sea = [[fx, fy], [0, 1], [0, -1], [1, 0], [-1, 0]].find(([dx, dy]) => (dx === 0) !== (dy === 0) &&
        this.map.get(p.x + dx, p.y + dy) === Tile.Water && !this.objectAt(p.x + dx, p.y + dy) && !this.animalAt(p.x + dx, p.y + dy));
      return sea ? { kind, cells: [{ x: p.x + sea[0], y: p.y + sea[1] }] } : null;
    }
    if (OBJECTS[kind].bridge) {
      const lava = !!OBJECTS[kind].onLava;
      const cells = this.riverAhead(p.x, p.y, fx, fy, lava ? Tile.Lava : Tile.River);
      if (!cells) return null;
      const way: ObjectKind = lava ? (fx ? 'lava_stones_ew' : 'lava_stones_ns') : fx ? 'bridge_ew' : 'bridge_ns';
      return { kind: way, cells };
    }
    const order: (readonly [number, number])[] = [[fx, fy], ...DIRS.filter(([dx, dy]) => dx !== fx || dy !== fy)];
    if (onto) {
      const at = order.find(([dx, dy]) => {
        const obj = this.objectAt(p.x + dx, p.y + dy);
        return !!obj && onto.includes(obj.kind) && !this.animalAt(p.x + dx, p.y + dy);
      });
      if (!at) return null;
      const x = p.x + at[0];
      const y = p.y + at[1];
      const run = OBJECTS[this.objectAt(x, y)!.kind].broken;
      if (run) return { kind: run === 'ns' ? 'gangway_ns' : 'gangway_ew', cells: this.brokenRun(x, y, run) };
      return { kind, cells: [{ x, y }] };
    }
    for (const [dx, dy] of order) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (!this.map.isFloor(x, y) || this.objectAt(x, y) || this.animalAt(x, y) || this.dogAt(x, y)) continue;
      if (OBJECTS[kind].walkable) return { kind, cells: [{ x, y }] };
      // Solid buildings must not cut off part of the island.
      const i = this.map.idx(x, y);
      this.objects.set(i, { kind });
      const ok = this.allReachableFrom(p.x, p.y);
      this.objects.delete(i);
      if (ok) return { kind, cells: [{ x, y }] };
    }
    return null;
  }

  /**
   * Where a new platform cell goes: the sea cell in front of the explorer
   * (else next to them) that touches the deck of the crew platform, near the
   * crew cabin, away from gangways and from other platforms. So new decks
   * make room at the camp, but never a way past a broken gangway.
   */
  private deckSpot(fx: number, fy: number): { x: number; y: number } | null {
    const cabin = [...this.objects].find(([, o]) => o.kind === 'crew_cabin')?.[0];
    if (cabin === undefined) return null;
    const w = this.map.width;
    const cx = cabin % w;
    const cy = (cabin - cx) / w;
    const isDeck = (x: number, y: number) => {
      const t = this.map.get(x, y);
      return t === Tile.Deck || t === Tile.Helipad;
    };
    // The crew platform: every deck cell joined to the cabin's (not over gangways).
    const own = new Set([cabin]);
    const queue = [cabin];
    for (let head = 0; head < queue.length; head++) {
      const x = queue[head] % w;
      const y = (queue[head] - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = this.map.idx(x + dx, y + dy);
        if (this.map.inBounds(x + dx, y + dy) && isDeck(x + dx, y + dy) && !own.has(n)) {
          own.add(n);
          queue.push(n);
        }
      }
    }
    const ok = (x: number, y: number) => {
      if (this.map.get(x, y) !== Tile.Water || this.objectAt(x, y) || this.animalAt(x, y) || this.dogAt(x, y)) return false;
      if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) > PLATFORM_RANGE) return false;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => own.has(this.map.idx(x + dx, y + dy)))) return false;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const ox = x + dx;
          const oy = y + dy;
          if (!this.map.inBounds(ox, oy)) continue;
          const obj = this.objectAt(ox, oy);
          if (Math.max(Math.abs(dx), Math.abs(dy)) <= 1 && obj && (OBJECTS[obj.kind].overSea || OBJECTS[obj.kind].broken)) return false;
          if (isDeck(ox, oy) && !own.has(this.map.idx(ox, oy))) return false;
        }
      }
      return true;
    };
    const p = this.player;
    const order: (readonly [number, number])[] = [[fx, fy], ...DIRS.filter(([dx, dy]) => dx !== fx || dy !== fy)];
    const at = order.find(([dx, dy]) => ok(p.x + dx, p.y + dy));
    return at ? { x: p.x + at[0], y: p.y + at[1] } : null;
  }

  /** The broken gangway ends in a row with (x, y), along the way the gangway runs. */
  private brokenRun(x: number, y: number, run: 'ns' | 'ew'): { x: number; y: number }[] {
    const [dx, dy] = run === 'ns' ? [0, 1] : [1, 0];
    const broken = (cx: number, cy: number) => {
      const obj = this.objectAt(cx, cy);
      return !!obj && OBJECTS[obj.kind].broken === run;
    };
    let sx = x;
    let sy = y;
    while (broken(sx - dx, sy - dy)) {
      sx -= dx;
      sy -= dy;
    }
    const cells: { x: number; y: number }[] = [];
    for (let cx = sx, cy = sy; broken(cx, cy); cx += dx, cy += dy) cells.push({ x: cx, y: cy });
    return cells;
  }

  /** The open river (or lava, `flow`) cells straight ahead, if they end on free ground within a bridge's span. */
  private riverAhead(x: number, y: number, dx: number, dy: number, flow: Tile): { x: number; y: number }[] | null {
    const cells: { x: number; y: number }[] = [];
    for (let k = 1; k <= BRIDGE_SPAN + 1; k++) {
      const cx = x + dx * k;
      const cy = y + dy * k;
      if (this.map.get(cx, cy) === flow && !this.objectAt(cx, cy)) {
        cells.push({ x: cx, y: cy });
        continue;
      }
      return cells.length && this.isPassable(cx, cy) ? cells : null;
    }
    return null;
  }

  /**
   * Whether everything the explorer could get to now (counting brambles to
   * clear, steps to climb and rivers to bridge) is still reachable.
   */
  private allReachableFrom(sx: number, sy: number): boolean {
    const open = (x: number, y: number) => {
      const obj = this.objectAt(x, y);
      return this.isPassable(x, y) || (!!obj && canBeOpened(obj.kind));
    };
    const isRiver = (x: number, y: number) => this.map.isFlow(x, y) && !this.objectAt(x, y);
    const reach = reachWithBridges(this.map, sx, sy, open, isRiver);
    for (let i = 0; i < this.map.tiles.length; i++) {
      const x = i % this.map.width;
      const y = (i - x) / this.map.width;
      if (open(x, y) && !reach[i]) return false;
    }
    return true;
  }

  // ---- The rest of the turn ----------------------------------------------------------

  private endTurn(): void {
    this.turn++;
    const p = this.player;
    this.tide();
    tickNeeds(this.needs, {
      sleeping: this.sleeping,
      shelter: this.shelterAt(p.x, p.y),
      nearFire: this.nearFire(p.x, p.y),
      daylight: this.daylight,
      thirst: this.has('small_sips') ? SMALL_SIPS : 1,
      hunger: this.has('small_appetite') ? SMALL_APPETITE : 1,
      chill: this.has('thick_skin') ? THICK_SKIN : 1,
      cold: this.map.get(p.x, p.y) === Tile.Snow ? SNOW_CHILL : 0,
      heat: this.map.get(p.x, p.y) === Tile.Ash ? ASH_HEAT * this.daylight : 0,
      heal: !this.hutHere() ? 1 : this.hasRoom('hearth') ? HEARTH_HEAL : BED_HEAL,
    });
    if (!this.sleeping) this.warnAboutNeeds();

    this.animalsActing = true;
    const playerDist = distanceMap(this.map, p.x, p.y, (x, y) => this.isPassable(x, y));
    if (this.dog) this.dogAct(this.dog, playerDist);
    for (const a of this.animals) this.animalAct(a, playerDist);
    this.animalsActing = false;
    if (this.turn % RESPAWN_EVERY === 0) this.topUpAnimals();
    this.deliver();

    if (this.needs.health <= 0) this.faint();
    const goal = this.goalCell();
    const known = goal >= 0 && this.map.explored[goal] === 1;
    this.updateFov();
    if (goal >= 0 && !known && this.map.explored[goal]) this.message({ key: 'goalFound', obj: this.objects.get(goal)!.kind }, 'good');
    this.checkStars();
  }

  /**
   * The tide turns: say so once the explorer knows the sandbar. When the
   * water comes in over the sandbar, the explorer wades to the nearest dry
   * land, wet and colder. Nothing worse happens.
   */
  private tide(): void {
    const low = this.lowTide;
    if (low === isLowTide(this.turn - 1)) return;
    if (!this.sleeping && this.tideKnown()) this.message({ key: low ? 'tideOut' : 'tideIn' }, 'info');
    if (low) return;
    const p = this.player;
    const bar = new Set(this.sandbarCells());
    const onBar = (x: number, y: number) => bar.has(this.map.idx(x, y));
    if (onBar(p.x, p.y)) {
      const shore = this.nearestShore(p.x, p.y, bar);
      if (shore) {
        this.emit({ type: 'move', id: p.id, fromX: p.x, fromY: p.y, toX: shore.x, toY: shore.y });
        p.x = shore.x;
        p.y = shore.y;
      }
      this.needs.warmth = Math.max(0, this.needs.warmth - WADE_CHILL);
      this.emit({ type: 'float', x: p.x, y: p.y, amount: -WADE_CHILL, what: { need: 'warmth' }, tone: 'warn' });
      this.message({ key: 'tideWade' }, 'warn');
    }
    if (this.dog && onBar(this.dog.x, this.dog.y)) this.dogToPlayer();
  }

  /** The nearest dry cell along the sandbar from (x, y). */
  private nearestShore(x: number, y: number, bar: Set<number>): { x: number; y: number } | null {
    const start = this.map.idx(x, y);
    const seen = new Set([start]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      const cx = cur % this.map.width;
      const cy = (cur - cx) / this.map.width;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!this.map.inBounds(nx, ny)) continue;
        const n = this.map.idx(nx, ny);
        if (seen.has(n)) continue;
        seen.add(n);
        if (bar.has(n)) queue.push(n);
        else if (this.isPassable(nx, ny) && !this.animalAt(nx, ny)) return { x: nx, y: ny };
      }
    }
    return null;
  }

  // ---- Island stars -----------------------------------------------------------------

  hasStar(id: StarId, level: LevelId = this.level): boolean {
    return this.stars.some(([l, s]) => l === level && s === id);
  }

  /** The stars of this island, with how far along each one is. */
  starStates(): StarState[] {
    return levelDef(this.level).stars.map((id) => {
      const { have, need } = this.starProgress(id);
      return { id, done: this.hasStar(id), have, need };
    });
  }

  private starProgress(id: StarId): { have: number; need: number } {
    switch (id) {
      case 'chests': {
        let open = 0;
        let all = 0;
        for (const obj of this.objects.values()) {
          if (obj.kind === 'chest_open') open++;
          if (obj.kind === 'chest_open' || obj.kind === 'chest_closed') all++;
        }
        return { have: open, need: all };
      }
      case 'fish':
        return { have: Math.min(this.fishHere, STAR_FISH), need: STAR_FISH };
      case 'explore': {
        let floor = 0;
        let seen = 0;
        for (let i = 0; i < this.map.tiles.length; i++) {
          const x = i % this.map.width;
          if (!this.map.isFloor(x, (i - x) / this.map.width)) continue;
          floor++;
          if (this.map.explored[i]) seen++;
        }
        const need = Math.round(STAR_EXPLORE * 100);
        return { have: Math.min(need, Math.floor((seen / Math.max(1, floor)) * 100)), need };
      }
      case 'safe':
        return { have: Math.min(STAR_SAFE_DAYS, Math.floor((this.turn - this.safeSince) / TURNS_PER_DAY)), need: STAR_SAFE_DAYS };
    }
  }

  /** Award every star of this island whose task is done: a sparkle, a log line and some XP. */
  private checkStars(): void {
    for (const id of levelDef(this.level).stars) {
      if (this.hasStar(id)) continue;
      const { have, need } = this.starProgress(id);
      if (need <= 0 || have < need) continue;
      this.stars.push([this.level, id]);
      this.emit({ type: 'sparkle', x: this.player.x, y: this.player.y });
      this.message({ key: 'star', star: id }, 'good');
      this.gainXp(STAR_XP, this.player.x, this.player.y);
    }
  }

  private warnAboutNeeds(): void {
    for (const need of WARN_NEEDS) {
      if (this.needs[need] < LOW && !this.warned.has(need)) {
        this.warned.add(need);
        this.message({ key: 'low', need, level: this.level }, 'warn');
      } else if (this.needs[need] >= LOW + 10) {
        this.warned.delete(need);
      }
    }
  }

  /** Nobody dies here: the explorer faints and wakes up at home the next morning. */
  private faint(): void {
    this.sleeping = false;
    const empty = WARN_NEEDS.filter((need) => this.needs[need] <= 0);
    this.message({ key: 'faint' }, 'warn');
    this.turn += turnsUntilMorning(this.turn) || TURNS_PER_DAY;
    const n = this.needs;
    this.needs = {
      health: 50,
      food: Math.max(n.food, 25),
      water: Math.max(n.water, 30),
      energy: 70,
      warmth: 80,
    };
    this.animals = this.animals.filter((a) => a.x !== this.home.x || a.y !== this.home.y);
    this.player.x = this.home.x;
    this.player.y = this.home.y;
    this.safeSince = this.turn;
    this.dogToPlayer();
    this.warned.clear();
    this.emit({ type: 'fade' });
    this.message({ key: 'wakeAtCamp' }, 'good');
    this.message({ key: 'faintWhy', empty }, 'warn');
  }

  // ---- The dog ----------------------------------------------------------------------

  /**
   * The dog's turn: it gets hungrier and thirstier, drinks when it stands by
   * fresh water, follows you, and barks small nuisance animals away. A tired
   * dog (Food or Water at 0) only trails behind every other turn and doesn't
   * bark. Nothing worse happens to it.
   */
  private dogAct(dog: Dog, playerDist: Int32Array): void {
    const p = this.player;
    const slow = this.sleeping ? 0.5 : 1;
    const before = { food: dog.food, water: dog.water };
    dog.food = Math.max(0, dog.food - DOG_HUNGER * slow);
    dog.water = Math.max(0, dog.water - DOG_THIRST * slow);
    for (const need of ['food', 'water'] as const) {
      if (before[need] >= LOW && dog[need] < LOW) this.message({ key: 'dogLow', need }, 'warn');
    }
    if (!dog.tired && (dog.food <= 0 || dog.water <= 0)) {
      dog.tired = true;
      this.message({ key: 'dogTired' }, 'warn');
    }
    if (this.sleeping) return;
    dog.napping = false;

    const byWater = DIRS.some(([dx, dy]) => {
      const obj = this.objectAt(dog.x + dx, dog.y + dy);
      return this.map.get(dog.x + dx, dog.y + dy) === Tile.River || (!!obj && !!OBJECTS[obj.kind].drink);
    });
    if (byWater && dog.water < 80) this.dogDrinks();

    const dist = Math.max(Math.abs(dog.x - p.x), Math.abs(dog.y - p.y));
    if (dist > DOG_LOST) this.dogToPlayer();
    else if (dist > (dog.tired ? 2 : 1) && (!dog.tired || this.turn % 2 === 0)) this.dogStep(dog, playerDist);
    if (dog.tired) return;

    const scared = this.animals.find(
      (a) => ANIMALS[a.kind].scaredByDog && !a.flee && this.map.isVisible(a.x, a.y) &&
        Math.max(Math.abs(a.x - dog.x), Math.abs(a.y - dog.y)) <= DOG_BARK_RANGE,
    );
    if (!scared) return;
    this.turnDog(dog, scared.x - dog.x);
    this.emit({ type: 'lunge', id: dog.id, x: dog.x, y: dog.y, targetX: scared.x, targetY: scared.y });
    this.message({ key: 'dogBark', animal: scared.kind }, 'good');
    // One bark sends off every small nuisance close by.
    for (const a of this.animals) {
      if (ANIMALS[a.kind].scaredByDog && Math.max(Math.abs(a.x - dog.x), Math.abs(a.y - dog.y)) <= DOG_BARK_RANGE) {
        a.flee = SHOO_TURNS;
        a.chase = 0;
      }
    }
  }

  /** The dog's sprite only looks left or right: it keeps its side when it moves straight up or down. */
  private turnDog(dog: Dog, dx: number): void {
    if (dx) dog.facing = dx < 0 ? 'left' : 'right';
  }

  private dogCanStand(x: number, y: number): boolean {
    return this.isPassable(x, y) && !this.animalAt(x, y) && !(x === this.player.x && y === this.player.y);
  }

  /** One step along the shortest way to the explorer. */
  private dogStep(dog: Dog, playerDist: Int32Array): void {
    let best: [number, number] | null = null;
    let bestDist = playerDist[this.map.idx(dog.x, dog.y)];
    for (const [dx, dy] of DIRS) {
      const nx = dog.x + dx;
      const ny = dog.y + dy;
      if (!this.map.inBounds(nx, ny)) continue;
      const d = playerDist[this.map.idx(nx, ny)];
      if (d >= 0 && (bestDist < 0 || d < bestDist) && this.dogCanStand(nx, ny)) {
        best = [nx, ny];
        bestDist = d;
      }
    }
    if (!best) return;
    this.turnDog(dog, best[0] - dog.x);
    this.emit({ type: 'move', id: dog.id, fromX: dog.x, fromY: dog.y, toX: best[0], toY: best[1] });
    [dog.x, dog.y] = best;
  }

  /** Put the dog next to the explorer (after fainting, or on a new island). */
  private dogToPlayer(): void {
    const dog = this.dog;
    if (!dog) return;
    const p = this.player;
    const spot = DIRS.find(([dx, dy]) => this.dogCanStand(p.x + dx, p.y + dy));
    if (!spot) return;
    dog.x = p.x + spot[0];
    dog.y = p.y + spot[1];
  }

  // ---- Animals ----------------------------------------------------------------------

  /**
   * How close the explorer must be before an animal reacts. Wild animals
   * notice an Animal friend later; 0 means it never reacts.
   */
  noticeRange(kind: AnimalKind): number {
    const def = ANIMALS[kind];
    if (def.notice <= 0 || !this.has('animal_friend')) return def.notice;
    return def.wild ? Math.max(1, def.notice - FRIEND_NOTICE_LESS) : def.notice;
  }

  /**
   * Cells where a visible animal would come after the explorer or hurt them,
   * for the Wild sense skill. Empty without the skill.
   */
  dangerCells(): Set<number> {
    const cells = new Set<number>();
    if (!this.has('wild_sense')) return cells;
    const friendly = this.has('animal_friend');
    for (const a of this.visibleAnimals()) {
      const def = ANIMALS[a.kind];
      if ((friendly && !def.wild) || this.asleep(a)) continue;
      const notice = this.noticeRange(a.kind);
      // A prowling bear comes after you as far as it notices you.
      const comes = def.temper === 'charger' || def.temper === 'chaser' || !!def.nocturnal;
      const r = comes ? notice : def.temper === 'grumpy' ? Math.min(1, notice) : -1;
      for (let y = a.y - r; y <= a.y + r; y++) {
        for (let x = a.x - r; x <= a.x + r; x++) {
          if (this.map.isFloor(x, y)) cells.add(this.map.idx(x, y));
        }
      }
    }
    return cells;
  }

  private animalAct(a: Animal, playerDist: Int32Array): void {
    const def = ANIMALS[a.kind];
    const p = this.player;
    const dist = () => Math.max(Math.abs(a.x - p.x), Math.abs(a.y - p.y));
    if (a.flee > 0) {
      a.flee--;
      this.stepAway(a);
      return;
    }
    if (this.asleep(a)) return;
    const notice = this.noticeRange(a.kind);
    const noticed = notice > 0 && dist() <= notice && this.map.isVisible(a.x, a.y);
    // Animal friends get no trouble from crabs and monkeys. Wild animals
    // still come for them, but notice them later (see noticeRange).
    const friendly = this.has('animal_friend') && !def.wild;
    if (this.sleeping) a.chase = 0;
    if (a.chase && !this.sleeping) {
      // Wasps and prowling bears keep following, as long as the explorer stays on their ground.
      a.chase--;
      if (def.habitat.includes(this.map.get(p.x, p.y)) && this.isPassable(p.x, p.y) && !this.objectAt(p.x, p.y)) {
        if (dist() > 1) this.stepToward(a, playerDist);
        const chance = def.hitChance ?? HIT_CHANCE;
        if (dist() <= 1 && (chance >= 1 || this.rng.chance(chance))) {
          this.hurt(a);
          // A bear swipes once and then leaves you be; wasps keep stinging.
          if (def.temper !== 'chaser') a.chase = 0;
        }
        if (!a.chase) a.flee = def.fleeAfter ?? FLEE_AFTER_HIT;
      } else {
        a.chase = 0;
        a.flee = def.fleeAfter ?? FLEE_AFTER_HIT;
      }
      return;
    }
    if (noticed && !this.sleeping) {
      switch (def.temper) {
        case 'shy':
          this.stepAway(a);
          return;
        case 'grumpy':
          if (!friendly && dist() <= 1 && this.rng.chance(def.hitChance ?? HIT_CHANCE)) {
            this.hurt(a);
            a.flee = def.fleeAfter ?? FLEE_AFTER_HIT;
            return;
          }
          if (def.nocturnal && dist() > 1) {
            // Awake at night, a cave bear lumbers after you for a few turns.
            this.message({ key: 'alert', animal: a.kind }, 'warn');
            a.chase = PROWL_TURNS;
            this.stepToward(a, playerDist);
            return;
          }
          break;
        case 'charger':
          if (dist() > 1) {
            this.message({ key: 'alert', animal: a.kind }, 'warn');
            for (let n = 0; n < CHARGE_STEPS && dist() > 1; n++) this.stepToward(a, playerDist);
          } else if (this.rng.chance(def.hitChance ?? HIT_CHANCE)) {
            this.hurt(a);
            a.flee = def.fleeAfter ?? FLEE_AFTER_HIT;
          }
          return;
        case 'chaser':
          this.message({ key: 'alert', animal: a.kind }, 'warn');
          a.chase = CHASE_TURNS;
          if (dist() > 1) this.stepToward(a, playerDist);
          return;
        case 'cheeky': {
          // Food you carry for the goal is safe; only spare food tempts a monkey.
          const keep = this.goalStillNeeds();
          const foods = this.inventory.foods().filter((id) => this.inventory.count(id) > (keep[id] ?? 0));
          if (friendly || !foods.length) break;
          if (dist() <= 1) {
            const item = this.rng.pick(foods);
            this.inventory.take(item);
            this.emit({ type: 'lunge', id: a.id, x: a.x, y: a.y, targetX: p.x, targetY: p.y });
            this.emit({ type: 'float', x: p.x, y: p.y, amount: -1, what: { item }, tone: 'warn' });
            this.message({ key: 'snatch', animal: a.kind, item }, 'warn');
            a.flee = 12;
          } else {
            this.stepToward(a, playerDist);
          }
          return;
        }
        case 'calm':
        case 'stray':
          break;
      }
    }
    if (this.rng.chance(def.wander)) {
      const [dx, dy] = this.rng.pick(DIRS);
      this.tryStep(a, a.x + dx, a.y + dy);
    }
  }

  /** The animal pinches, bites, stings or bumps the explorer. */
  private hurt(a: Animal): void {
    const p = this.player;
    const damage = ANIMALS[a.kind].damage ?? 0;
    this.emit({ type: 'lunge', id: a.id, x: a.x, y: a.y, targetX: p.x, targetY: p.y });
    this.needs.health = Math.max(0, this.needs.health - damage);
    this.emit({ type: 'hit', id: p.id, x: p.x, y: p.y, damage });
    this.message(a.kind === 'crab' ? { key: 'pinch', animal: a.kind } : { key: 'hurt', animal: a.kind }, 'warn');
  }

  private canStand(a: Animal, x: number, y: number): boolean {
    const obj = this.objectAt(x, y);
    // Climbers (the mountain goat) jump up and down steep steps, with or without a ladder.
    const climbs = !!obj && !!ANIMALS[a.kind].climber && !!(OBJECTS[obj.kind].steep || OBJECTS[obj.kind].climb);
    return (
      (climbs || (this.isPassable(x, y) && !obj)) &&
      ANIMALS[a.kind].habitat.includes(this.map.get(x, y)) &&
      !this.animalAt(x, y) &&
      !this.dogAt(x, y) &&
      !(x === this.player.x && y === this.player.y)
    );
  }

  private tryStep(a: Animal, x: number, y: number): boolean {
    if (!this.canStand(a, x, y)) return false;
    // Animal sprites only look left or right: they keep their side when they move straight up or down.
    if (x !== a.x) a.facing = x < a.x ? 'left' : 'right';
    this.emit({ type: 'move', id: a.id, fromX: a.x, fromY: a.y, toX: x, toY: y });
    a.x = x;
    a.y = y;
    return true;
  }

  private stepAway(a: Animal): void {
    const p = this.player;
    const far = (x: number, y: number) => Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) * 10 + Math.abs(x - p.x) + Math.abs(y - p.y);
    let best: [number, number] | null = null;
    let bestScore = far(a.x, a.y);
    for (const [dx, dy] of DIRS) {
      const score = far(a.x + dx, a.y + dy);
      if (score > bestScore && this.canStand(a, a.x + dx, a.y + dy)) {
        best = [a.x + dx, a.y + dy];
        bestScore = score;
      }
    }
    if (best) this.tryStep(a, best[0], best[1]);
  }

  private stepToward(a: Animal, playerDist: Int32Array): void {
    if (ANIMALS[a.kind].climber) playerDist = this.climberDist();
    let best: [number, number] | null = null;
    let bestDist = playerDist[this.map.idx(a.x, a.y)];
    for (const [dx, dy] of DIRS) {
      const nx = a.x + dx;
      const ny = a.y + dy;
      if (!this.map.inBounds(nx, ny)) continue;
      const d = playerDist[this.map.idx(nx, ny)];
      if (d >= 0 && (bestDist < 0 || d < bestDist) && this.canStand(a, nx, ny)) {
        best = [nx, ny];
        bestDist = d;
      }
    }
    if (best) this.tryStep(a, best[0], best[1]);
  }

  /** Distances to the explorer for climbers: over steep steps too. Made once a turn, when needed. */
  private climberDist(): Int32Array {
    if (this.climbDist?.turn !== this.turn) {
      const p = this.player;
      const over = (x: number, y: number) => {
        const obj = this.objectAt(x, y);
        return this.isPassable(x, y) || (!!obj && !!OBJECTS[obj.kind].steep);
      };
      this.climbDist = { turn: this.turn, dist: distanceMap(this.map, p.x, p.y, over) };
    }
    return this.climbDist.dist;
  }

  private spawnAnimal(kind: AnimalKind, outOfSight: boolean): void {
    const def = ANIMALS[kind];
    const p = this.player;
    for (let tries = 0; tries < 200; tries++) {
      const x = this.rng.int(0, this.map.width - 1);
      const y = this.rng.int(0, this.map.height - 1);
      if (!def.habitat.includes(this.map.get(x, y)) || this.objectAt(x, y) || this.animalAt(x, y) || this.dogAt(x, y)) continue;
      if (Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) < 8) continue;
      if (def.minHomeDistance && Math.max(Math.abs(x - this.home.x), Math.abs(y - this.home.y)) < def.minHomeDistance) continue;
      if (outOfSight && this.map.isVisible(x, y)) continue;
      this.animals.push({ id: this.nextId++, kind, x, y, facing: 'down', flee: 0 });
      return;
    }
  }

  /** Animals that wandered off are replaced, out of sight, over time. */
  private topUpAnimals(): void {
    for (const kind of this.islandAnimals()) {
      if (this.animals.filter((a) => a.kind === kind).length < ANIMALS[kind].population) this.spawnAnimal(kind, true);
    }
  }

  // ---- Sight, messages, saving ---------------------------------------------------------

  private updateFov(): void {
    const map = this.map;
    map.visible.fill(0);
    computeFov(
      this.player.x,
      this.player.y,
      this.sightRadius,
      (x, y) => {
        if (map.isOpaque(x, y)) return true;
        const obj = this.objectAt(x, y);
        return obj !== undefined && !!OBJECTS[obj.kind].blocksSight;
      },
      (x, y) => {
        if (!map.inBounds(x, y)) return;
        const i = map.idx(x, y);
        map.visible[i] = 1;
        map.explored[i] = 1;
      },
    );
    // Remember where cave bears live, for the map.
    for (const a of this.animals) {
      if (a.kind !== 'bear' || !map.isVisible(a.x, a.y)) continue;
      const near = this.bearSpots.some((i) => Math.hypot((i % map.width) - a.x, Math.floor(i / map.width) - a.y) <= BEAR_SPOT_GAP);
      if (!near) this.bearSpots.push(map.idx(a.x, a.y));
    }
  }

  private emit(event: EventData): void {
    this.events.push({ ...event, late: this.animalsActing } as GameEvent);
  }

  private message(msg: Msg, tone: Tone): void {
    // Bumping the same thing again shouldn't fill the log with copies.
    const last = this.log.at(-1);
    if (last && JSON.stringify(last.msg) === JSON.stringify(msg)) return;
    this.log.push({ msg, tone });
    if (this.log.length > LOG_LIMIT) this.log.shift();
  }

  /** Night falls / morning comes: flag for the UI to mention it. */
  get isNight(): boolean {
    return isNight(this.turn);
  }

  toSave(): SaveData {
    return {
      v: SAVE_VERSION,
      seed: this.seed,
      rng: this.rng.state32,
      turn: this.turn,
      nextId: this.nextId,
      ...saveMap(this.map),
      objects: saveObjects(this.objects),
      animals: this.animals.map((a) => ({ ...a })),
      player: { ...this.player },
      home: { ...this.home },
      needs: { ...this.needs },
      inventory: this.inventory.toJSON(),
      xp: this.xp,
      skills: [...this.skills],
      level: this.level,
      goalGiven: { ...this.goalGiven },
      sailed: this.sailed,
      dog: this.dog && { ...this.dog },
      bearSpots: [...this.bearSpots],
      stars: this.stars.map(([level, star]) => [level, star]),
      fishHere: this.fishHere,
      safeSince: this.safeSince,
      warned: [...this.warned],
      log: this.log.slice(-30),
      islands: [...this.islands.values()].map((island) => ({
        level: island.level,
        ...saveMap(island.map),
        objects: saveObjects(island.objects),
        home: { ...island.home },
        goalGiven: { ...island.goalGiven },
        bearSpots: [...island.bearSpots],
        fishHere: island.fishHere,
        ...(island.dock !== undefined && { dock: island.dock }),
      })),
      left: [...this.left],
      hold: { ...this.hold },
      delivery: this.delivery && { ...this.delivery },
      orderDay: this.orderDay,
      holdUpgrades: this.holdUpgrades,
      boatMotor: this.boatMotor,
      stocked: [...this.stocked],
    };
  }

  static fromSave(data: SaveData): Game {
    if (data.v === 1) {
      // Version 1 kept log lines as English text. Everything else is the same.
      const old = data.log as unknown as { text: string; tone: Tone }[];
      data = { ...data, v: 2, log: old.map(({ text, tone }) => ({ msg: { key: 'legacy', text }, tone })) };
    }
    if (data.v === 2) {
      // Version 2 had no experience or skills yet.
      data = { ...data, v: 3, xp: 0, skills: [] };
    }
    if (data.v === 3) {
      // Version 3 had no island goal. Its island has no boat either (goal() says 'missing').
      data = { ...data, v: 4, level: 1, goalGiven: {}, sailed: false };
    }
    if (data.v === 4) {
      // Version 4 had only one island: sailing ended the game. Now the finished
      // boat takes you to island 2, so walking into it asks to set sail again.
      data = { ...data, v: 5, sailed: false };
    }
    if (data.v === 5) {
      // Version 5 had no dog yet.
      data = { ...data, v: 6, dog: null };
    }
    if (data.v === 6) {
      // Version 6 did not remember where the explorer saw cave bears.
      data = { ...data, v: 7, bearSpots: [] };
    }
    if (data.v === 7) {
      // Version 7 had no island stars. The days without fainting count from now.
      data = { ...data, v: 8, stars: [], fishHere: 0, safeSince: data.turn };
    }
    if (data.v === 8) {
      // Version 8 huts had no rooms. Their objects need no change: a hut gets its bed for free.
      data = { ...data, v: 9 };
    }
    if (data.v === 9) {
      // Version 9 had no store crates and no building sites. A bag over the
      // carry limit keeps everything; only gathering heavy things waits.
      data = { ...data, v: 10 };
    }
    if (data.v === 10) {
      // Version 10 kept only the island the explorer is on. The islands before
      // it are new when the explorer sails back to them; their goals are used.
      const left = ([1, 2, 3] as LevelId[]).filter((l) => l < data.level);
      data = { ...data, v: 11, islands: [], left, hold: {} };
    }
    if (data.v === 11) {
      // Version 11 had no radio orders.
      data = { ...data, v: 12, delivery: null, orderDay: 0 };
    }
    if (data.v === 12) {
      // Version 12 had no rig workshop. Each island gets its new resources when the explorer is there.
      data = { ...data, v: 13, holdUpgrades: 0, stocked: [] };
    }
    if (data.v === 13) {
      // Version 13 had no rig habitat: the boat has no motor yet.
      data = { ...data, v: SAVE_VERSION, boatMotor: false };
    }
    if (data.v !== SAVE_VERSION) throw new Error(`Unsupported save version ${data.v}`);
    return new Game(data.seed, data);
  }
}

