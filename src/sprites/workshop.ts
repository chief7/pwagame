import { PALETTE as P } from './palette';
import { hash2, Sprite } from './pixel';

// The rig's workshop: metal tools made from scrap, what they bring back from
// the islands (ore, coal, clay, spare parts), and the buildings on the rig
// that use it (furnace, greenhouse, water maker, fish trap).

function icon(name: string, draw: (s: Sprite) => void): Sprite {
  const s = new Sprite(`item_${name}`);
  draw(s);
  return s.outline();
}

/** A rounded lump, lit from the top left; `speck` sprinkles a second colour. */
function lump(s: Sprite, cx: number, cy: number, rx: number, ry: number, light: string, mid: string, dark: string, seed: number, speck?: string): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1 + (hash2(x, y, seed) - 0.5) * 0.3) continue;
      const l = -nx - ny;
      let c = l > 0.6 ? light : l > -0.5 ? mid : dark;
      if (speck && hash2(x, y, seed + 1) < 0.22) c = speck;
      s.set(x, y, c);
    }
  }
}

/** A tool on a diagonal wooden handle, from bottom left (x0, y0) up to the right, `n` pixels long. */
function handle(s: Sprite, x0: number, y0: number, n: number): void {
  for (let i = 0; i < n; i++) {
    s.set(x0 + i, y0 - i, i % 4 === 0 ? P.woodDark : P.wood);
    s.set(x0 + i + 1, y0 - i, P.woodLight);
  }
}

export function workshopItemIcons(): Sprite[] {
  return [
    icon('pickaxe', (s) => {
      handle(s, 2, 14, 10);
      // A curved steel head across the top of the handle.
      for (const [x, y, c] of [
        [6, 3, P.steelLight], [7, 3, P.steelLight], [8, 3, P.steel], [9, 4, P.steel], [10, 4, P.steel], [11, 5, P.steel], [12, 6, P.steelDark],
        [13, 8, P.steelDark], [13, 7, P.steelDark], [5, 4, P.steelLight], [4, 5, P.steel], [3, 6, P.steelDark],
      ] as const) s.set(x, y, c);
    }),
    icon('shovel', (s) => {
      handle(s, 7, 9, 6);
      // The grip at the top, and the blade at the bottom.
      for (const [x, y] of [[12, 2], [13, 3], [13, 2], [14, 2]]) s.set(x, y, P.woodDark);
      for (let y = 9; y <= 14; y++) {
        for (let x = 2; x <= 7; x++) {
          if (x + (14 - y) < 4 || x - y > 0) continue;
          s.set(x, y, x + y < 14 ? P.steelLight : y === 14 || x === 7 ? P.steelDark : P.steel);
        }
      }
    }),
    icon('crowbar', (s) => {
      for (let i = 0; i < 11; i++) {
        s.set(3 + i, 13 - i, i < 3 || i > 8 ? P.steelDark : P.paintRed);
        s.set(4 + i, 13 - i, i < 3 || i > 8 ? P.steelLight : P.paintRedLight);
      }
      // The hooked end, split into two claws.
      for (const [x, y] of [[13, 2], [12, 1], [11, 1], [10, 2], [2, 13], [2, 14], [3, 15]]) s.set(x, y, P.steelDark);
    }),
    icon('iron_ore', (s) => lump(s, 8, 9, 5.5, 4.5, P.stoneLight, P.stoneDark, P.stoneDeep, 401, P.ore)),
    icon('coal', (s) => {
      lump(s, 6, 10, 4, 3.5, P.coalShine, P.coal, P.outline, 402);
      lump(s, 10.5, 8, 3.5, 3, P.coalShine, P.coal, P.outline, 403);
    }),
    icon('clay', (s) => {
      // A slab of wet clay with a thumb print.
      for (let y = 6; y <= 13; y++) {
        for (let x = 2; x <= 13; x++) {
          const top = y <= 7;
          s.set(x, y, top ? P.clayLight : x >= 12 || y === 13 ? P.clayDark : P.clay);
        }
      }
      for (const [x, y] of [[6, 9], [7, 9], [6, 10]]) s.set(x, y, P.clayDark);
      s.set(4, 6, P.paintWhite);
    }),
    icon('spare_part', (s) => {
      // A small gear with a hole in the middle.
      for (let y = 2; y <= 14; y++) {
        for (let x = 2; x <= 14; x++) {
          const dx = x + 0.5 - 8;
          const dy = y + 0.5 - 8;
          const d = Math.hypot(dx, dy);
          const tooth = Math.cos(Math.atan2(dy, dx) * 8) > 0.3;
          if (d > (tooth ? 6.2 : 4.8) || d < 1.6) continue;
          s.set(x, y, dx + dy < -2 ? P.steelLight : dx + dy > 3 ? P.steelDark : P.steel);
        }
      }
    }),
    icon('steel_plate', (s) => {
      // Two plates, one on the other, with a bright edge.
      for (const [y0, x0] of [[9, 2], [5, 4]]) {
        for (let y = y0; y <= y0 + 3; y++) {
          for (let x = x0; x <= x0 + 9; x++) s.set(x, y, y === y0 ? P.steelLight : y === y0 + 3 ? P.steelDeep : x < x0 + 2 ? P.steelLight : P.steel);
        }
      }
      s.set(7, 6, P.paintWhite);
    }),
    icon('vegetables', (s) => {
      // A carrot with its leaves, and a tomato.
      for (let i = 0; i < 7; i++) {
        s.set(3 + i, 13 - i, P.carrot);
        s.set(4 + i, 13 - i, i < 5 ? P.carrot : P.clayDark);
      }
      for (const [x, y] of [[10, 4], [11, 3], [12, 4], [11, 5], [12, 2], [13, 3]]) s.set(x, y, P.leaf);
      lump(s, 11, 11, 3, 3, P.berryLight, P.tomato, P.paintRedDark, 404);
      s.set(11, 8, P.leafDark);
    }),
  ];
}

