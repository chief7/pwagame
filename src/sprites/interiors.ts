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

// The crew cabin on the oil rig has its own rooms: riveted steel walls, a
// grating floor, a porthole, a bunk bed, an iron stove and a water tank.

/** Steel back wall with plate seams and rivets, a pipe for a post, a grating floor with a yellow kick plate. */
function cabinRoom(name: string): Sprite {
  return new Sprite(name, W, H).paint((x, y) => {
    if (x <= 1) return x === 0 ? P.steelDeep : P.steelDark;
    if (y < FLOOR - 1) {
      const seam = x % 8 === 1 || y === 7;
      const rivet = (x % 8 === 3 || x % 8 === 7) && (y === 2 || y === 12);
      return seam ? P.steelDark : rivet ? P.steelLight : hash2(x, y, 93) < 0.025 ? P.rust : y < 2 ? P.steelDark : P.steel;
    }
    if (y === FLOOR - 1) return Math.floor(x / 2) % 2 ? P.hazard : P.steelDeep;
    // Grating: bars across, every other row, over the dark below.
    return (y - FLOOR) % 2 === 0 ? (x % 4 === 0 ? P.steelDark : P.steel) : x % 4 === 0 ? P.steelDark : P.steelDeep;
  });
}

/** A round porthole: a brass rim, sea and sky behind thick glass. */
function porthole(s: Sprite, cx: number, cy: number): void {
  for (let y = cy - 4; y <= cy + 4; y++) {
    for (let x = cx - 4; x <= cx + 4; x++) {
      const d = Math.hypot(x + 0.5 - (cx + 0.5), y + 0.5 - (cy + 0.5));
      if (d > 4.2) continue;
      s.set(x, y, d > 3.2 ? (x + y < cx + cy ? P.goldLight : P.goldDark) : y < cy ? P.waterShallow : P.water);
    }
  }
  s.set(cx - 1, cy - 2, P.foam);
  s.set(cx - 2, cy - 1, P.foam);
}

/** The main room of the cabin: a steel bunk bed, a porthole, and the map once the explorer is a Cartographer. */
export function cabinMain(withMap: boolean): Sprite {
  const s = cabinRoom(withMap ? 'cabin_main_map' : 'cabin_main');
  porthole(s, 7, 6);
  if (withMap) put(s, wallMapArt(), 18, 2);
  else s.set(23, 4, P.steelDeep); // an empty hook
  // Bunk bed: a steel frame with two bunks and grey-blue blankets.
  for (let y = 5; y <= FLOOR + 1; y++) for (const x of [13, 29]) s.set(x, y, P.steelDeep);
  for (const by of [8, FLOOR - 1]) {
    for (let x = 14; x <= 28; x++) {
      s.set(x, by - 1, x < 17 ? P.paintWhite : P.paintBlue);
      s.set(x, by, x < 17 ? P.steelLight : P.paintBlueDark);
      s.set(x, by + 1, P.steelDark);
    }
  }
  // A ladder up to the top bunk.
  for (let y = 9; y <= FLOOR; y += 2) for (let x = 27; x <= 28; x++) s.set(x, y, P.steelLight);
  return s.outline();
}

/** A steel workbench with a vise, spanners on a pegboard, and an oil can. */
export function cabinWorkshop(): Sprite {
  const s = cabinRoom('cabin_workshop');
  // Pegboard with tools.
  for (let y = 2; y <= 8; y++) for (let x = 6; x <= 22; x++) s.set(x, y, x % 3 === 0 && y % 3 === 0 ? P.woodDark : P.woodCut);
  for (const [x0, len] of [[8, 5], [12, 4], [16, 6]]) {
    for (let y = 3; y < 3 + len; y++) s.set(x0, y, P.steelLight);
    s.set(x0 - 1, 3, P.steelDark);
    s.set(x0 + 1, 3, P.steelDark);
  }
  s.set(20, 3, P.paintRed);
  for (let y = 4; y <= 7; y++) s.set(20, y, P.steelDark);
  // The bench top, a vise on its left end, and its legs.
  for (let x = 4; x <= 26; x++) {
    s.set(x, FLOOR - 5, P.steelLight);
    s.set(x, FLOOR - 4, P.steelDark);
  }
  for (let y = FLOOR - 3; y <= FLOOR + 1; y++) for (const x of [5, 25]) s.set(x, y, P.steelDeep);
  for (let y = FLOOR - 8; y <= FLOOR - 6; y++) for (let x = 6; x <= 9; x++) s.set(x, y, y === FLOOR - 8 ? P.steelLight : P.steelDeep);
  s.set(10, FLOOR - 7, P.steelDark);
  s.set(11, FLOOR - 7, P.steelDark);
  // An oil can and a coil of rope on the bench.
  for (const [x, y, c] of [[18, 9, P.paintRed], [19, 9, P.paintRedDark], [18, 10, P.paintRed], [19, 10, P.paintRedDark], [20, 8, P.steelDark]] as const) s.set(x, y, c);
  for (const [x, y] of [[22, 10], [23, 10], [22, 9], [23, 9]]) s.set(x, y, P.straw);
  return s.outline();
}

