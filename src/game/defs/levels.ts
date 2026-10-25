import type { ItemId } from './items';
import type { ObjectKind } from './objects';

// Each island (level) has one big goal: something the explorer builds in
// stages to leave the island. The goal object stands in the world from the
// start (an old wreck, a broken bridge…); walking into it hands over what it
// still needs. Stage names and messages live in src/i18n/.

export type StageId = 'hull' | 'mast' | 'sail' | 'supplies' | 'base' | 'pyre' | 'tinder';
export type LevelId = 1 | 2;
/** How world generation shapes the island: palms and beaches, or forest and mountains. */
export type Biome = 'tropical' | 'mountain';

export interface GoalStage {
  id: StageId;
  /** Everything this stage needs, handed over in as many trips as you like. */
  cost: Partial<Record<ItemId, number>>;
  /** What the goal object turns into when the stage is done. */
  becomes: ObjectKind;
}

export interface LevelDef {
  level: LevelId;
  biome: Biome;
  /** The goal object as world generation places it, before any stage is built. */
  site: ObjectKind;
  stages: GoalStage[];
}

export const LEVELS: LevelDef[] = [
  {
    level: 1,
    biome: 'tropical',
    site: 'boat_wreck',
    stages: [
      { id: 'hull', cost: { wood: 20, stone: 6 }, becomes: 'boat_hull' },
      { id: 'mast', cost: { wood: 10, rope: 6 }, becomes: 'boat_mast' },
      { id: 'sail', cost: { leaves: 12, rope: 3 }, becomes: 'boat_sail' },
      { id: 'supplies', cost: { coconut: 4, cooked_fish: 3 }, becomes: 'boat_ready' },
    ],
  },
  {
    // Pine Ridge: a signal beacon on the snowy peak, so a passing ship sees you.
    level: 2,
    biome: 'mountain',
    site: 'beacon_site',
    stages: [
      { id: 'base', cost: { stone: 16 }, becomes: 'beacon_base' },
      { id: 'pyre', cost: { wood: 18, rope: 4 }, becomes: 'beacon_pyre' },
      { id: 'tinder', cost: { leaves: 12, wood: 4 }, becomes: 'beacon_ready' },
    ],
  },
];

/** The island after this one, or null on the last island. */
export function nextLevel(level: number): LevelId | null {
  return LEVELS.find((l) => l.level === level + 1)?.level ?? null;
}

/** The level a goal stage belongs to. */
export function stageLevel(stage: StageId): LevelId {
  return LEVELS.find((l) => l.stages.some((s) => s.id === stage))!.level;
}

export function levelDef(level: number): LevelDef {
  return LEVELS.find((l) => l.level === level) ?? LEVELS[0];
}

/**
 * How far along a goal object is: 0 for the site, n after n stages. The
 * last value (stages.length) means ready to leave.
 */
export function goalProgress(def: LevelDef, kind: ObjectKind): number {
  if (kind === def.site) return 0;
  const i = def.stages.findIndex((s) => s.becomes === kind);
  return i < 0 ? -1 : i + 1;
}
