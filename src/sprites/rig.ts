import { PALETTE as P } from './palette';
import { hash2, Sprite, type Color } from './pixel';

// The old oil rig: steel decks on legs over the sea, gangways between them,
// and the rusty machines and cabins that stand on them.

const TILE = 16;

/** Steel deck plate: a diamond tread, a seam on two sides and a rivet in each corner. */
function deckPixel(x: number, y: number, seed: number, rusty: boolean): Color {
  const tx = x % TILE;
  const ty = y % TILE;
  if (ty === 15 && tx % 8 !== 4) return P.steelDark;
  if ((tx === 2 || tx === 13) && ty === 13) return P.steelDark;
  if (rusty && hash2(Math.floor(x / 2), Math.floor(y / 2), seed) < 0.12 + 0.25 * Math.max(0, 1 - Math.hypot(tx - 9, ty - 6) / 6)) {
    return hash2(x, y, seed + 1) < 0.35 ? P.rustDark : P.rust;
  }
  if ((tx % 4 === 1 && ty % 4 === 1) || (tx % 4 === 3 && ty % 4 === 3)) return P.steelLight;
  return hash2(x, y, seed + 2) < 0.08 ? P.steelDark : P.steel;
}

/** Open sea in the shade under a platform's edge. */
function shadedWater(x: number, y: number, seed: number): Color {
  const n = hash2(x, y, seed);
  if (y < 9) return n < 0.12 ? P.waterDeep : P.waterShade;
  return n < (y - 8) / 8 ? P.water : P.waterDeep;
}

/** The sides a deck tile can have a safety line on, in the order its name lists them. */
const RIM_SIDES = ['n', 'e', 'w'] as const;

/**
 * Deck tiles: plain (`deck`) or rusty (`deck_rust`), each with a yellow and
 * black safety line along the sides that meet the sea: `deck_n`, `deck_rust_ew`…
 * (The south side has its line on the face below it, see deckSide.)
 */
export function deck(): Sprite[] {
  const tiles: Sprite[] = [];
  for (const [variant, seed, rusty] of [['', 301, false], ['_rust', 302, true]] as const) {
    for (let mask = 0; mask < 1 << RIM_SIDES.length; mask++) {
      const sides = RIM_SIDES.filter((_, i) => mask & (1 << i));
      const name = `deck${variant}${sides.length ? `_${sides.join('')}` : ''}`;
      tiles.push(new Sprite(name).paint((x, y) => {
        const stripe = Math.floor((sides.includes('n') && y <= 1 ? x : y) / 2) % 2 ? P.hazard : P.steelDeep;
        if (sides.includes('n') && y === 0) return P.steelDeep;
        if (sides.includes('w') && x === 0) return P.steelDeep;
        if (sides.includes('e') && x === 15) return P.steelDeep;
        if (sides.includes('n') && y === 1) return stripe;
        if (sides.includes('w') && x === 1) return stripe;
        if (sides.includes('e') && x === 14) return stripe;
        return deckPixel(x, y, seed, rusty);
      }));
    }
  }
  return tiles;
}

/**
 * The south face of a platform, drawn on the sea cell under its edge: a riveted
 * girder, the shade under it and, on `deck_side_leg`, one of the legs going
 * down into the water with foam round it.
 */
export function deckSide(): Sprite[] {
  const side = (name: string, leg: boolean) => new Sprite(name).paint((x, y) => {
    if (leg && x >= 5 && x <= 10 && y >= 6) {
      if (y >= 14) return x === 5 || x === 10 ? P.foam : P.waterShade;
      return x <= 6 ? P.steelLight : x >= 9 ? P.steelDeep : y % 4 === 1 ? P.rust : P.steelDark;
    }
    if (leg && y === 14 && (x === 4 || x === 11)) return P.foam;
    if (y === 0) return P.hazard;
    if (y === 1) return P.steelDeep;
    if (y >= 2 && y <= 4) return x % 4 === 2 && y === 3 ? P.steelLight : hash2(x, y, 303) < 0.15 ? P.rust : P.steelDark;
    if (y === 5) return P.steelDeep;
    return shadedWater(x, y, 304);
  });
  return [side('deck_side', false), side('deck_side_leg', true)];
}

