import { createMonster, createPlayer, facingFor, MONSTER_TYPES, type Actor, type MonsterType } from './actors';
import { computeFov } from './fov';
import { generateIsland } from './island';
import { Tile, type GameMap } from './map';
import { DIRS, distanceMap } from './pathing';
import { isOpaqueProp, SCENERY, type PropKind } from './props';
import { Rng } from './rng';

export const MAP_WIDTH = 60;
export const MAP_HEIGHT = 40;
export const FOV_RADIUS = 8;
const LOG_LIMIT = 100;
const ALERT_TURNS = 15;
const REGEN_EVERY = 12;
const TONIC_HEAL = 10;
/** Share of land cells that get scenery. */
const SCENERY_DENSITY = 0.07;

export type Tone = 'info' | 'good' | 'bad' | 'loot';
export interface LogEntry {
  text: string;
  tone: Tone;
}

export type TravelResult = 'moved' | 'arrived' | 'blocked';

export class Game {
  readonly seed: number;
  readonly rng: Rng;
  readonly player: Actor;
  map!: GameMap;
  /** Scenery and chests by cell index. All of them block movement. */
  props = new Map<number, PropKind>();
  monsters: Actor[] = [];
  log: LogEntry[] = [];
  depth = 0;
  turn = 0;
  level = 1;
  xp = 0;
  tonics = 1;
  over = false;

