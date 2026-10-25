export type Command =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'wait' }
  | { type: 'descend' }
  | { type: 'drink' };

const KEY_DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  k: [0, -1], j: [0, 1], h: [-1, 0], l: [1, 0],
  y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
  '8': [0, -1], '2': [0, 1], '4': [-1, 0], '6': [1, 0],
  '7': [-1, -1], '9': [1, -1], '1': [-1, 1], '3': [1, 1],
  Home: [-1, -1], PageUp: [1, -1], End: [-1, 1], PageDown: [1, 1],
};

export function commandForKey(e: KeyboardEvent): Command | null {
  const dir = KEY_DIRS[e.key];
  if (dir) return { type: 'move', dx: dir[0], dy: dir[1] };
  switch (e.key) {
    case '.': case '5': case ' ': case 'Clear': return { type: 'wait' };
    case '>': return { type: 'descend' };
    case 'q': return { type: 'drink' };
  }
  return null;
}

/**
 * Taps steer the player: the tap's angle from the player picks one of the
 * eight directions. Tapping on the player waits a turn.
 */
export function commandForTap(tapX: number, tapY: number, playerX: number, playerY: number, cell: number): Command {
  const dx = tapX - playerX;
  const dy = tapY - playerY;
  if (Math.hypot(dx, dy) < cell * 0.75) return { type: 'wait' };
  const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  const angle = sector * (Math.PI / 4);
  return { type: 'move', dx: Math.round(Math.cos(angle)), dy: Math.round(Math.sin(angle)) };
}
