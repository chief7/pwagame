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

/** What hangs on a steep step once the explorer makes it climbable. */
export type ClimbAid = 'none' | 'ladder' | 'rope';

interface StepColors {
  top: string;
  topLight: string;
  face: string;
  faceLight: string;
  faceDark: string;
}

const LEDGE_COLORS: StepColors = {
  top: P.scree, topLight: P.screeLight, face: P.rockFace, faceLight: P.rockFaceLight, faceDark: P.rockFaceDark,
};
const ICE_COLORS: StepColors = {
  top: P.snow, topLight: P.snowLight, face: P.ice, faceLight: P.iceLight, faceDark: P.iceDark,
};

/** A steep step of rock (or ice): a flat top and a tall face towards the viewer. */
function drawStep(s: Sprite, c: StepColors, seed: number): void {
  for (let x = 1; x <= 14; x++) {
    // The top edge dips a little, so the band does not look like a wall of bricks.
    const top = 2 + Math.round(hash2(x >> 1, 0, seed) * 1.5);
    // Round the four corners.
    const edge = x === 1 || x === 14;
    for (let y = top + (edge ? 1 : 0); y <= (edge ? 13 : 14); y++) {
      const lip = y <= top + 2;
      const strata = (x + (hash2(x >> 2, 1, seed) < 0.5 ? 0 : 1)) % 4 === 0;
      let col: string;
      if (lip) col = y === top || x < 5 ? c.topLight : c.top;
      else if (y === top + 3) col = c.faceLight;
      else if (strata || x > 12 || y === 14) col = c.faceDark;
      else col = hash2(x, y, seed + 1) < 0.12 ? c.faceLight : c.face;
      s.set(x, y, col);
    }
  }
}

function drawLadder(s: Sprite): void {
  for (let y = 0; y <= 14; y++) {
    s.set(5, y, P.woodLight);
    s.set(10, y, P.woodDark);
    if (y % 3 === 1) for (let x = 6; x <= 9; x++) s.set(x, y, x === 6 ? P.woodLight : P.wood);
  }
  // Rope lashings where the rungs meet the rails.
  for (const y of [4, 10]) {
    s.set(5, y, P.strawLight);
    s.set(10, y, P.straw);
  }
}

function drawRope(s: Sprite): void {
  // A wooden stake on the top, the rope hangs down the face with knots to hold on to.
  for (let y = 0; y <= 3; y++) s.set(7, y, y === 0 ? P.woodLight : P.wood);
  s.set(8, 1, P.woodDark);
  s.set(8, 2, P.woodDark);
  s.set(6, 2, P.straw);
  for (let y = 3; y <= 15; y++) {
    const x = 8 + (y % 6 < 3 ? 0 : 1);
    const knot = y % 4 === 2;
    s.set(x - 1, y, knot ? P.strawDark : P.strawLight);
    s.set(x, y, knot ? P.strawDark : P.straw);
    if (knot) s.set(x + 1, y, P.strawDeep);
  }
}

function stepSprite(name: string, c: StepColors, seed: number, aid: ClimbAid): Sprite {
  const s = new Sprite(name);
  drawStep(s, c, seed);
  if (aid === 'ladder') drawLadder(s);
  if (aid === 'rope') drawRope(s);
  return s.outline().shadow(8, 15, 7.5, 1);
}

/** A rocky step in the mountain scree: too steep to walk up without a ladder. */
export function ledge(aid: 'none' | 'ladder' = 'none'): Sprite {
  return stepSprite(aid === 'none' ? 'ledge' : 'ledge_ladder', LEDGE_COLORS, 61, aid);
}

/** An icy wall below the peak: the explorer needs a climbing rope. */
export function iceWall(aid: 'none' | 'rope' = 'none'): Sprite {
  return stepSprite(aid === 'none' ? 'ice_wall' : 'ice_wall_rope', ICE_COLORS, 62, aid);
}

/**
 * An old barrel washed up on the tide islet, standing up, with sticky tar
 * under its lid and running down its side.
 */
