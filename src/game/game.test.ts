import { describe, expect, it } from 'vitest';
import { buildSprites, grassScreeTileName, grassTileName, riverBankTileName, shoreTileName, snowTileName } from '../sprites';
import { daylight, isNight, phase, turnsUntilMorning, TURNS_PER_DAY } from './clock';
import { computeFov } from './fov';
import { ANIMALS } from './defs/animals';
import { canBeOpened, OBJECTS, type ObjectKind } from './defs/objects';
import { LEVELS } from './defs/levels';
import { pointsForXp, SKILLS, xpForPoints } from './defs/skills';
import { Game, SAVE_VERSION } from './game';
import { Tile } from './map';
import { freshNeeds, tickNeeds, warmthTarget } from './needs';
import { distanceMap, reachWithBridges } from './pathing';
import { Rng } from './rng';
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
      const passable = (x: number, y: number) => {
        const o = objects.get(map.idx(x, y));
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

  it('builds the beacon in three stages, and lighting it ends the game', () => {
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
    const beaconLight = () => game.lights().some(([x, y]) => game.map.idx(x, y) === at);
    expect(beaconLight()).toBe(false);
    expect(game.sail()).toBe(true);
    expect(beaconLight()).toBe(true);
    expect(game.level).toBe(2);
    expect(game.sailed).toBe(true);
    expect(game.goal()).toEqual({ state: 'sailed' });
    expect(game.log.at(-1)?.msg).toEqual({ key: 'sailAway', level: 2 });
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
    game.needs.energy = 50;
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
    game.inventory.add('wood', 10);
    game.inventory.add('leaves', 8);
    game.inventory.add('stone', 4);
    game.player.facing = 'right';
    game.build('hut');
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
    expect(game.log.at(-1)?.msg).toEqual({ key: 'goalNeeds', stage: 'hull', left: [['wood', 20], ['stone', 6]] });

    game.inventory.add('wood', 12);
    game.inventory.add('coconut', 3);
    const xp = game.xp;
    game.takeEvents();
    expect(game.move(1, 0)).toBe(true);
    expect(game.inventory.count('wood')).toBe(0);
    expect(game.inventory.count('coconut')).toBe(3 + 2);
    expect(game.goalGiven).toEqual({ wood: 12 });
    expect(game.xp).toBe(xp + 12);
    expect(game.takeEvents()).toContainEqual(expect.objectContaining({ type: 'float', amount: -12, what: { item: 'wood' } }));
    expect(game.log.at(-1)?.msg).toEqual({ key: 'goalGive', stage: 'hull', given: [['wood', 12]], left: [['wood', 8], ['stone', 6]] });

    game.inventory.add('wood', 30);
    game.inventory.add('stone', 6);
    game.move(1, 0);
    expect(game.objectAt(game.player.x + 1, game.player.y)?.kind).toBe('boat_hull');
    expect(game.inventory.count('wood')).toBe(22);
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
    expect(copy.goal()).toMatchObject({ state: 'build', left: { wood: 15, stone: 6 } });
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

  it('the axe gets an extra piece of wood from trees', () => {
    const game = sandbox(16);
    place(game, 1, 0, 'tree_pine');
    game.inventory.add('axe');
    game.move(1, 0);
    expect(game.inventory.count('wood')).toBeGreaterThanOrEqual(2);
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
    game.inventory.add('wood', 12);
    game.inventory.add('leaves', 6);
    game.player.facing = 'up';
    expect(game.buildProblem('bridge')).toEqual({ key: 'noBridgeSpot' });
    game.player.facing = 'right';
    expect(game.build('bridge')).toBe(true);
    const { x, y } = game.player;
    expect(game.objectAt(x + 1, y)?.kind).toBe('bridge_ew');
    expect(game.objectAt(x + 2, y)?.kind).toBe('bridge_ew');
    expect(game.inventory.count('wood')).toBe(6);
    for (let i = 0; i < 3; i++) expect(game.move(1, 0)).toBe(true);
    expect(game.player.x).toBe(x + 3);
  });

  it('a river too wide for one bridge cannot be bridged', () => {
    const game = sandbox(19);
    river(game, 4);
    game.inventory.add('wood', 6);
    game.inventory.add('leaves', 3);
    game.player.facing = 'right';
    expect(game.build('bridge')).toBe(false);
    expect(game.inventory.count('wood')).toBe(6);
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

  it('a cave bear swipes hard if you stay next to it', () => {
    const game = sandbox(44);
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

function nightTurn(): number {
  return Array.from({ length: TURNS_PER_DAY }, (_, t) => t).find((t) => isNight(t) && !isNight(t - 10))!;
}
