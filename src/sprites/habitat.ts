import { PALETTE as P } from './palette';
import { hash2, Sprite } from './pixel';

// The rig habitat: special parts the helicopter brings (solar panel, cooker,
// motor), the buildings made with them (solar station, galley, machine
// shop), the steel frame they go up on, and what they let the explorer
// make (lamp post, fish stew).

/** An item icon; `after` draws on top of the outline (steam). */
function icon(name: string, draw: (s: Sprite) => void, after?: (s: Sprite) => void): Sprite {
  const s = new Sprite(`item_${name}`);
  draw(s);
  s.outline();
  after?.(s);
  return s;
}

/** A blue solar panel from (x0, y0), `w` × `h`, with white cell lines and a steel rim. */
function panel(s: Sprite, x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const rim = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      const line = (x - x0) % 3 === 0 || (y - y0) % 3 === 0;
      let c: string = rim ? (y === y0 || x === x0 ? P.steelLight : P.steelDark) : line ? P.paintBlue : P.paintBlueDark;
      // A glint across the top left cells.
      if (!rim && !line && x - x0 + y - y0 < 5) c = P.glass;
      s.set(x, y, c);
    }
  }
}

/** Riveted steel walls of a rig building from (x0, y0) to (x1, y1), in a paint colour. */
function walls(s: Sprite, x0: number, y0: number, x1: number, y1: number, light: string, mid: string, dark: string, seed: number): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let c = x <= x0 + 1 ? light : x >= x1 - 1 ? dark : x % 4 === 0 ? dark : mid;
      if (y > y0 + 6 && hash2(x, y, seed) < 0.06) c = P.rust;
      s.set(x, y, c);
    }
  }
  // A steel roof edge.
  for (let x = x0 - 1; x <= x1 + 1; x++) {
    s.set(x, y0 - 2, P.steelLight);
    s.set(x, y0 - 1, P.steelDark);
  }
}

export function habitatItemIcons(): Sprite[] {
  return [
    icon('solar_panel', (s) => {
      panel(s, 2, 3, 12, 9);
      // Two short legs that hold it up.
      for (const x of [4, 11]) for (let y = 12; y <= 14; y++) s.set(x, y, P.steelDark);
    }),
    icon('cooker', (s) => {
      // A white electric cooker with two black hot plates, a red knob and an oven door.
      for (let y = 4; y <= 14; y++) {
        for (let x = 2; x <= 13; x++) s.set(x, y, y <= 6 ? P.steelLight : x >= 12 || y === 14 ? P.steel : P.paintWhite);
      }
      for (const [cx, cy] of [[5, 5], [10, 5]]) {
        for (let x = cx - 2; x <= cx + 1; x++) s.set(x, cy, P.coal);
        s.set(cx - 1, cy - 1, P.coal);
        s.set(cx, cy - 1, P.coal);
      }
      s.set(4, 8, P.paintRed);
      s.set(7, 8, P.paintRed);
      for (let y = 10; y <= 13; y++) for (let x = 4; x <= 11; x++) s.set(x, y, y === 10 ? P.steel : P.glass);
      s.set(5, 11, P.glassLight);
    }),
    icon('motor', (s) => {
      // A grey engine block with cooling fins, a yellow cap and a shaft with a gear.
      for (let y = 5; y <= 13; y++) {
        for (let x = 2; x <= 10; x++) s.set(x, y, y % 2 === 0 ? P.steelDark : x <= 3 ? P.steelLight : P.steel);
      }
      for (let x = 3; x <= 9; x++) s.set(x, 4, P.hazard);
      for (let x = 4; x <= 8; x++) s.set(x, 3, P.hazardDark);
      for (let x = 11; x <= 13; x++) s.set(x, 9, P.steelDeep);
      for (const [x, y] of [[14, 7], [14, 8], [14, 9], [14, 10], [14, 11], [13, 8], [13, 10]]) s.set(x, y, P.steelLight);
    }),
    icon('fish_stew', (s) => {
      // A wooden bowl of orange stew with fish and carrot, and steam.
      for (let y = 8; y <= 14; y++) {
        const half = y === 8 ? 6 : 6 - Math.max(0, y - 11);
        for (let x = 8 - half; x <= 7 + half; x++) s.set(x, y, y === 8 ? P.flameOrange : x < 8 - half + 2 ? P.woodLight : y === 14 ? P.woodDark : P.wood);
      }
      for (const [x, y, c] of [[4, 8, P.fishCookedLight], [5, 8, P.fishCooked], [9, 8, P.carrot], [10, 8, P.carrot], [7, 8, P.leaf]] as const) s.set(x, y, c);
    }, (s) => {
      for (const [x, y] of [[6, 5], [7, 4], [6, 3], [10, 5], [11, 4], [10, 3]]) s.set(x, y, P.steam);
    }),
  ];
}

