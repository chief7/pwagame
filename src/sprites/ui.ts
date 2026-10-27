import { character } from './characters';
import { palmTall } from './palms';
import { PALETTE as P } from './palette';
import { fromRows, hash2, Sprite, type Color } from './pixel';
import { water } from './terrain';

// Interface icons and the app icon, in the same pixel style as the world.

/** Globe for the language switch. */
export function globe(): Sprite {
  return fromRows('ui_globe', [
    '................',
    '................',
    '.....wwwwww.....',
    '....wwgggwww....',
    '...wwggggwwww...',
    '...wwwgggwwgg...',
    '..wwwwwgwwgggw..',
    '..wwwwwwwwggww..',
    '..wwggwwwwwwww..',
    '..wwgggwwwwwgw..',
    '...wwggwwwwgg...',
    '...wwwgwwwwww...',
    '....wwwwwwww....',
    '.....wwwwww.....',
    '................',
    '................',
  ], { '.': null, w: P.water, g: P.leaf }).outline();
}

function rgb(color: string): [number, number, number, number] {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255, 1];
  }
  const [r, g, b, a = 1] = color.match(/[\d.]+/g)!.map(Number);
  return [r, g, b, a];
}

/** Paint `top` over `under`, blending translucent pixels such as shadows. */
function over(under: Color, top: Color): Color {
  if (!top) return under;
  const [r, g, b, a] = rgb(top);
  if (a >= 1 || !under) return top;
  const [r0, g0, b0] = rgb(under);
  const mix = (c: number, c0: number) => Math.round(c * a + c0 * (1 - a)).toString(16).padStart(2, '0');
  return `#${mix(r, r0)}${mix(g, g0)}${mix(b, b0)}`;
}

/** Draw `s` onto `into` with its bottom-centre at (cx, bottom). */
function stamp(into: Sprite, s: Sprite, cx: number, bottom: number): void {
  const x0 = cx - Math.floor(s.width / 2);
  const y0 = bottom - s.height;
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) into.set(x0 + x, y0 + y, over(into.get(x0 + x, y0 + y), s.get(x, y)));
  }
}

/**
 * App icon: the explorer under a palm on a small island in the sea. The
 * scene is 32×32; a bigger `size` adds sea around it (for the maskable icon).
 * Scaled up whole-pixel for the PNG and SVG icons (npm run icons).
 */
export function appIcon(size = 32): Sprite {
  const sea = water();
  const o = Math.floor((size - 32) / 2);
  const s = new Sprite(size === 32 ? 'app_icon' : `app_icon_${size}`, size, size).paint((x, y) => sea.get(x % 16, y % 16));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot((x + 0.5 - o - 16) / 14, (y + 0.5 - o - 23) / 7.5);
      if (d > 1.12) continue;
      const sandColor = d > 1 ? P.foam : d > 0.86 ? P.sandWet : hash2(x, y, 9) < 0.12 ? P.sandMid : y - o < 19 ? P.sandLight : P.sand;
      s.set(x, y, sandColor);
    }
  }
  stamp(s, palmTall(), o + 11, o + 27);
  stamp(s, character('female', 'down'), o + 22, o + 29);
  return s;
}

/** A five-pointed star; the top-left half catches the light. */
function starShape(name: string, light: string, mid: string): Sprite {
  const star = new Sprite(name);
  // Five points around (8, 8.5).
  const corners = Array.from({ length: 10 }, (_, k) => {
    const r = k % 2 ? 3 : 7.5;
    const t = -Math.PI / 2 + (k * Math.PI) / 5;
    return [8 + r * Math.cos(t), 8.8 + r * Math.sin(t)] as const;
  });
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
        const [xi, yi] = corners[i];
        const [xj, yj] = corners[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) star.set(x, y, px - 8 + (py - 8.8) * 0.6 < 0 ? light : mid);
    }
  }
  return star.outline();
}

/** An island star still to earn: grey. An earned one is the gold `ui_star`. */
export function starEmpty(): Sprite {
  return starShape('ui_star_empty', P.stoneLight, P.stone);
}

/** Skill point star and one badge for each skill path. */
export function skillIcons(): Sprite[] {
  const star = starShape('ui_star', P.goldLight, P.gold);
  const arrow = fromRows('ui_path_improve', [
    '................',
    '.......LG.......',
    '......LLGG......',
    '.....LLLGGG.....',
    '....LLLLGGGG....',
    '...LLLLLGGGGG...',
    '..LLLLLLGGGGGG..',
    '..DDDDLLGGDDDD..',
    '......LGGD......',
    '......LGGD......',
    '......LGGD......',
    '......LGGD......',
    '......LGGD......',
    '......LGGD......',
    '......DDDD......',
    '................',
  ], { '.': null, L: P.leafLight, G: P.leaf, D: P.leafDark }).outline();
  const hammer = fromRows('ui_path_build', [
    '................',
    '................',
    '...LSSSSSs......',
    '..LSSSSSSSs.....',
    '..SSSSSSSSDD....',
    '...SSSSSDDD.....',
    '......cwcd......',
    '......wwwd......',
    '.......wwd......',
    '.......wwd......',
    '.......wwd......',
    '.......wwd......',
    '.......wwd......',
    '.......wwd......',
    '........dd......',
    '................',
  ], { '.': null, L: P.stoneLight, S: P.stone, s: P.stoneDark, D: P.stoneDeep, w: P.woodLight, d: P.woodDark, c: P.strawDark }).outline();
  const compass = fromRows('ui_path_explorer', [
    '................',
    '.......gg.......',
    '.....GGGGGG.....',
    '....GffffffD....',
    '...GffffNfffD...',
    '...GfffNNfffD...',
    '..GffffNNffffD..',
    '..GffffoofffDD..',
    '..GffffssffffD..',
    '...GfffssfffD...',
    '...GffffsfffD...',
    '....DffffffD....',
    '.....DDDDDD.....',
    '................',
    '................',
    '................',
  ], { '.': null, G: P.gold, g: P.goldLight, D: P.goldDark, f: P.compassFace, N: P.compassNeedle, s: P.stoneDark, o: P.outline }).outline();
  return [star, hammer, compass, arrow];
}

