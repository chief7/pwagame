import { describe, expect, it } from 'vitest';
import { buildSprites, edgeTileName, grassScreeTileName, grassTileName, mixedTile, riverBankTileName, shoreTileName, snowTileName } from '../sprites';
import { DEEP_CAVE_CELLS, findCaves } from './caves';
import { daylight, isLowTide, isNight, nextLowTide, phase, turnsUntilMorning, TURNS_PER_DAY } from './clock';
import { computeFov } from './fov';
import { ANIMALS } from './defs/animals';
import { canBeOpened, OBJECTS, type ObjectKind } from './defs/objects';
import { LEVELS } from './defs/levels';
import { RECIPES } from './defs/recipes';
import { ROOMS } from './defs/rooms';
import { pointsForXp, SKILLS, xpForPoints } from './defs/skills';
import {
  BAG_LOAD, Game, HOLD_LOAD, HOLD_UPGRADE, PACK_FRAME_LOAD, PLATFORM_RANGE, RADIO_ORDERS, SAVE_VERSION, STORAGE_WIDTH, STRONG_BACK_LOAD, VOYAGE_DIESEL, VOYAGE_TURNS,
} from './game';
import { GameMap, Tile } from './map';
import { freshNeeds, tickNeeds, warmthTarget } from './needs';
import { distanceMap, reachWithBridges } from './pathing';
import { Rng } from './rng';
import { drawMap } from '../ui/mapview';
import { generateWorld, NO_REGION, WORLD_HEIGHT, WORLD_WIDTH } from './worldgen';

describe('Rng', () => {
  it('is deterministic for a seed and can resume from saved state', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
    const c = new Rng(1);
    c.state32 = a.state32;
    expect(c.next()).toBe(a.next());
  });
});

describe('generateWorld', () => {
  const sprites = buildSprites();
  const worlds = [1, 2, 3, 4, 5, 6].map((seed) => generateWorld(new Rng(seed)));

  it('makes one island where every bit of ground can be reached by clearing brambles and bridging the river', () => {
    for (const { map, start, objects } of worlds) {
      // The sandbar to the tide islet counts as a way: it is dry at low tide.
      const passable = (x: number, y: number) => {
        const o = objects.get(map.idx(x, y));
        if (o && OBJECTS[o.kind].tidal) return true;
        return map.isFloor(x, y) && (!o || o.kind === 'lean_to' || o.kind === 'hut' || o.kind === 'bramble');
      };
      const reach = reachWithBridges(map, start.x, start.y, passable, (x, y) => map.get(x, y) === Tile.River);
      for (let i = 0; i < map.tiles.length; i++) {
        const x = i % map.width;
        const y = (i - x) / map.width;
        if (passable(x, y)) expect(reach[i], `cell ${x},${y}`).toBe(1);
      }
      for (let x = 0; x < map.width; x++) expect(map.isLand(x, 0)).toBe(false);
    }
  });

  it('closes the home coast with brambles and the forest with a river', () => {
    for (const { map, start, objects, region } of worlds) {
      const free = (x: number, y: number) => map.isFloor(x, y) && objects.get(map.idx(x, y))?.kind !== 'bramble';
      const home = distanceMap(map, start.x, start.y, free);
      const forest = distanceMap(map, start.x, start.y, (x, y) => map.isFloor(x, y));
      const counts = [0, 0, 0];
      for (let i = 0; i < map.tiles.length; i++) {
        if (region[i] === NO_REGION) continue;
        counts[region[i]]++;
        if (home[i] >= 0) expect(region[i]).toBe(0);
        if (forest[i] >= 0) expect(region[i]).toBeLessThan(2);
      }
      const total = counts[0] + counts[1] + counts[2];
      expect(counts[0] / total).toBeGreaterThan(0.25);
      expect(counts[2] / total).toBeGreaterThan(0.15);
    }
  });

  it('puts fresh water on the home coast and chests in every region', () => {
    for (const { objects, region } of worlds) {
      const where = (kind: string) => [...objects].filter(([, o]) => o.kind === kind).map(([i]) => region[i]);
      expect(where('spring').filter((r) => r === 0).length).toBeGreaterThanOrEqual(2);
      for (const r of [0, 1, 2]) expect(where('chest_closed')).toContain(r);
    }
  });

  it('puts one old boat on a far-side beach by the sea, with room round it', () => {
    for (const { map, objects, region } of worlds) {
      const boats = [...objects].filter(([, o]) => o.kind === 'boat_wreck');
      expect(boats).toHaveLength(1);
      const [i] = boats[0];
      const x = i % map.width;
      const y = (i - x) / map.width;
      expect(region[i]).toBe(2);
      expect(map.get(x, y)).toBe(Tile.Sand);
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.get(x + dx, y + dy) === Tile.Water)).toBe(true);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx || dy) expect(objects.has(map.idx(x + dx, y + dy)), `next to the boat at ${x},${y}`).toBe(false);
        }
      }
    }
  });

  it('has beach, forest, fresh water and chests on every island', () => {
    for (const { map, objects } of worlds) {
      const tiles = new Set(map.tiles);
      expect(tiles.has(Tile.Sand)).toBe(true);
      expect(tiles.has(Tile.Grass)).toBe(true);
      const kinds = [...objects.values()].map((o) => o.kind);
      expect(kinds).toContain('spring');
      expect(kinds).toContain('chest_closed');
      expect(kinds.some((k) => k.startsWith('palm'))).toBe(true);
      expect(kinds.some((k) => k.startsWith('tree'))).toBe(true);
    }
    // Hills and caves vary by island but should show up on most.
    const withCaves = worlds.filter(({ map }) => map.tiles.includes(Tile.CaveFloor)).length;
    expect(withCaves).toBeGreaterThanOrEqual(3);
  });

  it('only makes coasts and forest edges the transition tiles can draw', () => {
    for (const { map } of worlds) {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const t = map.get(x, y);
          if (map.isWet(x, y)) continue;
          const water = (dx: number, dy: number) => map.isWet(x + dx, y + dy);
          expect(water(0, -1) && water(0, 1)).toBe(false);
          expect(water(-1, 0) && water(1, 0)).toBe(false);
          expect(sprites.has(shoreTileName(water))).toBe(true);
          if (t === Tile.Grass) {
            const river = (dx: number, dy: number) => map.get(x + dx, y + dy) === Tile.River;
            expect(river(0, -1) && river(0, 1), `grass ${x},${y}`).toBe(false);
            expect(river(-1, 0) && river(1, 0), `grass ${x},${y}`).toBe(false);
            expect(sprites.has(riverBankTileName(river))).toBe(true);
            const sand = (dx: number, dy: number) => map.get(x + dx, y + dy) === Tile.Sand;
            const near = (is: typeof sand) => [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => is(dx, dy)));
            expect(near(river) && near(sand), `grass ${x},${y} by river and beach`).toBe(false);
            expect(sand(0, -1) && sand(0, 1), `grass ${x},${y}`).toBe(false);
            expect(sand(-1, 0) && sand(1, 0), `grass ${x},${y}`).toBe(false);
            expect(sprites.has(grassTileName(sand))).toBe(true);
          }
        }
      }
    }
  });
});

describe('generateWorld: island 2, forest and mountains', () => {
  const sprites = buildSprites();
  const worlds = [1, 2, 3, 4].map((seed) => generateWorld(new Rng(seed), WORLD_WIDTH, WORLD_HEIGHT, 2));
  const kinds = (objects: Map<number, { kind: string }>) => [...objects.values()].map((o) => o.kind);

  it('has a beach, a northern forest, scree and snow, and no palms', () => {
    for (const { map, objects } of worlds) {
      const count = (t: Tile) => map.tiles.filter((x) => x === t).length;
      expect(count(Tile.Sand)).toBeGreaterThan(200);
      expect(count(Tile.Grass)).toBeGreaterThan(800);
      expect(count(Tile.Scree)).toBeGreaterThan(150);
      expect(count(Tile.Snow)).toBeGreaterThan(20);
      expect(count(Tile.Rock)).toBeGreaterThan(100);
      const k = kinds(objects);
      for (const kind of ['tree_spruce', 'tree_birch', 'tree_apple', 'fern', 'spring', 'chest_closed']) expect(k).toContain(kind);
      expect(k.some((kind) => kind.startsWith('palm'))).toBe(false);
    }
  });

  it('can reach every bit of ground, and keeps the brambles and the river', () => {
    for (const { map, start, objects } of worlds) {
      const passable = (x: number, y: number) => {
        const o = objects.get(map.idx(x, y));
        return map.isFloor(x, y) && (!o || canBeOpened(o.kind));
      };
      const reach = reachWithBridges(map, start.x, start.y, passable, (x, y) => map.get(x, y) === Tile.River);
      for (let i = 0; i < map.tiles.length; i++) {
        const x = i % map.width;
        if (passable(x, (i - x) / map.width)) expect(reach[i]).toBe(1);
      }
      expect(kinds(objects)).toContain('bramble');
      expect(map.tiles.includes(Tile.River)).toBe(true);
    }
  });

  it('puts the old stone ring on the highest snow you can walk up to', () => {
    for (const { map, start, objects } of worlds) {
      const sites = [...objects].filter(([, o]) => o.kind === 'beacon_site');
      expect(sites).toHaveLength(1);
      const [i] = sites[0];
      const x = i % map.width;
      const y = (i - x) / map.width;
      expect(map.get(x, y)).toBe(Tile.Snow);
      expect(kinds(objects).some((k) => k.startsWith('boat_'))).toBe(false);
      // One of its neighbours is ground you can get to.
      const passable = (cx: number, cy: number) => {
        const o = objects.get(map.idx(cx, cy));
        return map.isFloor(cx, cy) && (!o || canBeOpened(o.kind));
      };
      const reach = reachWithBridges(map, start.x, start.y, passable, (cx, cy) => map.get(cx, cy) === Tile.River);
      expect([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => reach[map.idx(x + dx, y + dy)])).toBe(true);
    }
  });

  it('rings the peak with rocky steps and then ice walls, so every way up needs a ladder and a climbing rope', () => {
    for (const { map, start, objects } of worlds) {
      const k = kinds(objects);
      expect(k).toContain('ledge');
      expect(k).toContain('ice_wall');
      const [site] = [...objects].find(([, o]) => o.kind === 'beacon_site')!;
      const sx = site % map.width;
      const near = (i: number) => [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => map.idx(sx + dx, (site - sx) / map.width + dy) === i));
      // With `open` steps passable (and every bridge built): can you get next to the beacon?
      const upTo = (open: (kind: string) => boolean) => {
        const passable = (x: number, y: number) => {
          const o = objects.get(map.idx(x, y));
          return map.isFloor(x, y) && (!o || o.kind === 'bramble' || open(o.kind) || !!OBJECTS[o.kind as ObjectKind].walkable);
        };
        const reach = reachWithBridges(map, start.x, start.y, passable, (x, y) => map.get(x, y) === Tile.River);
        return [...reach.keys()].some((i) => reach[i] && near(i));
      };
      expect(upTo(() => false)).toBe(false);
      expect(upTo((kind) => kind === 'ledge')).toBe(false);
      expect(upTo((kind) => kind === 'ice_wall')).toBe(false);
      expect(upTo((kind) => kind === 'ledge' || kind === 'ice_wall')).toBe(true);
    }
  });

  it('only makes mountain edges the transition tiles can draw', () => {
    for (const { map } of worlds) {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const t = map.get(x, y);
          const is = (k: Tile) => (dx: number, dy: number) => map.get(x + dx, y + dy) === k;
          const near = (k: Tile) => [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => is(k)(dx, dy)));
          if (map.isLand(x, y)) expect(sprites.has(shoreTileName((dx, dy) => map.isWet(x + dx, y + dy)))).toBe(true);
          if (t === Tile.Snow) {
            expect(near(Tile.Grass), `snow ${x},${y} by grass`).toBe(false);
            const scree = is(Tile.Scree);
            expect(scree(0, -1) && scree(0, 1)).toBe(false);
            expect(scree(-1, 0) && scree(1, 0)).toBe(false);
            expect(sprites.has(snowTileName(scree))).toBe(true);
          }
          if (t === Tile.Grass) {
            const scree = is(Tile.Scree);
            expect(scree(0, -1) && scree(0, 1)).toBe(false);
            expect(scree(-1, 0) && scree(1, 0)).toBe(false);
            expect(sprites.has(grassScreeTileName(scree))).toBe(true);
            expect(sprites.has(grassTileName(is(Tile.Sand)))).toBe(true);
          }
        }
      }
    }
  });
});

describe('generateWorld: island 3, the volcano', () => {
  const sprites = buildSprites();
  const worlds = [1, 2, 3, 4].map((seed) => generateWorld(new Rng(seed), WORLD_WIDTH, WORLD_HEIGHT, 3));
  const kinds = (objects: Map<number, { kind: string }>) => [...objects.values()].map((o) => o.kind);
  const cellsOf = (objects: Map<number, { kind: string }>, kind: string) => [...objects].filter(([, o]) => o.kind === kind).map(([i]) => i);

  it('has a beach, a jungle, ash, basalt cliffs and lava, and no snow or river', () => {
    for (const { map, objects } of worlds) {
      const count = (t: Tile) => map.tiles.filter((x) => x === t).length;
      expect(count(Tile.Sand)).toBeGreaterThan(200);
      expect(count(Tile.Grass)).toBeGreaterThan(800);
      expect(count(Tile.Ash)).toBeGreaterThan(150);
      expect(count(Tile.Rock)).toBeGreaterThan(50);
      expect(count(Tile.Lava)).toBeGreaterThan(40);
      expect(count(Tile.Snow) + count(Tile.Scree) + count(Tile.River)).toBe(0);
      const k = kinds(objects);
      for (const kind of ['tree_broadleaf', 'fern', 'spring', 'chest_closed', 'bramble']) expect(k).toContain(kind);
      expect(k.some((kind) => kind.startsWith('palm'))).toBe(true);
    }
  });

  it('can reach every bit of ground with stepping stones over the lava flow', () => {
    for (const { map, start, objects } of worlds) {
      const passable = (x: number, y: number) => {
        const o = objects.get(map.idx(x, y));
        return map.isFloor(x, y) && (!o || canBeOpened(o.kind));
      };
      const reach = reachWithBridges(map, start.x, start.y, passable, (x, y) => map.get(x, y) === Tile.Lava);
      for (let i = 0; i < map.tiles.length; i++) {
        const x = i % map.width;
        if (passable(x, (i - x) / map.width)) expect(reach[i], `cell ${x},${(i - x) / map.width}`).toBe(1);
      }
      // Without crossing the lava, the far side stays out of reach.
      const walk = reachWithBridges(map, start.x, start.y, passable, () => false);
      expect([...walk].filter(Boolean).length).toBeLessThan([...reach].filter(Boolean).length);
    }
  });

  it('puts the old balloon on the highest ash you can walk up to, next to the crater', () => {
    for (const { map, start, objects } of worlds) {
      const sites = cellsOf(objects, 'balloon_site');
      expect(sites).toHaveLength(1);
      const i = sites[0];
      const x = i % map.width;
      const y = (i - x) / map.width;
      expect(map.get(x, y)).toBe(Tile.Ash);
      expect(kinds(objects).some((k) => k.startsWith('boat_') || k.startsWith('beacon_') || k === 'ledge')).toBe(false);
      const passable = (cx: number, cy: number) => {
        const o = objects.get(map.idx(cx, cy));
        return map.isFloor(cx, cy) && (!o || canBeOpened(o.kind));
      };
      const reach = reachWithBridges(map, start.x, start.y, passable, (cx, cy) => map.get(cx, cy) === Tile.Lava);
      expect([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => reach[map.idx(x + dx, y + dy)])).toBe(true);
      // The crater lake of lava is close by.
      let lava = Infinity;
      for (let j = 0; j < map.tiles.length; j++) {
        if (map.tiles[j] === Tile.Lava) lava = Math.min(lava, Math.max(Math.abs((j % map.width) - x), Math.abs(Math.floor(j / map.width) - y)));
      }
      expect(lava).toBeLessThanOrEqual(6);
    }
  });

  it('has steam vents high on the ash, hot springs, and fewer springs', () => {
    for (const { map, objects, region } of worlds) {
      const vents = cellsOf(objects, 'steam_vent');
      expect(vents.length).toBeGreaterThanOrEqual(3);
      for (const i of vents) expect(map.tiles[i]).toBe(Tile.Ash);
      const hot = cellsOf(objects, 'hot_spring');
      expect(hot).toHaveLength(3);
      for (const i of hot) expect(map.tiles[i]).toBe(Tile.Ash);
      const springs = cellsOf(objects, 'spring');
      expect(springs).toHaveLength(4);
      expect(springs.filter((i) => region[i] === 0).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('only makes volcano edges the tiles can draw', () => {
    // Which neighbours each kind of ground draws an edge against (as in the renderer).
    const letter = (map: GameMap, own: Tile, x: number, y: number): string => {
      const t = map.get(x, y);
      if (own === Tile.Sand) return map.isWet(x, y) ? 'w' : t === Tile.Lava ? 'l' : t === Tile.Ash ? 'h' : '.';
      if (own === Tile.Grass) return t === Tile.Sand ? 'a' : t === Tile.Ash ? 'h' : t === Tile.Lava ? 'l' : '.';
      if (own === Tile.Lava) return t === Tile.Water ? 'w' : '.';
      return t === Tile.Lava ? 'l' : '.';
    };
    const ground = { [Tile.Sand]: 'sand', [Tile.Grass]: 'grass', [Tile.Ash]: 'ash', [Tile.CaveFloor]: 'cave', [Tile.Lava]: 'lava' } as const;
    for (const { map } of worlds) {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const t = map.get(x, y) as keyof typeof ground;
          if (!(t in ground)) continue;
          const at = (dx: number, dy: number) => letter(map, t, x + dx, y + dy);
          const name = edgeTileName(ground[t], 'plain', at);
          expect(name === 'plain' || sprites.has(name) || mixedTile(name) !== null, `${ground[t]} ${x},${y}: ${name}`).toBe(true);
          // One kind of edge can't be on two opposite sides of a cell.
          for (const k of ['w', 'l', 'h', 'a']) {
            expect(at(0, -1) === k && at(0, 1) === k, `${ground[t]} ${x},${y}`).toBe(false);
            expect(at(-1, 0) === k && at(1, 0) === k, `${ground[t]} ${x},${y}`).toBe(false);
          }
        }
      }
    }
  });
});

describe('Game: sailing to island 2', () => {
  function sailFrom(seed: number): Game {
    const game = boatNextTo(sandbox(seed));
    for (const stage of LEVELS[0].stages) {
      for (const [item, n] of Object.entries(stage.cost)) game.inventory.add(item as keyof typeof stage.cost, n);
      game.move(1, 0);
    }
    return game;
  }

  it('lands on the mountain island with your bag, XP, skills and needs', () => {
    const game = sailFrom(40);
    game.inventory.add('axe');
    game.xp = 30;
    game.learn('small_sips');
    game.needs.food = 55;
    const xp = game.xp;
    game.takeEvents();
    expect(game.sail()).toBe(true);
    expect(game.level).toBe(2);
    expect(game.sailed).toBe(false);
    expect(game.map.tiles.includes(Tile.Snow)).toBe(true);
    expect(game.inventory.count('axe')).toBe(1);
    expect(game.xp).toBe(xp);
    expect(game.has('small_sips')).toBe(true);
    expect(game.needs.food).toBe(55);
    expect(game.home).toEqual({ x: game.player.x, y: game.player.y });
    expect(game.map.get(game.player.x, game.player.y)).toBe(Tile.Sand);
    expect(game.turn % TURNS_PER_DAY).toBe(0);
    expect(game.goal()).toEqual({ state: 'find' });
    expect(game.takeEvents()).toContainEqual(expect.objectContaining({ type: 'fade' }));
    expect(game.log.slice(-2).map((e) => e.msg)).toEqual([{ key: 'sailAway', level: 1 }, { key: 'landIsland', level: 2 }]);
    // Island 2 animals only.
    const kinds = new Set(game.animals.map((a) => a.kind));
    for (const kind of kinds) expect(ANIMALS[kind].islands ?? [1]).toContain(2);
    expect(kinds.has('rabbit')).toBe(true);
    expect(kinds.has('monkey')).toBe(false);
  });

  it('keeps island 2 through a save', () => {
    const game = sailFrom(41);
    game.sail();
    const copy = Game.fromSave(JSON.parse(JSON.stringify(game.toSave())));
    expect(copy.level).toBe(2);
    expect([...copy.map.tiles]).toEqual([...game.map.tiles]);
    expect(copy.goal()).toEqual({ state: 'find' });
  });

  it('builds the beacon in three stages, and lighting it takes you to island 3', () => {
    const game = sailFrom(42);
    game.sail();
    const at = game.map.idx(game.player.x + 1, game.player.y);
    for (const [i, o] of game.objects) if (o.kind === 'beacon_site') game.objects.delete(i);
    game.map.set(game.player.x + 1, game.player.y, Tile.Sand);
    game.objects.set(at, { kind: 'beacon_site' });
    game.map.explored[at] = 1;
    const [base, pyre, tinder] = LEVELS[1].stages;
    expect(game.goal()).toMatchObject({ state: 'build', obj: 'beacon_site', index: 0, count: 3, left: base.cost });
    expect(game.move(1, 0)).toBe(false);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'goalNeeds', stage: 'base', left: [['stone', 16]] });
    for (const stage of [base, pyre, tinder]) {
      for (const [item, n] of Object.entries(stage.cost)) game.inventory.add(item as keyof typeof stage.cost, n);
      expect(game.move(1, 0)).toBe(true);
      expect(game.objects.get(at)?.kind).toBe(stage.becomes);
    }
    expect(game.goal()).toEqual({ state: 'ready' });
    game.move(1, 0);
    expect(game.takeSailRequest()).toBe(true);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'goalReady', level: 2 });
    expect(game.sail()).toBe(true);
    expect(game.level).toBe(3);
    expect(game.sailed).toBe(false);
    expect(game.goal()).toEqual({ state: 'find' });
    expect(game.map.tiles.includes(Tile.Lava)).toBe(true);
    expect(game.log.slice(-2).map((e) => e.msg)).toEqual([{ key: 'sailAway', level: 2 }, { key: 'landIsland', level: 3 }]);
    const kinds = new Set(game.animals.map((a) => a.kind));
    for (const kind of kinds) expect(ANIMALS[kind].islands ?? [1]).toContain(3);
    expect(kinds.has('gull') || kinds.has('lizard')).toBe(true);
    expect(kinds.has('bear')).toBe(false);
  });

  it('loads a save that lit the beacon when island 2 was the last, so the beacon takes it to island 3', () => {
    const game = sailFrom(46);
    game.sail();
    for (const [i, o] of game.objects) {
      if (o.kind !== 'beacon_site') continue;
      game.objects.set(i, { kind: 'beacon_ready' });
      game.map.explored[i] = 1;
    }
    const old = { ...game.toSave(), sailed: true };
    const copy = Game.fromSave(JSON.parse(JSON.stringify(old)));
    expect(copy.sailed).toBe(false);
    expect(copy.sail()).toBe(true);
    expect(copy.level).toBe(3);
  });

  it('gives apples from apple trees, and fern leaves', () => {
    const game = sandbox(43);
    place(game, 1, 0, 'tree_apple');
    game.move(1, 0);
    expect(game.inventory.count('apple')).toBeGreaterThanOrEqual(1);
    expect(game.objectSprite(game.objectAt(game.player.x + 1, game.player.y)!)).toBe('tree_apple_bare');
    const food = game.needs.food = 50;
    game.needs.water = 50;
    game.eat('apple');
    expect(game.needs.food).toBeCloseTo(food + 12 - 0.45, 5);
    place(game, 0, 1, 'fern');
    game.move(0, 1);
    expect(game.inventory.count('leaves')).toBeGreaterThanOrEqual(1);
  });

  it('is cold on the snow, even in the day, unless you are by a fire or in a hut', () => {
    const open = { sleeping: false, shelter: 0, nearFire: false, daylight: 1 };
    expect(warmthTarget(open)).toBe(100);
    expect(warmthTarget({ ...open, cold: 40 })).toBe(60);
    expect(warmthTarget({ ...open, cold: 40, daylight: 0 })).toBe(0);
    expect(warmthTarget({ ...open, cold: 40, shelter: 1, daylight: 0 })).toBe(100);
    expect(warmthTarget({ ...open, cold: 40, nearFire: true })).toBe(100);

    const game = sandbox(44);
    game.map.set(game.player.x + 1, game.player.y, Tile.Snow);
    game.needs.warmth = 100;
    expect(game.move(1, 0)).toBe(true);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'snowCold' });
    for (let i = 0; i < 20; i++) game.wait();
    expect(game.needs.warmth).toBeLessThan(90);
  });

  it('loads version 4 saves that already sailed, so the boat can take them to island 2', () => {
    const game = sailFrom(45);
    const v4 = { ...game.toSave(), v: 4, sailed: true };
    const copy = Game.fromSave(JSON.parse(JSON.stringify(v4)));
    expect(copy.sailed).toBe(false);
    expect(copy.goal()).toEqual({ state: 'ready' });
    expect(copy.sail()).toBe(true);
    expect(copy.level).toBe(2);
  });
});

