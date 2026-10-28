import { PALETTE as P } from './palette';
import { LOOKS } from './characters';
import { hash2, Sprite } from './pixel';

// Things the explorer builds.

/** Stone ring, crossed logs and a flame; two frames that flicker. */
function campfireFrame(name: string, frame: 0 | 1): Sprite {
  const s = new Sprite(name);
  // Ring of stones.
  for (let a = 0; a < 12; a++) {
    const t = (a / 12) * Math.PI * 2;
    const x = Math.round(7.5 + Math.cos(t) * 5.5);
    const y = Math.round(12 + Math.sin(t) * 2.5);
    s.set(x, y, a % 3 === 0 ? P.stoneLight : y > 12 ? P.stoneDark : P.stone);
  }
  // Crossed logs.
  for (let i = 0; i < 7; i++) {
    s.set(4 + i, 13 - Math.floor(i / 2), i % 2 ? P.wood : P.woodDark);
    s.set(11 - i, 13 - Math.floor(i / 2), i % 2 ? P.woodLight : P.wood);
  }
  // Flame: outer red/orange, inner yellow, white-hot core; leans differently per frame.
  const lean = frame === 0 ? -0.4 : 0.4;
  for (let y = 3; y <= 11; y++) {
    const t = (y - 3) / 8;
    const half = 0.6 + t * 2.6;
    const cx = 7.5 + lean * (1 - t) * 2;
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const d = Math.abs(x + 0.5 - cx) / (half + 0.3);
      if (d > 1) continue;
      const heat = (1 - d) * (0.4 + t * 0.6);
      s.set(x, y, heat > 0.55 ? P.flameCore : heat > 0.35 ? P.flame : heat > 0.15 ? P.flameOrange : P.flameRed);
    }
  }
  // A spark drifting up.
  s.set(frame === 0 ? 5 : 10, frame === 0 ? 2 : 1, P.flame);
  return s.outline().shadow(8, 14.6, 7, 1.2);
}

export function campfire(): Sprite[] {
  return [campfireFrame('campfire', 0), campfireFrame('campfire_2', 1)];
}

/** A-frame tent of big leaves on a stick frame: the first shelter. */
export function leanTo(): Sprite {
  const s = new Sprite('lean_to', 20, 20);
  const apexX = 10;
  for (let y = 3; y <= 18; y++) {
    const half = 1 + (y - 3) * 0.6;
    for (let x = Math.floor(apexX - half); x <= Math.ceil(apexX - 1 + half); x++) {
      const side = (x + 0.5 - apexX) / (half + 0.5);
      if (Math.abs(side) > 1) continue;
      // Overlapping leaf rows: stripes that run down each slope.
      const stripe = (y + Math.round(Math.abs(x + 0.5 - apexX))) % 4;
      const lit = side < 0;
      let c: string = stripe === 0 ? P.leafDark : lit ? (hash2(x, y, 71) < 0.3 ? P.leafLight : P.leaf) : P.leaf;
      if (!lit && stripe !== 0 && hash2(x, y, 72) < 0.5) c = P.leafDark;
      s.set(x, y, c);
    }
  }
  // Dark doorway.
  for (let y = 11; y <= 18; y++) {
    const half = (y - 10) * 0.45;
    for (let x = Math.floor(apexX - half); x <= Math.ceil(apexX - 1 + half); x++) s.set(x, y, P.interior);
  }
  // Ridge pole poking out at the top.
  s.set(apexX - 1, 2, P.woodLight);
  s.set(apexX, 1, P.wood);
  return s.outline().shadow(10, 19, 9, 1.2);
}

/** Rooms a hut can grow: a workshop shed, a hearth (chimney) and a rain barrel. */
export type HutRoom = 'workshop' | 'hearth' | 'barrel';
export const HUT_ROOMS: HutRoom[] = ['workshop', 'hearth', 'barrel'];

/** Sprite name of a hut with these rooms, e.g. `hut`, `hut_workshop_barrel`; a hearth smokes in two frames. */
export function hutSpriteName(rooms: readonly HutRoom[], frame: 0 | 1 = 0): string {
  const parts = HUT_ROOMS.filter((r) => rooms.includes(r));
  return ['hut', ...parts].join('_') + (frame && parts.includes('hearth') ? '_2' : '');
}