/** A fish on a stick over the flames; two frames where the fire flickers and steam rises. */
function grillFrame(name: string, frame: 0 | 1): Sprite {
  const s = fromRows(name, [
    '................',
    '................',
    '.....ff.........',
    '...LLLLmm..ff...',
    '..LoLLLLmmfff...',
    'ddLLLLLLmmmfwwww',
    '..bbbbbbbmmff...',
    '...bbbbbmm.ff...',
    '.....ff.........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ], { '.': null, L: P.fishCookedLight, m: P.fishCooked, b: P.fishCookedBelly, f: P.fishCooked, o: P.outline, w: P.woodLight, d: P.woodDark });
  // Grill marks, as on the cooked fish.
  for (const x0 of [4, 7]) for (let i = 0; i < 3; i++) s.set(x0 + i, 3 + i, P.fishCookedDark);
  // Three flame tongues on a bed of embers; they swap heights between frames.
  const heights = frame === 0 ? [3, 4, 2] : [2, 3, 4];
  [4, 8, 12].forEach((cx, k) => {
    const h = heights[k];
    for (let i = 0; i < h; i++) {
      const y = 13 - i;
      const top = i === h - 1;
      s.set(cx, y, top ? P.flameRed : i === 0 ? P.flameCore : P.flame);
      if (!top) {
        s.set(cx - 1, y, i === 0 ? P.flameOrange : P.flameRed);
        s.set(cx + 1, y, i === 0 ? P.flameOrange : P.flameRed);
      }
    }
  });
  for (let x = 2; x <= 14; x++) s.set(x, 14, x % 3 === 0 ? P.flameOrange : x < 8 ? P.wood : P.woodDark);
  s.outline();
  // Steam goes on after the outline so it stays a thin, soft wisp.
  const wisp = frame === 0 ? [[6, 1], [7, 0]] : [[8, 1], [7, 0]];
  for (const [x, y] of wisp) s.set(x, y, P.steam);
  return s;
}

export function grillButton(): Sprite[] {
  return [grillFrame('ui_grill', 0), grillFrame('ui_grill_2', 1)];
}

/** A paper map with a coast, a path and a red cross: the icon for the Map button. */
export function mapIcon(): Sprite {
  return fromRows('ui_map', [
    '................',
    '................',
    '.dDDDDDDDDDDDDd.',
    '.LwwwwwwwwwwwwD.',
    '.LwwwwssssswwwD.',
    '.LwwssfffffswwD.',
    '.LwsffkkfffswwD.',
    '.LwsfkkffrffswD.',
    '.LwsffffffrfswD.',
    '.LwwsfffffsrswD.',
    '.LwwwsssfffxrxD.',
    '.LwwwwwwssssxwD.',
    '.LwwwwwwwwwrwrD.',
    '.dDDDDDDDDDDDDd.',
    '................',
    '................',
  ], {
    '.': null, w: P.washSea, L: P.paperLight, d: P.paperDeep, D: P.paperDark,
    s: P.washSand, f: P.washForest, k: P.washForestDark, r: P.inkRed, x: P.inkRed,
  }).outline();
}

/** Small ink signs drawn on the map: where you are, huts, campfires, springs, bears and the island goal. */
export function mapMarkers(): Sprite[] {
  const key = { '.': null, i: P.ink, r: P.inkRed, o: P.flameOrange, y: P.flame, b: P.washRiver, w: P.paperLight };
  // A pale halo keeps each sign readable on any wash.
  const halo = (s: Sprite) => s.outline(P.paperLight);
  const you = fromRows('map_you', [
    'r...r',
    'rr.rr',
    '.rrr.',
    'rr.rr',
    'r...r',
  ], key);
  const hut = fromRows('map_hut', [
    '...i...',
    '..iii..',
    '.iiiii.',
    'iiiiiii',
    '.i...i.',
    '.i.i.i.',
    '.iiiii.',
  ], key);
  const spring = fromRows('map_spring', [
    '..b..',
    '.bbb.',
    'bbwbb',
    'bbbbb',
    '.bbb.',
  ], key);
  const goal = fromRows('map_goal', [
    '.irr...',
    '.irrrr.',
    '.irrr..',
    '.ir....',
    '.i.....',
    '.i.....',
    'iii....',
  ], key);
  const fire = fromRows('map_fire', [
    '...r...',
    '..rr...',
    '..roor.',
    '.rooyr.',
    '.royyr.',
    '..rrr..',
    'ii.i.ii',
  ], key);
  // A paw print: the cave bear lives near here.
  const bear = fromRows('map_bear', [
    'i..i..i',
    '.......',
    '..iii..',
    '.iiiii.',
    '.iiiii.',
    '..iii..',
  ], key);
  return [you, hut, fire, spring, goal, bear].map(halo);
}
