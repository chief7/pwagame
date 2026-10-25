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