/** The hut itself: plank walls on a stone footing, a door, a lit window and a thatched roof. */
function drawHut(s: Sprite): void {
  // Plank walls.
  for (let y = 14; y <= 24; y++) {
    for (let x = 4; x <= 19; x++) {
      const seam = (y - 14) % 3 === 2;
      s.set(x, y, seam ? P.woodDark : x < 7 ? P.woodLight : x > 17 ? P.woodDark : P.wood);
    }
  }
  // Stone footing.
  for (let y = 25; y <= 26; y++) {
    for (let x = 3; x <= 20; x++) {
      const joint = (x + (y === 25 ? 0 : 2)) % 4 === 0;
      s.set(x, y, joint ? P.stoneDark : y === 25 && x < 10 ? P.stoneLight : hash2(x, y, 74) < 0.3 ? P.stoneDark : P.stone);
    }
  }
  // Door and window.
  for (let y = 18; y <= 25; y++) for (let x = 10; x <= 13; x++) s.set(x, y, y === 18 || x === 10 ? P.woodDeep : P.interior);
  s.set(13, 22, P.gold);
  for (let y = 17; y <= 19; y++) for (let x = 15; x <= 17; x++) s.set(x, y, x === 16 || y === 18 ? P.woodDeep : P.flame);
  // Thatched roof overhanging the walls.
  for (let y = 2; y <= 15; y++) {
    const half = 3 + (y - 2) * 0.72;
    for (let x = Math.floor(12 - half); x <= Math.ceil(11 + half); x++) {
      const side = (x + 0.5 - 12) / (half + 0.5);
      if (Math.abs(side) > 1) continue;
      const row = (y - 2) % 3;
      const n = hash2(x, y, 73);
      let c: string = row === 2 ? P.strawDark : side < -0.2 ? (n < 0.4 ? P.strawLight : P.straw) : side > 0.5 ? P.strawDark : P.straw;
      if (y === 15) c = P.strawDeep;
      s.set(x, y, c);
    }
  }
}

/** A workbench under a plank awning against the left wall, with a log on it. */
function drawWorkshopShed(s: Sprite): void {
  // Shade under the awning, so the bench stands out from the wall.
  for (let y = 20; y <= 26; y++) for (let x = 1; x <= 6; x++) s.set(x, y, P.interior);
  // Awning posts.
  for (let y = 19; y <= 26; y++) {
    s.set(0, y, P.woodDark);
    s.set(7, y, P.woodDark);
  }
  // Plank roof sloping down to the left.
  for (let x = 0; x <= 8; x++) {
    const top = 16 + Math.floor((8 - x) / 3);
    for (let y = top; y <= 19; y++) s.set(x, y, y === top ? P.woodLight : y === 19 ? P.woodDeep : P.wood);
  }
  // Bench top and legs.
  for (let x = 1; x <= 6; x++) s.set(x, 23, x === 1 ? P.woodCut : P.woodLight);
  for (let x = 1; x <= 6; x++) s.set(x, 24, P.woodDark);
  for (let y = 25; y <= 26; y++) {
    s.set(2, y, P.woodDeep);
    s.set(5, y, P.woodDeep);
  }
  // A log on the bench, cut end showing.
  for (let x = 2; x <= 5; x++) s.set(x, 22, P.wood);
  s.set(2, 22, P.woodCut);
  s.set(3, 21, P.woodLight);
  s.set(4, 21, P.wood);
}

/** A stone chimney through the roof, with a puff of smoke that drifts in two frames. */
function drawChimney(s: Sprite, frame: 0 | 1): void {
  for (let y = 3; y <= 9; y++) {
    for (let x = 16; x <= 18; x++) {
      const joint = (y + (x === 17 ? 1 : 0)) % 3 === 0;
      s.set(x, y, y === 3 ? P.stoneDeep : joint ? P.stoneDark : x === 16 ? P.stoneLight : P.stone);
    }
  }
  // A small cloud: a 2×2 puff with a wisp that moves up and right.
  const [px, py] = frame === 0 ? [17, 1] : [18, 0];
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [2, frame === 0 ? -1 : 0]]) s.set(px + dx, py + dy, P.steam);
}

/** A rain barrel at the front right corner, full to the brim. */
function drawRainBarrel(s: Sprite): void {
  for (let y = 21; y <= 26; y++) {
    for (let x = 18; x <= 22; x++) {
      const hoop = y === 22 || y === 25;
      s.set(x, y, hoop ? (x === 18 ? P.hoopLight : P.hoop) : x === 18 ? P.woodLight : x === 22 ? P.woodDark : P.wood);
    }
  }
  for (let x = 18; x <= 22; x++) s.set(x, 20, x === 18 || x === 22 ? P.woodDark : P.waterShallow);
  s.set(19, 20, P.waterGlint);
}

/** Wooden hut with a thatched roof, and the rooms built onto it: the best home on the island. */
export function hut(rooms: readonly HutRoom[] = [], frame: 0 | 1 = 0): Sprite {
  const s = new Sprite(hutSpriteName(rooms, frame), 24, 28);
  drawHut(s);
  if (rooms.includes('hearth')) drawChimney(s, frame);
  if (rooms.includes('workshop')) drawWorkshopShed(s);
  if (rooms.includes('barrel')) drawRainBarrel(s);
  return s.outline().shadow(12, 27, 11, 1.3);
}

/** Every hut sprite: each set of rooms, with the second smoke frame where there is a hearth. */
export function huts(): Sprite[] {
  const out: Sprite[] = [];
  for (let mask = 0; mask < 1 << HUT_ROOMS.length; mask++) {
    const rooms = HUT_ROOMS.filter((_, i) => mask & (1 << i));
    out.push(hut(rooms));
    if (rooms.includes('hearth')) out.push(hut(rooms, 1));
  }
  return out;
}

