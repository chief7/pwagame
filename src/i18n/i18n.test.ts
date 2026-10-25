import { describe, expect, it } from 'vitest';
import { ANIMAL_KINDS } from '../game/defs/animals';
import { ITEM_IDS } from '../game/defs/items';
import { OBJECTS, type ObjectKind } from '../game/defs/objects';
import { RECIPE_IDS } from '../game/defs/recipes';
import { PATH_IDS, SKILL_IDS } from '../game/defs/skills';
import { Game } from '../game/game';
import type { Msg } from '../game/messages';
import { NEED_IDS } from '../game/needs';
import { de } from './de';
import { en } from './en';
import { LANGUAGES, preferredLang } from './index';

const OBJECT_KINDS = Object.keys(OBJECTS) as ObjectKind[];

/** One of every message, with every object, animal and item it can name. */
function everyMessage(): Msg[] {
  const msgs: Msg[] = [
    { key: 'arrive' }, { key: 'seaSalty' }, { key: 'tooFull' }, { key: 'needMaterials' }, { key: 'noRoom' },
    { key: 'notSleepy' }, { key: 'fallAsleep' }, { key: 'dozeOff' }, { key: 'notThirsty' }, { key: 'drink' },
    { key: 'faint' }, { key: 'wakeAtCamp' }, { key: 'legacy', text: 'Old line.' }, { key: 'noBridgeSpot' }, { key: 'drinkRiver' },
    { key: 'needFire' }, { key: 'needPoints' }, { key: 'skillPoint' }, { key: 'catch' }, { key: 'noBite' },
    { key: 'goalFound', obj: 'boat_wreck' }, { key: 'goalReady' }, { key: 'sailAway' },
    { key: 'goalGive', given: [['wood', 1]], left: [['wood', 19], ['stone', 6]] },
    { key: 'goalGive', given: [['rope', 2], ['wood', 3]], left: [['rope', 1]] },
  ];
  for (const stage of ['hull', 'mast', 'sail', 'supplies'] as const) {
    msgs.push({ key: 'goalStage', stage }, { key: 'goalNeeds', stage, left: [['coconut', 4], ['cooked_fish', 1]] });
  }
  for (const skill of SKILL_IDS) msgs.push({ key: 'needSkill', skill }, { key: 'learn', skill });
  for (const reason of ['rested', 'cold', 'hungry', 'thirsty', 'none'] as const) msgs.push({ key: 'wake', reason, turn: 0 });
  for (const need of ['food', 'water', 'energy', 'warmth'] as const) msgs.push({ key: 'low', need });
  for (const obj of OBJECT_KINDS) {
    msgs.push({ key: 'stepInto', obj }, { key: 'build', obj }, { key: 'fallAsleep', obj }, { key: 'look', obj }, { key: 'nothingLeft', obj });
    msgs.push({ key: 'gather', obj, got: [] }, { key: 'gather', obj, got: [['coconut', 1], ['wood', 3]] });
  }
  for (const animal of ANIMAL_KINDS) {
    msgs.push({ key: 'shoo', animal }, { key: 'pinch', animal }, { key: 'hurt', animal }, { key: 'alert', animal });
    for (const item of ITEM_IDS) msgs.push({ key: 'snatch', animal, item });
  }
  for (const item of ITEM_IDS) msgs.push({ key: 'eat', item }, { key: 'make', item }, { key: 'cook', item }, { key: 'haveTool', item }, { key: 'needTool', obj: 'bramble', item });
  return msgs;
}

