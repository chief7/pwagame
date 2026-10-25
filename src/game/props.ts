/** Things standing on the sand. Kinds double as sprite names. */
export const PROP_KINDS = [
  'palm_tall', 'palm_leaning', 'palm_young',
  'stone_boulder', 'stone_pebbles', 'stone_mossy',
  'log', 'log_pile', 'log_driftwood',
  'chest_closed', 'chest_open',
] as const;
export type PropKind = (typeof PROP_KINDS)[number];

/** Props that block line of sight; everything blocks movement. */
const OPAQUE: ReadonlySet<PropKind> = new Set(['stone_boulder', 'stone_mossy', 'log_pile']);

export function isOpaqueProp(kind: PropKind): boolean {
  return OPAQUE.has(kind);
}

/** Scenery mix for a fresh island, by relative weight. */
export const SCENERY: readonly [PropKind, number][] = [
  ['palm_tall', 6], ['palm_leaning', 5], ['palm_young', 4],
  ['stone_boulder', 2], ['stone_pebbles', 3], ['stone_mossy', 2],
  ['log', 2], ['log_pile', 1], ['log_driftwood', 2],
];