/**
 * Plank bridge over a river cell, 16×16. `ns` is walked north–south
 * (planks run across), `ew` east–west.
 */
export function bridge(dir: 'ns' | 'ew'): Sprite {
  const s = new Sprite(`bridge_${dir}`);
  for (let a = 0; a < 16; a++) {
    for (let b = 3; b <= 12; b++) {
      // a runs along the walking direction, b across it.
      const [x, y] = dir === 'ns' ? [b, a] : [a, b];
      const gap = a % 4 === 3;
      const rail = b === 3 || b === 12;
      const c = rail ? (b === 3 ? P.woodLight : P.woodDark)
        : gap ? P.woodDeep
        : a % 4 === 0 ? P.woodLight
        : hash2(x, y, 80) < 0.15 ? P.woodDark : P.wood;
      s.set(x, y, c);
    }
  }
  // Rope lashings on the rails.
  for (const a of [1, 8, 14]) {
    for (const b of [3, 12]) {
      const [x, y] = dir === 'ns' ? [b, a] : [a, b];
      s.set(x, y, P.strawLight);
    }
  }
  return s.outline();
}

/** The stages of the island boat, from the old wreck on the beach to a boat ready to sail. */
export type BoatStage = 'wreck' | 'hull' | 'mast' | 'sail' | 'ready';

const BOAT_W = 24;
const BOAT_H = 30;
const DECK = 19;
const KEEL = 26;

/** Left and right edge of the hull at row y: a low stern on the left, a raked bow on the right. */
function hullSpan(y: number): [number, number] {
  const t = y - DECK;
  return [Math.round(2 + t * 0.45), Math.round(22 - t * 1.05)];
}

function drawHull(s: Sprite): void {
  for (let y = DECK; y <= KEEL; y++) {
    const [x0, x1] = hullSpan(y);
    for (let x = x0; x <= x1; x++) {
      const row = y - DECK;
      const seam = row % 3 === 2;
      let c: string = row === 0 ? P.woodLight : seam ? P.woodDark : row < 3 ? P.wood : P.woodDark;
      if (!seam && row > 0 && x <= x0 + 1) c = P.woodLight;
      if (!seam && x >= x1 - 1 && row > 0) c = P.woodDeep;
      if (y === KEEL) c = P.woodDeep;
      s.set(x, y, c);
    }
  }
  // Pegs along the top plank.
  for (let x = 5; x <= 19; x += 4) s.set(x, DECK + 1, P.woodCut);
}

function drawWreck(s: Sprite): void {
  // A grey keel along the sand and old ribs curving up from it.
  const [k0, k1] = hullSpan(KEEL);
  for (let x = k0 - 1; x <= k1 + 3; x++) s.set(x, KEEL, x < k0 + 3 ? P.driftLight : P.driftDark);
  const ribs = [[5, DECK], [9, DECK + 1], [13, DECK - 1], [17, DECK + 3]];
  for (const [rx, top] of ribs) {
    for (let y = top; y < KEEL; y++) {
      const [x0, x1] = hullSpan(y);
      const bend = Math.round((KEEL - y) * 0.15);
      s.set(Math.min(Math.max(rx - bend, x0), x1), y, y < top + 2 ? P.driftLight : P.drift);
    }
  }
  // Tall stern and bow posts.
  for (let y = DECK - 3; y < KEEL; y++) s.set(2 + Math.round((y - DECK + 3) * 0.3), y, y < DECK ? P.driftLight : P.drift);
  for (let y = DECK - 1; y < KEEL; y++) s.set(23 - Math.round((y - DECK + 1) * 0.6), y, P.driftDark);
}

function drawMast(s: Sprite): void {
  for (let y = 3; y < DECK; y++) {
    s.set(11, y, P.woodLight);
    s.set(12, y, P.wood);
  }
  s.set(11, 2, P.woodDark);
  s.set(12, 2, P.woodDark);
  // Boom along the bottom of the sail.
  for (let x = 12; x <= 20; x++) s.set(x, 17, x === 20 ? P.woodDark : P.wood);
}

/** Ropes from the mast top to bow and stern; drawn after the outline so they stay thin. */
function drawRigging(s: Sprite): void {
  const top: [number, number] = [11, 4];
  for (const [ex, ey] of [[2, DECK - 1], [22, DECK - 1]] as const) {
    const n = Math.max(Math.abs(ex - top[0]), Math.abs(ey - top[1]));
    for (let i = 1; i < n; i++) {
      const x = Math.round(top[0] + ((ex - top[0]) * i) / n);
      const y = Math.round(top[1] + ((ey - top[1]) * i) / n);
      if (!s.get(x, y) || s.get(x, y) === P.outline) s.set(x, y, P.strawDeep);
    }
  }
}

