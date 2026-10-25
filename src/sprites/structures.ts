import { PALETTE as P } from './palette';
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

/** Wooden hut with a thatched roof: the best home on the island. */
export function hut(): Sprite {
  const s = new Sprite('hut', 24, 28);
  // Plank walls.
  for (let y = 14; y <= 26; y++) {
    for (let x = 4; x <= 19; x++) {
      const seam = (y - 14) % 3 === 2;
      s.set(x, y, seam ? P.woodDark : x < 7 ? P.woodLight : x > 17 ? P.woodDark : P.wood);
    }
  }
  // Door and window.
  for (let y = 18; y <= 26; y++) for (let x = 10; x <= 13; x++) s.set(x, y, y === 18 || x === 10 ? P.woodDeep : P.interior);
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
  return s.outline().shadow(12, 27, 10, 1.3);
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
