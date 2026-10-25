import type { GameMap } from './map';

export const DIRS: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

export type Passable = (x: number, y: number) => boolean;

/**
 * Breadth-first distance (8-way) from (sx, sy) over passable cells.
 * Unreachable cells are -1.
 */
export function distanceMap(map: GameMap, sx: number, sy: number, passable: Passable): Int32Array {
  const dist = new Int32Array(map.width * map.height).fill(-1);
  if (!map.inBounds(sx, sy)) return dist;
  const queue = new Int32Array(map.width * map.height);
  let head = 0;
  let tail = 0;
  const start = map.idx(sx, sy);
  dist[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % map.width;
    const cy = (cur - cx) / map.width;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!map.inBounds(nx, ny) || !passable(nx, ny)) continue;
      const n = map.idx(nx, ny);
      if (dist[n] !== -1) continue;
      dist[n] = dist[cur] + 1;
      queue[tail++] = n;
    }
  }
  return dist;
}

/** The widest river a bridge can span, in cells. */
export const BRIDGE_SPAN = 3;

/**
 * Which cells can be reached from (sx, sy) if bridges were built wherever
 * one fits: 8-way over `open` cells, plus straight jumps across up to
 * BRIDGE_SPAN river cells (`river`) onto open ground.
 */
export function reachWithBridges(map: GameMap, sx: number, sy: number, open: Passable, river: Passable): Uint8Array {
  const seen = new Uint8Array(map.width * map.height);
  if (!map.inBounds(sx, sy)) return seen;
  const queue = new Int32Array(map.width * map.height);
  let head = 0;
  let tail = 0;
  seen[map.idx(sx, sy)] = 1;
  queue[tail++] = map.idx(sx, sy);
  const visit = (x: number, y: number) => {
    const n = map.idx(x, y);
    if (seen[n]) return;
    seen[n] = 1;
    queue[tail++] = n;
  };
  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % map.width;
    const cy = (cur - cx) / map.width;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (map.inBounds(nx, ny) && open(nx, ny)) visit(nx, ny);
      if (dx !== 0 && dy !== 0) continue;
      for (let k = 1; k <= BRIDGE_SPAN + 1; k++) {
        const x = cx + dx * k;
        const y = cy + dy * k;
        if (!map.inBounds(x, y)) break;
        if (river(x, y)) continue;
        if (k > 1 && open(x, y)) visit(x, y);
        break;
      }
    }
  }
  return seen;
}