/** The steel frame a habitat building goes up on: girders, a half-done floor and a stack of plates. */
export function habitatSite(): Sprite {
  const s = new Sprite('habitat_site', 24, 28);
  // Four corner posts and two cross girders.
  for (const x of [3, 4, 19, 20]) for (let y = 8; y <= 26; y++) s.set(x, y, x % 2 ? P.steelLight : P.steelDark);
  for (const y of [8, 9, 17]) for (let x = 3; x <= 20; x++) s.set(x, y, y === 9 ? P.steelDark : P.steelLight);
  // Diagonal braces between the posts.
  for (let i = 0; i <= 7; i++) {
    s.set(5 + i * 2, 10 + i, P.steelDeep);
    s.set(18 - i * 2, 10 + i, P.steelDeep);
  }
  // A stack of new plates and a yellow and black safety board in front.
  for (let y = 22; y <= 26; y++) for (let x = 7; x <= 15; x++) s.set(x, y, y === 22 ? P.steelLight : y % 2 ? P.steelDark : P.steel);
  for (let x = 1; x <= 22; x++) s.set(x, 20, Math.floor(x / 2) % 2 ? P.hazard : P.outline);
  s.outline().shadow(12, 27, 10.5, 1.3);
  return s;
}

/** The solar station: two tilted panels on a steel frame and a battery box with a green light. */
export function solarStation(): Sprite {
  const s = new Sprite('solar_station', 24, 24);
  // The frame under the panels.
  for (let x = 2; x <= 21; x++) s.set(x, 15, P.steelDark);
  for (const x of [3, 11, 20]) for (let y = 12; y <= 21; y++) s.set(x, y, P.steelDark);
  panel(s, 1, 4, 11, 10);
  panel(s, 12, 4, 11, 10);
  // The battery box with a hazard stripe and a light that shows it is charged.
  for (let y = 16; y <= 22; y++) {
    for (let x = 6; x <= 17; x++) s.set(x, y, y === 16 ? P.steelLight : y === 18 ? P.hazard : x >= 16 ? P.steelDark : P.steel);
  }
  for (const x of [8, 11, 14]) s.set(x, 18, P.hazardDark);
  s.set(15, 20, P.paintGreenLight);
  return s.outline().shadow(12, 23, 10.5, 1.3);
}

