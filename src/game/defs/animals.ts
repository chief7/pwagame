import { Tile } from '../map';

// Island animals. None of them can be hurt; at worst they're a nuisance.
// Names and what bumping into them says live in src/i18n/.
//   calm:   wanders slowly, ignores you
//   shy:    keeps its distance
//   grumpy: pinches if you linger next to it, then scuttles off
//   cheeky: comes over when you carry food and pinches a snack
//   charger: runs at you when it sees you and knocks you over, then trots off
//   chaser:  follows you for a while and stings you while it is next to you
//   stray:   a lost dog that stays put; give it food and it becomes your dog
// Nocturnal animals (the cave bear) sleep through the day and prowl at night.
// Wild animals live far from camp. They are the real danger on the island:
// the Animal friend skill only makes them notice you later.

export type AnimalKind =
  | 'crab' | 'turtle' | 'monkey' | 'piglet' | 'bat' | 'boar' | 'snake' | 'wasps' | 'bear'
  | 'rabbit' | 'squirrel' | 'goat' | 'dog';
export type Temper = 'calm' | 'shy' | 'grumpy' | 'cheeky' | 'charger' | 'chaser' | 'stray';

export interface AnimalDef {
  kind: AnimalKind;
  temper: Temper;
  /** Ground it lives on. */
  habitat: Tile[];
  /** How close (cells) you need to be before it reacts to you. */
  notice: number;
  /** Chance per turn to move when not reacting to you. */
  wander: number;
  /** How many live on an island. */
  population: number;
  /** Health it takes when it hurts you (grumpy, charger, chaser). */
  damage?: number;
  /** Chance per turn to hurt you when it can (default 0.5). */
  hitChance?: number;
  /** Turns it runs off after it hurt you (default 4). */
  fleeAfter?: number;
  /** A wild animal: Animal friend makes it notice you later instead of leaving you be. */
  wild?: true;
  /** It only appears at least this many cells from camp. */
  minHomeDistance?: number;
  /** The islands (levels) it lives on; default only the first. */
  islands?: number[];
  /** It walks over steep steps (on its habitat) without a ladder. */
  climber?: true;
  /**
   * It sleeps from 7:00 to 19:00 and does not notice you then. Awake, it
   * follows you for a few turns when it notices you (see Game.animalAct).
   */
  nocturnal?: true;
  /** Your dog's bark makes it run away. */
  scaredByDog?: true;
}

export const ANIMALS: Record<AnimalKind, AnimalDef> = {
  crab: { kind: 'crab', temper: 'grumpy', habitat: [Tile.Sand], notice: 2, wander: 0.4, population: 6, damage: 4, islands: [1, 2], scaredByDog: true },
  turtle: { kind: 'turtle', temper: 'calm', habitat: [Tile.Sand], notice: 0, wander: 0.15, population: 2 },
  monkey: { kind: 'monkey', temper: 'cheeky', habitat: [Tile.Grass, Tile.Sand], notice: 5, wander: 0.5, population: 3, scaredByDog: true },
  piglet: { kind: 'piglet', temper: 'shy', habitat: [Tile.Grass], notice: 3, wander: 0.35, population: 3 },
  bat: { kind: 'bat', temper: 'shy', habitat: [Tile.CaveFloor], notice: 2, wander: 0.8, population: 4, islands: [1, 2] },
  boar: {
    kind: 'boar', temper: 'charger', habitat: [Tile.Grass], notice: 4, wander: 0.3, population: 4,
    damage: 12, hitChance: 1, fleeAfter: 10, wild: true, minHomeDistance: 25, islands: [1, 2],
  },
  snake: {
    kind: 'snake', temper: 'grumpy', habitat: [Tile.Grass, Tile.Sand], notice: 1, wander: 0.1, population: 5,
    damage: 8, hitChance: 0.7, wild: true, minHomeDistance: 25, scaredByDog: true,
  },
  wasps: {
    kind: 'wasps', temper: 'chaser', habitat: [Tile.Grass], notice: 3, wander: 0.6, population: 3,
    damage: 3, hitChance: 1, fleeAfter: 8, wild: true, minHomeDistance: 25, islands: [1, 2],
  },
  bear: {
    kind: 'bear', temper: 'grumpy', habitat: [Tile.CaveFloor], notice: 3, wander: 0.05, population: 2,
    damage: 20, hitChance: 0.5, fleeAfter: 10, wild: true, minHomeDistance: 25, islands: [1, 2], nocturnal: true,
  },
  // Island 2.
  rabbit: { kind: 'rabbit', temper: 'shy', habitat: [Tile.Grass], notice: 3, wander: 0.45, population: 4, islands: [2] },
  squirrel: { kind: 'squirrel', temper: 'cheeky', habitat: [Tile.Grass], notice: 5, wander: 0.5, population: 3, islands: [2], scaredByDog: true },
  goat: {
    kind: 'goat', temper: 'charger', habitat: [Tile.Scree, Tile.Snow], notice: 4, wander: 0.3, population: 3,
    damage: 10, hitChance: 1, fleeAfter: 10, wild: true, minHomeDistance: 25, islands: [2], climber: true,
  },
  // A lost dog, one on each island, far from camp, until you adopt one.
  dog: { kind: 'dog', temper: 'stray', habitat: [Tile.Grass], notice: 0, wander: 0.1, population: 1, minHomeDistance: 25, islands: [1, 2] },
};

export const ANIMAL_KINDS = Object.keys(ANIMALS) as AnimalKind[];

/** The animals that live on an island. */
export function islandAnimals(level: number): AnimalKind[] {
  return ANIMAL_KINDS.filter((kind) => (ANIMALS[kind].islands ?? [1]).includes(level));
}
