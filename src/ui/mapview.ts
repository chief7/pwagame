import { OBJECTS, type ObjectKind, type WorldObject } from '../game/defs/objects';
import { Tile, type GameMap } from '../game/map';
import type { MapSign } from '../i18n/types';
import { PALETTE as P } from '../sprites/palette';
import { hash2, Sprite } from '../sprites/pixel';

// The Cartographer's map: the explored island drawn as ink and washes on
// paper. It is rough on purpose: each 2×2 block of cells becomes one patch,
// so the player gets an idea of the island, not every cell.

/** Cells per side of one patch on the map. */
export const MAP_BLOCK = 2;
/** Pixels per side of one patch. */
const PATCH = 3;
/** Paper margin around the island, in pixels. */
const MARGIN = 6;
/** Cells around a bear sighting that the map shades as bear country. */
export const BEAR_AREA = 5;

type Ground = 'sea' | 'river' | 'sand' | 'forest' | 'rock' | 'scree' | 'snow' | 'ash' | 'lava';

const GROUND: Record<Tile, Ground> = {
  [Tile.Water]: 'sea',
  [Tile.Sand]: 'sand',
  [Tile.Grass]: 'forest',
  [Tile.Rock]: 'rock',
  [Tile.CaveFloor]: 'rock',
  [Tile.River]: 'river',
  [Tile.Scree]: 'scree',
  [Tile.Snow]: 'snow',
  [Tile.Ash]: 'ash',
  [Tile.Lava]: 'lava',
};

/** Two washes per ground, mixed by noise so the paint looks uneven. */
const WASH: Record<Ground, [string, string]> = {
  sea: [P.washSea, P.washSeaDeep],
  river: [P.washRiver, P.washRiver],
  sand: [P.washSand, P.washSand],
  forest: [P.washForest, P.washForestDark],
  rock: [P.washRock, P.washRockDark],
  scree: [P.washRock, P.washSand],
  snow: [P.washSnow, P.washSnow],
  ash: [P.washAsh, P.washAshDark],
  lava: [P.washLava, P.washLavaDark],
};

/** Objects that get a sign on the map (besides the island goal). */
const SIGNS: Partial<Record<ObjectKind, MapSign>> = { hut: 'hut', campfire: 'fire', spring: 'spring', hot_spring: 'spring' };

export interface MapMarker {
  /** Drawn with the sprite `map_<sign>`. */
  sign: MapSign;
  x: number;
  y: number;
}

export interface MapPicture {
  paper: Sprite;
  /** Signs to draw on top, centred on these pixels of the paper. */
  markers: MapMarker[];
}

/** The paper with its signs stamped on, ready to bake. `sprite` finds a sign's sprite by name. */
export function stampSigns(picture: MapPicture, sprite: (name: string) => Sprite | undefined): Sprite {
  const out = picture.paper;
  for (const m of picture.markers) {
    const s = sprite(`map_${m.sign}`);
    if (!s) continue;
    const x0 = m.x - (s.width >> 1);
    const y0 = m.y - (s.height >> 1);
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const c = s.get(x, y);
        if (c) out.set(x0 + x, y0 + y, c);
      }
    }
  }
  return out;
}

/**
 * Draw what the explorer has seen of the island, with signs for places they
 * know. `bearSpots` are cells where they saw a cave bear: the map hatches the
 * ground around each in red. `caveEntrances` are the ways into the deep
 * caves: each one the explorer has seen gets a cave sign.
 */