/** The galley: a white steel kitchen with a warm serving hatch, a fish sign and a steaming pipe (2 frames). */
function galleyFrame(name: string, frame: 0 | 1): Sprite {
  const s = new Sprite(name, 24, 28);
  walls(s, 2, 12, 21, 26, P.paintWhite, P.paintWhite, P.steelLight, 320);
  // A red stripe round the walls.
  for (let x = 2; x <= 21; x++) s.set(x, 14, x >= 20 ? P.paintRedDark : P.paintRed);
  // The serving hatch with warm light and a pot inside.
  for (let y = 17; y <= 21; y++) for (let x = 4; x <= 11; x++) s.set(x, y, y === 17 || x === 4 || x === 11 ? P.steelDark : y === 18 ? P.flame : P.flameCore);
  for (let x = 6; x <= 9; x++) s.set(x, 21, P.steelDeep);
  s.set(6, 20, P.steelDeep);
  s.set(9, 20, P.steelDeep);
  // The door.
  for (let y = 17; y <= 26; y++) for (let x = 15; x <= 18; x++) s.set(x, y, x === 15 || y === 17 ? P.steelDeep : P.steelDark);
  // A blue fish sign over the hatch.
  for (const [x, y, c] of [[6, 15, P.fish], [7, 15, P.fishLight], [8, 15, P.fish], [9, 15, P.fishDark], [5, 16, P.fishFin], [10, 16, P.fish], [5, 14, P.fishFin]] as const) s.set(x, y, c);
  // The chimney pipe.
  for (let y = 5; y <= 9; y++) for (let x = 16; x <= 17; x++) s.set(x, y, x === 16 ? P.steelLight : P.steelDark);
  s.outline().shadow(12, 27, 10.5, 1.3);
  // Steam from the pipe.
  for (const [x, y] of frame ? [[17, 3], [18, 2], [16, 1]] : [[16, 3], [17, 2], [18, 0]]) s.set(x, y, P.steam);
  return s;
}

export function galley(): Sprite[] {
  return [galleyFrame('galley', 0), galleyFrame('galley_2', 1)];
}

/** The machine shop: a green steel shed with a striped roll door, a gear sign and a hoist arm. */
export function machineShop(): Sprite {
  const s = new Sprite('machine_shop', 24, 28);
  walls(s, 2, 11, 21, 26, P.paintGreenLight, P.paintGreen, P.paintGreenDark, 321);
  // The roll door: grey slats with a yellow and black edge at the bottom.
  for (let y = 15; y <= 26; y++) {
    for (let x = 5; x <= 16; x++) s.set(x, y, y === 25 ? (Math.floor(x / 2) % 2 ? P.hazard : P.outline) : y % 2 ? P.steel : P.steelLight);
  }
  // A gear sign over the door.
  for (let y = 11; y <= 14; y++) {
    for (let x = 9; x <= 12; x++) {
      const d = Math.hypot(x + 0.5 - 11, y + 0.5 - 13);
      if (d < 2.2 && d > 0.8) s.set(x, y, P.hazard);
    }
  }
  // The hoist arm on the roof, with a hook.
  for (let y = 3; y <= 9; y++) s.set(19, y, P.steelDark);
  for (let x = 12; x <= 19; x++) s.set(x, 3, P.steelDark);
  for (let y = 4; y <= 6; y++) s.set(13, y, P.strawLight);
  s.set(13, 7, P.steelLight);
  s.set(12, 8, P.steelLight);
  s.set(13, 8, P.steelLight);
  // A small window.
  for (let y = 17; y <= 19; y++) for (let x = 18; x <= 20; x++) s.set(x, y, P.glass);
  return s.outline().shadow(12, 27, 10.5, 1.3);
}

/** A lamp post: a steel post with a lamp that lights the deck at night. */
export function lampPost(): Sprite {
  const s = new Sprite('lamp_post', 16, 24);
  for (let y = 6; y <= 21; y++) {
    s.set(7, y, P.steelLight);
    s.set(8, y, P.steelDark);
  }
  for (let x = 5; x <= 10; x++) s.set(x, 22, x < 7 ? P.steelLight : P.steelDark);
  // The lamp head: a steel hood over a bright bulb.
  for (let x = 4; x <= 11; x++) s.set(x, 3, x < 6 ? P.steelLight : P.steelDark);
  for (let x = 5; x <= 10; x++) s.set(x, 4, P.steel);
  for (let x = 5; x <= 10; x++) s.set(x, 5, x === 5 || x === 10 ? P.flame : P.flameCore);
  s.outline().shadow(8, 23, 4.5, 1);
  return s;
}

export function habitatSprites(): Sprite[] {
  return [...habitatItemIcons(), habitatSite(), solarStation(), ...galley(), machineShop(), lampPost()];
}
