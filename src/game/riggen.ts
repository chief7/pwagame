import { canBeOpened, OBJECTS, type ObjectKind, type WorldObject } from './defs/objects';
import { levelDef } from './defs/levels';
import { RECIPES } from './defs/recipes';
import { GameMap, Tile } from './map';
import { distanceMap } from './pathing';
import type { Rng } from './rng';
import { NO_REGION, type World } from './worldgen';

// Island 4: the old oil rig. No land at all: steel platforms stand on legs
// in the open sea, joined by gangways. Some gangways are broken in the
// middle, and the explorer mends them with scrap metal to reach the far
// platforms, where the radio room is.

/** The platforms sit on a 3 × 3 grid of slots this far apart (in cells). */
const SLOT_GAP = { x: 18, y: 15 };
const PLATFORMS = { min: 6, max: 8 };
/** Half the width and height of a platform (the main deck is bigger). */
const MAIN_HALF = { w: [5, 6], h: [4, 5] } as const;
const HALF = { w: [3, 5], h: [2, 4] } as const;
/** How many gangways are broken. One of them is always on the way to the radio. */
const BROKEN = { min: 2, max: 4 };
/** Scrap the explorer can gather beyond what the gangways and the radio need. */
const SPARE_SCRAP = 8;
/** Scrap piles on the platforms the explorer can reach before mending anything. */
const START_PILES = 4;
const CHESTS = 6;
const NETS = 4;
const DRUMS = 3;
const TANKS = 2;
const MUSSEL_BEDS = 8;

/** What stands on the rig, for the compendium (the gangways and the goal aside). */
export const RIG_OBJECTS: ObjectKind[] = [
  'scrap_pile', 'rig_container', 'diesel_drums', 'pallet', 'old_net', 'water_tank', 'mussel_bed', 'life_ring',
  'derrick', 'crane', 'crew_cabin', 'balloon_crashed', 'chest_closed', 'fishing_boat_wreck',
  // Not there at first: the derrick becomes it once the explorer repairs it.
  'derrick_working',
];

/** A leg of the rig stands under every third cell of a deck's south edge. */
export const RIG_LEG_EVERY = 3;

export function rigLegAt(x: number): boolean {
  return x % RIG_LEG_EVERY === 1;
}