describe('i18n', () => {
  it('says every message in every language', () => {
    for (const words of Object.values(LANGUAGES)) {
      for (const msg of everyMessage()) {
        const text = words.message(msg);
        expect(text, `${words.lang} ${JSON.stringify(msg)}`).toMatch(/^\S.*\S$/);
        expect(text).not.toMatch(/undefined|  /);
      }
      for (const id of ITEM_IDS) {
        expect(words.itemStack(id, 2)).not.toMatch(/undefined/);
        expect(words.float(2, { item: id })).not.toMatch(/undefined/);
      }
      for (const id of NEED_IDS) expect(words.needs[id]).toBeTruthy();
      for (const id of RECIPE_IDS) expect(words.recipes[id].name).toBeTruthy();
      for (const id of SKILL_IDS) expect(words.skills[id].name).toBeTruthy();
      for (const id of PATH_IDS) expect(words.paths[id]).toBeTruthy();
      expect(words.float(3, { xp: true })).toMatch(/^\+3 (XP|EP)$/);
    }
  });

  it('has a gather text for every object that can be gathered', () => {
    for (const obj of OBJECT_KINDS.filter((k) => OBJECTS[k].gather)) {
      expect(en.message({ key: 'gather', obj, got: [] })).not.toMatch(/^You search/);
      expect(de.message({ key: 'gather', obj, got: [] })).not.toMatch(/^Du suchst/);
    }
  });

  it('gets German articles, cases and adjective endings right', () => {
    expect(de.message({ key: 'eat', item: 'mushroom' })).toBe('Du isst einen Pilz. Lecker!');
    expect(de.message({ key: 'eat', item: 'coconut' })).toBe('Du isst eine Kokosnuss. Lecker!');
    expect(de.message({ key: 'gather', obj: 'palm_tall', got: [['coconut', 2], ['leaves', 1]] })).toBe(
      'Du schüttelst die Palme und bekommst 2 Kokosnüsse und ein großes Blatt.',
    );
    expect(de.message({ key: 'build', obj: 'lean_to' })).toBe('Du baust einen Unterstand.');
    expect(de.message({ key: 'build', obj: 'campfire' })).toBe('Du baust ein Lagerfeuer.');
    expect(de.message({ key: 'stepInto', obj: 'hut' })).toBe('Du gehst in die Hütte. Ein guter Platz zum Schlafen.');
    expect(de.message({ key: 'fallAsleep', obj: 'lean_to' })).toBe('Du rollst dich im Unterstand zusammen und schläfst ein.');
    expect(de.message({ key: 'look', obj: 'stone_mossy' })).toBe('Ein bemooster Stein.');
    expect(de.message({ key: 'nothingLeft', obj: 'tree_broadleaf' })).toBe('Am Baum ist nichts mehr. Komm später wieder.');
    expect(de.message({ key: 'nothingLeft', obj: 'palm_young' })).toBe('An der jungen Palme ist nichts mehr. Komm später wieder.');
    expect(de.message({ key: 'snatch', animal: 'monkey', item: 'wood' })).toBe('Der freche Affe hat dir ein Stück Holz stibitzt!');
    expect(de.ui.inShelter('lean_to')).toBe('In deinem Unterstand');
    expect(de.ui.inShelter('hut')).toBe('In deiner Hütte');
    expect(de.clock(0)).toBe('Tag 1 · 8:00');
    expect(de.message({ key: 'make', item: 'axe' })).toBe('Du baust eine Steinaxt.');
    expect(de.message({ key: 'needTool', obj: 'bramble', item: 'axe' })).toBe(
      'Das Dornengestrüpp ist zu dornig für deine Hände. Du brauchst eine Steinaxt.',
    );
    expect(de.message({ key: 'build', obj: 'bridge_ew' })).toBe('Du baust eine Brücke.');
  });

  it('keeps English as it was', () => {
    expect(en.message({ key: 'gather', obj: 'palm_tall', got: [['coconut', 1], ['leaves', 2]] })).toBe(
      'You shake the palm tree and get a coconut and 2 big leaves.',
    );
    expect(en.message({ key: 'wake', reason: 'rested', turn: 0 })).toBe('You wake up feeling rested. (Day 1 · 8:00)');
    expect(en.float(-1, { item: 'coconut' })).toBe('-1 coconut');
    expect(en.float(35, { need: 'water' })).toBe('+35 water');
  });

  it('renders the log of a real game in both languages', () => {
    const game = new Game(5);
    for (let i = 0; i < 300; i++) game.move(1, 0) || game.move(0, 1) || game.wait();
    for (const entry of game.log) for (const words of [en, de]) expect(words.message(entry.msg)).toBeTruthy();
  });

  it('picks German for German browsers', () => {
    expect(preferredLang(['de-AT', 'en'])).toBe('de');
    expect(preferredLang(['fr', 'de'])).toBe('de');
    expect(preferredLang(['en-GB'])).toBe('en');
    expect(preferredLang(['fr'])).toBe('en');
  });
});