describe('Game: island 3, the volcano', () => {
  /** A game on island 3 with a clear patch of sand round the explorer. */
  function volcano(seed: number): Game {
    const game = new Game(seed);
    (game as unknown as { landOn(level: number): void }).landOn(3);
    const { map } = game;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        map.set(game.player.x + dx, game.player.y + dy, Tile.Sand);
        game.objects.delete(map.idx(game.player.x + dx, game.player.y + dy));
      }
    }
    game.animals = [];
    game.dog = null;
    game.takeEvents();
    return game;
  }
  /** A lava flow `width` cells wide just east of the explorer, running north–south. */
  function lavaFlow(game: Game, width = 2): void {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = 1; dx <= width; dx++) game.map.set(game.player.x + dx, game.player.y + dy, Tile.Lava);
    }
  }

  it('lava is too hot to walk on, and no time passes', () => {
    const game = volcano(60);
    lavaFlow(game);
    const { turn, player: { x } } = game;
    expect(game.move(1, 0)).toBe(false);
    expect(game.turn).toBe(turn);
    expect(game.player.x).toBe(x);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'lavaHot' });
  });

  it('stepping stones cross the lava in front of you; a bridge does not, and stones do not cross a river', () => {
    const game = volcano(61);
    lavaFlow(game);
    game.inventory.add('stone', 8);
    game.inventory.add('log', 3);
    game.inventory.add('wood', 2);
    game.inventory.add('leaves', 3);
    game.player.facing = 'up';
    expect(game.buildProblem('lava_stones')).toEqual({ key: 'noLavaSpot' });
    game.player.facing = 'right';
    expect(game.buildProblem('bridge')).toEqual({ key: 'noBridgeSpot' });
    expect(game.build('lava_stones')).toBe(true);
    const { x, y } = game.player;
    expect(game.objectAt(x + 1, y)?.kind).toBe('lava_stones_ew');
    expect(game.objectAt(x + 2, y)?.kind).toBe('lava_stones_ew');
    expect(game.inventory.count('stone')).toBe(0);
    for (let i = 0; i < 3; i++) expect(game.move(1, 0)).toBe(true);
    expect(game.player.x).toBe(x + 3);

    const wet = sandbox(62);
    river(wet);
    wet.inventory.add('stone', 8);
    wet.player.facing = 'right';
    expect(wet.buildProblem('lava_stones')).toEqual({ key: 'noLavaSpot' });
  });

  it('the ash is hot by day: Water drops faster out in the open, but not at night or in a shelter', () => {
    const open = { sleeping: false, shelter: 0, nearFire: false, daylight: 1 };
    const drop = (c: Parameters<typeof tickNeeds>[1]) => 80 - tickNeeds({ ...freshNeeds(), water: 80 }, c).water;
    expect(drop({ ...open, heat: 0.5 })).toBeCloseTo(drop(open) * 1.5, 5);
    expect(drop({ ...open, heat: 0.5, shelter: 1 })).toBeCloseTo(drop(open), 5);

    const game = volcano(63);
    game.turn = 30; // 11:00, full daylight
    game.map.set(game.player.x + 1, game.player.y, Tile.Ash);
    expect(game.move(1, 0)).toBe(true);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'ashHot' });
    game.needs.water = 80;
    game.wait();
    expect(80 - game.needs.water).toBeCloseTo(0.45 * 1.5, 5);
    game.move(-1, 0);
    game.needs.water = 80;
    game.wait();
    expect(80 - game.needs.water).toBeCloseTo(0.45, 5);
  });

  it('a hot spring gives water and warms you like a small fire', () => {
    const game = volcano(64);
    place(game, 1, 0, 'hot_spring');
    game.needs.water = 40;
    expect(game.move(1, 0)).toBe(true);
    expect(game.needs.water).toBeGreaterThan(70);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'drink', warm: true });
    expect(game.nearFire(game.player.x, game.player.y)).toBe(true);
    expect(game.nearFire(game.player.x - 1, game.player.y)).toBe(false);
  });

  it('steam vents give sulphur and grow it back; the burner needs it', () => {
    const game = volcano(65);
    place(game, 1, 0, 'steam_vent');
    expect(game.move(1, 0)).toBe(true);
    const got = game.inventory.count('sulphur');
    expect(got).toBeGreaterThanOrEqual(1);
    expect(got).toBeLessThanOrEqual(2);
    expect(game.objectSprite(game.objectAt(game.player.x + 1, game.player.y)!)).toBe('steam_vent_spent');
    const burner = LEVELS[2].stages[2];
    expect(game.stageCost(burner)).toEqual(burner.cost);
    expect(burner.cost.sulphur).toBe(4);
  });

  it('builds the balloon in three stages, and flying away lands on the oil rig', () => {
    const game = volcano(66);
    const at = game.map.idx(game.player.x + 1, game.player.y);
    for (const [i, o] of game.objects) if (o.kind === 'balloon_site') game.objects.delete(i);
    game.objects.set(at, { kind: 'balloon_site' });
    game.map.explored[at] = 1;
    const [basket, envelope, burner] = LEVELS[2].stages;
    expect(game.goal()).toMatchObject({ state: 'build', obj: 'balloon_site', index: 0, count: 3 });
    for (const stage of [basket, envelope, burner]) {
      for (const [item, n] of Object.entries(stage.cost)) game.inventory.add(item as keyof typeof stage.cost, n);
      expect(game.move(1, 0)).toBe(true);
      expect(game.objects.get(at)?.kind).toBe(stage.becomes);
    }
    expect(game.goal()).toEqual({ state: 'ready' });
    game.move(1, 0);
    expect(game.takeSailRequest()).toBe(true);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'goalReady', level: 3 });
    expect(game.sail()).toBe(true);
    expect(game.level).toBe(4);
    expect(game.sailed).toBe(false);
    expect(game.map.get(game.player.x, game.player.y)).toBe(Tile.Deck);
    expect(game.log.slice(-2).map((e) => e.msg)).toEqual([{ key: 'sailAway', level: 3 }, { key: 'landIsland', level: 4 }]);
    expect(OBJECTS.balloon_ready.done?.frames).toEqual(['balloon_gone']);
  });

  it('lava glows in the dark', () => {
    const game = volcano(67);
    lavaFlow(game);
    const lit = game.lights().filter(([x, y]) => game.map.get(x, y) === Tile.Lava);
    expect(lit.length).toBeGreaterThanOrEqual(14);
    expect(lit.every(([, , r]) => r === 1)).toBe(true);
  });

  it('keeps island 3 through a save', () => {
    const game = volcano(68);
    const copy = Game.fromSave(JSON.parse(JSON.stringify(game.toSave())));
    expect(copy.level).toBe(3);
    expect([...copy.map.tiles]).toEqual([...game.map.tiles]);
    expect(copy.sailed).toBe(false);
  });
});

describe('Game: the dog', () => {
  /** A sandbox with your dog just west of the explorer. */
  function withDog(seed: number) {
    const game = sandbox(seed);
    game.dog = { id: 500, x: game.player.x - 1, y: game.player.y, facing: 'down', food: 80, water: 80, tired: false };
    return game;
  }
  const near = (game: Game) => Math.max(Math.abs(game.dog!.x - game.player.x), Math.abs(game.dog!.y - game.player.y));

  it('puts one stray dog on each island, far from camp', () => {
    for (const seed of [1, 2, 3]) {
      const game = new Game(seed);
      const strays = game.animals.filter((a) => a.kind === 'dog');
      expect(strays).toHaveLength(1);
      expect(Math.max(Math.abs(strays[0].x - game.home.x), Math.abs(strays[0].y - game.home.y))).toBeGreaterThanOrEqual(25);
    }
  });

  it('adopts the stray dog for a snack, raw fish first', () => {
    const game = sandbox(50);
    game.inventory.take('coconut', 2);
    const stray = { id: 77, kind: 'dog' as const, x: game.player.x + 1, y: game.player.y, facing: 'down' as const, flee: 0 };
    game.animals = [stray];
    expect(game.move(1, 0)).toBe(false);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'dogSniff' });
    expect(game.dog).toBeNull();

    game.inventory.add('apple', 2);
    game.inventory.add('fish', 1);
    expect(game.move(1, 0)).toBe(true);
    expect(game.inventory.count('fish')).toBe(0);
    expect(game.inventory.count('apple')).toBe(2);
    expect(game.dog).toMatchObject({ id: 77, tired: false });
    expect(game.animals.some((a) => a.kind === 'dog')).toBe(false);
    expect(game.log.some((e) => e.msg.key === 'dogAdopt' && e.msg.item === 'fish')).toBe(true);
    // No new stray once you have a dog.
    for (let i = 0; i < 60; i++) game.wait();
    expect(game.animals.some((a) => a.kind === 'dog')).toBe(false);
  });

  it('follows you, and swaps places when you walk into it', () => {
    const game = withDog(51);
    for (let i = 0; i < 3; i++) {
      game.move(1, 0);
      expect(near(game)).toBeLessThanOrEqual(1);
    }
    expect(game.dog!.facing).toBe('right');
    // The walk took the explorer to the edge of the cleared sand: clear the way back to the dog.
    for (let dx = 1; dx <= 3; dx++) {
      game.map.set(game.player.x + dx, game.player.y, Tile.Sand);
      game.objects.delete(game.map.idx(game.player.x + dx, game.player.y));
    }
    game.dog!.x = game.player.x + 3;
    game.dog!.y = game.player.y;
    game.wait();
    expect(game.dog!.facing).toBe('left');
    // Straight up or down, it keeps looking the same way.
    game.dog!.x = game.player.x;
    game.dog!.y = game.player.y + 3;
    game.wait();
    expect(game.dog!.facing).toBe('left');
    const dog = { x: game.dog!.x, y: game.dog!.y };
    const from = { x: game.player.x, y: game.player.y };
    expect(game.move(dog.x - from.x, dog.y - from.y)).toBe(true);
    expect(game.player).toMatchObject(dog);
    expect(near(game)).toBeLessThanOrEqual(1);
  });

  it('lies down next to you while you sleep and gets up on your next turn', () => {
    const game = withDog(54);
    game.dog!.x = game.player.x + 3;
    game.needs.energy = 40;
    game.sleep();
    expect(near(game)).toBe(1);
    expect(game.dog!.napping).toBe(true);
    game.wait();
    expect(game.dog!.napping).toBe(false);
  });

  it('barks small nuisance animals away, but not the big wild ones', () => {
    const game = withDog(52);
    const monkey = { id: 90, kind: 'monkey' as const, x: game.player.x + 2, y: game.player.y, facing: 'down' as const, flee: 0 };
    const boar = { id: 91, kind: 'boar' as const, x: game.player.x, y: game.player.y + 3, facing: 'down' as const, flee: 0 };
    game.animals = [monkey, boar];
    game.inventory.add('apple', 1);
    game.wait();
    expect(monkey.flee).toBeGreaterThan(0);
    expect(boar.flee).toBe(0);
    expect(game.log.some((e) => e.msg.key === 'dogBark' && e.msg.animal === 'monkey')).toBe(true);
    expect(game.inventory.count('apple')).toBe(1);
  });

  it('gets hungry and thirsty; you feed it from the bag when it is close', () => {
    const game = withDog(53);
    game.wait();
    expect(game.dog!.food).toBeCloseTo(80 - 0.3, 5);
    expect(game.dog!.water).toBeCloseTo(80 - 0.35, 5);
    game.dog!.food = 99;
    game.inventory.add('apple', 2);
    expect(game.feedDog('apple')).toBe(false);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'dogFull' });
    game.dog!.food = 50;
    expect(game.feedDog('apple')).toBe(true);
    expect(game.dog!.food).toBeCloseTo(62 - 0.3, 5);
    game.dog!.x = game.player.x - 3;
    expect(game.feedDog('apple')).toBe(false);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'dogFar' });
    expect(game.feedDog('wood')).toBe(false);
  });

  it('drinks with you, and by itself next to fresh water', () => {
    const game = withDog(54);
    game.dog!.water = 20;
    game.needs.water = 40;
    place(game, 1, 0, 'spring');
    game.move(1, 0);
    expect(game.dog!.water).toBeGreaterThan(60);
    game.dog!.water = 20;
    game.needs.water = 100;
    game.dog!.x = game.player.x + 1;
    game.dog!.y = game.player.y + 1;
    game.wait();
    expect(game.dog!.water).toBeGreaterThan(60);
  });

  it('gets tired when Food or Water runs out: no barking, until it is fed', () => {
    const game = withDog(55);
    game.dog!.food = 0.1;
    game.wait();
    expect(game.dog!.tired).toBe(true);
    expect(game.log.some((e) => e.msg.key === 'dogTired')).toBe(true);
    const crab = { id: 92, kind: 'crab' as const, x: game.player.x + 2, y: game.player.y, facing: 'down' as const, flee: 0 };
    game.animals = [crab];
    game.wait();
    expect(game.log.some((e) => e.msg.key === 'dogBark')).toBe(false);
    game.dog!.x = game.player.x - 1;
    game.dog!.y = game.player.y;
    game.inventory.add('berries', 1);
    expect(game.feedDog('berries')).toBe(true);
    expect(game.dog!.tired).toBe(false);
    expect(game.log.some((e) => e.msg.key === 'dogBack')).toBe(true);
  });

  it('comes along after fainting, to the next island, and through a save', () => {
    const game = withDog(56);
    game.needs.health = 0.5;
    game.needs.food = 0;
    game.wait();
    expect(near(game)).toBeLessThanOrEqual(1);
    const copy = Game.fromSave(JSON.parse(JSON.stringify(game.toSave())));
    expect(copy.dog).toEqual(game.dog);

    for (const [i, o] of game.objects) if (o.kind.startsWith('boat_')) game.objects.set(i, { kind: 'boat_ready' });
    game.map.explored.fill(1);
    game.sail();
    expect(game.level).toBe(2);
    expect(near(game)).toBeLessThanOrEqual(1);
    expect(game.animals.some((a) => a.kind === 'dog')).toBe(false);
  });

  it('loads version 5 saves without a dog', () => {
    const { dog: _dog, ...v5 } = { ...new Game(57).toSave(), v: 5 };
    const game = Game.fromSave(JSON.parse(JSON.stringify(v5)));
    expect(game.dog).toBeNull();
    expect(game.toSave().v).toBe(SAVE_VERSION);
  });
});

