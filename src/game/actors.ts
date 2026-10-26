import type { AnimalKind } from './defs/animals';

export type Facing = 'down' | 'up' | 'left' | 'right';

export interface Player {
  id: number;
  x: number;
  y: number;
  facing: Facing;
}

export interface Animal {
  id: number;
  kind: AnimalKind;
  x: number;
  y: number;
  facing: Facing;
  /** Turns left running away from the player after being shooed (or after mischief). */
  flee: number;
  /** Turns left following the player (wasps). Missing in older saves. */
  chase?: number;
}

/** The explorer's dog, once adopted: it follows them and needs food and water. */
export interface Dog {
  id: number;
  x: number;
  y: number;
  facing: Facing;
  food: number;
  water: number;
  /** Food or Water ran out: it trails behind slowly and doesn't bark until both are back above 0. */
  tired: boolean;
  /** Lying down next to the sleeping explorer; it gets up on the first turn after you wake. Missing in older saves. */
  napping?: boolean;
}

/** The player's id; animals count up from here. */
export const PLAYER_ID = 1;

export function facingFor(dx: number, dy: number, current: Facing): Facing {
  if (dx > 0) return 'right';
  if (dx < 0) return 'left';
  if (dy > 0) return 'down';
  if (dy < 0) return 'up';
  return current;
}

export function facingDelta(f: Facing): [number, number] {
  switch (f) {
    case 'up': return [0, -1];
    case 'down': return [0, 1];
    case 'left': return [-1, 0];
    case 'right': return [1, 0];
  }
}
