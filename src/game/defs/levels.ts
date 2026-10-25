import type { ItemId } from './items';
import type { ObjectKind } from './objects';

// Each island (level) has one big goal: something the explorer builds in
// stages to leave the island. The goal object stands in the world from the
// start (an old wreck, a broken bridge…); walking into it hands over what it
// still needs. Stage names and messages live in src/i18n/.

export type StageId = 'hull' | 'mast' | 'sail' | 'supplies';

export interface GoalStage {
  id: StageId;
  /** Everything this stage needs, handed over in as many trips as you like. */
  cost: Partial<Record<ItemId, number>>;
  /** What the goal object turns into when the stage is done. */
  becomes: ObjectKind;
}

export interface LevelDef {
  level: number;
  /** The goal object as world generation places it, before any stage is built. */
  site: ObjectKind;
  stages: GoalStage[];
}

export const LEVELS: LevelDef[] = [
  {
    level: 1,
    site: 'boat_wreck',
    stages: [
      { id: 'hull', cost: { wood: 20, stone: 6 }, becomes: 'boat_hull' },
      { id: 'mast', cost: { wood: 10, rope: 6 }, becomes: 'boat_mast' },
      { id: 'sail', cost: { leaves: 12, rope: 3 }, becomes: 'boat_sail' },
      { id: 'supplies', cost: { coconut: 4, cooked_fish: 3 }, becomes: 'boat_ready' },
    ],
  },
];

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