/** One painted landing circle with an H, cut into 3 × 3 deck tiles (`helipad_0` … `helipad_8`). */
export function helipad(): Sprite[] {
  const tiles: Sprite[] = [];
  for (let ty = 0; ty < 3; ty++) {
    for (let tx = 0; tx < 3; tx++) {
      tiles.push(new Sprite(`helipad_${ty * 3 + tx}`).paint((x, y) => {
        const X = tx * TILE + x;
        const Y = ty * TILE + y;
        const base = deckPixel(X, Y, 305, false);
        // Worn paint: some pixels show the steel through it.
        if (hash2(X, Y, 306) < 0.1) return base;
        const d = Math.hypot(X + 0.5 - 24, Y + 0.5 - 24);
        if (d >= 18 && d <= 20.5) return P.hazard;
        const bar = (X >= 15 && X <= 18) || (X >= 29 && X <= 32);
        if ((bar && Y >= 14 && Y <= 33) || (X >= 15 && X <= 32 && Y >= 22 && Y <= 25)) return P.paintWhite;
        return base;
      }));
    }
  }
  return tiles;
}

type Dir = 'n' | 's' | 'e' | 'w';

/** Map a point along (a) and across (b) a gangway to the tile, for a gangway that runs towards `dir`. */
function along(dir: Dir, a: number, b: number): [number, number] {
  switch (dir) {
    case 'e': return [a, b];
    case 'w': return [15 - a, b];
    case 's': return [b, a];
    case 'n': return [b, 15 - a];
  }
}

/** Grating with yellow hand rails, from a = 0 up to `reach(b)` along it. */
function grating(s: Sprite, dir: Dir, reach: (b: number) => number): void {
  for (let b = 4; b <= 11; b++) {
    for (let a = 0; a <= reach(b); a++) {
      const [x, y] = along(dir, a, b);
      const rail = b === 4 || b === 11;
      const c = rail ? (a % 4 === 0 ? P.steelDeep : b === 4 ? P.hazard : P.hazardDark)
        : a % 2 === 0 || b % 2 === 0 ? (hash2(a, b, 307) < 0.15 ? P.rust : P.steel)
        : P.steelDeep;
      s.set(x, y, c);
    }
  }
}

/** A steel gangway over the sea; `ns` is walked north–south. */
export function gangway(): Sprite[] {
  return (['ns', 'ew'] as const).map((d) => {
    const s = new Sprite(`gangway_${d}`);
    grating(s, d === 'ns' ? 's' : 'e', () => 15);
    return s.outline();
  });
}

/**
 * The broken end of a gangway, still fixed on one side; `gangway_end_e` breaks
 * off towards the east. The grating ends in a ragged edge and one rail hangs down.
 */
export function gangwayEnds(): Sprite[] {
  const jag = [0, 6, 8, 5, 9, 6, 7, 4, 0];
  return (['n', 's', 'e', 'w'] as const).map((dir) => {
    const s = new Sprite(`gangway_end_${dir}`);
    grating(s, dir, (b) => (b === 4 ? 9 : b === 11 ? 5 : jag[b - 3]));
    // The bent rail droops towards the water.
    for (const [a, b] of [[10, 4], [11, 3], [12, 3]]) {
      const [x, y] = along(dir, a, b);
      s.set(x, y, P.hazardDark);
    }
    return s.outline();
  });
}

/** A rusty shipping container with ribbed sides: scrap metal. */
export function container(): Sprite {
  const s = new Sprite('rig_container');
  for (let y = 4; y <= 14; y++) {
    for (let x = 1; x <= 14; x++) {
      // The lid is lit; the front has upright ribs, darker to the right.
      const c = y === 4 ? P.rustLight
        : y <= 6 ? (hash2(x, y, 308) < 0.2 ? P.rustDark : P.rust)
        : y === 7 ? P.rustDark
        : x >= 13 ? P.rustDark
        : x % 2 === 0 ? P.rustLight : P.rust;
      s.set(x, y, c);
    }
  }
  return s.outline().shadow(8, 15, 7.5, 1.2);
}

