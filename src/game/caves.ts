import { GameMap, Tile } from './map';
import { distanceMap } from './pathing';
import type { Rng } from './rng';

export interface CaveLevel {
  map: GameMap;
  start: { x: number; y: number };
  stairs: { x: number; y: number };
}

const FILL_CHANCE = 0.45;
const SMOOTH_PASSES = 5;
const MIN_FLOOR_RATIO = 0.3;

/**
 * Cellular-automata caves. Only the largest connected region is kept, so
 * every floor cell is reachable from the start.
 */
export function generateCaves(width: number, height: number, rng: Rng): CaveLevel {
  for (;;) {
    const level = tryGenerate(width, height, rng);
    if (level) return level;
  }
}

function tryGenerate(width: number, height: number, rng: Rng): CaveLevel | null {
  let map = new GameMap(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      map.set(x, y, edge || rng.chance(FILL_CHANCE) ? Tile.Wall : Tile.Floor);
    }
  }

  for (let i = 0; i < SMOOTH_PASSES; i++) map = smooth(map);

  const regions = floodRegions(map);
  if (regions.length === 0) return null;
  const largest = regions.reduce((a, b) => (b.length > a.length ? b : a));
  if (largest.length < width * height * MIN_FLOOR_RATIO) return null;

  const keep = new Set(largest);
  for (let i = 0; i < map.tiles.length; i++) {
    if (map.tiles[i] === Tile.Floor && !keep.has(i)) map.tiles[i] = Tile.Wall;
  }

  const startIdx = rng.pick(largest);
  const start = { x: startIdx % width, y: Math.floor(startIdx / width) };

  // Stairs go on the floor cell farthest from the start.
  const dist = distanceMap(map, start.x, start.y);
  let far = startIdx;
  for (const i of largest) if (dist[i] > dist[far]) far = i;
  const stairs = { x: far % width, y: Math.floor(far / width) };
  map.set(stairs.x, stairs.y, Tile.Stairs);

  return { map, start, stairs };
}

function smooth(map: GameMap): GameMap {
  const next = new GameMap(map.width, map.height);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      let walls = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx || dy) && map.get(x + dx, y + dy) === Tile.Wall) walls++;
        }
      }
      const edge = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1;
      next.set(x, y, edge || walls > 4 || (walls === 4 && map.get(x, y) === Tile.Wall) ? Tile.Wall : Tile.Floor);
    }
  }
  return next;
}

function floodRegions(map: GameMap): number[][] {
  const seen = new Uint8Array(map.tiles.length);
  const regions: number[][] = [];
  for (let i = 0; i < map.tiles.length; i++) {
    if (seen[i] || map.tiles[i] === Tile.Wall) continue;
    const region: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const cur = stack.pop()!;
      region.push(cur);
      const cx = cur % map.width;
      const cy = (cur - cx) / map.width;
      // 4-way so regions only joined by a diagonal crack count as separate.
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!map.inBounds(nx, ny)) continue;
        const n = map.idx(nx, ny);
        if (seen[n] || map.tiles[n] === Tile.Wall) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    regions.push(region);
  }
  return regions;
}
