import { describe, expect, it } from 'vitest';
import { buildSprites, shoreTileName, spriteGroups } from './index';
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
    expect(groups['Palm trees']).toBe(3);
    for (const title of ['Sand', 'Shores', 'Stones', 'Logs', 'Chests']) expect(groups[title]).toBeGreaterThan(0);
  });

  it('terrain tiles are opaque', () => {
    for (const [name, s] of buildSprites()) {
      if (name === 'water' || name.startsWith('sand') || name.startsWith('shore')) {
        expect(s.pixels.every((p) => p !== null)).toBe(true);
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
    }
  });
});