/** Two old red fuel drums: the rig's diesel. Empty ones are faded, with their lids off. */
function drums(name: string, empty: boolean): Sprite {
  const s = new Sprite(name);
  const [light, mid, dark] = empty ? [P.rustLight, P.rust, P.rustDark] : [P.paintRedLight, P.paintRed, P.paintRedDark];
  for (const cx of [5, 11]) {
    for (let y = 5; y <= 14; y++) {
      for (let x = cx - 3; x <= cx + 2; x++) {
        const side = x - cx;
        let c: string = side === -2 ? light : side >= 1 ? dark : mid;
        if (y === 8 || y === 12) c = side >= 1 ? P.outline : dark;
        if (side === -3) c = mid;
        if (hash2(x, y, 309 + cx) < (empty ? 0.25 : 0.08)) c = empty ? P.steelDark : P.rust;
        s.set(x, y, c);
      }
    }
    // The lid, seen a little from above, with its cap (or the dark hole where it was).
    for (let x = cx - 3; x <= cx + 2; x++) {
      s.set(x, 3, P.steelLight);
      s.set(x, 4, empty && x > cx - 3 && x < cx + 2 ? P.interior : P.steelDark);
    }
    if (!empty) s.set(cx, 3, P.steelDeep);
  }
  return s.outline().shadow(8, 15, 7.5, 1.2);
}

export function dieselDrums(): Sprite[] {
  return [drums('diesel_drums', false), drums('diesel_drums_empty', true)];
}

/** A wooden pallet left on the deck: firewood. */
export function pallet(): Sprite {
  const s = new Sprite('pallet');
  // Top boards across three runners, seen a little from above.
  for (let y = 7; y <= 12; y++) {
    for (let x = 1; x <= 14; x++) {
      const gap = y === 9 || y === 11;
      s.set(x, y, gap ? P.woodDeep : y === 7 ? P.woodLight : x < 4 ? P.woodLight : hash2(x, y, 315) < 0.2 ? P.woodDark : P.wood);
    }
  }
  for (const x of [1, 7, 14]) for (let y = 13; y <= 14; y++) s.set(x, y, P.woodDark);
  for (let x = 1; x <= 14; x++) if (![1, 7, 14].includes(x)) s.set(x, 13, P.woodDeep);
  return s.outline().shadow(8, 15, 7.5, 1);
}

/** A heap of old fishing net with a float: rope. */
export function oldNet(): Sprite {
  const s = new Sprite('old_net');
  for (let y = 6; y <= 14; y++) {
    for (let x = 1; x <= 14; x++) {
      const d = Math.hypot((x + 0.5 - 7.5) / 6.8, (y + 0.5 - 11) / 4.6);
      if (d > 1) continue;
      // Knots where the cords cross, and holes between them.
      const knot = (x + y) % 3 === 0 || (x - y + 30) % 3 === 0;
      s.set(x, y, knot ? (x + y < 17 ? P.strawLight : P.straw) : d < 0.6 ? P.strawDeep : P.strawDark);
    }
  }
  // A round red float caught in the net.
  for (const [x, y, c] of [[10, 7, P.paintRedLight], [11, 7, P.paintRed], [10, 8, P.paintRed], [11, 8, P.paintRedDark]] as const) s.set(x, y, c);
  return s.outline().shadow(8, 15, 7, 1.1);
}

/** A grey tank that catches rain water, with a tap at the bottom. */
export function waterTank(): Sprite {
  const s = new Sprite('water_tank', 16, 20);
  for (let y = 3; y <= 17; y++) {
    for (let x = 2; x <= 13; x++) {
      const band = y === 7 || y === 13;
      s.set(x, y, y === 3 ? P.steelLight : band ? P.steelDeep : x <= 3 ? P.steelLight : x >= 12 ? P.steelDeep : P.steel);
    }
  }
  // The funnel on top that catches the rain, and a drop on the tap.
  for (let x = 4; x <= 11; x++) s.set(x, 2, P.steelDark);
  for (let x = 5; x <= 10; x++) s.set(x, 1, P.steelLight);
  s.set(7, 2, P.waterShallow);
  s.set(8, 2, P.water);
  for (const [x, y, c] of [[13, 15, P.paintBlue], [14, 15, P.paintBlue], [14, 16, P.paintBlueDark]] as const) s.set(x, y, c);
  s.outline().shadow(8, 19, 7, 1.1);
  s.set(14, 18, P.waterShallow);
  return s;
}