describe("Game: the Cartographer's map", () => {
  /** A cave strip east of the explorer, open to see along. */
  function caveRow(game: Game, cells: number): void {
    for (let dx = 1; dx <= cells; dx++) {
      const i = game.map.idx(game.player.x + dx, game.player.y);
      game.map.tiles[i] = Tile.CaveFloor;
      game.objects.delete(i);
    }
  }

  it('comes after rope maker on the Building path and costs 2 points', () => {
    expect(SKILLS.cartographer).toMatchObject({ path: 'build', cost: 2 });
    const game = sandbox(70);
    game.xp = xpForPoints(10);
    expect(game.skillProblem('cartographer')).toEqual({ key: 'needSkill', skill: 'rope_maker' });
  });

  it('can only be read in a hut, once learned', () => {
    const game = sandbox(71);
    place(game, 1, 0, 'hut');
    place(game, -1, 0, 'lean_to');
    expect(game.canReadMap()).toBe(false);
    game.move(1, 0);
    expect(game.canReadMap()).toBe(false);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'enterHut' });
    game.skills.add('cartographer');
    expect(game.canReadMap()).toBe(true);
    game.move(-1, 0);
    expect(game.canReadMap()).toBe(false);
    game.move(-1, 0);
    expect(game.canReadMap()).toBe(false);
    game.move(1, 0);
    game.move(1, 0);
    expect(game.canReadMap()).toBe(true);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'enterHut' });
  });

  it('remembers where you saw cave bears, one place for each bear area', () => {
    const game = sandbox(72);
    caveRow(game, 8);
    game.animals = [{ id: 99, kind: 'bear', x: game.player.x + 3, y: game.player.y, facing: 'down', flee: 0 }];
    expect(game.bearSpots).toEqual([]);
    game.wait();
    expect(game.bearSpots).toHaveLength(1);
    // The same bear a few steps on is still the same bear area.
    game.animals[0].x = game.player.x + 5;
    game.wait();
    expect(game.bearSpots).toHaveLength(1);
    // A bear out of sight is not on the map.
    game.animals.push({ id: 100, kind: 'bear', x: game.player.x - 30, y: game.player.y, facing: 'down', flee: 0 });
    game.wait();
    expect(game.bearSpots).toHaveLength(1);
  });

  it('keeps the bear places in the save, and forgets them on a new island', () => {
    const game = boatNextTo(sandbox(73));
    game.bearSpots = [game.map.idx(10, 10)];
    expect(Game.fromSave(JSON.parse(JSON.stringify(game.toSave()))).bearSpots).toEqual(game.bearSpots);
    for (const [i, o] of game.objects) if (o.kind.startsWith('boat_')) game.objects.set(i, { kind: 'boat_ready' });
    expect(game.sail()).toBe(true);
    expect(game.level).toBe(2);
    // Only bears seen on the new island can be on its map.
    expect(game.bearSpots.every((i) => game.animals.some((a) => a.kind === 'bear' && game.map.idx(a.x, a.y) === i))).toBe(true);
  });

  it('loads version 6 saves with no bear places', () => {
    const { bearSpots: _b, ...v6 } = { ...new Game(74).toSave(), v: 6 };
    const game = Game.fromSave(JSON.parse(JSON.stringify(v6)));
    expect(game.bearSpots).toEqual([]);
    expect(game.toSave().v).toBe(SAVE_VERSION);
  });
});

describe('clock', () => {
  it('starts in the morning and cycles through night', () => {
    expect(phase(0)).toBe('day');
    expect(daylight(0)).toBe(1);
    const night = Array.from({ length: TURNS_PER_DAY }, (_, t) => t).find((t) => isNight(t))!;
    expect(daylight(night)).toBe(0);
    expect(phase(night + turnsUntilMorning(night))).toBe('dawn');
  });
});

describe('needs', () => {
  const open = { sleeping: false, shelter: 0, nearFire: false, daylight: 1 };

  it('food and water run down over time', () => {
    const n = freshNeeds();
    for (let i = 0; i < 10; i++) tickNeeds(n, open);
    expect(n.food).toBeLessThan(80);
    expect(n.water).toBeLessThan(80);
  });

  it('an empty need drains health, but slowly', () => {
    const n = { ...freshNeeds(), water: 0 };
    tickNeeds(n, open);
    expect(n.health).toBeLessThan(100);
    expect(n.health).toBeGreaterThan(95);
  });

  it('nights are cold in the open, milder in shelter, cosy by a fire', () => {
    const night = { ...open, daylight: 0 };
    expect(warmthTarget(night)).toBeLessThan(30);
    expect(warmthTarget({ ...night, shelter: 0.6 })).toBeGreaterThan(warmthTarget(night));
    expect(warmthTarget({ ...night, shelter: 1 })).toBe(100);
    expect(warmthTarget({ ...night, nearFire: true })).toBe(100);
  });
});

describe('Game: gathering and eating', () => {
  it('shaking a palm gives coconuts and leaves, then it needs time to regrow', () => {
    const game = sandbox(1);
    place(game, 1, 0, 'palm_tall');
    expect(game.move(1, 0)).toBe(true);
    expect(game.inventory.count('coconut')).toBeGreaterThan(2);
    expect(game.inventory.count('leaves')).toBeGreaterThan(0);
    expect(game.objectSprite(game.objectAt(game.player.x + 1, game.player.y)!)).toBe('palm_tall_bare');
    expect(game.move(1, 0)).toBe(false);
    game.turn += 200;
    expect(game.move(1, 0)).toBe(false);
    game.turn += 40;
    expect(game.move(1, 0)).toBe(true);
  });

  it('logs and pebbles are used up', () => {
    const game = sandbox(2);
    place(game, 1, 0, 'log');
    game.move(1, 0);
    expect(game.inventory.count('wood')).toBeGreaterThanOrEqual(2);
    expect(game.objectAt(game.player.x + 1, game.player.y)).toBeUndefined();
  });

  it('chests open once', () => {
    const game = sandbox(3);
    place(game, 1, 0, 'chest_closed');
    game.move(1, 0);
    expect(game.objectAt(game.player.x + 1, game.player.y)?.kind).toBe('chest_open');
    expect(game.inventory.count('wood')).toBeGreaterThan(0);
  });

  it('springs quench thirst; the sea does not', () => {
    const game = sandbox(4);
    game.needs.water = 20;
    place(game, 1, 0, 'spring');
    game.move(1, 0);
    expect(game.needs.water).toBeGreaterThan(50);
    game.map.set(game.player.x - 1, game.player.y, Tile.Water);
    expect(game.move(-1, 0)).toBe(false);
  });

  it('eating a coconut fills food and water', () => {
    const game = sandbox(5);
    game.needs.food = 30;
    game.needs.water = 30;
    expect(game.eat('coconut')).toBe(true);
    expect(game.needs.food).toBeGreaterThan(38);
    expect(game.needs.water).toBeGreaterThan(45);
    expect(game.inventory.count('coconut')).toBe(1);
    expect(game.eat('wood')).toBe(false);
  });
});

describe('Game: building and sleeping', () => {
  it('builds a campfire from wood and stone in front of the explorer', () => {
    const game = sandbox(6);
    expect(game.buildProblem('campfire')).toEqual({ key: 'needMaterials' });
    expect(game.build('campfire')).toBe(false);
    game.inventory.add('wood', 3);
    game.inventory.add('stone', 2);
    game.player.facing = 'right';
    expect(game.build('campfire')).toBe(true);
    expect(game.objectAt(game.player.x + 1, game.player.y)?.kind).toBe('campfire');
    expect(game.inventory.count('wood')).toBe(0);
    expect(game.nearFire(game.player.x, game.player.y)).toBe(true);
  });

  it('sleeping in a hut restores energy, keeps you warm and makes it home', () => {
    const game = sandbox(7);
    give(game, RECIPES.hut.siteCost!);
    game.player.facing = 'right';
    game.build('hut');
    // Hand the frame everything at once (it ignores the carry limit), then step inside.
    game.move(1, 0);
    game.move(1, 0);
    expect(game.shelterAt(game.player.x, game.player.y)).toBe(1);
    game.turn = nightTurn();
    game.needs.energy = 20;
    game.needs.food = game.needs.water = 100;
    expect(game.sleep()).toBe(true);
    expect(game.needs.energy).toBeGreaterThanOrEqual(99);
    expect(game.needs.warmth).toBeGreaterThan(80);
    expect(game.home).toEqual({ x: game.player.x, y: game.player.y });
  });

  it('sleeping out in the open at night gets too cold', () => {
    const game = sandbox(8);
    game.turn = nightTurn();
    game.needs.energy = 20;
    game.needs.warmth = 40;
    game.sleep();
    expect(game.needs.energy).toBeLessThan(100);
    expect(game.log.at(-1)?.msg).toMatchObject({ key: 'wake', reason: 'cold' });
  });
});

describe('Game: the island goal (the boat)', () => {
  const [hull, mast, sail, supplies] = LEVELS[0].stages;

  it('twists rope from leaves', () => {
    const game = sandbox(30);
    game.inventory.add('leaves', 2);
    expect(game.build('rope')).toBe(true);
    expect(game.inventory.count('rope')).toBe(1);
    expect(game.inventory.count('leaves')).toBe(0);
  });

  it('asks you to find the boat first, and says so when you see it', () => {
    const game = sandbox(31);
    expect(game.goal()).toEqual({ state: 'find' });
    boatNextTo(game);
    game.map.explored[game.map.idx(game.player.x + 1, game.player.y)] = 0;
    game.wait();
    expect(game.log.at(-1)?.msg).toEqual({ key: 'goalFound', obj: 'boat_wreck' });
    expect(game.goal()).toMatchObject({ state: 'build', obj: 'boat_wreck', index: 0, count: 4, left: hull.cost });
  });

  it('takes what it needs from the bag in as many trips as you like', () => {
    const game = boatNextTo(sandbox(32));
    expect(game.move(1, 0)).toBe(false);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'goalNeeds', stage: 'hull', left: [['log', 12], ['wood', 6], ['stone', 6], ['tar', 4]] });

    game.inventory.add('log', 8);
    game.inventory.add('coconut', 3);
    const xp = game.xp;
    game.takeEvents();
    expect(game.move(1, 0)).toBe(true);
    expect(game.inventory.count('log')).toBe(0);
    expect(game.inventory.count('coconut')).toBe(3 + 2);
    expect(game.goalGiven).toEqual({ log: 8 });
    expect(game.xp).toBe(xp + 8);
    expect(game.takeEvents()).toContainEqual(expect.objectContaining({ type: 'float', amount: -8, what: { item: 'log' } }));
    expect(game.log.at(-1)?.msg).toEqual({ key: 'goalGive', stage: 'hull', given: [['log', 8]], left: [['log', 4], ['wood', 6], ['stone', 6], ['tar', 4]] });

    game.inventory.add('log', 30);
    game.inventory.add('wood', 6);
    game.inventory.add('stone', 6);
    game.inventory.add('tar', 4);
    game.move(1, 0);
    expect(game.objectAt(game.player.x + 1, game.player.y)?.kind).toBe('boat_hull');
    expect(game.inventory.count('log')).toBe(26);
    expect(game.goalGiven).toEqual({});
    expect(game.log.at(-1)?.msg).toEqual({ key: 'goalStage', stage: 'hull' });
    expect(game.goal()).toMatchObject({ state: 'build', obj: 'boat_hull', index: 1, stage: mast });
  });

  it('is ready after four stages, then asks to sail, and you can sail to the next island', () => {
    const game = boatNextTo(sandbox(33));
    for (const stage of [hull, mast, sail, supplies]) {
      for (const [item, n] of Object.entries(stage.cost)) game.inventory.add(item as keyof typeof stage.cost, n);
      expect(game.move(1, 0)).toBe(true);
    }
    expect(game.objectAt(game.player.x + 1, game.player.y)?.kind).toBe('boat_ready');
    expect(game.goal()).toEqual({ state: 'ready' });
    expect(game.takeSailRequest()).toBe(false);
    expect(game.move(1, 0)).toBe(false);
    expect(game.takeSailRequest()).toBe(true);
    expect(game.takeSailRequest()).toBe(false);
    expect(game.sail()).toBe(true);
    expect(game.level).toBe(2);
    expect(game.log.at(-2)?.msg).toEqual({ key: 'sailAway', level: 1 });
  });

  it('cannot sail before the boat is ready', () => {
    const game = boatNextTo(sandbox(34));
    expect(game.sail()).toBe(false);
    expect(game.sailed).toBe(false);
  });

  it('keeps the goal through a save', () => {
    const game = boatNextTo(sandbox(35));
    game.inventory.add('wood', 5);
    game.move(1, 0);
    const copy = Game.fromSave(JSON.parse(JSON.stringify(game.toSave())));
    expect(copy.goalGiven).toEqual({ wood: 5 });
    expect(copy.goal()).toMatchObject({ state: 'build', left: { log: 12, wood: 1, stone: 6 } });
  });
});

describe('Game: brambles, the axe and the river', () => {
  it('brambles need a stone axe; the axe clears them for good', () => {
    const game = sandbox(15);
    place(game, 1, 0, 'bramble');
    expect(game.move(1, 0)).toBe(false);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'needTool', obj: 'bramble', item: 'axe' });

    expect(game.buildProblem('axe')).toEqual({ key: 'needMaterials' });
    game.inventory.add('wood', 2);
    game.inventory.add('stone', 2);
    game.inventory.add('leaves', 1);
    expect(game.build('axe')).toBe(true);
    expect(game.inventory.count('axe')).toBe(1);
    expect(game.inventory.count('wood')).toBe(0);
    expect(game.buildProblem('axe')).toEqual({ key: 'haveTool', item: 'axe' });

    expect(game.move(1, 0)).toBe(true);
    expect(game.objectAt(game.player.x + 1, game.player.y)).toBeUndefined();
    expect(game.inventory.count('wood')).toBe(1);
    expect(game.inventory.count('leaves')).toBe(1);
    expect(game.inventory.count('axe')).toBe(1);
    game.turn += 10_000;
    expect(game.objectAt(game.player.x + 1, game.player.y)).toBeUndefined();
  });

  it('by hand a tree gives one piece of wood and a hint about the axe', () => {
    const game = sandbox(16);
    place(game, 1, 0, 'tree_pine');
    expect(game.move(1, 0)).toBe(true);
    expect(game.inventory.count('wood')).toBe(1);
    expect(game.inventory.count('log')).toBe(0);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'gather', obj: 'tree_pine', got: [['wood', 1]], lack: { tool: 'axe', item: 'log' } });
  });

  it('with the axe, every tree gives logs and more wood', () => {
    for (const kind of ['tree_broadleaf', 'tree_pine', 'tree_spruce', 'tree_spruce_snow', 'tree_birch'] as const) {
      const game = sandbox(160);
      place(game, 1, 0, kind);
      game.inventory.add('axe');
      for (let i = 0; i < 8; i++) {
        game.inventory.take('log', game.inventory.count('log'));
        game.inventory.take('wood', game.inventory.count('wood'));
        game.turn += 100;
        game.move(1, 0);
        expect(game.inventory.count('log')).toBeGreaterThanOrEqual(1);
        expect(game.inventory.count('log')).toBeLessThanOrEqual(2);
        expect(game.inventory.count('wood')).toBeGreaterThanOrEqual(1);
        expect(game.inventory.count('wood')).toBeLessThanOrEqual(2);
        const msg = game.log.filter((l) => l.msg.key === 'gather').at(-1)?.msg;
        expect(msg).toMatchObject({ key: 'gather', obj: kind, used: 'axe' });
        expect(msg).not.toHaveProperty('lack');
      }
    }
  });

  it('logs on the ground give wood, not logs, also with the axe', () => {
    const game = sandbox(19);
    place(game, 1, 0, 'log_pile');
    game.inventory.add('axe');
    game.move(1, 0);
    expect(game.inventory.count('wood')).toBeGreaterThanOrEqual(3);
    expect(game.inventory.count('log')).toBe(0);
    expect(game.log.at(-1)?.msg).not.toHaveProperty('lack');
  });

  it('the hut and the bridge need logs; the lean-to and the axe do not', () => {
    const game = sandbox(20);
    game.inventory.add('wood', 20);
    game.inventory.add('leaves', 20);
    game.inventory.add('stone', 20);
    expect(game.siteCost('hut').log).toBe(24);
    expect(game.buildProblem('bridge')).toEqual({ key: 'needMaterials' });
    expect(game.build('axe')).toBe(true);
    game.player.facing = 'right';
    expect(game.build('lean_to')).toBe(true);
  });

  it('you can drink from the river, but not walk into it', () => {
    const game = sandbox(17);
    river(game);
    game.needs.water = 20;
    const { x } = game.player;
    expect(game.move(1, 0)).toBe(true);
    expect(game.player.x).toBe(x);
    expect(game.needs.water).toBeGreaterThan(54);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'drinkRiver' });
    game.needs.water = 100;
    expect(game.move(1, 0)).toBe(false);
  });

  it('a bridge spans the river in front of you and can be walked over', () => {
    const game = sandbox(18);
    river(game);
    game.inventory.add('log', 6);
    game.inventory.add('wood', 4);
    game.inventory.add('leaves', 6);
    game.player.facing = 'up';
    expect(game.buildProblem('bridge')).toEqual({ key: 'noBridgeSpot' });
    game.player.facing = 'right';
    expect(game.build('bridge')).toBe(true);
    const { x, y } = game.player;
    expect(game.objectAt(x + 1, y)?.kind).toBe('bridge_ew');
    expect(game.objectAt(x + 2, y)?.kind).toBe('bridge_ew');
    expect(game.inventory.count('log')).toBe(3);
    expect(game.inventory.count('wood')).toBe(2);
    for (let i = 0; i < 3; i++) expect(game.move(1, 0)).toBe(true);
    expect(game.player.x).toBe(x + 3);
  });

  it('a river too wide for one bridge cannot be bridged', () => {
    const game = sandbox(19);
    river(game, 4);
    game.inventory.add('log', 3);
    game.inventory.add('wood', 2);
    game.inventory.add('leaves', 3);
    game.player.facing = 'right';
    expect(game.buildProblem('bridge')).toEqual({ key: 'noBridgeSpot' });
    expect(game.build('bridge')).toBe(false);
    expect(game.inventory.count('log')).toBe(3);
  });

  it('island 1 has no steep steps', () => {
    for (const seed of [1, 2]) {
      const { objects } = generateWorld(new Rng(seed));
      expect([...objects.values()].some((o) => OBJECTS[o.kind].steep)).toBe(false);
    }
  });

  it('brambles and rivers do not stop you building a campfire', () => {
    const game = new Game(20);
    game.inventory.add('wood', 3);
    game.inventory.add('stone', 2);
    expect(game.build('campfire')).toBe(true);
  });
});

describe('Game: steep steps, the ladder and the climbing rope', () => {
  it('a rocky step blocks the way and tells you to build a ladder', () => {
    const game = sandbox(60);
    place(game, 1, 0, 'ledge');
    const { x } = game.player;
    expect(game.move(1, 0)).toBe(false);
    expect(game.player.x).toBe(x);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'tooSteep', obj: 'ledge', way: 'ledge_ladder' });
    place(game, 1, 0, 'ice_wall');
    expect(game.move(1, 0)).toBe(false);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'tooSteep', obj: 'ice_wall', way: 'ice_wall_rope' });
  });

  it('a ladder goes on the rocky step next to you, and climbing it costs Energy', () => {
    const game = sandbox(61);
    game.inventory.add('wood', 4);
    game.inventory.add('rope', 2);
    expect(game.buildProblem('ladder')).toEqual({ key: 'noStep', obj: 'ledge' });
    place(game, 0, 1, 'ledge');
    game.player.facing = 'right';
    const xp = game.xp;
    expect(game.build('ladder')).toBe(true);
    const { x, y } = game.player;
    expect(game.objectAt(x, y + 1)?.kind).toBe('ledge_ladder');
    expect(game.inventory.count('wood')).toBe(0);
    expect(game.inventory.count('rope')).toBe(0);
    expect(game.xp - xp).toBe(6);
    game.needs.energy = 50;
    expect(game.move(0, 1)).toBe(true);
    expect(game.player.y).toBe(y + 1);
    expect(game.needs.energy).toBeLessThan(48.01);
    expect(game.needs.energy).toBeGreaterThan(47);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'climb', obj: 'ledge_ladder' });
    // Stepping off the ladder is a normal step.
    game.needs.energy = 50;
    expect(game.move(0, 1)).toBe(true);
    expect(game.needs.energy).toBeGreaterThan(49);
  });

  it('sure-footed explorers climb without losing Energy', () => {
    const game = sandbox(65);
    game.skills.add('sure_foot');
    place(game, 1, 0, 'ledge_ladder');
    game.needs.energy = 50;
    game.takeEvents();
    expect(game.move(1, 0)).toBe(true);
    expect(game.needs.energy).toBeGreaterThan(49);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'climb', obj: 'ledge_ladder', easy: true });
    expect(game.takeEvents().some((e) => e.type === 'float')).toBe(false);
  });

  it('a ladder does not fit an ice wall: that needs a climbing rope', () => {
    const game = sandbox(62);
    game.inventory.add('wood', 5);
    game.inventory.add('rope', 6);
    place(game, 1, 0, 'ice_wall');
    expect(game.build('ladder')).toBe(false);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'noStep', obj: 'ledge' });
    expect(game.build('climbing_rope')).toBe(true);
    expect(game.objectAt(game.player.x + 1, game.player.y)?.kind).toBe('ice_wall_rope');
    expect(game.inventory.count('rope')).toBe(2);
    expect(game.move(1, 0)).toBe(true);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'climb', obj: 'ice_wall_rope' });
  });

  it('the mountain goat jumps over rocky steps without a ladder', () => {
    const game = sandbox(63);
    const { x, y } = game.player;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) game.map.set(x + dx, y + dy, Tile.Scree);
    for (let dy = -3; dy <= 3; dy++) place(game, 2, dy, 'ledge');
    const goat = { id: 99, kind: 'goat' as const, x: x + 3, y, facing: 'left' as const, flee: 0 };
    game.animals = [goat];
    game.wait();
    expect(goat.x).toBeLessThan(x + 3);
  });

  it('steps still count as a way through when you build a campfire', () => {
    const game = sandbox(64);
    const { x, y } = game.player;
    // A wall of ledges with one gap; a fire in the gap would not cut the island off.
    for (let dy = -3; dy <= 3; dy++) if (dy !== 0) place(game, 2, dy, 'ledge');
    game.inventory.add('wood', 3);
    game.inventory.add('stone', 2);
    game.player.facing = 'right';
    expect(game.build('campfire')).toBe(true);
    expect(game.objectAt(x + 1, y)?.kind).toBe('campfire');
  });
});