function drawSail(s: Sprite): void {
  // A triangle of woven, dried palm leaves: light near the mast, darker at the outer edge.
  for (let y = 4; y <= 16; y++) {
    const right = 13 + Math.round((y - 4) * 0.62);
    for (let x = 13; x <= right; x++) {
      const weave = (x + y) % 3 === 0;
      const edge = x === right;
      s.set(x, y, edge ? P.strawDark : weave ? P.strawDark : x < 15 ? P.strawLight : P.straw);
    }
  }
}

function drawSupplies(s: Sprite, frame: 0 | 1): void {
  // A small crate and coconuts on the deck at the stern.
  for (let y = 15; y <= 18; y++) {
    for (let x = 3; x <= 7; x++) s.set(x, y, y === 15 ? P.woodLight : x === 5 ? P.woodDark : P.wood);
  }
  for (const [x, y] of [[8, 18], [9, 17], [9, 18]]) s.set(x, y, P.coconutLight);
  // A red pennant at the mast top that waves.
  const rows = frame === 0 ? [[13, 2], [13, 3], [14, 2], [14, 3], [15, 2], [16, 2]] : [[13, 2], [13, 3], [14, 3], [15, 3], [16, 4], [15, 2]];
  for (const [x, y] of rows) s.set(x, y, y === 2 && x === 13 ? P.berryLight : P.berry);
}

function boatSprite(name: string, stage: BoatStage, frame: 0 | 1 = 0): Sprite {
  const s = new Sprite(name, BOAT_W, BOAT_H);
  if (stage === 'wreck') {
    drawWreck(s);
  } else {
    drawHull(s);
    if (stage !== 'hull') drawMast(s);
    if (stage === 'sail' || stage === 'ready') drawSail(s);
    if (stage === 'ready') drawSupplies(s, frame);
  }
  s.outline();
  if (stage !== 'wreck' && stage !== 'hull') drawRigging(s);
  return s.shadow(12, KEEL + 1.5, 11, 1.5);
}

/** The explorer standing on deck in front of the mast, seen from the side. */
function drawSailor(s: Sprite, body: 'male' | 'female'): void {
  const look = LOOKS[body];
  const rows = [
    '.hhh.',
    'hhhhh',
    'hssse',
    'hSsss',
    'ccccC',
    'ccccC',
  ];
  const key: Record<string, string> = { h: look.hair, s: look.skin, S: look.skinShade, e: P.outline, c: look.shirt, C: look.shirtShade };
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') s.set(6 + x, DECK - 6 + y, key[ch]);
  }));
  if (body === 'female') s.set(7, DECK - 6, P.flower);
}

/** Foam at the waterline and a bow wave; it moves between frames. */
function drawWake(s: Sprite, frame: 0 | 1): void {
  const [k0, k1] = hullSpan(KEEL);
  for (let x = k0 - 3; x <= k1 + 4; x++) {
    if ((x + frame) % 3 !== 0) s.set(x, KEEL + 1, P.foam);
    if ((x + frame) % 4 === 1 && x > k0) s.set(x - 2, KEEL + 2, P.waterShallow);
  }
  // The bow cuts a wave as the boat sails right.
  const bow = hullSpan(DECK + 3)[1] + 1;
  for (let i = 0; i < 3; i++) s.set(bow + i, KEEL - 1 - i + frame, P.foam);
}

/**
 * The ready boat under sail with the explorer on board, for the trip to the
 * next island: no ground shadow, foam along the waterline. 2 frames.
 */
function boatAwaySprite(body: 'male' | 'female', frame: 0 | 1): Sprite {
  const s = new Sprite(`boat_away_${body}${frame ? '_2' : ''}`, BOAT_W, BOAT_H);
  drawHull(s);
  drawMast(s);
  drawSail(s);
  drawSupplies(s, frame);
  drawSailor(s, body);
  s.outline();
  drawRigging(s);
  drawWake(s, frame);
  return s;
}

/** Both explorers on board, 2 frames each, sailing right and (mirrored, '…_left') left. */
export function boatAway(): Sprite[] {
  const right = (['male', 'female'] as const).flatMap((body) => [boatAwaySprite(body, 0), boatAwaySprite(body, 1)]);
  return [...right, ...right.map((s) => s.mirrored(s.name.replace(/(_2)?$/, (frame) => `_left${frame}`)))];
}

/** The boat in each stage; the ready boat has two frames for its pennant. */
export function boat(): Sprite[] {
  return [
    boatSprite('boat_wreck', 'wreck'),
    boatSprite('boat_hull', 'hull'),
    boatSprite('boat_mast', 'mast'),
    boatSprite('boat_sail', 'sail'),
    boatSprite('boat_ready', 'ready', 0),
    boatSprite('boat_ready_2', 'ready', 1),
  ];
}

// ---- Island 2: the signal beacon on the peak --------------------------------------

const BEACON_W = 24;
const BEACON_H = 28;
/** Bottom row of the stone base, and its top. */
const BASE_FOOT = 25;
const BASE_TOP = 19;

