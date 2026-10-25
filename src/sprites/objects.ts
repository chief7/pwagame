import { PALETTE as P } from './palette';
import { fromRows, hash2, Sprite } from './pixel';

interface Blob {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Shade overlapping ellipses as rock, lit from the top left. */
function drawRocks(s: Sprite, blobs: readonly Blob[], seed: number, mossy = false): void {
  for (const b of blobs) {
    for (let y = Math.floor(b.cy - b.ry); y <= Math.ceil(b.cy + b.ry); y++) {
      for (let x = Math.floor(b.cx - b.rx); x <= Math.ceil(b.cx + b.rx); x++) {
        const nx = (x + 0.5 - b.cx) / b.rx;
        const ny = (y + 0.5 - b.cy) / b.ry;
        if (nx * nx + ny * ny > 1) continue;
        const light = -0.6 * nx - 0.8 * ny + (hash2(x, y, seed) - 0.5) * 0.35;
        let color: string = light > 0.55 ? P.stoneLight : light > -0.05 ? P.stone : light > -0.6 ? P.stoneDark : P.stoneDeep;
        if (mossy && ny < -0.2 && hash2(x, y, seed + 1) < 0.55) color = P.moss;
        s.set(x, y, color);
      }
    }
  }
}

export function boulder(): Sprite {
  const s = new Sprite('stone_boulder');
  drawRocks(s, [{ cx: 8, cy: 9.5, rx: 6, ry: 5 }], 21);
  // A crack running down the face.
  for (const [x, y] of [[9, 6], [9, 7], [10, 8], [10, 9], [11, 10]]) s.set(x, y, P.stoneDeep);
  return s.outline().shadow(8.5, 14.5, 7, 1.6);
}

export function pebbles(): Sprite {
  const s = new Sprite('stone_pebbles');
  drawRocks(s, [
    { cx: 5, cy: 11, rx: 3.2, ry: 2.6 },
    { cx: 11, cy: 12, rx: 2.6, ry: 2 },
    { cx: 9, cy: 6.5, rx: 2.2, ry: 1.8 },
  ], 22);
  return s.outline().shadow(8, 14.5, 7, 1.4);
}

export function mossyStone(): Sprite {
  const s = new Sprite('stone_mossy');
  drawRocks(s, [{ cx: 8, cy: 11, rx: 6.5, ry: 3.4 }, { cx: 6, cy: 9.5, rx: 3.5, ry: 2.5 }], 23, true);
  return s.outline().shadow(8.5, 14.6, 7.5, 1.3);
}

interface WoodColors {
  light: string;
  mid: string;
  dark: string;
  deep: string;
}

const LOG_WOOD: WoodColors = { light: P.woodLight, mid: P.wood, dark: P.woodDark, deep: P.woodDeep };
const DRIFT_WOOD: WoodColors = { light: P.driftLight, mid: P.drift, dark: P.driftDark, deep: P.driftDeep };

/** Side view of a log from x0 to x1 (cut end on the right), t pixels thick. */
function drawLog(s: Sprite, x0: number, x1: number, y0: number, t: number, c: WoodColors, seed: number, cutEnd = true): void {
  for (let x = x0; x <= x1; x++) {
    for (let r = 0; r < t; r++) {
      let color = r === 0 ? c.light : r === t - 1 ? c.deep : r < t / 2 ? c.mid : c.dark;
      if (r > 0 && r < t - 1 && hash2(x, 0, seed) < 0.2) color = c.dark; // bark grooves
      s.set(x, y0 + r, color);
    }
  }
  if (!cutEnd) return;
  for (let r = 0; r < t; r++) {
    const rim = r === 0 || r === t - 1;
    s.set(x1, y0 + r, rim ? c.dark : P.woodCut);
    if (!rim) s.set(x1 + 1, y0 + r, r === Math.floor(t / 2) ? P.woodRing : P.woodCut);
  }
}

export function log(): Sprite {
  const s = new Sprite('log');
  drawLog(s, 1, 12, 9, 5, LOG_WOOD, 31);
  // A knot in the bark.
  s.set(5, 11, P.woodDeep);
  s.set(6, 11, P.woodDark);
  return s.outline().shadow(7.5, 14.6, 7.5, 1.3);
}

/** Pile seen end-on: three cut ends stacked in a pyramid. */
export function logPile(): Sprite {
  const s = new Sprite('log_pile');
  for (const [cx, cy] of [[4.5, 11], [11.5, 11], [8, 5.5]]) {
    for (let y = Math.floor(cy - 3.5); y <= Math.ceil(cy + 3.5); y++) {
      for (let x = Math.floor(cx - 3.5); x <= Math.ceil(cx + 3.5); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > 3.4) continue;
        // Bark rim lit from the top left, then pale cut wood with a ring and pith.
        const lit = x + y + 1 < cx + cy;
        const color = d > 2.5 ? (lit ? P.wood : P.woodDeep)
          : d > 1.6 ? P.woodCut
          : d > 0.9 ? P.woodRing
          : P.woodCut;
        s.set(x, y, color);
      }
    }
  }
  return s.outline().shadow(8, 14.8, 8, 1.2);
}