interface Platform {
  c: number;
  r: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Link {
  a: number;
  b: number;
  axis: 'ns' | 'ew';
  cells: { x: number; y: number }[];
  broken: boolean;
}

/** Where a platform's middle is. */
const mid = (p: Platform) => ({ x: Math.round((p.x0 + p.x1) / 2), y: Math.round((p.y0 + p.y1) / 2) });

/**
 * The rig: 6 to 8 platforms in the sea, joined by gangways into a tree with
 * at most one loop. The explorer starts on the big main deck in the middle,
 * next to the crashed balloon. A platform next to it has the crew cabin
 * (the camp) and is joined by a whole gangway; the radio room (the goal) is
 * on the platform furthest away, behind a broken gangway.
 */
export function generateRig(rng: Rng, width: number, height: number): World {
  for (;;) {
    const world = tryRig(rng, width, height);
    if (world) return world;
  }
}

function tryRig(rng: Rng, width: number, height: number): World | null {
  // Pick the slots: the middle one, then neighbours of what is there already.
  const slots: [number, number][] = [[1, 1]];
  const links: [number, number][] = [];
  const target = rng.int(PLATFORMS.min, PLATFORMS.max);
  const has = (c: number, r: number) => slots.findIndex(([sc, sr]) => sc === c && sr === r);
  while (slots.length < target) {
    const options: [number, [number, number]][] = [];
    slots.forEach(([c, r], i) => {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc >= 0 && nc <= 2 && nr >= 0 && nr <= 2 && has(nc, nr) < 0) options.push([i, [nc, nr]]);
      }
    });
    const [from, slot] = rng.pick(options);
    links.push([from, slots.length]);
    slots.push(slot);
  }
  // Sometimes one more gangway makes a loop.
  if (rng.chance(0.5)) {
    const extra: [number, number][] = [];
    slots.forEach(([c, r], i) => slots.forEach(([c2, r2], j) => {
      if (j <= i || Math.abs(c - c2) + Math.abs(r - r2) !== 1) return;
      if (!links.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) extra.push([i, j]);
    }));
    if (extra.length) links.push(rng.pick(extra));
  }

  const platforms: Platform[] = slots.map(([c, r], i) => {
    const half = i === 0 ? MAIN_HALF : HALF;
    const hw = rng.int(half.w[0], half.w[1]);
    const hh = rng.int(half.h[0], half.h[1]);
    const cx = Math.round(width / 2) + (c - 1) * SLOT_GAP.x + (i === 0 ? 0 : rng.int(-1, 1));
    const cy = Math.round(height / 2) + (r - 1) * SLOT_GAP.y + (i === 0 ? 0 : rng.int(-1, 1));
    return { c, r, x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh };
  });

  // Each gangway runs straight across the sea, away from the platforms' corners.
  const ways: Link[] = [];
  for (const [i, j] of links) {
    const [a, b] = platforms[i].c + platforms[i].r < platforms[j].c + platforms[j].r ? [i, j] : [j, i];
    const pa = platforms[a];
    const pb = platforms[b];
    const axis = pa.r === pb.r ? 'ew' : 'ns';
    const lo = axis === 'ew' ? Math.max(pa.y0, pb.y0) + 1 : Math.max(pa.x0, pb.x0) + 1;
    const hi = axis === 'ew' ? Math.min(pa.y1, pb.y1) - 1 : Math.min(pa.x1, pb.x1) - 1;
    if (lo > hi) return null;
    const at = rng.int(lo, hi);
    const cells = [];
    if (axis === 'ew') for (let x = pa.x1 + 1; x < pb.x0; x++) cells.push({ x, y: at });
    else for (let y = pa.y1 + 1; y < pb.y0; y++) cells.push({ x: at, y });
    if (cells.length < 2) return null;
    ways.push({ a, b, axis, cells, broken: false });
  }

  // How far each platform is from the main deck, counted in gangways.
  const depth = platforms.map(() => -1);
  depth[0] = 0;
  for (let changed = true; changed;) {
    changed = false;
    for (const w of ways) {
      for (const [p, q] of [[w.a, w.b], [w.b, w.a]]) {
        if (depth[p] >= 0 && (depth[q] < 0 || depth[q] > depth[p] + 1)) {
          depth[q] = depth[p] + 1;
          changed = true;
        }
      }
    }
  }
  const deepest = Math.max(...depth);
  const radio = rng.pick(platforms.map((_, i) => i).filter((i) => i > 0 && depth[i] === deepest));
  // The crew cabin is on a platform next to the main deck (not the radio's).
  const crewWays = ways.filter((w) => (w.a === 0 || w.b === 0) && w.a !== radio && w.b !== radio);
  if (!crewWays.length) return null;
  const crewWay = rng.pick(crewWays);
  const crew = crewWay.a === 0 ? crewWay.b : crewWay.a;
  // Every gangway into the radio platform is broken; then some more.
  for (const w of ways) if (w.a === radio || w.b === radio) w.broken = true;
  const wanted = rng.int(BROKEN.min, BROKEN.max);
  for (const w of rng.shuffle(ways.filter((w) => !w.broken && w !== crewWay))) {
    if (ways.filter((o) => o.broken).length >= wanted) break;
    w.broken = true;
  }

  const map = new GameMap(width, height);
  map.tiles.fill(Tile.Water);
  for (const p of platforms) for (let y = p.y0; y <= p.y1; y++) for (let x = p.x0; x <= p.x1; x++) map.set(x, y, Tile.Deck);
  const objects = new Map<number, WorldObject>();
  const put = (x: number, y: number, kind: ObjectKind) => objects.set(map.idx(x, y), { kind });
  for (const w of ways) {
    // A broken gangway has two broken ends in the middle of its span.
    const gap = Math.floor((w.cells.length - 2) / 2);
    w.cells.forEach(({ x, y }, k) => {
      if (w.broken && k === gap) put(x, y, w.axis === 'ew' ? 'gangway_end_e' : 'gangway_end_s');
      else if (w.broken && k === gap + 1) put(x, y, w.axis === 'ew' ? 'gangway_end_w' : 'gangway_end_n');
      else put(x, y, w.axis === 'ew' ? 'gangway_ew' : 'gangway_ns');
    });
  }

  // Cells next to where a gangway meets a deck stay clear.
  const reserved = new Set<number>();
  for (const w of ways) {
    for (const { x, y } of w.cells) {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) reserved.add(map.idx(x + dx, y + dy));
    }
  }

  // A helipad on a big enough platform that is not the main deck, the crew's or the radio's.
  const padOn = rng.shuffle(platforms.map((_, i) => i).filter((i) => i !== 0 && i !== crew && i !== radio))
    .find((i) => platforms[i].x1 - platforms[i].x0 >= 4 && platforms[i].y1 - platforms[i].y0 >= 4);
  if (padOn !== undefined) {
    const m = mid(platforms[padOn]);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) map.set(m.x + dx, m.y + dy, Tile.Helipad);
  }

  /** A free cell on a platform, away from its edge if it can, or null. */
  const freeOn = (i: number): { x: number; y: number } | null => {
    const p = platforms[i];
    const cells: { x: number; y: number }[] = [];
    for (let y = p.y0 + 1; y < p.y1; y++) {
      for (let x = p.x0 + 1; x < p.x1; x++) {
        const k = map.idx(x, y);
        if (map.get(x, y) === Tile.Deck && !objects.has(k) && !reserved.has(k)) cells.push({ x, y });
      }
    }
    return cells.length ? rng.pick(cells) : null;
  };
  const placeOn = (i: number, kind: ObjectKind): boolean => {
    const cell = freeOn(i);
    if (cell) put(cell.x, cell.y, kind);
    return !!cell;
  };
  const anywhere = (kind: ObjectKind, not: number[] = []): boolean => {
    for (const i of rng.shuffle(platforms.map((_, k) => k).filter((k) => !not.includes(k)))) if (placeOn(i, kind)) return true;
    return false;
  };

  // The main deck: the derrick in the middle, the crashed balloon, and the explorer next to it.
  const main = mid(platforms[0]);
  put(main.x, main.y - 1, 'derrick');
  reserved.add(map.idx(main.x, main.y));
  const balloon = freeOn(0);
  if (!balloon) return null;
  put(balloon.x, balloon.y, 'balloon_crashed');
  const start = [[1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1], [0, -1]]
    .map(([dx, dy]) => ({ x: balloon.x + dx, y: balloon.y + dy }))
    .find(({ x, y }) => map.get(x, y) === Tile.Deck && !objects.has(map.idx(x, y)));
  if (!start) return null;
  reserved.add(map.idx(start.x, start.y));
  for (const kind of ['crane', 'rig_container', 'life_ring', 'diesel_drums', 'chest_closed'] as ObjectKind[]) {
    if (!placeOn(0, kind)) return null;
  }

  // The crew platform: the cabin in the middle, a water tank, wood.
  const cabin = mid(platforms[crew]);
  if (map.get(cabin.x, cabin.y) !== Tile.Deck || objects.has(map.idx(cabin.x, cabin.y))) return null;
  put(cabin.x, cabin.y, 'crew_cabin');
  for (const kind of ['water_tank', 'pallet', 'old_net'] as ObjectKind[]) if (!placeOn(crew, kind)) return null;

  // The radio platform: the radio room in the middle, and fuel.
  const room = mid(platforms[radio]);
  put(room.x, room.y, levelDef(4).site);
  if (!placeOn(radio, 'diesel_drums') || !placeOn(radio, 'chest_closed')) return null;

  // Everything else, spread over the platforms.
  const counts: [ObjectKind, number, number[]][] = [
    ['chest_closed', CHESTS - 2, [0, radio]],
    ['old_net', NETS - 1, []],
    ['diesel_drums', DRUMS - 2, [0, radio]],
    ['water_tank', TANKS - 1, [0, crew]],
    ['pallet', 2, []],
    ['rig_container', platforms.length - 3, [0]],
    ['life_ring', 2, [0]],
  ];
  for (const [kind, n, not] of counts) for (let k = 0; k < n; k++) if (!anywhere(kind, not)) return null;

  // The old fishing boat lies in the sea at the south edge of the crew platform (or the main deck).
  const dockOn = (i: number) => {
    const p = platforms[i];
    const y = p.y1 + 1;
    const xs = [];
    for (let x = p.x0 + 1; x < p.x1; x++) {
      const k = map.idx(x, y);
      if (!rigLegAt(x) && !objects.has(k) && !reserved.has(k) && !objects.has(map.idx(x, y + 1))) xs.push(x);
    }
    return xs.length ? map.idx(rng.pick(xs), y) : -1;
  };
  const dock = [crew, 0].map(dockOn).find((k) => k >= 0);
  if (dock === undefined) return null;
  objects.set(dock, { kind: 'fishing_boat_wreck' });
  // The boat is 3 cells wide: nothing else in the sea next to it.
  for (let d = -2; d <= 2; d++) reserved.add(dock + d);

  // Enough scrap for every broken gangway, the radio, the derrick and the boat, some of it within reach at the start.
  const repairs = ways.filter((w) => w.broken).length * (RECIPES.gangway.cost.scrap ?? 0);
  const radioScrap = levelDef(4).stages.reduce((n, s) => n + (s.cost.scrap ?? 0), 0);
  const siteScrap = (['derrick', 'fishing_boat_wreck'] as ObjectKind[]).reduce((n, k) => n + (OBJECTS[k].siteCost?.scrap ?? 0), 0);
  const piles = Math.ceil((repairs + radioScrap + siteScrap + SPARE_SCRAP) / 2);
  const near = platforms.map((_, i) => i).filter((i) => i === 0 || reachableWhole(ways, i));
  for (let k = 0; k < piles; k++) {
    const ok = k < START_PILES ? anywhere('scrap_pile', platforms.map((_, i) => i).filter((i) => !near.includes(i))) : anywhere('scrap_pile');
    if (!ok) return null;
  }

  // Mussels on the legs, in the sea under the south edge of a deck.
  const legs: { x: number; y: number }[] = [];
  for (const p of platforms) {
    for (let x = p.x0; x <= p.x1; x++) {
      const k = map.idx(x, p.y1 + 1);
      if (rigLegAt(x) && !objects.has(k) && !reserved.has(k)) legs.push({ x, y: p.y1 + 1 });
    }
  }
  for (const { x, y } of rng.shuffle(legs).slice(0, MUSSEL_BEDS)) if (!objects.has(map.idx(x, y))) put(x, y, 'mussel_bed');

  if (!allReachable(map, objects, start)) return null;
  const region = new Uint8Array(width * height).fill(NO_REGION);
  return { map, start, objects, region };
}

