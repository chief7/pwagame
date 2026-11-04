import { describe, expect, it } from 'vitest';
import { minuteOfDay, TURNS_PER_DAY } from './clock';
import type { LevelId } from './defs/levels';
import type { ObjectKind } from './defs/objects';
import { Game, RAIN_CHILL, SAVE_VERSION } from './game';
import { Tile } from './map';
import { warmthTarget } from './needs';
import { CLOUDS_BEFORE, dayWeather, forecast, weatherAt, type Weather } from './weather';

function sandbox(seed: number, tile: Tile = Tile.Sand): Game {
  const game = new Game(seed);
  const { map } = game;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const x = game.player.x + dx;
      const y = game.player.y + dy;
      map.set(x, y, tile);
      game.objects.delete(map.idx(x, y));
    }
  }
  game.animals = [];
  game.dog = null;
  game.takeEvents();
  return game;
}

function place(game: Game, dx: number, dy: number, kind: ObjectKind): void {
  game.objects.set(game.map.idx(game.player.x + dx, game.player.y + dy), { kind });
}

/** The first turn from `from` on with this weather, right after a change (so it lasts a while). */
function firstTurn(game: Game, w: Weather, from = game.turn): number {
  for (let t = from + 1; t < from + 60 * TURNS_PER_DAY; t++) {
    if (weatherAt(game.seed, game.level, t) === w && weatherAt(game.seed, game.level, t - 1) !== w) return t;
  }
  throw new Error(`no ${w} found`);
}

/** Put the game one turn before this weather starts: the next turn brings it. */
function justBefore(game: Game, w: Weather): void {
  game.turn = firstTurn(game, w) - 1;
}

function rigGame(seed: number): Game {
  const game = new Game(seed);
  (game as unknown as { landOn(level: number): void }).landOn(4);
  game.animals = [];
  game.dog = null;
  game.takeEvents();
  return game;
}

describe('weather schedule', () => {
  it('is the same for the same seed, island and day', () => {
    for (let day = 1; day < 40; day++) expect(dayWeather(7, 1, day)).toEqual(dayWeather(7, 1, day));
    const days = (seed: number) => Array.from({ length: 30 }, (_, i) => dayWeather(seed, 1, i + 2).kind).join();
    expect(days(7)).not.toBe(days(8));
  });

  it('keeps the first day dry, rains only by day, and brings clouds an hour before', () => {
    for (const level of [1, 2, 3, 4] as LevelId[]) {
      expect(dayWeather(3, level, 1).kind).toBe('clear');
      let rainy = 0;
      for (let day = 2; day < 60; day++) {
        const w = dayWeather(3, level, day);
        if (w.kind === 'clear') continue;
        rainy++;
        expect(w.start).toBeGreaterThanOrEqual(9 * 60);
        expect(w.end).toBeLessThanOrEqual(20 * 60);
        expect(w.end - w.start).toBeGreaterThanOrEqual(60);
      }
      // Most days, but not every day.
      expect(rainy).toBeGreaterThan(15);
      expect(rainy).toBeLessThan(55);
    }
    const game = new Game(5);
    const rain = firstTurn(game, 'rain');
    expect(weatherAt(game.seed, 1, rain - 1)).toBe('clouds');
    expect(weatherAt(game.seed, 1, rain - CLOUDS_BEFORE / 6)).toBe('clouds');
    expect(weatherAt(game.seed, 1, rain - CLOUDS_BEFORE / 6 - 1)).toBe('clear');
    for (let t = 0; t < 30 * TURNS_PER_DAY; t++) {
      const w = weatherAt(game.seed, 1, t);
      if (w === 'rain') expect(minuteOfDay(t)).toBeGreaterThanOrEqual(9 * 60);
    }
  });

  it('brings storms only to the oil rig', () => {
    const kinds = (level: LevelId) => new Set(Array.from({ length: 80 }, (_, i) => dayWeather(11, level, i + 2).kind));
    for (const level of [1, 2, 3] as LevelId[]) expect(kinds(level).has('storm')).toBe(false);
    expect(kinds(4).has('storm')).toBe(true);
  });

  it('reports today and tomorrow', () => {
    const [today, tomorrow] = forecast(9, 4, 3 * TURNS_PER_DAY);
    expect(today.day + 1).toBe(tomorrow.day);
    expect(today).toEqual(dayWeather(9, 4, today.day));
  });
});

describe('needs: warm clothes', () => {
  it('raise the Warmth target out in the open', () => {
    const night = { sleeping: false, shelter: 0, nearFire: false, daylight: 0 };
    expect(warmthTarget(night)).toBe(5);
    expect(warmthTarget({ ...night, warm: 0.35 })).toBeCloseTo(38.25);
    expect(warmthTarget({ ...night, daylight: 1, cold: 40, warm: 0.35 })).toBeCloseTo(74);
    // A hut is warm anyway.
    expect(warmthTarget({ ...night, shelter: 1, warm: 0.35 })).toBe(100);
  });
});

