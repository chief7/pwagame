import { describe, expect, it } from 'vitest';
import { shoreTileName, buildSprites } from '../sprites';
import { computeFov } from './fov';
import { Game } from './game';
import { generateIsland } from './island';
import { Tile } from './map';
import { distanceMap } from './pathing';
import { Rng } from './rng';

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
});

describe('generateIsland', () => {
  const sprites = buildSprites();

  it('makes one connected island ringed by water, with a coastal raft', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { map, start, raft } = generateIsland(60, 40, new Rng(seed));
      expect(map.get(raft.x, raft.y)).toBe(Tile.Raft);
      const dist = distanceMap(map, start.x, start.y, (x, y) => map.isLand(x, y));
      for (let i = 0; i < map.tiles.length; i++) {
        if (map.tiles[i] !== Tile.Water) expect(dist[i]).toBeGreaterThanOrEqual(0);
      }
      for (let x = 0; x < map.width; x++) {
        expect(map.isLand(x, 0)).toBe(false);
        expect(map.isLand(x, map.height - 1)).toBe(false);
      }
    }
  });

  it('only leaves coastlines the shore tiles can draw', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { map } = generateIsland(60, 40, new Rng(seed));
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (!map.isLand(x, y)) continue;
          const w = (dx: number, dy: number) => !map.isLand(x + dx, y + dy);
          expect(w(0, -1) && w(0, 1)).toBe(false);
          expect(w(-1, 0) && w(1, 0)).toBe(false);
          expect(sprites.has(shoreTileName(w))).toBe(true);
        }
      }
    }
  });
});

describe('computeFov', () => {
  it('is blocked by opaque cells', () => {
    const wall = (x: number) => x === 7;
    const seen = new Set<string>();
    computeFov(5, 5, 8, (x) => wall(x), (x, y) => seen.add(`${x},${y}`));
    expect(seen.has('6,5')).toBe(true);
    expect(seen.has('7,5')).toBe(true);
    expect(seen.has('8,5')).toBe(false);
    expect(seen.has('1,5')).toBe(true);
  });
});

describe('Game', () => {
  it('starts on island 1 with props, chests and monsters, all land reachable', () => {
    const game = new Game(7);
    expect(game.depth).toBe(1);
    expect(game.isPassable(game.player.x, game.player.y)).toBe(true);
    expect(game.monsters.length).toBeGreaterThan(0);
    expect([...game.props.values()].filter((k) => k === 'chest_closed').length).toBeGreaterThanOrEqual(2);
    const { map } = game;
    const dist = distanceMap(map, game.player.x, game.player.y, (x, y) => game.isPassable(x, y));
    for (let i = 0; i < map.tiles.length; i++) {
      if (map.tiles[i] !== Tile.Water && !game.props.has(i)) expect(dist[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it('bumping into a monster attacks it', () => {
    const game = new Game(3);
    const m = game.monsters[0];
    clearAround(game);
    m.x = game.player.x + 1;
    m.y = game.player.y;
    const before = m.hp;
    for (let i = 0; i < 20 && game.monsters.includes(m) && !game.over; i++) game.move(1, 0);
    expect(m.hp < before || !game.monsters.includes(m)).toBe(true);
  });

  it('bumping a closed chest opens it for tonics', () => {
    const game = new Game(5);
    clearAround(game);
    game.monsters = [];
    game.props.set(game.map.idx(game.player.x + 1, game.player.y), 'chest_closed');
    const before = game.tonics;
    expect(game.move(1, 0)).toBe(true);
    expect(game.propAt(game.player.x + 1, game.player.y)).toBe('chest_open');
    expect(game.tonics).toBeGreaterThan(before);
  });

  it('only sails from the raft', () => {
    const game = new Game(11);
    expect(game.sail()).toBe(false);
    game.map.set(game.player.x, game.player.y, Tile.Raft);
    expect(game.sail()).toBe(true);
    expect(game.depth).toBe(2);
  });

  it('travels along explored land to a tapped cell', () => {
    const game = new Game(9);
    game.monsters = [];
    const { x, y } = game.player;
    clearAround(game, 3);
    const target = { x: x + 3, y };
    game.map.explored.fill(1);
    let result = game.travelStep(target.x, target.y);
    for (let i = 0; i < 10 && result === 'moved'; i++) result = game.travelStep(target.x, target.y);
    expect(result).toBe('arrived');
    expect(game.player).toMatchObject(target);
  });

  it('will not travel into unexplored cells', () => {
    const game = new Game(9);
    clearAround(game, 3);
    game.map.explored.fill(0);
    expect(game.travelStep(game.player.x + 3, game.player.y)).toBe('blocked');
  });
});

/** Turn the square around the player into open sand. */
function clearAround(game: Game, r = 1): void {
  const { map } = game;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = game.player.x + dx;
      const y = game.player.y + dy;
      map.set(x, y, Tile.Sand);
      game.props.delete(map.idx(x, y));
      game.monsters = game.monsters.filter((m) => !(m.x === x && m.y === y) || (dx === 1 && dy === 0));
    }
  }
}

