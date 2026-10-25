import { ITEMS, type ItemId } from './defs/items';

/** What the explorer carries: a count per item. */
export class Inventory {
  private counts = new Map<ItemId, number>();

  count(id: ItemId): number {
    return this.counts.get(id) ?? 0;
  }

  add(id: ItemId, n = 1): void {
    this.counts.set(id, this.count(id) + n);
  }

  /** Remove n if available; returns false (and changes nothing) otherwise. */
  take(id: ItemId, n = 1): boolean {
    if (this.count(id) < n) return false;
    const left = this.count(id) - n;
    if (left === 0) this.counts.delete(id);
    else this.counts.set(id, left);
    return true;
  }

  hasAll(cost: Partial<Record<ItemId, number>>): boolean {
    return Object.entries(cost).every(([id, n]) => this.count(id as ItemId) >= (n ?? 0));
  }

  takeAll(cost: Partial<Record<ItemId, number>>): boolean {
    if (!this.hasAll(cost)) return false;
    for (const [id, n] of Object.entries(cost)) this.take(id as ItemId, n ?? 0);
    return true;
  }

  /** Items held, in registry order. */
  entries(): [ItemId, number][] {
    return (Object.keys(ITEMS) as ItemId[]).filter((id) => this.count(id) > 0).map((id) => [id, this.count(id)]);
  }

  foods(): ItemId[] {
    return this.entries().filter(([id]) => ITEMS[id].eat).map(([id]) => id);
  }

  toJSON(): Partial<Record<ItemId, number>> {
    return Object.fromEntries(this.counts);
  }

  static from(data: Partial<Record<ItemId, number>>): Inventory {
    const inv = new Inventory();
    for (const [id, n] of Object.entries(data)) if (id in ITEMS && n) inv.add(id as ItemId, n);
    return inv;
  }
}
