import type { ItemId } from './items';

// Rooms the explorer adds to their hut, from inside it. Each hut has a bed
// (and the Cartographer's map) from the start; these come on top. The hut
// sprite shows them from outside. Names and descriptions live in src/i18n/.

export type RoomId = 'workshop' | 'hearth' | 'barrel';

export interface RoomDef {
  id: RoomId;
  cost: Partial<Record<ItemId, number>>;
}

export const ROOMS: Record<RoomId, RoomDef> = {
  // A workbench: rope made in the hut gives one more.
  workshop: { id: 'workshop', cost: { wood: 12, stone: 6, rope: 2 } },
  // A fire inside: cook at home, and sleep heals more.
  hearth: { id: 'hearth', cost: { stone: 12, wood: 4 } },
  // Rain water from the roof: drink at home.
  barrel: { id: 'barrel', cost: { wood: 8, rope: 3 } },
};

/** In the order they are drawn, inside and in sprite names. */
export const ROOM_IDS = Object.keys(ROOMS) as RoomId[];

/** Sprite name of a hut with these rooms: `hut`, `hut_workshop_barrel`; a hearth smokes in two frames (`…_2`). */
export function hutSprite(rooms: readonly RoomId[] = [], frame = 0): string {
  const parts = ROOM_IDS.filter((r) => rooms.includes(r));
  return ['hut', ...parts].join('_') + (frame % 2 && parts.includes('hearth') ? '_2' : '');
}