export function drawMap(
  map: GameMap, objects: Map<number, WorldObject>, player: { x: number; y: number }, bearSpots: readonly number[] = [],
  caveEntrances: readonly number[] = [],
): MapPicture {
  const bw = Math.ceil(map.width / MAP_BLOCK);
  const bh = Math.ceil(map.height / MAP_BLOCK);
  // Each patch takes the most common ground among its explored cells.
  const patches: (Ground | null)[] = new Array(bw * bh).fill(null);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const counts = new Map<Ground, number>();
      for (let dy = 0; dy < MAP_BLOCK; dy++) {
        for (let dx = 0; dx < MAP_BLOCK; dx++) {
          const x = bx * MAP_BLOCK + dx;
          const y = by * MAP_BLOCK + dy;
          if (!map.isExplored(x, y)) continue;
          const g = GROUND[map.get(x, y)];
          counts.set(g, (counts.get(g) ?? 0) + 1);
        }
      }
      let best: Ground | null = null;
      for (const [g, n] of counts) if (!best || n > counts.get(best)!) best = g;
      patches[by * bw + bx] = best;
    }
  }
  const patch = (bx: number, by: number) => (bx >= 0 && by >= 0 && bx < bw && by < bh ? patches[by * bw + bx] : null);
  const land = (g: Ground | null) => g !== null && g !== 'sea' && g !== 'river';

  const paper = new Sprite('map_paper', bw * PATCH + MARGIN * 2, bh * PATCH + MARGIN * 2);
  paper.paint((x, y) => {
    // Old paper: a light middle, darker towards the torn edge.
    const edge = Math.min(x, y, paper.width - 1 - x, paper.height - 1 - y);
    const n = hash2(x, y, 7);
    if (edge < 1 + Math.floor(hash2(x >> 2, y >> 2, 3) * 2)) return n < 0.5 ? P.paperDeep : null;
    if (edge < 3) return P.paperDark;
    return n < 0.06 ? P.paperDark : n > 0.94 ? P.paperLight : P.paper;
  });
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const g = patch(bx, by);
      if (!g) continue;
      const [a, b] = WASH[g];
      // Ink the coast: the side of a land patch that faces the sea. The edge of
      // what the explorer knows stays open, so it never looks like a shore.
      const sea = (dx: number, dy: number) => patch(bx + dx, by + dy) === 'sea';
      const coast = land(g) && (sea(1, 0) || sea(-1, 0) || sea(0, 1) || sea(0, -1));
      for (let py = 0; py < PATCH; py++) {
        for (let px = 0; px < PATCH; px++) {
          const x = MARGIN + bx * PATCH + px;
          const y = MARGIN + by * PATCH + py;
          let color = hash2(x, y, 11) < 0.3 ? b : a;
          if (coast) {
            const outer = (px === 0 && sea(-1, 0)) || (px === PATCH - 1 && sea(1, 0)) || (py === 0 && sea(0, -1)) || (py === PATCH - 1 && sea(0, 1));
            if (outer) color = P.ink;
          }
          paper.set(x, y, color);
        }
      }
    }
  }

  // Bear country: red hatching on the known ground near each sighting.
  for (const spot of bearSpots) {
    const sx = spot % map.width;
    const sy = Math.floor(spot / map.width);
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        if (!patch(bx, by)) continue;
        const dx = (bx + 0.5) * MAP_BLOCK - sx;
        const dy = (by + 0.5) * MAP_BLOCK - sy;
        if (dx * dx + dy * dy > BEAR_AREA * BEAR_AREA) continue;
        for (let py = 0; py < PATCH; py++) {
          for (let px = 0; px < PATCH; px++) {
            const x = MARGIN + bx * PATCH + px;
            const y = MARGIN + by * PATCH + py;
            if ((x + y) % 3 === 0 && paper.get(x, y) !== P.ink) paper.set(x, y, P.inkRed);
          }
        }
      }
    }
  }

  const at = (cx: number, cy: number) => ({
    x: MARGIN + Math.floor(cx / MAP_BLOCK) * PATCH + (PATCH >> 1),
    y: MARGIN + Math.floor(cy / MAP_BLOCK) * PATCH + (PATCH >> 1),
  });
  const markers: MapMarker[] = [];
  for (const [i, o] of objects) {
    const x = i % map.width;
    const y = Math.floor(i / map.width);
    if (!map.isExplored(x, y) || (x === player.x && y === player.y)) continue;
    const sign = SIGNS[o.kind] ?? (OBJECTS[o.kind].goal ? 'goal' : null);
    if (sign) markers.push({ sign, ...at(x, y) });
  }
  for (const i of caveEntrances) {
    const x = i % map.width;
    const y = Math.floor(i / map.width);
    if (map.isExplored(x, y)) markers.push({ sign: 'cave', ...at(x, y) });
  }
  for (const spot of bearSpots) markers.push({ sign: 'bear', ...at(spot % map.width, Math.floor(spot / map.width)) });
  markers.push({ sign: 'you', ...at(player.x, player.y) });
  return { paper, markers };
}