/** Black mussels on a rig leg at the waterline, in a fringe of weed; picked, only a few are left. */
export function musselBed(): Sprite[] {
  const bed = (name: string, picked: boolean) => {
    const s = new Sprite(name);
    // Green weed hanging down the leg.
    for (const [x, y0] of [[5, 7], [7, 8], [9, 7], [11, 9], [4, 10]]) {
      for (let y = y0; y <= 14; y++) s.set(x, y, (x + y) % 3 ? P.moss : P.leafDark);
    }
    const shells: [number, number][] = [[4, 11], [7, 10], [10, 11], [5, 13], [9, 13], [12, 12], [7, 13]];
    for (const [cx, cy] of picked ? shells.slice(0, 2) : shells) {
      // A mussel: a dark oval with a pale shine on top.
      s.set(cx, cy, P.paintBlue);
      s.set(cx + 1, cy, P.steelLight);
      s.set(cx, cy + 1, P.paintBlueDark);
      s.set(cx + 1, cy + 1, P.paintBlueDark);
      s.set(cx + 2, cy + 1, P.outline);
    }
    return s.outline();
  };
  return [bed('mussel_bed', false), bed('mussel_bed_picked', true)];
}

/** Item icons for the rig: scrap metal, a can of diesel and a handful of mussels. */
export function rigItemIcons(): Sprite[] {
  const scrap = new Sprite('item_scrap');
  // A bent plate and a short pipe.
  for (let y = 7; y <= 13; y++) {
    for (let x = 2 + Math.max(0, 9 - y); x <= 12; x++) scrap.set(x, y, y === 7 ? P.rustLight : hash2(x, y, 316) < 0.3 ? P.rustDark : P.rust);
  }
  for (let i = 0; i <= 8; i++) {
    scrap.set(4 + i, 7 - Math.round(i * 0.5), P.steelLight);
    scrap.set(4 + i, 8 - Math.round(i * 0.5), P.steelDark);
  }
  scrap.outline();
  const can = new Sprite('item_diesel');
  for (let y = 4; y <= 14; y++) {
    for (let x = 4; x <= 11; x++) can.set(x, y, x === 4 ? P.paintRedLight : x >= 10 ? P.paintRedDark : y === 8 ? P.paintRedDark : P.paintRed);
  }
  for (const [x, y] of [[5, 2], [6, 2], [7, 2], [5, 3], [7, 3]]) can.set(x, y, P.steelDark);
  for (const [x, y] of [[9, 3], [10, 2]]) can.set(x, y, P.steelLight);
  can.outline();
  const mussels = new Sprite('item_mussels');
  for (const [cx, cy, flip] of [[5, 9, false], [10, 8, true], [8, 12, false]] as const) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (Math.hypot(dx / 3.2, dy / 2.2) > 1) continue;
        const lit = flip ? dx > 0 && dy < 0 : dx < 0 && dy < 0;
        mussels.set(cx + dx, cy + dy, lit ? P.paintBlue : dy > 0 ? P.outline : P.paintBlueDark);
      }
    }
  }
  mussels.outline();
  return [scrap, can, mussels];
}

/** Bent pipes on a rusty plate: scrap metal to pick up. */
export function scrapPile(): Sprite {
  const s = new Sprite('scrap_pile');
  for (let y = 9; y <= 14; y++) {
    for (let x = 2 + Math.max(0, 11 - y); x <= 13 - Math.max(0, y - 13); x++) {
      s.set(x, y, hash2(x, y, 310) < 0.3 ? P.rustDark : y === 9 ? P.rustLight : P.rust);
    }
  }
  for (let x = 3; x <= 12; x++) {
    s.set(x, 7, P.steelLight);
    s.set(x, 8, P.steel);
  }
  s.set(13, 7, P.steelDeep);
  s.set(13, 8, P.steelDeep);
  for (let i = 0; i <= 6; i++) {
    s.set(5 + i, 12 - i, P.steelLight);
    s.set(6 + i, 12 - i, P.steelDark);
  }
  return s.outline().shadow(8, 15, 7, 1.2);
}

/** A red and white life ring. */
export function lifeRing(): Sprite {
  const s = new Sprite('life_ring');
  for (let y = 3; y <= 14; y++) {
    for (let x = 2; x <= 13; x++) {
      const dx = x + 0.5 - 8;
      const dy = y + 0.5 - 9;
      const d = Math.hypot(dx / 5.2, dy / 4.6);
      if (d > 1 || d < 0.5) continue;
      const quarter = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 2)) + 0.5) % 2;
      const lit = dx + dy < 0;
      s.set(x, y, quarter ? (lit ? P.paintWhite : P.steelLight) : lit ? P.paintRed : P.paintRedDark);
    }
  }
  return s.outline().shadow(8, 14.6, 6, 1);
}

/** The old drilling tower in the middle of the rig: a tall steel lattice on a deck house. */
/** How the derrick is: broken, repaired and resting (its pump refills), or pumping diesel (2 frames). */
type DerrickState = 'broken' | 'idle' | 'on';

