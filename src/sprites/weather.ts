import { PALETTE as P } from './palette';
import { fromRows, hash2, Sprite } from './pixel';

// Weather and clothes: rain, snowfall and storm overlays (drawn over the
// map, 2 frames each), the HUD weather icons, the clothes items and the
// thorny juniper of Pine Ridge where the goats leave wool.

// ---- Overlays over the map -----------------------------------------------------------
//
// Transparent 16 × 16 tiles laid over every visible cell. They tile without a
// seam (positions wrap round the cell), and the second frame moves every
// drop on, so cycling the two looks like falling rain. With reduced motion
// the first frame alone still reads as rain.

interface Drop {
  x: number;
  y: number;
}

const RAIN_DROPS: Drop[] = [
  { x: 2, y: 1 }, { x: 9, y: 3 }, { x: 14, y: 7 }, { x: 5, y: 9 }, { x: 11, y: 12 }, { x: 0, y: 13 }, { x: 7, y: 15 },
];

function wrap(v: number): number {
  return ((v % 16) + 16) % 16;
}

/** Light rain: short streaks that lean a little with the wind. */
function rainTile(name: string, shift: number): Sprite {
  const s = new Sprite(name);
  for (const d of RAIN_DROPS) {
    const y0 = d.y + shift;
    const x0 = d.x - (shift >> 2);
    s.set(wrap(x0), wrap(y0), P.rainSoft);
    s.set(wrap(x0), wrap(y0 + 1), P.rain);
    s.set(wrap(x0 - 1), wrap(y0 + 2), P.rain);
    s.set(wrap(x0 - 1), wrap(y0 + 3), P.rain);
  }
  return s;
}

export function rainOverlay(): Sprite[] {
  return [rainTile('weather_rain_1', 0), rainTile('weather_rain_2', 8)];
}

/** Snowfall on the peak of Pine Ridge: soft flakes that drift down slowly. */
function snowTile(name: string, shift: number): Sprite {
  const s = new Sprite(name);
  const flakes: Drop[] = [{ x: 3, y: 2 }, { x: 11, y: 4 }, { x: 7, y: 9 }, { x: 14, y: 12 }, { x: 1, y: 11 }];
  for (const [i, f] of flakes.entries()) {
    const x = wrap(f.x + (shift && i % 2 ? 1 : 0));
    const y = wrap(f.y + shift);
    s.set(x, y, P.snowfall);
    // Every other flake is a little bigger.
    if (i % 2 === 0) {
      s.set(wrap(x + 1), y, P.rainSoft);
      s.set(x, wrap(y + 1), P.rainSoft);
    }
  }
  return s;
}

export function snowOverlay(): Sprite[] {
  return [snowTile('weather_snow_1', 0), snowTile('weather_snow_2', 4)];
}

/** A storm at sea (the rig): more and longer streaks, blown far to the side. */
function stormTile(name: string, shift: number): Sprite {
  const s = new Sprite(name);
  const drops: Drop[] = [...RAIN_DROPS, { x: 7, y: 6 }, { x: 13, y: 0 }, { x: 3, y: 5 }];
  for (const d of drops) {
    const y0 = d.y + shift;
    const x0 = d.x - shift;
    for (let i = 0; i < 4; i++) s.set(wrap(x0 - i), wrap(y0 + i), i === 0 ? P.rainSoft : P.rain);
  }
  return s;
}

export function stormOverlay(): Sprite[] {
  return [stormTile('weather_storm_1', 0), stormTile('weather_storm_2', 8)];
}

// ---- HUD icons -----------------------------------------------------------------------

/** A puffy cloud lit from the top left; `dark` for a storm cloud. */
function drawCloud(s: Sprite, dark: boolean, top = 0): void {
  const puffs: [number, number, number][] = [[5, 7.5, 3], [9, 5.5, 3.6], [12.3, 8, 2.6]];
  const [light, mid, deep] = dark ? [P.cloud, P.stormCloud, P.stormCloudDark] : [P.cloudLight, P.cloud, P.cloudDark];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const cy = y - top;
      const inPuff = puffs.some(([px, py, r]) => Math.hypot(x + 0.5 - px, cy + 0.5 - py) <= r);
      const inBase = cy >= 7 && cy <= 10 && x >= 3 && x <= 13;
      if (!inPuff && !inBase) continue;
      const shade = (x + 0.5 - 6) * 0.5 + (cy + 0.5 - 5) * 0.8;
      s.set(x, y, shade < -0.5 ? light : shade < 3.2 ? mid : deep);
    }
  }
}

