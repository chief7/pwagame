import { levelDef, type Biome } from './defs/levels';
import { canBeOpened, OBJECTS, type ObjectKind, type WorldObject } from './defs/objects';
import { GameMap, Tile } from './map';
import { DIRS, distanceMap, reachWithBridges } from './pathing';
import type { Rng } from './rng';

export interface World {
  map: GameMap;
  start: { x: number; y: number };
  objects: Map<number, WorldObject>;
  /** Per cell: 0 home coast, 1 wild forest, 2 far side of the river, NO_REGION elsewhere. */
  region: Uint8Array;
}

export const WORLD_WIDTH = 104;
export const WORLD_HEIGHT = 80;
export const NO_REGION = 255;

const SMOOTH_PASSES = 5;
const MIN_LAND_RATIO = 0.42;
/** Cells from the sea where forest starts. */
const BEACH_WIDTH = 3;
/** Cells from the sea where hills may rise. */
const HILL_MIN_DIST = 5;
/** Share of the ground (nearest the start first) on the home coast, and on the home coast plus the forest. */
const HOME_SHARE = 0.38;
const FOREST_SHARE = 0.7;
/** Least share of the ground on the far side of the river. */
const MIN_FAR_SHARE = 0.15;
/** Springs and chests per region (home, forest, far side); springs beyond the first go anywhere. */
const HOME_SPRINGS = 2;
const SPRINGS = 8;
const CHESTS = [2, 3, 3];
/** Regions to put the island's goal in, most wanted first: as far from the start as possible. */
const GOAL_REGIONS = [2, 1, 0];

/** Island 2: cells from the sea where forest starts. */
const MOUNTAIN_BEACH_WIDTH = 2;
/** Island 2: share of the inland ground (lowest first) that stays forest, and that is below the snow line. */
const FOREST_LINE = 0.6;
const SNOW_LINE = 0.93;
/** Island 2: the goal stands on a cell with at least this many floor neighbours, so you can walk up to it. */
const GOAL_OPEN_SIDES = 5;
/**
 * Island 2: the rings of steep steps round the goal, as walking distances
 * from it to try (the ring on the most of its ground wins): rocky ledges
 * in the scree, and ice walls on the snow nearer the top.
 */
const LEDGE_RING = { from: 6, to: 10, ground: Tile.Scree, kind: 'ledge' } as const;
const ICE_RING = { from: 3, to: 4, ground: Tile.Snow, kind: 'ice_wall' } as const;
/** Island 2: at least this many snowy spruces, which give the resin for the beacon. */
const RESIN_TREES = 4;

/**
 * Island 1: the tide islet. Its cells are those within this squared radius
 * of its middle, it goes off a beach in one of these regions (most wanted
 * first), and a sandbar of this many sea cells joins it to the island.
 */
const ISLET_RADIUS2 = [10.5, 6.5];
const ISLET_REGIONS = [1, 2, 0];
const SANDBAR = { min: 2, max: 5 };
/** Sea cells kept round the islet, so it never touches other land. */
const ISLET_GAP = 2;
/** What stands on the islet: old tar barrels, a palm for food and drink, a chest. */
export const ISLET_OBJECTS: ObjectKind[] = ['barrel', 'barrel', 'barrel', 'palm_tall', 'chest_closed'];

export type Ground = 'sand' | 'grass' | 'cave' | 'scree' | 'snow';

/** What grows where, as chance per free cell, for each kind of island. */
export const SCATTER: Record<Biome, Record<Ground, [ObjectKind, number][]>> = {
  tropical: {
    sand: [
      ['palm_tall', 0.03], ['palm_leaning', 0.025], ['palm_young', 0.015],
      ['log_driftwood', 0.012], ['stone_pebbles', 0.012], ['log', 0.005], ['stone_boulder', 0.006],
    ],
    grass: [
      ['tree_broadleaf', 0.08], ['tree_pine', 0.045], ['bush', 0.03], ['berry_bush', 0.025],
      ['mushroom', 0.01], ['stone_pebbles', 0.01], ['stone_mossy', 0.008], ['log_pile', 0.004], ['palm_young', 0.008],
    ],
    cave: [['stalagmite', 0.05], ['mushroom', 0.05], ['stone_pebbles', 0.05]],
    scree: [],
    snow: [],
  },
  mountain: {
    sand: [['log_driftwood', 0.02], ['stone_pebbles', 0.02], ['stone_boulder', 0.01], ['log', 0.006]],
    grass: [
      ['tree_spruce', 0.075], ['tree_birch', 0.035], ['tree_broadleaf', 0.02], ['tree_apple', 0.015], ['fern', 0.035],
      ['bush', 0.015], ['berry_bush', 0.015], ['mushroom', 0.012], ['stone_mossy', 0.01], ['stone_pebbles', 0.008], ['log_pile', 0.005],
    ],
    cave: [['stalagmite', 0.05], ['mushroom', 0.05], ['stone_pebbles', 0.05]],
    scree: [['stone_pebbles', 0.05], ['stone_boulder', 0.025], ['tree_spruce', 0.02], ['fern', 0.008]],
    snow: [['tree_spruce_snow', 0.04], ['stone_boulder', 0.02], ['stone_pebbles', 0.02]],
  },
};

