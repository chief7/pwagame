import { describe, expect, it } from 'vitest';
import { cheats, type Cheat } from './cheats';
import { minuteOfDay } from './game/clock';
import { Game } from './game/game';
import { Tile } from './game/map';
import { buildSprites } from './sprites';

const find = (game: Game, label: string): Cheat => cheats(game).flatMap((g) => g.cheats).find((c) => c.label === label)!;

describe('cheats', () => {
  it('has a picture for every cheat on every island', () => {
    const sprites = buildSprites();
    const game = new Game(1);
    for (const level of [1, 2, 3] as const) {
      game.jumpToIsland(level);
      for (const cheat of cheats(game).flatMap((g) => g.cheats)) expect(sprites.has(cheat.icon), cheat.icon).toBe(true);
    }
  });

  it('jumps to island 3 and keeps the bag, XP and skills', () => {
    const game = new Game(2);
    game.inventory.add('axe');
    game.xp = 12;
    expect(find(game, 'Go to island 3').run(game)).toBe(true);
    expect(game.level).toBe(3);
    expect(game.map.tiles.includes(Tile.Lava)).toBe(true);
    expect(game.inventory.count('axe')).toBe(1);
    expect(game.xp).toBe(12);
    expect(game.goal()).toEqual({ state: 'find' });
  });

  it('goes next to the goal, and the goal materials finish it', () => {
    const game = new Game(3);
    game.jumpToIsland(3);
    expect(find(game, 'Go to the island goal').run(game)).toBe(true);
    const [cell] = [...game.objects].find(([, o]) => o.kind === 'balloon_site')!;
    const gx = cell % game.map.width;
    const gy = (cell - gx) / game.map.width;
    expect(Math.max(Math.abs(game.player.x - gx), Math.abs(game.player.y - gy))).toBe(1);
    expect(game.goal()).toMatchObject({ state: 'build', index: 0 });
    expect(find(game, 'Give the goal materials').run(game)).toBe(true);
    for (let i = 0; i < 3; i++) game.move(Math.sign(gx - game.player.x), Math.sign(gy - game.player.y));
    expect(game.goal()).toEqual({ state: 'ready' });
  });

  it('goes to the lava flow, a steam vent and a hot spring on island 3', () => {
    const game = new Game(4);
    game.jumpToIsland(3);
    const near = (test: (x: number, y: number) => boolean) =>
      [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => test(game.player.x + dx, game.player.y + dy)));
    expect(find(game, 'Go to the lava flow').run(game)).toBe(true);
    expect(near((x, y) => game.map.get(x, y) === Tile.Lava)).toBe(true);
    for (const [label, kind] of [['Go to a steam vent', 'steam_vent'], ['Go to a hot spring', 'hot_spring']] as const) {
      expect(find(game, label).run(game)).toBe(true);
      expect(near((x, y) => game.objectAt(x, y)?.kind === kind)).toBe(true);
    }
  });

  it('fills the needs, reveals the map and skips the clock', () => {
    const game = new Game(5);
    game.needs.water = 10;
    find(game, 'Fill all needs').run(game);
    expect(game.needs.water).toBe(100);
    find(game, 'Reveal the map').run(game);
    expect(game.map.explored.every((e) => e === 1)).toBe(true);
    const turn = game.turn;
    find(game, 'Skip to 22:00').run(game);
    expect(minuteOfDay(game.turn)).toBe(22 * 60);
    expect(game.turn).toBeGreaterThan(turn);
    find(game, 'Skip to 7:00').run(game);
    expect(minuteOfDay(game.turn)).toBe(7 * 60);
  });
});
