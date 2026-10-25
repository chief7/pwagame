import { OBJECTS, type ObjectKind, type WorldObject } from './defs/objects';
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

/** What grows where, as chance per free cell. */
const SCATTER: Record<'sand' | 'grass' | 'cave', [ObjectKind, number][]> = {
  sand: [
    ['palm_tall', 0.03], ['palm_leaning', 0.025], ['palm_young', 0.015],
    ['log_driftwood', 0.012], ['stone_pebbles', 0.012], ['log', 0.005], ['stone_boulder', 0.006],
  ],
  grass: [
    ['tree_broadleaf', 0.08], ['tree_pine', 0.045], ['bush', 0.03], ['berry_bush', 0.025],
    ['mushroom', 0.01], ['stone_pebbles', 0.01], ['stone_mossy', 0.008], ['log_pile', 0.004], ['palm_young', 0.008],
  ],
  cave: [['stalagmite', 0.05], ['mushroom', 0.05], ['stone_pebbles', 0.05]],
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
 * building bridges.
 */
export function generateWorld(rng: Rng, width = WORLD_WIDTH, height = WORLD_HEIGHT): World {
  for (;;) {
    const map = landmass(width, height, rng);
    if (!map) continue;
    addBiomes(map, rng);
    const start = pickStart(map, rng);
    if (!start) continue;
    connectFloor(map, start);
    const borders = addBorders(map, start);
    if (!borders) continue;
    const objects = scatterObjects(map, rng, start, borders);
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
 * Dig cave tunnels through rock until every walkable cell can be reached
 * from the start.
 */
function connectFloor(map: GameMap, start: { x: number; y: number }): void {
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
      if (map.get(cx, cy) === Tile.Rock) map.set(cx, cy, Tile.CaveFloor);
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
    removeThin(map, (x, y) => map.get(x, y) === Tile.Grass, (x, y) => map.set(x, y, Tile.Sand));
    changed = map.tiles.some((t, i) => t !== before[i]);
  }
}

// ---- Objects ---------------------------------------------------------------------

function scatterObjects(map: GameMap, rng: Rng, start: { x: number; y: number }, borders: Borders): Map<number, WorldObject> {
  const objects = new Map<number, WorldObject>(borders.brambles.map((i) => [i, { kind: 'bramble' }]));
  const { region } = borders;
  const forest = valueNoise(map.width, map.height, 6, rng);
  // Brambles can be cleared, so they don't count as blocking here.
  const blocked = (x: number, y: number) => {
    const o = objects.get(map.idx(x, y));
    return o !== undefined && !OBJECTS[o.kind].walkable && o.kind !== 'bramble';
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
  for (const i of cells) {
    const x = i % map.width;
    const y = (i - x) / map.width;
    if (!map.isFloor(x, y) || objects.has(i) || nearStart(x, y) || onBank(x, y)) continue;
    const tile = map.get(x, y);
    const biome = tile === Tile.Sand ? 'sand' : tile === Tile.Grass ? 'grass' : 'cave';
    const density = biome === 'grass' ? 0.4 + forest(x, y) * 1.2 : 1;
    let roll = rng.next();
    for (const [kind, chance] of SCATTER[biome]) {
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
    return map.isFloor(x, y) && !objects.has(i) && !nearStart(x, y) && !onBank(x, y);
  };
  const springSpots = cells.filter((i) => free(i) && (map.tiles[i] === Tile.Grass || map.tiles[i] === Tile.CaveFloor));
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
  return objects;
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
