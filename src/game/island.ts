import { GameMap, Tile } from './map';
import { distanceMap } from './pathing';
import type { Rng } from './rng';

export interface IslandLevel {
  map: GameMap;
  start: { x: number; y: number };
  raft: { x: number; y: number };
}

const SMOOTH_PASSES = 5;
const MIN_LAND_RATIO = 0.25;

/**
 * Cellular-automata island: land is likelier near the centre, only the
 * largest landmass is kept, and the coast is cleaned up so the shore
 * autotiles can draw every land cell.
 */
export function generateIsland(width: number, height: number, rng: Rng): IslandLevel {
  for (;;) {
    const level = tryGenerate(width, height, rng);
    if (level) return level;
  }
}

function tryGenerate(width: number, height: number, rng: Rng): IslandLevel | null {
  let map = new GameMap(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (x / (width - 1)) * 2 - 1;
      const ny = (y / (height - 1)) * 2 - 1;
      const edge = Math.max(Math.abs(nx), Math.abs(ny));
      const landChance = 0.62 - edge * edge * 0.55;
      map.set(x, y, rng.chance(landChance) ? Tile.Sand : Tile.Water);
    }
  }
  for (let i = 0; i < SMOOTH_PASSES; i++) map = smooth(map);

  // Keep a ring of open water round the map edge.
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
    removeThinLand(map);
    land = keepLargestLand(map);
  }
  if (land.length < width * height * MIN_LAND_RATIO) return null;

  const startIdx = rng.pick(land);
  const start = { x: startIdx % width, y: Math.floor(startIdx / width) };

  // The raft waits on the far shore.
  const dist = distanceMap(map, start.x, start.y, (x, y) => map.isLand(x, y));
  let raftIdx = -1;
  for (const i of land) {
    const x = i % width;
    const y = (i - x) / width;
    const coastal = !map.isLand(x + 1, y) || !map.isLand(x - 1, y) || !map.isLand(x, y + 1) || !map.isLand(x, y - 1);
    if (coastal && (raftIdx < 0 || dist[i] > dist[raftIdx])) raftIdx = i;
  }
  if (raftIdx < 0) return null;
  const raft = { x: raftIdx % width, y: Math.floor(raftIdx / width) };
  map.set(raft.x, raft.y, Tile.Raft);

  return { map, start, raft };
}

function smooth(map: GameMap): GameMap {
  const next = new GameMap(map.width, map.height);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      let land = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && map.isLand(x + dx, y + dy)) land++;
      }
      next.set(x, y, land > 4 || (land === 4 && map.isLand(x, y)) ? Tile.Sand : Tile.Water);
    }
  }
  return next;
}

/**
 * Sink land with water on opposite sides, or touching water only across
 * two corners: the shore tiles can't draw either.
 */
function removeThinLand(map: GameMap): void {
  for (let changed = true; changed; ) {
    changed = false;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!map.isLand(x, y)) continue;
        const w = (dx: number, dy: number) => !map.isLand(x + dx, y + dy);
        const opposite = (w(0, -1) && w(0, 1)) || (w(-1, 0) && w(1, 0));
        const cardinal = w(0, -1) || w(0, 1) || w(-1, 0) || w(1, 0);
        const corners = [w(-1, -1), w(1, -1), w(-1, 1), w(1, 1)].filter(Boolean).length;
        if (opposite || (!cardinal && corners >= 2)) {
          map.set(x, y, Tile.Water);
          changed = true;
        }
      }
    }
  }
}

/** Sink every landmass but the largest (4-way connected); returns its cells. */
function keepLargestLand(map: GameMap): number[] {
  const seen = new Uint8Array(map.tiles.length);
  let largest: number[] = [];
  for (let i = 0; i < map.tiles.length; i++) {
    if (seen[i] || map.tiles[i] === Tile.Water) continue;
    const region: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const cur = stack.pop()!;
      region.push(cur);
      const cx = cur % map.width;
      const cy = (cur - cx) / map.width;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!map.inBounds(nx, ny)) continue;
        const n = map.idx(nx, ny);
        if (seen[n] || map.tiles[n] === Tile.Water) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (region.length > largest.length) largest = region;
  }
  const keep = new Set(largest);
  for (let i = 0; i < map.tiles.length; i++) {
    if (map.tiles[i] !== Tile.Water && !keep.has(i)) map.tiles[i] = Tile.Water;
  }
  return largest;
}