/**
 * A whole island: sandy beach round the coast, forest inland, rocky hills
 * with caves in the middle. Everything walkable is connected (tunnels are
 * dug through rock where needed), and the coasts and forest edges are
 * cleaned so the transition tiles can draw them.
 *
 * The island has three regions by walking distance from the start: the
 * home coast, then a wall of brambles, the wild forest, then a river, and
 * the far side. Everything can be reached by clearing brambles and
 * building bridges. The island's goal (the old boat) lies on a beach of
 * the far side.
 *
 * Level 2 is a mountain island instead (see addMountains): a narrow beach,
 * a northern forest, and a mountain range of cliffs and scree with snow on
 * the peak. Its goal (the beacon) stands on the highest snow it can.
 */
export function generateWorld(rng: Rng, width = WORLD_WIDTH, height = WORLD_HEIGHT, level = 1): World {
  const { biome, site } = levelDef(level);
  for (;;) {
    const map = landmass(width, height, rng);
    if (!map) continue;
    const elevation = biome === 'mountain' ? addMountains(map, rng) : (addBiomes(map, rng), null);
    const start = pickStart(map, rng);
    if (!start) continue;
    connectFloor(map, start, biome === 'mountain' ? Tile.Scree : Tile.CaveFloor);
    const borders = addBorders(map, start);
    if (!borders) continue;
    const objects = scatterObjects(map, rng, start, borders, site, biome, elevation);
    if (!objects) continue;
    if (biome === 'tropical' && !addIslet(map, rng, objects, borders.region)) continue;
    return { map, start, objects, region: borders.region };
  }
}

// ---- Landmass ------------------------------------------------------------------

function landmass(width: number, height: number, rng: Rng): GameMap | null {
  let map = new GameMap(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (x / (width - 1)) * 2 - 1;
      const ny = (y / (height - 1)) * 2 - 1;
      const edge = Math.max(Math.abs(nx), Math.abs(ny));
      map.set(x, y, rng.chance(0.78 - edge * edge * 0.62) ? Tile.Sand : Tile.Water);
    }
  }
  for (let i = 0; i < SMOOTH_PASSES; i++) map = smooth(map);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) map.set(x, y, Tile.Water);
    }
  }
  // Sinking thin land can split the island, and splitting can leave thin
  // land again, so repeat until neither changes anything.
  let land: number[] = [];
  for (let before = -1; land.length !== before; ) {
    before = land.length;
    removeThin(map, (x, y) => map.isLand(x, y), (x, y) => map.set(x, y, Tile.Water));
    land = keepLargestLand(map);
  }
  return land.length >= width * height * MIN_LAND_RATIO ? map : null;
}

function smooth(map: GameMap): GameMap {
  const next = new GameMap(map.width, map.height);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      let land = 0;
      for (const [dx, dy] of DIRS) if (map.isLand(x + dx, y + dy)) land++;
      next.set(x, y, land > 4 || (land === 4 && map.isLand(x, y)) ? Tile.Sand : Tile.Water);
    }
  }
  return next;
}

/**
 * Turn cells of one kind into another where the transition tiles can't
 * draw them: the other kind on opposite sides, or only across two corners.
 */
function removeThin(map: GameMap, isA: (x: number, y: number) => boolean, toB: (x: number, y: number) => void): void {
  for (let changed = true; changed; ) {
    changed = false;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!isA(x, y)) continue;
        const b = (dx: number, dy: number) => !isA(x + dx, y + dy);
        const opposite = (b(0, -1) && b(0, 1)) || (b(-1, 0) && b(1, 0));
        const cardinal = b(0, -1) || b(0, 1) || b(-1, 0) || b(1, 0);
        const corners = [b(-1, -1), b(1, -1), b(-1, 1), b(1, 1)].filter(Boolean).length;
        if (opposite || (!cardinal && corners >= 2)) {
          toB(x, y);
          changed = true;
        }
      }
    }
  }
}

