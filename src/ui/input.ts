export type Command =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'wait' }
  | { type: 'sleep' }
  | { type: 'bag' }
  | { type: 'build' }
  | { type: 'skills' };

const KEY_DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  k: [0, -1], j: [0, 1], h: [-1, 0], l: [1, 0],
  y: [-1, -1], u: [1, -1], n: [1, 1],
  '8': [0, -1], '2': [0, 1], '4': [-1, 0], '6': [1, 0],
  '7': [-1, -1], '9': [1, -1], '1': [-1, 1], '3': [1, 1],
  Home: [-1, -1], PageUp: [1, -1], End: [-1, 1], PageDown: [1, 1],
};

export function commandForKey(e: KeyboardEvent): Command | null {
  const dir = KEY_DIRS[e.key];
  if (dir) return { type: 'move', dx: dir[0], dy: dir[1] };
  switch (e.key) {
    case '.': case '5': case ' ': case 'Clear': return { type: 'wait' };
    case 'z': return { type: 'sleep' };
    case 'i': return { type: 'bag' };
    case 'b': return { type: 'build' };
    case 'p': return { type: 'skills' };
  }
  return null;
}

/** One of eight directions from the angle between two points, or null when they're close. */
export function directionFrom(fromX: number, fromY: number, toX: number, toY: number, deadZone: number): [number, number] | null {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (Math.hypot(dx, dy) < deadZone) return null;
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return [Math.round(Math.cos(angle)), Math.round(Math.sin(angle))];
}
