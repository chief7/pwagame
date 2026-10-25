// What the explorer can learn with skill points. Skills sit on three paths;
// each skill needs the one before it on its path. The effects live where
// they apply (needs, gathering, sight, animals, recipes); this file only
// says what exists and what it costs. Names live in src/i18n/.

export type PathId = 'survival' | 'craft' | 'explorer';

export type SkillId =
  | 'small_sips' | 'small_appetite' | 'thick_skin'
  | 'fishing_rod' | 'patient_angler' | 'handy_builder'
  | 'green_thumb' | 'night_eyes' | 'animal_friend';

export interface SkillDef {
  id: SkillId;
  path: PathId;
  /** Skill points it takes to learn. */
  cost: number;
}

/** Each path's skills, in the order they must be learned. */
export const PATHS: Record<PathId, SkillId[]> = {
  survival: ['small_sips', 'small_appetite', 'thick_skin'],
  craft: ['fishing_rod', 'patient_angler', 'handy_builder'],
  explorer: ['green_thumb', 'night_eyes', 'animal_friend'],
};

export const PATH_IDS = Object.keys(PATHS) as PathId[];

const COSTS = [1, 1, 2];

export const SKILLS = Object.fromEntries(
  PATH_IDS.flatMap((path) => PATHS[path].map((id, i) => [id, { id, path, cost: COSTS[i] }])),
) as Record<SkillId, SkillDef>;

export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

/** The skill to learn before this one, if any. */
export function skillBefore(id: SkillId): SkillId | undefined {
  const path = PATHS[SKILLS[id].path];
  return path[path.indexOf(id) - 1];
}

/** XP for the first skill point; each later point takes this much more again. */
const FIRST_POINT_XP = 10;
const POINT_XP_STEP = 5;

/** Total XP needed to have earned n skill points (10, 25, 45, 70, …). */
export function xpForPoints(n: number): number {
  return n * FIRST_POINT_XP + (POINT_XP_STEP * n * (n - 1)) / 2;
}

/** How many skill points this much XP has earned. */
export function pointsForXp(xp: number): number {
  let n = 0;
  while (xpForPoints(n + 1) <= xp) n++;
  return n;
}