/** Sink every landmass but the largest (4-way connected); returns its cells. */
function keepLargestLand(map: GameMap): number[] {
  const regions = regionsOf(map, (x, y) => map.isLand(x, y), 4);
  const largest = regions.reduce<number[]>((a, b) => (b.length > a.length ? b : a), []);
  const keep = new Set(largest);
  for (let i = 0; i < map.tiles.length; i++) if (map.tiles[i] !== Tile.Water && !keep.has(i)) map.tiles[i] = Tile.Water;
  return largest;
}

function regionsOf(map: GameMap, inside: (x: number, y: number) => boolean, ways: 4 | 8): number[][] {
  const seen = new Uint8Array(map.tiles.length);
  const steps = ways === 4 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : DIRS;
  const regions: number[][] = [];
  for (let i = 0; i < map.tiles.length; i++) {
    const x0 = i % map.width;
    const y0 = (i - x0) / map.width;
    if (seen[i] || !inside(x0, y0)) continue;
    const region: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const cur = stack.pop()!;
      region.push(cur);
      const cx = cur % map.width;
      const cy = (cur - cx) / map.width;
      for (const [dx, dy] of steps) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!map.inBounds(nx, ny) || !inside(nx, ny)) continue;
        const n = map.idx(nx, ny);
        if (seen[n]) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    regions.push(region);
  }
  return regions;
}

// ---- Biomes --------------------------------------------------------------------

/** Smooth noise in [0, 1): random values on a coarse grid, blended between. */
function valueNoise(width: number, height: number, cell: number, rng: Rng): (x: number, y: number) => number {
  const gw = Math.ceil(width / cell) + 2;
  const gh = Math.ceil(height / cell) + 2;
  const grid = Array.from({ length: gw * gh }, () => rng.next());
  const at = (gx: number, gy: number) => grid[gy * gw + gx];
  return (x, y) => {
    const fx = x / cell;
    const fy = y / cell;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const top = at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx;
    const bottom = at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx;
    return top * (1 - sy) + bottom * sy;
  };
}

function addBiomes(map: GameMap, rng: Rng): void {
  // Distance inland from the sea (4-way, through land).
  const seaDist = distanceMap4(map);
  const wobble = valueNoise(map.width, map.height, 5, rng);
  const hills = valueNoise(map.width, map.height, 9, rng);
  const caves = valueNoise(map.width, map.height, 4, rng);

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const d = seaDist[map.idx(x, y)];
      if (d < 0) continue;
      if (d >= BEACH_WIDTH + Math.round(wobble(x, y) * 2)) map.set(x, y, Tile.Grass);
    }
  }
  removeThin(map, (x, y) => map.get(x, y) === Tile.Grass, (x, y) => map.set(x, y, Tile.Sand));

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.get(x, y) !== Tile.Grass || seaDist[map.idx(x, y)] < HILL_MIN_DIST) continue;
      if (hills(x, y) > 0.56) map.set(x, y, caves(x, y) > 0.5 ? Tile.CaveFloor : Tile.Rock);
    }
  }
  // Caves only exist inside rock: floor without rock around it is just forest.
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.get(x, y) !== Tile.CaveFloor) continue;
      const rocky = DIRS.filter(([dx, dy]) => map.get(x + dx, y + dy) === Tile.Rock).length;
      if (rocky < 2) map.set(x, y, Tile.Grass);
    }
  }
  // Grass must not touch the sea directly (no transition tiles for that).
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.get(x, y) === Tile.Grass && DIRS.some(([dx, dy]) => !map.isLand(x + dx, y + dy))) map.set(x, y, Tile.Sand);
    }
  }
  removeThin(map, (x, y) => map.get(x, y) === Tile.Grass, (x, y) => map.set(x, y, Tile.Sand));
}

/**
 * Island 2: a narrow beach, then forest, then mountains. Height rises
 * with the distance from the sea plus long ridges of noise. The highest
 * ground is mountain: cliffs (rock, sometimes with caves) with winding
 * scree between them, and snow on the very top. Returns each cell's height
 * (0..1, -1 for the sea) so the beacon can go on the peak.
 */
