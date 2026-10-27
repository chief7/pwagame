import { describe, expect, it } from 'vitest';
import { ANIMAL_KINDS } from '../game/defs/animals';
import { ITEM_IDS } from '../game/defs/items';
import { OBJECTS, type ObjectKind } from '../game/defs/objects';
import { de } from '../i18n/de';
import { en } from '../i18n/en';
import { buildSprites } from '../sprites';
import { animalsByIsland, gatherRows, itemSources, objectIslands, recipeSprite } from './data';
import { RECIPE_IDS } from '../game/defs/recipes';
import { WIKI } from './text';

const OBJECT_KINDS = Object.keys(OBJECTS) as ObjectKind[];

describe('compendium data', () => {
  it('lists every object you can gather once, with the islands it grows on', () => {
    const rows = gatherRows();
    const listed = rows.flatMap((r) => r.kinds);
    expect(listed.sort()).toEqual(OBJECT_KINDS.filter((k) => OBJECTS[k].gather).sort());
    for (const row of rows) expect(row.islands.length, row.kinds.join()).toBeGreaterThan(0);
    expect(objectIslands('palm_tall')).toEqual([1]);
    expect(objectIslands('tree_spruce_snow')).toEqual([2]);
    expect(objectIslands('barrel')).toEqual([1]);
  });

  it('knows where every item comes from', () => {
    for (const id of ITEM_IDS) {
      const src = itemSources(id);
      expect(src.objects.length + src.recipes.length + Number(src.fishing), id).toBeGreaterThan(0);
    }
  });

  it('lists every animal but the dog on some island', () => {
    const listed = new Set([...animalsByIsland(1), ...animalsByIsland(2)]);
    expect([...listed].sort()).toEqual(ANIMAL_KINDS.filter((k) => k !== 'dog').sort());
  });

  it('has a sprite for every recipe', () => {
    const sprites = buildSprites();
    for (const id of RECIPE_IDS) expect(sprites.has(recipeSprite(id)), id).toBe(true);
  });

  it('names objects and animals without an article', () => {
    expect(en.objectName('palm_young')).toBe('Young palm');
    expect(de.objectName('palm_young')).toBe('Junge Palme');
    expect(de.objectName('stone_pebbles')).toBe('Kiesel');
    expect(de.animalName('dog')).toBe('Streunender Hund');
    expect(de.objectName('barrel')).toBe('Altes Teerfass');
    for (const kind of ANIMAL_KINDS) expect(de.animalName(kind)).not.toMatch(/^(ein|eine) /i);
  });

  it('has a name for every item in both languages', () => {
    for (const lang of ['en', 'de'] as const) for (const id of ITEM_IDS) expect(WIKI[lang].items[id]).toBeTruthy();
  });
});
