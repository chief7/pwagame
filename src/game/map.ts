export const Tile = {
  Water: 0,
  Sand: 1,
  /** The raft that carries the player to the next island. */
  Raft: 2,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

export class GameMap {
  readonly width: number;
  readonly height: number;
  readonly tiles: Uint8Array;
  /** Cells the player has ever seen. */
  readonly explored: Uint8Array;
  /** Cells the player can see this turn. */
  readonly visible: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tiles = new Uint8Array(width * height);
    this.explored = new Uint8Array(width * height);
    this.visible = new Uint8Array(width * height);
  }

  idx(x: number, y: number): number {
    return y * this.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): Tile {
    return this.inBounds(x, y) ? (this.tiles[this.idx(x, y)] as Tile) : Tile.Water;
  }

  set(x: number, y: number, tile: Tile): void {
    if (this.inBounds(x, y)) this.tiles[this.idx(x, y)] = tile;
  }

  isLand(x: number, y: number): boolean {
    return this.get(x, y) !== Tile.Water;
  }

  isVisible(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.visible[this.idx(x, y)] === 1;
  }

  isExplored(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.explored[this.idx(x, y)] === 1;
  }
}