function addMountains(map: GameMap, rng: Rng): Float32Array {
  const seaDist = distanceMap4(map);
  const wobble = valueNoise(map.width, map.height, 5, rng);
  const ridges = valueNoise(map.width, map.height, 13, rng);
  const cliffs = valueNoise(map.width, map.height, 4, rng);
  const caves = valueNoise(map.width, map.height, 4, rng);
  const maxDist = Math.max(...seaDist);

  const elevation = new Float32Array(map.tiles.length).fill(-1);
  const inland: number[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = map.idx(x, y);
      const d = seaDist[i];
      if (d < 0) continue;
      const ridge = 1 - Math.abs(ridges(x, y) * 2 - 1);
      elevation[i] = (d / maxDist) * 0.6 + ridge * 0.4;
      if (d >= MOUNTAIN_BEACH_WIDTH + Math.round(wobble(x, y))) {
        map.set(x, y, Tile.Grass);
        if (d >= HILL_MIN_DIST) inland.push(i);
      }
    }
  }
  removeThin(map, (x, y) => map.get(x, y) === Tile.Grass, (x, y) => map.set(x, y, Tile.Sand));

  // The height lines come from shares of the inland ground, so every island
  // gets about the same amount of forest, mountain and snow.
  const sorted = inland.map((i) => elevation[i]).sort((a, b) => a - b);
  const forestTop = sorted[Math.floor(sorted.length * FOREST_LINE)];
  const snowLine = sorted[Math.floor(sorted.length * SNOW_LINE)];
  for (const i of inland) {
    const x = i % map.width;
    const y = (i - x) / map.width;
    if (map.tiles[i] !== Tile.Grass || elevation[i] < forestTop) continue;
    const cliff = cliffs(x, y);
    if (elevation[i] >= snowLine) map.tiles[i] = cliff > 0.72 ? Tile.Rock : Tile.Snow;
    else if (cliff > 0.52) map.tiles[i] = caves(x, y) > 0.68 ? Tile.CaveFloor : Tile.Rock;
    else map.tiles[i] = Tile.Scree;
  }
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = map.get(x, y);
      const near = (k: Tile) => DIRS.some(([dx, dy]) => map.get(x + dx, y + dy) === k);
      // Caves only exist inside rock; snow only meets scree and rock.
      if (t === Tile.CaveFloor && DIRS.filter(([dx, dy]) => map.get(x + dx, y + dy) === Tile.Rock).length < 2) map.set(x, y, Tile.Scree);
      if (t === Tile.Snow && near(Tile.Grass)) map.set(x, y, Tile.Scree);
    }
  }
  removeThin(map, (x, y) => map.get(x, y) === Tile.Snow, (x, y) => map.set(x, y, Tile.Scree));
  cleanGrass(map);
  return elevation;
}

/**
 * Make the grass and snow drawable on the mountain island: no grass by the
 * sea, and no grass or snow strip one cell thin. A thin strip of grass
 * becomes what it most likely sits between: beach near the coast, scree
 * in the hills.
 */
function cleanGrass(map: GameMap): void {
  const near = (x: number, y: number, t: Tile) => DIRS.some(([dx, dy]) => map.get(x + dx, y + dy) === t);
  for (let changed = true; changed; ) {
    const before = map.tiles.slice();
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.get(x, y) === Tile.Grass && DIRS.some(([dx, dy]) => !map.isLand(x + dx, y + dy))) map.set(x, y, Tile.Sand);
      }
    }
    removeThin(map, (x, y) => map.get(x, y) === Tile.Grass, (x, y) => map.set(x, y, near(x, y, Tile.Sand) ? Tile.Sand : Tile.Scree));
    removeThin(map, (x, y) => map.get(x, y) === Tile.Snow, (x, y) => map.set(x, y, Tile.Scree));
    changed = map.tiles.some((t, i) => t !== before[i]);
  }
}

function distanceMap4(map: GameMap): Int32Array {
  const dist = new Int32Array(map.width * map.height).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < map.tiles.length; i++) {
    if (map.tiles[i] === Tile.Water) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % map.width;
    const cy = (cur - cx) / map.width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!map.inBounds(nx, ny)) continue;
      const n = map.idx(nx, ny);
      if (dist[n] !== -1) continue;
      dist[n] = dist[cur] + 1;
      queue.push(n);
    }
  }
  // Water cells report -1 so callers can tell land from sea.
  for (let i = 0; i < map.tiles.length; i++) if (map.tiles[i] === Tile.Water) dist[i] = -1;
  return dist;
}

function pickStart(map: GameMap, rng: Rng): { x: number; y: number } | null {
  const candidates: number[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.get(x, y) !== Tile.Sand) continue;
      const open = DIRS.every(([dx, dy]) => map.isFloor(x + dx, y + dy));
      if (open) candidates.push(map.idx(x, y));
    }
  }
  if (!candidates.length) return null;
  const i = rng.pick(candidates);
  return { x: i % map.width, y: Math.floor(i / map.width) };
}

/**
 * Dig cave tunnels (mountain passes on island 2) through rock until every
 * walkable cell can be reached from the start.
 */
