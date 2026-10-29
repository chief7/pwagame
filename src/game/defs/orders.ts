import type { ItemId } from './items';
import type { ObjectKind } from './objects';

// What the radio can order after the call for help: a crate the helicopter
// drops on the helipad. Supply crates are free, one each day. Special parts
// are things the explorer cannot make; the explorer pays for each one with
// materials, and some open only when a habitat building stands on the rig.
// Names live in src/i18n/ (`ui.orders`).

export type OrderId = 'food' | 'build' | 'fuel' | 'solar_panel' | 'cooker' | 'motor';

export interface OrderDef {
  id: OrderId;
  /** What the crate holds. */
  contents: Partial<Record<ItemId, number>>;
  /** What the explorer pays, from the bag, when they order. With a price there is no "one each day". */
  price?: Partial<Record<ItemId, number>>;
  /** A habitat building that must stand on the rig first. */
  opensAfter?: ObjectKind;
}

export const ORDERS: Record<OrderId, OrderDef> = {
  food: { id: 'food', contents: { cooked_fish: 3, coconut: 4, apple: 3 } },
  build: { id: 'build', contents: { log: 10, wood: 6, leaves: 12, stone: 6 } },
  fuel: { id: 'fuel', contents: { diesel: 4, rope: 4 } },
  solar_panel: { id: 'solar_panel', contents: { solar_panel: 1 }, price: { steel_plate: 2, crystal: 2 } },
  cooker: { id: 'cooker', contents: { cooker: 1 }, price: { vegetables: 6, steel_plate: 2 }, opensAfter: 'solar_station' },
  motor: { id: 'motor', contents: { motor: 1 }, price: { diesel: 6, steel_plate: 3 }, opensAfter: 'solar_station' },
};

export const ORDER_IDS = Object.keys(ORDERS) as OrderId[];

/** The rig habitat: the buildings the explorer puts up on the rig after the call for help, in order. */
export const HABITAT: ObjectKind[] = ['solar_station', 'galley', 'machine_shop'];