function derrickSprite(name: string, state: DerrickState, frame: 0 | 1 = 0): Sprite {
  const s = new Sprite(name, 32, 48);
  const top = 4;
  const foot = 40;
  const left = (y: number) => 4 + ((foot - y) / (foot - top)) * 8;
  const right = (y: number) => 27 - ((foot - y) / (foot - top)) * 8;
  for (let y = top; y <= foot; y++) {
    const l = Math.round(left(y));
    const r = Math.round(right(y));
    s.set(l, y, P.rustLight);
    s.set(l + 1, y, P.rust);
    s.set(r - 1, y, P.rust);
    s.set(r, y, P.rustDark);
    // A cross bar every 6 rows, and diagonals between them.
    if (y % 6 === 0) for (let x = l + 2; x <= r - 2; x++) s.set(x, y, x < (l + r) / 2 ? P.rustLight : P.rust);
    const t = (y % 6) / 6;
    s.set(Math.round(l + 2 + t * (r - l - 4)), y, P.rustDark);
    s.set(Math.round(r - 2 - t * (r - l - 4)), y, P.rustDark);
  }
  // The crown block on top, with a red warning light.
  for (let y = 1; y <= 4; y++) for (let x = 11; x <= 20; x++) s.set(x, y, y === 1 ? P.steelLight : x === 20 ? P.steelDeep : P.steelDark);
  // The deck house it stands on.
  for (let y = 39; y <= 46; y++) {
    for (let x = 1; x <= 30; x++) {
      s.set(x, y, y === 39 ? P.steelLight : y === 40 ? P.hazard : x <= 2 ? P.steel : x >= 29 ? P.steelDeep : hash2(x, y, 311) < 0.15 ? P.rust : P.steelDark);
    }
  }
  for (let y = 42; y <= 46; y++) for (let x = 14; x <= 17; x++) s.set(x, y, P.interior);
  if (state !== 'broken') {
    // A yellow pump next to the door, with a red valve wheel.
    for (let y = 41; y <= 46; y++) for (let x = 20; x <= 26; x++) s.set(x, y, y === 41 ? P.hazard : x === 26 ? P.hazardDark : y % 2 ? P.hazard : P.hazardDark);
    for (const [x, y] of [[22, 39], [23, 38], [24, 39], [23, 40]]) s.set(x, y, P.paintRed);
  }
  s.outline().shadow(16, 47, 15, 1.4);
  // The light on top: dark while broken, red when repaired, and it blinks bright while the pump works.
  const lamp = state === 'broken' ? P.steelDeep : state === 'on' && frame === 1 ? P.flameCore : P.paintRed;
  s.set(15, 0, lamp);
  s.set(16, 0, lamp);
  if (state === 'on') {
    // A puff from the pump's exhaust.
    const puff = frame === 0 ? [[27, 37], [28, 36]] : [[28, 35], [29, 34], [28, 34]];
    for (const [x, y] of puff) s.set(x, y, P.steam);
  }
  return s;
}

export function derrick(): Sprite[] {
  return [
    derrickSprite('derrick', 'broken'),
    derrickSprite('derrick_idle', 'idle'),
    derrickSprite('derrick_working', 'on', 0),
    derrickSprite('derrick_working_2', 'on', 1),
  ];
}

/** A yellow deck crane with its arm out over the sea and a hook on a cable. */
export function crane(): Sprite {
  const s = new Sprite('crane', 24, 32);
  // Pedestal and cab.
  for (let y = 24; y <= 30; y++) for (let x = 3; x <= 7; x++) s.set(x, y, x === 3 ? P.steelLight : x === 7 ? P.steelDeep : P.steelDark);
  for (let y = 17; y <= 23; y++) {
    for (let x = 1; x <= 9; x++) s.set(x, y, y === 17 ? P.hazard : x === 9 ? P.hazardDark : y > 21 ? P.hazardDark : P.hazard);
  }
  for (let y = 18; y <= 20; y++) for (let x = 6; x <= 8; x++) s.set(x, y, P.glass);
  // The arm: two rails with lattice between them, up to the right.
  for (let i = 0; i <= 15; i++) {
    const x = 5 + i;
    const y = 16 - Math.round(i * 0.85);
    s.set(x, y, P.hazard);
    s.set(x, y + 1, i % 2 ? P.hazardDark : P.steelDeep);
    s.set(x, y + 2, P.hazardDark);
  }
  s.outline().shadow(5, 31, 5, 1.2);
  // The cable goes on after the outline so it stays one pixel thin.
  for (let y = 5; y <= 13; y++) s.set(20, y, P.steelDeep);
  s.set(19, 14, P.steelDeep);
  s.set(20, 14, P.steelLight);
  s.set(21, 14, P.steelDeep);
  s.set(21, 13, P.steelDeep);
  return s;
}