function connectFloor(map: GameMap, start: { x: number; y: number }, tunnel: Tile): void {
  for (;;) {
    const reach = distanceMap(map, start.x, start.y, (x, y) => map.isFloor(x, y));
    let lost = -1;
    for (let i = 0; i < map.tiles.length; i++) {
      const x = i % map.width;
      if (map.isFloor(x, (i - x) / map.width) && reach[i] < 0) {
        lost = i;
        break;
      }
    }
    if (lost < 0) return;
    // Shortest way back through any land, then hollow the rock on it.
    const lx = lost % map.width;
    const ly = (lost - lx) / map.width;
    const back = distanceMap(map, lx, ly, (x, y) => map.isLand(x, y));
    let best = -1;
    for (let i = 0; i < map.tiles.length; i++) {
      if (reach[i] >= 0 && back[i] >= 0 && (best < 0 || back[i] < back[best])) best = i;
    }
    if (best < 0) {
      map.set(lx, ly, Tile.Rock);
      continue;
    }
    let cx = best % map.width;
    let cy = (best - cx) / map.width;
    while (back[map.idx(cx, cy)] > 0) {
      let next: [number, number] | null = null;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], ...DIRS]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!map.inBounds(nx, ny)) continue;
        const d = back[map.idx(nx, ny)];
        if (d >= 0 && d < back[map.idx(cx, cy)]) {
          next = [nx, ny];
          break;
        }
      }
      if (!next) break;
      [cx, cy] = next;
      if (map.get(cx, cy) === Tile.Rock) map.set(cx, cy, tunnel);
    }
  }
}

// ---- Regions: brambles and the river ----------------------------------------------

interface Borders {
  region: Uint8Array;
  /** Cells that get a bramble: a one-cell band all the way round the home coast. */
  brambles: number[];
}

/**
 * Close off the home coast with a band of brambles, and the forest with a
 * river two cells wide. Each band follows one walking distance from the
 * start, so every way out has to cross it. Returns null when the island
 * doesn't split well (too little far side, or a river too wide to bridge).
 */
function addBorders(map: GameMap, start: { x: number; y: number }): Borders | null {
  const dist = distanceMap(map, start.x, start.y, (x, y) => map.isFloor(x, y));
  const floor = [...dist].filter((d) => d >= 0).sort((a, b) => a - b);
  const homeDist = floor[Math.floor(floor.length * HOME_SHARE)];
  const riverDist = floor[Math.floor(floor.length * FOREST_SHARE)];
  if (riverDist - homeDist < 6) return null;

  for (let i = 0; i < dist.length; i++) {
    if (dist[i] === riverDist || dist[i] === riverDist + 1) map.tiles[i] = Tile.River;
  }
  cleanRiverBanks(map);

  const region = new Uint8Array(dist.length).fill(NO_REGION);
  const brambles: number[] = [];
  let far = 0;
  for (let i = 0; i < dist.length; i++) {
    const x = i % map.width;
    if (dist[i] < 0 || !map.isFloor(x, (i - x) / map.width)) continue;
    region[i] = dist[i] < homeDist ? 0 : dist[i] < riverDist ? 1 : 2;
    if (dist[i] === homeDist) brambles.push(i);
    if (region[i] === 2) far++;
  }
  if (far < floor.length * MIN_FAR_SHARE) return null;

  const isRiver = (x: number, y: number) => map.get(x, y) === Tile.River;
  const reach = reachWithBridges(map, start.x, start.y, (x, y) => map.isFloor(x, y), isRiver);
  for (let i = 0; i < dist.length; i++) if (region[i] !== NO_REGION && !reach[i]) return null;
  return { region, brambles };
}

/**
 * Make the river drawable: no land strips one cell thin between water, and
 * no grass that touches both the river and the beach (a grass tile can
 * only show one kind of edge). Sand by the river uses the shore tiles.
 */
function cleanRiverBanks(map: GameMap): void {
  for (let changed = true; changed; ) {
    const before = map.tiles.slice();
    removeThin(map, (x, y) => map.isLand(x, y), (x, y) => map.set(x, y, Tile.River));
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.get(x, y) !== Tile.Grass) continue;
        const near = (t: Tile) => DIRS.some(([dx, dy]) => map.get(x + dx, y + dy) === t);
        if (near(Tile.River) && near(Tile.Sand)) map.set(x, y, Tile.Sand);
      }
    }
    // Thin grass becomes beach, or scree in the mountains of island 2.
    const screeNear = (x: number, y: number) => DIRS.some(([dx, dy]) => map.get(x + dx, y + dy) === Tile.Scree);
    removeThin(map, (x, y) => map.get(x, y) === Tile.Grass, (x, y) => map.set(x, y, screeNear(x, y) ? Tile.Scree : Tile.Sand));
    removeThin(map, (x, y) => map.get(x, y) === Tile.Snow, (x, y) => map.set(x, y, Tile.Scree));
    changed = map.tiles.some((t, i) => t !== before[i]);
  }
}

