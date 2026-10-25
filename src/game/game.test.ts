import { describe, expect, it } from 'vitest';
import { generateCaves } from './caves';
import { computeFov } from './fov';
import { Game } from './game';
import { GameMap, Tile } from './map';
import { distanceMap } from './pathing';
import { Rng } from './rng';

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
});

describe('generateCaves', () => {
  it('produces fully connected caves with reachable stairs', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { map, start, stairs } = generateCaves(60, 40, new Rng(seed));
      expect(map.get(stairs.x, stairs.y)).toBe(Tile.Stairs);
      const dist = distanceMap(map, start.x, start.y);
      for (let i = 0; i < map.tiles.length; i++) {
        if (map.tiles[i] !== Tile.Wall) expect(dist[i]).toBeGreaterThanOrEqual(0);
      }
      // Border is always solid.
      for (let x = 0; x < map.width; x++) {
        expect(map.get(x, 0)).toBe(Tile.Wall);
        expect(map.get(x, map.height - 1)).toBe(Tile.Wall);
      }
    }
  });
});

describe('computeFov', () => {
  it('is blocked by walls', () => {
    const map = new GameMap(11, 11);
    map.tiles.fill(Tile.Floor);
    for (let y = 0; y < 11; y++) map.set(7, y, Tile.Wall);
    const seen = new Set<string>();
    computeFov(5, 5, 8, (x, y) => map.isOpaque(x, y), (x, y) => seen.add(`${x},${y}`));
    expect(seen.has('6,5')).toBe(true);
    expect(seen.has('7,5')).toBe(true);
    expect(seen.has('8,5')).toBe(false);
    expect(seen.has('1,5')).toBe(true);
  });
});

describe('Game', () => {
  it('starts on depth 1 with the player on floor and monsters away from them', () => {
    const game = new Game(7);
    expect(game.depth).toBe(1);
    expect(game.map.isWalkable(game.player.x, game.player.y)).toBe(true);
    expect(game.monsters.length).toBeGreaterThan(0);
    for (const m of game.monsters) {
      expect(m.x === game.player.x && m.y === game.player.y).toBe(false);
    }
  });

  it('bumping into a monster attacks it', () => {
    const game = new Game(3);
    const m = game.monsters[0];
    m.x = game.player.x + 1;
    m.y = game.player.y;
    game.map.set(m.x, m.y, Tile.Floor);
    const before = m.hp;
    for (let i = 0; i < 20 && game.monsters.includes(m) && !game.over; i++) game.move(1, 0);
    expect(m.hp < before || !game.monsters.includes(m)).toBe(true);
  });

  it('only descends from the stairs', () => {
    const game = new Game(11);
    expect(game.descend()).toBe(false);
    game.map.set(game.player.x, game.player.y, Tile.Stairs);
    expect(game.descend()).toBe(true);
    expect(game.depth).toBe(2);
  });
});
