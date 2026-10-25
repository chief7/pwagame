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
export type EdgeKind = 'edge' | 'outer' | 'inner';

/** Distance of a boundary from a tile edge; period 16 so neighbours line up. */
function coast(t: number): number {
  return 6 + Math.round(Math.sin((t / TILE) * Math.PI * 2) * 1.2);
}

/** How far (x, y) is inside the tile's own ground from the boundary on one side; negative is across it. */
function inland(side: Side, x: number, y: number): number {
  switch (side) {
    case 'n': return y - coast(x);
    case 's': return TILE - 1 - y - coast(x);
    case 'w': return x - coast(y);
    case 'e': return TILE - 1 - x - coast(y);
  }
}

const EDGE_SETS: [EdgeKind, Side[]][] = [
  ['edge', ['n']], ['edge', ['s']], ['edge', ['w']], ['edge', ['e']],
  ['outer', ['n', 'w']], ['outer', ['n', 'e']], ['outer', ['s', 'w']], ['outer', ['s', 'e']],
  ['inner', ['n', 'w']], ['inner', ['n', 'e']], ['inner', ['s', 'w']], ['inner', ['s', 'e']],
];

/**
 * A family of 12 transition tiles: the tile's own ground with something
 * else along one side ('edge'), two adjacent sides ('outer') or one
 * corner ('inner'). `paint` gets the signed distance from the boundary.
 */
function transitionSet(prefix: string, paint: (f: number, x: number, y: number) => Color): Sprite[] {
  return EDGE_SETS.map(([kind, sides]) =>
    new Sprite(`${prefix}_${kind}_${sides.join('')}`).paint((x, y) => {
      const d = sides.map((side) => inland(side, x, y));
      return paint(kind === 'inner' ? Math.max(...d) : Math.min(...d), x, y);
    }),
  );
}

/** Sand with the sea along its edges. */
export function shoreSet(): Sprite[] {
  return transitionSet('shore', (f, x, y) => {
    if (f < -3) return waterPixel(x, y);
    if (f < -1) return hash2(x, y, 9) < 0.15 ? P.water : P.waterShallow;
    if (f < 0) return hash2(x, y, 10) < 0.2 ? P.waterShallow : P.foam;
    if (f < 2) return hash2(x, y, 11) < 0.25 ? P.sandMid : P.sandWet;
    return sandPixel(x, y, 1);
  });
}

/** Grass with beach sand along its edges. */
export function grassEdgeSet(): Sprite[] {
  return transitionSet('grass', (f, x, y) => {
    if (f < 0) return sandPixel(x, y, 1);
    if (f < 1) return hash2(x, y, 12) < 0.5 ? P.grassEdge : P.grassDark;
    return grassPixel(x, y, 4);
  });
}

/**
 * Pick the transition tile for a cell from which neighbours are "other"
 * ground. Returns `plain` when none are. Strips one tile wide (other ground
 * on opposite sides) aren't covered; the world generator avoids them.
 */
export function transitionTileName(prefix: string, plain: string, isOther: (dx: number, dy: number) => boolean): string {
  const n = isOther(0, -1);
  const s = isOther(0, 1);
  const w = isOther(-1, 0);
  const e = isOther(1, 0);
  const vert = n ? 'n' : s ? 's' : '';
  const horiz = w ? 'w' : e ? 'e' : '';
  if (vert && horiz) return `${prefix}_outer_${vert}${horiz}`;
  if (vert) return `${prefix}_edge_${vert}`;
  if (horiz) return `${prefix}_edge_${horiz}`;
  for (const [dx, dy, name] of [[-1, -1, 'nw'], [1, -1, 'ne'], [-1, 1, 'sw'], [1, 1, 'se']] as const) {
    if (isOther(dx, dy)) return `${prefix}_inner_${name}`;
  }
  return plain;
}

/** Shore tile for a land cell given which neighbours are water ('sand' when none). */
export function shoreTileName(isWater: (dx: number, dy: number) => boolean): string {
  return transitionTileName('shore', 'sand', isWater);
}

/** Grass tile for a grass cell given which neighbours are sand ('grass' when none). */
export function grassTileName(isSand: (dx: number, dy: number) => boolean): string {
  return transitionTileName('grass', 'grass', isSand);
}

// ---- Forest floor, rock and caves ---------------------------------------------

function grassPixel(x: number, y: number, seed: number): Color {
  // Short vertical blades: two-pixel strokes in a darker green.
  if (hash2(x, y >> 1, seed + 20) < 0.12) return P.grassMid;
  const n = hash2(x, y, seed);
  if (n < 0.06) return P.grassDark;
  if (n > 0.93) return P.grassLight;
  return P.grass;
}

export function grass(): Sprite {
  return new Sprite('grass').paint((x, y) => grassPixel(x, y, 4));
}

export function grassFlowers(): Sprite {
  const s = new Sprite('grass_flowers').paint((x, y) => grassPixel(x, y, 5));
  for (const [x, y, c] of [
    [3, 4, P.flowerYellow], [4, 4, P.flowerYellow], [3, 3, P.flowerYellow], [4, 5, P.grassDark],
    [11, 9, P.flowerWhite], [12, 9, P.flowerWhite], [11, 10, P.flowerWhite], [12, 10, P.flowerYellow],
    [6, 12, P.shell], [7, 12, P.shell], [7, 13, P.grassDark],
  ] as const) s.set(x, y, c);
  return s;
}

function rockPixel(x: number, y: number): Color {
  // Chunky boulders on an 8px grid (every other column shifted down half a
  // lump), each lit from the top left with dark seams between them.
  const col = x >> 3;
  const yy = (y + (col % 2) * 4) % TILE;
  const lx = x & 7;
  const ly = yy & 7;
  if (lx === 7 || ly === 7) return P.rockFaceDark;
  if (lx === 0 || ly === 0) return hash2(x, y, 30) < 0.7 ? P.rockLight : P.rock;
  if (lx === 6 || ly === 6) return P.rockDark;
  return hash2(x, y, 31) < 0.15 ? P.rockDark : P.rock;
}

/** Top of the rocky hills. */
export function rockTop(): Sprite {
  return new Sprite('rock_top').paint(rockPixel);
}

/** Rock with its cliff face showing, for rock above open ground. */
export function rockFace(): Sprite {
  return new Sprite('rock_face').paint((x, y) => {
    if (y < 5) return rockPixel(x, y);
    if (y === 5) return P.rockLight;
    if (y === TILE - 1) return P.rockFaceDark;
    // Vertical strata, offset per column group.
    const band = (x + (hash2(x >> 2, 0, 32) < 0.5 ? 0 : 1)) % 4;
    if (band === 0) return P.rockFaceDark;
    if (hash2(x, y, 33) < 0.1) return P.rockFaceLight;
    return P.rockFace;
  });
}

function caveFloorPixel(x: number, y: number, seed: number): Color {
  const n = hash2(x, y, seed);
  if (n < 0.12) return P.caveFloorDark;
  if (n > 0.9) return P.caveFloorLight;
  return P.caveFloor;
}

export function caveFloor(): Sprite {
  return new Sprite('cave_floor').paint((x, y) => caveFloorPixel(x, y, 40));
}

export function caveFloorPebbles(): Sprite {
  const s = new Sprite('cave_floor_2').paint((x, y) => caveFloorPixel(x, y, 41));
  for (const [x, y, c] of [
    [4, 5, P.stone], [5, 5, P.stoneDark], [10, 11, P.stoneLight], [11, 11, P.stone], [11, 12, P.stoneDark], [7, 13, P.stone],
  ] as const) s.set(x, y, c);
  return s;
}