describe('Game: no harsh endings', () => {
  it('running out of everything makes you faint and wake up at home', () => {
    const game = sandbox(9);
    const home = { ...game.home };
    game.player.x += 1;
    game.needs = { health: 0.5, food: 0, water: 0, energy: 0, warmth: 0 };
    game.wait();
    expect(game.player).toMatchObject(home);
    expect(game.needs.health).toBe(50);
    expect(game.needs.food).toBe(25);
    expect(game.needs.water).toBe(30);
    expect(game.phase).toBe('dawn');
    expect(game.log.some((m) => m.msg.key === 'wakeAtCamp')).toBe(true);
    // Warmth climbs back up in the daytime, so only these were empty at the end.
    expect(game.log.at(-1)!.msg).toEqual({ key: 'faintWhy', empty: ['food', 'water', 'energy'] });
  });

  it('after fainting from animal bites, the hint says so', () => {
    const game = sandbox(9);
    // Not fed well enough to heal, but nothing has run out.
    game.needs = { health: 0, food: 40, water: 40, energy: 90, warmth: 100 };
    game.wait();
    expect(game.log.at(-1)!.msg).toEqual({ key: 'faintWhy', empty: [] });
  });

  it('a grumpy crab pinches when you linger, but never fatally', () => {
    const game = sandbox(10);
    game.needs.health = 3;
    game.animals = [{ id: 99, kind: 'crab', x: game.player.x + 1, y: game.player.y, facing: 'down', flee: 0 }];
    for (let i = 0; i < 20; i++) game.wait();
    expect(game.log.some((m) => m.msg.key === 'pinch')).toBe(true);
    expect(game.needs.health).toBeGreaterThan(0);
  });

  it('a cheeky monkey snatches food, and bumping shoos animals', () => {
    const game = sandbox(11);
    game.map.set(game.player.x + 1, game.player.y, Tile.Grass);
    const monkey = { id: 99, kind: 'monkey' as const, x: game.player.x + 1, y: game.player.y, facing: 'down' as const, flee: 0 };
    game.animals = [monkey];
    game.wait();
    expect(game.inventory.count('coconut')).toBe(1);
    expect(monkey.flee).toBeGreaterThan(0);

    monkey.flee = 0;
    game.inventory.take('coconut');
    monkey.x = game.player.x + 1;
    monkey.y = game.player.y;
    game.move(1, 0);
    expect(monkey.flee).toBeGreaterThan(0);
  });

  it('animals face left or right and keep their side when they wander up or down', () => {
    const wander = (vertical: boolean) => {
      const game = sandbox(12);
      const { map, player } = game;
      // A corridor of sand two cells east of the explorer, walled with rock on both sides.
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const open = vertical ? dx === 2 : dy === 2 && dx >= 0;
          map.set(player.x + dx, player.y + dy, open ? Tile.Sand : Tile.Rock);
        }
      }
      map.set(player.x, player.y, Tile.Sand);
      const turtle = { id: 99, kind: 'turtle' as const, x: player.x + 2, y: player.y + (vertical ? 0 : 2), facing: 'right' as const, flee: 0 };
      game.animals = [turtle];
      const start = { x: turtle.x, y: turtle.y };
      for (let i = 0; i < 200 && turtle.x === start.x && turtle.y === start.y; i++) game.wait();
      return { turtle, start };
    };
    const up = wander(true);
    expect(up.turtle.y).not.toBe(up.start.y);
    expect(up.turtle.facing).toBe('right');
    const side = wander(false);
    expect(side.turtle.x).not.toBe(side.start.x);
    expect(side.turtle.facing).toBe(side.turtle.x < side.start.x ? 'left' : 'right');
  });

  it('a monkey leaves the food you carry for the boat supplies alone', () => {
    const game = sandbox(11);
    for (const [i, o] of game.objects) if (o.kind.startsWith('boat_')) game.objects.delete(i);
    place(game, -2, 0, 'boat_sail');
    game.map.explored[game.map.idx(game.player.x - 2, game.player.y)] = 1;
    for (const [id] of game.inventory.entries()) game.inventory.take(id, game.inventory.count(id));
    game.inventory.add('coconut', 5);
    game.inventory.add('cooked_fish', 3);
    game.map.set(game.player.x + 1, game.player.y, Tile.Grass);
    const monkey = { id: 99, kind: 'monkey' as const, x: game.player.x + 1, y: game.player.y, facing: 'down' as const, flee: 0 };
    game.animals = [monkey];
    game.wait();
    expect(game.inventory.count('coconut')).toBe(4);

    monkey.flee = 0;
    monkey.x = game.player.x + 1;
    monkey.y = game.player.y;
    game.wait();
    expect(game.inventory.count('coconut')).toBe(4);
    expect(game.inventory.count('cooked_fish')).toBe(3);
    expect(game.log.filter((e) => e.msg.key === 'snatch')).toHaveLength(1);
  });
});

describe('Game: experience and skills', () => {
  it('skill points come at 10, 25, 45, 70 XP', () => {
    expect([1, 2, 3, 4].map(xpForPoints)).toEqual([10, 25, 45, 70]);
    expect(pointsForXp(9)).toBe(0);
    expect(pointsForXp(10)).toBe(1);
    expect(pointsForXp(44)).toBe(2);
  });

  it('gathering and building give XP, floated next to what you got', () => {
    const game = sandbox(20);
    place(game, 1, 0, 'stone_pebbles');
    game.move(1, 0);
    expect(game.xp).toBe(1);
    expect(game.takeEvents().some((e) => e.type === 'float' && 'xp' in e.what && e.amount === 1)).toBe(true);
    game.inventory.add('wood', 3);
    game.inventory.add('stone', 2);
    game.build('campfire');
    expect(game.xp).toBe(6);
  });

  it('enough XP earns a skill point, which learns a skill in path order', () => {
    const game = sandbox(21);
    game.xp = 9;
    place(game, 1, 0, 'stone_pebbles');
    game.move(1, 0);
    expect(game.skillPoints).toBe(1);
    expect(game.log.some((m) => m.msg.key === 'skillPoint')).toBe(true);
    expect(game.skillProblem('small_appetite')).toEqual({ key: 'needSkill', skill: 'small_sips' });
    expect(game.learn('small_sips')).toBe(true);
    expect(game.skillPoints).toBe(0);
    expect(game.learn('small_appetite')).toBe(false);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'needPoints' });
  });

  it('explorer skills make water, food and warmth drop slower', () => {
    const plain = sandbox(22);
    const skilled = sandbox(22);
    skilled.skills = new Set(['small_sips', 'small_appetite', 'thick_skin']);
    for (const g of [plain, skilled]) {
      g.turn = nightTurn();
      g.needs.warmth = 100;
      for (let i = 0; i < 20; i++) g.wait();
    }
    expect(skilled.needs.water).toBeGreaterThan(plain.needs.water);
    expect(skilled.needs.food).toBeGreaterThan(plain.needs.food);
    expect(skilled.needs.warmth).toBeGreaterThan(plain.needs.warmth);
  });

  it('the fishing rod needs its skill; with it you can fish in the sea', () => {
    const game = sandbox(23);
    game.inventory.add('wood', 3);
    game.inventory.add('leaves', 2);
    expect(game.buildProblem('fishing_rod')).toEqual({ key: 'needSkill', skill: 'fishing_rod' });
    game.skills.add('fishing_rod');
    expect(game.build('fishing_rod')).toBe(true);
    game.map.set(game.player.x - 1, game.player.y, Tile.Water);
    const turn = game.turn;
    game.takeEvents();
    expect(game.move(-1, 0)).toBe(true);
    expect(game.player.facing).toBe('left');
    expect(game.takeEvents()).toContainEqual(expect.objectContaining({
      type: 'cast', id: game.player.id, targetX: game.player.x - 1, targetY: game.player.y,
    }));
    for (let i = 1; i < 20; i++) expect(game.move(-1, 0)).toBe(true);
    expect(game.turn).toBe(turn + 20);
    expect(game.inventory.count('fish')).toBeGreaterThan(2);
    expect(game.inventory.count('fish')).toBeLessThan(20);
    expect(game.log.some((m) => m.msg.key === 'noBite')).toBe(true);
  });

  it('patient anglers catch more fish', () => {
    const catches = (patient: boolean) => {
      const game = sandbox(24);
      game.inventory.add('fishing_rod');
      if (patient) game.skills.add('patient_angler');
      game.map.set(game.player.x - 1, game.player.y, Tile.Water);
      for (let i = 0; i < 100; i++) {
        game.needs = { health: 100, food: 80, water: 80, energy: 90, warmth: 100 };
        game.move(-1, 0);
      }
      return game.inventory.count('fish');
    };
    expect(catches(true)).toBeGreaterThan(catches(false));
  });

  it('raw fish cannot be eaten; it must be cooked at a campfire', () => {
    const game = sandbox(25);
    game.inventory.add('fish');
    game.needs.food = 30;
    expect(game.eat('fish')).toBe(false);
    expect(game.buildProblem('cooked_fish')).toEqual({ key: 'needFire' });
    place(game, 2, 0, 'campfire');
    expect(game.build('cooked_fish')).toBe(true);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'cook', item: 'cooked_fish' });
    expect(game.eat('cooked_fish')).toBe(true);
    expect(game.needs.food).toBeGreaterThan(50);
  });

  it('cooking reaches towards the nearest fire', () => {
    const game = sandbox(25);
    game.inventory.add('fish', 2);
    place(game, -2, 2, 'campfire');
    place(game, 1, 0, 'campfire');
    expect(game.nearestFire(game.player.x, game.player.y)).toEqual({ x: game.player.x + 1, y: game.player.y });
    game.takeEvents();
    expect(game.build('cooked_fish')).toBe(true);
    expect(game.takeEvents()).toContainEqual(expect.objectContaining({
      type: 'lunge', id: game.player.id, targetX: game.player.x + 1, targetY: game.player.y,
    }));
    expect(game.nearestFire(game.player.x + 5, game.player.y)).toBeNull();
  });

  it('rope makers twist 2 ropes from one rope recipe', () => {
    const game = sandbox(28);
    game.inventory.add('leaves', 4);
    expect(game.recipeMakes('rope')).toBe(1);
    expect(game.build('rope')).toBe(true);
    expect(game.inventory.count('rope')).toBe(1);
    game.skills.add('rope_maker');
    expect(game.recipeMakes('rope')).toBe(2);
    expect(game.recipeMakes('axe')).toBe(1);
    game.takeEvents();
    expect(game.build('rope')).toBe(true);
    expect(game.inventory.count('rope')).toBe(3);
    expect(game.inventory.count('leaves')).toBe(0);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'make', item: 'rope', count: 2 });
    expect(game.takeEvents()).toContainEqual(expect.objectContaining({ type: 'float', amount: 2, what: { item: 'rope' } }));
  });

  it('rope maker comes after handy builder, and sure foot after night eyes; both cost 2 points', () => {
    expect(SKILLS.rope_maker).toMatchObject({ path: 'build', cost: 2 });
    expect(SKILLS.sure_foot).toMatchObject({ path: 'explorer', cost: 2 });
    const game = sandbox(29);
    game.xp = xpForPoints(10);
    expect(game.skillProblem('rope_maker')).toEqual({ key: 'needSkill', skill: 'handy_builder' });
    expect(game.skillProblem('sure_foot')).toEqual({ key: 'needSkill', skill: 'night_eyes' });
  });

  it('handy builders use one wood less', () => {
    const game = sandbox(26);
    game.skills.add('handy_builder');
    expect(game.recipeCost('campfire')).toEqual({ wood: 2, stone: 2 });
    expect(game.recipeCost('cooked_fish')).toEqual({ fish: 1 });
    game.inventory.add('wood', 2);
    game.inventory.add('stone', 2);
    expect(game.build('campfire')).toBe(true);
    expect(game.inventory.count('wood')).toBe(0);
  });

  it('green thumbs regrow plants faster, and night eyes see further', () => {
    const game = sandbox(27);
    game.skills.add('green_thumb');
    place(game, 1, 0, 'berry_bush');
    game.move(1, 0);
    expect(game.objectAt(game.player.x + 1, game.player.y)!.readyAt).toBe(game.turn - 1 + 140);
    game.turn = nightTurn() + 20;
    expect(game.sightRadius).toBe(4);
    game.skills.add('night_eyes');
    expect(game.sightRadius).toBe(6);
  });

  it('animal friends are not pinched or robbed', () => {
    const game = sandbox(28);
    game.skills.add('animal_friend');
    game.map.set(game.player.x - 1, game.player.y, Tile.Grass);
    game.animals = [
      { id: 98, kind: 'crab', x: game.player.x + 1, y: game.player.y, facing: 'down', flee: 0 },
      { id: 99, kind: 'monkey', x: game.player.x - 1, y: game.player.y, facing: 'down', flee: 0 },
    ];
    for (let i = 0; i < 20; i++) game.wait();
    expect(game.log.some((m) => m.msg.key === 'pinch' || m.msg.key === 'snatch')).toBe(false);
    expect(game.inventory.count('coconut')).toBe(2);
  });
});

describe('Game: wild animals', () => {
  const wild = (kind: 'boar' | 'snake' | 'wasps' | 'bear', dx: number, dy = 0) => ({ id: 99, kind, x: 0, y: 0, facing: 'down' as const, flee: 0, dx, dy });
  function meadow(seed: number, animal: ReturnType<typeof wild>): Game {
    const game = sandbox(seed);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 5; dx++) game.map.set(game.player.x + dx, game.player.y + dy, Tile.Grass);
    const { dx, dy, ...a } = animal;
    game.animals = [{ ...a, x: game.player.x + dx, y: game.player.y + dy }];
    game.wait();
    game.takeEvents();
    return game;
  }

  it('a wild boar charges two cells a turn and knocks you over, then trots off', () => {
    const game = sandbox(40);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 5; dx++) game.map.set(game.player.x + dx, game.player.y + dy, Tile.Grass);
    const boar = { id: 99, kind: 'boar' as const, x: game.player.x + 5, y: game.player.y, facing: 'down' as const, flee: 0 };
    game.animals = [boar];
    game.wait(); // not seen yet: 5 cells away, it notices at 4
    boar.x = game.player.x + 4;
    game.wait();
    expect(boar.x - game.player.x).toBe(2);
    expect(game.log.some((m) => m.msg.key === 'alert')).toBe(true);
    game.wait();
    expect(boar.x - game.player.x).toBe(1);
    const before = game.needs.health;
    game.wait();
    expect(before - game.needs.health).toBeGreaterThan(11);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'hurt', animal: 'boar' });
    expect(boar.flee).toBeGreaterThan(0);
  });

  it('a snake bites when you stand next to it', () => {
    const game = meadow(41, wild('snake', 1));
    const bites = [];
    for (let i = 0; i < 10 && !bites.length; i++) {
      // Keep it next to you: it may wander off before it bites.
      Object.assign(game.animals[0], { x: game.player.x + 1, y: game.player.y });
      game.wait();
      bites.push(...game.takeEvents().filter((e) => e.type === 'hit'));
    }
    expect(bites[0]).toMatchObject({ damage: 8 });
    expect(game.log.some((m) => m.msg.key === 'hurt' && m.msg.animal === 'snake')).toBe(true);
  });

  it('wasps chase you for a while, but give up when you leave the grass', () => {
    const game = meadow(42, wild('wasps', 2));
    const hits = () => game.takeEvents().filter((e) => e.type === 'hit').length;
    let stings = 0;
    for (let i = 0; i < 12; i++) {
      game.wait();
      stings += hits();
    }
    expect(stings).toBeGreaterThan(0);
    expect(stings).toBeLessThanOrEqual(6);

    const again = meadow(43, wild('wasps', 2));
    again.wait();
    again.map.set(again.player.x - 1, again.player.y, Tile.Sand);
    again.move(-1, 0);
    expect(again.animals[0].chase ?? 0).toBe(0);
    expect(again.animals[0].flee).toBeGreaterThan(0);
  });

  it('a cave bear swipes hard if you stay next to it at night', () => {
    const game = sandbox(44);
    game.turn = nightTurn();
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) game.map.set(game.player.x + dx, game.player.y + dy, Tile.CaveFloor);
    game.animals = [{ id: 99, kind: 'bear', x: game.player.x + 1, y: game.player.y, facing: 'down', flee: 0 }];
    for (let i = 0; i < 20 && game.needs.health > 85; i++) game.wait();
    expect(game.needs.health).toBeLessThanOrEqual(81);
  });

  it('Animal friend makes wild animals notice you later', () => {
    const game = sandbox(45);
    expect(game.noticeRange('boar')).toBe(4);
    game.skills.add('animal_friend');
    expect(game.noticeRange('boar')).toBe(2);
    expect(game.noticeRange('wasps')).toBe(1);
    expect(game.noticeRange('snake')).toBe(1);
    expect(game.noticeRange('crab')).toBe(2);

    const calm = meadow(46, wild('boar', 6));
    calm.skills.add('animal_friend');
    const boar = calm.animals[0];
    boar.x = calm.player.x + 3;
    calm.wait();
    expect(calm.log.some((m) => m.msg.key === 'alert')).toBe(false);
    boar.x = calm.player.x + 2;
    calm.wait();
    expect(calm.log.some((m) => m.msg.key === 'alert')).toBe(true);
  });

  it('Wild sense marks the cells where animals would come after you', () => {
    const game = sandbox(47);
    game.animals = [
      { id: 98, kind: 'snake', x: game.player.x + 2, y: game.player.y, facing: 'down', flee: 0 },
      { id: 99, kind: 'monkey', x: game.player.x - 2, y: game.player.y, facing: 'down', flee: 0 },
    ];
    expect(game.dangerCells().size).toBe(0);
    game.skills.add('wild_sense');
    const cells = game.dangerCells();
    expect(cells.size).toBe(9);
    expect(cells.has(game.map.idx(game.player.x + 1, game.player.y))).toBe(true);
    expect(cells.has(game.map.idx(game.player.x - 1, game.player.y))).toBe(false);
  });

  it('wild animals live far from camp', () => {
    for (const seed of [1, 2, 3]) {
      const game = new Game(seed);
      const far = game.animals.filter((a) => ['boar', 'snake', 'wasps', 'bear'].includes(a.kind));
      expect(far.length).toBeGreaterThan(0);
      for (const a of far) expect(Math.max(Math.abs(a.x - game.home.x), Math.abs(a.y - game.home.y))).toBeGreaterThanOrEqual(25);
    }
  });
});

describe('Game: food matters', () => {
  it('cooked fish is the best food on the island', () => {
    const game = sandbox(48);
    game.needs.food = 20;
    game.inventory.add('cooked_fish');
    expect(game.eat('cooked_fish')).toBe(true);
    expect(game.needs.food).toBeGreaterThan(58);
  });

  it('health only comes back when you have eaten and drunk well', () => {
    const hungry = { ...freshNeeds(), health: 50, food: 45, water: 80 };
    tickNeeds(hungry, { sleeping: false, shelter: 0, nearFire: false, daylight: 1 });
    expect(hungry.health).toBe(50);
    const fed = { ...freshNeeds(), health: 50, food: 60, water: 80 };
    tickNeeds(fed, { sleeping: false, shelter: 0, nearFire: false, daylight: 1 });
    expect(fed.health).toBeGreaterThan(50);
  });
});