describe('Game: rain', () => {
  it('says when clouds come, when the rain starts and when it stops', () => {
    const game = sandbox(20);
    justBefore(game, 'clouds');
    game.wait();
    expect(game.weather).toBe('clouds');
    expect(game.log.at(-1)?.msg).toEqual({ key: 'weather', w: 'clouds', level: 1 });
    while (game.weather === 'clouds') game.wait();
    expect(game.log.some((m) => m.msg.key === 'weather' && m.msg.w === 'rain')).toBe(true);
    while (game.weather === 'rain') game.wait();
    expect(game.log.some((m) => m.msg.key === 'weather' && m.msg.w === 'clear' && m.msg.was === 'rain')).toBe(true);
  });

  it('makes you a little cold in the open, but not in the leaf cape or a hut', () => {
    const wet = sandbox(21);
    justBefore(wet, 'rain');
    for (let i = 0; i < 15; i++) wet.wait();
    expect(wet.raining).toBe(true);
    expect(wet.needs.warmth).toBeLessThan(100);
    expect(wet.needs.warmth).toBeGreaterThanOrEqual(100 - RAIN_CHILL);

    const dry = sandbox(21);
    dry.inventory.add('leaf_cape');
    justBefore(dry, 'rain');
    for (let i = 0; i < 15; i++) dry.wait();
    expect(dry.needs.warmth).toBe(100);
  });

  it('gives a little Water out in the open, and waters the plants', () => {
    const game = sandbox(22);
    place(game, 1, 0, 'berry_bush');
    game.move(1, 0);
    const bush = game.objectAt(game.player.x + 1, game.player.y)!;
    expect(bush.readyAt).toBeGreaterThan(game.turn);
    justBefore(game, 'rain');
    bush.readyAt = game.turn + 100;
    game.needs.water = 50;
    for (let i = 0; i < 10; i++) game.wait();
    // −0.45 + 0.3 each turn instead of −0.45.
    expect(game.needs.water).toBeCloseTo(50 - 10 * 0.15, 5);
    // 10 turns of rain count twice.
    expect(bush.readyAt! - game.turn).toBe(100 - 20);
  });

  it('keeps the wasps in their nest', () => {
    const game = sandbox(23, Tile.Grass);
    justBefore(game, 'rain');
    game.wait();
    game.animals = [{ id: 99, kind: 'wasps', x: game.player.x + 2, y: game.player.y, facing: 'down', flee: 0 }];
    let stings = 0;
    for (let i = 0; i < 8; i++) {
      game.wait();
      stings += game.takeEvents().filter((e) => e.type === 'hit').length;
    }
    expect(stings).toBe(0);
    expect(game.log.some((m) => m.msg.key === 'alert')).toBe(false);
  });

  it('cools the hot ash; the sun hat shades you there', () => {
    const thirst = (setup: (g: Game) => void) => {
      const game = sandbox(24, Tile.Ash);
      game.level = 3;
      setup(game);
      game.needs.water = 80;
      game.wait();
      return 80 - game.needs.water;
    };
    const noon = (g: Game) => {
      g.turn = 4 * TURNS_PER_DAY + 40; // 12:00 on a later day
      if (g.raining) g.turn += TURNS_PER_DAY;
    };
    const plain = thirst((g) => {
      noon(g);
      while (g.raining || weatherAt(g.seed, 3, g.turn + 1) !== 'clear') g.turn += TURNS_PER_DAY;
    });
    const hat = thirst((g) => {
      noon(g);
      while (g.raining || weatherAt(g.seed, 3, g.turn + 1) !== 'clear') g.turn += TURNS_PER_DAY;
      g.inventory.add('sun_hat');
    });
    const rain = thirst((g) => justBefore(g, 'rain'));
    expect(plain).toBeCloseTo(0.675);
    expect(hat).toBeCloseTo(0.45 * (1 + 0.5 * 0.4));
    // In the rain: the normal loss, less what the rain gives.
    expect(rain).toBeCloseTo(0.45 - 0.3);
  });
});

describe('Game: storms on the rig', () => {
  it('blow only on the rig: you see less, and the boat waits', () => {
    const game = rigGame(30);
    const dock = [...game.objects].find(([, o]) => o.kind === 'fishing_boat_wreck')![0];
    game.objects.get(dock)!.kind = 'fishing_boat';
    const x = dock % game.map.width;
    game.player.x = x;
    game.player.y = (dock - x) / game.map.width - 1;
    game.inventory.add('diesel', 4);
    const clear = game.sightRadius;
    justBefore(game, 'storm');
    game.wait();
    expect(game.weather).toBe('storm');
    expect(game.log.some((m) => m.msg.key === 'weather' && m.msg.w === 'storm')).toBe(true);
    expect(game.sightRadius).toBe(clear - 2);
    expect(game.voyageProblem(1)).toEqual({ key: 'stormWait' });
    while (game.weather === 'storm') game.wait();
    expect(game.voyageProblem(1)).toBeNull();
  });
});

