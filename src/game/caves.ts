import { Tile, type GameMap } from './map';
import { DIRS } from './pathing';

// Deep caves: big caves dug into the rocky hills (see worldgen.ts). They are
// found from the tiles, so the save does not store them: every connected
// patch of cave floor with at least DEEP_CAVE_CELLS cells and only a few
// ways in is one.

/** Cave floor cells that make a connected cave a deep cave. Smaller pockets are just nooks in the rock. */
export const DEEP_CAVE_CELLS = 30;
/** More ways in than this, and the cave floor is a row of nooks open to the sky, not a cave. */
const MAX_WAYS_IN = 4;
/** Ways in that are this close (in cells) are one entrance on the map. */
const ENTRANCE_GAP = 3;

export interface Cave {
  /** Cell indexes of its floor. */
  cells: number[];
  /**
   * One cell for each way in: cave floor next to open ground outside. The
   * Cartographer's map puts a sign there.
   */
  entrances: number[];
}

/** Every deep cave on the map. */
export function findCaves(map: GameMap): Cave[] {
  const seen = new Uint8Array(map.tiles.length);
  const caves: Cave[] = [];
  for (let start = 0; start < map.tiles.length; start++) {
    if (seen[start] || map.tiles[start] !== Tile.CaveFloor) continue;
    const cells = [start];
    seen[start] = 1;
    for (let head = 0; head < cells.length; head++) {
      const x = cells[head] % map.width;
      const y = (cells[head] - x) / map.width;
      for (const [dx, dy] of DIRS) {
        if (!map.inBounds(x + dx, y + dy)) continue;
        const n = map.idx(x + dx, y + dy);
        if (seen[n] || map.tiles[n] !== Tile.CaveFloor) continue;
        seen[n] = 1;
        cells.push(n);
      }
    }
    if (cells.length < DEEP_CAVE_CELLS) continue;
    // A way in is next to open ground. If the river cuts the cave off from
    // it (a bridge leads in), the way in is by the river.
    const outside = (x: number, y: number) => map.isFloor(x, y) && map.get(x, y) !== Tile.CaveFloor;
    let entrances = waysIn(map, cells, outside);
    if (!entrances.length) entrances = waysIn(map, cells, (x, y) => map.get(x, y) === Tile.River);
    if (entrances.length > MAX_WAYS_IN) continue;
    caves.push({ cells, entrances });
  }
  return caves;
}

/** Cave cells next to `outside`, one for each group of them. */
function waysIn(map: GameMap, cells: readonly number[], outside: (x: number, y: number) => boolean): number[] {
  const out: number[] = [];
  for (const i of cells) {
    const x = i % map.width;
    const y = (i - x) / map.width;
    if (!DIRS.some(([dx, dy]) => outside(x + dx, y + dy))) continue;
    const near = out.some((e) => Math.max(Math.abs((e % map.width) - x), Math.abs(Math.floor(e / map.width) - y)) <= ENTRANCE_GAP);
    if (!near) out.push(i);
  }
  return out;
}

/** Per cell: CAVE_FLOOR on the floor of a deep cave, CAVE_WALL on the rock round it, else 0. */
export const CAVE_FLOOR = 1;
export const CAVE_WALL = 2;

export function caveMask(map: GameMap, caves: readonly Cave[]): Uint8Array {
  const mask = new Uint8Array(map.tiles.length);
  for (const cave of caves) {
    for (const i of cave.cells) {
      mask[i] = CAVE_FLOOR;
      const x = i % map.width;
      const y = (i - x) / map.width;
      for (const [dx, dy] of DIRS) {
        if (map.get(x + dx, y + dy) === Tile.Rock) mask[map.idx(x + dx, y + dy)] = CAVE_WALL;
      }
    }
  }
  return mask;
}
