import { PALETTE as P } from './palette';
import { hash2, Sprite, type Color } from './pixel';

const TILE = 16;

function sandPixel(x: number, y: number, seed: number): Color {
  const n = hash2(x, y, seed);
  if (n < 0.07) return P.sandDark;
  if (n < 0.2) return P.sandMid;
  if (n > 0.93) return P.sandLight;
  return P.sand;
}

function waterPixel(x: number, y: number, seed = 7): Color {
  // Short two-pixel glints; wraps at the tile edge so water tiles seamlessly.
  if (hash2(x, y, seed) < 0.018 || hash2((x + TILE - 1) % TILE, y, seed) < 0.018) return P.waterGlint;
  return hash2(x, y, seed + 1) < 0.1 ? P.waterDeep : P.water;
}

export function sand(): Sprite {
  return new Sprite('sand').paint((x, y) => sandPixel(x, y, 1));
}

export function sandRipples(): Sprite {
  return new Sprite('sand_ripples').paint((x, y) => {
    // Wind ripples: wavy lines every 8px with a lit edge above each.
    const wave = Math.round(Math.sin((x / TILE) * Math.PI * 2) * 1.2);
    const row = (((y + wave) % 8) + 8) % 8;
    if (row === 0) return P.sandMid;
    if (row === 7) return P.sandLight;
    return sandPixel(x, y, 2);
  });
}

export function sandShell(): Sprite {
  const s = new Sprite('sand_shell').paint((x, y) => sandPixel(x, y, 3));
  // A little scallop shell and a pebble.
  for (const [x, y, c] of [
    [4, 9, P.shell], [5, 8, P.shell], [6, 8, P.sandLight], [7, 9, P.shell],
    [5, 9, P.sandLight], [6, 9, P.shell], [5, 10, P.sandMid], [6, 10, P.sandMid],
    [11, 4, P.stoneLight], [12, 4, P.stone], [12, 5, P.stoneDark], [11, 5, P.stone],
  ] as const) s.set(x, y, c);
  return s;
}

export function water(): Sprite {
  return new Sprite('water').paint((x, y) => waterPixel(x, y));
}

/** Extra open-water tiles so the sea doesn't read as a grid. */
export function waterVariants(): Sprite[] {
  return [100, 200].map((seed, i) => new Sprite(`water_${i + 2}`).paint((x, y) => waterPixel(x, y, seed)));
}

export type Side = 'n' | 's' | 'e' | 'w';
export type ShoreKind = 'edge' | 'outer' | 'inner';

/** Distance of the coastline from a tile edge; period 16 so neighbours line up. */
function coast(t: number): number {
  return 6 + Math.round(Math.sin((t / TILE) * Math.PI * 2) * 1.2);
}

/** How far (x, y) is inland from the water on one side; negative means in the water. */
function inland(side: Side, x: number, y: number): number {
  switch (side) {
    case 'n': return y - coast(x);
    case 's': return TILE - 1 - y - coast(x);
    case 'w': return x - coast(y);
    case 'e': return TILE - 1 - x - coast(y);
  }
}

/**
 * Sand tile with water on one side ('edge'), on two adjacent sides with land
 * in the opposite corner ('outer'), or only in one corner ('inner').
 */
export function shore(kind: ShoreKind, sides: readonly Side[]): Sprite {
  const name = `shore_${kind}_${sides.join('')}`;
  return new Sprite(name).paint((x, y) => {
    const d = sides.map((side) => inland(side, x, y));
    const f = kind === 'inner' ? Math.max(...d) : Math.min(...d);
    if (f < -3) return waterPixel(x, y);
    if (f < -1) return hash2(x, y, 9) < 0.15 ? P.water : P.waterShallow;
    if (f < 0) return hash2(x, y, 10) < 0.2 ? P.waterShallow : P.foam;
    if (f < 2) return hash2(x, y, 11) < 0.25 ? P.sandMid : P.sandWet;
    return sandPixel(x, y, 1);
  });
}

export function shoreSet(): Sprite[] {
  return [
    shore('edge', ['n']), shore('edge', ['s']), shore('edge', ['w']), shore('edge', ['e']),
    shore('outer', ['n', 'w']), shore('outer', ['n', 'e']), shore('outer', ['s', 'w']), shore('outer', ['s', 'e']),
    shore('inner', ['n', 'w']), shore('inner', ['n', 'e']), shore('inner', ['s', 'w']), shore('inner', ['s', 'e']),
  ];
}

/**
 * Pick the terrain sprite for a land cell from which neighbours are water.
 * Returns 'sand' when no water is adjacent. Land strips one tile wide
 * (water on opposite sides) aren't covered by this set.
 */
export function shoreTileName(isWater: (dx: number, dy: number) => boolean): string {
  const n = isWater(0, -1);
  const s = isWater(0, 1);
  const w = isWater(-1, 0);
  const e = isWater(1, 0);
  const vert = n ? 'n' : s ? 's' : '';
  const horiz = w ? 'w' : e ? 'e' : '';
  if (vert && horiz) return `shore_outer_${vert}${horiz}`;
  if (vert) return `shore_edge_${vert}`;
  if (horiz) return `shore_edge_${horiz}`;
  for (const [dx, dy, name] of [[-1, -1, 'nw'], [1, -1, 'ne'], [-1, 1, 'sw'], [1, 1, 'se']] as const) {
    if (isWater(dx, dy)) return `shore_inner_${name}`;
  }
  return 'sand';
}
