import { describe, expect, it } from 'vitest';
import { buildSprites, grassTileName, riverBankTileName, shoreTileName } from '../sprites';
import { daylight, isNight, phase, turnsUntilMorning, TURNS_PER_DAY } from './clock';
import { computeFov } from './fov';
import { pointsForXp, xpForPoints } from './defs/skills';
import { Game, SAVE_VERSION } from './game';
import { Tile } from './map';
import { freshNeeds, tickNeeds, warmthTarget } from './needs';
import { distanceMap, reachWithBridges } from './pathing';
import { Rng } from './rng';
import { generateWorld, NO_REGION } from './worldgen';

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
    expect(n.water).toBeLessThan(n.food);
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
    expect(game.needs.food).toBeGreaterThan(40);
    expect(game.needs.water).toBeGreaterThan(40);
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

  it('brambles and rivers do not stop you building a campfire', () => {
    const game = new Game(20);
    game.inventory.add('wood', 3);
    game.inventory.add('stone', 2);
    expect(game.build('campfire')).toBe(true);
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
    expect(game.needs.health).toBeGreaterThan(50);
    expect(game.phase).toBe('dawn');
    expect(game.log.some((m) => m.msg.key === 'wakeAtCamp')).toBe(true);
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
    for (let i = 0; i < 20; i++) expect(game.move(-1, 0)).toBe(true);
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
    expect(game.objectAt(game.player.x + 1, game.player.y)!.readyAt).toBe(game.turn - 1 + 84);
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
