import { PALETTE as P } from './palette';
import { fromRows, Sprite, type Color } from './pixel';

// Castaway explorer, 16×16, drawn as templates so hair, skin and clothes are
// swappable. Keys: k outline, s/S skin, e eye, h/H hair, c/C shirt,
// p/P trousers, b boots, f/F hair flower, a shadow (capitals are the
// shaded tone).

export type Facing = 'down' | 'up' | 'right' | 'left';

export interface Look {
  skin: string;
  skinShade: string;
  hair: string;
  hairShade: string;
  shirt: string;
  shirtShade: string;
  trousers: string;
  trousersShade: string;
}

export const LOOKS = {
  male: {
    skin: P.skin, skinShade: P.skinShade, hair: P.hairDark, hairShade: P.hairDarkShade,
    shirt: P.shirtRed, shirtShade: P.shirtRedShade, trousers: P.trousers, trousersShade: P.trousersShade,
  },
  female: {
    skin: P.skin, skinShade: P.skinShade, hair: P.hairAuburn, hairShade: P.hairAuburnShade,
    shirt: P.shirtTeal, shirtShade: P.shirtTealShade, trousers: P.trousers, trousersShade: P.trousersShade,
  },
} satisfies Record<string, Look>;

type Body = 'male' | 'female';

const TEMPLATES: Record<Body, Record<'down' | 'up' | 'right', readonly string[]>> = {
  male: {
    down: [
      '................',
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhhhhhhk...',
      '...khssssssHk...',
      '...kssessesSk...',
      '...kssssssSSk...',
      '....kSssssSk....',
      '..kcccccccccCk..',
      '..kscccccccCsk..',
      '..kscccccccCsk..',
      '..kSppppppPPSk..',
      '...kppPkkpPPk...',
      '...kbbbkkbbbk...',
      '..akkkkaakkkka..',
    ],
    up: [
      '................',
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhhhhhhk...',
      '...khhhhhhhHk...',
      '...khhhhhhHHk...',
      '...khhhhhhHHk...',
      '....kSssssSk....',
      '..kcccccccccCk..',
      '..kscccccccCsk..',
      '..kscccccccCsk..',
      '..kSppppppPPSk..',
      '...kppPkkpPPk...',
      '...kbbbkkbbbk...',
      '..akkkkaakkkka..',
    ],
    right: [
      '................',
      '................',
      '......kkkkk.....',
      '.....khhhhhk....',
      '....khhhhhhhk...',
      '....khhhhsssk...',
      '....khhhssesk...',
      '....khhSsssssk..',
      '.....kSsssSkk...',
      '....kcccccccCk..',
      '....kccCccccCk..',
      '....kccSccccCk..',
      '....kppSpppPk...',
      '.....kpPpPk.....',
      '.....kbbbbbk....',
      '....akkkkkkka...',
    ],
  },
  female: {
    down: [
      '................',
      '................',
      '.....kkkkkk.....',
      '....khhhhhfk....',
      '...khhhhhhhfFk..',
      '...khhsssssHk...',
      '...khsessesHk...',
      '...khssssSSHk...',
      '...khSssssSHk...',
      '..khcccccccCHk..',
      '..kscccccccCsk..',
      '..kscccccccCsk..',
      '..kSppppppPPSk..',
      '...kssSkksSSk...',
      '...kbbbkkbbbk...',
      '..akkkkaakkkka..',
    ],
    up: [
      '................',
      '................',
      '.....kkkkkk.....',
      '....kfhhhhhk....',
      '..kFfhhhhhhhk...',
      '...khhhhhhhHk...',
      '...khhhhhhHHk...',
      '...khhhhhhHHk...',
      '...khhhhhhHHk...',
      '..kchhhhhhhHCk..',
      '..ksccHhhHcCsk..',
      '..kscccccccCsk..',
      '..kSppppppPPSk..',
      '...kssSkksSSk...',
      '...kbbbkkbbbk...',
      '..akkkkaakkkka..',
    ],
    right: [
      '................',
      '................',
      '......kkkkk.....',
      '.....kfhhhhk....',
      '....kFfhhhhhk...',
      '....khhhhsssk...',
      '....khhhssesk...',
      '...khhhSsssssk..',
      '...khhkSsssSk...',
      '...khkcccccCk...',
      '....kcCcccccCk..',
      '....kccSccccCk..',
      '....kppSpppPk...',
      '.....ksSsSk.....',
      '.....kbbbbbk....',
      '....akkkkkkka...',
    ],
  },
};

function keyFor(look: Look): Record<string, Color> {
  return {
    '.': null, k: P.outline, a: P.shadow, e: P.outline, b: P.boots, f: P.flower, F: P.gold,
    s: look.skin, S: look.skinShade, h: look.hair, H: look.hairShade,
    c: look.shirt, C: look.shirtShade, p: look.trousers, P: look.trousersShade,
  };
}

/** Animation frame: 0 standing, 1 and 2 the two halves of a step. */
export type Frame = 0 | 1 | 2;

