import { OBJECTS } from '../game/defs/objects';
import type { Game } from '../game/game';
import { Tile, type GameMap } from '../game/map';
import { hash2 } from '../sprites/pixel';
import { bake, buildSprites, grassTileName, riverBankTileName, shoreTileName, type Sprite } from '../sprites';
import { characterName } from '../sprites/characters';
import type { Animator } from './animator';

export type Body = 'male' | 'female';

const TILE = 16;
const FOG = '#0a1720';
/** Ground tint for the Wild sense skill. */
const DANGER = 'rgba(255, 70, 90, 0.2)';
const DANGER_EDGE = 'rgba(240, 50, 70, 0.85)';
const DIM = 'rgba(10, 23, 32, 0.55)';
/** Aim for about this many tiles across a phone screen. */
const TILES_ACROSS = 12;
/** Upper bound on cell size in CSS pixels, so desktops see more map. */
const MAX_CELL_CSS = 48;
/** How often the sea swaps glint patterns. */
const WATER_FRAME_MS = 750;
const WATER_TILES = ['water', 'water_2', 'water_3'];
const RIVER_TILES = ['river', 'river_2'];
const FIRE_FRAME_MS = 220;
/** Night tint; its alpha comes from how dark a cell is. */
const NIGHT_RGB = '10, 16, 42';
const NIGHT_MAX = 0.62;
/** Same pixel font as the page (src/fonts.css). */
const FONT = "'Pixelify Sans', ui-monospace, Menlo, Consolas, monospace";

/**
 * The font's fi and fl ligatures draw as a wrong glyph, and a canvas can't
 * turn ligatures off, so a zero-width non-joiner keeps the letters apart.
 */
function noLigatures(text: string): string {
  return text.replace(/f(?=[il])/g, 'f\u200c');
}

interface Baked {
  sprite: Sprite;
  canvas: HTMLCanvasElement;
  /** White silhouette for hit flashes, made on first use. */
  flash?: HTMLCanvasElement;
}

/**
 * Draws the island from pixel-art sprites, scaled by a whole number so
 * pixels stay crisp. Works in device pixels; the player sits mid-screen.
 */
