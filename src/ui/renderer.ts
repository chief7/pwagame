import { Tile } from '../game/map';
import type { Game } from '../game/game';

const COLORS = {
  background: '#0b0d10',
  wall: '#5b4a36',
  wallLit: '#8a6f4d',
  floor: '#2a2f35',
  floorDot: '#4a525b',
  stairs: '#f2c14e',
  tonic: '#e05d8a',
};

/** Draws the map as a grid of glyph cells, camera centred on the player. */
export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private cell = 24;
  private cols = 0;
  private rows = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not supported');
    this.ctx = ctx;
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Aim for roughly 19 cells across on a phone, larger cells on big screens.
    this.cell = Math.max(18, Math.min(36, Math.floor(w / 19)));
    this.cols = Math.ceil(w / this.cell) + 1;
    this.rows = Math.ceil(h / this.cell) + 1;
  }

  get cellSize(): number {
    return this.cell;
  }

  /** Top-left world cell of the view and the pixel offset that centres the player. */
  private camera(game: Game) {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const px = w / 2 - this.cell / 2;
    const py = h / 2 - this.cell / 2;
    const offX = Math.ceil(px / this.cell);
    const offY = Math.ceil(py / this.cell);
    return {
      startX: game.player.x - offX,
      startY: game.player.y - offY,
      originX: px - offX * this.cell,
      originY: py - offY * this.cell,
    };
  }

  /** Screen-space centre of the player's cell, in CSS pixels relative to the canvas. */
  playerCenter(): { x: number; y: number } {
    return { x: this.canvas.clientWidth / 2, y: this.canvas.clientHeight / 2 };
  }

  render(game: Game): void {
    const { ctx, cell } = this;
    const { map } = game;
    const cam = this.camera(game);

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    ctx.font = `${Math.floor(cell * 0.8)}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const glyph = (sx: number, sy: number, ch: string, color: string) => {
      ctx.fillStyle = color;
      ctx.fillText(ch, sx + cell / 2, sy + cell / 2 + 1);
    };

    for (let r = 0; r < this.rows + 1; r++) {
      for (let c = 0; c < this.cols + 1; c++) {
        const x = cam.startX + c;
        const y = cam.startY + r;
        if (!map.inBounds(x, y)) continue;
        const i = map.idx(x, y);
        if (!map.explored[i]) continue;
        const visible = map.visible[i] === 1;
        const sx = cam.originX + c * cell;
        const sy = cam.originY + r * cell;

        ctx.globalAlpha = visible ? 1 : 0.35;
        const tile = map.tiles[i];
        if (tile === Tile.Wall) {
          ctx.fillStyle = visible ? shade(COLORS.wallLit, x, y) : COLORS.wall;
          ctx.fillRect(sx, sy, cell, cell);
        } else {
          ctx.fillStyle = COLORS.floor;
          ctx.fillRect(sx, sy, cell, cell);
          if (tile === Tile.Stairs) glyph(sx, sy, '>', COLORS.stairs);
          else glyph(sx, sy, '·', COLORS.floorDot);
        }
      }
    }
    ctx.globalAlpha = 1;

    const toScreen = (x: number, y: number) => ({
      sx: cam.originX + (x - cam.startX) * cell,
      sy: cam.originY + (y - cam.startY) * cell,
    });

    for (const item of game.items) {
      if (!map.isVisible(item.x, item.y)) continue;
      const { sx, sy } = toScreen(item.x, item.y);
      glyph(sx, sy, '!', COLORS.tonic);
    }

    ctx.font = `bold ${Math.floor(cell * 0.85)}px ui-monospace, Menlo, Consolas, monospace`;
    for (const m of game.monsters) {
      if (!map.isVisible(m.x, m.y)) continue;
      const { sx, sy } = toScreen(m.x, m.y);
      ctx.fillStyle = COLORS.floor;
      ctx.fillRect(sx, sy, cell, cell);
      glyph(sx, sy, m.glyph, m.color);
      if (m.hp < m.maxHp) {
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(sx + 2, sy + cell - 3, (cell - 4) * (m.hp / m.maxHp), 2);
      }
    }

    const p = toScreen(game.player.x, game.player.y);
    glyph(p.sx, p.sy, '@', game.over ? '#777' : game.player.color);
  }
}

/** Slight per-cell variation so walls read as rock rather than flat blocks. */
function shade(hex: string, x: number, y: number): string {
  const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  const delta = (h % 21) - 10;
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, v + delta));
  return `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 0xff)}, ${ch(n & 0xff)})`;
}
