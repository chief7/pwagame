import { PALETTE as P } from './palette';
import { hash2, Sprite } from './pixel';

interface Blob {
  cx: number;
  cy: number;
  r: number;
}

/**
 * Leafy mass from overlapping circles, shaded as one ball lit from the top
 * left (centre cx, cy, radius r) with clumpy noise for leaves.
 */
function foliage(s: Sprite, blobs: readonly Blob[], light: Blob, seed: number): void {
  for (const b of blobs) {
    for (let y = Math.floor(b.cy - b.r); y <= Math.ceil(b.cy + b.r); y++) {
      for (let x = Math.floor(b.cx - b.r); x <= Math.ceil(b.cx + b.r); x++) {
        if (Math.hypot(x + 0.5 - b.cx, y + 0.5 - b.cy) > b.r) continue;
        const nx = (x + 0.5 - light.cx) / light.r;
        const ny = (y + 0.5 - light.cy) / light.r;
        const clump = hash2(x >> 1, y >> 1, seed) - 0.5;
        const l = -0.55 * nx - 0.75 * ny + clump * 0.5 + (hash2(x, y, seed + 1) - 0.5) * 0.2;
        s.set(x, y, l > 0.45 ? P.canopyLight : l > -0.1 ? P.canopy : l > -0.6 ? P.canopyDark : P.canopyDeep);
      }
    }
  }
}

function trunk(s: Sprite, x: number, top: number, bottom: number): void {
  for (let y = top; y <= bottom; y++) {
    s.set(x, y, P.woodLight);
    s.set(x + 1, y, P.wood);
    s.set(x + 2, y, P.woodDark);
  }
  // Roots flaring at the base.
  s.set(x - 1, bottom, P.wood);
  s.set(x + 3, bottom, P.woodDark);
}

/** Round leafy tree, 24×32; overhangs the tile above like the palms. */
export function treeBroadleaf(): Sprite {
  const s = new Sprite('tree_broadleaf', 24, 32);
  trunk(s, 11, 20, 29);
  foliage(s, [
    { cx: 12, cy: 12, r: 8 }, { cx: 6.5, cy: 15, r: 5.5 }, { cx: 17.5, cy: 15, r: 5.5 },
    { cx: 12, cy: 6.5, r: 5.5 }, { cx: 12, cy: 18, r: 5 },
  ], { cx: 12, cy: 12, r: 11 }, 61);
  return s.outline().shadow(12.5, 30.5, 7, 1.6);
}

export function treePine(): Sprite {
  const s = new Sprite('tree_pine', 24, 32);
  trunk(s, 11, 24, 29);
  // Stacked tiers, each a wide triangle with a drooping lower edge.
  const tiers: [number, number, number][] = [[3, 9, 4], [8, 15, 6.5], [13, 21, 8.5], [18, 26, 10]];
  for (const [top, bottom, half] of tiers) {
    for (let y = top; y <= bottom; y++) {
      const t = (y - top) / (bottom - top);
      const w = half * t + 1;
      for (let x = Math.floor(12 - w); x <= Math.ceil(12 + w); x++) {
        const side = (x + 0.5 - 12) / (w + 0.5);
        if (Math.abs(side) > 1) continue;
        const edge = y === bottom || (y === bottom - 1 && hash2(x, y, 62) < 0.5);
        const n = hash2(x, y, 63);
        const c = edge ? P.pineDark : side < -0.35 ? (n < 0.7 ? P.pineLight : P.pine) : side > 0.4 ? P.pineDark : n < 0.15 ? P.pineLight : P.pine;
        s.set(x, y, c);
      }
    }
  }
  return s.outline().shadow(12.5, 30.5, 6, 1.5);
}

