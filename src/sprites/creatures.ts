import { fromRows, hash2, Sprite, type Color } from './pixel';
import { PALETTE as P } from './palette';

// Island animals, drawn as filled shapes; outline() and shadow() finish them
// so they match the rest of the set.

function creature(name: string, rows: readonly string[], key: Record<string, Color>, shadowRx: number): Sprite {
  return fromRows(name, rows, { '.': null, ...key }).outline().shadow(8, 14.6, shadowRx, 1.2);
}

export function crab(): Sprite {
  return creature('animal_crab', [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.cc..........cc.',
    '.cCc..e..e..cCc.',
    '..cc..c..c..cc..',
    '...c.cccccc.c...',
    '....cccccccc....',
    '...ccWccccWcc...',
    '...cccccccccc...',
    '....CCCCCCCC....',
    '...C.C.CC.C.C...',
    '................',
    '................',
  ], { c: '#e0583a', C: '#a83c26', W: '#f29a7a', e: '#20180f' }, 6);
}

export function turtle(): Sprite {
  return creature('animal_turtle', [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....SSSSSS.....',
    '....SsSssSsS....',
    '...SssSssSssS...',
    '...SsssSSsssS.hh',
    '..fSSSSSSSSSSfhe',
    '..f.ff....ff..h.',
    '.....f....f.....',
    '................',
    '................',
    '................',
  ], { S: '#4f7a3a', s: '#7aa64f', f: '#9cc97a', h: '#9cc97a', e: '#20180f' }, 6);
}

export function monkey(): Sprite {
  return creature('animal_monkey', [
    '................',
    '................',
    '................',
    '......bbbb......',
    '....bbbbbbbb....',
    '...bbffffffbb...',
    '..fbfeffffefbf..',
    '..fbffffffffbf..',
    '...bffnnnnffb...',
    '....bbffffbb....',
    '...bbbbffbbbb.t.',
    '..bb.bffffb.bbt.',
    '..b..bffffb..tt.',
    '....bbb..bbb....',
    '....bb....bb....',
    '................',
  ], { b: '#7a4f2e', f: '#e2b98a', n: '#b8875a', e: '#20180f', t: '#5e3b22' }, 5);
}

export function piglet(): Sprite {
  return creature('animal_piglet', [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...........pp...',
    '......pppppppp..',
    '....pppppppppppn',
    '...pppppppppepnn',
    '...ppppppppppppn',
    '.t.PpppppppppP..',
    '..tPPPPPPPPPP...',
    '...PP.PP..PP.PP.',
    '................',
    '................',
  ], { p: '#f2a7b0', P: '#d67f8c', n: '#c2606e', e: '#20180f', t: '#d67f8c' }, 6);
}

export function bat(): Sprite {
  return creature('animal_bat', [
    '................',
    '................',
    '................',
    '................',
    '......b..b......',
    '.ww...bbbb...ww.',
    'wwww.bbbbbb.wwww',
    'wwwwwbebbebwwwww',
    '.wwwwbbbbbbwwww.',
    '..ww.wbbbbw.ww..',
    '.......bb.......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ], { b: '#7a5a9e', w: '#523a70', e: '#ffd166' }, 4);
}

export function raft(): Sprite {
  return fromRows('raft', [
    '................',
    '................',
    '................',
    '.oooooooooooooo.',
    '.BBrBBBBBBBrBBB.',
    '.bbrbbbbbbbrbbb.',
    '.oooooooooooooo.',
    '.BBrBBBBBBBrBBB.',
    '.bbrbbbbbbbrbbb.',
    '.oooooooooooooo.',
    '.BBrBBBBBBBrBBB.',
    '.bbrbbbbbbbrbbb.',
    '..d.........d...',
    '................',
    '................',
    '................',
  ], { '.': null, o: '#b07a43', B: '#8a5a32', b: '#6b4223', r: '#e0cf9c', d: '#4a2c18' }).outline().shadow(8, 13.5, 8, 1.4);
}

export function animalSet(): Sprite[] {
  return [crab(), turtle(), monkey(), piglet(), bat()];
}

// ---- Item icons -------------------------------------------------------------------

function icon(name: string, draw: (s: Sprite) => void): Sprite {
  const s = new Sprite(`item_${name}`);
  draw(s);
  return s.outline();
}

function ball(s: Sprite, cx: number, cy: number, r: number, light: string, mid: string, dark: string): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (Math.hypot(dx, dy) > r) continue;
      const l = (-dx - dy) / r;
      s.set(x, y, l > 0.6 ? light : l > -0.4 ? mid : dark);
    }
  }
}

export function itemIcons(): Sprite[] {
  return [
    icon('coconut', (s) => {
      ball(s, 8, 8.5, 5.5, P.coconutLight, P.coconut, '#3e2612');
      for (const [x, y] of [[6, 6], [9, 6], [7, 9]]) s.set(x, y, '#2a180b');
    }),
    icon('berries', (s) => {
      for (const [cx, cy] of [[6, 9], [10, 9], [8, 12], [8, 6.5]]) ball(s, cx, cy, 2.6, P.berryLight, P.berry, '#8e1f30');
      for (const [x, y] of [[8, 3], [9, 2], [10, 2], [7, 3]]) s.set(x, y, P.leaf);
    }),
    icon('mushroom', (s) => {
      for (let y = 8; y <= 13; y++) {
        s.set(7, y, P.mushroomStem);
        s.set(8, y, P.mushroomStemShade);
      }
      for (let y = 3; y <= 8; y++) {
        const half = Math.min(5, 1.5 + (y - 3) * 1.3);
        for (let x = Math.floor(7.5 - half); x <= Math.ceil(7.5 + half) - 1; x++) {
          s.set(x, y, y === 8 ? P.mushroomCap : x < 8 && y < 7 ? P.mushroomCapLight : P.mushroomCap);
        }
      }
      s.set(5, 6, P.mushroomSpot);
      s.set(9, 5, P.mushroomSpot);
    }),
    icon('wood', (s) => {
      for (const [y0, x0] of [[5, 2], [9, 3]]) {
        for (let x = x0; x <= x0 + 10; x++) {
          s.set(x, y0, P.woodLight);
          s.set(x, y0 + 1, hash2(x, y0, 74) < 0.3 ? P.woodDark : P.wood);
          s.set(x, y0 + 2, P.woodDeep);
        }
        s.set(x0 + 11, y0, P.woodDark);
        s.set(x0 + 11, y0 + 1, P.woodCut);
        s.set(x0 + 11, y0 + 2, P.woodDark);
      }
    }),
    icon('leaves', (s) => {
      // A frond: midrib on a diagonal with leaflets either side.
      for (let i = 0; i <= 10; i++) {
        const x = 3 + i;
        const y = 12 - i;
        s.set(x, y, P.leafDark);
        if (i > 1 && i < 10) {
          s.set(x - 1, y - 1, P.leafLight);
          s.set(x - 2, y - 1, P.leaf);
          s.set(x + 1, y + 1, P.leaf);
          s.set(x + 1, y + 2, P.leafDark);
        }
      }
      s.set(2, 13, P.wood);
    }),
    icon('stone', (s) => {
      for (let y = 5; y <= 13; y++) {
        for (let x = 2; x <= 13; x++) {
          const d = Math.hypot((x + 0.5 - 8) / 5.8, (y + 0.5 - 9.5) / 4.2);
          if (d > 1) continue;
          const l = (-(x - 8) * 0.6 - (y - 9) * 0.8) / 5;
          s.set(x, y, l > 0.35 ? P.stoneLight : l > -0.2 ? P.stone : P.stoneDark);
        }
      }
    }),
  ];
}
