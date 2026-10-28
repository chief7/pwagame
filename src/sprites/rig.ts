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

export function deck(): Sprite[] {
  return [
    new Sprite('deck').paint((x, y) => deckPixel(x, y, 301, false)),
    new Sprite('deck_rust').paint((x, y) => deckPixel(x, y, 302, true)),
  ];
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

/** A yellow safety line just inside a deck tile's edge; laid over the deck where it meets the sea. */
export function deckRims(): Sprite[] {
  return (['n', 'e', 'w'] as const).map((d) => {
    const s = new Sprite(`deck_rim_${d}`);
    for (let i = 0; i < TILE; i++) {
      const c = Math.floor(i / 2) % 2 ? P.hazard : P.steelDeep;
      if (d === 'n') { s.set(i, 0, P.steelDeep); s.set(i, 1, c); }
      if (d === 'w') { s.set(0, i, P.steelDeep); s.set(1, i, c); }
      if (d === 'e') { s.set(15, i, P.steelDeep); s.set(14, i, c); }
    }
    return s;
  });
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

/** Two old red fuel drums: the rig's diesel. */
export function dieselDrums(): Sprite {
  const s = new Sprite('diesel_drums');
  for (const cx of [5, 11]) {
    for (let y = 5; y <= 14; y++) {
      for (let x = cx - 3; x <= cx + 2; x++) {
        const side = x - cx;
        let c: string = side === -2 ? P.paintRedLight : side >= 1 ? P.paintRedDark : P.paintRed;
        if (y === 8 || y === 12) c = side >= 1 ? P.outline : P.paintRedDark;
        if (side === -3) c = P.paintRed;
        if (hash2(x, y, 309 + cx) < 0.08) c = P.rust;
        s.set(x, y, c);
      }
    }
    // The lid, seen a little from above, with its cap.
    for (let x = cx - 3; x <= cx + 2; x++) {
      s.set(x, 3, P.steelLight);
      s.set(x, 4, P.steelDark);
    }
    s.set(cx, 3, P.steelDeep);
  }
  return s.outline().shadow(8, 15, 7.5, 1.2);
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
export function derrick(): Sprite {
  const s = new Sprite('derrick', 32, 48);
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
  s.set(15, 0, P.paintRed);
  s.set(16, 0, P.paintRed);
  // The deck house it stands on.
  for (let y = 39; y <= 46; y++) {
    for (let x = 1; x <= 30; x++) {
      s.set(x, y, y === 39 ? P.steelLight : y === 40 ? P.hazard : x <= 2 ? P.steel : x >= 29 ? P.steelDeep : hash2(x, y, 311) < 0.15 ? P.rust : P.steelDark);
    }
  }
  for (let y = 42; y <= 46; y++) for (let x = 14; x <= 17; x++) s.set(x, y, P.interior);
  return s.outline().shadow(16, 47, 15, 1.4);
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

/** The radio room: a small steel cabin with a bent aerial on its roof. */
export function radioHut(): Sprite {
  const s = new Sprite('radio_hut', 24, 28);
  for (let y = 14; y <= 26; y++) {
    for (let x = 3; x <= 18; x++) {
      let c: string = x <= 4 ? P.paintWhite : x >= 17 ? P.steelLight : y % 3 === 0 ? P.steelLight : P.paintWhite;
      if (hash2(x, Math.floor(y / 4), 312) < 0.12 && y > 16) c = P.rustLight;
      s.set(x, y, c);
    }
  }
  for (let x = 2; x <= 19; x++) {
    s.set(x, 12, P.steelLight);
    s.set(x, 13, P.steelDark);
  }
  for (let y = 18; y <= 26; y++) for (let x = 6; x <= 9; x++) s.set(x, y, x === 6 || y === 18 ? P.steelDeep : P.steelDark);
  for (let y = 16; y <= 19; y++) for (let x = 12; x <= 15; x++) s.set(x, y, P.glass);
  s.set(13, 17, P.waterGlint);
  // The aerial: a mast that bends over near the top.
  for (let y = 4; y <= 11; y++) {
    s.set(16, y, P.steelDark);
    if (y % 3 === 0) {
      s.set(15, y, P.steelDeep);
      s.set(17, y, P.steelDeep);
    }
  }
  for (const [x, y] of [[17, 3], [18, 2], [19, 2], [20, 3]]) s.set(x, y, P.steelDark);
  s.set(21, 4, P.paintRed);
  return s.outline().shadow(11, 27, 9.5, 1.3);
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
export function fishingBoatWreck(): Sprite {
  const s = new Sprite('fishing_boat_wreck', 24, 24);
  for (let y = 13; y <= 20; y++) {
    const inset = y > 17 ? (y - 17) * 2 : 0;
    for (let x = 1 + inset; x <= 22 - Math.max(0, inset - 1); x++) {
      s.set(x, y, y <= 14 ? P.paintWhite : y === 15 ? P.paintRed : y <= 18 ? (x < 5 ? P.paintBlue : P.paintBlueDark) : P.rustDark);
    }
  }
  // The raised bow on the right.
  for (const [x, y] of [[21, 12], [22, 12], [22, 11], [23, 11]]) s.set(x, y, P.paintWhite);
  // A hole to repair.
  for (const [x, y] of [[6, 16], [7, 16], [8, 17], [7, 17], [6, 17]]) s.set(x, y, P.interior);
  // Wheelhouse.
  for (let y = 6; y <= 12; y++) {
    for (let x = 12; x <= 18; x++) s.set(x, y, y === 6 ? P.paintRed : y === 7 ? P.paintRedDark : x === 18 ? P.steelLight : P.paintWhite);
  }
  for (let y = 9; y <= 10; y++) for (let x = 13; x <= 17; x++) s.set(x, y, P.glass);
  // Mast.
  for (let y = 1; y <= 12; y++) s.set(7, y, P.steelDark);
  for (let x = 5; x <= 9; x++) s.set(x, 4, P.steelDark);
  s.outline();
  // Foam where the hull meets the sea.
  for (let x = 2; x <= 21; x++) if (hash2(x, 21, 314) < 0.6) s.set(x, 21, P.foam);
  return s;
}

export function rigSprites(): Sprite[] {
  return [
    ...deck(), ...deckSide(), ...deckRims(), ...helipad(), ...gangway(), ...gangwayEnds(),
    container(), dieselDrums(), scrapPile(), lifeRing(), derrick(), crane(), radioHut(), crewCabin(), fishingBoatWreck(),
  ];
}
