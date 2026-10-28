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

/** How a tile's own ground meets other ground: `f` is the signed distance from the boundary (negative is across it). */
type Band = (f: number, x: number, y: number) => Color;

const shoreBand: Band = (f, x, y) => {
  if (f < -3) return waterPixel(x, y);
  if (f < -1) return hash2(x, y, 9) < 0.15 ? P.water : P.waterShallow;
  if (f < 0) return hash2(x, y, 10) < 0.2 ? P.waterShallow : P.foam;
  if (f < 2) return hash2(x, y, 11) < 0.25 ? P.sandMid : P.sandWet;
  return sandPixel(x, y, 1);
};

const grassSandBand: Band = (f, x, y) => {
  if (f < 0) return sandPixel(x, y, 1);
  if (f < 1) return hash2(x, y, 12) < 0.5 ? P.grassEdge : P.grassDark;
  return grassPixel(x, y, 4);
};

/** Sand with the sea along its edges. */
export function shoreSet(): Sprite[] {
  return transitionSet('shore', shoreBand);
}

/** Grass with beach sand along its edges. */
export function grassEdgeSet(): Sprite[] {
  return transitionSet('grass', grassSandBand);
}

function riverPixel(x: number, y: number, phase: number): Color {
  // Fresh water: long ripple dashes drifting one step per frame. Wraps at
  // the tile edge so river cells join up.
  const rx = (x + phase * 4) % TILE;
  if (hash2(rx >> 2, y, 50) < 0.12) return P.riverRipple;
  return hash2(x, y, 51) < 0.08 ? P.water : P.river;
}

/** River water, 2 frames for a gentle flow. */
export function river(): Sprite[] {
  return [0, 1].map((phase) => new Sprite(phase ? 'river_2' : 'river').paint((x, y) => riverPixel(x, y, phase)));
}

const riverBankBand: Band = (f, x, y) => {
  if (f < -2) return riverPixel(x, y, 0);
  if (f < -1) return hash2(x, y, 52) < 0.3 ? P.river : P.waterShallow;
  if (f < 0) return hash2(x, y, 53) < 0.3 ? P.mudDark : P.mud;
  if (f < 1) return hash2(x, y, 54) < 0.5 ? P.grassEdge : P.grassDark;
  return grassPixel(x, y, 4);
};

/** Grass with a river along its edges: a strip of muddy bank between. */
export function riverBankSet(): Sprite[] {
  return transitionSet('bank', riverBankBand);
}

/** The river running into the sea: river water that turns to sea water through a dithered band. */
function mouthBand(phase: number): Band {
  return (f, x, y) => {
    if (f < -2) return waterPixel(x, y);
    if (f < 1) return hash2(x, y, 55) < (f + 3) / 4 ? riverPixel(x, y, phase) : P.water;
    return riverPixel(x, y, phase);
  };
}

