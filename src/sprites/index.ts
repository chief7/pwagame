import { characterSet } from './characters';
import { animalSet, itemIcons, raft } from './creatures';
import { berryBush, berryBushEmpty, bramble, bush, mushroom, treeBroadleaf, treePine } from './forest';
import { bridge, campfire, hut, leanTo } from './structures';
import { boulder, chestClosed, chestOpen, driftwood, log, logPile, mossyStone, pebbles, spring, stalagmite } from './objects';
import { palmLeaning, palmLeaningBare, palmTall, palmTallBare, palmYoung } from './palms';
import type { Sprite } from './pixel';
import {
  caveFloor, caveFloorPebbles, grass, grassEdgeSet, grassFlowers, river, riverBankSet, rockFace, rockTop,
  sand, sandRipples, sandShell, shoreSet, water, waterVariants,
} from './terrain';

export { Sprite } from './pixel';
export { grassTileName, riverBankTileName, shoreTileName, transitionTileName } from './terrain';

export interface SpriteGroup {
  title: string;
  sprites: Sprite[];
}

export function spriteGroups(): SpriteGroup[] {
  return [
    { title: 'Characters', sprites: [...characterSet('male'), ...characterSet('female')] },
    { title: 'Palm trees', sprites: [palmTall(), palmLeaning(), palmYoung(), palmTallBare(), palmLeaningBare()] },
    { title: 'Forest', sprites: [treeBroadleaf(), treePine(), bush(), berryBush(), berryBushEmpty(), mushroom(), bramble()] },
    { title: 'Grass', sprites: [grass(), grassFlowers(), ...grassEdgeSet()] },
    { title: 'Rock and caves', sprites: [rockTop(), rockFace(), caveFloor(), caveFloorPebbles(), stalagmite(), spring()] },
    { title: 'Shelter', sprites: [...campfire(), leanTo(), hut()] },
    { title: 'Sand', sprites: [sand(), sandRipples(), sandShell()] },
    { title: 'Shores', sprites: [water(), ...waterVariants(), ...shoreSet()] },
    { title: 'River', sprites: [...river(), ...riverBankSet(), bridge('ns'), bridge('ew')] },
    { title: 'Stones', sprites: [boulder(), pebbles(), mossyStone()] },
    { title: 'Logs', sprites: [log(), logPile(), driftwood()] },
    { title: 'Chests', sprites: [chestClosed(), chestOpen()] },
    { title: 'Animals', sprites: animalSet() },
    { title: 'Items', sprites: itemIcons() },
    { title: 'Raft', sprites: [raft()] },
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