type BeaconStage = 'site' | 'base' | 'pyre' | 'ready';

/** One stone of a wall: a small shaded block, lit from the top left. */
function block(s: Sprite, x0: number, y0: number, w: number, h: number, seed: number): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const top = y === y0;
      const left = x === x0;
      const edge = y === y0 + h - 1 || x === x0 + w - 1;
      const n = hash2(x, y, seed);
      s.set(x, y, edge ? P.stoneDeep : top || left ? (n < 0.8 ? P.stoneLight : P.stone) : n < 0.2 ? P.stoneDark : P.stone);
    }
  }
}

function drawBeaconSite(s: Sprite): void {
  // An old, fallen ring of stones round a weathered post.
  for (const [x, y, w, h] of [[3, 22, 4, 3], [8, 24, 3, 2], [13, 24, 4, 2], [18, 21, 3, 3], [6, 19, 3, 2], [15, 19, 3, 2]] as const) {
    block(s, x, y, w, h, 100);
  }
  for (let y = 12; y <= 23; y++) {
    const x = 11 + Math.round((23 - y) * 0.2);
    s.set(x, y, P.driftLight);
    s.set(x + 1, y, P.driftDark);
  }
  s.set(13, 13, P.driftDark);
  s.set(14, 13, P.drift);
}

function drawBeaconBase(s: Sprite): void {
  // A round cairn of fitted stones: three courses, each one a little narrower.
  const courses: [number, number, number][] = [[BASE_FOOT - 2, 2, 22], [BASE_FOOT - 4, 3, 21], [BASE_TOP, 4, 20]];
  courses.forEach(([y, x0, x1], row) => {
    for (let x = x0 + (row % 2) * 2; x <= x1; x += 4) block(s, x, y, Math.min(4, x1 - x + 1), 2, 101 + row);
  });
  for (let x = 5; x <= 19; x++) s.set(x, BASE_TOP - 1, x < 12 ? P.stoneLight : P.stone);
}

function drawPyre(s: Sprite): void {
  // Logs leaning together in a tall cone over the base.
  const tip: [number, number] = [12, 3];
  for (const fx of [5, 8, 11, 14, 17, 19]) {
    const n = Math.max(Math.abs(fx - tip[0]), BASE_TOP - 1 - tip[1]);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(tip[0] + ((fx - tip[0]) * i) / n);
      const y = Math.round(tip[1] + ((BASE_TOP - 1 - tip[1]) * i) / n);
      s.set(x, y, fx < 12 ? P.woodLight : P.wood);
      s.set(x + 1, y, fx < 12 ? P.wood : P.woodDark);
    }
  }
  // Rope lashing near the top.
  for (let x = 10; x <= 14; x++) s.set(x, 6, P.strawDark);
}

function drawTinder(s: Sprite, frame: 0 | 1): void {
  // Dry leaves stuffed between the logs.
  for (let y = 9; y <= BASE_TOP - 2; y++) {
    const half = 1 + (y - 9) * 0.5;
    for (let x = Math.ceil(12 - half); x <= Math.floor(12 + half); x++) {
      if ((x + y) % 3 === 0) continue;
      s.set(x, y, x < 12 ? P.strawLight : hash2(x, y, 104) < 0.5 ? P.straw : P.strawDark);
    }
  }
  // A pole on top with a red pennant that waves.
  for (let y = 0; y <= 3; y++) s.set(12, y, P.woodDark);
  const flag = frame === 0 ? [[13, 0], [14, 0], [15, 0], [16, 0], [13, 1], [14, 1], [15, 1]] : [[13, 0], [14, 0], [13, 1], [14, 1], [15, 1], [16, 2], [15, 2]];
  for (const [x, y] of flag) s.set(x, y, x === 13 && y === 0 ? P.berryLight : P.berry);
}

function beaconSprite(name: string, stage: BeaconStage, frame: 0 | 1 = 0): Sprite {
  const s = new Sprite(name, BEACON_W, BEACON_H);
  if (stage === 'site') {
    drawBeaconSite(s);
  } else {
    drawBeaconBase(s);
    if (stage !== 'base') drawPyre(s);
    if (stage === 'ready') drawTinder(s, frame);
  }
  return s.outline().shadow(12, BASE_FOOT + 1.5, 11, 1.5);
}

/** A tall signal fire on top of the pyre that leans one way, then the other. */
function drawBeaconFire(s: Sprite, frame: 0 | 1): void {
  const lean = frame === 0 ? -0.5 : 0.5;
  for (let y = 0; y <= 14; y++) {
    const t = y / 14;
    const half = 0.8 + t * 5.2;
    const cx = 12 + lean * (1 - t) * 3;
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const d = Math.abs(x + 0.5 - cx) / (half + 0.3);
      if (d > 1 || hash2(x, y, 105 + frame) < 0.15 * (1 - t)) continue;
      const heat = (1 - d) * (0.35 + t * 0.65);
      s.set(x, y, heat > 0.55 ? P.flameCore : heat > 0.35 ? P.flame : heat > 0.15 ? P.flameOrange : P.flameRed);
    }
  }
}