describe('Game: saving', () => {
  it('round-trips through JSON', () => {
    const game = sandbox(12);
    river(game, 1);
    place(game, 1, 0, 'berry_bush');
    game.move(1, 0);
    game.wait();
    const copy = Game.fromSave(JSON.parse(JSON.stringify(game.toSave())));
    expect(copy.toSave()).toEqual(game.toSave());
    expect(copy.inventory.count('berries')).toBe(game.inventory.count('berries'));
    // Both continue identically.
    game.wait();
    copy.wait();
    expect(copy.toSave()).toEqual(game.toSave());
  });

  it('loads version 1 saves, keeping their English log lines', () => {
    const save = new Game(13).toSave();
    const v1 = { ...save, v: 1, log: [{ text: 'You wash up on a quiet island.', tone: 'info' }] };
    const game = Game.fromSave(JSON.parse(JSON.stringify(v1)));
    expect(game.log).toEqual([{ msg: { key: 'legacy', text: 'You wash up on a quiet island.' }, tone: 'info' }]);
    expect(game.toSave().v).toBe(SAVE_VERSION);
  });

  it('loads version 3 saves at level 1, on an island without a boat', () => {
    const save = new Game(15).toSave();
    const { level: _l, goalGiven: _g, sailed: _s, ...rest } = save;
    const v3 = { ...rest, v: 3, objects: save.objects.filter(([, kind]) => !kind.startsWith('boat_')) };
    const game = Game.fromSave(JSON.parse(JSON.stringify(v3)));
    expect(game.level).toBe(1);
    expect(game.sailed).toBe(false);
    expect(game.goal()).toEqual({ state: 'missing' });
    expect(game.toSave().v).toBe(SAVE_VERSION);
  });

  it('loads version 2 saves with no XP or skills yet, and keeps skills', () => {
    const { xp: _xp, skills: _skills, ...v2 } = { ...new Game(14).toSave(), v: 2 };
    const game = Game.fromSave(JSON.parse(JSON.stringify(v2)));
    expect(game.xp).toBe(0);
    expect(game.skills.size).toBe(0);
    game.xp = 30;
    game.learn('green_thumb');
    const copy = Game.fromSave(JSON.parse(JSON.stringify(game.toSave())));
    expect(copy.has('green_thumb')).toBe(true);
    expect(copy.skillPoints).toBe(game.skillPoints);
  });
});

describe('Game events', () => {
  it('reports the explorer’s move first, animals after as late', () => {
    const game = sandbox(13);
    game.animals = [{ id: 99, kind: 'turtle', x: game.player.x + 2, y: game.player.y, facing: 'down', flee: 0 }];
    game.takeEvents();
    const { x } = game.player;
    for (let i = 0; i < 10; i++) game.move(i % 2 ? 1 : -1, 0);
    const events = game.takeEvents();
    expect(events[0]).toMatchObject({ type: 'move', id: game.player.id, fromX: x, late: false });
    expect(events.filter((e) => e.type === 'move' && e.id === 99).every((e) => e.late)).toBe(true);
  });

  it('gathering floats what you got', () => {
    const game = sandbox(14);
    place(game, 1, 0, 'stone_pebbles');
    game.takeEvents();
    game.move(1, 0);
    expect(game.takeEvents().some((e) => e.type === 'float' && 'item' in e.what && e.what.item === 'stone')).toBe(true);
  });
});

describe('computeFov', () => {
  it('is blocked by opaque cells', () => {
    const seen = new Set<string>();
    computeFov(5, 5, 8, (x) => x === 7, (x, y) => seen.add(`${x},${y}`));
    expect(seen.has('7,5')).toBe(true);
    expect(seen.has('8,5')).toBe(false);
  });
});

/** A game with a clear 7×7 patch of sand round the explorer and no animals. */
describe('generateWorld: the tide islet', () => {
  const worlds = [1, 2, 3, 4, 5, 6].map((seed) => generateWorld(new Rng(seed)));

  it('puts an islet off the coast, joined by a short straight sandbar, with 3 tar barrels on it', () => {
    for (const { map, start, objects } of worlds) {
      const bar = [...objects].filter(([, o]) => OBJECTS[o.kind].tidal).map(([i]) => i);
      expect(bar.length).toBeGreaterThanOrEqual(2);
      expect(bar.length).toBeLessThanOrEqual(5);
      for (const i of bar) expect(map.tiles[i]).toBe(Tile.Water);
      const xs = new Set(bar.map((i) => i % map.width));
      const ys = new Set(bar.map((i) => Math.floor(i / map.width)));
      expect(xs.size === 1 || ys.size === 1).toBe(true);

      // Only the sandbar leads to the islet.
      const isRiver = (x: number, y: number) => map.get(x, y) === Tile.River;
      const way = (withBar: boolean) => (x: number, y: number) => {
        const o = objects.get(map.idx(x, y));
        if (o && OBJECTS[o.kind].tidal) return withBar;
        return map.isFloor(x, y) && (!o || o.kind === 'bramble');
      };
      const dry = reachWithBridges(map, start.x, start.y, way(true), isRiver);
      const wet = reachWithBridges(map, start.x, start.y, way(false), isRiver);
      const islet = [...dry.keys()].filter((i) => dry[i] && !wet[i] && map.tiles[i] !== Tile.Water);
      expect(islet.length).toBeGreaterThan(10);
      const nextToIslet = (i: number) => {
        const x = i % map.width;
        const y = (i - x) / map.width;
        return islet.some((j) => Math.max(Math.abs((j % map.width) - x), Math.abs(Math.floor(j / map.width) - y)) === 1);
      };
      const barrels = [...objects].filter(([, o]) => o.kind === 'barrel').map(([i]) => i);
      expect(barrels).toHaveLength(3);
      for (const i of barrels) expect(nextToIslet(i)).toBe(true);
    }
  });

  it('gives island 2 snowy spruces for resin, and no islet', () => {
    for (const seed of [1, 2, 3]) {
      const { objects } = generateWorld(new Rng(seed), WORLD_WIDTH, WORLD_HEIGHT, 2);
      const kinds = [...objects.values()].map((o) => o.kind);
      expect(kinds.filter((k) => k === 'tree_spruce_snow').length).toBeGreaterThanOrEqual(4);
      expect(kinds.some((k) => OBJECTS[k].tidal || k === 'barrel')).toBe(false);
    }
  });
});

describe('Game: the tide and the sandbar', () => {
  /** A sandbar of 3 cells east of the explorer over open sea, with dry sand after it. */
  function sandbar(seed: number): Game {
    const game = sandbox(seed);
    const { x, y } = game.player;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = 1; dx <= 3; dx++) {
        game.map.set(x + dx, y + dy, Tile.Water);
        game.objects.delete(game.map.idx(x + dx, y + dy));
      }
      game.map.set(x + 4, y + dy, Tile.Sand);
      game.objects.delete(game.map.idx(x + 4, y + dy));
    }
    for (let dx = 1; dx <= 3; dx++) place(game, dx, 0, 'sandbar_ew');
    return game;
  }
  const at = (hour: number) => (hour - 8) * 10 + (hour < 8 ? TURNS_PER_DAY : 0);

  it('has low tide from 5 to 11 and from 17 to 23', () => {
    expect([4, 5, 10, 11, 16, 17, 22, 23].map((h) => isLowTide(at(h)))).toEqual([false, true, true, false, false, true, true, false]);
    expect(nextLowTide(at(11))).toBe(at(17));
    expect(nextLowTide(at(6))).toBe(at(6));
  });

  it('lets you walk over the sandbar at low tide only', () => {
    const game = sandbar(80);
    const { x, y } = game.player;
    game.turn = at(8);
    expect(game.isPassable(x + 1, y)).toBe(true);
    expect(game.objectSprite(game.objectAt(x + 1, y)!)).toBe('sandbar_ew');
    expect(game.move(1, 0)).toBe(true);
    expect(game.player.x).toBe(x + 1);
    game.turn = at(12);
    expect(game.isPassable(x + 2, y)).toBe(false);
    expect(game.objectSprite(game.objectAt(x + 2, y)!)).toBe('sandbar_ew_wet');
  });

  it('says when low tide comes back if you walk into the flooded sandbar, and no time passes', () => {
    const game = sandbar(81);
    game.inventory.add('fishing_rod');
    game.turn = at(12);
    expect(game.move(1, 0)).toBe(false);
    expect(game.turn).toBe(at(12));
    expect(game.log.at(-1)?.msg).toEqual({ key: 'tideHigh', turn: at(17) });
  });

  it('sends you back to dry land, wet and cold, when the tide comes in over the sandbar', () => {
    const game = sandbar(82);
    const { x } = game.player;
    game.player.x = x + 3;
    game.turn = at(11) - 1;
    const warmth = game.needs.warmth;
    game.wait();
    expect(game.player.x).toBe(x + 4);
    expect(game.map.isFloor(game.player.x, game.player.y)).toBe(true);
    expect(game.needs.warmth).toBeLessThan(warmth - 13);
    expect(game.log.some((m) => m.msg.key === 'tideWade')).toBe(true);
  });

  it('tells you when the tide turns, once you have seen the sandbar', () => {
    const game = sandbar(83);
    game.turn = at(11) - 1;
    for (const [i, o] of game.objects) if (OBJECTS[o.kind].tidal) game.map.explored[i] = 0;
    // Far from the sandbar: nothing to say.
    const away = { ...game.player };
    game.player.x -= 30;
    game.wait();
    expect(game.tideKnown()).toBe(false);
    expect(game.log.some((m) => m.msg.key === 'tideIn')).toBe(false);
    Object.assign(game.player, away);
    game.wait();
    expect(game.tideKnown()).toBe(true);
    game.turn = at(17) - 1;
    game.wait();
    expect(game.log.at(-1)?.msg).toEqual({ key: 'tideOut' });
  });
});

describe('Game: sleeping cave bears', () => {
  function cave(seed: number, bearDx: number): { game: Game; bear: Game['animals'][number] } {
    const game = sandbox(seed);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -16; dx <= 6; dx++) {
        game.map.set(game.player.x + dx, game.player.y + dy, Tile.CaveFloor);
        game.objects.delete(game.map.idx(game.player.x + dx, game.player.y + dy));
      }
    }
    const bear = { id: 99, kind: 'bear' as const, x: game.player.x + bearDx, y: game.player.y, facing: 'down' as const, flee: 0 };
    game.animals = [bear];
    // Look round the cave in the day, while the bear sleeps.
    game.turn = 10;
    game.wait();
    return { game, bear };
  }

  it('sleep through the day: they do not move, notice you or hurt you', () => {
    const { game, bear } = cave(90, 1);
    game.turn = 10;
    game.skills.add('wild_sense');
    for (let i = 0; i < 30; i++) game.wait();
    expect(game.asleep(bear)).toBe(true);
    expect(bear.x - game.player.x).toBe(1);
    expect(game.needs.health).toBe(100);
    expect(game.dangerCells().size).toBe(0);
  });

  it('wake up when you shoo them, and lie down again later', () => {
    const { game, bear } = cave(91, 1);
    game.turn = 10;
    game.move(1, 0);
    expect(game.asleep(bear)).toBe(false);
    for (let i = 0; i < 12; i++) game.wait();
    expect(game.asleep(bear)).toBe(true);
  });

  it('prowl after you at night, but give up after a few turns', () => {
    const { game, bear } = cave(92, 3);
    game.turn = nightTurn();
    game.wait();
    expect(game.log.some((m) => m.msg.key === 'alert' && m.msg.animal === 'bear')).toBe(true);
    expect(bear.x - game.player.x).toBe(2);
    // Walk away: the bear follows for a while, then stops.
    let gaveUp = false;
    for (let i = 0; i < 10; i++) {
      game.move(-1, 0);
      if (bear.flee > 0) gaveUp = true;
    }
    expect(gaveUp).toBe(true);
    expect(game.needs.health).toBe(100);
    expect(game.log.filter((m) => m.msg.key === 'alert').length).toBe(1);
  });

  it('stop following you when you leave their cave', () => {
    const { game, bear } = cave(93, 3);
    game.turn = nightTurn();
    game.wait();
    expect(bear.chase).toBeGreaterThan(0);
    game.map.set(game.player.x - 1, game.player.y, Tile.Sand);
    game.move(-1, 0);
    expect(bear.chase).toBe(0);
    expect(bear.flee).toBeGreaterThan(0);
  });
});

describe('Game: rare materials for the goal', () => {
  const [hull] = LEVELS[0].stages;
  const tinder = LEVELS[1].stages[2];

  it('old tar barrels give tar one time', () => {
    const game = sandbox(100);
    place(game, 1, 0, 'barrel');
    expect(game.move(1, 0)).toBe(true);
    expect(game.inventory.count('tar')).toBe(2);
    expect(game.objectAt(game.player.x + 1, game.player.y)?.kind).toBe('barrel_empty');
    expect(game.move(1, 0)).toBe(false);
  });

  it('the hull needs tar, except on an island without tar barrels (from an old save)', () => {
    const game = boatNextTo(sandbox(101));
    expect(game.goal()).toMatchObject({ left: { log: 12, wood: 6, stone: 6, tar: 4 } });
    // Empty barrels still count: the tar went into your bag.
    for (const [i, o] of game.objects) if (o.kind === 'barrel') game.objects.set(i, { kind: 'barrel_empty' });
    expect(game.stageCost(hull)).toEqual(hull.cost);
    for (const [i, o] of game.objects) if (o.kind.startsWith('barrel')) game.objects.delete(i);
    expect(game.goal()).toMatchObject({ left: { log: 12, wood: 6, stone: 6 } });
  });

  it('the beacon tinder needs resin, which snowy spruces sometimes give', () => {
    const game = sandbox(102);
    place(game, 1, 0, 'tree_spruce_snow');
    expect(game.stageCost(tinder)).toEqual({ leaves: 12, wood: 4, resin: 3 });
    for (let i = 0; i < 30 && !game.inventory.count('resin'); i++) {
      game.objectAt(game.player.x + 1, game.player.y)!.readyAt = undefined;
      game.move(1, 0);
    }
    expect(game.inventory.count('resin')).toBe(1);
    for (const [i, o] of game.objects) if (o.kind === 'tree_spruce_snow') game.objects.delete(i);
    expect(game.stageCost(tinder)).toEqual({ leaves: 12, wood: 4 });
  });
});

describe('Game: island stars', () => {
  it('lists three stars for each island, none earned at the start', () => {
    const game = sandbox(110);
    expect(game.starStates().map((s) => [s.id, s.done])).toEqual([['chests', false], ['fish', false], ['safe', false]]);
    expect(LEVELS[1].stars).toEqual(['chests', 'explore', 'safe']);
  });

  it('gives the Angler star and 5 XP for 5 fish caught on this island', () => {
    const game = sandbox(111);
    game.map.set(game.player.x + 1, game.player.y, Tile.Water);
    game.inventory.add('fishing_rod');
    for (let i = 0; i < 200 && game.fishHere < 5; i++) game.move(1, 0);
    expect(game.fishHere).toBe(5);
    expect(game.hasStar('fish')).toBe(true);
    expect(game.log.some((m) => m.msg.key === 'star' && m.msg.star === 'fish')).toBe(true);
    // Nothing more for more fish.
    const stars = game.stars.length;
    for (let i = 0; i < 20; i++) game.move(1, 0);
    expect(game.stars.length).toBe(stars);
  });

  it('gives the Treasure hunter star for opening every chest', () => {
    const game = sandbox(112);
    for (const [i, o] of game.objects) if (o.kind === 'chest_closed') game.objects.set(i, { kind: 'chest_open' });
    place(game, 1, 0, 'chest_closed');
    game.wait();
    expect(game.hasStar('chests')).toBe(false);
    const xp = game.xp;
    game.move(1, 0);
    expect(game.hasStar('chests')).toBe(true);
    expect(game.xp).toBe(xp + 1 + 5);
  });

  it('gives Safe and sound after 3 days in a row without fainting; fainting starts the count again', () => {
    const game = sandbox(113);
    game.turn = 2 * TURNS_PER_DAY;
    game.wait();
    expect(game.starStates().find((s) => s.id === 'safe')).toMatchObject({ have: 2, need: 3, done: false });
    Object.assign(game.needs, { health: 0, food: 0 });
    game.wait();
    expect(game.log.some((m) => m.msg.key === 'faint')).toBe(true);
    expect(game.starStates().find((s) => s.id === 'safe')).toMatchObject({ have: 0 });
    game.turn += 3 * TURNS_PER_DAY;
    game.wait();
    expect(game.hasStar('safe')).toBe(true);
  });

  it('counts how much of the island you explored', () => {
    const game = sandbox(114);
    const progress = () => (game as unknown as { starProgress(id: string): { have: number; need: number } }).starProgress('explore');
    expect(progress()).toMatchObject({ need: 75 });
    expect(progress().have).toBeLessThan(10);
    game.map.explored.fill(1);
    expect(progress().have).toBe(75);
  });

  it('keeps stars in the save, and loads version 7 saves with none', () => {
    const game = sandbox(115);
    game.stars.push([1, 'chests']);
    game.fishHere = 3;
    const copy = Game.fromSave(JSON.parse(JSON.stringify(game.toSave())));
    expect(copy.stars).toEqual([[1, 'chests']]);
    expect(copy.fishHere).toBe(3);
    const { stars: _s, fishHere: _f, safeSince: _a, ...v7 } = { ...game.toSave(), v: 7 };
    const old = Game.fromSave(JSON.parse(JSON.stringify(v7)));
    expect(old.stars).toEqual([]);
    expect(old.safeSince).toBe(game.turn);
  });
});