export function barrel(): Sprite {
  const s = new Sprite('barrel');
  const span = (y: number): [number, number] => (y === 3 || y === 14 ? [5, 10] : y === 4 || y === 13 ? [4, 11] : [3, 12]);
  for (let y = 3; y <= 14; y++) {
    const [x0, x1] = span(y);
    for (let x = x0; x <= x1; x++) {
      let c: string;
      if (y <= 4) {
        const rim = x === x0 || x === x1 || (y === 3 && (x === x0 + 1 || x === x1 - 1));
        c = rim ? P.woodLight : y === 4 && (x === 6 || x === 7) ? P.tarShine : P.tar;
      } else if (y === 6 || y === 12) {
        c = x <= 5 ? P.hoopLight : P.hoop;
      } else {
        const seam = (x - 3) % 3 === 2;
        c = x <= 4 ? P.woodLight : x >= 11 ? P.woodDark : seam ? P.woodDark : hash2(x, y, 63) < 0.12 ? P.woodDeep : P.wood;
      }
      s.set(x, y, c);
    }
  }
  // Thick runs of tar down the front, from under the lid.
  for (const [x, y0, y1] of [[7, 5, 9], [8, 5, 11], [9, 5, 7], [10, 5, 8]]) {
    for (let y = y0; y <= y1; y++) s.set(x, y, y === y1 ? P.tarLight : P.tar);
  }
  s.set(7, 5, P.tarShine);
  return s.outline().shadow(8, 15, 6.5, 1.2);
}

/** An empty barrel: tipped over on its side, the open end dark and bare. */
export function barrelEmpty(): Sprite {
  const s = new Sprite('barrel_empty');
  for (let y = 7; y <= 14; y++) {
    // A little bulge in the middle, like a barrel.
    const [x0, x1] = y === 7 || y === 14 ? [3, 10] : [2, 11];
    for (let x = x0; x <= x1; x++) {
      const seam = (y - 7) % 3 === 2;
      const hoop = x === 4 || x === 9;
      s.set(x, y, hoop ? (y <= 9 ? P.hoopLight : P.hoop) : y <= 8 ? P.woodLight : y >= 13 ? P.woodDark : seam ? P.woodDark : P.wood);
    }
  }
  // The open end, facing right: a rim of wood round the dark inside.
  for (let y = 7; y <= 14; y++) {
    for (let x = 11; x <= 14; x++) {
      const d = Math.hypot((x + 0.5 - 12.5) / 2.2, (y + 0.5 - 11) / 4.1);
      if (d > 1) continue;
      s.set(x, y, d > 0.62 ? (y <= 9 ? P.woodCut : P.woodRing) : y <= 9 ? P.woodDeep : P.interior);
    }
  }
  return s.outline().shadow(8, 15, 7, 1.2);
}

/**
 * A sandbar between the tide islet and the island, along its walking way
 * (`ns` north–south, `ew` east–west), 16×16 over a sea tile. Dry at low
 * tide: wet sand with a line of foam. Under water at high tide (`wet`):
 * only a lighter strip of shallow water shows where it is.
 */
export function sandbar(dir: 'ns' | 'ew', wet = false): Sprite {
  const s = new Sprite(`sandbar_${dir}${wet ? '_wet' : ''}`);
  for (let a = 0; a < 16; a++) {
    // Period 16, so neighbouring cells of the bar line up.
    const half = 4 + Math.sin((a / 16) * Math.PI * 2) * 0.9;
    for (let b = 0; b < 16; b++) {
      const [x, y] = dir === 'ns' ? [b, a] : [a, b];
      const d = Math.abs(b + 0.5 - 8);
      const n = hash2(x, y, wet ? 65 : 64);
      let c: string | null = null;
      if (wet) {
        if (d < half - 0.5) c = n < 0.12 ? P.waterGlint : P.waterShallow;
        else if (d < half + 0.8 && n < 0.55) c = P.waterShallow;
      } else if (d < half - 0.6) {
        // Wet sand, lighter where it dries in the middle.
        c = n < 0.1 ? P.sandDark : n < 0.3 ? P.sandMid : d < 1.5 && n > 0.75 ? P.sand : P.sandWet;
        if (n > 0.985) c = P.shell;
      } else if (d < half + 0.4) c = P.foam;
      else if (d < half + 1.8) c = n < 0.15 ? P.waterGlint : P.waterShallow;
      s.set(x, y, c);
    }
  }
  return s;
}

// ---- Deep caves --------------------------------------------------------------------

/** One glowcap: a pale stem under a round, glowing cap with bright spots. */
function drawGlowcap(s: Sprite, cx: number, base: number, size: number, bright: boolean): void {
  for (let y = base - size; y <= base; y++) {
    s.set(cx, y, P.glowcapStem);
    s.set(cx + 1, y, P.glowcapStemShade);
  }
  const top = base - size - 3;
  for (let y = top; y <= top + 3; y++) {
    const w = y === top ? size - 1 : y === top + 3 ? size + 1 : size;
    for (let x = cx - w + 1; x <= cx + w; x++) {
      const lit = x <= cx && y <= top + 1;
      s.set(x, y, y === top + 3 ? P.glowcapDark : lit ? P.glowcapLight : P.glowcap);
    }
  }
  s.set(cx - 1, top + 1, bright ? P.glowcapGlow : P.glowcapLight);
  s.set(cx + 2, top + 2, bright ? P.glowcapLight : P.glowcapGlow);
}