/** Clear weather: the sun with short rays. */
function sunIcon(): Sprite {
  const s = new Sprite('ui_weather_sun');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
      if (d <= 4) s.set(x, y, x + y < 14 ? P.sunLight : P.sun);
    }
  }
  for (const [x, y] of [[8, 1], [8, 2], [8, 13], [8, 14], [1, 8], [2, 8], [13, 8], [14, 8], [3, 3], [12, 3], [3, 12], [12, 12]]) {
    s.set(x, y, P.sunRay);
  }
  return s.outline();
}

/** Clouds coming: rain soon (the sun peeks out behind). */
function cloudIcon(): Sprite {
  const s = new Sprite('ui_weather_cloud');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (Math.hypot(x + 0.5 - 11, y + 0.5 - 5) <= 3.2) s.set(x, y, x + y < 15 ? P.sunLight : P.sun);
    }
  }
  drawCloud(s, false, 2);
  return s.outline();
}

function rainIcon(): Sprite {
  const s = new Sprite('ui_weather_rain');
  drawCloud(s, false, -1);
  for (const [x, y] of [[4, 12], [8, 13], [12, 12]]) {
    s.set(x, y, P.waterShallow);
    s.set(x, y + 1, P.water);
    s.set(x - 1, y + 2, P.waterDeep);
  }
  return s.outline();
}

function snowIcon(): Sprite {
  const s = new Sprite('ui_weather_snow');
  drawCloud(s, false, -1);
  for (const [x, y] of [[4, 13], [8, 12], [12, 13]]) {
    s.set(x, y, P.snowLight);
    s.set(x - 1, y, P.snowShade);
    s.set(x + 1, y, P.snowShade);
    s.set(x, y - 1, P.snowShade);
    s.set(x, y + 1, P.snowShade);
  }
  return s.outline();
}

/** A storm: a dark cloud, rain blown to the side and a gust of wind (no lightning). */
function stormIcon(): Sprite {
  const s = new Sprite('ui_weather_storm');
  drawCloud(s, true, -1);
  for (const [x, y] of [[5, 11], [9, 11], [13, 11]]) {
    s.set(x, y, P.waterShallow);
    s.set(x - 1, y + 1, P.water);
    s.set(x - 2, y + 2, P.waterDeep);
  }
  for (let x = 1; x <= 6; x++) s.set(x, 14, P.cloudLight);
  s.set(7, 13, P.cloudLight);
  return s.outline();
}

export function weatherIcons(): Sprite[] {
  return [sunIcon(), cloudIcon(), rainIcon(), snowIcon(), stormIcon()];
}

// ---- Clothes items ---------------------------------------------------------------------

/** Palm leaves tied into a cape, a cord at the top, leaf tips at the bottom. */
function leafCape(): Sprite {
  const s = new Sprite('item_leaf_cape');
  for (let y = 3; y <= 13; y++) {
    const half = 2 + (y - 3) * 0.5;
    for (let x = Math.round(8 - half); x <= Math.round(7 + half); x++) {
      const tip = y === 13 && x % 3 === 0;
      if (tip) continue;
      const vein = (x + Math.floor((y - 3) / 3)) % 3 === 0;
      s.set(x, y, vein ? P.leafDark : x + y < 15 ? P.leafLight : P.leaf);
    }
  }
  for (let x = 4; x <= 11; x++) s.set(x, 2, x % 2 ? P.strawLight : P.strawDark);
  s.set(3, 3, P.strawDark);
  s.set(12, 3, P.strawDark);
  return s.outline();
}

/** A wide palm-straw sun hat with a green band. */
function sunHat(): Sprite {
  const s = new Sprite('item_sun_hat');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const crown = Math.hypot((x + 0.5 - 8) / 3.2, (y + 0.5 - 7) / 3) <= 1 && y <= 8;
      const brim = Math.hypot((x + 0.5 - 8) / 7, (y + 0.5 - 10) / 2.4) <= 1;
      if (!crown && !brim) continue;
      const lit = (x + 0.5 - 8) * 0.6 + (y + 0.5 - 8) * 0.8;
      let c: string = lit < -2 ? P.strawLight : lit < 1.5 ? P.straw : P.strawDark;
      if (brim && !crown && y >= 11) c = P.strawDeep;
      if (crown && y === 8) c = P.leafDark;
      if (brim && !crown && hash2(x, y, 81) < 0.15) c = P.strawDark;
      s.set(x, y, c);
    }
  }
  return s.outline();
}

