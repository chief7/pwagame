import { PALETTE } from './palette';

export type Color = string | null;

/** A small grid of colors; null is transparent. Drawn bottom-centre on its tile. */
export class Sprite {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly pixels: Color[];

  constructor(name: string, width = 16, height = 16) {
    this.name = name;
    this.width = width;
    this.height = height;
    this.pixels = new Array<Color>(width * height).fill(null);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): Color {
    return this.inBounds(x, y) ? this.pixels[y * this.width + x] : null;
  }

  set(x: number, y: number, color: Color): void {
    x = Math.round(x);
    y = Math.round(y);
    if (this.inBounds(x, y)) this.pixels[y * this.width + x] = color;
  }

  /** Fill every pixel from a function of its position (for tiles). */
  paint(fn: (x: number, y: number) => Color): this {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) this.pixels[y * this.width + x] = fn(x, y);
    }
    return this;
  }

  /** Ring every opaque shape with a 1px outline (4-way). Call before shadow(). */
  outline(color: string = PALETTE.outline): this {
    const edge: number[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) {
          edge.push(y * this.width + x);
        }
      }
    }
    for (const i of edge) this.pixels[i] = color;
    return this;
  }

  /** Soft ground shadow, painted only where nothing else is drawn. */
  shadow(cx: number, cy: number, rx: number, ry: number): this {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && !this.get(x, y)) this.set(x, y, PALETTE.shadow);
      }
    }
    return this;
  }
}

/** Build a sprite from rows of single-character palette keys. */
export function fromRows(name: string, rows: readonly string[], key: Readonly<Record<string, Color>>): Sprite {
  const width = rows[0].length;
  const sprite = new Sprite(name, width, rows.length);
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${name}: row ${y} is ${row.length} wide, expected ${width}`);
    [...row].forEach((ch, x) => {
      if (!(ch in key)) throw new Error(`${name}: unknown key '${ch}' at ${x},${y}`);
      sprite.set(x, y, key[ch]);
    });
  });
  return sprite;
}

/** Deterministic per-pixel noise in [0, 1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