/** A rock in the cliffs with rusty iron streaks and black coal; mined, only pick marks are left. */
export function oreVein(): Sprite[] {
  const vein = (name: string, mined: boolean) => {
    const s = new Sprite(name);
    lump(s, 8, 9.5, 6.5, 5, P.stoneLight, P.stone, P.stoneDark, 405);
    if (!mined) {
      for (const [x, y] of [[5, 7], [6, 8], [7, 8], [8, 9], [10, 10], [11, 10], [6, 11]]) s.set(x, y, P.ore);
      for (const [x, y] of [[9, 6], [10, 6], [4, 10], [12, 12]]) s.set(x, y, P.coal);
      s.set(5, 6, P.clayLight);
    } else {
      for (const [x, y] of [[6, 8], [7, 9], [10, 7], [9, 11]]) s.set(x, y, P.stoneDeep);
    }
    return s.outline().shadow(8, 15, 7, 1.2);
  };
  return [vein('ore_vein', false), vein('ore_vein_mined', true)];
}

/** A wet orange clay bank; dug out, a shallow hole with a little water in it. */
export function clayBank(): Sprite[] {
  const bank = (name: string, dug: boolean) => {
    const s = new Sprite(name);
    for (let y = 7; y <= 14; y++) {
      for (let x = 1; x <= 14; x++) {
        const d = Math.hypot((x + 0.5 - 8) / 7, (y + 0.5 - 11) / 4);
        if (d > 1) continue;
        let c: string = d < 0.5 && y < 11 ? P.clayLight : y > 12 ? P.clayDark : P.clay;
        if (dug && d < 0.55) c = y < 11 ? P.clayDark : P.waterShade;
        s.set(x, y, c);
      }
    }
    if (!dug) for (const [x, y] of [[5, 9], [10, 10]]) s.set(x, y, P.paintWhite);
    return s.outline().shadow(8, 15, 7, 1);
  };
  return [bank('clay_bank', false), bank('clay_bank_dug', true)];
}

