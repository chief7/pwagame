import { describe, expect, it } from 'vitest';
import { buildSprites, edgeTileName, grassTileName, mixedTile, shoreTileName, spriteGroups } from './index';
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
      if (/^(water(?!_tank)|deck|helipad|sand(?!bar)|shore|grass|rock_|cave_|scree|snow|bank|river|mouth)/.test(name)) {
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
    for (const kind of ANIMAL_KINDS) {
      for (const facing of ['', '_left']) {
        for (const frame of ['', '_step1', '_step2']) expect(sprites.has(`animal_${kind}${facing}${frame}`)).toBe(true);
      }
    }
    for (const id of ITEM_IDS) expect(sprites.has(`item_${id}`)).toBe(true);
    for (const def of Object.values(OBJECTS)) {
      for (const name of [def.kind, def.depletedSprite, ...(def.frames ?? []), ...(def.done?.frames ?? [])]) {
        if (name) expect(sprites.has(name), name).toBe(true);
      }
    }
  });

  it('has a hut sprite for every set of rooms, with both smoke frames', async () => {
    const { hutSprite, ROOM_IDS } = await import('../game/defs/rooms');
    const sprites = buildSprites();
    for (let mask = 0; mask < 1 << ROOM_IDS.length; mask++) {
      const rooms = ROOM_IDS.filter((_, i) => mask & (1 << i));
      for (const frame of [0, 1]) expect(sprites.has(hutSprite(rooms, frame)), hutSprite(rooms, frame)).toBe(true);
    }
    for (const name of ['room_main', 'room_main_map', 'room_hearth_2', ...ROOM_IDS.map((r) => `room_${r}`)]) {
      expect(sprites.has(name), name).toBe(true);
    }
  });

  it('has a fishing pose for every facing and the boat trip for both explorers', () => {
    const sprites = buildSprites();
    for (const body of ['male', 'female']) {
      for (const facing of ['down', 'up', 'right', 'left']) expect(sprites.has(`${body}_${facing}_fish`)).toBe(true);
      for (const name of ['', '_2', '_left', '_left_2']) expect(sprites.has(`boat_away_${body}${name}`)).toBe(true);
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

describe('edgeTileName', () => {
  const sprites = buildSprites();
  const offsets: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  const around = (kinds: string) => (dx: number, dy: number) => kinds[offsets.findIndex(([x, y]) => x === dx && y === dy)];

  it('uses the plain tile, one transition set, or a mixed tile', () => {
    expect(edgeTileName('grass', 'grass', around('........'))).toBe('grass');
    expect(edgeTileName('grass', 'grass', around('a.......'))).toBe('grass_edge_n');
    expect(edgeTileName('scree', 'scree', around('.r......'))).toBe('scree_bank_edge_s');
    expect(edgeTileName('river', '≈', around('...w....'))).toBe('mouth_edge_e');
    expect(edgeTileName('grass', 'grass', around('a..c....'))).toBe('mix_grass_a..c....');
  });

  it('only gives names that exist or that mixedTile can paint, fully opaque', () => {
    for (const [own, letters] of [['grass', '.arc'], ['snow', '.cr']] as const) {
      // Every mix of neighbours (every 5th for grass, which has 4^8 of them).
      const count = letters.length ** offsets.length;
      for (let n = 0; n < count; n += own === 'grass' ? 5 : 1) {
        const kinds = offsets.map((_, i) => letters[Math.floor(n / letters.length ** i) % letters.length]).join('');
        const name = edgeTileName(own, own, around(kinds));
        const sprite = sprites.get(name) ?? mixedTile(name);
        expect(sprite, name).toBeTruthy();
        expect(sprite!.pixels.every((p) => p !== null), name).toBe(true);
      }
    }
  });

  it('paints each side of a mixed tile with its own edge', () => {
    const tile = mixedTile('mix_grass_a..c....')!;
    expect(tile.get(8, 0)).not.toBe(tile.get(15, 8));
    expect(mixedTile('mix_grass_zzzzzzzz')).toBeNull();
  });
});
