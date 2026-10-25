import type { Game } from '../game/game';
import { Tile, type GameMap } from '../game/map';
import { hash2 } from '../sprites/pixel';
import { bake, buildSprites, shoreTileName, type Sprite } from '../sprites';

export type Body = 'male' | 'female';

const TILE = 16;
const FOG = '#0a1720';
const DIM = 'rgba(10, 23, 32, 0.55)';
/** Aim for about this many tiles across a phone screen. */
const TILES_ACROSS = 12;
/** Upper bound on cell size in CSS pixels, so desktops see more map. */
const MAX_CELL_CSS = 48;

interface Baked {
  sprite: Sprite;
  canvas: HTMLCanvasElement;
}

/**
 * Draws the island from pixel-art sprites, scaled by a whole number so
 * pixels stay crisp. Works in device pixels; the player sits mid-screen.
 */
export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprites = new Map<string, Baked>();
  /** Terrain sprite per cell, worked out once per island. */
  private readonly terrain = new WeakMap<GameMap, string[]>();
  private scale = 2;
  private dpr = 1;
  body: Body = 'male';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not supported');
    this.ctx = ctx;
    for (const [name, sprite] of buildSprites()) this.sprites.set(name, { sprite, canvas: bake(sprite) });
  }

  /** Cell size in CSS pixels. */
  get cellSize(): number {
    return (TILE * this.scale) / this.dpr;
  }

  private get cell(): number {
    return TILE * this.scale;
  }

  resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    const fit = Math.round((w * this.dpr) / (TILE * TILES_ACROSS));
    const cap = Math.floor((MAX_CELL_CSS * this.dpr) / TILE);
    this.scale = Math.max(1, Math.min(fit, cap));
  }

  /** Device-pixel position of world cell (0, 0). */
  private origin(game: Game): { x: number; y: number } {
    return {
      x: Math.floor(this.canvas.width / 2 - this.cell / 2) - game.player.x * this.cell,
      y: Math.floor(this.canvas.height / 2 - this.cell / 2) - game.player.y * this.cell,
    };
  }

  /** World cell under a point given in CSS pixels relative to the canvas. */
  cellAt(game: Game, cssX: number, cssY: number): { x: number; y: number } {
    const o = this.origin(game);
    return {
      x: Math.floor((cssX * this.dpr - o.x) / this.cell),
      y: Math.floor((cssY * this.dpr - o.y) / this.cell),
    };
  }

  /** Centre of the player's cell in CSS pixels relative to the canvas. */
  playerCenter(): { x: number; y: number } {
    return { x: this.canvas.clientWidth / 2, y: this.canvas.clientHeight / 2 };
  }

  render(game: Game): void {
    const { ctx, cell } = this;
    const { map } = game;
    const o = this.origin(game);
    const x0 = Math.floor(-o.x / cell) - 1;
    const y0 = Math.floor(-o.y / cell) - 1;
    const x1 = Math.ceil((this.canvas.width - o.x) / cell);
    const y1 = Math.ceil((this.canvas.height - o.y) / cell);
    const terrain = this.terrainFor(map);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = FOG;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!map.isExplored(x, y)) continue;
        this.drawTile(terrain[map.idx(x, y)], o.x + x * cell, o.y + y * cell);
      }
    }

    // Row by row so tall sprites (palms) overlap whatever stands behind them.
    // Extra rows below the screen let their crowns reach up into view.
    for (let y = y0; y <= y1 + 2; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!map.isExplored(x, y)) continue;
        const sx = o.x + x * cell;
        const sy = o.y + y * cell;
        if (map.get(x, y) === Tile.Raft) this.drawStanding('raft', sx, sy);
        const prop = game.propAt(x, y);
        if (prop) this.drawStanding(prop, sx, sy);
      }
      for (const m of game.monsters) {
        if (m.y !== y || !map.isVisible(m.x, m.y)) continue;
        const sx = o.x + m.x * cell;
        const sy = o.y + m.y * cell;
        this.drawStanding(`monster_${m.kind}`, sx, sy);
        if (m.hp < m.maxHp) this.drawHealth(sx, sy, m.hp / m.maxHp);
      }
      if (game.player.y === y) {
        ctx.globalAlpha = game.over ? 0.4 : 1;
        this.drawStanding(`${this.body}_${game.player.facing}`, o.x + game.player.x * cell, o.y + y * cell);
        ctx.globalAlpha = 1;
      }
    }

    // Remembered cells dim; unknown cells stay hidden, even under overhanging crowns.
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (map.isVisible(x, y)) continue;
        ctx.fillStyle = map.isExplored(x, y) ? DIM : FOG;
        ctx.fillRect(o.x + x * cell, o.y + y * cell, cell, cell);
      }
    }
  }

  /** Draw a sprite as an icon on another canvas, e.g. for the explorer picker. */
  drawIcon(target: HTMLCanvasElement, name: string): void {
    const baked = this.sprites.get(name);
    if (!baked) return;
    const ctx = target.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(baked.canvas, 0, 0, target.width, target.height);
  }

  private drawTile(name: string, sx: number, sy: number): void {
    const baked = this.sprites.get(name);
    if (baked) this.ctx.drawImage(baked.canvas, sx, sy, this.cell, this.cell);
  }

  /** Draw a sprite bottom-centre on the cell at (sx, sy). */
  private drawStanding(name: string, sx: number, sy: number): void {
    const baked = this.sprites.get(name);
    if (!baked) return;
    const w = baked.sprite.width * this.scale;
    const h = baked.sprite.height * this.scale;
    this.ctx.drawImage(baked.canvas, sx + this.cell / 2 - w / 2, sy + this.cell - h, w, h);
  }

  private drawHealth(sx: number, sy: number, fraction: number): void {
    const pad = 2 * this.scale;
    const width = this.cell - pad * 2;
    this.ctx.fillStyle = 'rgba(20, 12, 4, 0.6)';
    this.ctx.fillRect(sx + pad, sy, width, this.scale);
    this.ctx.fillStyle = '#e0583a';
    this.ctx.fillRect(sx + pad, sy, Math.max(this.scale, width * fraction), this.scale);
  }

  private terrainFor(map: GameMap): string[] {
    let names = this.terrain.get(map);
    if (names) return names;
    names = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!map.isLand(x, y)) {
          const roll = hash2(x, y, 51);
          names.push(roll < 0.6 ? 'water' : roll < 0.8 ? 'water_2' : 'water_3');
          continue;
        }
        const shore = shoreTileName((dx, dy) => !map.isLand(x + dx, y + dy));
        if (shore !== 'sand') {
          names.push(shore);
          continue;
        }
        const roll = hash2(x, y, 52);
        names.push(roll < 0.72 ? 'sand' : roll < 0.94 ? 'sand_ripples' : 'sand_shell');
      }
    }
    this.terrain.set(map, names);
    return names;
  }
}