/** A soft tuft of goat wool. */
function woolTuft(): Sprite {
  const s = new Sprite('item_wool');
  const puffs: [number, number, number][] = [[6, 9, 3.2], [10, 8, 3.4], [8, 11, 3], [11.5, 11, 2.4]];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!puffs.some(([px, py, r]) => Math.hypot(x + 0.5 - px, y + 0.5 - py) <= r)) continue;
      const lit = (x + 0.5 - 8) * 0.5 + (y + 0.5 - 8) * 0.8 + (hash2(x, y, 82) - 0.5) * 1.6;
      s.set(x, y, lit < -0.5 ? P.wool : lit < 2.2 ? P.woolShade : P.woolDark);
    }
  }
  return s.outline();
}

const COAT_ROWS = [
  '................',
  '................',
  '.....rrrrrr.....',
  '...wwrrrrrrWW...',
  '..wwwwwrRwwwWW..',
  '.wwwwwwrRwwwWWW.',
  '.ww.wwwwwwwW.WW.',
  '.ww.wwwowwwW.WW.',
  '.ww.wwwwwwwW.WW.',
  '.ww.wwwowwwW.WW.',
  '.ww.wwwwwwwW.WW.',
  '.WW.wwwowwwW.WW.',
  '....wwwwwwwW....',
  '....wwwwwwWW....',
  '....WWWWWWWW....',
  '................',
];

function woolCoat(): Sprite {
  return fromRows('item_wool_coat', COAT_ROWS, {
    '.': null, w: P.coatWool, W: P.coatWoolShade, r: P.scarf, R: P.scarfShade, o: P.woodDeep,
  }).outline();
}

/** The old yellow rain jacket from the rig: a hood in place of the scarf. */
function rainJacket(): Sprite {
  return fromRows('item_rain_jacket', COAT_ROWS, {
    '.': null, w: P.raincoat, W: P.raincoatShade, r: P.raincoatLight, R: P.raincoatShade, o: P.steelDeep,
  }).outline();
}

export function clothesItemIcons(): Sprite[] {
  return [leafCape(), sunHat(), woolTuft(), woolCoat(), rainJacket()];
}

// ---- The thorny juniper (Pine Ridge) ----------------------------------------------------

/** A low, prickly juniper; goats brush past it and leave tufts of wool on the thorns. */
function juniper(name: string, wool: boolean): Sprite {
  const s = new Sprite(name);
  const blobs: [number, number, number][] = [[8, 10, 5], [4, 11.5, 3.5], [12, 11.5, 3.5], [7, 7, 3], [10.5, 7.5, 2.8]];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!blobs.some(([bx, by, r]) => Math.hypot(x + 0.5 - bx, y + 0.5 - by) <= r)) continue;
      const clump = hash2(x >> 1, y >> 1, 83) - 0.5;
      const l = -0.55 * ((x + 0.5 - 8) / 7) - 0.75 * ((y + 0.5 - 9.5) / 7) + clump * 0.6;
      s.set(x, y, l > 0.4 ? P.spruceLight : l > -0.15 ? P.spruce : P.spruceDark);
    }
  }
  // Pale thorns poke out between the needles.
  for (const [x, y] of [[3, 9], [6, 5], [11, 6], [13, 10], [8, 13], [5, 12], [10, 10]]) s.set(x, y, P.thorn);
  if (wool) {
    for (const [x, y] of [[4, 8], [10, 5], [11, 11]]) {
      s.set(x, y, P.wool);
      s.set(x + 1, y, P.wool);
      s.set(x + 1, y - 1, P.wool);
      s.set(x, y + 1, P.woolShade);
      s.set(x + 1, y + 1, P.woolShade);
      s.set(x + 2, y, P.woolDark);
    }
  }
  return s.outline().shadow(8, 14.6, 6.5, 1.3);
}

export function thornBushes(): Sprite[] {
  return [juniper('thorn_bush_wool', true), juniper('thorn_bush', false)];
}