/** River cells next to the sea, 2 frames like the river ('mouth_…' and 'mouth2_…'). */
export function riverMouthSet(): Sprite[] {
  return [...transitionSet('mouth', mouthBand(0)), ...transitionSet('mouth2', mouthBand(1))];
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

/** Bank tile for a grass cell given which neighbours are river ('grass' when none). */
export function riverBankTileName(isRiver: (dx: number, dy: number) => boolean): string {
  return transitionTileName('bank', 'grass', isRiver);
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

// ---- Island 2: mountain scree and snow ---------------------------------------------

function screePixel(x: number, y: number, seed: number): Color {
  // Loose gravel: small two-pixel stones, lit on top, with a few grass tufts.
  const n = hash2(x >> 1, y >> 1, seed);
  if (n < 0.08) return (y & 1) === 0 ? P.screeLight : P.screeDark;
  const m = hash2(x, y, seed + 1);
  if (m < 0.08) return P.screeDark;
  if (m > 0.94) return P.screeLight;
  if (m > 0.9 && hash2(x, y >> 1, seed + 2) < 0.4) return P.grassEdge;
  return P.scree;
}

/** Walkable mountain ground: loose grey gravel between the cliffs. */
export function scree(): Sprite {
  return new Sprite('scree').paint((x, y) => screePixel(x, y, 80));
}

export function screeStones(): Sprite {
  const s = new Sprite('scree_2').paint((x, y) => screePixel(x, y, 81));
  for (const [x, y, c] of [
    [3, 4, P.stoneLight], [4, 4, P.stone], [3, 5, P.stone], [4, 5, P.stoneDark],
    [10, 10, P.stoneLight], [11, 10, P.stoneLight], [12, 10, P.stone], [10, 11, P.stone], [11, 11, P.stoneDark], [12, 11, P.stoneDeep],
    [6, 12, P.stone], [7, 12, P.stoneDark],
  ] as const) s.set(x, y, c);
  return s;
}

function snowPixel(x: number, y: number, seed: number): Color {
  // Soft drifts: gentle diagonal shading bands with sparkling points.
  const drift = Math.sin(((x + y * 2) / TILE) * Math.PI * 2 + hash2(0, y >> 2, seed) * 0.6);
  const n = hash2(x, y, seed);
  if (n > 0.97) return P.snowLight;
  if (drift > 0.75 && n < 0.6) return P.snowShade;
  if (n < 0.04) return P.snowShade;
  return P.snow;
}

/** Snow on the high peaks: walkable but cold. */
export function snow(): Sprite {
  return new Sprite('snow').paint((x, y) => snowPixel(x, y, 82));
}

export function snowTracks(): Sprite {
  const s = new Sprite('snow_2').paint((x, y) => snowPixel(x, y, 83));
  // Little paw prints of some mountain animal.
  for (const [x, y] of [[3, 3], [5, 6], [3, 9], [5, 12], [10, 2], [12, 5]]) {
    s.set(x, y, P.snowDeep);
    s.set(x + 1, y, P.snowShade);
  }
  return s;
}

const snowScreeBand: Band = (f, x, y) => {
  if (f < -1) return screePixel(x, y, 80);
  if (f < 0) return hash2(x, y, 84) < 0.5 ? P.screeDark : P.screeDeep;
  if (f < 1) return hash2(x, y, 85) < 0.5 ? P.snowDeep : P.snowShade;
  return snowPixel(x, y, 82);
};

const grassScreeBand: Band = (f, x, y) => {
  if (f < 0) return screePixel(x, y, 80);
  if (f < 1) return hash2(x, y, 86) < 0.5 ? P.grassEdge : P.grassDark;
  return grassPixel(x, y, 4);
};

/** Water side of a bank: river, then a dithered shallow strip. */
function riverSide(f: number, x: number, y: number, seed: number): Color {
  if (f < -2) return riverPixel(x, y, 0);
  return hash2(x, y, seed) < 0.3 ? P.river : P.waterShallow;
}

/** Scree down to the river: wet, dark gravel at the waterline. */
const screeBankBand: Band = (f, x, y) => {
  if (f < -1) return riverSide(f, x, y, 87);
  if (f < 1) return hash2(x, y, 88) < 0.4 ? P.screeDeep : P.screeDark;
  return screePixel(x, y, 80);
};

/** Snow down to the river: the snow melts into a line of wet gravel. */
const snowBankBand: Band = (f, x, y) => {
  if (f < -1) return riverSide(f, x, y, 89);
  if (f < 0) return hash2(x, y, 90) < 0.5 ? P.screeDark : P.screeDeep;
  if (f < 1) return hash2(x, y, 91) < 0.5 ? P.snowDeep : P.snowShade;
  return snowPixel(x, y, 82);
};

/** Cave floor down to an underground stream: dark wet stone at the edge. */
const caveBankBand: Band = (f, x, y) => {
  if (f < -1) return riverSide(f, x, y, 92);
  if (f < 1) return hash2(x, y, 93) < 0.4 ? P.stoneDeep : P.caveFloorDark;
  return caveFloorPixel(x, y, 40);
};

/** Snow with scree along its edges: a thin melt line of wet gravel between. */
export function snowEdgeSet(): Sprite[] {
  return transitionSet('snow', snowScreeBand);
}

/** Grass with mountain scree along its edges. */
export function grassScreeSet(): Sprite[] {
  return transitionSet('grass_scree', grassScreeBand);
}

/** Scree, snow and cave floor with the river along their edges. */
export function bankSets(): Sprite[] {
  return [
    ...transitionSet('scree_bank', screeBankBand),
    ...transitionSet('snow_bank', snowBankBand),
    ...transitionSet('cave_bank', caveBankBand),
  ];
}

/** Snow tile for a snow cell given which neighbours are scree ('snow' when none). */
export function snowTileName(isScree: (dx: number, dy: number) => boolean): string {
  return transitionTileName('snow', 'snow', isScree);
}

/** Grass tile for a grass cell next to mountain scree ('grass' when none). */
export function grassScreeTileName(isScree: (dx: number, dy: number) => boolean): string {
  return transitionTileName('grass_scree', 'grass', isScree);
}

// ---- Island 3: the volcano: ash, basalt and lava ------------------------------------

function ashPixel(x: number, y: number, seed: number): Color {
  // Fine volcanic ash: soft grains with a few darker clumps.
  if (hash2(x >> 1, y >> 1, seed) < 0.06) return P.ashDeep;
  const n = hash2(x, y, seed + 1);
  if (n < 0.12) return P.ashDark;
  if (n > 0.93) return P.ashLight;
  return P.ash;
}

/** Walkable volcano ground: grey ash, hot by day. */
export function ash(): Sprite {
  return new Sprite('ash').paint((x, y) => ashPixel(x, y, 120));
}

export function ashPumice(): Sprite {
  const s = new Sprite('ash_2').paint((x, y) => ashPixel(x, y, 121));
  // Light lumps of pumice, full of little holes.
  for (const [x, y, c] of [
    [3, 4, P.stoneLight], [4, 4, P.stoneLight], [3, 5, P.stone], [4, 5, P.stoneDark],
    [10, 10, P.stoneLight], [11, 10, P.stone], [12, 10, P.stoneLight], [10, 11, P.stone], [11, 11, P.stoneDark], [12, 11, P.stone],
    [7, 13, P.stoneLight], [8, 13, P.stone],
  ] as const) s.set(x, y, c);
  return s;
}

function lavaPixel(x: number, y: number, phase: number): Color {
  // Molten rock under drifting plates of dark crust. The plates come from
  // waves with a period of 16, so lava cells join up; they move two pixels
  // a frame.
  const a = ((x + phase * 2) / TILE) * Math.PI * 2;
  const b = (y / TILE) * Math.PI * 2;
  const crust = Math.sin(a + Math.sin(b) * 1.3) * Math.cos(b + Math.cos(a)) + 0.45 * Math.sin(2 * a - b);
  const n = hash2((x + phase * 2) % TILE, y, 61);
  if (crust > 0.75) return n < 0.25 ? P.lavaCrustLight : P.lavaCrust;
  if (crust > 0.55) return P.lavaDark;
  if (crust < -0.85 || n < 0.04) return P.lavaGlow;
  if (crust < -0.35 || n < 0.15) return P.lavaLight;
  return P.lava;
}

/** The lava flow, 2 frames for a slow drift of the crust. */
export function lava(): Sprite[] {
  return [0, 1].map((phase) => new Sprite(phase ? 'lava_2' : 'lava').paint((x, y) => lavaPixel(x, y, phase)));
}

function basaltPixel(x: number, y: number): Color {
  // The tops of basalt columns: 4px blocks, every other column shifted half
  // a block, lit on top with dark seams between.
  const col = x >> 2;
  const yy = (y + (col % 2) * 2) % TILE;
  const lx = x & 3;
  const ly = yy & 3;
  if (lx === 3 || ly === 3 || (lx === 0 && ly === 0)) return P.basaltDeep;
  if (ly === 0) return hash2(x, y, 63) < 0.7 ? P.basaltLight : P.basalt;
  if (lx === 0) return P.basalt;
  return hash2(x, y, 64) < 0.2 ? P.basaltDark : P.basalt;
}

/** The top of the black basalt cliffs (rock on island 3). */
export function basaltTop(): Sprite {
  return new Sprite('basalt_top').paint(basaltPixel);
}

/** A basalt cliff face: tall columns with cracks across them. */
export function basaltFace(): Sprite {
  return new Sprite('basalt_face').paint((x, y) => {
    if (y < 5) return basaltPixel(x, y);
    if (y === 5) return P.basaltLight;
    if (y === TILE - 1) return P.basaltDeep;
    const band = x % 4;
    if (band === 3) return P.basaltDeep;
    // Each column cracks across at its own height.
    if (y === 7 + (((x >> 2) * 5 + 3) % 7)) return P.basaltDark;
    return band === 0 ? P.basaltLight : P.basalt;
  });
}

/** Lava side of an edge: lava, a glowing rim, then dark crust where it cools. */
function lavaSide(f: number, x: number, y: number, seed: number): Color {
  if (f < -2) return lavaPixel(x, y, 0);
  if (f < -1) return hash2(x, y, seed) < 0.4 ? P.lavaDark : P.lavaLight;
  return hash2(x, y, seed + 1) < 0.3 ? P.lavaCrustLight : P.lavaCrust;
}

const grassAshBand: Band = (f, x, y) => {
  if (f < 0) return ashPixel(x, y, 120);
  if (f < 1) return hash2(x, y, 122) < 0.5 ? P.grassEdge : P.grassDark;
  return grassPixel(x, y, 4);
};

/** Ash down to the lava: a scorched strip of dark ash. */
const ashLavaBand: Band = (f, x, y) => {
  if (f < 0) return lavaSide(f, x, y, 123);
  if (f < 1) return hash2(x, y, 125) < 0.5 ? P.ashDeep : P.ashDark;
  return ashPixel(x, y, 120);
};

/** Grass down to the lava: the grass is burnt to ash at the edge. */
const grassLavaBand: Band = (f, x, y) => {
  if (f < 0) return lavaSide(f, x, y, 126);
  if (f < 1) return hash2(x, y, 128) < 0.5 ? P.ashDeep : P.ashDark;
  if (f < 2) return hash2(x, y, 129) < 0.5 ? P.grassEdge : P.ashDark;
  return grassPixel(x, y, 4);
};

/** Beach sand down to the lava: blackened sand at the edge. */
const sandLavaBand: Band = (f, x, y) => {
  if (f < 0) return lavaSide(f, x, y, 130);
  if (f < 1) return hash2(x, y, 132) < 0.5 ? P.ashDark : P.sandDark;
  return sandPixel(x, y, 1);
};

/** Cave floor down to the lava. */
const caveLavaBand: Band = (f, x, y) => {
  if (f < 0) return lavaSide(f, x, y, 133);
  if (f < 1) return hash2(x, y, 135) < 0.4 ? P.basaltDeep : P.caveFloorDark;
  return caveFloorPixel(x, y, 40);
};

/** Lava running into the sea: a black crust, then steam over the water. */
function lavaMouthBand(phase: number): Band {
  return (f, x, y) => {
    if (f < -3) return waterPixel(x, y);
    if (f < -1) return hash2(x, y, 136 + phase) < 0.45 ? P.steam : P.waterShallow;
    if (f < 1) return hash2(x, y, 138) < 0.3 ? P.lavaCrustLight : P.lavaCrust;
    return lavaPixel(x, y, phase);
  };
}

/** Beach sand up to the ash: a dark line of ash grains. */
const sandAshBand: Band = (f, x, y) => {
  if (f < 0) return ashPixel(x, y, 120);
  if (f < 1) return hash2(x, y, 139) < 0.5 ? P.ashDark : P.sandDark;
  return sandPixel(x, y, 1);
};

/** Sand with ash along its edges. */
export function sandAshSet(): Sprite[] {
  return transitionSet('sand_ash', sandAshBand);
}

/** Grass with volcano ash along its edges. */
export function grassAshSet(): Sprite[] {
  return transitionSet('grass_ash', grassAshBand);
}

/** Ash, grass, sand and cave floor with the lava along their edges. */
export function lavaBankSets(): Sprite[] {
  return [
    ...transitionSet('ash_lava', ashLavaBand),
    ...transitionSet('grass_lava', grassLavaBand),
    ...transitionSet('sand_lava', sandLavaBand),
    ...transitionSet('cave_lava', caveLavaBand),
  ];
}

/** Lava cells next to the sea, 2 frames like the lava ('lava_mouth_…' and 'lava_mouth2_…'). */
export function lavaMouthSet(): Sprite[] {
  return [...transitionSet('lava_mouth', lavaMouthBand(0)), ...transitionSet('lava_mouth2', lavaMouthBand(1))];
}

// ---- Edges against several kinds of ground ------------------------------------------

/** Ground that draws edges, and for each kind of neighbour (one letter) its tile set and band. */
const EDGES = {
  grass: {
    a: ['grass', grassSandBand], r: ['bank', riverBankBand], c: ['grass_scree', grassScreeBand],
    h: ['grass_ash', grassAshBand], l: ['grass_lava', grassLavaBand],
  },
  sand: { w: ['shore', shoreBand], h: ['sand_ash', sandAshBand], l: ['sand_lava', sandLavaBand] },
  snow: { c: ['snow', snowScreeBand], r: ['snow_bank', snowBankBand] },
  scree: { r: ['scree_bank', screeBankBand] },
  cave: { r: ['cave_bank', caveBankBand], l: ['cave_lava', caveLavaBand] },
  river: { w: ['mouth', mouthBand(0)] },
  ash: { l: ['ash_lava', ashLavaBand] },
  lava: { w: ['lava_mouth', lavaMouthBand(0)] },
} as const satisfies Record<string, Record<string, readonly [string, Band]>>;

export type EdgeGround = keyof typeof EDGES;

/** Neighbour order in a mixed tile's name: four sides, then four corners. */
const AROUND = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const;
const SIDES: Side[] = ['n', 's', 'w', 'e'];
const CORNERS: [Side, Side][] = [['n', 'w'], ['n', 'e'], ['s', 'w'], ['s', 'e']];

/**
 * Tile for a cell of `own` ground. `kindAt` gives the letter of a
 * neighbour's ground from EDGES[own], or '.' when it draws no edge. With
 * one kind around, this is that kind's transition tile; with more, a mixed
 * tile 'mix_<own>_<8 letters>' that mixedTile() paints on demand.
 */
export function edgeTileName(own: EdgeGround, plain: string, kindAt: (dx: number, dy: number) => string): string {
  const kinds = AROUND.map(([dx, dy]) => kindAt(dx, dy));
  const found = [...new Set(kinds.filter((k) => k !== '.'))];
  if (!found.length) return plain;
  if (found.length === 1) {
    const [prefix] = (EDGES[own] as Record<string, readonly [string, Band]>)[found[0]];
    return transitionTileName(prefix, plain, (dx, dy) => kindAt(dx, dy) === found[0]);
  }
  return `mix_${own}_${kinds.join('')}`;
}

/**
 * Paint a mixed tile: every pixel takes the band of the nearest boundary.
 * Sides work as in the transition sets; a corner counts only when neither
 * of its sides has an edge.
 */
export function mixedTile(name: string): Sprite | null {
  const m = /^mix_([a-z]+)_([a-z.]{8})$/.exec(name);
  if (!m || !(m[1] in EDGES)) return null;
  const bands = EDGES[m[1] as EdgeGround] as Record<string, readonly [string, Band]>;
  const kinds = [...m[2]];
  if (kinds.some((k) => k !== '.' && !bands[k])) return null;
  const sides = SIDES.map((side, i) => [side, kinds[i]] as const).filter(([, k]) => k !== '.');
  const edged = new Set(sides.map(([side]) => side));
  const corners = CORNERS.map((pair, i) => [pair, kinds[4 + i]] as const)
    .filter(([pair, k]) => k !== '.' && !edged.has(pair[0]) && !edged.has(pair[1]));
  return new Sprite(name).paint((x, y) => {
    let best = Infinity;
    let kind = '';
    for (const [side, k] of sides) {
      const f = inland(side, x, y);
      if (f < best) [best, kind] = [f, k];
    }
    for (const [[a, b], k] of corners) {
      const f = Math.max(inland(a, x, y), inland(b, x, y));
      if (f < best) [best, kind] = [f, k];
    }
    return bands[kind][1](best, x, y);
  });
}