/** An iron stove with a glowing window and a pipe up through the ceiling; a kettle on top. The fire flickers. */
export function cabinStove(frame: 0 | 1): Sprite {
  const s = cabinRoom(frame ? 'cabin_hearth_2' : 'cabin_hearth');
  // The pipe.
  for (let y = 0; y <= 6; y++) for (let x = 15; x <= 17; x++) s.set(x, y, x === 15 ? P.steelDark : P.steelDeep);
  // The stove body on short legs.
  for (let y = 7; y <= FLOOR; y++) {
    for (let x = 10; x <= 22; x++) s.set(x, y, y === 7 ? P.steelDark : x === 10 ? P.steelDark : P.coal);
  }
  for (const x of [11, 21]) s.set(x, FLOOR + 1, P.steelDeep);
  // The fire window.
  for (let y = 10; y <= 13; y++) {
    for (let x = 13; x <= 19; x++) {
      // Flames that lean one way, then the other.
      const tip = 11 + Math.round(Math.sin((x + frame * 2) * 1.3));
      s.set(x, y, y === 13 ? P.flameRed : y < tip ? P.interior : y === tip ? P.flameCore : y === 12 ? P.flameOrange : P.flame);
    }
  }
  // A kettle on the top.
  for (let x = 12; x <= 15; x++) for (let y = 4; y <= 6; y++) s.set(x, y, y === 4 ? P.steelLight : P.steel);
  s.set(16, 5, P.steel);
  // Steam from its spout.
  s.set(17, frame ? 3 : 4, P.steam);
  // Coal in a bucket beside it.
  for (let x = 24; x <= 28; x++) for (let y = FLOOR - 2; y <= FLOOR + 1; y++) s.set(x, y, y === FLOOR - 2 ? P.coalShine : x === 24 ? P.steel : P.steelDark);
  return s.outline();
}

/** A steel water tank with a blue band and a tap, filled by a pipe from the roof; a mug on a hook. */
export function cabinTank(): Sprite {
  const s = cabinRoom('cabin_barrel');
  for (let y = 0; y <= 6; y++) s.set(14, y, P.steelDeep);
  for (let y = 6; y <= FLOOR; y++) {
    for (let x = 9; x <= 20; x++) {
      s.set(x, y, y === 6 ? P.steelLight : y === 10 || y === 11 ? P.paintBlue : x <= 10 ? P.steelLight : x >= 19 ? P.steelDeep : P.steel);
    }
  }
  // A gauge, and the tap with a drop under it.
  for (const [x, y, c] of [[12, 8, P.paintWhite], [13, 8, P.paintWhite], [13, 7, P.outline]] as const) s.set(x, y, c);
  for (const [x, y] of [[21, 13], [22, 13], [22, 14]]) s.set(x, y, P.steelDark);
  s.set(22, 12, P.paintBlue);
  s.set(22, 16, P.waterShallow);
  // A mug on a hook.
  for (const [x, y, c] of [[26, 4, P.steelDark], [25, 5, P.paintWhite], [26, 5, P.paintWhite], [25, 6, P.paintWhite], [26, 6, P.paintWhite], [27, 5, P.paintWhite]] as const) s.set(x, y, c);
  return s.outline();
}

export function interiors(): Sprite[] {
  return [
    roomMain(false), roomMain(true), roomWorkshop(), roomHearth(0), roomHearth(1), roomBarrel(),
    cabinMain(false), cabinMain(true), cabinWorkshop(), cabinStove(0), cabinStove(1), cabinTank(),
  ];
}
