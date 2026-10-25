// Recursive shadowcasting, after the classic RogueBasin algorithm.

const MULT = [
  [1, 0, 0, -1, -1, 0, 0, 1],
  [0, 1, -1, 0, 0, -1, 1, 0],
  [0, 1, 1, 0, 0, -1, -1, 0],
  [1, 0, 0, 1, -1, 0, 0, -1],
];

type Opaque = (x: number, y: number) => boolean;
type Reveal = (x: number, y: number) => void;

export function computeFov(ox: number, oy: number, radius: number, isOpaque: Opaque, reveal: Reveal): void {
  reveal(ox, oy);
  for (let oct = 0; oct < 8; oct++) {
    castLight(ox, oy, 1, 1, 0, radius, MULT[0][oct], MULT[1][oct], MULT[2][oct], MULT[3][oct], isOpaque, reveal);
  }
}

function castLight(
  cx: number, cy: number, row: number, start: number, end: number, radius: number,
  xx: number, xy: number, yx: number, yy: number,
  isOpaque: Opaque, reveal: Reveal,
): void {
  if (start < end) return;
  const r2 = radius * radius;
  let newStart = 0;
  for (let j = row; j <= radius; j++) {
    let dx = -j - 1;
    const dy = -j;
    let blocked = false;
    while (dx <= 0) {
      dx++;
      const x = cx + dx * xx + dy * xy;
      const y = cy + dx * yx + dy * yy;
      const lSlope = (dx - 0.5) / (dy + 0.5);
      const rSlope = (dx + 0.5) / (dy - 0.5);
      if (start < rSlope) continue;
      if (end > lSlope) break;
      if (dx * dx + dy * dy < r2) reveal(x, y);
      if (blocked) {
        if (isOpaque(x, y)) {
          newStart = rSlope;
        } else {
          blocked = false;
          start = newStart;
        }
      } else if (isOpaque(x, y) && j < radius) {
        blocked = true;
        castLight(cx, cy, j + 1, start, lSlope, radius, xx, xy, yx, yy, isOpaque, reveal);
        newStart = rSlope;
      }
    }
    if (blocked) break;
  }
}