/** The lit beacon after the last goal: a big fire on the pyre, 2 frames. */
function beaconLit(name: string, frame: 0 | 1): Sprite {
  const s = new Sprite(name, BEACON_W, BEACON_H);
  drawBeaconBase(s);
  drawPyre(s);
  drawTinder(s, frame);
  drawBeaconFire(s, frame);
  s.outline();
  // Sparks rising above the outline.
  for (const [x, y] of frame === 0 ? [[6, 2], [17, 5]] : [[8, 4], [18, 1]]) s.set(x, y, P.flame);
  return s.shadow(12, BASE_FOOT + 1.5, 11, 1.5);
}

/** The signal beacon in each stage; the ready beacon has two frames for its pennant. */
export function beacon(): Sprite[] {
  return [
    beaconSprite('beacon_site', 'site'),
    beaconSprite('beacon_base', 'base'),
    beaconSprite('beacon_pyre', 'pyre'),
    beaconSprite('beacon_ready', 'ready', 0),
    beaconSprite('beacon_ready_2', 'ready', 1),
    beaconLit('beacon_lit', 0),
    beaconLit('beacon_lit_2', 1),
  ];
}

// ---- Island 3: the hot-air balloon on the crater rim ------------------------------

const BALLOON_W = 24;
const BALLOON_H = 32;
/** The basket: its rim row, its bottom row, and its left and right columns. */
const BASKET_TOP = 25;
const BASKET_FOOT = 30;
const BASKET_X0 = 8;
const BASKET_X1 = 15;
/** Where the ropes meet the bottom of the envelope. */
const SKIRT_Y = 19;

type BalloonStage = 'site' | 'basket' | 'envelope' | 'ready';

/** Woven wicker: straw strands that go over and under. */
function wicker(x: number, y: number, x0: number, x1: number): string {
  if (x === x0) return P.strawLight;
  if (x === x1) return P.strawDeep;
  return (x + (y % 2)) % 2 === 0 ? P.straw : P.strawDark;
}

function drawBasket(s: Sprite): void {
  for (let y = BASKET_TOP; y <= BASKET_FOOT; y++) {
    for (let x = BASKET_X0; x <= BASKET_X1; x++) s.set(x, y, y === BASKET_TOP ? P.woodLight : wicker(x, y, BASKET_X0, BASKET_X1));
  }
}

/** Four ropes from the basket rim up to the envelope. */
function drawBalloonRopes(s: Sprite, top: number): void {
  for (const [bx, tx] of [[BASKET_X0, 9], [BASKET_X1, 14]]) {
    for (let y = top; y < BASKET_TOP; y++) {
      const x = Math.round(bx + ((tx - bx) * (BASKET_TOP - y)) / (BASKET_TOP - top));
      s.set(x, y, P.strawDark);
    }
  }
}

/** Red and cream panels of balloon cloth: `u` runs from -1 (left) to 1 (right) across the balloon. */
function cloth(u: number, x: number, y: number, seed: number, patched: boolean): string {
  if (patched && hash2(x >> 1, y >> 1, seed) < 0.06) return x % 2 ? P.leafDark : P.leaf;
  const red = Math.floor((u + 1) * 3) % 2 === 0;
  const shade = u > 0.45 || hash2(x, y, seed + 1) < 0.06;
  if (red) return shade ? P.balloonRedDark : P.balloonRed;
  return shade ? P.balloonCreamDark : P.balloonCream;
}

/** The full envelope, round on top and narrowing to a skirt over the burner. */
function drawEnvelope(s: Sprite): void {
  for (let y = 0; y <= SKIRT_Y; y++) {
    const dy = (y + 0.5 - 9) / 9.5;
    const half = y <= 15 ? 10.5 * Math.sqrt(Math.max(0, 1 - dy * dy)) : 3 + (SKIRT_Y - y) * 0.9;
    for (let x = 0; x < BALLOON_W; x++) {
      const u = (x + 0.5 - 12) / Math.max(half, 0.5);
      if (Math.abs(u) > 1) continue;
      s.set(x, y, cloth(u, x, y, 150, true));
    }
  }
  // A highlight on the upper left.
  for (const [x, y] of [[6, 4], [7, 4], [5, 5], [6, 5], [5, 6]]) s.set(x, y, P.steamLight);
}

/** The patched envelope before it is filled: limp, lying in folds over the basket. */
function drawLimpEnvelope(s: Sprite): void {
  for (let y = 12; y <= BASKET_TOP - 1; y++) {
    const dy = (y + 0.5 - 20) / 8;
    const half = 9.5 * Math.sqrt(Math.max(0, 1 - dy * dy));
    for (let x = 0; x < BALLOON_W; x++) {
      const u = (x + 0.5 - 12) / Math.max(half, 0.5);
      if (Math.abs(u) > 1) continue;
      // Folds: dark lines that run down the cloth.
      const fold = (x + Math.round(y * 0.3)) % 5 === 0;
      s.set(x, y, fold ? P.balloonRedDark : cloth(u, x, y, 151, true));
    }
  }
}