describe('deep caves', () => {
  /** An island with the explorer on open ground next to a way into a deep cave, by day. */
  function atCaveMouth(seed: number) {
    const game = new Game(seed);
    game.animals = [];
    const { map } = game;
    for (const cave of game.caves()) {
      for (const e of cave.entrances) {
        const ex = e % map.width;
        const ey = Math.floor(e / map.width);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ox = ex - dx;
          const oy = ey - dy;
          if (!map.isFloor(ox, oy) || game.inCave(ox, oy) || map.get(ox, oy) === Tile.CaveFloor) continue;
          game.objects.delete(map.idx(ox, oy));
          game.objects.delete(e);
          game.player.x = ox;
          game.player.y = oy;
          return { game, dx, dy, cave };
        }
      }
    }
    throw new Error('no cave mouth');
  }

  it('digs deep caves into every island, each with a chest, glowcaps and crystals', () => {
    for (const level of [1, 2]) {
      for (const seed of [1, 2, 3]) {
        const world = generateWorld(new Rng(seed), WORLD_WIDTH, WORLD_HEIGHT, level);
        const caves = findCaves(world.map);
        expect(caves.length, `island ${level}, seed ${seed}`).toBeGreaterThanOrEqual(level === 1 ? 3 : 2);
        for (const cave of caves) {
          expect(cave.cells.length).toBeGreaterThanOrEqual(DEEP_CAVE_CELLS);
          expect(cave.entrances.length).toBeGreaterThanOrEqual(1);
          expect(cave.entrances.length).toBeLessThanOrEqual(4);
          const kinds = cave.cells.map((i) => world.objects.get(i)?.kind);
          expect(kinds).toContain('chest_closed');
          expect(kinds).toContain('glowcap');
          expect(kinds).toContain('crystal_cluster');
        }
        // Glowcaps and crystals grow nowhere else.
        for (const [i, o] of world.objects) {
          if (o.kind === 'glowcap' || o.kind === 'crystal_cluster') expect(caves.some((c) => c.cells.includes(i))).toBe(true);
        }
      }
    }
  });

  it('is dark inside, also by day; the crystal lantern helps there and at night', () => {
    const { game, dx, dy } = atCaveMouth(3);
    expect(game.phase).toBe('day');
    expect(game.sightRadius).toBe(8);
    expect(game.move(dx, dy)).toBe(true);
    expect(game.inCave(game.player.x, game.player.y)).toBe(true);
    expect(game.daylightAt(game.player.x, game.player.y)).toBe(0);
    expect(game.sightRadius).toBe(4);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'caveEnter' });
    game.inventory.add('lantern', 1);
    expect(game.sightRadius).toBe(6);
    // Outside by day the lantern changes nothing; at night it does.
    game.player.x -= dx;
    game.player.y -= dy;
    expect(game.sightRadius).toBe(8);
    game.turn = nightTurn() + 20;
    expect(game.sightRadius).toBe(6);
  });

  it('says that the lantern lights the way into a cave', () => {
    const { game, dx, dy } = atCaveMouth(4);
    game.inventory.add('lantern', 1);
    expect(game.move(dx, dy)).toBe(true);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'caveEnter', lantern: true });
  });

  it('marks the ways in the explorer has seen on the map', () => {
    const { game, dx, dy } = atCaveMouth(5);
    const signs = () => drawMap(game.map, game.objects, game.player, [], game.caves().flatMap((c) => c.entrances)).markers.map((m) => m.sign);
    game.map.explored.fill(0);
    expect(signs()).not.toContain('cave');
    game.move(dx, dy);
    expect(signs()).toContain('cave');
  });

  it('has glowcaps that give energy food, glow, and grow back', () => {
    const game = sandbox(60);
    place(game, 1, 0, 'glowcap');
    const at = game.map.idx(game.player.x + 1, game.player.y);
    expect(game.lights()).toContainEqual([game.player.x + 1, game.player.y, 1]);
    expect(game.move(1, 0)).toBe(true);
    expect(game.inventory.count('glowcap')).toBeGreaterThanOrEqual(2);
    expect(game.inventory.count('glowcap')).toBeLessThanOrEqual(3);
    expect(game.objects.get(at)?.kind).toBe('glowcap');
    expect(game.objectSprite(game.objects.get(at)!)).toBe('glowcap_picked');
    // A picked clump does not glow until it grows back.
    expect(game.lights()).not.toContainEqual([game.player.x + 1, game.player.y, 1]);
    game.needs.energy = 50;
    game.needs.food = 50;
    expect(game.eat('glowcap')).toBe(true);
    expect(game.needs.energy).toBeCloseTo(50 + 15, 0);
  });

  it('has crystals for the crystal lantern', () => {
    const game = sandbox(61);
    place(game, 1, 0, 'crystal_cluster');
    expect(game.move(1, 0)).toBe(true);
    const got = game.inventory.count('crystal');
    expect(got).toBeGreaterThanOrEqual(1);
    expect(got).toBeLessThanOrEqual(2);
    expect(game.objectAt(game.player.x + 1, game.player.y)).toBeUndefined();
    game.inventory.add('crystal', 3 - got);
    game.inventory.add('wood', 1);
    game.inventory.add('rope', 1);
    expect(game.build('lantern')).toBe(true);
    expect(game.inventory.count('lantern')).toBe(1);
    expect(game.inventory.count('crystal')).toBe(0);
    game.inventory.add('crystal', 3);
    game.inventory.add('wood', 1);
    game.inventory.add('rope', 1);
    expect(game.buildProblem('lantern')).toEqual({ key: 'haveTool', item: 'lantern' });
  });

  it('finds big caves with few ways in, not small nooks or open rows of them', () => {
    const map = new GameMap(40, 20);
    map.tiles.fill(Tile.Rock);
    const dig = (x0: number, y0: number, w: number, h: number) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) map.set(x, y, Tile.CaveFloor);
    };
    for (let x = 0; x < 40; x++) map.set(x, 19, Tile.Grass);
    // A nook of 6 cells, a room of 40 with one way out, and a row of nooks open to the grass.
    dig(1, 1, 3, 2);
    dig(8, 2, 8, 5);
    dig(11, 7, 1, 12);
    dig(14, 16, 25, 3);
    const caves = findCaves(map);
    expect(caves).toHaveLength(1);
    expect(caves[0].cells.length).toBe(40 + 12);
    expect(caves[0].entrances).toEqual([map.idx(11, 18)]);
  });
});

describe('Game: islands from before the tide islet', () => {
  it('can start a new island 1 and keep the bag, XP, skills, stars and dog', () => {
    const game = sandbox(120);
    expect(game.oldIsland).toBe(false);
    for (const [i, o] of game.objects) if (OBJECTS[o.kind].tidal || o.kind.startsWith('barrel')) game.objects.delete(i);
    expect(game.oldIsland).toBe(true);
    game.inventory.add('wood', 7);
    game.inventory.add('axe');
    game.xp = 40;
    game.learn('small_sips');
    game.stars.push([1, 'fish']);
    game.dog = { id: 5, x: game.player.x + 1, y: game.player.y, facing: 'left', food: 50, water: 50, tired: false };

    const fresh = Game.newIslandKeeping(game);
    expect(fresh.oldIsland).toBe(false);
    expect(fresh.seed).not.toBe(game.seed);
    expect(fresh.inventory.count('wood')).toBe(game.inventory.count('wood'));
    expect(fresh.inventory.count('axe')).toBe(1);
    expect(fresh.xp).toBe(40);
    expect(fresh.has('small_sips')).toBe(true);
    expect(fresh.stars).toEqual([[1, 'fish']]);
    expect(fresh.dog).toMatchObject({ food: 50, water: 50 });
    expect(Math.max(Math.abs(fresh.dog!.x - fresh.player.x), Math.abs(fresh.dog!.y - fresh.player.y))).toBe(1);
    expect(fresh.animals.some((a) => a.kind === 'dog')).toBe(false);
    expect(fresh.animals.some((a) => a.id === fresh.dog!.id)).toBe(false);
    expect(fresh.goal()).toEqual({ state: 'find' });
  });
});

describe('Game: the camp (hut, bed and rooms)', () => {
  /** A sandbox with a hut just east of the explorer, who walks into it. */
  function inHut(seed: number, rooms: ('workshop' | 'hearth' | 'barrel')[] = []): Game {
    const game = sandbox(seed);
    game.objects.set(game.map.idx(game.player.x + 1, game.player.y), { kind: 'hut', rooms: rooms.length ? rooms : undefined });
    game.move(1, 0);
    game.takeEvents();
    return game;
  }

  it('costs a lot, and there is only one on each island', () => {
    const cost = Object.values(RECIPES.hut.siteCost!).reduce((sum, n) => sum + (n ?? 0), 0);
    expect(cost).toBeGreaterThanOrEqual(90);
    const game = sandbox(110);
    game.player.facing = 'right';
    expect(game.hasHut()).toBe(false);
    expect(game.build('hut')).toBe(true);
    expect(game.hasHut()).toBe(true);
    expect(game.buildProblem('hut')).toEqual({ key: 'oneHut' });
    expect(game.build('hut')).toBe(false);
  });

  it('goes inside when you walk into it', () => {
    const game = inHut(111);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'enterHut' });
    expect(game.takeHutRequest()).toBe(true);
    expect(game.takeHutRequest()).toBe(false);
    expect(game.hutHere()?.kind).toBe('hut');
  });

  it('gives a full rest only in the hut bed', () => {
    const rest = (game: Game) => {
      game.turn = 20; // the morning: warm enough to sleep anywhere
      game.needs.energy = 20;
      game.needs.food = game.needs.water = game.needs.warmth = 100;
      game.sleep();
      return game.needs.energy;
    };
    const open = sandbox(112);
    expect(rest(open)).toBe(50);
    expect(open.log.at(-1)?.msg).toMatchObject({ key: 'wake', reason: 'restless' });
    // At the limit, there is no more rest to get here.
    expect(open.sleep()).toBe(false);
    expect(open.log.at(-1)?.msg).toEqual({ key: 'restLimit', cap: 50 });

    const cave = sandbox(113);
    cave.map.set(cave.player.x, cave.player.y, Tile.CaveFloor);
    expect(rest(cave)).toBe(60);

    const leanTo = sandbox(114);
    place(leanTo, 0, 0, 'lean_to');
    expect(rest(leanTo)).toBe(75);

    const hut = inHut(115);
    expect(rest(hut)).toBeGreaterThanOrEqual(99);
    expect(hut.log.at(-1)?.msg).toMatchObject({ key: 'wake', reason: 'rested' });
    expect(hut.home).toEqual({ x: hut.player.x, y: hut.player.y });
  });

  it('heals you faster asleep in the bed, and faster still by the hearth', () => {
    const night = (game: Game) => {
      game.turn = nightTurn();
      game.needs = { health: 40, food: 100, water: 100, energy: 20, warmth: 100 };
      game.sleep();
      return game.needs.health;
    };
    const leanTo = sandbox(116);
    place(leanTo, 0, 0, 'lean_to');
    const plain = night(inHut(116));
    expect(plain).toBeGreaterThan(night(leanTo));
    expect(night(inHut(116, ['hearth']))).toBeGreaterThan(plain);
  });

  it('adds rooms from inside, for their materials and XP; the hut looks different', () => {
    const outside = sandbox(117);
    give(outside, ROOMS.workshop.cost);
    expect(outside.addRoom('workshop')).toBe(false);
    expect(outside.log.at(-1)?.msg).toEqual({ key: 'notInHut' });

    const game = inHut(117);
    const hut = game.hutHere()!;
    expect(game.objectSprite(hut)).toBe('hut');
    expect(game.roomProblem('workshop')).toEqual({ key: 'needMaterials' });
    give(game, ROOMS.workshop.cost);
    const xp = game.xp;
    expect(game.addRoom('workshop')).toBe(true);
    expect(hut.rooms).toEqual(['workshop']);
    expect(game.xp - xp).toBe(20);
    expect(game.inventory.count('wood')).toBe(0);
    expect(game.log.some((e) => e.msg.key === 'roomBuilt')).toBe(true);
    expect(game.roomProblem('workshop')).toEqual({ key: 'notInHut' });

    give(game, ROOMS.hearth.cost);
    expect(game.addRoom('hearth')).toBe(true);
    expect(game.objectSprite(hut)).toBe('hut_workshop_hearth');
    expect(game.objectSprite(hut, 1)).toBe('hut_workshop_hearth_2');
  });

  it('makes one more rope at the workbench', () => {
    const game = inHut(118, ['workshop']);
    expect(game.recipeMakes('rope')).toBe(2);
    game.skills.add('rope_maker');
    expect(game.recipeMakes('rope')).toBe(3);
    game.move(-1, 0);
    expect(game.recipeMakes('rope')).toBe(2);
    game.skills.delete('rope_maker');
    expect(game.recipeMakes('rope')).toBe(1);
  });

  it('cooks fish at the hearth, but only inside', () => {
    const game = inHut(119, ['hearth']);
    game.inventory.add('fish', 2);
    expect(game.nearFire(game.player.x, game.player.y)).toBe(true);
    expect(game.build('cooked_fish')).toBe(true);
    expect(game.inventory.count('cooked_fish')).toBe(1);
    expect(game.lights().some(([x, y]) => x === game.player.x && y === game.player.y)).toBe(true);
    game.move(-1, 0);
    expect(game.buildProblem('cooked_fish')).toEqual({ key: 'needFire' });
  });

  it('gives water at the rain barrel', () => {
    const game = inHut(120, ['barrel']);
    game.needs.water = 40;
    expect(game.drinkBarrel()).toBe(true);
    expect(game.needs.water).toBeGreaterThan(74);
    expect(game.log.some((e) => e.msg.key === 'drinkBarrel')).toBe(true);
    game.move(-1, 0);
    expect(game.drinkBarrel()).toBe(false);
  });

  it('keeps its rooms in the save, and old saves load without rooms', () => {
    const game = inHut(121, ['barrel', 'hearth']);
    const copy = Game.fromSave(JSON.parse(JSON.stringify(game.toSave())));
    expect(copy.hutHere()?.rooms).toEqual(['barrel', 'hearth']);
    const old = Game.fromSave(JSON.parse(JSON.stringify({ ...inHut(122).toSave(), v: 8 })));
    expect(old.toSave().v).toBe(SAVE_VERSION);
    expect(old.hutHere()?.rooms).toBeUndefined();
  });
});

/** Put a recipe's (or room's) materials in the bag. */
describe('Game: island 4, the oil rig', () => {
  function rig(seed: number): Game {
    const game = new Game(seed);
    (game as unknown as { landOn(level: number): void }).landOn(4);
    game.animals = [];
    game.dog = null;
    game.takeEvents();
    return game;
  }

  /**
   * A clear strip of deck round the explorer, then to the east a broken
   * gangway over two sea cells and more deck: deck, end_e, end_w, deck.
   */
  function gap(game: Game): void {
    const { map, player: p } = game;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 5; dx++) {
        map.set(p.x + dx, p.y + dy, dx === 1 || dx === 2 ? Tile.Water : Tile.Deck);
        game.objects.delete(map.idx(p.x + dx, p.y + dy));
      }
    }
    place(game, 1, 0, 'gangway_end_e');
    place(game, 2, 0, 'gangway_end_w');
    p.facing = 'right';
  }

  it('is made of decks in the sea, with the radio room behind a broken gangway', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const game = rig(seed);
      const { map, player: p } = game;
      expect(map.get(p.x, p.y)).toBe(Tile.Deck);
      const kinds = [...game.objects.values()].map((o) => o.kind);
      const count = (k: string) => kinds.filter((x) => x === k).length;
      expect(count('radio_hut')).toBe(1);
      expect(count('crew_cabin')).toBe(1);
      expect(count('balloon_crashed')).toBe(1);
      expect(count('chest_closed')).toBe(6);
      expect(count('water_tank')).toBe(2);
      expect(count('diesel_drums')).toBe(3);
      expect(count('gangway_end_e') + count('gangway_end_s')).toBeGreaterThanOrEqual(2);
      // Enough scrap for every broken gangway and every stage of the radio.
      const broken = count('gangway_end_e') + count('gangway_end_s');
      const needed = broken * 6 + LEVELS[3].stages.reduce((n, s) => n + (s.cost.scrap ?? 0), 0);
      expect(count('scrap_pile') * 2).toBeGreaterThanOrEqual(needed);
      // Without mending anything, the radio room is out of reach.
      const radio = [...game.objects].find(([, o]) => o.kind === 'radio_hut')![0];
      const dist = distanceMap(map, p.x, p.y, (x, y) => game.isPassable(x, y));
      const rx = radio % map.width;
      const ry = (radio - rx) / map.width;
      const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => dist[map.idx(rx + dx, ry + dy)] >= 0);
      expect(next).toBe(false);
      // The crew cabin can be reached at once.
      const cabin = [...game.objects].find(([, o]) => o.kind === 'crew_cabin')![0];
      expect(dist[cabin]).toBeGreaterThan(0);
    }
  });

  it('crosses whole gangways over the sea', () => {
    const game = rig(3);
    gap(game);
    const { map, player: p } = game;
    place(game, 1, 0, 'gangway_ew');
    place(game, 2, 0, 'gangway_ew');
    expect(game.isPassable(p.x + 1, p.y)).toBe(true);
    const x = p.x;
    expect(game.move(1, 0)).toBe(true);
    expect(game.move(1, 0)).toBe(true);
    expect(game.move(1, 0)).toBe(true);
    expect(p.x).toBe(x + 3);
    expect(map.get(p.x, p.y)).toBe(Tile.Deck);
  });

  it('stops at a broken gangway, and mends the whole gap with scrap', () => {
    const game = rig(4);
    gap(game);
    const { player: p } = game;
    const turn = game.turn;
    expect(game.isPassable(p.x + 1, p.y)).toBe(false);
    expect(game.move(1, 0)).toBe(false);
    expect(game.turn).toBe(turn);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'gangwayBroken' });
    expect(game.buildProblem('gangway')).toEqual({ key: 'needMaterials' });
    game.inventory.add('scrap', 6);
    const xp = game.xp;
    expect(game.build('gangway')).toBe(true);
    expect(game.objectAt(p.x + 1, p.y)?.kind).toBe('gangway_ew');
    expect(game.objectAt(p.x + 2, p.y)?.kind).toBe('gangway_ew');
    expect(game.inventory.count('scrap')).toBe(0);
    expect(game.xp).toBe(xp + 6);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'gangwayMended' });
    expect(game.move(1, 0)).toBe(true);
    expect(game.move(1, 0)).toBe(true);
  });

  it('mends a north-south gangway too, and needs a broken end next to the explorer', () => {
    const game = rig(5);
    gap(game);
    const { map, player: p } = game;
    for (const dx of [1, 2]) map.set(p.x + dx, p.y, Tile.Deck);
    for (const dx of [1, 2]) game.objects.delete(map.idx(p.x + dx, p.y));
    game.inventory.add('scrap', 12);
    expect(game.buildProblem('gangway')).toEqual({ key: 'noStep', obj: 'gangway_end_n' });
    for (const dy of [1, 2]) map.set(p.x, p.y + dy, Tile.Water);
    place(game, 0, 1, 'gangway_end_s');
    place(game, 0, 2, 'gangway_end_n');
    expect(game.build('gangway')).toBe(true);
    expect(game.objectAt(p.x, p.y + 1)?.kind).toBe('gangway_ns');
    expect(game.objectAt(p.x, p.y + 2)?.kind).toBe('gangway_ns');
  });

  it('gives water at the tanks, mussels at the legs, wood from pallets and rope from old nets', () => {
    const game = rig(6);
    gap(game);
    const { map, player: p } = game;
    place(game, -1, 0, 'water_tank');
    game.needs.water = 40;
    expect(game.move(-1, 0)).toBe(true);
    expect(game.needs.water).toBeGreaterThan(70);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'drink', tank: true });
    map.set(p.x, p.y + 1, Tile.Water);
    place(game, 0, 1, 'mussel_bed');
    expect(game.move(0, 1)).toBe(true);
    expect(game.inventory.count('mussels')).toBeGreaterThanOrEqual(2);
    expect(game.objectAt(p.x, p.y + 1)?.readyAt).toBeGreaterThan(game.turn);
    place(game, 0, -1, 'pallet');
    expect(game.move(0, -1)).toBe(true);
    expect(game.inventory.count('wood')).toBeGreaterThanOrEqual(2);
    place(game, -1, -1, 'old_net');
    expect(game.move(-1, -1)).toBe(true);
    expect(game.inventory.count('rope')).toBeGreaterThanOrEqual(1);
  });

  it('pours diesel from the drums, and the generator keeps asking for diesel after that', () => {
    const game = rig(7);
    gap(game);
    for (const o of game.objects.values()) if (o.kind === 'diesel_drums') o.kind = 'diesel_drums_empty';
    place(game, -1, 0, 'diesel_drums');
    expect(game.move(-1, 0)).toBe(true);
    expect(game.inventory.count('diesel')).toBe(2);
    expect(game.objectAt(game.player.x - 1, game.player.y)?.kind).toBe('diesel_drums_empty');
    expect(game.stageCost(LEVELS[3].stages[1])).toEqual({ scrap: 6, diesel: 4 });
  });

  it('sleeps and cooks in the crew cabin', () => {
    const game = rig(8);
    gap(game);
    place(game, -1, 0, 'crew_cabin');
    expect(game.move(-1, 0)).toBe(true);
    expect(game.restCap(game.player.x, game.player.y)).toBe(100);
    expect(game.shelterAt(game.player.x, game.player.y)).toBe(1);
    expect(game.nearFire(game.player.x, game.player.y)).toBe(true);
    game.inventory.add('fish', 1);
    expect(game.build('cooked_fish')).toBe(true);
    expect(game.inventory.count('cooked_fish')).toBe(1);
  });

  it('repairs the radio in three stages, and calling for help ends the game', () => {
    const game = rig(9);
    gap(game);
    for (const [i, o] of game.objects) if (o.kind === 'radio_hut') game.objects.delete(i);
    place(game, -1, 0, 'radio_hut');
    game.map.explored[game.map.idx(game.player.x - 1, game.player.y)] = 1;
    for (const stage of LEVELS[3].stages) {
      for (const [item, n] of Object.entries(stage.cost)) game.inventory.add(item as keyof typeof stage.cost, n);
      expect(game.move(-1, 0)).toBe(true);
      expect(game.objectAt(game.player.x - 1, game.player.y)?.kind).toBe(stage.becomes);
    }
    expect(game.goal()).toEqual({ state: 'ready' });
    game.move(-1, 0);
    expect(game.takeSailRequest()).toBe(true);
    expect(game.sail()).toBe(true);
    expect(game.level).toBe(4);
    expect(game.sailed).toBe(true);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'sailAway', level: 4 });
  });

  it('flies the balloon again from an old save that ended on island 3', () => {
    const game = new Game(10);
    (game as unknown as { landOn(level: number): void }).landOn(3);
    const save = { ...game.toSave(), sailed: true };
    expect(Game.fromSave(save).sailed).toBe(false);
  });

  it('keeps the rig, its gangways and the mended ones in the save', () => {
    const game = rig(11);
    gap(game);
    game.inventory.add('scrap', 6);
    game.build('gangway');
    const loaded = Game.fromSave(JSON.parse(JSON.stringify(game.toSave())));
    expect(loaded.level).toBe(4);
    expect(loaded.map.get(loaded.player.x, loaded.player.y)).toBe(Tile.Deck);
    expect(loaded.objectAt(loaded.player.x + 1, loaded.player.y)?.kind).toBe('gangway_ew');
    expect(loaded.isPassable(loaded.player.x + 1, loaded.player.y)).toBe(true);
  });
});