/** Whether platform i is joined to the main deck by whole gangways only. */
function reachableWhole(ways: Link[], i: number): boolean {
  const seen = new Set([0]);
  for (let changed = true; changed;) {
    changed = false;
    for (const w of ways) {
      if (w.broken) continue;
      if (seen.has(w.a) !== seen.has(w.b)) {
        seen.add(w.a);
        seen.add(w.b);
        changed = true;
      }
    }
  }
  return seen.has(i);
}

/** Every free deck cell can be reached from the start, counting broken gangways as mended. */
function allReachable(map: GameMap, objects: Map<number, WorldObject>, start: { x: number; y: number }): boolean {
  const open = (x: number, y: number) => {
    if (!map.inBounds(x, y)) return false;
    const obj = objects.get(map.idx(x, y));
    if (map.isFloor(x, y)) return !obj || !!OBJECTS[obj.kind].walkable;
    return !!obj && (!!OBJECTS[obj.kind].overSea || canBeOpened(obj.kind));
  };
  const dist = distanceMap(map, start.x, start.y, open);
  for (let i = 0; i < map.tiles.length; i++) {
    const x = i % map.width;
    const y = (i - x) / map.width;
    if (map.isFloor(x, y) && open(x, y) && dist[i] < 0) return false;
  }
  return true;
}
