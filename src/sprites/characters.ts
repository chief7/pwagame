import { PALETTE as P } from './palette';
import { fromRows, type Color, type Sprite } from './pixel';

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
  return (['down', 'up', 'right', 'left'] as const).flatMap((f) => ([0, 1, 2] as const).map((fr) => character(body, f, fr)));
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
