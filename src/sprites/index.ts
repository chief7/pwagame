import { boulder, chestClosed, chestOpen, driftwood, log, logPile, mossyStone, pebbles } from './objects';
import { palmLeaning, palmTall, palmYoung } from './palms';
import type { Sprite } from './pixel';
import { sand, sandRipples, sandShell, shoreSet, water } from './terrain';

export { Sprite } from './pixel';
export { shoreTileName } from './terrain';

export interface SpriteGroup {
  title: string;
  sprites: Sprite[];
}

export function spriteGroups(): SpriteGroup[] {
  return [
    { title: 'Palm trees', sprites: [palmTall(), palmLeaning(), palmYoung()] },
    { title: 'Sand', sprites: [sand(), sandRipples(), sandShell()] },
    { title: 'Shores', sprites: [water(), ...shoreSet()] },
    { title: 'Stones', sprites: [boulder(), pebbles(), mossyStone()] },
    { title: 'Logs', sprites: [log(), logPile(), driftwood()] },
    { title: 'Chests', sprites: [chestClosed(), chestOpen()] },
  ];
}

/** Every sprite by name. */
export function buildSprites(): Map<string, Sprite> {
  return new Map(spriteGroups().flatMap((g) => g.sprites.map((s) => [s.name, s] as const)));
}

/** Rasterise a sprite onto its own 1:1 canvas, ready for drawImage with smoothing off. */
export function bake(sprite: Sprite): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const ctx = canvas.getContext('2d')!;
  sprite.pixels.forEach((color, i) => {
    if (!color) return;
    ctx.fillStyle = color;
    ctx.fillRect(i % sprite.width, Math.floor(i / sprite.width), 1, 1);
  });
  return canvas;
}
