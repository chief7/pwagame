import { characterSet } from './characters';
import { animalSet, caveItemIcons, itemIcons, skillItemIcons } from './creatures';
import {
  berryBush, berryBushEmpty, bramble, bush, fern, mushroom, treeApple, treeAppleBare, treeBirch, treeBroadleaf, treePine,
  treeSpruce, treeSpruceSnow,
} from './forest';
import { beacon, boat, boatAway, bridge, campfire, hut, leanTo } from './structures';
import { barrel, barrelEmpty, boulder, chestClosed, chestOpen, crystalCluster, driftwood, glowcap, glowcapPicked, iceWall, ledge, log, logPile, mossyStone, pebbles, sandbar, spring, stalagmite } from './objects';
import { appIcon, globe, grillButton, mapIcon, mapMarkers, skillIcons, starEmpty } from './ui';
import { palmLeaning, palmLeaningBare, palmTall, palmTallBare, palmYoung } from './palms';
import type { Sprite } from './pixel';
import {
  bankSets, caveFloor, caveFloorPebbles, grass, grassEdgeSet, grassFlowers, grassScreeSet, river, riverBankSet, riverMouthSet, rockFace, rockTop,
  sand, sandRipples, sandShell, scree, screeStones, shoreSet, snow, snowEdgeSet, snowTracks, water, waterVariants,
} from './terrain';

export { Sprite } from './pixel';
export {
  edgeTileName, grassScreeTileName, grassTileName, mixedTile, riverBankTileName, shoreTileName, snowTileName, transitionTileName,
} from './terrain';

export interface SpriteGroup {
  title: string;
  sprites: Sprite[];
}

export function spriteGroups(): SpriteGroup[] {
  return [
    { title: 'Characters', sprites: [...characterSet('male'), ...characterSet('female')] },
    { title: 'Palm trees', sprites: [palmTall(), palmLeaning(), palmYoung(), palmTallBare(), palmLeaningBare()] },
    { title: 'Forest', sprites: [treeBroadleaf(), treePine(), bush(), berryBush(), berryBushEmpty(), mushroom(), bramble()] },
    { title: 'Northern forest', sprites: [treeSpruce(), treeSpruceSnow(), treeBirch(), treeApple(), treeAppleBare(), fern()] },
    { title: 'Grass', sprites: [grass(), grassFlowers(), ...grassEdgeSet(), ...grassScreeSet()] },
    { title: 'Mountains', sprites: [scree(), screeStones(), snow(), snowTracks(), ...snowEdgeSet()] },
    { title: 'Steep steps', sprites: [ledge(), ledge('ladder'), iceWall(), iceWall('rope')] },
    { title: 'Rock and caves', sprites: [rockTop(), rockFace(), caveFloor(), caveFloorPebbles(), stalagmite(), spring()] },
    { title: 'Deep caves', sprites: [...glowcap(), glowcapPicked(), crystalCluster()] },
    { title: 'Shelter', sprites: [...campfire(), leanTo(), hut()] },
    { title: 'Sand', sprites: [sand(), sandRipples(), sandShell()] },
    { title: 'Shores', sprites: [water(), ...waterVariants(), ...shoreSet()] },
    { title: 'Tide islet', sprites: [sandbar('ns'), sandbar('ew'), sandbar('ns', true), sandbar('ew', true), barrel(), barrelEmpty()] },
    { title: 'River', sprites: [...river(), ...riverBankSet(), ...bankSets(), ...riverMouthSet(), bridge('ns'), bridge('ew')] },
    { title: 'Stones', sprites: [boulder(), pebbles(), mossyStone()] },
    { title: 'Logs', sprites: [log(), logPile(), driftwood()] },
    { title: 'Chests', sprites: [chestClosed(), chestOpen()] },
    { title: 'Animals', sprites: animalSet() },
    { title: 'Items', sprites: [...itemIcons(), ...skillItemIcons(), ...caveItemIcons()] },
    { title: 'Boat', sprites: [...boat(), ...boatAway()] },
    { title: 'Beacon', sprites: beacon() },
    { title: 'Interface', sprites: [globe(), ...skillIcons(), starEmpty(), ...grillButton(), appIcon()] },
    { title: 'Map', sprites: [mapIcon(), ...mapMarkers()] },
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