/** An old crate shut with steel bands and a padlock: the crowbar opens it. */
export function sealedCrate(): Sprite {
  const s = new Sprite('sealed_crate');
  for (let y = 5; y <= 14; y++) {
    for (let x = 2; x <= 13; x++) {
      const band = x === 5 || x === 10;
      s.set(x, y, band ? (y === 5 ? P.steelLight : P.steelDark) : y === 5 ? P.woodLight : x === 13 || y === 14 ? P.woodDeep : (x + y) % 4 === 0 ? P.woodDark : P.wood);
    }
  }
  // The padlock in front.
  for (const [x, y, c] of [[7, 8, P.steelDark], [8, 8, P.steelDark], [6, 9, P.gold], [7, 9, P.gold], [8, 9, P.gold], [9, 9, P.goldDark], [6, 10, P.gold], [7, 10, P.outline], [8, 10, P.gold], [9, 10, P.goldDark]] as const) s.set(x, y, c);
  return s.outline().shadow(8, 15, 7, 1.2);
}

/** The furnace: a brick kiln of clay with a chimney; its mouth glows (2 frames). */
function furnaceFrame(name: string, frame: 0 | 1): Sprite {
  const s = new Sprite(name, 24, 28);
  for (let y = 10; y <= 26; y++) {
    const half = y < 14 ? 5 + (y - 10) : 9;
    for (let x = 12 - half; x <= 11 + half; x++) {
      const brick = (y % 3 === 0) || ((x + (Math.floor(y / 3) % 2) * 2) % 4 === 0);
      s.set(x, y, brick ? P.clayDark : x < 12 - half + 2 ? P.clayLight : P.clay);
    }
  }
  // Chimney.
  for (let y = 2; y <= 10; y++) for (let x = 15; x <= 18; x++) s.set(x, y, x === 15 ? P.clayLight : (y % 3 === 0 ? P.clayDark : P.clay));
  // The glowing mouth.
  for (let y = 19; y <= 25; y++) {
    for (let x = 8; x <= 15; x++) {
      const d = Math.hypot((x + 0.5 - 12) / 4, (y + 0.5 - 25) / 6);
      if (d > 1) continue;
      s.set(x, y, d < 0.45 ? P.flameCore : d < 0.75 ? (frame ? P.flame : P.flameOrange) : P.flameRed);
    }
  }
  s.outline().shadow(12, 27, 10, 1.3);
  // Smoke from the chimney.
  for (const [x, y] of frame ? [[17, 0], [18, 1]] : [[16, 1], [17, 0]]) s.set(x, y, P.steam);
  return s;
}

export function furnace(): Sprite[] {
  return [furnaceFrame('furnace', 0), furnaceFrame('furnace_2', 1)];
}

/** The greenhouse: a steel frame with glass panes and vegetables growing inside; picked, only small shoots. */
export function greenhouse(): Sprite[] {
  const house = (name: string, picked: boolean) => {
    const s = new Sprite(name, 32, 28);
    // Glass walls and a pitched glass roof in a steel frame.
    for (let y = 4; y <= 26; y++) {
      const roof = y < 12;
      const half = roof ? 4 + (y - 4) * 1.5 : 15;
      for (let x = Math.ceil(16 - half); x <= Math.floor(15 + half); x++) {
        const frame = x === Math.ceil(16 - half) || x === Math.floor(15 + half) || x % 6 === 3 || y === 12 || y === 26;
        s.set(x, y, frame ? P.steelDark : (x + y) % 9 === 0 ? P.glassLight : roof ? P.glassLight : P.washSea);
      }
    }
    // Rows of plants behind the glass.
    for (let x = 3; x <= 28; x++) {
      if (x % 6 === 3) continue;
      const tall = picked ? (x % 3 === 0 ? 24 : 26) : 18 + (x % 3);
      for (let y = tall; y <= 25; y++) s.set(x, y, y === tall ? P.leafLight : P.leaf);
      if (!picked && x % 4 === 1) s.set(x, tall + 2, P.tomato);
      if (!picked && x % 4 === 3) s.set(x, tall + 3, P.carrot);
    }
    return s.outline().shadow(16, 27, 14, 1.3);
  };
  return [house('greenhouse', false), house('greenhouse_picked', true)];
}

