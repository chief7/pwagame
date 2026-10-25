import { fromRows, type Color, type Sprite } from './pixel';

// Monsters are drawn as filled shapes; outline() and shadow() finish them so
// they match the rest of the set.

function creature(name: string, rows: readonly string[], key: Record<string, Color>, shadowRx: number): Sprite {
  return fromRows(name, rows, { '.': null, ...key }).outline().shadow(8, 14.6, shadowRx, 1.2);
}

export function rat(): Sprite {
  return creature('monster_rat', [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..........p.....',
    '.......rrrpr....',
    '.....rrrrrrrr...',
    '....rrrrrrrrer..',
    '....rrrrrrrrrrp.',
    '...RrrrrrrrrRR..',
    '.ppRRRRRRRRRR...',
    'p....R.R..R.R...',
    '................',
    '................',
  ], { r: '#9a7b62', R: '#76594a', p: '#e8a0a0', e: '#20180f' }, 6);
}

export function crab(): Sprite {
  return creature('monster_crab', [
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

export function beetle(): Sprite {
  return creature('monster_beetle', [
    '................',
    '................',
    '................',
    '.....d....d.....',
    '......d..d......',
    '......hhhh......',
    '.....hehheh.....',
    '....yyyyyyyy....',
    '...yYyyyyyyyy...',
    '..dyYyyyjyyyyd..',
    '...yyyyyjyyyy...',
    '..dyyyyyjyyyyd..',
    '....yyyyjyyy....',
    '...d.gggggg.d...',
    '................',
    '................',
  ], { d: '#3a2a12', h: '#2b3a2a', e: '#d8ff8a', y: '#e8c84a', Y: '#fff1a0', j: '#9a7a22', g: '#fff8c0' }, 6);
}

export function hound(): Sprite {
  return creature('monster_hound', [
    '................',
    '................',
    '................',
    '................',
    '................',
    '...........dd...',
    '.h........hhhd..',
    '.h........hhehhn',
    '..hhhhhhhhhhhh..',
    '..hHhhhhhhhhh...',
    '..HHhhhhhhhH....',
    '..HH.H....HH....',
    '..H..H....H.H...',
    '..d..d....d.d...',
    '................',
    '................',
  ], { h: '#8a5fa6', H: '#644282', d: '#3e2852', e: '#f2c14e', n: '#20180f' }, 7);
}

export function golem(): Sprite {
  return creature('monster_golem', [
    '................',
    '................',
    '......gggg......',
    '.....geggeg.....',
    '.....gggggG.....',
    '...ggggggggGG...',
    '..gggGggggggGg..',
    '..gg.gggggg.Gg..',
    '..gg.gggggG.Gg..',
    '..GG.gggggG.GG..',
    '.....gggGGG.....',
    '.....gg..GG.....',
    '.....gg..GG.....',
    '....GGG..GGG....',
    '................',
    '................',
  ], { g: '#e6e2d8', G: '#b9b3a6', e: '#4fc3d0' }, 5);
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

export function creatureSet(): Sprite[] {
  return [rat(), crab(), beetle(), hound(), golem()];
}
