import { PALETTE as P } from './palette';
import { fromRows, hash2, Sprite } from './pixel';

// The inside of the hut, seen from the front: one 32×24 picture per room.
// The rooms stand side by side in the Hut panel; each starts with a post,
// so they join into one long wall.

const W = 32;
const H = 24;
/** First row of floor boards. */
const FLOOR = 16;

/** Plank back wall, a post on the left, floor boards and a skirting board. */
function room(name: string): Sprite {
  return new Sprite(name, W, H).paint((x, y) => {
    if (x <= 1) return x === 0 ? P.woodDeep : P.woodDark;
    if (y < FLOOR - 1) {
      const seam = x % 6 === 1;
      return seam ? P.woodDark : hash2(x, y, 90) < 0.08 ? P.woodLight : y < 2 ? P.woodDark : P.wood;
    }
    if (y === FLOOR - 1) return P.woodDeep;
    const board = (y - FLOOR) % 3 === 2;
    return board ? P.woodRing : y === FLOOR ? P.woodRing : hash2(x, y, 91) < 0.1 ? P.woodRing : P.woodCut;
  });
}

/** Paste a small drawing into the room with its top-left corner at (x0, y0). */
function put(s: Sprite, art: Sprite, x0: number, y0: number): void {
  for (let y = 0; y < art.height; y++) {
    for (let x = 0; x < art.width; x++) {
      const c = art.get(x, y);
      if (c) s.set(x0 + x, y0 + y, c);
    }
  }
}

/** A small window with sky and a leaf, framed in dark wood. */
function windowArt(): Sprite {
  return fromRows('window', [
    'dddddddd',
    'dsssdssd',
    'dsgsdssd',
    'dddddddd',
    'dssdsssd',
    'dssdsgsd',
    'dddddddd',
  ], { d: P.woodDeep, s: P.waterShallow, g: P.leafLight });
}

/** The Cartographer's map pinned to the wall. */
function wallMapArt(): Sprite {
  return fromRows('wall_map', [
    'r..........r',
    'LLLLLLLLLLLL',
    'LwwwsssswwwD',
    'LwssffkfswwD',
    'LwsfkkffsswD',
    'LwwsfffxswwD',
    'LwwwsssswwwD',
    'DDDDDDDDDDDD',
  ], {
    '.': null, r: P.inkRed, L: P.paperLight, D: P.paperDark, w: P.washSea, s: P.washSand,
    f: P.washForest, k: P.washForestDark, x: P.inkRed,
  });
}

/** Bed with a straw mattress, a pillow and a teal blanket. */
function bedArt(): Sprite {
  return fromRows('bed', [
    'hh..............',
    'hh..............',
    'hhpppp..........',
    'hhppppbbbbbbbbbb',
    'hhBBBBbbbbbbbbbb',
    'hhBBBBBBBBBBBBBB',
    'hhmmmmmmmmmmmmmm',
    'hhffffffffffffff',
    'hh............hh',
    'hh............hh',
  ], { '.': null, h: P.woodDark, p: P.flowerWhite, b: P.shirtTeal, B: P.shirtTealShade, m: P.strawDark, f: P.wood });
}

/** The main room every hut has: the bed, a window, and the map once the explorer is a Cartographer. */
export function roomMain(withMap: boolean): Sprite {
  const s = room(withMap ? 'room_main_map' : 'room_main');
  put(s, windowArt(), 5, 4);
  if (withMap) put(s, wallMapArt(), 17, 3);
  else s.set(22, 4, P.woodDeep); // an empty nail
  put(s, bedArt(), 9, FLOOR - 4);
  return s.outline();
}

/** Workbench with a saw and a mallet, tools on the wall and shavings on the floor. */
export function roomWorkshop(): Sprite {
  const s = room('room_workshop');
  // Tools hanging on the wall: an axe and a saw.
  put(s, fromRows('wall_tools', [
    '.ss.......k',
    'sss......kk',
    '.sw.....kkk',
    '..w....kkkk',
    '..w...kkkkk',
    '..w..kkkkkk',
    '..w.whhhhhh',
  ], { '.': null, s: P.stoneLight, w: P.woodLight, k: P.stone, h: P.woodDark }), 6, 3);
  // The bench.
  put(s, fromRows('bench', [
    '...ss.......mmm.',
    'tttttttttttttttt',
    'TTTTTTTTTTTTTTTT',
    'l.............l.',
    'l..pppp.......l.',
    'l..pppp.......l.',
    'l.............l.',
  ], { '.': null, t: P.woodLight, T: P.woodDark, l: P.woodDeep, s: P.stoneLight, m: P.wood, p: P.wood }), 9, FLOOR - 4);
  // Shavings on the floor.
  for (const [x, y] of [[6, 21], [7, 22], [27, 20], [28, 22]]) s.set(x, y, P.strawLight);
  return s.outline();
}

