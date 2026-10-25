import { createMonster, createPlayer, MONSTER_TYPES, type Actor, type MonsterType } from './actors';
import { generateCaves } from './caves';
import { computeFov } from './fov';
import { Tile, type GameMap } from './map';
import { DIRS, distanceMap } from './pathing';
import { Rng } from './rng';

export const MAP_WIDTH = 60;
export const MAP_HEIGHT = 40;
export const FOV_RADIUS = 8;
const LOG_LIMIT = 100;
const ALERT_TURNS = 15;
const REGEN_EVERY = 12;
const TONIC_HEAL = 10;

export type Tone = 'info' | 'good' | 'bad' | 'loot';
export interface LogEntry {
  text: string;
  tone: Tone;
}

export interface Item {
  kind: 'tonic';
  x: number;
  y: number;
}

export class Game {
  readonly seed: number;
  readonly rng: Rng;
  readonly player: Actor;
  map!: GameMap;
  monsters: Actor[] = [];
  items: Item[] = [];
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
    this.enterNextLevel();
    this.message('You climb down into the dark. Find the stairs (>) to go deeper.', 'info');
  }

  get xpToNext(): number {
    return this.level * 10;
  }

  get onStairs(): boolean {
    return this.map.get(this.player.x, this.player.y) === Tile.Stairs;
  }

  monsterAt(x: number, y: number): Actor | undefined {
    return this.monsters.find((m) => m.x === x && m.y === y);
  }

  itemAt(x: number, y: number): Item | undefined {
    return this.items.find((i) => i.x === x && i.y === y);
  }

  /** Step or attack in a direction. Returns true if a turn passed. */
  move(dx: number, dy: number): boolean {
    if (this.over) return false;
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    const target = this.monsterAt(nx, ny);
    if (target) {
      this.attack(this.player, target);
      this.endTurn();
      return true;
    }
    if (!this.map.isWalkable(nx, ny)) return false;
    this.player.x = nx;
    this.player.y = ny;
    this.pickUp();
    if (this.onStairs) this.message('Stairs lead down from here.', 'info');
    this.endTurn();
    return true;
  }

  wait(): boolean {
    if (this.over) return false;
    this.endTurn();
    return true;
  }

  descend(): boolean {
    if (this.over || !this.onStairs) return false;
    this.enterNextLevel();
    this.message(`You descend to depth ${this.depth}.`, 'info');
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

  private enterNextLevel(): void {
    this.depth++;
    const { map, start } = generateCaves(MAP_WIDTH, MAP_HEIGHT, this.rng);
    this.map = map;
    this.player.x = start.x;
    this.player.y = start.y;
    this.monsters = [];
    this.items = [];

    const dist = distanceMap(map, start.x, start.y);
    const spawnable: number[] = [];
    for (let i = 0; i < map.tiles.length; i++) {
      // Keep spawns out of the player's immediate surroundings.
      if (map.tiles[i] === Tile.Floor && dist[i] > 6) spawnable.push(i);
    }
    const takeCell = (): { x: number; y: number } | null => {
      if (spawnable.length === 0) return null;
      const i = spawnable.splice(this.rng.int(0, spawnable.length - 1), 1)[0];
      return { x: i % map.width, y: Math.floor(i / map.width) };
    };

    const eligible = MONSTER_TYPES.filter((t) => t.minDepth <= this.depth);
    const monsterCount = 4 + this.depth * 2;
    for (let n = 0; n < monsterCount; n++) {
      const cell = takeCell();
      if (!cell) break;
      this.monsters.push(createMonster(this.pickWeighted(eligible), cell.x, cell.y));
    }

    const tonicCount = this.rng.int(1, 2);
    for (let n = 0; n < tonicCount; n++) {
      const cell = takeCell();
      if (!cell) break;
      this.items.push({ kind: 'tonic', ...cell });
    }

    this.updateFov();
  }

  private pickWeighted(types: readonly MonsterType[]): MonsterType {
    const total = types.reduce((sum, t) => sum + t.weight, 0);
    let roll = this.rng.next() * total;
    for (const t of types) {
      roll -= t.weight;
      if (roll < 0) return t;
    }
    return types[types.length - 1];
  }

  private pickUp(): void {
    const item = this.itemAt(this.player.x, this.player.y);
    if (!item) return;
    this.items = this.items.filter((i) => i !== item);
    this.tonics++;
    this.message('You pick up a tonic (!).', 'loot');
  }

  private endTurn(): void {
    this.turn++;
    if (this.turn % REGEN_EVERY === 0 && this.player.hp < this.player.maxHp) this.player.hp++;

    const dist = distanceMap(this.map, this.player.x, this.player.y);
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
    if (!this.map.isWalkable(x, y) || this.monsterAt(x, y)) return;
    if (x === this.player.x && y === this.player.y) return;
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
      this.message(`You die on depth ${this.depth}.`, 'bad');
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
      (x, y) => map.isOpaque(x, y),
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
