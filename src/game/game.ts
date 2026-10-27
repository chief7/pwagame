import { facingDelta, facingFor, PLAYER_ID, type Animal, type Dog, type Player } from './actors';
import { daylight, isLowTide, isNight, nextLowTide, phase, turnsUntilMorning, TURNS_PER_DAY } from './clock';
import { ANIMALS, islandAnimals, type AnimalKind } from './defs/animals';
import { ITEMS, type ItemId } from './defs/items';
import { goalProgress, levelDef, nextLevel, type GoalStage, type LevelId, type StarId } from './defs/levels';
import { canBeOpened, OBJECTS, type ObjectKind, type WorldObject } from './defs/objects';
import { RECIPE_IDS, RECIPES, type RecipeId } from './defs/recipes';
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
/** How much colder it is out in the open on snow, day and night (see warmthTarget). */
const SNOW_CHILL = 40;
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
export const SAVE_VERSION = 8;

export type Tone = 'info' | 'good' | 'warn' | 'loot';

export interface LogEntry {
  msg: Msg;
  tone: Tone;
}

export type TravelResult = 'moved' | 'arrived' | 'blocked';

type Items = Partial<Record<ItemId, number>>;

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
  | { type: 'fade' }
);
type EventData = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'late'> : never) : never;

/** Needs that get a warning when they run low. */
const WARN_NEEDS = ['food', 'water', 'energy', 'warmth'] as const;

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
  objects: [number, ObjectKind, number?][];
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
  /** The explorer left the island on the finished goal. */
  sailed = false;
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
  /** climberDist() of this turn. */
  private climbDist: { turn: number; dist: Int32Array } | null = null;

  constructor(seed = (Math.random() * 2 ** 32) >>> 0, save?: SaveData) {
    this.seed = seed;
    this.rng = new Rng(seed);
    if (save) {
      this.rng.state32 = save.rng;
      this.map = new GameMap(save.width, save.height);
      for (let i = 0; i < this.map.tiles.length; i++) {
        this.map.tiles[i] = save.tiles.charCodeAt(i) - 48;
        this.map.explored[i] = save.explored.charCodeAt(i) === 49 ? 1 : 0;
      }
      this.objects = new Map(save.objects.map(([i, kind, readyAt]) => [i, readyAt ? { kind, readyAt } : { kind }]));
      this.animals = save.animals;
      this.player = save.player;
      this.home = save.home;
      this.needs = save.needs;
      this.inventory = Inventory.from(save.inventory);
      this.xp = save.xp;
      this.skills = new Set(save.skills.filter((id) => id in SKILLS));
      this.level = save.level;
      this.goalGiven = save.goalGiven;
      this.sailed = save.sailed;
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
      this.populate();
      this.message({ key: 'arrive' }, 'info');
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

  /** Sprite name to draw for the object at a cell (regrowing plants look bare). */
  objectSprite(obj: WorldObject): string {
    const def = OBJECTS[obj.kind];
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
    if (this.map.get(x, y) === Tile.River) return !!obj && !!OBJECTS[obj.kind].bridge;
    if (this.map.get(x, y) === Tile.Water) return !!obj && !!OBJECTS[obj.kind].tidal && this.lowTide;
    if (!this.map.isFloor(x, y)) return false;
    return !obj || !!OBJECTS[obj.kind].walkable;
  }

  visibleAnimals(): Animal[] {
    return this.animals.filter((a) => this.map.isVisible(a.x, a.y));
  }

  /** With Cartographer, the explorer keeps a map on the wall of every hut. */
  canReadMap(): boolean {
    return this.has('cartographer') && this.objectAt(this.player.x, this.player.y)?.kind === 'hut';
  }

  /** 0 in the open, up to 1 inside a hut. */
  shelterAt(x: number, y: number): number {
    const obj = this.objectAt(x, y);
    const built = obj ? OBJECTS[obj.kind].shelter ?? 0 : 0;
    return Math.max(built, this.map.get(x, y) === Tile.CaveFloor ? CAVE_SHELTER : 0);
  }

  /** Campfires and other light sources (the lit beacon): [x, y, radius]. */
  lights(): [number, number, number][] {
    const out: [number, number, number][] = [];
    for (const [i, obj] of this.objects) {
      const def = OBJECTS[obj.kind];
      const r = this.sailed && def.done ? def.done.lightRadius : def.lightRadius;
      if (r) out.push([i % this.map.width, Math.floor(i / this.map.width), r]);
    }
    return out;
  }

  nearFire(x: number, y: number): boolean {
    return this.nearestFire(x, y) !== null;
  }

  /** The closest fire whose warmth reaches (x, y), or null if none does. */
  nearestFire(x: number, y: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const [i, obj] of this.objects) {
      const r = OBJECTS[obj.kind].warmthRadius;
      if (!r) continue;
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

  /** How far the explorer can see: less at night. */
  get sightRadius(): number {
    const night = this.has('night_eyes') ? NIGHT_EYES * (1 - this.daylight) : 0;
    return Math.round(4 + 4 * this.daylight + night);
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

  /** What a recipe costs the explorer now (Handy builder saves a piece of wood). */
  recipeCost(id: RecipeId): Partial<Record<ItemId, number>> {
    const cost = { ...RECIPES[id].cost };
    if (this.has('handy_builder') && cost.wood) {
      cost.wood--;
      if (!cost.wood) delete cost.wood;
    }
    return cost;
  }

  /** How many items a recipe that `makes` an item gives now (Rope maker twists 2 ropes). */
  recipeMakes(id: RecipeId): number {
    return id === 'rope' && this.has('rope_maker') ? ROPE_MAKER : 1;
  }

  /** Why a recipe can't be built right now, or null if it can. */
  buildProblem(id: RecipeId): Msg | null {
    const recipe = RECIPES[id];
    if (recipe.skill && !this.has(recipe.skill)) return { key: 'needSkill', skill: recipe.skill };
    if ('makes' in recipe && ITEMS[recipe.makes].tool && this.inventory.count(recipe.makes) > 0) {
      return { key: 'haveTool', item: recipe.makes };
    }
    if (!this.inventory.hasAll(this.recipeCost(id))) return { key: 'needMaterials' };
    if (recipe.atFire && !this.nearFire(this.player.x, this.player.y)) return { key: 'needFire' };
    if ('builds' in recipe && !this.buildSpot(recipe.builds, recipe.onto)) {
      if (recipe.onto) return { key: 'noStep', obj: recipe.onto };
      return OBJECTS[recipe.builds].bridge ? { key: 'noBridgeSpot' } : { key: 'noRoom' };
    }
    return null;
  }

  /** Where the island's goal stands, or -1 on islands from before goals. */
  private goalCell(): number {
    for (const [i, obj] of this.objects) if (OBJECTS[obj.kind].goal) return i;
    return -1;
  }

  goal(): GoalState {
    if (this.sailed) return { state: 'sailed' };
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
    p.x = nx;
    p.y = ny;
    if (obj && OBJECTS[obj.kind].shelter) {
      this.message({ key: 'stepInto', obj: obj.kind }, 'info');
      if (this.canReadMap()) this.message({ key: 'mapHint' }, 'info');
    } else if (obj && OBJECTS[obj.kind].climb) this.climb(nx, ny, obj.kind);
    else if (!onSnow && this.map.get(nx, ny) === Tile.Snow) this.message({ key: 'snowCold' }, 'warn');
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
    for (const cell of spot.cells) {
      this.objects.set(this.map.idx(cell.x, cell.y), { kind: spot.kind });
      this.emit({ type: 'sparkle', x: cell.x, y: cell.y });
    }
    const [first] = spot.cells;
    this.emit({ type: 'lunge', id: p.id, x: p.x, y: p.y, targetX: first.x, targetY: first.y });
    this.message({ key: 'build', obj: spot.kind }, 'good');
    this.gainXp(xp, first.x, first.y);
    this.endTurn();
    return true;
  }

  /**
   * Leave the island on the finished goal. The boat of island 1 takes the
   * explorer to the next island; on the last island play can go on here.
   */
  sail(): boolean {
    if (!this.sailed && this.goal().state !== 'ready') return false;
    this.emit({ type: 'fade' });
    if (this.sailed) return true;
    this.checkStars();
    this.message({ key: 'sailAway', level: this.level }, 'good');
    const next = nextLevel(this.level);
    if (next) this.landOn(next);
    else this.sailed = true;
    return true;
  }

  /**
   * Arrive on a new island with everything you carry, your XP and skills,
   * and your needs as they are, at 8:00 the next day.
   */
  private landOn(level: LevelId): void {
    const world = generateWorld(this.rng, WORLD_WIDTH, WORLD_HEIGHT, level);
    this.level = level;
    this.map = world.map;
    this.objects = world.objects;
    this.player.x = world.start.x;
    this.player.y = world.start.y;
    this.player.facing = 'down';
    this.home = { ...world.start };
    this.goalGiven = {};
    this.sailAsked = false;
    this.turn = Math.ceil((this.turn + 1) / TURNS_PER_DAY) * TURNS_PER_DAY;
    this.animals = [];
    this.bearSpots = [];
    this.fishHere = 0;
    this.safeSince = this.turn;
    this.dogToPlayer();
    this.populate();
    this.warned.clear();
    this.updateFov();
    this.message({ key: 'landIsland', level }, 'good');
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
      if (this.needs.energy >= 100) reason = 'rested';
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
    const def = OBJECTS[obj.kind];
    this.emit({ type: 'lunge', id: this.player.id, x: this.player.x, y: this.player.y, targetX: x, targetY: y });

    if (def.drink) return this.drink(def.drink, { key: 'drink' });
    if (def.goal) return this.workOnGoal(x, y, obj);
    if (def.steep) {
      const recipe = RECIPE_IDS.map((id) => RECIPES[id]).find((r) => r.onto === obj.kind);
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
   */
  private buildSpot(kind: ObjectKind, onto?: ObjectKind): { kind: ObjectKind; cells: { x: number; y: number }[] } | null {
    const p = this.player;
    const [fx, fy] = facingDelta(p.facing);
    if (OBJECTS[kind].bridge) {
      const cells = this.riverAhead(p.x, p.y, fx, fy);
      return cells ? { kind: fx ? 'bridge_ew' : 'bridge_ns', cells } : null;
    }
    const order: (readonly [number, number])[] = [[fx, fy], ...DIRS.filter(([dx, dy]) => dx !== fx || dy !== fy)];
    if (onto) {
      const at = order.find(([dx, dy]) => this.objectAt(p.x + dx, p.y + dy)?.kind === onto && !this.animalAt(p.x + dx, p.y + dy));
      return at ? { kind, cells: [{ x: p.x + at[0], y: p.y + at[1] }] } : null;
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

  /** The open river cells straight ahead, if they end on free ground within a bridge's span. */
  private riverAhead(x: number, y: number, dx: number, dy: number): { x: number; y: number }[] | null {
    const cells: { x: number; y: number }[] = [];
    for (let k = 1; k <= BRIDGE_SPAN + 1; k++) {
      const cx = x + dx * k;
      const cy = y + dy * k;
      if (this.map.get(cx, cy) === Tile.River && !this.objectAt(cx, cy)) {
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
    const isRiver = (x: number, y: number) => this.map.get(x, y) === Tile.River && !this.objectAt(x, y);
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
    });
    if (!this.sleeping) this.warnAboutNeeds();

    this.animalsActing = true;
    const playerDist = distanceMap(this.map, p.x, p.y, (x, y) => this.isPassable(x, y));
    if (this.dog) this.dogAct(this.dog, playerDist);
    for (const a of this.animals) this.animalAct(a, playerDist);
    this.animalsActing = false;
    if (this.turn % RESPAWN_EVERY === 0) this.topUpAnimals();

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
      width: this.map.width,
      height: this.map.height,
      tiles: String.fromCharCode(...this.map.tiles.map((t) => t + 48)),
      explored: Array.from(this.map.explored, (e) => (e ? '1' : '0')).join(''),
      objects: [...this.objects].map(([i, o]) => (o.readyAt ? [i, o.kind, o.readyAt] : [i, o.kind])),
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
      data = { ...data, v: SAVE_VERSION, stars: [], fishHere: 0, safeSince: data.turn };
    }
    if (data.v !== SAVE_VERSION) throw new Error(`Unsupported save version ${data.v}`);
    return new Game(data.seed, data);
  }
}