/** Stone hearth with a fire and a pot on a hook; the flames lean one way, then the other. */
export function roomHearth(frame: 0 | 1): Sprite {
  const s = room(frame ? 'room_hearth_2' : 'room_hearth');
  // Stone surround, up through the ceiling.
  for (let y = 0; y <= FLOOR; y++) {
    for (let x = 10; x <= 23; x++) {
      const inside = x >= 13 && x <= 20 && y >= 8;
      if (inside) {
        s.set(x, y, P.interior);
        continue;
      }
      const joint = (x + (Math.floor(y / 3) % 2) * 2) % 4 === 0 || y % 3 === 0;
      s.set(x, y, joint ? P.stoneDark : x < 12 ? P.stoneLight : hash2(x, y, 92) < 0.25 ? P.stoneDark : P.stone);
    }
  }
  for (let x = 9; x <= 24; x++) s.set(x, 7, x < 12 ? P.stoneLight : P.stone);
  // Fire on two logs.
  const lean = frame === 0 ? -0.5 : 0.5;
  for (let y = 10; y <= 15; y++) {
    const t = (y - 10) / 5;
    const half = 0.5 + t * 2.2;
    const cx = 16.5 + lean * (1 - t) * 2;
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const d = Math.abs(x + 0.5 - cx) / (half + 0.3);
      if (d > 1) continue;
      const heat = (1 - d) * (0.4 + t * 0.6);
      s.set(x, y, heat > 0.55 ? P.flameCore : heat > 0.35 ? P.flame : heat > 0.15 ? P.flameOrange : P.flameRed);
    }
  }
  for (let x = 13; x <= 20; x++) s.set(x, FLOOR, x % 3 === 0 ? P.woodDeep : P.wood);
  // The pot on its hook.
  s.set(16, 8, P.stoneDeep);
  s.set(16, 9, P.stoneDeep);
  for (let x = 15; x <= 18; x++) s.set(x, 10, P.stoneDeep);
  for (let x = 14; x <= 19; x++) for (let y = 11; y <= 12; y++) s.set(x, y, x === 14 ? P.stone : P.stoneDeep);
  // A small pile of firewood beside it.
  for (let x = 25; x <= 29; x++) {
    s.set(x, FLOOR + 1, P.wood);
    s.set(x, FLOOR + 2, P.woodDark);
  }
  s.set(25, FLOOR + 1, P.woodCut);
  s.set(25, FLOOR + 2, P.woodCut);
  for (let x = 26; x <= 28; x++) s.set(x, FLOOR, P.woodLight);
  return s.outline();
}

/** A barrel of rain water from the roof, with a ladle and a cup on a shelf. */
export function roomBarrel(): Sprite {
  const s = room('room_barrel');
  // The pipe from the roof.
  for (let y = 0; y <= 8; y++) {
    s.set(17, y, P.woodDark);
    s.set(18, y, P.wood);
  }
  put(s, fromRows('barrel', [
    '.wwwwwwwwww.',
    'wWWWWWWWWWWw',
    'bgbbbbbbbbbb',
    'lhhhhhhhhhhH',
    'lttttttttttT',
    'lttttttttttT',
    'lttttttttttT',
    'lhhhhhhhhhhH',
    'lttttttttttT',
    'lttttttttttT',
    'lhhhhhhhhhhH',
    '.tttttttttT.',
  ], {
    '.': null, w: P.woodDark, W: P.wood, b: P.waterShallow, g: P.waterGlint,
    l: P.woodLight, t: P.wood, T: P.woodDark, h: P.hoop, H: P.hoop,
  }), 12, 9);
  // Ladle hooked on the rim.
  s.set(23, 8, P.woodLight);
  s.set(24, 7, P.woodLight);
  s.set(25, 6, P.woodLight);
  // Shelf with a cup and a coconut shell.
  for (let x = 4; x <= 10; x++) s.set(x, 7, P.woodDeep);
  for (const [x, y] of [[5, 5], [6, 5], [5, 6], [6, 6]]) s.set(x, y, P.woodLight);
  for (const [x, y] of [[8, 5], [9, 5], [8, 6], [9, 6]]) s.set(x, y, P.coconut);
  return s.outline();
}

export function interiors(): Sprite[] {
  return [roomMain(false), roomMain(true), roomWorkshop(), roomHearth(0), roomHearth(1), roomBarrel()];
}