export function characterName(body: Body, facing: Facing, frame: Frame = 0): string {
  return frame === 0 ? `${body}_${facing}` : `${body}_${facing}_walk${frame}`;
}

export function character(body: Body, facing: Facing, frame: Frame = 0, look: Look = LOOKS[body]): Sprite {
  const name = characterName(body, facing, frame);
  if (facing === 'left') return character(body, 'right', frame, look).mirrored(name);
  return fromRows(name, walkRows(body, facing, frame), keyFor(look));
}

export function characterSet(body: Body): Sprite[] {
  const facings = ['down', 'up', 'right', 'left'] as const;
  return [
    ...facings.flatMap((f) => ([0, 1, 2] as const).map((fr) => character(body, f, fr))),
    ...facings.map((f) => fishingPose(body, f)),
  ];
}

export function fishingName(body: Body, facing: Facing): string {
  return `${body}_${facing}_fish`;
}

/** A straight 1px line from (x0, y0) to (x1, y1); `color` gets the step index. */
function line(s: Sprite, x0: number, y0: number, x1: number, y1: number, color: (i: number) => string): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) s.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, color(i));
}

/**
 * The explorer casting the fishing rod, 32 × 24: the standing pose in the
 * middle, the rod reaching out over the water it faces, the line and a
 * bobber. Wider and taller than the cell, so the rod reaches the next one.
 */
export function fishingPose(body: Body, facing: Facing, outfit: Outfit = {}): Sprite {
  const name = fishingName(body, facing) + outfitTag(outfit);
  if (facing === 'left') return fishingPose(body, 'right', outfit).mirrored(name);
  const s = new Sprite(name, 32, 24);
  const stand = dressed(body, facing, 0, outfit);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s.set(x + 8, y + 8, stand.get(x, y));
  const rod = (i: number) => (i < 3 ? P.outline : i < 7 ? P.woodDeep : P.woodDark);
  const cord = () => P.fishingLine;
  const bobber = (x: number, y: number) => {
    s.set(x, y, P.flowerWhite);
    s.set(x, y + 1, P.bobber);
  };
  if (facing === 'right') {
    // Held out at the front, tip over the next cell, line down into the water.
    line(s, 19, 18, 29, 8, rod);
    line(s, 30, 8, 30, 18, cord);
    bobber(30, 19);
  } else if (facing === 'up') {
    // Over the shoulder, tip in the cell above.
    line(s, 20, 17, 25, 2, rod);
    line(s, 26, 2, 26, 4, cord);
    bobber(26, 5);
  } else {
    // Facing you: the rod points out to the side, the line drops in front.
    line(s, 21, 17, 29, 11, rod);
    line(s, 30, 11, 30, 21, cord);
    bobber(30, 22);
  }
  return s;
}

// ---- Clothes ------------------------------------------------------------------------
//
// What the explorer carries shows on them: one garment on the body (the leaf
// cape, the wool coat or the old rain jacket) and the palm sun hat on the
// head. They are drawn into the same template rows, so every facing and step
// frame gets them. Extra keys: L/G/D leaves, w/W coat, r/R scarf, o button,
// u/y/Y straw, n hat band.

export type Garment = 'cape' | 'coat' | 'jacket';

export interface Outfit {
  garment?: Garment;
  hat?: boolean;
}

/** Rows to lay over the template: a space keeps the pixel below. Index = row number. */
type Patch = Partial<Record<number, string>>;

const HAT: Record<'down' | 'up' | 'right', Patch> = {
  down: {
    0: '.....kkkkkk.....',
    1: '....kuyyyyYk....',
    2: '....kyyyyyYk....',
    3: '..kkknnnnnnkkk..',
    4: '.kuyyyyyyyyyyYk.',
    5: '..kk        kk..',
  },
  up: {
    0: '.....kkkkkk.....',
    1: '....kuyyyyYk....',
    2: '....kyyyyyYk....',
    3: '..kkknnnnnnkkk..',
    4: '.kuyyyyyyyyyyYk.',
    5: '..kk        kk..',
  },
  right: {
    0: '......kkkkk.....',
    1: '.....kuyyyYk....',
    2: '.....kyyyyYk....',
    3: '...kkknnnnnkkk..',
    4: '..kuyyyyyyyyyYk.',
    5: '..kk         k..',
  },
};

const CAPE: Record<'down' | 'up' | 'right', Patch> = {
  // Facing you: a collar of palm leaves, and the cape shows at both sides.
  down: {
    9: '.kLLGLGGLGGGDDk.',
    10: 'kG            Dk',
    11: 'kG            Dk',
    12: 'kG            Dk',
    13: '.kD          Dk.',
    14: '..k          k..',
  },
  // From the back the cape covers the shirt, with a fringe of leaf tips.
  up: {
    9: '.kLLGLGGLGGGDDk.',
    10: 'kLLGLGLGGGLGGDDk',
    11: 'kLGLGGLGGGGGDDDk',
    12: 'kGLGGGLGGGGDGDDk',
    13: '.kGDk      kGDk.',
  },
  // From the side it hangs down the back.
  right: {
    9: '...kLLGLGGLGDk..',
    10: '..kLD           ',
    11: '..kGD           ',
    12: '..kGD           ',
    13: '...kD           ',
    14: '....k           ',
  },
};

