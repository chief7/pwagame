import { describe, expect, it } from 'vitest';
import { buildSprites, grassTileName, shoreTileName, spriteGroups } from './index';
import { fromRows } from './pixel';

describe('sprites', () => {
  it('all have unique names and fully populated pixel grids', () => {
    const all = spriteGroups().flatMap((g) => g.sprites);
    expect(new Set(all.map((s) => s.name)).size).toBe(all.length);
    for (const s of all) {
      expect(s.pixels.length).toBe(s.width * s.height);
      expect(s.pixels.some((p) => p !== null)).toBe(true);
    }
  });

  it('includes the requested set', () => {
    const groups = Object.fromEntries(spriteGroups().map((g) => [g.title, g.sprites.length]));
    expect(groups['Palm trees']).toBeGreaterThanOrEqual(3);
    for (const title of ['Sand', 'Shores', 'Grass', 'Forest', 'Rock and caves', 'Shelter', 'Stones', 'Logs', 'Chests', 'Animals', 'Items']) {
      expect(groups[title]).toBeGreaterThan(0);
    }
  });

  it('terrain tiles are opaque', () => {
    for (const [name, s] of buildSprites()) {
      if (/^(water|sand|shore|grass|rock_|cave_floor)/.test(name)) {
        expect(s.pixels.every((p) => p !== null)).toBe(true);
      }
    }
  });

  it('has every facing for both characters, left mirroring right', () => {
    const sprites = buildSprites();
    for (const body of ['male', 'female']) {
      for (const facing of ['down', 'up', 'right', 'left']) expect(sprites.has(`${body}_${facing}`)).toBe(true);
      const right = sprites.get(`${body}_right`)!;
      const left = sprites.get(`${body}_left`)!;
      expect(left.get(0, 15)).toBe(right.get(15, 15));
      expect(left.pixels).toEqual(right.mirrored('x').pixels);
    }
  });

  it('has a sprite for every animal, item and object (and their alternate looks)', async () => {
    const { ANIMAL_KINDS } = await import('../game/defs/animals');
    const { ITEM_IDS } = await import('../game/defs/items');
    const { OBJECTS } = await import('../game/defs/objects');
    const sprites = buildSprites();
    for (const kind of ANIMAL_KINDS) expect(sprites.has(`animal_${kind}`)).toBe(true);
    for (const id of ITEM_IDS) expect(sprites.has(`item_${id}`)).toBe(true);
    for (const def of Object.values(OBJECTS)) {
      for (const name of [def.kind, def.depletedSprite, ...(def.frames ?? [])]) {
        if (name) expect(sprites.has(name), name).toBe(true);
      }
    }
  });

  it('fromRows rejects ragged rows', () => {
    expect(() => fromRows('bad', ['..', '...'], { '.': null })).toThrow(/row 1/);
  });
});

describe('shoreTileName', () => {
  const at = (water: [number, number][]) => (dx: number, dy: number) => water.some(([x, y]) => x === dx && y === dy);
  const sprites = buildSprites();

  it('picks edges, outer corners and inner corners', () => {
    expect(shoreTileName(at([]))).toBe('sand');
    expect(shoreTileName(at([[0, -1]]))).toBe('shore_edge_n');
    expect(shoreTileName(at([[1, 0]]))).toBe('shore_edge_e');
    expect(shoreTileName(at([[0, 1], [-1, 0], [-1, 1]]))).toBe('shore_outer_sw');
    expect(shoreTileName(at([[1, -1]]))).toBe('shore_inner_ne');
  });

  it('only returns names that exist', () => {
    const offsets: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
    for (let mask = 0; mask < 256; mask++) {
      const water = offsets.filter((_, i) => mask & (1 << i));
      expect(sprites.has(shoreTileName(at(water)))).toBe(true);
      expect(sprites.has(grassTileName(at(water)))).toBe(true);
    }
  });
});
