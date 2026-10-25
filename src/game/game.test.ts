import { describe, expect, it } from 'vitest';
import { buildSprites, grassTileName, shoreTileName } from '../sprites';
import { daylight, isNight, phase, turnsUntilMorning, TURNS_PER_DAY } from './clock';
import { computeFov } from './fov';
import { Game } from './game';
import { Tile } from './map';
import { freshNeeds, tickNeeds, warmthTarget } from './needs';
import { distanceMap } from './pathing';
import { Rng } from './rng';
import { generateWorld } from './worldgen';

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

  it('makes one island where every bit of ground can be reached', () => {
    for (const { map, start, objects } of worlds) {
      const passable = (x: number, y: number) => {
        const o = objects.get(map.idx(x, y));
        return map.isFloor(x, y) && (!o || o.kind === 'lean_to' || o.kind === 'hut');
      };
      const dist = distanceMap(map, start.x, start.y, passable);
      for (let i = 0; i < map.tiles.length; i++) {
        const x = i % map.width;
        const y = (i - x) / map.width;
        if (passable(x, y)) expect(dist[i], `cell ${x},${y}`).toBeGreaterThanOrEqual(0);
      }
      for (let x = 0; x < map.width; x++) expect(map.isLand(x, 0)).toBe(false);
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
          if (t === Tile.Water) continue;
          const water = (dx: number, dy: number) => !map.isLand(x + dx, y + dy);
          expect(water(0, -1) && water(0, 1)).toBe(false);
          expect(water(-1, 0) && water(1, 0)).toBe(false);
          expect(sprites.has(shoreTileName(water))).toBe(true);
          if (t === Tile.Grass) {
            const sand = (dx: number, dy: number) => map.get(x + dx, y + dy) === Tile.Sand;
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
    expect(game.buildProblem('campfire')).toMatch(/materials/);
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
    expect(game.log.at(-1)?.text).toMatch(/cold/);
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
    expect(game.log.some((m) => /wake up back at camp/.test(m.text))).toBe(true);
  });

  it('a grumpy crab pinches when you linger, but never fatally', () => {
    const game = sandbox(10);
    game.needs.health = 3;
    game.animals = [{ id: 99, kind: 'crab', x: game.player.x + 1, y: game.player.y, facing: 'down', flee: 0 }];
    for (let i = 0; i < 20; i++) game.wait();
    expect(game.log.some((m) => /pinched/.test(m.text))).toBe(true);
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

describe('Game: saving', () => {
  it('round-trips through JSON', () => {
    const game = sandbox(12);
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
    expect(game.takeEvents().some((e) => e.type === 'float' && /stone/.test(e.text))).toBe(true);
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

function nightTurn(): number {
  return Array.from({ length: TURNS_PER_DAY }, (_, t) => t).find((t) => isNight(t) && !isNight(t - 10))!;
}