/** A heap of torn balloon cloth with holes in it, centred on column `cx`. */
function drawClothHeap(s: Sprite, cx: number): void {
  for (let y = 22; y <= BASKET_FOOT; y++) {
    const half = 6.5 * Math.sqrt(Math.max(0, 1 - ((y + 0.5 - BASKET_FOOT - 1) / 8.5) ** 2));
    for (let x = Math.floor(cx - 7); x < BALLOON_W; x++) {
      const u = (x + 0.5 - cx) / Math.max(half, 0.5);
      if (Math.abs(u) > 1) continue;
      const hole = hash2(x, y, 152) < 0.08;
      const fold = (x + y) % 4 === 0;
      s.set(x, y, hole ? P.interior : fold ? P.balloonCreamDark : cloth(u, x, y, 153, false));
    }
  }
}

/** A coil of new rope on the basket rim. */
function drawRopeCoil(s: Sprite): void {
  for (let x = 8; x <= 12; x++) {
    s.set(x, BASKET_TOP - 2, x === 8 || x === 12 ? P.strawDark : P.strawLight);
    s.set(x, BASKET_TOP - 1, x < 10 ? P.straw : P.strawDark);
  }
}

/** The old balloon as it was found: the basket tipped over, the torn cloth in a heap. */
function drawBalloonSite(s: Sprite): void {
  // The basket on its side, the open top facing left.
  for (let y = 24; y <= BASKET_FOOT; y++) {
    for (let x = 2; x <= 9; x++) s.set(x, y, x === 2 ? P.interior : x === 3 ? P.woodLight : wicker(x, y, 3, 9));
  }
  drawClothHeap(s, 16.5);
  // A broken rope across the ground.
  for (let x = 4; x <= 13; x++) s.set(x, 23 - Math.round(Math.sin(x * 0.7)), P.strawDark);
}

/** A stone fire bowl over the basket; when `lit`, a flame burns in it. */
function drawBurner(s: Sprite, lit: boolean, frame: 0 | 1): void {
  for (let x = 10; x <= 13; x++) s.set(x, 22, x === 10 ? P.stoneLight : x === 13 ? P.stoneDark : P.stone);
  for (let x = 11; x <= 12; x++) s.set(x, 23, P.stoneDark);
  if (!lit) return;
  const flame = frame === 0
    ? [[11, 21, P.flameCore], [12, 21, P.flame], [11, 20, P.flame], [12, 20, P.flameOrange], [11, 19, P.flameOrange]]
    : [[11, 21, P.flame], [12, 21, P.flameCore], [12, 20, P.flame], [11, 20, P.flameOrange], [12, 19, P.flameOrange]];
  for (const [x, y, c] of flame) s.set(x as number, y as number, c as string);
}

function balloonSprite(name: string, stage: BalloonStage, frame: 0 | 1 = 0): Sprite {
  const s = new Sprite(name, BALLOON_W, BALLOON_H);
  if (stage === 'site') {
    drawBalloonSite(s);
  } else {
    if (stage === 'ready') drawEnvelope(s);
    if (stage !== 'basket') drawBalloonRopes(s, SKIRT_Y);
    drawBurner(s, stage === 'ready', frame);
    if (stage === 'envelope') drawLimpEnvelope(s);
    if (stage === 'basket') drawClothHeap(s, 14);
    drawBasket(s);
    if (stage === 'basket') drawRopeCoil(s);
  }
  return s.outline().shadow(12, BASKET_FOOT + 1.5, 9, 1.4);
}

/** The explorer's head and shoulders over the basket rim. */
function drawPilot(s: Sprite, body: 'male' | 'female'): void {
  const look = LOOKS[body];
  const rows = ['.hhh.', 'hhhhh', 'hsess', 'hSsss', 'ccccC'];
  const key: Record<string, string> = { h: look.hair, s: look.skin, S: look.skinShade, e: P.outline, c: look.shirt, C: look.shirtShade };
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') s.set(13 + x - 2, BASKET_TOP - 4 + y, key[ch]);
  }));
  if (body === 'female') s.set(12, BASKET_TOP - 4, P.flower);
}

/** The balloon in the air with the explorer on board, for the flight home: no shadow. 2 frames. */
function balloonAwaySprite(body: 'male' | 'female', frame: 0 | 1): Sprite {
  const s = new Sprite(`balloon_away_${body}${frame ? '_2' : ''}`, BALLOON_W, BALLOON_H);
  drawEnvelope(s);
  drawBalloonRopes(s, SKIRT_Y);
  drawBurner(s, true, frame);
  drawPilot(s, body);
  drawBasket(s);
  return s.outline();
}