describe('Game: the carry limit, the store crate and the hut frame', () => {
  it('counts only heavy things, and the skills and the pack frame carry more', () => {
    const game = sandbox(130);
    game.inventory.add('wood', 5);
    game.inventory.add('stone', 4);
    game.inventory.add('leaves', 20);
    game.inventory.add('coconut', 6);
    expect(game.load).toBe(9);
    expect(game.loadLimit).toBe(BAG_LOAD);
    game.skills.add('strong_back');
    expect(game.loadLimit).toBe(BAG_LOAD + STRONG_BACK_LOAD);
    expect(game.buildProblem('pack_frame')).toEqual({ key: 'needSkill', skill: 'pack_frame' });
    game.skills.add('pack_frame');
    give(game, { rope: 3 });
    expect(game.build('pack_frame')).toBe(true);
    expect(game.loadLimit).toBe(BAG_LOAD + STRONG_BACK_LOAD + PACK_FRAME_LOAD);
  });

  it('stops gathering heavy things when the bag is full, but not light things', () => {
    const game = sandbox(131);
    game.inventory.add('stone', BAG_LOAD);
    place(game, 1, 0, 'stone_pebbles');
    const turn = game.turn;
    expect(game.move(1, 0)).toBe(false);
    expect(game.turn).toBe(turn);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'tooHeavy' });
    place(game, 1, 0, 'bush');
    expect(game.move(1, 0)).toBe(true);
    expect(game.inventory.count('leaves')).toBe(1);
  });

  it('builds the store crate with logs when there is not enough wood', () => {
    const game = sandbox(134);
    game.player.facing = 'right';
    game.inventory.add('log', 200);
    give(game, { rope: 2 });
    // The Build panel shows the logs, and building takes them.
    expect(game.recipeCost('store_crate')).toEqual({ log: 6, rope: 2 });
    expect(game.buildProblem('store_crate')).toBe(null);
    expect(game.build('store_crate')).toBe(true);
    expect(game.objectAt(game.player.x + 1, game.player.y)?.kind).toBe('store_crate');
    expect(game.inventory.count('log')).toBe(194);
    expect(game.inventory.count('rope')).toBe(0);
  });

  it('builds the store crate with wood first, and shows the wood when neither is there', () => {
    const game = sandbox(135);
    game.inventory.add('log', 6);
    expect(game.recipeCost('store_crate')).toEqual({ wood: 6, rope: 2 });
    expect(game.buildProblem('store_crate')).toEqual({ key: 'needMaterials' });
    give(game, { wood: 6, rope: 2 });
    expect(game.recipeCost('store_crate')).toEqual({ wood: 6, rope: 2 });
    game.player.facing = 'right';
    expect(game.build('store_crate')).toBe(true);
    expect(game.inventory.count('log')).toBe(6);
    expect(game.inventory.count('wood')).toBe(0);
  });

  it('lets one gather go a little over the limit', () => {
    const game = sandbox(132);
    game.inventory.add('stone', BAG_LOAD - 1);
    place(game, 1, 0, 'log_pile');
    expect(game.move(1, 0)).toBe(true);
    expect(game.load).toBeGreaterThan(BAG_LOAD);
  });

  it('builds one store crate on each island, and keeps things in it', () => {
    const game = sandbox(133);
    game.player.facing = 'right';
    give(game, RECIPES.store_crate.cost);
    expect(game.build('store_crate')).toBe(true);
    expect(game.objectAt(game.player.x + 1, game.player.y)?.kind).toBe('store_crate');
    give(game, RECIPES.store_crate.cost);
    expect(game.buildProblem('store_crate')).toEqual({ key: 'oneStore' });
    // Walking into it opens the Store panel; no time passes.
    const turn = game.turn;
    expect(game.move(1, 0)).toBe(false);
    expect(game.turn).toBe(turn);
    expect(game.takeStoreRequest()).toBe(true);
    game.inventory.add('stone', 20);
    game.inventory.add('coconut', 3);
    expect(game.storeItem('stone', 20)).toBe(true);
    expect(game.storeItem('coconut', 1)).toBe(true);
    expect(game.inventory.count('stone')).toBe(0);
    expect(game.storeNear()?.store).toEqual({ stone: 20, coconut: 1 });
    // Taking out stops at the carry limit.
    game.inventory.add('wood', BAG_LOAD - 5 - game.load);
    expect(game.takeItem('stone', 20)).toBe(true);
    expect(game.inventory.count('stone')).toBe(5);
    expect(game.storeNear()?.store).toEqual({ stone: 15, coconut: 1 });
    expect(game.takeItem('stone', 1)).toBe(false);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'tooHeavy' });
    expect(game.takeItem('coconut', 5)).toBe(true);
    expect(game.storeNear()?.store).toEqual({ stone: 15 });
    // The store keeps its things in the save.
    const loaded = Game.fromSave(JSON.parse(JSON.stringify(game.toSave())));
    expect(loaded.objectAt(loaded.player.x + 1, loaded.player.y)?.store).toEqual({ stone: 15 });
    // Away from the crate, nothing moves.
    game.player.x -= 3;
    expect(game.storeItem('wood', 1)).toBe(false);
  });

  it('builds the hut on a frame that takes its materials in trips', () => {
    const game = sandbox(134);
    game.player.facing = 'right';
    expect(game.buildProblem('hut')).toBe(null);
    expect(game.build('hut')).toBe(true);
    const x = game.player.x + 1;
    const y = game.player.y;
    expect(game.objectAt(x, y)?.kind).toBe('hut_site');
    expect(game.hasHut()).toBe(true);
    expect(game.buildProblem('hut')).toEqual({ key: 'oneHut' });
    expect(game.move(1, 0)).toBe(false);
    expect(game.log.at(-1)?.msg).toMatchObject({ key: 'siteNeeds', obj: 'hut_site' });
    // First trip: the logs.
    game.inventory.add('log', 24);
    const xp = game.xp;
    expect(game.move(1, 0)).toBe(true);
    expect(game.xp).toBe(xp + 24);
    expect(game.log.at(-1)?.msg).toMatchObject({ key: 'siteGive', given: [['log', 24]] });
    expect(game.siteLeft(x, y)).toEqual({ wood: 12, leaves: 30, stone: 20, rope: 8 });
    const loaded = Game.fromSave(JSON.parse(JSON.stringify(game.toSave())));
    expect(loaded.siteLeft(x, y)).toEqual({ wood: 12, leaves: 30, stone: 20, rope: 8 });
    // Second trip: the rest.
    give(game, { wood: 12, leaves: 30, stone: 20, rope: 8 });
    expect(game.move(1, 0)).toBe(true);
    expect(game.objectAt(x, y)?.kind).toBe('hut');
    expect(game.objectAt(x, y)?.given).toBeUndefined();
    expect(game.log.at(-1)?.msg).toEqual({ key: 'siteDone', obj: 'hut' });
    expect(game.move(1, 0)).toBe(true);
    expect(game.hutHere()?.kind).toBe('hut');
  });

  it('loads a version 9 save', () => {
    const game = sandbox(135);
    const old = { ...game.toSave(), v: 9 };
    expect(Game.fromSave(old).turn).toBe(game.turn);
  });
});

describe('Game: the fishing boat, voyages and kept islands', () => {
  /** A fresh rig, with the explorer next to its repaired fishing boat. */
  function atBoat(seed: number): { game: Game; dock: number } {
    const game = new Game(seed);
    (game as unknown as { landOn(level: number): void }).landOn(4);
    game.animals = [];
    const dock = [...game.objects].find(([, o]) => o.kind === 'fishing_boat_wreck')![0];
    game.objects.get(dock)!.kind = 'fishing_boat';
    const x = dock % game.map.width;
    game.player.x = x;
    game.player.y = (dock - x) / game.map.width - 1;
    game.takeEvents();
    return { game, dock };
  }

  it('has an old fishing boat at a dock of the rig, and a derrick to repair', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const game = new Game(seed);
      (game as unknown as { landOn(level: number): void }).landOn(4);
      const dock = [...game.objects].find(([, o]) => o.kind === 'fishing_boat_wreck')![0];
      const x = dock % game.map.width;
      const y = (dock - x) / game.map.width;
      expect(game.map.get(x, y)).toBe(Tile.Water);
      expect(game.map.get(x, y - 1)).toBe(Tile.Deck);
      expect([...game.objects.values()].filter((o) => o.kind === 'derrick')).toHaveLength(1);
    }
  });

  it('repairs the derrick, which then pumps diesel again and again', () => {
    const game = sandbox(140);
    place(game, 1, 0, 'derrick');
    give(game, { scrap: 12, rope: 2 });
    expect(game.move(1, 0)).toBe(true);
    expect(game.objectAt(game.player.x + 1, game.player.y)?.kind).toBe('derrick_working');
    expect(game.log.at(-1)?.msg).toEqual({ key: 'siteDone', obj: 'derrick_working' });
    expect(game.move(1, 0)).toBe(true);
    expect(game.inventory.count('diesel')).toBe(2);
    expect(game.move(1, 0)).toBe(false);
    game.turn += 121;
    expect(game.move(1, 0)).toBe(true);
    expect(game.inventory.count('diesel')).toBe(4);
  });

  it('repairs the old fishing boat; walking into it opens the sea chart', () => {
    const game = sandbox(141);
    place(game, 1, 0, 'fishing_boat_wreck');
    give(game, { scrap: 10, wood: 6, rope: 4 });
    expect(game.move(1, 0)).toBe(true);
    expect(game.objectAt(game.player.x + 1, game.player.y)?.kind).toBe('fishing_boat');
    const turn = game.turn;
    expect(game.move(1, 0)).toBe(false);
    expect(game.turn).toBe(turn);
    expect(game.takeChartRequest()).toBe(true);
    expect(game.boatNear()).toBe(true);
  });

  it('needs diesel to sail, takes it from the hold first, and the trip takes hours', () => {
    const { game } = atBoat(142);
    expect(game.voyageProblem(1)).toEqual({ key: 'needDiesel', n: VOYAGE_DIESEL });
    expect(game.voyageProblem(4)).toEqual({ key: 'hereAlready' });
    game.inventory.add('diesel', 1);
    game.hold = { diesel: 1, stone: 10 };
    const turn = game.turn;
    expect(game.voyage(1)).toBe(true);
    expect(game.level).toBe(1);
    expect(game.turn).toBe(turn + VOYAGE_TURNS);
    expect(game.inventory.count('diesel')).toBe(0);
    expect(game.hold).toEqual({ stone: 10 });
    expect(game.log.at(-1)?.msg).toEqual({ key: 'voyage', level: 1 });
    // The boat lies next to the explorer, in the sea.
    expect(game.boatNear()).toBe(true);
    expect(game.visited(4)).toBe(true);
  });

  it('keeps the islands as they were left, and moors at the same dock again', () => {
    const { game, dock } = atBoat(143);
    const rig = game.map;
    const mark = game.map.idx(game.player.x - 1, game.player.y);
    game.objects.set(mark, { kind: 'campfire' });
    game.inventory.add('diesel', 4);
    game.voyage(2);
    expect(game.level).toBe(2);
    expect(game.map).not.toBe(rig);
    // The island is kept: save and load it, then sail back to the rig.
    const loaded = Game.fromSave(JSON.parse(JSON.stringify(game.toSave())));
    expect(loaded.visited(4)).toBe(true);
    expect(loaded.voyage(4)).toBe(true);
    expect(loaded.level).toBe(4);
    expect(loaded.objects.get(mark)?.kind).toBe('campfire');
    expect(loaded.objects.get(dock)?.kind).toBe('fishing_boat');
    expect(loaded.visited(2)).toBe(true);
    expect(loaded.map.get(loaded.player.x, loaded.player.y)).toBe(Tile.Deck);
  });

  it('loads and unloads the hold, up to its limit for heavy things', () => {
    const { game } = atBoat(144);
    game.inventory.add('scrap', HOLD_LOAD + 5);
    game.inventory.add('mussels', 4);
    expect(game.loadItem('scrap', HOLD_LOAD + 5)).toBe(true);
    expect(game.hold.scrap).toBe(HOLD_LOAD);
    expect(game.loadItem('scrap', 1)).toBe(false);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'holdFull' });
    expect(game.loadItem('mussels', 4)).toBe(true);
    expect(game.holdLoad).toBe(HOLD_LOAD);
    expect(game.unloadItem('scrap', HOLD_LOAD)).toBe(true);
    expect(game.inventory.count('scrap')).toBe(BAG_LOAD);
    expect(game.hold.scrap).toBe(HOLD_LOAD - BAG_LOAD + 5);
  });

  it('remembers islands left on their goal: their goals are used up', () => {
    const game = sandbox(145);
    boatNextTo(game);
    for (const stage of LEVELS[0].stages) give(game, game.stageCost(stage));
    for (let k = 0; k < 4; k++) game.move(1, 0);
    expect(game.goal()).toEqual({ state: 'ready' });
    expect(game.sail()).toBe(true);
    expect(game.level).toBe(2);
    expect(game.left.has(1)).toBe(true);
    // Back on island 1 (as with the boat), the goal is used and the old boat is gone.
    game.jumpToIsland(1);
    expect(game.goal()).toEqual({ state: 'sailed' });
    expect([...game.objects.values()].some((o) => o.kind.startsWith('boat_'))).toBe(false);
  });

  it('after the radio call, only the rig counts as used', () => {
    const { game } = atBoat(147);
    game.sailed = true;
    expect(game.goalUsed).toBe(true);
    game.inventory.add('diesel', 2);
    game.voyage(2);
    expect(game.goalUsed).toBe(false);
    expect(game.goal().state).not.toBe('sailed');
  });

  it('loads a version 10 save on the rig: the islands before are left, and come back new', () => {
    const { game } = atBoat(146);
    const old = { ...game.toSave(), v: 10 } as Partial<ReturnType<Game['toSave']>>;
    delete old.islands;
    delete old.left;
    delete old.hold;
    const loaded = Game.fromSave(old as ReturnType<Game['toSave']>);
    expect([...loaded.left].sort()).toEqual([1, 2, 3]);
    expect(loaded.visited(1)).toBe(false);
    expect(loaded.hold).toEqual({});
  });
});

describe('Game: radio supply drops and new platforms', () => {
  function rigGame(seed: number): Game {
    const game = new Game(seed);
    (game as unknown as { landOn(level: number): void }).landOn(4);
    game.animals = [];
    game.dog = null;
    game.takeEvents();
    return game;
  }

  /** Put the explorer next to the working radio, after the call for help. */
  function atRadio(seed: number): Game {
    const game = rigGame(seed);
    const radio = [...game.objects].find(([, o]) => o.kind === 'radio_hut')![0];
    game.objects.get(radio)!.kind = 'radio_ready';
    game.sailed = true;
    const x = radio % game.map.width;
    const y = (radio - x) / game.map.width;
    const spot = [[0, 1], [1, 0], [-1, 0], [0, -1]].find(([dx, dy]) => game.isPassable(x + dx, y + dy))!;
    game.player.x = x + spot[0];
    game.player.y = y + spot[1];
    return game;
  }

  it('opens the Radio panel at the working radio after the call for help', () => {
    const game = atRadio(150);
    const radio = [...game.objects].find(([, o]) => o.kind === 'radio_ready')![0];
    const rx = radio % game.map.width;
    expect(game.move(rx - game.player.x, (radio - rx) / game.map.width - game.player.y)).toBe(false);
    expect(game.takeRadioRequest()).toBe(true);
    expect(game.takeSailRequest()).toBe(false);
  });

  it('orders one crate each day; the helicopter drops it on the helipad', () => {
    const game = atRadio(151);
    expect(game.orderProblem()).toBe(null);
    expect(game.order('build')).toBe(true);
    expect(game.orderProblem()).toEqual({ key: 'onTheWay' });
    // No crate while the explorer is away from the helipad, however long they wait.
    for (let k = 0; k < 40; k++) game.wait();
    expect(game.delivery).not.toBe(null);
    const [rx, ry] = [game.player.x, game.player.y];
    onHelipad(game);
    game.wait();
    expect(game.delivery).toBe(null);
    [game.player.x, game.player.y] = [rx, ry];
    const crate = [...game.objects].find(([, o]) => o.kind === 'supply_crate')!;
    expect(game.map.tiles[crate[0]]).toBe(Tile.Helipad);
    expect(crate[1].store).toEqual(RADIO_ORDERS.build);
    expect(game.log.some((e) => e.msg.key === 'delivered')).toBe(true);
    // Only one each day.
    expect(game.orderProblem()).toEqual({ key: 'orderedToday' });
    game.turn += TURNS_PER_DAY;
    expect(game.orderProblem()).toBe(null);
  });

  it('takes things out of the supply crate, and the empty crate is gone', () => {
    const game = rigGame(152);
    const { map, player: p } = game;
    map.set(p.x + 1, p.y, Tile.Helipad);
    game.objects.set(map.idx(p.x + 1, p.y), { kind: 'supply_crate', store: { coconut: 2, rope: 1 } });
    // The supply crate is not the island's store (the storage container is).
    for (const [i, o] of game.objects) if (o.kind.startsWith('storage_container')) game.objects.delete(i);
    expect(game.hasStore()).toBe(false);
    expect(game.takeItem('coconut', 2)).toBe(true);
    expect(game.objectAt(p.x + 1, p.y)?.kind).toBe('supply_crate');
    expect(game.takeItem('rope', 1)).toBe(true);
    expect(game.objectAt(p.x + 1, p.y)).toBeUndefined();
  });

  it('keeps the crate waiting while the explorer is away from the rig', () => {
    const game = atRadio(153);
    game.order('fuel');
    game.jumpToIsland(1);
    for (let k = 0; k < 40; k++) game.wait();
    expect(game.delivery).not.toBe(null);
    game.jumpToIsland(4);
    game.wait();
    expect(game.delivery).not.toBe(null);
    onHelipad(game);
    game.wait();
    expect(game.delivery).toBe(null);
    expect([...game.objects.values()].some((o) => o.kind === 'supply_crate')).toBe(true);
  });

  it('lays new deck at the edge of the crew platform, but not near gangways or out of range', () => {
    for (const seed of [154, 157, 158]) {
      const game = rigGame(seed);
      const { map, player: p } = game;
      const cabin = [...game.objects].find(([, o]) => o.kind === 'crew_cabin')![0];
      const cx = cabin % map.width;
      const cy = (cabin - cx) / map.width;
      give(game, { scrap: 12, wood: 4 });
      // Find a free deck cell at the platform's edge where a platform fits in front.
      let found = false;
      const sides = [['down', 0, 1], ['up', 0, -1], ['left', -1, 0], ['right', 1, 0]] as const;
      for (let y = cy - 6; y <= cy + 6 && !found; y++) {
        for (let x = cx - 6; x <= cx + 6 && !found; x++) {
          if (map.get(x, y) !== Tile.Deck || game.objectAt(x, y)) continue;
          for (const [facing, dx, dy] of sides) {
            if (map.get(x + dx, y + dy) !== Tile.Water) continue;
            p.x = x;
            p.y = y;
            p.facing = facing;
            if (game.buildProblem('platform') !== null) continue;
            const version = map.version;
            expect(game.build('platform')).toBe(true);
            expect(map.get(x + dx, y + dy)).toBe(Tile.Deck);
            expect(map.version).toBe(version + 1);
            expect(Math.max(Math.abs(x + dx - cx), Math.abs(y + dy - cy))).toBeLessThanOrEqual(PLATFORM_RANGE);
            expect(game.log.at(-1)?.msg).toEqual({ key: 'platformBuilt' });
            found = true;
            break;
          }
        }
      }
      expect(found).toBe(true);
      // Far from the cabin, on another platform's edge: no.
      const far = [...game.objects].find(([, o]) => o.kind === 'radio_hut')![0];
      p.x = far % map.width;
      p.y = (far - p.x) / map.width + 1;
      expect(game.buildProblem('platform')).toEqual({ key: 'noDeckSpot' });
    }
    // Next to a gangway: no.
    const game = rigGame(154);
    const g = sandboxRigEdge(game);
    expect(g.buildProblem('platform')).toEqual({ key: 'noDeckSpot' });
  });

  /** The same rig with a gangway right in front of the explorer at the crew platform's edge. */
  function sandboxRigEdge(game: Game): Game {
    const { map, player: p } = game;
    map.set(p.x, p.y + 1, Tile.Water);
    game.objects.set(map.idx(p.x + 1, p.y + 1), { kind: 'gangway_ns' });
    give(game, { scrap: 6, wood: 2 });
    return game;
  }

  it('builds a rain tank to drink from', () => {
    const game = rigGame(155);
    const { map, player: p } = game;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      map.set(p.x + dx, p.y + dy, Tile.Deck);
      game.objects.delete(map.idx(p.x + dx, p.y + dy));
    }
    game.player.facing = 'right';
    give(game, { scrap: 6 });
    expect(game.build('rain_tank')).toBe(true);
    expect(game.objectAt(p.x + 1, p.y)?.kind).toBe('water_tank');
  });

  it('keeps an order in the save, and loads a version 11 save', () => {
    const game = atRadio(156);
    game.order('food');
    const loaded = Game.fromSave(JSON.parse(JSON.stringify(game.toSave())));
    expect(loaded.delivery?.order).toBe('food');
    expect(loaded.orderDay).toBe(game.orderDay);
    const old = { ...game.toSave(), v: 11 } as Partial<ReturnType<Game['toSave']>>;
    delete old.delivery;
    delete old.orderDay;
    const older = Game.fromSave(old as ReturnType<Game['toSave']>);
    expect(older.delivery).toBe(null);
  });
});