/** A clump of glowing mushrooms; frame 2 lets the spots twinkle. */
function glowcapShape(name: string, bright: boolean): Sprite {
  const s = new Sprite(name);
  drawGlowcap(s, 5, 13, 3, bright);
  drawGlowcap(s, 11, 13, 2, !bright);
  drawGlowcap(s, 8, 14, 1, bright);
  return s.outline().shadow(8, 14.8, 6.5, 1);
}

export function glowcap(): Sprite[] {
  return [glowcapShape('glowcap', false), glowcapShape('glowcap_2', true)];
}

/** Picked glowcaps: only the stubs of the stems are left. */
export function glowcapPicked(): Sprite {
  const s = new Sprite('glowcap_picked');
  for (const [x, y0] of [[5, 11], [11, 12], [8, 13]]) {
    for (let y = y0; y <= 14; y++) {
      s.set(x, y, P.glowcapStem);
      s.set(x + 1, y, P.glowcapStemShade);
    }
    s.set(x, y0, P.glowcapDark);
  }
  return s.outline().shadow(8, 14.8, 6, 1);
}

/** Crystals grow from a lump of cave rock: three six-sided shards, lit from the left. */
export function crystalCluster(): Sprite {
  const s = new Sprite('crystal_cluster');
  // The rock they grow from.
  for (let y = 11; y <= 14; y++) {
    for (let x = 2; x <= 13; x++) {
      const d = Math.hypot((x + 0.5 - 8) / 6, (y + 0.5 - 14) / 3.4);
      if (d > 1) continue;
      s.set(x, y, y === 11 || x < 5 ? P.rockLight : x > 10 ? P.rockFaceDark : hash2(x, y, 81) < 0.25 ? P.rockDark : P.rock);
    }
  }
  // Shards: [base x, base y, top x, top y, half width].
  const shards: [number, number, number, number, number][] = [[5, 12, 2.5, 6, 1.1], [11, 12, 13, 5, 1.1], [8, 12, 7.5, 1, 1.6]];
  for (const [bx, by, tx, ty, hw] of shards) {
    const len = by - ty;
    for (let y = Math.floor(ty); y <= by; y++) {
      const t = (y - ty) / len;
      const cx = tx + (bx - tx) * t;
      const w = t < 0.25 ? hw * (t / 0.25) : hw;
      for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
        const side = (x + 0.5 - cx) / (w + 0.5);
        if (Math.abs(side) > 1) continue;
        const c = side < -0.35 ? P.crystalLight : side > 0.4 ? P.crystalDark : P.crystal;
        s.set(x, y, t < 0.25 && side > 0 ? P.crystalDark : c);
      }
    }
  }
  for (const [x, y] of [[7, 3], [7, 4], [3, 8], [12, 7]]) s.set(x, y, P.crystalShine);
  return s.outline().shadow(8, 14.8, 6.5, 1.2);
}

// ---- Island 3: the volcano -----------------------------------------------------------

/**
 * Flat basalt stones laid across a lava cell, 16×16, along the walking way
 * (`ns` north–south, `ew` east–west). The lava shows in the gaps.
 */
export function lavaStones(dir: 'ns' | 'ew'): Sprite {
  const s = new Sprite(`lava_stones_${dir}`);
  // Three slabs; the period is 16, so neighbouring cells line up.
  const slabs: [number, number, number, number][] = [[0, 3, 4, 11], [5, 10, 3, 12], [12, 15, 4, 11]];
  for (const [a0, a1, b0, b1] of slabs) {
    for (let a = a0; a <= a1; a++) {
      for (let b = b0; b <= b1; b++) {
        // a runs along the walking direction, b across it.
        const [x, y] = dir === 'ns' ? [b, a] : [a, b];
        const n = hash2(x, y, 140);
        const lit = a === a0 || b === b0;
        const dark = a === a1 || b === b1;
        s.set(x, y, dark ? P.basaltDeep : lit ? P.basaltLight : n < 0.2 ? P.basaltDark : P.basalt);
      }
    }
  }
  return s;
}