// ---- Objects ---------------------------------------------------------------------

function scatterObjects(
  map: GameMap,
  rng: Rng,
  start: { x: number; y: number },
  borders: Borders,
  goal: ObjectKind,
  biome: Biome,
  elevation: Float32Array | null,
): Map<number, WorldObject> | null {
  const objects = new Map<number, WorldObject>(borders.brambles.map((i) => [i, { kind: 'bramble' }]));
  const { region } = borders;
  const forest = valueNoise(map.width, map.height, 6, rng);
  // Brambles can be cleared and steps climbed, so they don't count as blocking here.
  const blocked = (x: number, y: number) => {
    const o = objects.get(map.idx(x, y));
    return o !== undefined && !OBJECTS[o.kind].walkable && !canBeOpened(o.kind);
  };
  const open = (x: number, y: number) => map.isFloor(x, y) && !blocked(x, y);
  const isRiver = (x: number, y: number) => map.get(x, y) === Tile.River;
  const nearStart = (x: number, y: number) => Math.max(Math.abs(x - start.x), Math.abs(y - start.y)) <= 1;
  // River banks stay clear so a bridge always has somewhere to land.
  const onBank = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isRiver(x + dx, y + dy));

  // Placing something must never wall off part of the island.
  const allReachable = (): boolean => {
    const reach = reachWithBridges(map, start.x, start.y, open, isRiver);
    for (let i = 0; i < map.tiles.length; i++) {
      const x = i % map.width;
      if (open(x, (i - x) / map.width) && !reach[i]) return false;
    }
    return true;
  };
  const place = (i: number, kind: ObjectKind): boolean => {
    objects.set(i, { kind });
    // If the open cells round this one still touch each other, it can't be
    // a cut point; only check the whole island when they don't.
    const x = i % map.width;
    const y = (i - x) / map.width;
    if (openRingConnected(x, y, open) || allReachable()) return true;
    objects.delete(i);
    return false;
  };

  const cells = [...map.tiles.keys()];
  for (let n = cells.length - 1; n > 0; n--) {
    const j = rng.int(0, n);
    [cells[n], cells[j]] = [cells[j], cells[n]];
  }

  // The goal goes first, with room round it so the big sprite stays clear
  // of trees: the boat on a beach by the sea, the beacon on the peak.
  const byTheSea = (x: number, y: number) =>
    map.get(x, y) === Tile.Sand && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.get(x + dx, y + dy) === Tile.Water);
  const goalFree = (i: number) => {
    const x = i % map.width;
    const y = (i - x) / map.width;
    return map.isFloor(x, y) && !objects.has(i) && !nearStart(x, y) && !onBank(x, y);
  };
  let goalAt = -1;
  if (elevation) {
    const openSides = (i: number) => {
      const x = i % map.width;
      return DIRS.filter(([dx, dy]) => map.isFloor(x + dx, (i - x) / map.width + dy)).length;
    };
    const peaks = cells.filter((i) => map.tiles[i] === Tile.Snow).sort((a, b) => elevation[b] - elevation[a]);
    goalAt = peaks.find((i) => goalFree(i) && openSides(i) >= GOAL_OPEN_SIDES && place(i, goal)) ?? -1;
    if (goalAt < 0) return null;
    for (const ring of [LEDGE_RING, ICE_RING]) if (!addStepRing(map, goalAt, start, objects, ring)) return null;
  } else {
    for (const r of GOAL_REGIONS) {
      goalAt = cells.find((i) => {
        const x = i % map.width;
        return region[i] === r && byTheSea(x, (i - x) / map.width) && goalFree(i) && place(i, goal);
      }) ?? -1;
      if (goalAt >= 0) break;
    }
  }
  const nearGoal = (x: number, y: number) => {
    if (goalAt < 0) return false;
    const gx = goalAt % map.width;
    return Math.max(Math.abs(x - gx), Math.abs(y - (goalAt - gx) / map.width)) <= 1;
  };

  for (const i of cells) {
    const x = i % map.width;
    const y = (i - x) / map.width;
    if (!map.isFloor(x, y) || objects.has(i) || nearStart(x, y) || onBank(x, y) || nearGoal(x, y)) continue;
    const tile = map.get(x, y);
    const ground: Ground =
      tile === Tile.Sand ? 'sand' : tile === Tile.Grass ? 'grass' : tile === Tile.Scree ? 'scree' : tile === Tile.Snow ? 'snow' : 'cave';
    const density = ground === 'grass' ? 0.4 + forest(x, y) * 1.2 : 1;
    let roll = rng.next();
    for (const [kind, chance] of SCATTER[biome][ground]) {
      roll -= chance * density;
      if (roll < 0) {
        place(i, kind);
        break;
      }
    }
  }

  // Fresh water: springs in the forest and pools in the caves, with some
  // always on the home coast.
  const free = (i: number) => {
    const x = i % map.width;
    const y = (i - x) / map.width;
    return map.isFloor(x, y) && !objects.has(i) && !nearStart(x, y) && !onBank(x, y) && !nearGoal(x, y);
  };
  const wet = [Tile.Grass, Tile.CaveFloor, Tile.Scree] as number[];
  const springSpots = cells.filter((i) => free(i) && wet.includes(map.tiles[i]));
  let springs = 0;
  for (const i of springSpots) {
    if (springs >= HOME_SPRINGS) break;
    if (region[i] === 0 && place(i, 'spring')) springs++;
  }
  for (const i of springSpots) {
    if (springs >= SPRINGS) break;
    if (free(i) && place(i, 'spring')) springs++;
  }

  // A few chests to find, most of them further out.
  const chests = [0, 0, 0];
  for (const i of cells) {
    const r = region[i];
    if (r === NO_REGION || chests[r] >= CHESTS[r] || !free(i)) continue;
    const x = i % map.width;
    const y = (i - x) / map.width;
    if (Math.abs(x - start.x) + Math.abs(y - start.y) < 10) continue;
    if (place(i, 'chest_closed')) chests[r]++;
  }

  // Island 2: enough snowy spruces for the beacon's resin.
  if (biome === 'mountain') {
    let trees = [...objects.values()].filter((o) => o.kind === 'tree_spruce_snow').length;
    for (const i of cells) {
      if (trees >= RESIN_TREES) break;
      if (map.tiles[i] === Tile.Snow && free(i) && place(i, 'tree_spruce_snow')) trees++;
    }
    if (trees < RESIN_TREES) return null;
  }
  return objects;
}

