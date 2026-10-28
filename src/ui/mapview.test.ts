import { describe, expect, it } from 'vitest';
import type { WorldObject } from '../game/defs/objects';
import { GameMap, Tile } from '../game/map';
import { PALETTE as P } from '../sprites/palette';
import { buildSprites } from '../sprites';
import { drawMap, stampSigns } from './mapview';

/** A small island: sea all round, sand inside, forest in the middle. */
function island(): GameMap {
  const map = new GameMap(20, 16);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const edge = Math.min(x, y, map.width - 1 - x, map.height - 1 - y);
      map.set(x, y, edge < 2 ? Tile.Water : edge < 4 ? Tile.Sand : Tile.Grass);
    }
  }
  return map;
}

const colors = (map: ReturnType<typeof drawMap>) => new Set(map.paper.pixels);

describe('the Cartographer map', () => {
  it('is blank paper where nothing is explored', () => {
    const map = island();
    const picture = drawMap(map, new Map(), { x: 8, y: 8 });
    expect(colors(picture).has(P.washForest)).toBe(false);
    expect(colors(picture).has(P.washSea)).toBe(false);
    expect(picture.markers).toEqual([expect.objectContaining({ sign: 'you' })]);
  });

  it('paints the explored ground and inks the coast', () => {
    const map = island();
    map.explored.fill(1);
    const c = colors(drawMap(map, new Map(), { x: 8, y: 8 }));
    for (const wash of [P.washSea, P.washSand, P.washForest, P.ink]) expect(c.has(wash)).toBe(true);
  });

  it('only signs the places the explorer has seen, and hatches bear country', () => {
    const map = island();
    const objects = new Map<number, WorldObject>([
      [map.idx(5, 5), { kind: 'hut' }],
      [map.idx(6, 5), { kind: 'campfire' }],
      [map.idx(10, 10), { kind: 'spring' }],
      [map.idx(12, 4), { kind: 'boat_wreck' }],
      [map.idx(14, 12), { kind: 'tree_pine' }],
      [map.idx(8, 8), { kind: 'hut' }],
    ]);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 20; x++) map.explored[map.idx(x, y)] = 1;
    const picture = drawMap(map, objects, { x: 8, y: 8 }, [map.idx(4, 6)]);
    // The spring is unexplored; the hut under the explorer shows as "you".
    expect(picture.markers.map((m) => m.sign).sort()).toEqual(['bear', 'fire', 'goal', 'hut', 'you']);
    expect(colors(picture).has(P.inkRed)).toBe(true);
    const sprites = buildSprites();
    const stamped = stampSigns(picture, (name) => sprites.get(name));
    expect(stamped.pixels.filter((c) => c === P.inkRed).length).toBeGreaterThan(0);
  });

  it('shows a cave sign at each way into a deep cave the explorer has seen', () => {
    const map = new GameMap(20, 16);
    map.explored[map.idx(3, 3)] = 1;
    const picture = drawMap(map, new Map(), { x: 8, y: 8 }, [], [map.idx(3, 3), map.idx(15, 12)]);
    expect(picture.markers.filter((m) => m.sign === 'cave')).toHaveLength(1);
  });

  it('draws the gangways of the oil rig as ink lines, red where one is broken', () => {
    const map = new GameMap(20, 10);
    map.tiles.fill(Tile.Water);
    for (let y = 3; y <= 6; y++) for (const x of [2, 3, 15, 16]) map.set(x, y, Tile.Deck);
    map.explored.fill(1);
    const objects = new Map<number, WorldObject>();
    for (let x = 4; x <= 14; x++) objects.set(map.idx(x, 4), { kind: x === 9 ? 'gangway_end_e' : x === 10 ? 'gangway_end_w' : 'gangway_ew' });
    const paper = drawMap(map, objects, { x: 2, y: 3 }).paper;
    const row = Math.floor(4.5 * 1.5) + 6;
    const inked = (x: number) => paper.get(Math.floor(x * 1.5) + 6, row);
    expect(inked(5)).toBe(P.ink);
    expect(inked(9)).toBe(P.inkRed);
  });
});