describe('Game: the rig workshop', () => {
  function rigGame(seed: number): Game {
    const game = new Game(seed);
    (game as unknown as { landOn(level: number): void }).landOn(4);
    game.animals = [];
    game.dog = null;
    const { map, player: p } = game;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      map.set(p.x + dx, p.y + dy, Tile.Deck);
      game.objects.delete(map.idx(p.x + dx, p.y + dy));
    }
    game.takeEvents();
    return game;
  }

  it('puts ore veins on island 2, clay banks on island 1 and sealed crates on islands 1 to 3', () => {
    const count = (game: Game, kind: string) => [...game.objects.values()].filter((o) => o.kind === kind).length;
    const one = new Game(160);
    expect(count(one, 'clay_bank')).toBeGreaterThan(0);
    expect(count(one, 'sealed_crate')).toBe(4);
    one.jumpToIsland(2);
    expect(count(one, 'ore_vein')).toBeGreaterThan(0);
    expect(count(one, 'sealed_crate')).toBe(4);
    for (const [i, o] of one.objects) {
      if (o.kind !== 'ore_vein') continue;
      const x = i % one.map.width;
      expect(one.map.get(x, (i - x) / one.map.width)).toBe(Tile.Scree);
    }
    one.jumpToIsland(4);
    expect(count(one, 'sealed_crate')).toBe(0);
  });

  it('gives each island its resources only once, also an island from an older save', () => {
    const game = new Game(161);
    const save = { ...game.toSave(), v: 12 } as Partial<ReturnType<Game['toSave']>>;
    delete save.holdUpgrades;
    delete save.stocked;
    save.objects = save.objects!.filter(([, kind]) => kind !== 'clay_bank' && kind !== 'sealed_crate');
    const loaded = Game.fromSave(save as ReturnType<Game['toSave']>);
    expect([...loaded.objects.values()].filter((o) => o.kind === 'sealed_crate')).toHaveLength(4);
    const again = Game.fromSave(JSON.parse(JSON.stringify(loaded.toSave())));
    expect([...again.objects.values()].filter((o) => o.kind === 'sealed_crate')).toHaveLength(4);
  });

  it('needs the right tool for ore veins, clay banks and sealed crates', () => {
    const game = sandbox(162);
    place(game, 1, 0, 'ore_vein');
    expect(game.move(1, 0)).toBe(false);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'needTool', obj: 'ore_vein', item: 'pickaxe' });
    give(game, { scrap: 4, wood: 2 });
    expect(game.build('pickaxe')).toBe(true);
    expect(game.move(1, 0)).toBe(true);
    expect(game.inventory.count('iron_ore')).toBeGreaterThanOrEqual(1);
    place(game, 0, 1, 'sealed_crate');
    give(game, { scrap: 3 });
    expect(game.build('crowbar')).toBe(true);
    expect(game.move(0, 1)).toBe(true);
    expect(game.inventory.count('spare_part')).toBe(1);
    expect(game.objectAt(game.player.x, game.player.y + 1)).toBeUndefined();
  });

  it('builds rig buildings only on the rig', () => {
    const island = sandbox(163);
    give(island, { clay: 12, stone: 6 });
    expect(island.buildProblem('furnace')).toEqual({ key: 'rigOnly' });
    const game = rigGame(163);
    give(game, { clay: 12, stone: 6 });
    game.player.facing = 'right';
    expect(game.build('furnace')).toBe(true);
    expect(game.objectAt(game.player.x + 1, game.player.y)?.kind).toBe('furnace');
  });

  it('smelts steel plates next to the furnace only', () => {
    const game = rigGame(164);
    give(game, { iron_ore: 4, coal: 2 });
    expect(game.buildProblem('smelt')).toEqual({ key: 'needFurnace' });
    place(game, 1, 0, 'furnace');
    expect(game.build('smelt')).toBe(true);
    expect(game.inventory.count('steel_plate')).toBe(1);
    expect(game.inventory.count('iron_ore')).toBe(2);
  });

  it('grows vegetables in the greenhouse, and makes water from the sea', () => {
    const game = rigGame(165);
    place(game, 1, 0, 'greenhouse');
    expect(game.move(1, 0)).toBe(true);
    expect(game.inventory.count('vegetables')).toBeGreaterThanOrEqual(2);
    expect(game.move(1, 0)).toBe(false);
    game.turn += 121;
    expect(game.move(1, 0)).toBe(true);
    place(game, -1, 0, 'water_maker');
    game.needs.water = 30;
    expect(game.move(-1, 0)).toBe(true);
    expect(game.needs.water).toBeGreaterThan(60);
  });

  it('builds a fish trap on the sea in front of a deck, and it catches fish', () => {
    const game = rigGame(166);
    const { map, player: p } = game;
    map.set(p.x + 1, p.y, Tile.Water);
    game.player.facing = 'right';
    give(game, { steel_plate: 2, rope: 2 });
    expect(game.build('fish_trap')).toBe(true);
    expect(game.objectAt(p.x + 1, p.y)?.kind).toBe('fish_trap');
    expect(game.move(1, 0)).toBe(true);
    expect(game.inventory.count('fish')).toBeGreaterThanOrEqual(1);
    // No sea next to the explorer: no trap.
    map.set(p.x + 1, p.y, Tile.Deck);
    game.objects.delete(map.idx(p.x + 1, p.y));
    give(game, { steel_plate: 2, rope: 2 });
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0]]) map.set(p.x + dx, p.y + dy, Tile.Deck);
    expect(game.buildProblem('fish_trap')).toEqual({ key: 'noSeaSpot' });
  });

  it('makes the hold bigger next to the boat, two times', () => {
    const game = rigGame(167);
    const { map, player: p } = game;
    map.set(p.x, p.y + 1, Tile.Water);
    game.objects.set(map.idx(p.x, p.y + 1), { kind: 'fishing_boat' });
    for (let k = 0; k < 3; k++) give(game, { steel_plate: 4, spare_part: 2 });
    expect(game.holdLimit).toBe(HOLD_LOAD);
    expect(game.build('hold_upgrade')).toBe(true);
    expect(game.holdLimit).toBe(HOLD_LOAD + HOLD_UPGRADE);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'holdUpgraded', limit: HOLD_LOAD + HOLD_UPGRADE });
    expect(game.build('hold_upgrade')).toBe(true);
    expect(game.buildProblem('hold_upgrade')).toEqual({ key: 'holdMax' });
    expect(Game.fromSave(JSON.parse(JSON.stringify(game.toSave()))).holdLimit).toBe(HOLD_LOAD + 2 * HOLD_UPGRADE);
    // Away from the boat, the hold cannot be changed.
    const other = rigGame(168);
    give(other, { steel_plate: 4, spare_part: 2 });
    expect(other.buildProblem('hold_upgrade')).toEqual({ key: 'noBoat' });
  });
});

describe('Game: the crew cabin is the camp on the rig', () => {
  function inCabin(seed: number): Game {
    const game = new Game(seed);
    (game as unknown as { landOn(level: number): void }).landOn(4);
    game.animals = [];
    game.dog = null;
    const cabin = [...game.objects].find(([, o]) => o.kind === 'crew_cabin')![0];
    const x = cabin % game.map.width;
    game.player.x = x;
    game.player.y = (cabin - x) / game.map.width + 1;
    game.objects.delete(game.map.idx(game.player.x, game.player.y));
    game.move(0, -1);
    return game;
  }

  it('goes inside, like a hut, and has a bed that heals faster', () => {
    const game = inCabin(170);
    expect(game.hutHere()?.kind).toBe('crew_cabin');
    expect(game.takeHutRequest()).toBe(true);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'enterHut', obj: 'crew_cabin' });
    expect(game.hasHut()).toBe(true);
    give(game, { log: 24, wood: 12, leaves: 30, stone: 20, rope: 8 });
    expect(game.buildProblem('hut')).toEqual({ key: 'oneHut' });
    game.needs.health = 50;
    game.needs.energy = 20;
    game.needs.food = game.needs.water = 100;
    game.turn = nightTurn();
    game.sleep();
    expect(game.needs.health).toBeGreaterThan(80);
  });

  it('takes rooms, and with Cartographer its wall has the map', () => {
    const game = inCabin(171);
    give(game, ROOMS.hearth.cost);
    expect(game.addRoom('hearth')).toBe(true);
    expect(game.hutHere()?.rooms).toEqual(['hearth']);
    expect(game.log.map((e) => e.msg)).toContainEqual({ key: 'roomBuilt', room: 'hearth', cabin: true });
    expect(game.canReadMap()).toBe(false);
    game.skills.add('cartographer');
    expect(game.canReadMap()).toBe(true);
  });

  it('a supply drop sends the helicopter (an event for the UI)', () => {
    const game = inCabin(172);
    const radio = [...game.objects].find(([, o]) => o.kind === 'radio_hut')![0];
    game.objects.get(radio)!.kind = 'radio_ready';
    game.sailed = true;
    game.delivery = { order: 'food' };
    game.takeEvents();
    game.wait();
    expect(game.takeEvents().some((e) => e.type === 'drop')).toBe(false);
    onHelipad(game);
    game.wait();
    const drop = game.takeEvents().find((e) => e.type === 'drop');
    expect(drop).toBeDefined();
    expect(game.objectAt((drop as { x: number }).x, (drop as { y: number }).y)?.kind).toBe('supply_crate');
  });
});

/** Put the explorer on the middle of the helipad. */
function onHelipad(game: Game): void {
  const i = game.map.tiles.findIndex((t, i) => t === Tile.Helipad && game.map.tiles[i + 1] === Tile.Helipad && game.map.tiles[i - 1] === Tile.Helipad);
  game.player.x = i % game.map.width;
  game.player.y = (i - game.player.x) / game.map.width;
}

function give(game: Game, cost: Partial<Record<Parameters<Game['inventory']['add']>[0], number>>): void {
  for (const [item, n] of Object.entries(cost)) game.inventory.add(item as Parameters<Game['inventory']['add']>[0], n);
}

function sandbox(seed: number): Game {
  const game = new Game(seed);
  const { map } = game;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const x = game.player.x + dx;
      const y = game.player.y + dy;
      map.set(x, y, Tile.Sand);
      game.objects.delete(map.idx(x, y));
    }
  }
  game.animals = [];
  game.takeEvents();
  return game;
}

function place(game: Game, dx: number, dy: number, kind: Parameters<Game['objects']['set']>[1]['kind']): void {
  game.objects.set(game.map.idx(game.player.x + dx, game.player.y + dy), { kind });
}

/** Move the island's boat to just east of the explorer, where they can see it. */
function boatNextTo(game: Game): Game {
  for (const [i, o] of game.objects) if (o.kind.startsWith('boat_')) game.objects.delete(i);
  place(game, 1, 0, 'boat_wreck');
  game.map.explored[game.map.idx(game.player.x + 1, game.player.y)] = 1;
  return game;
}

/** A river `width` cells wide just east of the explorer, running north–south. */
function river(game: Game, width = 2): void {
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = 1; dx <= width; dx++) game.map.set(game.player.x + dx, game.player.y + dy, Tile.River);
    game.map.set(game.player.x + width + 1, game.player.y + dy, Tile.Sand);
    game.objects.delete(game.map.idx(game.player.x + width + 1, game.player.y + dy));
  }
}

describe('Game: the storage container on the rig', () => {
  function rigGame(seed: number): Game {
    const game = new Game(seed);
    (game as unknown as { landOn(level: number): void }).landOn(4);
    game.animals = [];
    game.dog = null;
    game.takeEvents();
    return game;
  }

  /** The cells of the container's pieces, by kind. */
  function pieces(game: Game): Map<string, { x: number; y: number }[]> {
    const out = new Map<string, { x: number; y: number }[]>();
    for (const [i, o] of game.objects) {
      if (!o.kind.startsWith('storage_container')) continue;
      const x = i % game.map.width;
      out.set(o.kind, [...(out.get(o.kind) ?? []), { x, y: (i - x) / game.map.width }]);
    }
    return out;
  }

  /** Put the explorer on a free deck cell next to (x, y), and return the step into it. */
  function standNextTo(game: Game, x: number, y: number): [number, number] {
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
      if (game.map.get(x + dx, y + dy) === Tile.Deck && !game.objectAt(x + dx, y + dy)) {
        game.player.x = x + dx;
        game.player.y = y + dy;
        return [-dx, -dy];
      }
    }
    throw new Error('no free deck next to the container');
  }

  it('stands on every rig: 6 × 2 cells of deck, and the whole rig stays reachable', () => {
    for (let seed = 400; seed < 416; seed++) {
      const game = rigGame(seed);
      const found = pieces(game);
      const main = found.get('storage_container_0');
      expect(main, `seed ${seed}`).toHaveLength(1);
      const { x, y } = main![0];
      for (let dx = 0; dx < STORAGE_WIDTH; dx++) {
        expect(game.objectAt(x + dx, y)?.kind).toBe(`storage_container_${dx}`);
        expect(game.objectAt(x + dx, y - 1)?.kind).toBe('storage_container_back');
        expect(game.map.get(x + dx, y)).toBe(Tile.Deck);
        expect(game.map.get(x + dx, y - 1)).toBe(Tile.Deck);
      }
      expect(found.get('storage_container_back')).toHaveLength(STORAGE_WIDTH);
      expect((game as unknown as { allReachableFrom(x: number, y: number): boolean }).allReachableFrom(game.home.x, game.home.y)).toBe(true);
    }
  });

  it('moves loose things out of the way on a full rig, and keeps every one of them', () => {
    const game = rigGame(446);
    for (const [i, o] of game.objects) if (o.kind.startsWith('storage_container')) game.objects.delete(i);
    // Single scrap piles on every third cell of every other row (where they block no way): no clean 6 × 2 room is left.
    const { map } = game;
    const reachable = () => (game as unknown as { allReachableFrom(x: number, y: number): boolean }).allReachableFrom(game.home.x, game.home.y);
    for (let i = 0; i < map.tiles.length; i++) {
      const x = i % map.width;
      const y = (i - x) / map.width;
      if (map.tiles[i] !== Tile.Deck || game.objects.has(i) || (x === game.player.x && y === game.player.y)) continue;
      if (x % 3 !== 0 || y % 2 !== 0) continue;
      game.objects.set(i, { kind: 'scrap_pile' });
      if (!reachable()) game.objects.delete(i);
    }
    const loose = ['scrap_pile', 'pallet', 'old_net', 'chest_closed', 'chest_open', 'diesel_drums', 'diesel_drums_empty'];
    const looseCells = () => [...game.objects].filter(([, o]) => loose.includes(o.kind)).map(([i, o]) => `${o.kind}@${i}`).sort();
    const before = looseCells();
    (game as unknown as { placeStorage(): void }).placeStorage();
    expect(pieces(game).get('storage_container_0')).toHaveLength(1);
    const after = looseCells();
    expect(after.map((c) => c.split('@')[0])).toEqual(before.map((c) => c.split('@')[0]));
    expect(after).not.toEqual(before);
    expect(reachable()).toBe(true);
  });

  it('is not on islands 1 to 3', () => {
    const game = new Game(441);
    expect(pieces(game).size).toBe(0);
  });

  it('opens from any of its cells, and all of them share one store', () => {
    const game = rigGame(442);
    const { x, y } = pieces(game).get('storage_container_0')![0];
    // Walk into the right end of the front row: the Store panel opens, no time passes.
    const [dx, dy] = standNextTo(game, x + STORAGE_WIDTH - 1, y);
    const turn = game.turn;
    expect(game.move(dx, dy)).toBe(false);
    expect(game.turn).toBe(turn);
    expect(game.takeStoreRequest()).toBe(true);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'openStore', container: true });
    game.inventory.add('log', 200);
    expect(game.storeItem('log', 200)).toBe(true);
    expect(game.inventory.count('log')).toBe(0);
    // From another side (the back row or the left end), the same logs are there.
    const other = [...Array(STORAGE_WIDTH).keys()].map((dx) => ({ x: x + dx, y: y - 1 })).concat([{ x, y }])
      .find((c) => [[0, -1], [-1, 0], [1, 0]].some(([ox, oy]) => game.map.get(c.x + ox, c.y + oy) === Tile.Deck && !game.objectAt(c.x + ox, c.y + oy)))!;
    const [bx, by] = standNextTo(game, other.x, other.y);
    expect(game.move(bx, by)).toBe(false);
    expect(game.takeStoreRequest()).toBe(true);
    expect(game.storeNear()?.kind).toBe('storage_container_0');
    expect(game.takeItem('log', 5)).toBe(true);
    expect(game.objectAt(x, y)?.store).toEqual({ log: 195 });
  });

  it('counts as the store of the rig, and the full bag points to it', () => {
    const game = rigGame(443);
    give(game, RECIPES.store_crate.cost);
    expect(game.buildProblem('store_crate')).toEqual({ key: 'oneStore' });
    const { x, y } = pieces(game).get('storage_container_0')![0];
    standNextTo(game, x, y);
    game.inventory.add('log', BAG_LOAD + 10);
    expect(game.storeItem('log', 10)).toBe(true);
    expect(game.takeItem('log', 1)).toBe(false);
    expect(game.log.at(-1)?.msg).toEqual({ key: 'tooHeavy', container: true });
  });

  it('comes to rigs in running games, and keeps its things in the save and while the explorer is away', () => {
    const game = rigGame(444);
    // A rig from before the container: take it away again.
    for (const [i, o] of game.objects) if (o.kind.startsWith('storage_container')) game.objects.delete(i);
    const old = JSON.parse(JSON.stringify(game.toSave()));
    const loaded = Game.fromSave(old);
    expect(pieces(loaded).get('storage_container_0')).toHaveLength(1);
    expect(loaded.toSave().v).toBe(SAVE_VERSION);
    // Fill it, save, load: still one container, with its things.
    const { x, y } = pieces(loaded).get('storage_container_0')![0];
    standNextTo(loaded, x, y);
    loaded.inventory.add('stone', 12);
    expect(loaded.storeItem('stone', 12)).toBe(true);
    const again = Game.fromSave(JSON.parse(JSON.stringify(loaded.toSave())));
    expect(pieces(again).get('storage_container_0')).toHaveLength(1);
    expect(again.objectAt(x, y)?.store).toEqual({ stone: 12 });
    // Away on island 1 and back: the rig is kept as it was.
    again.jumpToIsland(1);
    expect(pieces(again).size).toBe(0);
    again.jumpToIsland(4);
    expect(again.objectAt(x, y)?.store).toEqual({ stone: 12 });
    expect(pieces(again).get('storage_container_0')).toHaveLength(1);
  });

  it('comes to a kept rig from before when the explorer lands there again', () => {
    const game = rigGame(445);
    for (const [i, o] of game.objects) if (o.kind.startsWith('storage_container')) game.objects.delete(i);
    game.jumpToIsland(1);
    game.jumpToIsland(4);
    expect(pieces(game).get('storage_container_0')).toHaveLength(1);
  });
});

function nightTurn(): number {
  return Array.from({ length: TURNS_PER_DAY }, (_, t) => t).find((t) => isNight(t) && !isNight(t - 10))!;
}
