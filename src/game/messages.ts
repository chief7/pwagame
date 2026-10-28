import type { AnimalKind } from './defs/animals';
import type { ItemId } from './defs/items';
import type { LevelId, StageId, StarId } from './defs/levels';
import type { ObjectKind } from './defs/objects';
import type { RoomId } from './defs/rooms';
import type { SkillId } from './defs/skills';
import type { NeedId } from './needs';

// What the game wants to say, as data. The game layer never builds text:
// the UI turns a Msg into words in the player's language (see src/i18n/),
// so the log can switch language after the fact.

/** `restless`: as rested as this place allows; only the bed in a hut gives a full rest. */
export type WakeReason = 'rested' | 'restless' | 'cold' | 'hungry' | 'thirsty' | 'none';

export type Msg =
  | { key: 'arrive' }
  | { key: 'seaSalty' }
  | { key: 'stepInto'; obj: ObjectKind }
  /** Stepped into a hut with Cartographer: the map hangs on its wall (old logs only; the Hut panel shows it now). */
  | { key: 'mapHint' }
  /** Walked into the hut: the explorer goes inside. */
  | { key: 'enterHut' }
  /** Tried to build a second hut on this island. */
  | { key: 'oneHut' }
  /** Added a room to the hut. */
  | { key: 'roomBuilt'; room: RoomId }
  /** A room action outside the hut (or in a hut without that room). */
  | { key: 'notInHut' }
  | { key: 'drinkBarrel' }
  /** Tried to sleep with as much Energy as this place can give: `cap` is that Energy. */
  | { key: 'restLimit'; cap: number }
  | { key: 'tooFull' }
  | { key: 'eat'; item: ItemId }
  | { key: 'build'; obj: ObjectKind }
  /** `count` is how many were made (default 1; Rope maker makes 2 ropes). */
  | { key: 'make'; item: ItemId; count?: number }
  | { key: 'needMaterials' }
  | { key: 'noRoom' }
  | { key: 'noBridgeSpot' }
  /** Tried to lay stepping stones without lava ahead. */
  | { key: 'noLavaSpot' }
  /** The bag is too heavy for more heavy things (wood, logs, stone, scrap, diesel). */
  | { key: 'tooHeavy' }
  /** Walked into a store crate: the Store panel opens. */
  | { key: 'openStore' }
  /** Tried to build a second store crate on this island. */
  | { key: 'oneStore' }
  /** A building site: what it still needs, what was given, and that it is finished (`obj` is then the building). */
  | { key: 'siteNeeds'; obj: ObjectKind; left: [ItemId, number][] }
  | { key: 'siteGive'; obj: ObjectKind; given: [ItemId, number][]; left: [ItemId, number][] }
  | { key: 'siteDone'; obj: ObjectKind }
  /** Walked into the fishing boat: the sea chart and the hold open. */
  | { key: 'openChart' }
  /** The boat cannot sail: no boat here, already on that island, not enough diesel. */
  | { key: 'noBoat' }
  | { key: 'hereAlready' }
  | { key: 'needDiesel'; n: number }
  /** The boat's hold is full of heavy things. */
  | { key: 'holdFull' }
  /** Arrived by boat on this island (or the rig). */
  | { key: 'voyage'; level: LevelId }
  /** Walked into a broken gangway end on the oil rig: mend it with scrap. */
  | { key: 'gangwayBroken' }
  | { key: 'gangwayMended' }
  /** Walked into the lava: far too hot. */
  | { key: 'lavaHot' }
  /** Stepped onto the ash in the day: it is hot up here, and you get thirsty. */
  | { key: 'ashHot' }
  | { key: 'haveTool'; item: ItemId }
  | { key: 'needTool'; obj: ObjectKind; item: ItemId }
  | { key: 'notSleepy' }
  /** `obj` is the shelter slept in; without it, a cave. */
  | { key: 'fallAsleep'; obj?: ObjectKind }
  | { key: 'dozeOff' }
  | { key: 'wake'; reason: WakeReason; turn: number }
  | { key: 'notThirsty' }
  /** Drank at a spring; `warm` at a hot spring, `tank` at a rain water tank on the rig. */
  | { key: 'drink'; warm?: true; tank?: true }
  | { key: 'drinkRiver' }
  | { key: 'look'; obj: ObjectKind }
  | { key: 'nothingLeft'; obj: ObjectKind }
  /** `used`: a tool gave more. `lack`: carrying this tool would also give that item. */
  | { key: 'gather'; obj: ObjectKind; got: [ItemId, number][]; used?: ItemId; lack?: { tool: ItemId; item: ItemId } }
  | { key: 'shoo'; animal: AnimalKind }
  /** A need ran low. `level` picks the tip (no coconuts on island 2); old saved logs have none. */
  | { key: 'low'; need: Exclude<NeedId, 'health'>; level?: LevelId }
  | { key: 'faint' }
  | { key: 'wakeAtCamp' }
  /** Why the explorer fainted: the needs that ran out; none means animals hurt them. */
  | { key: 'faintWhy'; empty: Exclude<NeedId, 'health'>[] }
  | { key: 'pinch'; animal: AnimalKind }
  /** A wild animal bites, stings, swipes at or bumps the explorer. */
  | { key: 'hurt'; animal: AnimalKind }
  /** A wild animal noticed the explorer and comes after them. */
  | { key: 'alert'; animal: AnimalKind }
  | { key: 'snatch'; animal: AnimalKind; item: ItemId }
  | { key: 'cook'; item: ItemId }
  | { key: 'needFire' }
  /** A recipe or skill needs this skill learned first. */
  | { key: 'needSkill'; skill: SkillId }
  | { key: 'needPoints' }
  | { key: 'skillPoint' }
  | { key: 'learn'; skill: SkillId }
  | { key: 'catch' }
  | { key: 'noBite' }
  /** The explorer first sees the island's goal. */
  | { key: 'goalFound'; obj: ObjectKind }
  /** Walked into the goal with nothing it needs. */
  | { key: 'goalNeeds'; stage: StageId; left: [ItemId, number][] }
  | { key: 'goalGive'; stage: StageId; given: [ItemId, number][]; left: [ItemId, number][] }
  /** A stage of the goal is finished. */
  | { key: 'goalStage'; stage: StageId }
  /** Walked into the finished goal. */
  | { key: 'goalReady'; level: LevelId }
  /** Leaving the island on the finished goal: the boat sails, or the beacon calls a ship. */
  | { key: 'sailAway'; level: LevelId }
  /** The boat lands on the next island. */
  | { key: 'landIsland'; level: LevelId }
  /** Stepped onto snow: it is cold up here. */
  | { key: 'snowCold' }
  /** Walked into a deep cave from outside: it is dark in there, unless you carry the crystal lantern. */
  | { key: 'caveEnter'; lantern?: true }
  /** Walked into a steep step: build `way` (a ladder, a climbing rope) on it to get up. */
  | { key: 'tooSteep'; obj: ObjectKind; way: ObjectKind }
  /** Tried to build a way up with no such step next to the explorer. */
  | { key: 'noStep'; obj: ObjectKind }
  /** Climbed over a step on a ladder or a rope; `easy` with Sure foot (no Energy). */
  | { key: 'climb'; obj: ObjectKind; easy?: true }
  /** Walked into the stray dog without any food for it. */
  | { key: 'dogSniff' }
  | { key: 'dogAdopt'; item: ItemId }
  | { key: 'dogBark'; animal: AnimalKind }
  | { key: 'dogFeed'; item: ItemId }
  | { key: 'dogFull' }
  | { key: 'dogFar' }
  | { key: 'dogLow'; need: 'food' | 'water' }
  /** The dog's Food or Water ran out. */
  | { key: 'dogTired' }
  /** Fed and watered again after being tired. */
  | { key: 'dogBack' }
  /** The tide turns: the sandbar comes out of the sea, or goes under. */
  | { key: 'tideOut' }
  | { key: 'tideIn' }
  /** Walked into the sandbar at high tide; `turn` is when the next low tide starts. */
  | { key: 'tideHigh'; turn: number }
  /** The tide came in while the explorer stood on the sandbar. */
  | { key: 'tideWade' }
  /** Earned one of the island's stars. */
  | { key: 'star'; star: StarId }
  /** A line from a save made before messages were data; shown as it is. */
  | { key: 'legacy'; text: string };

/** What a floating number counts: "+2 wood", "+35 water", "+1 XP". */
export type FloatWhat = { item: ItemId } | { need: NeedId } | { xp: true };
