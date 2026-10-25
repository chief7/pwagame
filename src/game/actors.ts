export interface Actor {
  id: number;
  kind: string;
  name: string;
  glyph: string;
  color: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  /** XP granted to the player on kill. */
  xp: number;
  /** Turns left before a monster that lost sight of the player gives up. */
  alert: number;
}

export interface MonsterType {
  kind: string;
  name: string;
  glyph: string;
  color: string;
  hp: number;
  attack: number;
  defense: number;
  xp: number;
  minDepth: number;
  /** Relative spawn weight among eligible types. */
  weight: number;
}

export const MONSTER_TYPES: readonly MonsterType[] = [
  { kind: 'rat', name: 'rust rat', glyph: 'r', color: '#c98a5a', hp: 4, attack: 2, defense: 0, xp: 2, minDepth: 1, weight: 10 },
  { kind: 'snapper', name: 'cave snapper', glyph: 's', color: '#7fb069', hp: 7, attack: 3, defense: 1, xp: 4, minDepth: 1, weight: 7 },
  { kind: 'beetle', name: 'glow beetle', glyph: 'b', color: '#e8d45c', hp: 10, attack: 3, defense: 2, xp: 6, minDepth: 2, weight: 6 },
  { kind: 'hound', name: 'mire hound', glyph: 'h', color: '#b56ad1', hp: 14, attack: 5, defense: 1, xp: 10, minDepth: 3, weight: 5 },
  { kind: 'golem', name: 'salt golem', glyph: 'G', color: '#dcdcdc', hp: 24, attack: 6, defense: 4, xp: 20, minDepth: 5, weight: 3 },
];

let nextId = 1;

export function createPlayer(): Actor {
  return {
    id: nextId++, kind: 'player', name: 'you', glyph: '@', color: '#ffffff',
    x: 0, y: 0, hp: 20, maxHp: 20, attack: 4, defense: 1, xp: 0, alert: 0,
  };
}

export function createMonster(type: MonsterType, x: number, y: number): Actor {
  return {
    id: nextId++, kind: type.kind, name: type.name, glyph: type.glyph, color: type.color,
    x, y, hp: type.hp, maxHp: type.hp, attack: type.attack, defense: type.defense, xp: type.xp, alert: 0,
  };
}