/** How far the radio room is repaired (the stages of the rig's goal). */
export type RadioStage = 'site' | 'aerial' | 'power' | 'ready';

/**
 * The radio room: a small steel cabin with an aerial on its roof. At first
 * the aerial is bent over; then it stands straight, then a generator stands
 * next to the cabin, and the working radio lights the window and blinks.
 */
function radioRoom(name: string, stage: RadioStage, frame: 0 | 1 = 0): Sprite {
  const s = new Sprite(name, 24, 28);
  const fixed = stage !== 'site';
  for (let y = 14; y <= 26; y++) {
    for (let x = 3; x <= 18; x++) {
      let c: string = x <= 4 ? P.paintWhite : x >= 17 ? P.steelLight : y % 3 === 0 ? P.steelLight : P.paintWhite;
      if (hash2(x, y, 312) < 0.06 && y > 16) c = P.rustLight;
      s.set(x, y, c);
    }
  }
  for (let x = 2; x <= 19; x++) {
    s.set(x, 12, P.steelLight);
    s.set(x, 13, P.steelDark);
  }
  for (let y = 18; y <= 26; y++) for (let x = 6; x <= 9; x++) s.set(x, y, x === 6 || y === 18 ? P.steelDeep : P.steelDark);
  // The window: dark until the radio works, then warm light inside.
  for (let y = 16; y <= 19; y++) for (let x = 12; x <= 15; x++) s.set(x, y, stage === 'ready' ? (y === 16 ? P.flame : P.flameCore) : P.glass);
  if (stage !== 'ready') s.set(13, 17, P.waterGlint);
  // The aerial: a mast with cross bars, bent over at the top until it is mended.
  for (let y = fixed ? 1 : 4; y <= 11; y++) {
    s.set(16, y, P.steelDark);
    if (y % 3 === 0) {
      s.set(15, y, P.steelDeep);
      s.set(17, y, P.steelDeep);
    }
  }
  if (!fixed) for (const [x, y] of [[17, 3], [18, 2], [19, 2], [20, 3]]) s.set(x, y, P.steelDark);
  if (stage === 'power' || stage === 'ready') {
    // A yellow generator next to the cabin.
    for (let y = 20; y <= 26; y++) {
      for (let x = 19; x <= 23; x++) s.set(x, y, y === 20 ? P.hazard : x === 23 ? P.hazardDark : y % 2 && x > 19 && x < 23 ? P.steelDeep : P.hazard);
    }
  }
  s.outline().shadow(12, 27, 10.5, 1.3);
  // The light on top: red, and bright when the working radio blinks.
  const tip: [number, number] = fixed ? [16, 0] : [21, 4];
  s.set(tip[0], tip[1], stage === 'ready' && frame === 1 ? P.flameCore : P.paintRed);
  return s;
}

export function radioHut(): Sprite[] {
  return [
    radioRoom('radio_hut', 'site'),
    radioRoom('radio_aerial', 'aerial'),
    radioRoom('radio_power', 'power'),
    radioRoom('radio_ready', 'ready', 0),
    radioRoom('radio_ready_2', 'ready', 1),
  ];
}

/** The crew cabin: a blue steel block with windows, the camp on the rig. */
export function crewCabin(): Sprite {
  const s = new Sprite('crew_cabin', 24, 24);
  for (let y = 8; y <= 22; y++) {
    for (let x = 2; x <= 21; x++) {
      let c: string = y === 8 ? P.steelLight : y === 9 ? P.steel : x <= 3 ? P.paintBlue : x >= 20 ? P.paintBlueDark : x % 3 === 0 ? P.paintBlueDark : P.paintBlue;
      if (y > 15 && hash2(x, y, 313) < 0.08) c = P.rust;
      s.set(x, y, c);
    }
  }
  for (const wx of [5, 10]) {
    for (let y = 12; y <= 15; y++) {
      for (let x = wx; x <= wx + 3; x++) {
        s.set(x, y, x === wx || y === 12 || x === wx + 3 || y === 15 ? P.paintWhite : P.glass);
      }
    }
    // Rust running down under the window.
    s.set(wx + 1, 16, P.rust);
    s.set(wx + 1, 17, P.rustDark);
  }
  for (let y = 15; y <= 22; y++) for (let x = 15; x <= 18; x++) s.set(x, y, x === 15 || y === 15 ? P.steelDeep : P.steelDark);
  s.set(17, 19, P.hazard);
  return s.outline().shadow(12, 23, 10.5, 1.3);
}