/** The wool coat's scarf (the rain jacket has none). */
const SCARF: Record<'down' | 'up' | 'right', Patch> = {
  down: { 9: '    rrrrrrRR    ', 10: '         rR     ' },
  up: { 9: '    rrrrrrRR    ' },
  right: { 9: '     rrrrrR     ', 10: '     R          ' },
};

/** Buttons down the front of a coat or jacket. */
const BUTTONS: Record<'down' | 'up' | 'right', Patch> = {
  down: { 10: '       o        ', 12: '       o        ' },
  up: {},
  right: { 10: '          o     ' },
};

function applyPatch(rows: string[], patch: Patch): void {
  for (const [y, text] of Object.entries(patch)) {
    const row = Number(y);
    rows[row] = [...rows[row]].map((ch, x) => (text![x] === ' ' ? ch : text![x])).join('');
  }
}

/** A coat or jacket: the shirt, the arms (sleeves) and the top of the trousers take the coat colour. */
function wearCoat(rows: string[]): void {
  const swap: Record<number, Record<string, string>> = {
    9: { c: 'w', C: 'W' },
    10: { c: 'w', C: 'W', s: 'w', S: 'W' },
    11: { c: 'w', C: 'W', s: 'w', S: 'W' },
    12: { c: 'w', C: 'W', p: 'w', P: 'W' },
  };
  for (const [y, map] of Object.entries(swap)) {
    const row = Number(y);
    rows[row] = [...rows[row]].map((ch) => map[ch] ?? ch).join('');
  }
}

export function outfitTag(outfit: Outfit): string {
  return `${outfit.garment ? `_${outfit.garment}` : ''}${outfit.hat ? '_hat' : ''}`;
}

export function dressedName(body: Body, facing: Facing, frame: Frame, outfit: Outfit): string {
  return characterName(body, facing, frame) + outfitTag(outfit);
}

/** The explorer in their clothes; with no clothes this is the plain character. */
export function dressed(body: Body, facing: Facing, frame: Frame, outfit: Outfit, look: Look = LOOKS[body]): Sprite {
  const name = dressedName(body, facing, frame, outfit);
  if (facing === 'left') return dressed(body, 'right', frame, outfit, look).mirrored(name);
  const rows = walkRows(body, facing, frame);
  const g = outfit.garment;
  if (g === 'coat' || g === 'jacket') {
    wearCoat(rows);
    applyPatch(rows, BUTTONS[facing]);
    if (g === 'coat') applyPatch(rows, SCARF[facing]);
  }
  if (g === 'cape') applyPatch(rows, CAPE[facing]);
  if (outfit.hat) applyPatch(rows, HAT[facing]);
  const coat = g === 'jacket' ? [P.raincoat, P.raincoatShade] : [P.coatWool, P.coatWoolShade];
  return fromRows(name, rows, {
    ...keyFor(look),
    L: P.leafLight, G: P.leaf, D: P.leafDark,
    w: coat[0], W: coat[1], r: P.scarf, R: P.scarfShade, o: P.woodDeep,
    u: P.strawLight, y: P.straw, Y: P.strawDark, n: P.leafDark,
  });
}

/** Gallery set: both explorers in each outfit, standing, all four facings. */
export function clothesSet(): Sprite[] {
  const outfits: Outfit[] = [
    { hat: true }, { garment: 'cape' }, { garment: 'coat' }, { garment: 'jacket' },
    { garment: 'cape', hat: true }, { garment: 'coat', hat: true },
  ];
  const facings = ['down', 'up', 'right', 'left'] as const;
  return (['male', 'female'] as const).flatMap((b) => outfits.flatMap((o) => facings.map((f) => dressed(b, f, 0, o))));
}

function setRow(rows: string[], y: number, x: number, text: string): void {
  rows[y] = rows[y].slice(0, x) + text + rows[y].slice(x + text.length);
}

/**
 * Step frames are derived from the standing pose. Front and back: one foot
 * lifts into the trouser row (frame 1 left, frame 2 right). Side: legs apart.
 */
function walkRows(body: Body, facing: 'down' | 'up' | 'right', frame: Frame): string[] {
  const rows = [...TEMPLATES[body][facing]];
  if (frame === 0) return rows;
  if (facing === 'right') {
    const leg = body === 'male' ? 'kpPk.kpPk' : 'ksSk.ksSk';
    setRow(rows, 13, 0, `....${leg}...`);
    setRow(rows, 14, 0, '...kbbbk.kbbbk..');
    setRow(rows, 15, 0, frame === 1 ? '...akkkaaakkkka.' : '..akkkka.akkka..');
    if (frame === 2) setRow(rows, 14, 0, '..kbbbk..kbbbk..');
    return rows;
  }
  const left = frame === 1;
  setRow(rows, 13, left ? 4 : 9, 'bbb');
  setRow(rows, 14, left ? 3 : 8, 'kkkkk');
  setRow(rows, 15, left ? 3 : 9, 'aaaa');
  return rows;
}