/**
 * Island 1: a small islet off a beach, joined to it by a straight sandbar
 * that is dry at low tide only. The old tar barrels for the boat stand on
 * it, with a palm and a chest. Returns false when no beach has room for it.
 */
function addIslet(map: GameMap, rng: Rng, objects: Map<number, WorldObject>, region: Uint8Array): boolean {
  const sea = (x: number, y: number) => map.inBounds(x, y) && map.get(x, y) === Tile.Water;
  // Sea cells within ISLET_GAP of land, or on the sea ring at the edge of the map: no islet there.
  const crowded = new Uint8Array(map.tiles.length);
  for (let i = 0; i < map.tiles.length; i++) {
    const x = i % map.width;
    const y = (i - x) / map.width;
    if (x < 2 || y < 2 || x >= map.width - 2 || y >= map.height - 2) crowded[i] = 1;
    if (map.tiles[i] === Tile.Water) continue;
    for (let gy = -ISLET_GAP; gy <= ISLET_GAP; gy++) {
      for (let gx = -ISLET_GAP; gx <= ISLET_GAP; gx++) if (map.inBounds(x + gx, y + gy)) crowded[map.idx(x + gx, y + gy)] = 1;
    }
  }
  for (const radius2 of ISLET_RADIUS2) {
    const shape: [number, number][] = [];
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= radius2) shape.push([dx, dy]);
    const reach = Math.max(...shape.map(([dx]) => dx));
    for (const r of ISLET_REGIONS) {
      const spots: { x: number; y: number; dx: number; dy: number; len: number }[] = [];
      for (let i = 0; i < map.tiles.length; i++) {
        if (region[i] !== r || map.tiles[i] !== Tile.Sand || objects.has(i)) continue;
        const x = i % map.width;
        const y = (i - x) / map.width;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!sea(x + dx, y + dy)) continue;
          for (let len = SANDBAR.min; len <= SANDBAR.max; len++) {
            if (!sea(x + dx * len, y + dy * len)) break;
            // The islet's middle, `reach` cells past the end of the bar.
            const cx = x + dx * (len + 1 + reach);
            const cy = y + dy * (len + 1 + reach);
            const roomy = shape.every(([sx, sy]) => map.inBounds(cx + sx, cy + sy) && !crowded[map.idx(cx + sx, cy + sy)]);
            if (roomy) {
              spots.push({ x, y, dx, dy, len });
              break;
            }
          }
        }
      }
      if (!spots.length) continue;
      const { x, y, dx, dy, len } = rng.pick(spots);
      const cx = x + dx * (len + 1 + reach);
      const cy = y + dy * (len + 1 + reach);
      const islet = shape.map(([sx, sy]) => map.idx(cx + sx, cy + sy));
      for (const i of islet) map.tiles[i] = Tile.Sand;
      for (let k = 1; k <= len; k++) objects.set(map.idx(x + dx * k, y + dy * k), { kind: dx ? 'sandbar_ew' : 'sandbar_ns' });
      placeOnIslet(map, rng, objects, islet, map.idx(x + dx * (len + 1), y + dy * (len + 1)));
      return true;
    }
  }
  return false;
}