export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprites = new Map<string, Baked>();
  /** Terrain sprite per cell, worked out once per island ('~' is animated sea, '≈' the river). */
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

  /** Where the camera looks, in (fractional) cells; follows the player's drawn position. */
  private camera = { x: 0, y: 0 };

  /** Device-pixel position of world cell (0, 0). */
  private origin(): { x: number; y: number } {
    return {
      x: Math.round(this.canvas.width / 2 - this.cell / 2 - this.camera.x * this.cell),
      y: Math.round(this.canvas.height / 2 - this.cell / 2 - this.camera.y * this.cell),
    };
  }

  /** World cell under a point given in CSS pixels relative to the canvas. */
  cellAt(cssX: number, cssY: number): { x: number; y: number } {
    const o = this.origin();
    return {
      x: Math.floor((cssX * this.dpr - o.x) / this.cell),
      y: Math.floor((cssY * this.dpr - o.y) / this.cell),
    };
  }

  /** Top centre of a world cell in CSS pixels relative to the canvas, as of the last frame. */
  cellTop(x: number, y: number): { x: number; y: number } {
    const o = this.origin();
    return { x: (o.x + (x + 0.5) * this.cell) / this.dpr, y: (o.y + y * this.cell) / this.dpr };
  }

  /** Centre of the player's cell in CSS pixels relative to the canvas. */
  playerCenter(): { x: number; y: number } {
    return { x: this.canvas.clientWidth / 2, y: this.canvas.clientHeight / 2 };
  }

  render(game: Game, anim: Animator, now: number): void {
    const { ctx, cell } = this;
    const { map, player } = game;
    const playerPose = anim.pose(player.id, player.x, player.y, now);
    this.camera = { x: playerPose.x, y: playerPose.y };
    const o = this.origin();
    const x0 = Math.floor(-o.x / cell) - 1;
    const y0 = Math.floor(-o.y / cell) - 1;
    const x1 = Math.ceil((this.canvas.width - o.x) / cell);
    const y1 = Math.ceil((this.canvas.height - o.y) / cell);
    const terrain = this.terrainFor(map);
    const waterTick = anim.reducedMotion ? 0 : Math.floor(now / WATER_FRAME_MS);
    const riverTick = anim.reducedMotion ? 0 : Math.floor(now / FIRE_FRAME_MS);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.fillStyle = FOG;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!map.isExplored(x, y)) continue;
        let name = terrain[map.idx(x, y)];
        if (name === '~') name = WATER_TILES[(Math.floor(hash2(x, y, 51) * 3) + waterTick) % 3];
        else if (name === '≈') name = RIVER_TILES[riverTick % 2];
        this.drawTile(name, o.x + x * cell, o.y + y * cell);
      }
    }

    // Wild sense: a red tint on the ground where an animal would come after you.
    const danger = game.dangerCells();
    if (danger.size) {
      const t = this.scale;
      for (const i of danger) {
        const x = i % map.width;
        const y = (i - x) / map.width;
        if (!map.isVisible(x, y)) continue;
        const px = o.x + x * cell;
        const py = o.y + y * cell;
        ctx.fillStyle = DANGER;
        ctx.fillRect(px, py, cell, cell);
        // A border where the red area ends, so it reads as red on any ground.
        ctx.fillStyle = DANGER_EDGE;
        const inside = (dx: number, dy: number) => danger.has(map.idx(x + dx, y + dy));
        if (!inside(0, -1)) ctx.fillRect(px, py, cell, t);
        if (!inside(0, 1)) ctx.fillRect(px, py + cell - t, cell, t);
        if (!inside(-1, 0)) ctx.fillRect(px, py, t, cell);
        if (!inside(1, 0)) ctx.fillRect(px + cell - t, py, t, cell);
      }
    }

    // Actors are drawn in the row they're nearest to, so they tuck behind
    // trees in the row below while walking.
    const actors: { id: number; name: string; pose: ReturnType<Animator['pose']>; bob: number }[] = [];
    for (const a of game.animals) {
      if (!map.isVisible(a.x, a.y)) continue;
      const pose = anim.pose(a.id, a.x, a.y, now);
      actors.push({ id: a.id, name: `animal_${a.kind}`, pose, bob: pose.hop ? 0 : anim.idleBob(a.id, now) });
    }
    actors.push({
      id: player.id,
      name: characterName(this.body, player.facing, playerPose.frame),
      pose: { ...playerPose, hop: 0 },
      bob: playerPose.frame ? 0 : anim.idleBob(player.id, now),
    });
    const fireFrame = anim.reducedMotion ? 0 : Math.floor(now / FIRE_FRAME_MS);

    // Row by row so tall sprites (trees, huts) overlap whatever stands behind them.
    // Extra rows below the screen let their tops reach up into view.
    for (let y = y0; y <= y1 + 2; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!map.isExplored(x, y)) continue;
        const obj = game.objectAt(x, y);
        if (!obj) continue;
        const frames = OBJECTS[obj.kind].frames;
        const name = frames ? frames[fireFrame % frames.length] : game.objectSprite(obj);
        this.drawStanding(name, o.x + x * cell, o.y + y * cell);
      }
      for (const a of actors) {
        if (Math.round(a.pose.y) !== y) continue;
        const sx = Math.round(o.x + a.pose.x * cell);
        const sy = Math.round(o.y + a.pose.y * cell - (a.pose.hop + a.bob) * this.scale);
        this.drawStanding(a.name, sx, sy);
        if (a.pose.flash > 0) {
          ctx.globalAlpha = a.pose.flash * 0.85;
          this.drawStanding(a.name, sx, sy, true);
          ctx.globalAlpha = 1;
        }
      }
    }

    this.drawNight(game, o, x0, y0, x1, y1, playerPose);

    // Remembered cells dim; unknown cells stay hidden, even under overhanging crowns.
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (map.isVisible(x, y)) continue;
        ctx.fillStyle = map.isExplored(x, y) ? DIM : FOG;
        ctx.fillRect(o.x + x * cell, o.y + y * cell, cell, cell);
      }
    }

    this.drawSparkles(anim, map, o, now);
    this.drawFloats(anim, map, o, now);

    const fade = anim.fade(now);
    if (fade > 0) {
      ctx.globalAlpha = fade;
      ctx.fillStyle = FOG;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Darken the scene by time of day. Campfires light a pool around them and
   * the explorer always sees a little around themselves.
   */
  private drawNight(game: Game, o: { x: number; y: number }, x0: number, y0: number, x1: number, y1: number, pose: { x: number; y: number }): void {
    const day = game.daylight;
    if (day >= 1) return;
    const lights = game.lights();
    const { ctx, cell } = this;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let light = Math.max(day, 0.45 - Math.hypot(x - pose.x, y - pose.y) * 0.12);
        for (const [lx, ly, r] of lights) {
          light = Math.max(light, 1 - Math.hypot(x - lx, y - ly) / (r + 1));
        }
        const dark = (1 - Math.min(1, light)) * NIGHT_MAX;
        if (dark <= 0.01) continue;
        ctx.fillStyle = `rgba(${NIGHT_RGB}, ${dark.toFixed(3)})`;
        ctx.fillRect(o.x + x * cell, o.y + y * cell, cell, cell);
      }
    }
  }

  private drawSparkles(anim: Animator, map: GameMap, o: { x: number; y: number }, now: number): void {
    const { ctx, scale, cell } = this;
    for (const s of anim.sparkles) {
      const p = anim.progress(s.start, anim.sparkleMs, now);
      if (p === null || !map.isVisible(s.x, s.y)) continue;
      const cx = o.x + s.x * cell + cell / 2;
      const cy = o.y + s.y * cell + cell / 2;
      ctx.globalAlpha = 1 - p;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + p;
        const r = (0.2 + p * 0.6) * cell;
        ctx.fillStyle = i % 2 ? '#fff1b0' : '#f2c14e';
        ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r - p * cell * 0.3), scale, scale);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawFloats(anim: Animator, map: GameMap, o: { x: number; y: number }, now: number): void {
    const { ctx, scale, cell } = this;
    ctx.font = `bold ${7 * scale}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2 * scale;
    for (const f of anim.floats) {
      const p = anim.progress(f.start, anim.floatMs, now);
      if (p === null || !map.isVisible(f.x, f.y)) continue;
      const x = o.x + f.x * cell + cell / 2;
      const y = o.y + f.y * cell - p * cell * 0.6;
      ctx.globalAlpha = p < 0.7 ? 1 : (1 - p) / 0.3;
      ctx.strokeStyle = '#20180f';
      const text = noLigatures(f.text);
      ctx.strokeText(text, x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(text, x, y);
    }
    ctx.globalAlpha = 1;
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

  /** A sprite as an image URL at a whole-number scale, for HTML panels. */
  iconURL(name: string, scale = 3): string {
    const baked = this.sprites.get(name);
    if (!baked) return '';
    const c = document.createElement('canvas');
    c.width = baked.sprite.width * scale;
    c.height = baked.sprite.height * scale;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(baked.canvas, 0, 0, c.width, c.height);
    return c.toDataURL();
  }

  private drawTile(name: string, sx: number, sy: number): void {
    const baked = this.sprites.get(name);
    if (baked) this.ctx.drawImage(baked.canvas, sx, sy, this.cell, this.cell);
  }

  /** Draw a sprite bottom-centre on the cell at (sx, sy); `flash` draws its white silhouette. */
  private drawStanding(name: string, sx: number, sy: number, flash = false): void {
    const baked = this.sprites.get(name);
    if (!baked) return;
    const w = baked.sprite.width * this.scale;
    const h = baked.sprite.height * this.scale;
    const image = flash ? this.flashOf(baked) : baked.canvas;
    this.ctx.drawImage(image, sx + this.cell / 2 - w / 2, sy + this.cell - h, w, h);
  }

  private flashOf(baked: Baked): HTMLCanvasElement {
    if (!baked.flash) {
      const c = document.createElement('canvas');
      c.width = baked.canvas.width;
      c.height = baked.canvas.height;
      const ctx = c.getContext('2d')!;
      // Only solid pixels, so the soft shadow doesn't flash.
      const data = baked.canvas.getContext('2d')!.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < data.data.length; i += 4) {
        const solid = data.data[i + 3] > 200;
        data.data[i] = data.data[i + 1] = data.data[i + 2] = 255;
        data.data[i + 3] = solid ? 255 : 0;
      }
      ctx.putImageData(data, 0, 0);
      baked.flash = c;
    }
    return baked.flash;
  }

  private terrainFor(map: GameMap): string[] {
    let names = this.terrain.get(map);
    if (names) return names;
    names = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        names.push(this.terrainName(map, x, y));
      }
    }
    this.terrain.set(map, names);
    return names;
  }

  private terrainName(map: GameMap, x: number, y: number): string {
    const roll = hash2(x, y, 52);
    switch (map.get(x, y)) {
      case Tile.Water:
        return '~';
      case Tile.River:
        return '≈';
      case Tile.Sand: {
        const shore = shoreTileName((dx, dy) => map.isWet(x + dx, y + dy));
        if (shore !== 'sand') return shore;
        return roll < 0.72 ? 'sand' : roll < 0.94 ? 'sand_ripples' : 'sand_shell';
      }
      case Tile.Grass: {
        const bank = riverBankTileName((dx, dy) => map.get(x + dx, y + dy) === Tile.River);
        if (bank !== 'grass') return bank;
        const edge = grassTileName((dx, dy) => map.get(x + dx, y + dy) === Tile.Sand);
        if (edge !== 'grass') return edge;
        return roll < 0.88 ? 'grass' : 'grass_flowers';
      }
      case Tile.Rock:
        return map.get(x, y + 1) === Tile.Rock ? 'rock_top' : 'rock_face';
      default:
        return roll < 0.8 ? 'cave_floor' : 'cave_floor_2';
    }
  }
}