describe('Game: clothes', () => {
  it('makes the leaf cape and the sun hat from leaves and rope, one of each', () => {
    const game = sandbox(40);
    game.inventory.add('leaves', 12);
    game.inventory.add('rope', 3);
    expect(game.build('leaf_cape')).toBe(true);
    expect(game.build('sun_hat')).toBe(true);
    expect(game.inventory.count('leaf_cape')).toBe(1);
    expect(game.inventory.count('sun_hat')).toBe(1);
    expect(game.buildProblem('leaf_cape')).toEqual({ key: 'haveTool', item: 'leaf_cape' });
  });

  it('knits the wool coat only at the workbench in the hut', () => {
    const game = sandbox(41);
    game.inventory.add('wool', 6);
    game.inventory.add('rope', 2);
    expect(game.buildProblem('wool_coat')).toEqual({ key: 'needRoom', room: 'workshop' });
    game.objects.set(game.map.idx(game.player.x + 1, game.player.y), { kind: 'hut', rooms: ['workshop'] });
    game.move(1, 0);
    expect(game.hutHere()).not.toBeNull();
    expect(game.build('wool_coat')).toBe(true);
    expect(game.inventory.count('wool_coat')).toBe(1);
  });

  it('works from the bag, the best of each, and shows what helps now', () => {
    const game = sandbox(42);
    expect(game.outfit()).toEqual({});
    game.inventory.add('leaf_cape');
    game.inventory.add('wool_coat');
    game.inventory.add('sun_hat');
    expect(game.wear()).toEqual({ warm: 0.35, dry: 1, shade: 0.6 });
    expect(game.outfit()).toEqual({ garment: 'coat', hat: true });
    justBefore(game, 'rain');
    game.wait();
    expect(game.outfit()).toEqual({ garment: 'cape', hat: true });
    game.inventory.add('rain_jacket');
    expect(game.outfit()).toEqual({ garment: 'jacket', hat: true });
  });

  it('keeps you warmer at night in the wool coat', () => {
    const night = (coat: boolean) => {
      const game = sandbox(43);
      if (coat) game.inventory.add('wool_coat');
      game.turn = 4 * TURNS_PER_DAY + 150; // 23:00
      game.needs.warmth = 30;
      for (let i = 0; i < 40; i++) game.wait();
      return game.needs.warmth;
    };
    expect(night(false)).toBeLessThan(10);
    expect(night(true)).toBeGreaterThan(37);
  });
});

describe('Game: wool and the rain jacket', () => {
  const count = (game: Game, kind: ObjectKind) => [...game.objects.values()].filter((o) => o.kind === kind).length;

  it('puts thorny junipers with wool where the forest of Pine Ridge meets the scree', () => {
    const game = new Game(50);
    expect(count(game, 'thorn_bush_wool')).toBe(0);
    game.jumpToIsland(2);
    expect(count(game, 'thorn_bush_wool')).toBeGreaterThan(5);
    for (const [i, o] of game.objects) {
      if (o.kind !== 'thorn_bush_wool') continue;
      const x = i % game.map.width;
      expect([Tile.Grass, Tile.Scree]).toContain(game.map.get(x, (i - x) / game.map.width));
    }
  });

  it('gives wool from a juniper, which grows back', () => {
    const game = sandbox(51);
    place(game, 1, 0, 'thorn_bush_wool');
    game.move(1, 0);
    expect(game.inventory.count('wool')).toBeGreaterThanOrEqual(1);
    const bush = game.objectAt(game.player.x + 1, game.player.y)!;
    expect(bush.readyAt).toBeGreaterThan(game.turn);
    expect(game.objectSprite(bush)).toBe('thorn_bush');
  });

  it('hides the rain jacket in a chest near the crew cabin on the rig', () => {
    const game = rigGame(52);
    expect(count(game, 'jacket_chest')).toBe(1);
    const i = [...game.objects].find(([, o]) => o.kind === 'jacket_chest')![0];
    const x = i % game.map.width;
    const y = (i - x) / game.map.width;
    expect(Math.max(Math.abs(x - game.home.x), Math.abs(y - game.home.y))).toBeLessThanOrEqual(6);
    game.player.x = x - 1;
    game.player.y = y;
    game.objects.delete(game.map.idx(x - 1, y));
    game.map.set(x - 1, y, Tile.Deck);
    game.move(1, 0);
    expect(game.inventory.count('rain_jacket')).toBe(1);
    expect(game.objectAt(x, y)?.kind).toBe('chest_open');
  });

  it('gives an island from an older save its junipers once', () => {
    const old = new Game(53);
    old.jumpToIsland(2);
    for (const [i, o] of old.objects) if (o.kind === 'thorn_bush_wool') old.objects.delete(i);
    const save = { ...old.toSave(), v: 14 } as Partial<ReturnType<Game['toSave']>>;
    delete save.clothesStocked;
    const game = Game.fromSave(JSON.parse(JSON.stringify(save)));
    expect(game.toSave().v).toBe(SAVE_VERSION);
    expect(count(game, 'thorn_bush_wool')).toBeGreaterThan(5);
    const again = Game.fromSave(JSON.parse(JSON.stringify(game.toSave())));
    expect(count(again, 'thorn_bush_wool')).toBe(count(game, 'thorn_bush_wool'));
  });
});
