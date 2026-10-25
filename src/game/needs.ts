// The explorer's needs, each 0 (empty) to 100 (full). Empty needs slowly
// drain Health; when Health runs out the explorer faints (no one dies).

export type NeedId = 'health' | 'food' | 'water' | 'energy' | 'warmth';
export type Needs = Record<NeedId, number>;

export const NEED_IDS: NeedId[] = ['health', 'food', 'water', 'energy', 'warmth'];

/** Below this a need counts as low and the explorer mentions it. */
export const LOW = 25;

export function freshNeeds(): Needs {
  return { health: 100, food: 80, water: 80, energy: 90, warmth: 100 };
}

export interface Conditions {
  sleeping: boolean;
  /** 0 out in the open .. 1 snug in a hut. */
  shelter: number;
  nearFire: boolean;
  /** 0 night .. 1 day. */
  daylight: number;
  /** Skills slow some needs down: each is a factor on how fast it drops (default 1). */
  thirst?: number;
  hunger?: number;
  chill?: number;
  /** Extra cold out in the open, day and night (snow on the peaks). */
  cold?: number;
}

const RATES = {
  food: 0.45,
  water: 0.45,
  energyAwake: 0.25,
  energySleep: 1.4,
  warmthUp: 1.5,
  warmthDown: 0.6,
  healthDrainPerEmpty: 1,
  healthRegen: 0.25,
  /** Health only comes back while Food and Water are both above this. */
  healthRegenAbove: 50,
};

/** Where Warmth drifts towards: cold open nights, cosy shelters and fires. */
export function warmthTarget(c: Conditions): number {
  if (c.nearFire) return 100;
  const night = 1 - c.daylight;
  const exposure = 1 - c.shelter;
  return Math.max(0, 100 - exposure * (night * 95 + (c.cold ?? 0)));
}

/** Advance needs by one turn. Mutates and returns `n`. */
export function tickNeeds(n: Needs, c: Conditions): Needs {
  const slow = c.sleeping ? 0.5 : 1;
  n.food -= RATES.food * slow * (c.hunger ?? 1);
  n.water -= RATES.water * slow * (c.thirst ?? 1);
  n.energy += c.sleeping ? RATES.energySleep * (0.4 + 0.6 * c.shelter) : -RATES.energyAwake;

  const target = warmthTarget(c);
  if (n.warmth < target) n.warmth = Math.min(target, n.warmth + RATES.warmthUp);
  else n.warmth = Math.max(target, n.warmth - RATES.warmthDown * (c.chill ?? 1));

  const empty = (['food', 'water', 'energy', 'warmth'] as const).filter((k) => n[k] <= 0).length;
  if (empty > 0) n.health -= RATES.healthDrainPerEmpty * empty;
  else if (n.food > RATES.healthRegenAbove && n.water > RATES.healthRegenAbove) n.health += RATES.healthRegen * (c.sleeping ? 2 : 1);

  for (const k of NEED_IDS) n[k] = Math.max(0, Math.min(100, n[k]));
  return n;
}