/** The water maker: a steel tank on legs that turns sea water into drinking water, with a pipe and a tap. */
export function waterMaker(): Sprite {
  const s = new Sprite('water_maker', 16, 24);
  for (let y = 4; y <= 17; y++) {
    for (let x = 3; x <= 12; x++) s.set(x, y, y === 4 ? P.steelLight : y === 10 ? P.paintBlue : x <= 4 ? P.steelLight : x >= 11 ? P.steelDeep : P.steel);
  }
  // A small gauge, the legs, and the tap with a blue handle.
  for (const [x, y, c] of [[6, 7, P.paintWhite], [7, 7, P.paintWhite], [7, 6, P.outline]] as const) s.set(x, y, c);
  for (let y = 18; y <= 22; y++) for (const x of [4, 11]) s.set(x, y, P.steelDark);
  for (const [x, y] of [[13, 13], [14, 13], [14, 14]]) s.set(x, y, P.steelDark);
  s.set(14, 12, P.paintBlue);
  // The pipe down to the sea.
  for (let y = 15; y <= 22; y++) s.set(1, y, P.steelDark);
  for (let x = 1; x <= 3; x++) s.set(x, 15, P.steelDark);
  s.outline().shadow(8, 23, 6.5, 1);
  s.set(14, 16, P.waterShallow);
  return s;
}

/** A fish trap in the sea: a wire cage under a red float, tied to the deck; empty, no fish inside. */
export function fishTrap(): Sprite[] {
  const trap = (name: string, full: boolean) => {
    const s = new Sprite(name);
    for (let y = 8; y <= 14; y++) {
      for (let x = 3; x <= 12; x++) {
        const wire = x % 3 === 0 || y % 3 === 2 || x === 3 || x === 12 || y === 8 || y === 14;
        if (wire) s.set(x, y, y > 11 ? P.steelDark : P.steel);
      }
    }
    if (full) for (const [x, y, c] of [[5, 10, P.fishLight], [6, 10, P.fish], [7, 10, P.fish], [8, 12, P.fishLight], [9, 12, P.fish], [10, 12, P.fish]] as const) s.set(x, y, c);
    // The float and its rope up to the deck.
    for (const [x, y, c] of [[7, 5, P.paintRedLight], [8, 5, P.paintRed], [7, 6, P.paintRed], [8, 6, P.paintRedDark]] as const) s.set(x, y, c);
    for (let y = 0; y <= 4; y++) s.set(8, y, P.strawLight);
    s.outline();
    // Ripples where it floats.
    for (const [x, y] of [[4, 7], [5, 7], [10, 7], [11, 7]]) s.set(x, y, P.foam);
    return s;
  };
  return [trap('fish_trap', true), trap('fish_trap_empty', false)];
}

/** The icon of the bigger hold: two crates and a yellow plus. */
export function holdIcon(): Sprite {
  const s = new Sprite('hold_upgrade');
  for (const [x0, y0] of [[1, 9], [8, 9], [4, 2]]) {
    for (let y = y0; y <= y0 + 5; y++) {
      for (let x = x0; x <= x0 + 5; x++) {
        if (y0 === 2 && y > 6) continue;
        const edge = x === x0 + 5 || y === y0 + 5;
        s.set(x, y, y === y0 ? P.woodLight : edge ? P.woodDark : (x + y) % 3 === 0 ? P.woodDark : P.wood);
      }
    }
  }
  s.outline();
  for (const [x, y] of [[13, 1], [13, 2], [13, 3], [13, 4], [13, 5], [11, 3], [12, 3], [14, 3], [15, 3]]) s.set(x, y, P.hazard);
  return s;
}

export function workshopSprites(): Sprite[] {
  return [
    ...workshopItemIcons(), ...oreVein(), ...clayBank(), sealedCrate(), ...furnace(), ...greenhouse(), waterMaker(), ...fishTrap(), holdIcon(),
  ];
}
