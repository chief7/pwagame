import { facingDelta, facingFor, PLAYER_ID, type Animal, type Player } from './actors';
import { clockLabel, daylight, isNight, phase, turnsUntilMorning, TURNS_PER_DAY } from './clock';
import { ANIMAL_KINDS, ANIMALS, type AnimalKind } from './defs/animals';
import { ITEMS, itemLabel, type ItemId } from './defs/items';
import { OBJECTS, type ObjectKind, type WorldObject } from './defs/objects';
import { RECIPES, type RecipeId } from './defs/recipes';
import { computeFov } from './fov';
import { Inventory } from './inventory';
import { GameMap, Tile } from './map';
import { freshNeeds, LOW, tickNeeds, type NeedId, type Needs } from './needs';
import { DIRS, distanceMap } from './pathing';
import { Rng } from './rng';
import { generateWorld } from './worldgen';

const LOG_LIMIT = 100;
/** Caves keep out the wind: they count as this much shelter. */
const CAVE_SHELTER = 0.5;
const RESPAWN_EVERY = 50;
const SLEEP_LIMIT = 200;
const PINCH_DAMAGE = 4;
export const SAVE_VERSION = 1;

export type Tone = 'info' | 'good' | 'warn' | 'loot';

export interface LogEntry {
  text: string;
  tone: Tone;
}

export type TravelResult = 'moved' | 'arrived' | 'blocked';

/**
 * What happened during a turn, in order, for the UI to animate. `late`
 * marks things that happened in the animals' half of the turn.
 */
export type GameEvent = { late: boolean } & (
  | { type: 'move'; id: number; fromX: number; fromY: number; toX: number; toY: number }
  | { type: 'lunge'; id: number; x: number; y: number; targetX: number; targetY: number }
  | { type: 'hit'; id: number; x: number; y: number; damage: number }
  | { type: 'float'; x: number; y: number; text: string; tone: Tone }
  | { type: 'sparkle'; x: number; y: number }
  | { type: 'fade' }
);
type EventData = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'late'> : never) : never;

