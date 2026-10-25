import type { GameMap } from './map';

export const DIRS: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/**
 * Breadth-first distance (8-way) from (sx, sy) over walkable cells.
 * Unreachable cells are -1.
 */
export function distanceMap(map: GameMap, sx: number, sy: number): Int32Array {
  const dist = new Int32Array(map.width * map.height).fill(-1);
  if (!map.isWalkable(sx, sy)) return dist;
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
      if (!map.isWalkable(nx, ny)) continue;
      const n = map.idx(nx, ny);
      if (dist[n] !== -1) continue;
      dist[n] = dist[cur] + 1;
      queue[tail++] = n;
    }
  }
  return dist;
}