/** Where the balloon stood after it flew off: two stakes with cut ropes. */
function balloonGone(): Sprite {
  const s = new Sprite('balloon_gone', BALLOON_W, BALLOON_H);
  for (const x of [7, 16]) {
    for (let y = BASKET_FOOT - 4; y <= BASKET_FOOT; y++) {
      s.set(x, y, y === BASKET_FOOT - 4 ? P.woodCut : P.wood);
      s.set(x + 1, y, P.woodDark);
    }
  }
  for (const [x, y] of [[9, 27], [10, 28], [11, 28], [14, 27], [13, 28]]) s.set(x, y, P.strawDark);
  return s.outline().shadow(12, BASKET_FOOT + 1.5, 7, 1.2);
}

export function balloonAway(): Sprite[] {
  return (['male', 'female'] as const).flatMap((body) => [balloonAwaySprite(body, 0), balloonAwaySprite(body, 1)]);
}

/** The balloon in each stage; the ready balloon has two frames for its flame. */
export function balloon(): Sprite[] {
  return [
    balloonSprite('balloon_site', 'site'),
    balloonSprite('balloon_basket', 'basket'),
    balloonSprite('balloon_envelope', 'envelope'),
    balloonSprite('balloon_ready', 'ready', 0),
    balloonSprite('balloon_ready_2', 'ready', 1),
    balloonGone(),
  ];
}

/** A big slatted crate with a rope handle and logs stacked on its lid: the camp store. */
export function storeCrate(): Sprite {
  const s = new Sprite('store_crate');
  // Plank body between two corner posts.
  for (let y = 6; y <= 14; y++) {
    for (let x = 2; x <= 13; x++) {
      const post = x <= 3 || x >= 12;
      const seam = (y - 6) % 3 === 2;
      const c = post ? (x === 2 ? P.woodLight : x === 13 ? P.woodDeep : P.woodDark)
        : y === 6 ? P.woodLight
        : seam ? P.woodDeep
        : x < 6 ? P.woodLight
        : hash2(x, y, 81) < 0.2 ? P.woodDark : P.wood;
      s.set(x, y, c);
    }
  }
  // A dark lid band and a rope handle on the front.
  for (let x = 4; x <= 11; x++) s.set(x, 7, P.woodDeep);
  for (const [x, y] of [[6, 10], [7, 11], [8, 11], [9, 10]]) s.set(x, y, P.strawLight);
  // Two log ends and a stone on the lid.
  for (const cx of [5, 9]) {
    for (let y = 2; y <= 5; y++) {
      for (let x = cx - 2; x <= cx + 2; x++) {
        const d = Math.hypot(x + 0.5 - (cx + 0.5), y + 0.5 - 3.8);
        if (d <= 2.2) s.set(x, y, d < 0.9 ? P.woodRing : d < 1.6 ? P.woodCut : P.woodDark);
      }
    }
  }
  for (const [x, y, c] of [[12, 4, P.stoneLight], [13, 4, P.stone], [12, 5, P.stone], [13, 5, P.stoneDark]] as const) s.set(x, y, c);
  return s.outline().shadow(8, 15, 7, 1.2);
}

/** The frame of a hut going up: posts, rafters, half a floor and a pile of stones. */
export function hutSite(): Sprite {
  const s = new Sprite('hut_site', 24, 28);
  // Plank walls, built higher on the left than on the right; the dark inside shows above them.
  for (let x = 6; x <= 17; x++) {
    const top = x <= 9 ? 16 : x <= 13 ? 19 : 22;
    for (let y = 12; y < top; y++) s.set(x, y, P.interior);
    for (let y = top; y <= 26; y++) {
      const seam = (y - 14) % 3 === 2;
      s.set(x, y, y === top ? P.woodLight : seam ? P.woodDark : x < 8 ? P.woodLight : P.wood);
    }
  }
  // Corner posts and the beam across them.
  for (let y = 10; y <= 26; y++) {
    for (const [x, c] of [[4, P.woodLight], [5, P.wood], [18, P.wood], [19, P.woodDark]] as const) s.set(x, y, c);
  }
  for (let x = 4; x <= 19; x++) {
    s.set(x, 10, P.woodLight);
    s.set(x, 11, P.woodDark);
  }
  // Rafters meeting at the ridge, lashed with rope.
  for (let i = 0; i <= 7; i++) {
    s.set(5 + i, 9 - i, P.wood);
    s.set(18 - i, 9 - i, P.woodDark);
  }
  s.set(12, 2, P.wood);
  for (const [x, y] of [[11, 2], [12, 3], [4, 10], [19, 10]]) s.set(x, y, P.strawLight);
  // A pile of stones in front, ready for the hearth and the walls.
  for (const [cx, cy, r] of [[16, 25, 2.2], [20, 25.5, 1.8], [18, 23, 1.8]] as const) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (Math.hypot(dx, dy) > r) continue;
        const l = (-dx - dy) / r;
        s.set(x, y, l > 0.5 ? P.stoneLight : l > -0.3 ? P.stone : P.stoneDark);
      }
    }
  }
  return s.outline().shadow(12, 27, 10, 1.3);
}