/** An old fishing boat tied up at the rig, with a hole in its side. */
/** Left and right edge of the boat's hull at row y: a low stern on the left, a raised bow on the right. */
function boatHull(y: number): [number, number] {
  const keel = Math.max(0, y - 21);
  return [2 + keel * 2 + (y < 18 ? 1 : 0), (y < 16 ? 46 - (16 - y) : 45) - keel * 2];
}

function fishingBoatSprite(name: string, repaired: boolean): Sprite {
  const s = new Sprite(name, 48, 28);
  // The hull: a white band, a red line, the blue side and a dark keel.
  for (let y = 13; y <= 24; y++) {
    const [l, r] = boatHull(y);
    for (let x = l; x <= r; x++) {
      let c: string = y <= 15 ? (x < l + 3 ? P.paintWhite : y === 13 ? P.steelLight : P.paintWhite)
        : y === 16 ? P.paintRed
        : y <= 21 ? (x < l + 4 ? P.paintBlue : P.paintBlueDark)
        : P.rustDark;
      // The old boat is rusty and patchy; the repaired one has fresh paint.
      if (!repaired && y > 16 && hash2(x, y, 317) < 0.15) c = P.rust;
      s.set(x, y, c);
    }
  }
  // Portholes along the side.
  for (const x of [20, 26, 32]) s.set(x, 18, P.glass);
  // A hole to repair, or the plate bolted over it.
  for (const [x, y] of [[9, 18], [10, 18], [11, 19], [10, 19], [9, 19], [10, 20]]) s.set(x, y, repaired ? P.steel : P.interior);
  // Wheelhouse with windows and a red roof.
  for (let y = 4; y <= 12; y++) {
    for (let x = 24; x <= 35; x++) {
      s.set(x, y, y === 4 ? P.paintRed : y === 5 ? P.paintRedDark : x === 35 ? P.steelLight : x === 24 ? P.steel : P.paintWhite);
    }
  }
  for (let y = 7; y <= 8; y++) for (const x0 of [26, 31]) for (let x = x0; x < x0 + 3; x++) s.set(x, y, P.glass);
  // A net drum and a crate on the open deck at the stern.
  for (let y = 9; y <= 12; y++) for (let x = 6; x <= 11; x++) s.set(x, y, y === 9 ? P.straw : (x + y) % 2 ? P.strawDark : P.straw);
  for (let y = 10; y <= 12; y++) for (let x = 14; x <= 18; x++) s.set(x, y, y === 10 ? P.woodLight : P.wood);
  // Mast with a boom, and a little flag once it can sail.
  for (let y = 0; y <= 12; y++) s.set(20, y, P.steelDark);
  for (let i = 0; i <= 8; i++) s.set(20 - i, 3 + Math.round(i * 0.6), P.steelDark);
  if (repaired) for (const [x, y] of [[21, 0], [22, 0], [23, 0], [21, 1], [22, 1]]) s.set(x, y, P.hazard);
  s.outline();
  // Foam where the hull meets the sea.
  for (let x = 4; x <= 43; x++) if (hash2(x, 25, 314) < 0.6) s.set(x, 25, P.foam);
  return s;
}

/** The old fishing boat at the rig's dock, with a hole in its side; and repaired, ready to sail. */
export function fishingBoat(): Sprite[] {
  return [fishingBoatSprite('fishing_boat_wreck', false), fishingBoatSprite('fishing_boat', true)];
}