/** A small cone of dark rock round a vent hole, crusted with sulphur (or bare when `spent`). */
function drawVentMound(s: Sprite, spent: boolean): void {
  for (let y = 7; y <= 14; y++) {
    // Flat on top, wider towards the ground.
    const half = 2.5 + (y - 7) * 0.75;
    for (let x = 0; x < 16; x++) {
      const side = (x + 0.5 - 8) / half;
      if (Math.abs(side) > 1) continue;
      const n = hash2(x, y, 141);
      s.set(x, y, side < -0.4 ? P.basaltLight : side > 0.5 ? P.basaltDeep : n < 0.25 ? P.basaltDark : P.basalt);
    }
  }
  // The hole at the top.
  for (let x = 6; x <= 9; x++) s.set(x, 7, P.basaltDeep);
  if (spent) return;
  // Yellow sulphur round the hole and running down the sides.
  for (const [x, y, c] of [
    [5, 7, P.sulphurLight], [10, 7, P.sulphur], [5, 8, P.sulphur], [6, 8, P.sulphurLight], [9, 8, P.sulphur], [10, 8, P.sulphurDark],
    [4, 9, P.sulphurLight], [5, 9, P.sulphur], [10, 9, P.sulphur], [11, 9, P.sulphurDark], [4, 10, P.sulphur], [11, 10, P.sulphurDark],
    [3, 11, P.sulphur], [7, 9, P.sulphur], [8, 9, P.sulphurDark], [7, 10, P.sulphurDark], [12, 12, P.sulphurDark], [3, 12, P.sulphurDark],
  ] as const) s.set(x, y, c);
}

/** Puffs of steam rising from (cx, bottom); `frame` moves them up and sideways. */
function drawSteam(s: Sprite, cx: number, bottom: number, frame: 0 | 1, puffs: number): void {
  for (let i = 0; i < puffs; i++) {
    const y = bottom - 2 - i * 2.5 - frame;
    const x = cx + (i % 2 === frame ? -1 : 1);
    const r = 1.2 + Math.min(i, 2) * 0.6;
    for (let py = Math.floor(y - r); py <= Math.ceil(y + r); py++) {
      for (let px = Math.floor(x - r); px <= Math.ceil(x + r); px++) {
        if (Math.hypot(px - x, py - y) > r) continue;
        s.set(px, py, px <= x && py <= y ? P.steamLight : P.steam);
      }
    }
  }
}

function ventSprite(name: string, frame: 0 | 1, spent: boolean): Sprite {
  const s = new Sprite(name);
  drawVentMound(s, spent);
  s.outline();
  // The steam goes over the outline, soft and without one.
  drawSteam(s, 7.5, 7, frame, spent ? 1 : 3);
  return s.shadow(8, 15, 7, 1.2);
}

/** A steaming vent near the crater with yellow sulphur round it; 2 frames for the steam. */
export function steamVent(): Sprite[] {
  return [ventSprite('steam_vent', 0, false), ventSprite('steam_vent_2', 1, false)];
}

/** The vent after the sulphur is scraped off: bare ash, a thin wisp of steam. */
export function steamVentSpent(): Sprite {
  return ventSprite('steam_vent_spent', 0, true);
}

function hotSpringSprite(name: string, frame: 0 | 1): Sprite {
  const s = new Sprite(name);
  for (let y = 6; y <= 14; y++) {
    for (let x = 1; x <= 14; x++) {
      const d = Math.hypot((x + 0.5 - 8) / 6.5, (y + 0.5 - 10.5) / 4.2);
      if (d > 1) continue;
      if (d > 0.72) {
        // A rim of pale mineral crust, stained yellow in places.
        const n = hash2(x, y, 142);
        s.set(x, y, n < 0.2 ? P.sulphur : y < 10 ? P.stoneLight : n < 0.6 ? P.stone : P.stoneDark);
      } else {
        s.set(x, y, y < 9 ? P.water : hash2(x, y, 143 + frame) < 0.15 ? P.waterGlint : P.waterShallow);
      }
    }
  }
  // Bubbles that move between the frames.
  s.set(frame ? 9 : 6, 11, P.foam);
  s.set(frame ? 6 : 10, 10, P.foam);
  s.outline();
  drawSteam(s, frame ? 6 : 9, 9, frame, 2);
  return s.shadow(8, 15, 7, 1.2);
}

/** A warm pool: you can drink from it, and it warms you like a fire. 2 frames for the steam. */
export function hotSpring(): Sprite[] {
  return [hotSpringSprite('hot_spring', 0), hotSpringSprite('hot_spring_2', 1)];
}