function bushShape(name: string, seed: number): Sprite {
  const s = new Sprite(name);
  foliage(s, [{ cx: 8, cy: 10, r: 5 }, { cx: 4.5, cy: 11.5, r: 3.5 }, { cx: 11.5, cy: 11.5, r: 3.5 }, { cx: 8, cy: 7, r: 3.5 }], { cx: 8, cy: 9.5, r: 7 }, seed);
  return s;
}

export function bush(): Sprite {
  return bushShape('bush', 64).outline().shadow(8, 14.6, 6.5, 1.3);
}

export function berryBush(): Sprite {
  const s = bushShape('berry_bush', 65);
  for (const [x, y] of [[5, 8], [9, 6], [11, 10], [6, 12], [9, 12], [3, 11], [12, 13]]) {
    s.set(x, y, P.berry);
    s.set(x + 1, y, P.berry);
    s.set(x, y + 1, P.berry);
    s.set(x + 1, y + 1, P.canopyDeep);
    s.set(x, y, P.berryLight);
  }
  return s.outline().shadow(8, 14.6, 6.5, 1.3);
}

export function berryBushEmpty(): Sprite {
  return bushShape('berry_bush_empty', 65).outline().shadow(8, 14.6, 6.5, 1.3);
}

function drawMushroom(s: Sprite, cx: number, base: number, size: number): void {
  // Stem.
  for (let y = base - size; y <= base; y++) {
    s.set(cx, y, P.mushroomStem);
    s.set(cx + 1, y, P.mushroomStemShade);
  }
  // Cap: a flattened dome with pale spots.
  const top = base - size - 2;
  for (let y = top; y <= top + 2; y++) {
    const w = y === top ? size - 1 : size;
    for (let x = cx - w + 1; x <= cx + w; x++) {
      const lit = x < cx + 1 && y < top + 2;
      s.set(x, y, y === top + 2 ? P.mushroomCap : lit ? P.mushroomCapLight : P.mushroomCap);
    }
  }
  s.set(cx - 1, top + 1, P.mushroomSpot);
  s.set(cx + 2, top, P.mushroomSpot);
}

export function mushroom(): Sprite {
  const s = new Sprite('mushroom');
  drawMushroom(s, 5, 13, 3);
  drawMushroom(s, 10, 13, 2);
  drawMushroom(s, 8, 14, 1);
  return s.outline().shadow(8, 14.8, 6, 1);
}

/** Thorny thicket, 16×16: fills its cell edge to edge so a row reads as a wall. */
export function bramble(): Sprite {
  const s = new Sprite('bramble');
  foliage(s, [
    { cx: 8, cy: 9.5, r: 6.5 }, { cx: 3, cy: 11, r: 4 }, { cx: 13, cy: 11, r: 4 },
    { cx: 4.5, cy: 6, r: 3.5 }, { cx: 11.5, cy: 6, r: 3.5 },
  ], { cx: 8, cy: 9, r: 8 }, 66);
  // Darker, denser leaves than a bush, so a thicket reads as a barrier.
  const darker: Record<string, string> = { [P.canopyLight]: P.canopy, [P.canopy]: P.canopyDark, [P.canopyDark]: P.canopyDeep };
  for (let i = 0; i < s.pixels.length; i++) {
    const c = s.pixels[i];
    if (c && darker[c]) s.pixels[i] = darker[c];
  }
  // Arching canes over the leaves, 2px thick, with pale thorns on top.
  const canes: [number, number, number, number][] = [[1, 13, 10, 2], [5, 14, 15, 4], [0, 8, 12, 13]];
  for (const [x0, y0, x1, y1] of canes) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 2);
      s.set(x, y, P.brambleStem);
      s.set(x, y + 1, P.brambleStemDark);
      if (i % 3 === 1) s.set(x, y - 1, P.thorn);
    }
  }
  for (const [x, y] of [[3, 4], [12, 9], [6, 11]]) {
    s.set(x, y, P.brambleFlower);
    s.set(x + 1, y, P.flowerYellow);
  }
  return s.outline().shadow(8, 15, 7.5, 1.2);
}