/** A supply crate from the helicopter: a wooden crate with its orange parachute folded on top. */
export function supplyCrate(): Sprite {
  const s = new Sprite('supply_crate');
  for (let y = 6; y <= 14; y++) {
    for (let x = 2; x <= 13; x++) {
      const band = x === 2 || x === 13 || y === 14 || y === 9;
      s.set(x, y, band ? P.woodDark : x < 5 ? P.woodLight : (x + y) % 5 === 0 ? P.woodDark : P.wood);
    }
  }
  // The parachute cloth heaped on the lid, with its cords.
  for (let y = 2; y <= 6; y++) {
    const half = 2 + (y - 2) * 1.2;
    for (let x = Math.floor(8 - half); x <= Math.ceil(7 + half); x++) {
      const stripe = Math.floor((x + 1) / 3) % 2;
      s.set(x, y, stripe ? P.paintWhite : y < 4 ? P.flameOrange : P.flameRed);
    }
  }
  for (const [x, y] of [[3, 7], [12, 7], [4, 8], [11, 8]]) s.set(x, y, P.strawLight);
  return s.outline().shadow(8, 15, 7, 1.2);
}

/** The icon of the platform recipe: a piece of deck with its safety line, its face and a leg. */
export function platformIcon(): Sprite {
  const s = new Sprite('platform_deck');
  for (let y = 3; y <= 10; y++) {
    for (let x = 1; x <= 14; x++) {
      const edge = y === 3 || x === 1 || x === 14;
      const stripe = Math.floor((y === 3 ? x : y) / 2) % 2 ? P.hazard : P.steelDeep;
      s.set(x, y, edge ? stripe : deckPixel(x, y, 318, false));
    }
  }
  for (let x = 1; x <= 14; x++) {
    s.set(x, 11, P.hazard);
    s.set(x, 12, x % 4 === 2 ? P.steelLight : P.steelDark);
  }
  for (let y = 13; y <= 15; y++) for (const x of [4, 5, 10, 11]) s.set(x, y, x === 4 || x === 10 ? P.steelLight : P.steelDeep);
  return s.outline();
}

/** The supply helicopter, flying to the right: a white body with a red band, and a turning rotor (2 frames). */
function helicopterFrame(name: string, frame: 0 | 1): Sprite {
  const s = new Sprite(name, 32, 20);
  // The cabin: a rounded body with a glass nose on the right.
  for (let y = 5; y <= 13; y++) {
    for (let x = 12; x <= 27; x++) {
      const nx = (x + 0.5 - 20) / 8;
      const ny = (y + 0.5 - 9.5) / 4.6;
      if (nx * nx + ny * ny > 1) continue;
      const glass = x >= 23 && y <= 9;
      s.set(x, y, glass ? (y === 6 ? P.glassLight : P.glass) : y === 10 ? P.paintRed : y <= 6 ? P.paintWhite : y >= 12 ? P.steelLight : P.paintWhite);
    }
  }
  // The tail boom to the left, with a red fin and a small rotor.
  for (let x = 2; x <= 12; x++) {
    s.set(x, 8, P.paintWhite);
    s.set(x, 9, x % 3 === 0 ? P.paintRed : P.steelLight);
  }
  for (const [x, y] of [[2, 5], [3, 5], [2, 6], [3, 6], [2, 7], [3, 7]]) s.set(x, y, P.paintRed);
  // Skids under the cabin.
  for (let x = 13; x <= 26; x++) s.set(x, 16, P.steelDark);
  for (const x of [15, 24]) for (let y = 14; y <= 15; y++) s.set(x, y, P.steelDark);
  // The mast for the rotor.
  for (const [x, y] of [[19, 4], [20, 4], [19, 3], [20, 3]]) s.set(x, y, P.steelDark);
  s.outline();
  // The rotor goes on after the outline so the blades stay thin: long in one frame, seen end-on in the other.
  const reach = frame === 0 ? 13 : 6;
  for (let x = 20 - reach; x <= 19 + reach; x++) s.set(x, 2, P.steelDeep);
  const tail = frame === 0 ? [[1, 4], [1, 9]] : [[0, 7], [4, 6]];
  for (const [x, y] of tail) s.set(x, y, P.steelDeep);
  return s;
}

export function helicopter(): Sprite[] {
  return [helicopterFrame('helicopter', 0), helicopterFrame('helicopter_2', 1)];
}

export function rigSprites(): Sprite[] {
  return [
    ...deck(), ...deckSide(), ...helipad(), ...gangway(), ...gangwayEnds(),
    container(), ...dieselDrums(), scrapPile(), lifeRing(), ...derrick(), crane(), ...radioHut(), crewCabin(), ...fishingBoat(),
    pallet(), oldNet(), waterTank(), ...musselBed(), ...rigItemIcons(), supplyCrate(), platformIcon(), ...helicopter(),
  ];
}