  constructor(seed = (Math.random() * 2 ** 32) >>> 0) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.player = createPlayer();
    this.enterNextIsland();
    this.message('Washed ashore. Find the raft to sail on.', 'info');
  }

  get xpToNext(): number {
    return this.level * 10;
  }

  get onRaft(): boolean {
    return this.map.get(this.player.x, this.player.y) === Tile.Raft;
  }

  monsterAt(x: number, y: number): Actor | undefined {
    return this.monsters.find((m) => m.x === x && m.y === y);
  }

  propAt(x: number, y: number): PropKind | undefined {
    return this.map.inBounds(x, y) ? this.props.get(this.map.idx(x, y)) : undefined;
  }

  /** Land without anything standing on it. Ignores monsters. */
  isPassable(x: number, y: number): boolean {
    return this.map.isLand(x, y) && !this.propAt(x, y);
  }

  visibleMonsters(): Actor[] {
    return this.monsters.filter((m) => this.map.isVisible(m.x, m.y));
  }

  /** Step, attack or open a chest in a direction. Returns true if a turn passed. */
  move(dx: number, dy: number): boolean {
    if (this.over) return false;
    this.player.facing = facingFor(dx, dy, this.player.facing);
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    const target = this.monsterAt(nx, ny);
    if (target) {
      this.attack(this.player, target);
      this.endTurn();
      return true;
    }
    if (this.propAt(nx, ny) === 'chest_closed') {
      this.openChest(nx, ny);
      this.endTurn();
      return true;
    }
    if (!this.isPassable(nx, ny)) return false;
    this.player.x = nx;
    this.player.y = ny;
    if (this.onRaft) this.message('A raft is tied up here. Tap Sail to set off.', 'info');
    this.endTurn();
    return true;
  }

  /**
   * Take one step along the shortest known path to (tx, ty), through
   * explored land only.
   */
  travelStep(tx: number, ty: number): TravelResult {
    if (this.over) return 'blocked';
    if (this.player.x === tx && this.player.y === ty) return 'arrived';
    if (!this.isPassable(tx, ty) || !this.map.isExplored(tx, ty)) return 'blocked';
    const dist = distanceMap(this.map, tx, ty, (x, y) => this.isPassable(x, y) && this.map.isExplored(x, y));
    let best: readonly [number, number] | null = null;
    let bestDist = Infinity;
    for (const [dx, dy] of DIRS) {
      const nx = this.player.x + dx;
      const ny = this.player.y + dy;
      if (!this.map.inBounds(nx, ny) || this.monsterAt(nx, ny)) continue;
      const d = dist[this.map.idx(nx, ny)];
      if (d >= 0 && d < bestDist) {
        best = [dx, dy];
        bestDist = d;
      }
    }
    if (!best || !this.move(best[0], best[1])) return 'blocked';
    return this.player.x === tx && this.player.y === ty ? 'arrived' : 'moved';
  }

  wait(): boolean {
    if (this.over) return false;
    this.endTurn();
    return true;
  }

  sail(): boolean {
    if (this.over || !this.onRaft) return false;
    this.enterNextIsland();
    this.message(`You sail to island ${this.depth}.`, 'info');
    return true;
  }

  drinkTonic(): boolean {
    if (this.over) return false;
    if (this.tonics <= 0) {
      this.message('You have no tonics.', 'info');
      return false;
    }
    if (this.player.hp >= this.player.maxHp) {
      this.message('You are already at full health.', 'info');
      return false;
    }
    this.tonics--;
    const healed = Math.min(TONIC_HEAL, this.player.maxHp - this.player.hp);
    this.player.hp += healed;
    this.message(`You drink a tonic and recover ${healed} HP.`, 'good');
    this.endTurn();
    return true;
  }

  private enterNextIsland(): void {
    this.depth++;
    const { map, start, raft } = generateIsland(MAP_WIDTH, MAP_HEIGHT, this.rng);
    this.map = map;
    this.player.x = start.x;
    this.player.y = start.y;
    this.monsters = [];
    this.props = new Map();

    const startDist = distanceMap(map, start.x, start.y, (x, y) => map.isLand(x, y));
    const sand: number[] = [];
    for (let i = 0; i < map.tiles.length; i++) if (map.tiles[i] === Tile.Sand) sand.push(i);
    const near = (i: number, x: number, y: number, r: number) =>
      Math.max(Math.abs((i % map.width) - x), Math.abs(Math.floor(i / map.width) - y)) <= r;

    // Scenery and chests, never next to the start or the raft, and never
    // cutting the island in two.
    const free = sand.filter((i) => !near(i, start.x, start.y, 1) && !near(i, raft.x, raft.y, 1));
    const chests = this.rng.int(2, 3);
    const placements: PropKind[] = [
      ...Array.from({ length: chests }, () => 'chest_closed' as const),
      ...Array.from({ length: Math.round(sand.length * SCENERY_DENSITY) }, () => this.pickWeighted(SCENERY)),
    ];
    for (const kind of placements) {
      for (let tries = 0; tries < 20 && free.length; tries++) {
        const i = free.splice(this.rng.int(0, free.length - 1), 1)[0];
        this.props.set(i, kind);
        if (this.allLandReachable(start.x, start.y)) break;
        this.props.delete(i);
      }
    }

    const spawnable = free.filter((i) => startDist[i] > 6 && !this.props.has(i));
    const eligible = MONSTER_TYPES.filter((t) => t.minDepth <= this.depth);
    const monsterCount = 4 + this.depth * 2;
    for (let n = 0; n < monsterCount && spawnable.length; n++) {
      const i = spawnable.splice(this.rng.int(0, spawnable.length - 1), 1)[0];
      const type = this.pickWeighted(eligible.map((t) => [t, t.weight] as [MonsterType, number]));
      this.monsters.push(createMonster(type, i % map.width, Math.floor(i / map.width)));
    }

    this.updateFov();
  }

  private allLandReachable(sx: number, sy: number): boolean {
    const dist = distanceMap(this.map, sx, sy, (x, y) => this.isPassable(x, y));
    for (let i = 0; i < this.map.tiles.length; i++) {
      if (this.map.tiles[i] !== Tile.Water && !this.props.has(i) && dist[i] < 0) return false;
    }
    return true;
  }

  private pickWeighted<T>(options: readonly (readonly [T, number])[]): T {
    const total = options.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.rng.next() * total;
    for (const [option, w] of options) {
      roll -= w;
      if (roll < 0) return option;
    }
    return options[options.length - 1][0];
  }

  private openChest(x: number, y: number): void {
    this.props.set(this.map.idx(x, y), 'chest_open');
    const found = this.rng.chance(0.3) ? 2 : 1;
    this.tonics += found;
    this.message(`You open the chest and find ${found === 1 ? 'a tonic' : 'two tonics'}.`, 'loot');
  }

  private endTurn(): void {
    this.turn++;
    if (this.turn % REGEN_EVERY === 0 && this.player.hp < this.player.maxHp) this.player.hp++;

    const dist = distanceMap(this.map, this.player.x, this.player.y, (x, y) => this.isPassable(x, y));
    for (const m of this.monsters) {
      if (this.over) break;
      this.monsterAct(m, dist);
    }
    this.updateFov();
  }

  private monsterAct(m: Actor, dist: Int32Array): void {
    // Sight is symmetric enough here: if we can see it, it can see us.
    if (this.map.isVisible(m.x, m.y)) m.alert = ALERT_TURNS;
    else if (m.alert > 0) m.alert--;

    if (m.alert === 0) {
      if (this.rng.chance(0.25)) {
        const [dx, dy] = this.rng.pick(DIRS);
        this.tryStep(m, m.x + dx, m.y + dy);
      }
      return;
    }

    if (Math.max(Math.abs(m.x - this.player.x), Math.abs(m.y - this.player.y)) <= 1) {
      this.attack(m, this.player);
      return;
    }

    let best: [number, number] | null = null;
    let bestDist = dist[this.map.idx(m.x, m.y)];
    for (const [dx, dy] of DIRS) {
      const nx = m.x + dx;
      const ny = m.y + dy;
      if (!this.map.inBounds(nx, ny) || this.monsterAt(nx, ny)) continue;
      const d = dist[this.map.idx(nx, ny)];
      if (d >= 0 && d < bestDist) {
        best = [nx, ny];
        bestDist = d;
      }
    }
    if (best) this.tryStep(m, best[0], best[1]);
  }

  private tryStep(m: Actor, x: number, y: number): void {
    if (!this.isPassable(x, y) || this.monsterAt(x, y)) return;
    if (x === this.player.x && y === this.player.y) return;
    m.facing = facingFor(x - m.x, y - m.y, m.facing);
    m.x = x;
    m.y = y;
  }

  private attack(attacker: Actor, defender: Actor): void {
    const isPlayer = attacker === this.player;
    const who = isPlayer ? 'You' : `The ${attacker.name}`;
    const whom = defender === this.player ? 'you' : `the ${defender.name}`;
    if (!this.rng.chance(0.85)) {
      this.message(`${who} miss${isPlayer ? '' : 'es'} ${whom}.`, 'info');
      return;
    }
    const damage = Math.max(1, attacker.attack + this.rng.int(-1, 1) - defender.defense);
    defender.hp -= damage;
    this.message(`${who} hit${isPlayer ? '' : 's'} ${whom} for ${damage}.`, isPlayer ? 'info' : 'bad');
    if (defender.hp <= 0) this.kill(defender);
  }

  private kill(actor: Actor): void {
    if (actor === this.player) {
      this.player.hp = 0;
      this.over = true;
      this.message(`You die on island ${this.depth}.`, 'bad');
      return;
    }
    this.monsters = this.monsters.filter((m) => m !== actor);
    this.message(`The ${actor.name} dies.`, 'good');
    this.gainXp(actor.xp);
  }

  private gainXp(amount: number): void {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.player.maxHp += 5;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 5);
      this.player.attack += 1;
      if (this.level % 2 === 0) this.player.defense += 1;
      this.message(`You reach level ${this.level}!`, 'good');
    }
  }

  private updateFov(): void {
    const map = this.map;
    map.visible.fill(0);
    computeFov(
      this.player.x,
      this.player.y,
      FOV_RADIUS,
      (x, y) => {
        const prop = this.propAt(x, y);
        return prop !== undefined && isOpaqueProp(prop);
      },
      (x, y) => {
        if (!map.inBounds(x, y)) return;
        const i = map.idx(x, y);
        map.visible[i] = 1;
        map.explored[i] = 1;
      },
    );
  }

  private message(text: string, tone: Tone): void {
    this.log.push({ text, tone });
    if (this.log.length > LOG_LIMIT) this.log.shift();
  }
}