const LOW_MESSAGES: Partial<Record<NeedId, string>> = {
  food: 'Your tummy rumbles. Time to find something to eat.',
  water: "You're thirsty. Look for a spring or a coconut.",
  energy: "You're getting sleepy. A rest would help.",
  warmth: "Brr, you're getting cold. A fire or a shelter would help.",
};

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
  turn = 0;
  log: LogEntry[] = [];
  sleeping = false;
  private nextId = PLAYER_ID + 1;
  private warned = new Set<NeedId>();
  /** Events since the UI last called takeEvents(). */
  private events: GameEvent[] = [];
  private animalsActing = false;

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
      for (const kind of ANIMAL_KINDS) {
        for (let n = 0; n < ANIMALS[kind].population; n++) this.spawnAnimal(kind, false);
      }
      this.message('You wash up on a quiet island. Gather food and water, and build a shelter before night.', 'info');
    }
    this.updateFov();
  }

  // ---- Queries -------------------------------------------------------------

  objectAt(x: number, y: number): WorldObject | undefined {
    return this.map.inBounds(x, y) ? this.objects.get(this.map.idx(x, y)) : undefined;
  }

  /** Sprite name to draw for the object at a cell (regrowing plants look bare). */
  objectSprite(obj: WorldObject): string {
    const def = OBJECTS[obj.kind];
    if (obj.readyAt !== undefined && obj.readyAt > this.turn && def.depletedSprite) return def.depletedSprite;
    return obj.kind;
  }

  animalAt(x: number, y: number): Animal | undefined {
    return this.animals.find((a) => a.x === x && a.y === y);
  }

  /** Floor that nothing solid stands on. Ignores animals. */
  isPassable(x: number, y: number): boolean {
    if (!this.map.isFloor(x, y)) return false;
    const obj = this.objectAt(x, y);
    return !obj || !!OBJECTS[obj.kind].walkable;
  }

  visibleAnimals(): Animal[] {
    return this.animals.filter((a) => this.map.isVisible(a.x, a.y));
  }

  /** 0 in the open, up to 1 inside a hut. */
  shelterAt(x: number, y: number): number {
    const obj = this.objectAt(x, y);
    const built = obj ? OBJECTS[obj.kind].shelter ?? 0 : 0;
    return Math.max(built, this.map.get(x, y) === Tile.CaveFloor ? CAVE_SHELTER : 0);
  }

  /** Campfires and other light sources: [x, y, radius]. */
  lights(): [number, number, number][] {
    const out: [number, number, number][] = [];
    for (const [i, obj] of this.objects) {
      const r = OBJECTS[obj.kind].lightRadius;
      if (r) out.push([i % this.map.width, Math.floor(i / this.map.width), r]);
    }
    return out;
  }

  nearFire(x: number, y: number): boolean {
    for (const [i, obj] of this.objects) {
      const r = OBJECTS[obj.kind].warmthRadius;
      if (!r) continue;
      const fx = i % this.map.width;
      const fy = Math.floor(i / this.map.width);
      if (Math.max(Math.abs(fx - x), Math.abs(fy - y)) <= r) return true;
    }
    return false;
  }

  get daylight(): number {
    return daylight(this.turn);
  }

  get clock(): string {
    return clockLabel(this.turn);
  }

  get phase() {
    return phase(this.turn);
  }

  /** How far the explorer can see: less at night. */
  get sightRadius(): number {
    return Math.round(4 + 4 * this.daylight);
  }

  /** Why a recipe can't be built right now, or null if it can. */
  buildProblem(id: RecipeId): string | null {
    if (!this.inventory.hasAll(RECIPES[id].cost)) return 'You need more materials.';
    if (!this.buildSpot(RECIPES[id].builds)) return 'There is no room to build here.';
    return null;
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
      this.shoo(animal);
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
      if (this.map.get(nx, ny) === Tile.Water) this.message('The sea is too salty to drink. Look for fresh water.', 'info');
      return false;
    }
    this.emit({ type: 'move', id: p.id, fromX: p.x, fromY: p.y, toX: nx, toY: ny });
    p.x = nx;
    p.y = ny;
    if (obj) this.message(`You step into the ${OBJECTS[obj.kind].name}. A good place to sleep.`, 'info');
    this.endTurn();
    return true;
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
      this.message("You're too full to eat that.", 'info');
      return false;
    }
    this.inventory.take(id);
    const gains: string[] = [];
    for (const need of ['food', 'water', 'energy'] as const) {
      const amount = food[need];
      if (!amount) continue;
      this.needs[need] = Math.min(100, this.needs[need] + amount);
      gains.push(`+${amount} ${need}`);
    }
    this.message(`You eat ${itemLabel(id, 1)}. Yum!`, 'good');
    this.emit({ type: 'float', x: this.player.x, y: this.player.y, text: gains[0], tone: 'good' });
    this.endTurn();
    return true;
  }

  build(id: RecipeId): boolean {
    const recipe = RECIPES[id];
    const spot = this.buildSpot(recipe.builds);
    if (!spot || !this.inventory.takeAll(recipe.cost)) {
      this.message(this.buildProblem(id) ?? "You can't build that here.", 'info');
      return false;
    }
    this.objects.set(this.map.idx(spot.x, spot.y), { kind: recipe.builds });
    this.emit({ type: 'lunge', id: this.player.id, x: this.player.x, y: this.player.y, targetX: spot.x, targetY: spot.y });
    this.emit({ type: 'sparkle', x: spot.x, y: spot.y });
    this.message(`You build a ${recipe.name.toLowerCase()}.`, 'good');
    this.endTurn();
    return true;
  }

  /**
   * Sleep until rested. Shelter makes sleep quicker and keeps you warm;
   * sleeping in one also makes it home.
   */
  sleep(): boolean {
    if (this.needs.energy >= 95) {
      this.message("You're not sleepy right now.", 'info');
      return false;
    }
    const p = this.player;
    const shelter = this.shelterAt(p.x, p.y);
    const obj = this.objectAt(p.x, p.y);
    if (shelter > 0) {
      this.home = { x: p.x, y: p.y };
      this.message(obj ? `You curl up in the ${OBJECTS[obj.kind].name} and fall asleep.` : 'You curl up in the cave and fall asleep.', 'info');
    } else {
      this.message('You lie down on the ground and doze off.', 'info');
    }
    const keep = this.events.length;
    this.sleeping = true;
    let reason = '';
    for (let i = 0; i < SLEEP_LIMIT && this.sleeping; i++) {
      this.endTurn();
      if (!this.sleeping) break; // fainted
      if (this.needs.energy >= 100) reason = 'You wake up feeling rested.';
      else if (this.needs.warmth < 12) reason = 'Brr! Too cold to sleep. A fire or a shelter would help.';
      else if (this.needs.food <= 0) reason = 'Your rumbling tummy wakes you up.';
      else if (this.needs.water <= 0) reason = 'You wake up thirsty.';
      if (reason) break;
    }
    this.sleeping = false;
    // The UI only needs to show the night passing, not every animal step.
    this.events.length = keep;
    this.emit({ type: 'fade' });
    this.message(`${reason || 'You wake up.'} (${this.clock})`, reason.startsWith('Brr') ? 'warn' : 'good');
    return true;
  }

  // ---- Interactions ------------------------------------------------------------------

  private interact(x: number, y: number, obj: WorldObject): boolean {
    const def = OBJECTS[obj.kind];
    this.emit({ type: 'lunge', id: this.player.id, x: this.player.x, y: this.player.y, targetX: x, targetY: y });

    if (def.drink) {
      if (this.needs.water >= 98) {
        this.message("You're not thirsty.", 'info');
        return false;
      }
      this.needs.water = Math.min(100, this.needs.water + def.drink);
      this.message('You drink the cool, fresh water. Lovely!', 'good');
      this.emit({ type: 'float', x: this.player.x, y: this.player.y, text: `+${def.drink} water`, tone: 'good' });
      return true;
    }

    const gather = def.gather;
    if (!gather) {
      this.message(`A ${def.name}.`, 'info');
      return false;
    }
    if (obj.readyAt !== undefined && obj.readyAt > this.turn) {
      this.message(`The ${def.name} has nothing left. Come back later.`, 'info');
      return false;
    }

    const got: [ItemId, number][] = [];
    for (const y0 of gather.yields) {
      if (y0.chance !== undefined && !this.rng.chance(y0.chance)) continue;
      const n = this.rng.int(y0.min, y0.max);
      if (n > 0) got.push([y0.item, n]);
    }
    for (const [item, n] of got) {
      this.inventory.add(item, n);
      this.emit({ type: 'float', x, y, text: `+${n} ${item}`, tone: 'loot' });
    }
    const list = got.map(([item, n]) => itemLabel(item, n)).join(' and ');
    this.message(list ? `${gather.verb} and get ${list}.` : `${gather.verb}, but find nothing.`, 'loot');

    const after = gather.after;
    if ('remove' in after) this.objects.delete(this.map.idx(x, y));
    else if ('becomes' in after) {
      obj.kind = after.becomes;
      this.emit({ type: 'sparkle', x, y });
    } else obj.readyAt = this.turn + after.regrow;
    return true;
  }

  private shoo(a: Animal): void {
    const def = ANIMALS[a.kind];
    this.emit({ type: 'lunge', id: this.player.id, x: this.player.x, y: this.player.y, targetX: a.x, targetY: a.y });
    this.message(def.bump, 'info');
    if (def.temper !== 'calm') a.flee = 8;
  }

  /** Where a new building goes: in front of the explorer if free, else the nearest free neighbour. */
  private buildSpot(kind: ObjectKind): { x: number; y: number } | null {
    const p = this.player;
    const [fx, fy] = facingDelta(p.facing);
    const order: (readonly [number, number])[] = [[fx, fy], ...DIRS.filter(([dx, dy]) => dx !== fx || dy !== fy)];
    for (const [dx, dy] of order) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (!this.map.isFloor(x, y) || this.objectAt(x, y) || this.animalAt(x, y)) continue;
      if (OBJECTS[kind].walkable) return { x, y };
      // Solid buildings must not cut off part of the island.
      const i = this.map.idx(x, y);
      this.objects.set(i, { kind });
      const ok = this.allReachableFrom(p.x, p.y);
      this.objects.delete(i);
      if (ok) return { x, y };
    }
    return null;
  }

  private allReachableFrom(sx: number, sy: number): boolean {
    const reach = distanceMap(this.map, sx, sy, (x, y) => this.isPassable(x, y));
    for (let i = 0; i < this.map.tiles.length; i++) {
      const x = i % this.map.width;
      const y = (i - x) / this.map.width;
      if (this.isPassable(x, y) && reach[i] < 0) return false;
    }
    return true;
  }

  // ---- The rest of the turn ----------------------------------------------------------

  private endTurn(): void {
    this.turn++;
    const p = this.player;
    tickNeeds(this.needs, {
      sleeping: this.sleeping,
      shelter: this.shelterAt(p.x, p.y),
      nearFire: this.nearFire(p.x, p.y),
      daylight: this.daylight,
    });
    if (!this.sleeping) this.warnAboutNeeds();

    this.animalsActing = true;
    const playerDist = distanceMap(this.map, p.x, p.y, (x, y) => this.isPassable(x, y));
    for (const a of this.animals) this.animalAct(a, playerDist);
    this.animalsActing = false;
    if (this.turn % RESPAWN_EVERY === 0) this.topUpAnimals();

    if (this.needs.health <= 0) this.faint();
    this.updateFov();
  }

  private warnAboutNeeds(): void {
    for (const [need, text] of Object.entries(LOW_MESSAGES) as [NeedId, string][]) {
      if (this.needs[need] < LOW && !this.warned.has(need)) {
        this.warned.add(need);
        this.message(text, 'warn');
      } else if (this.needs[need] >= LOW + 10) {
        this.warned.delete(need);
      }
    }
  }

  /** Nobody dies here: the explorer faints and wakes up at home the next morning. */
  private faint(): void {
    this.sleeping = false;
    this.message('You feel woozy and sit down for a rest…', 'warn');
    this.turn += turnsUntilMorning(this.turn) || TURNS_PER_DAY;
    const n = this.needs;
    this.needs = {
      health: 60,
      food: Math.max(n.food, 40),
      water: Math.max(n.water, 40),
      energy: 70,
      warmth: 80,
    };
    this.animals = this.animals.filter((a) => a.x !== this.home.x || a.y !== this.home.y);
    this.player.x = this.home.x;
    this.player.y = this.home.y;
    this.warned.clear();
    this.emit({ type: 'fade' });
    this.message('You wake up back at camp, feeling better. Remember to eat, drink and keep warm!', 'good');
  }

  // ---- Animals ----------------------------------------------------------------------

  private animalAct(a: Animal, playerDist: Int32Array): void {
    const def = ANIMALS[a.kind];
    const p = this.player;
    const dist = Math.max(Math.abs(a.x - p.x), Math.abs(a.y - p.y));
    if (a.flee > 0) {
      a.flee--;
      this.stepAway(a);
      return;
    }
    const noticed = def.notice > 0 && dist <= def.notice && this.map.isVisible(a.x, a.y);
    if (noticed && !this.sleeping) {
      switch (def.temper) {
        case 'shy':
          this.stepAway(a);
          return;
        case 'grumpy':
          if (dist <= 1 && this.rng.chance(0.5)) {
            this.emit({ type: 'lunge', id: a.id, x: a.x, y: a.y, targetX: p.x, targetY: p.y });
            this.needs.health = Math.max(0, this.needs.health - PINCH_DAMAGE);
            this.emit({ type: 'hit', id: p.id, x: p.x, y: p.y, damage: PINCH_DAMAGE });
            this.message(`Ouch! The ${def.name} pinched you.`, 'warn');
            a.flee = 4;
            return;
          }
          break;
        case 'cheeky': {
          const foods = this.inventory.foods();
          if (!foods.length) break;
          if (dist <= 1) {
            const item = this.rng.pick(foods);
            this.inventory.take(item);
            this.emit({ type: 'lunge', id: a.id, x: a.x, y: a.y, targetX: p.x, targetY: p.y });
            this.emit({ type: 'float', x: p.x, y: p.y, text: `-1 ${item}`, tone: 'warn' });
            this.message(`The cheeky ${def.name} snatched ${itemLabel(item, 1)}!`, 'warn');
            a.flee = 12;
          } else {
            this.stepToward(a, playerDist);
          }
          return;
        }
        case 'calm':
          break;
      }
    }
    if (this.rng.chance(def.wander)) {
      const [dx, dy] = this.rng.pick(DIRS);
      this.tryStep(a, a.x + dx, a.y + dy);
    }
  }

  private canStand(a: Animal, x: number, y: number): boolean {
    return (
      this.isPassable(x, y) &&
      !this.objectAt(x, y) &&
      ANIMALS[a.kind].habitat.includes(this.map.get(x, y)) &&
      !this.animalAt(x, y) &&
      !(x === this.player.x && y === this.player.y)
    );
  }

  private tryStep(a: Animal, x: number, y: number): boolean {
    if (!this.canStand(a, x, y)) return false;
    a.facing = facingFor(x - a.x, y - a.y, a.facing);
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

  private spawnAnimal(kind: AnimalKind, outOfSight: boolean): void {
    const def = ANIMALS[kind];
    const p = this.player;
    for (let tries = 0; tries < 200; tries++) {
      const x = this.rng.int(0, this.map.width - 1);
      const y = this.rng.int(0, this.map.height - 1);
      if (!def.habitat.includes(this.map.get(x, y)) || this.objectAt(x, y) || this.animalAt(x, y)) continue;
      if (Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) < 8) continue;
      if (outOfSight && this.map.isVisible(x, y)) continue;
      this.animals.push({ id: this.nextId++, kind, x, y, facing: 'down', flee: 0 });
      return;
    }
  }

  /** Animals that wandered off are replaced, out of sight, over time. */
  private topUpAnimals(): void {
    for (const kind of ANIMAL_KINDS) {
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
  }

  private emit(event: EventData): void {
    this.events.push({ ...event, late: this.animalsActing } as GameEvent);
  }

  private message(text: string, tone: Tone): void {
    // Bumping the same thing again shouldn't fill the log with copies.
    if (this.log.at(-1)?.text === text) return;
    this.log.push({ text, tone });
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
      warned: [...this.warned],
      log: this.log.slice(-30),
    };
  }

  static fromSave(data: SaveData): Game {
    if (data.v !== SAVE_VERSION) throw new Error(`Unsupported save version ${data.v}`);
    return new Game(data.seed, data);
  }
}

