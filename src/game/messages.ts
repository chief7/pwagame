import type { AnimalKind } from './defs/animals';
import type { ItemId } from './defs/items';
import type { ObjectKind } from './defs/objects';
import type { NeedId } from './needs';

// What the game wants to say, as data. The game layer never builds text:
// the UI turns a Msg into words in the player's language (see src/i18n/),
// so the log can switch language after the fact.

export type WakeReason = 'rested' | 'cold' | 'hungry' | 'thirsty' | 'none';

export type Msg =
  | { key: 'arrive' }
  | { key: 'seaSalty' }
  | { key: 'stepInto'; obj: ObjectKind }
  | { key: 'tooFull' }
  | { key: 'eat'; item: ItemId }
  | { key: 'build'; obj: ObjectKind }
  | { key: 'make'; item: ItemId }
  | { key: 'needMaterials' }
  | { key: 'noRoom' }
  | { key: 'noBridgeSpot' }
  | { key: 'haveTool'; item: ItemId }
  | { key: 'needTool'; obj: ObjectKind; item: ItemId }
  | { key: 'notSleepy' }
  /** `obj` is the shelter slept in; without it, a cave. */
  | { key: 'fallAsleep'; obj?: ObjectKind }
  | { key: 'dozeOff' }
  | { key: 'wake'; reason: WakeReason; turn: number }
  | { key: 'notThirsty' }
  | { key: 'drink' }
  | { key: 'drinkRiver' }
  | { key: 'look'; obj: ObjectKind }
  | { key: 'nothingLeft'; obj: ObjectKind }
  | { key: 'gather'; obj: ObjectKind; got: [ItemId, number][] }
  | { key: 'shoo'; animal: AnimalKind }
  | { key: 'low'; need: Exclude<NeedId, 'health'> }
  | { key: 'faint' }
  | { key: 'wakeAtCamp' }
  | { key: 'pinch'; animal: AnimalKind }
  | { key: 'snatch'; animal: AnimalKind; item: ItemId }
  /** A line from a save made before messages were data; shown as it is. */
  | { key: 'legacy'; text: string };

/** What a floating number counts: "+2 wood", "+35 water". */
export type FloatWhat = { item: ItemId } | { need: NeedId };