/**
 * Put ISLET_OBJECTS on the islet, away from where the sandbar lands, so
 * that every free cell of the islet stays reachable from the landing.
 */
function placeOnIslet(map: GameMap, rng: Rng, objects: Map<number, WorldObject>, islet: number[], landing: number): void {
  const inIslet = new Set(islet);
  const lx = landing % map.width;
  const ly = (landing - lx) / map.width;
  const connected = (): boolean => {
    const seen = new Set([landing]);
    const stack = [landing];
    while (stack.length) {
      const cur = stack.pop()!;
      const x = cur % map.width;
      const y = (cur - x) / map.width;
      for (const [ddx, ddy] of DIRS) {
        const n = map.idx(x + ddx, y + ddy);
        if (inIslet.has(n) && !objects.has(n) && !seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    return islet.every((i) => objects.has(i) || seen.has(i));
  };
  const spots = islet.filter((i) => {
    const x = i % map.width;
    return Math.max(Math.abs(x - lx), Math.abs((i - x) / map.width - ly)) > 1;
  });
  for (let n = spots.length - 1; n > 0; n--) {
    const j = rng.int(0, n);
    [spots[n], spots[j]] = [spots[j], spots[n]];
  }
  let next = 0;
  for (const kind of ISLET_OBJECTS) {
    while (next < spots.length) {
      const i = spots[next++];
      objects.set(i, { kind });
      if (connected()) break;
      objects.delete(i);
    }
  }
}

/**
 * Island 2: a ring of steep steps round the goal. The ring is every floor
 * cell at one walking distance from the goal (counting river cells as a
 * way, since bridges can cross them). Each step changes that distance by
 * at most 1, so every way up, also over a bridge, has to cross the ring.
 * A distance whose ring would touch the river, an object or the start
 * can't be used. Returns false when no distance works.
 */
function addStepRing(
  map: GameMap,
  goalAt: number,
  start: { x: number; y: number },
  objects: Map<number, WorldObject>,
  ring: { from: number; to: number; ground: Tile; kind: ObjectKind },
): boolean {
  const gx = goalAt % map.width;
  const isRiver = (x: number, y: number) => map.get(x, y) === Tile.River;
  const dist = distanceMap(map, gx, (goalAt - gx) / map.width, (x, y) => map.isFloor(x, y) || isRiver(x, y));
  if (dist[map.idx(start.x, start.y)] <= ring.to + 1) return false;
  let best: number[] = [];
  let bestShare = -1;
  for (let d = ring.from; d <= ring.to; d++) {
    const cells: number[] = [];
    let ok = true;
    for (let i = 0; i < dist.length && ok; i++) {
      if (dist[i] !== d) continue;
      ok = map.tiles[i] !== Tile.River && !objects.has(i);
      cells.push(i);
    }
    if (!ok || !cells.length) continue;
    const share = cells.filter((i) => map.tiles[i] === ring.ground).length / cells.length;
    if (share > bestShare) [best, bestShare] = [cells, share];
  }
  for (const i of best) objects.set(i, { kind: ring.kind });
  return best.length > 0;
}

/** The 8 cells round a cell, in ring order. */
const RING: readonly (readonly [number, number])[] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

/** Whether the open cells round (x, y) form one 8-way connected group without (x, y) itself. */
function openRingConnected(x: number, y: number, open: (x: number, y: number) => boolean): boolean {
  const cells = RING.filter(([dx, dy]) => open(x + dx, y + dy));
  if (cells.length < 2) return true;
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const [ax, ay] = cells[stack.pop()!];
    cells.forEach(([bx, by], j) => {
      if (seen.has(j) || Math.max(Math.abs(ax - bx), Math.abs(ay - by)) > 1) return;
      seen.add(j);
      stack.push(j);
    });
  }
  return seen.size === cells.length;
}
