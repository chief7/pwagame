import { Tile } from '../map';

// Island animals. None of them can be hurt; at worst they're a nuisance.
//   calm:   wanders slowly, ignores you
//   shy:    keeps its distance
//   grumpy: pinches if you linger next to it, then scuttles off
//   cheeky: comes over when you carry food and pinches a snack

export type AnimalKind = 'crab' | 'turtle' | 'monkey' | 'piglet' | 'bat';
export type Temper = 'calm' | 'shy' | 'grumpy' | 'cheeky';

export interface AnimalDef {
  kind: AnimalKind;
  name: string;
  temper: Temper;
  /** Ground it lives on. */
  habitat: Tile[];
  /** How close (cells) you need to be before it reacts to you. */
  notice: number;
  /** Chance per turn to move when not reacting to you. */
  wander: number;
  /** How many live on an island. */
  population: number;
  /** What bumping into it says. */
  bump: string;
}

export const ANIMALS: Record<AnimalKind, AnimalDef> = {
  crab: {
    kind: 'crab', name: 'crab', temper: 'grumpy', habitat: [Tile.Sand], notice: 2, wander: 0.4, population: 6,
    bump: 'You shoo the crab away. It scuttles off sideways.',
  },
  turtle: {
    kind: 'turtle', name: 'turtle', temper: 'calm', habitat: [Tile.Sand], notice: 0, wander: 0.15, population: 2,
    bump: 'The turtle blinks at you slowly.',
  },
  monkey: {
    kind: 'monkey', name: 'monkey', temper: 'cheeky', habitat: [Tile.Grass, Tile.Sand], notice: 5, wander: 0.5, population: 3,
    bump: 'You shoo the monkey. It chatters and scampers off.',
  },
  piglet: {
    kind: 'piglet', name: 'piglet', temper: 'shy', habitat: [Tile.Grass], notice: 3, wander: 0.35, population: 3,
    bump: 'The piglet squeals and trots away.',
  },
  bat: {
    kind: 'bat', name: 'bat', temper: 'shy', habitat: [Tile.CaveFloor], notice: 2, wander: 0.8, population: 4,
    bump: 'The bat flutters past your ear.',
  },
};

export const ANIMAL_KINDS = Object.keys(ANIMALS) as AnimalKind[];
