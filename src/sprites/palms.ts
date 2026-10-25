import { PALETTE as P } from './palette';
import { hash2, Sprite } from './pixel';

export const PALM_WIDTH = 24;
export const PALM_HEIGHT = 32;

interface Frond {
  /** Degrees; 0 points right, 90 straight up. */
  angle: number;
  length: number;
}

interface PalmSpec {
  name: string;
  baseX: number;
  topX: number;
  topY: number;
  /** Sideways pull on the trunk's midpoint. */
  bend: number;
  fronds: readonly Frond[];
  coconuts: boolean;
  seed: number;
}

/** Palms are 24×32: the trunk stands on the bottom-centre tile and the crown overhangs. */
function palm(spec: PalmSpec): Sprite {
  const s = new Sprite(spec.name, PALM_WIDTH, PALM_HEIGHT);
  const baseY = PALM_HEIGHT - 2;
  const ctrlX = (spec.baseX + spec.topX) / 2 + spec.bend;
  const ctrlY = (baseY + spec.topY) / 2;

  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const u = 1 - t;
    const x = u * u * spec.baseX + 2 * u * t * ctrlX + t * t * spec.topX;
    const y = Math.round(u * u * baseY + 2 * u * t * ctrlY + t * t * spec.topY);
    const width = t < 0.3 ? 3 : 2;
    const ring = (baseY - y) % 3 === 0;
    const left = Math.round(x - width / 2);
    for (let w = 0; w < width; w++) {
      const shade = w === 0 ? P.woodLight : w === width - 1 ? P.woodDark : P.wood;
      s.set(left + w, y, ring ? (w === 0 ? P.wood : P.woodDeep) : shade);
    }
  }

  // Undersides and drooping leaflets first, then the lit tops over them.
  const points = spec.fronds.map((f) => frondPoints(spec.topX, spec.topY, f));
  points.forEach((pts, fi) => {
    pts.forEach(([x, y, d], i) => {
      const len = spec.fronds[fi].length;
      if (d < len * 0.9) s.set(x, y + 1, P.leaf);
      if (d > len * 0.15 && d < len * 0.8 && i % 2 === 0) {
        s.set(x, y + 2, P.leafDark);
        if (hash2(x, y, spec.seed + fi) < 0.5) s.set(x, y + 3, P.leafDark);
      }
    });
  });
  points.forEach((pts, fi) => {
    pts.forEach(([x, y, d]) => s.set(x, y, d < spec.fronds[fi].length * 0.55 ? P.leafLight : P.leaf));
  });
  for (const [dx, dy] of [[-1, 0], [0, 0], [1, 0], [0, -1]]) s.set(spec.topX + dx, spec.topY + dy, P.leaf);

  if (spec.coconuts) {
    for (const [dx, dy, c] of [[-1, 2, P.coconut], [1, 2, P.coconut], [0, 3, P.coconut], [-1, 1, P.coconutLight], [1, 1, P.coconutLight]] as const) {
      s.set(spec.topX + dx, spec.topY + dy, c);
    }
  }

  return s.outline().shadow(spec.baseX + 0.5, baseY + 1, 5, 1.3);
}

/** Pixels along one frond: out from the crown, then drooping under its own weight. */
function frondPoints(ox: number, oy: number, f: Frond): [number, number, number][] {
  const a = (f.angle * Math.PI) / 180;
  const out: [number, number, number][] = [];
  for (let i = 0; i <= f.length * 3; i++) {
    const d = i / 3;
    const x = Math.round(ox + Math.cos(a) * d);
    const y = Math.round(oy - Math.sin(a) * d - 0.25 * d + (0.75 * d * d) / f.length);
    if (!out.some(([px, py]) => px === x && py === y)) out.push([x, y, d]);
  }
  // Thicken the rib near the crown.
  for (const [x, y, d] of [...out]) {
    if (d < f.length * 0.5 && !out.some(([px, py]) => px === x && py === y - 1)) out.push([x, y - 1, d]);
  }
  return out;
}

export function palmTall(): Sprite {
  return palm({
    name: 'palm_tall', baseX: 12, topX: 12, topY: 8, bend: 1, coconuts: true, seed: 41,
    fronds: [
      { angle: -15, length: 10 }, { angle: 15, length: 10 }, { angle: 55, length: 7 },
      { angle: 125, length: 7 }, { angle: 165, length: 10 }, { angle: 195, length: 10 },
    ],
  });
}

export function palmLeaning(): Sprite {
  return palm({
    name: 'palm_leaning', baseX: 9, topX: 15, topY: 9, bend: -4, coconuts: true, seed: 42,
    fronds: [
      { angle: -25, length: 8 }, { angle: 10, length: 9 }, { angle: 60, length: 6 },
      { angle: 130, length: 8 }, { angle: 170, length: 10 }, { angle: 205, length: 8 },
    ],
  });
}

export function palmYoung(): Sprite {
  return palm({
    name: 'palm_young', baseX: 12, topX: 12, topY: 19, bend: 0, coconuts: false, seed: 43,
    fronds: [
      { angle: -5, length: 7 }, { angle: 40, length: 6 }, { angle: 90, length: 4 },
      { angle: 140, length: 6 }, { angle: 185, length: 7 },
    ],
  });
}
