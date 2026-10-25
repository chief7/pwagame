import { Tile } from '../map';

// Island animals. None of them can be hurt; at worst they're a nuisance.
// Names and what bumping into them says live in src/i18n/.
//   calm:   wanders slowly, ignores you
//   shy:    keeps its distance
//   grumpy: pinches if you linger next to it, then scuttles off
//   cheeky: comes over when you carry food and pinches a snack

export type AnimalKind = 'crab' | 'turtle' | 'monkey' | 'piglet' | 'bat';
export type Temper = 'calm' | 'shy' | 'grumpy' | 'cheeky';

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
}

export const ANIMALS: Record<AnimalKind, AnimalDef> = {
  crab: { kind: 'crab', temper: 'grumpy', habitat: [Tile.Sand], notice: 2, wander: 0.4, population: 6 },
  turtle: { kind: 'turtle', temper: 'calm', habitat: [Tile.Sand], notice: 0, wander: 0.15, population: 2 },
  monkey: { kind: 'monkey', temper: 'cheeky', habitat: [Tile.Grass, Tile.Sand], notice: 5, wander: 0.5, population: 3 },
  piglet: { kind: 'piglet', temper: 'shy', habitat: [Tile.Grass], notice: 3, wander: 0.35, population: 3 },
  bat: { kind: 'bat', temper: 'shy', habitat: [Tile.CaveFloor], notice: 2, wander: 0.8, population: 4 },
};

export const ANIMAL_KINDS = Object.keys(ANIMALS) as AnimalKind[];
