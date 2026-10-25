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

/** Skill point star and one badge for each skill path. */
export function skillIcons(): Sprite[] {
  const star = new Sprite('ui_star');
  // Five points around (8, 8.5); the top-left half catches the light.
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
      if (inside) star.set(x, y, px - 8 + (py - 8.8) * 0.6 < 0 ? P.goldLight : P.gold);
    }
  }
  star.outline();
  const drop = fromRows('ui_path_survival', [
    '................',
    '.......w........',
    '.......w........',
    '......wwr.......',
    '......wwr.......',
    '.....wgwrr......',
    '....wggwwrr.....',
    '....wgwwwrr.....',
    '...wwwwwwwrr....',
    '...wwwwwwwrr....',
    '...wwwwwwrrr....',
    '...rwwwwwrrr....',
    '....rrwwrrr.....',
    '.....rrrrr......',
    '................',
    '................',
  ], { '.': null, w: P.water, g: P.waterGlint, r: P.waterDeep }).outline();
  const hammer = fromRows('ui_path_craft', [
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
  return [star, drop, hammer, compass];
}