export function driftwood(): Sprite {
  const s = new Sprite('log_driftwood');
  drawLog(s, 1, 14, 10, 3, DRIFT_WOOD, 33, false);
  // A broken-off branch, a knot and a gnarled end, bleached by the sun.
  for (const [x, y, c] of [
    [3, 9, P.driftLight], [4, 9, P.drift], [2, 8, P.driftLight], [3, 8, P.drift], [2, 7, P.driftLight],
    [11, 13, P.driftDark], [12, 13, P.driftDeep],
    [0, 11, P.driftDark], [7, 11, P.driftDeep], [8, 11, P.driftDark],
  ] as const) s.set(x, y, c);
  return s.outline().shadow(8, 14.6, 8, 1.1);
}

const CHEST_KEY = {
  '.': null,
  k: P.outline,
  o: P.woodLight,
  B: P.wood,
  b: P.woodDark,
  d: P.woodDeep,
  Y: P.gold,
  n: P.goldDark,
  e: P.goldLight,
  a: P.shadow,
};

export function chestClosed(): Sprite {
  return fromRows('chest_closed', [
    '................',
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..kooooooooook..',
    '.koBBBBBBBBBBok.',
    '.kBBBBBBBBBBBBk.',
    '.knnnnnYYnnnnnk.',
    '.kbbbbkYYkbbbbk.',
    '.kBBBBkYnkBBBBk.',
    '.kBBBBBkkBBBBBk.',
    '.knBBBBBBBBBBnk.',
    '.knbbbbbbbbbbnk.',
    '.kkkkkkkkkkkkkk.',
    '..aaaaaaaaaaaa..',
    '................',
  ], CHEST_KEY);
}

export function chestOpen(): Sprite {
  return fromRows('chest_open', [
    '.......e........',
    '...kkkkkkkkkk...',
    '..kbbbbbbbbbbk..',
    '..kddddddddddk..',
    '..knnnnnnnnnnk..',
    '.kkkkkkkkkkkkkk.',
    '.kdYYeYYYYeYYdk.',
    '.knnnnnYYnnnnnk.',
    '.kbbbbkYYkbbbbk.',
    '.kBBBBkYnkBBBBk.',
    '.kBBBBBkkBBBBBk.',
    '.knBBBBBBBBBBnk.',
    '.knbbbbbbbbbbnk.',
    '.kkkkkkkkkkkkkk.',
    '..aaaaaaaaaaaa..',
    '................',
  ], CHEST_KEY);
}

export function stalagmite(): Sprite {
  const s = new Sprite('stalagmite');
  // A lumpy cone of cave rock, lit from the left.
  for (let y = 2; y <= 14; y++) {
    const half = 0.5 + (y - 2) * 0.42;
    for (let x = Math.floor(8 - half); x <= Math.ceil(7 + half); x++) {
      const side = (x + 0.5 - 7.5) / (half + 0.5);
      if (Math.abs(side) > 1) continue;
      const n = hash2(x, y, 51);
      s.set(x, y, side < -0.3 ? P.rockLight : side > 0.45 ? P.rockFaceDark : n < 0.2 ? P.rockDark : P.rock);
    }
  }
  return s.outline().shadow(8, 14.8, 6, 1.2);
}

/** A small pool of fresh water ringed with stones. */
export function spring(): Sprite {
  const s = new Sprite('spring');
  for (let y = 4; y <= 14; y++) {
    for (let x = 1; x <= 14; x++) {
      const d = Math.hypot((x + 0.5 - 8) / 6.5, (y + 0.5 - 9.5) / 4.8);
      if (d > 1) continue;
      if (d > 0.75) {
        const n = hash2(x, y, 52);
        s.set(x, y, y < 9 ? (n < 0.5 ? P.stoneLight : P.stone) : n < 0.5 ? P.stone : P.stoneDark);
      } else {
        s.set(x, y, y < 8 ? P.waterDeep : hash2(x, y, 53) < 0.12 ? P.waterGlint : P.waterShallow);
      }
    }
  }
  s.set(6, 9, P.foam);
  s.set(7, 9, P.waterGlint);
  s.set(10, 11, P.waterGlint);
  return s.outline().shadow(8, 14.6, 7, 1.2);
}
