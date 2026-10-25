import '../fonts.css';
import { bake, buildSprites, type Sprite } from './index';

// Dev page for reviewing new sprites before they go into the game.
//
//   /preview.html?show=berry_bush,campfire|campfire_2&bg=grass&compare=male_down,palm_tall
//
//   show     sprites to review, comma-separated; join animation frames with "|" (or "+")
//   bg       ground tile to stand them on (default sand)
//   compare  existing sprites to stand next to them in the scene (default: the explorer)
//   ms       milliseconds per animation frame (default 220, the campfire speed)

const TILE = 16;
const CLOSE_SCALE = 8;
const STRIP_SCALE = 5;
const SCENE_SCALE = 4;

const params = new URLSearchParams(location.search);
// "+" arrives as a space in a query string, so accept space and "|" too.
const show = (params.get('show') ?? '').split(',').filter(Boolean).map((s) => s.split(/[+ |]/).filter(Boolean));
const ground = params.get('bg') ?? 'sand';
const compare = (params.get('compare') ?? 'male_down').split(',').filter(Boolean);
const frameMs = Number(params.get('ms') ?? 220);

const sprites = buildSprites();
const baked = new Map([...sprites].map(([name, s]) => [name, bake(s)]));

const style = document.createElement('style');
style.textContent = `
  :root { color-scheme: dark; --bg: #101418; --panel: #171d22; --border: #27313a; --text: #dcd5c6; --muted: #8a9096; --bad: #ff8a73; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.4 "Pixelify Sans", ui-monospace, Menlo, Consolas, monospace; }
  main { max-width: 1100px; margin: 0 auto; padding: 24px max(16px, env(safe-area-inset-left)); display: grid; gap: 28px; }
  h2 { font-size: 13px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
  .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
  figure { margin: 0; display: grid; gap: 6px; justify-items: center; padding: 10px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; }
  figcaption { font-size: 11px; color: var(--muted); text-align: center; }
  canvas { image-rendering: pixelated; display: block; max-width: 100%; }
  .error { color: var(--bad); }
`;
document.head.append(style);

const main = document.getElementById('preview')!;

function section(title: string, ...children: Node[]): void {
  const s = document.createElement('section');
  const h = document.createElement('h2');
  h.textContent = title;
  s.append(h, ...children);
  main.append(s);
}

function figure(canvas: HTMLCanvasElement, caption: string): HTMLElement {
  const fig = document.createElement('figure');
  const cap = document.createElement('figcaption');
  cap.textContent = caption;
  fig.append(canvas, cap);
  return fig;
}

function canvasFor(wTiles: number, hTiles: number, scale: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = wTiles * TILE * scale;
  c.height = hTiles * TILE * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(scale, scale);
  return [c, ctx];
}

function fillGround(ctx: CanvasRenderingContext2D, wTiles: number, hTiles: number): void {
  const tile = baked.get(ground);
  for (let y = 0; y < hTiles; y++) for (let x = 0; x < wTiles; x++) if (tile) ctx.drawImage(tile, x * TILE, y * TILE);
}

/** Draw a sprite standing bottom-centre on tile (tx, ty), like the game does. */
function stand(ctx: CanvasRenderingContext2D, name: string, tx: number, ty: number): void {
  const s = sprites.get(name)!;
  ctx.drawImage(baked.get(name)!, tx * TILE + TILE / 2 - s.width / 2, (ty + 1) * TILE - s.height);
}

/** Redraw `draw(frame)` on a timer so animations play in place. */
function animate(frames: number, draw: (frame: number) => void): void {
  draw(0);
  if (frames < 2) return;
  let frame = 0;
  setInterval(() => {
    frame = (frame + 1) % frames;
    draw(frame);
  }, frameMs);
}

const missing = show.flat().concat(compare).filter((n) => !sprites.has(n));
if (!show.length || missing.length) {
  const p = document.createElement('p');
  p.className = missing.length ? 'error' : '';
  p.textContent = missing.length
    ? `Unknown sprite(s): ${missing.join(', ')}. Register them in spriteGroups() in src/sprites/index.ts.`
    : 'Add ?show=name1,name2 (join animation frames with |). Optional: &bg=grass &compare=male_down,palm_tall &ms=220.';
  main.append(p);
} else {
  const size = (group: string[]) => {
    const s: Sprite[] = group.map((n) => sprites.get(n)!);
    return [Math.ceil(Math.max(...s.map((x) => x.width)) / TILE), Math.ceil(Math.max(...s.map((x) => x.height)) / TILE)];
  };

  // 1. Close-up of each sprite (animations play).
  const close = document.createElement('div');
  close.className = 'row';
  for (const group of show) {
    const [w, h] = size(group);
    const [c, ctx] = canvasFor(w, h, CLOSE_SCALE);
    animate(group.length, (f) => {
      fillGround(ctx, w, h);
      ctx.drawImage(baked.get(group[f])!, (w * TILE - sprites.get(group[f])!.width) / 2, h * TILE - sprites.get(group[f])!.height);
    });
    const s = sprites.get(group[0])!;
    close.append(figure(c, `${group.join(' + ')} · ${s.width}×${s.height}`));
  }
  section(`Close-up on ${ground}`, close);

  // 2. Every frame of each animation side by side.
  const strips = show.filter((g) => g.length > 1);
  if (strips.length) {
    const row = document.createElement('div');
    row.className = 'row';
    for (const group of strips) {
      const [w, h] = size(group);
      const [c, ctx] = canvasFor(w * group.length, h, STRIP_SCALE);
      fillGround(ctx, w * group.length, h);
      group.forEach((name, i) => {
        const s = sprites.get(name)!;
        ctx.drawImage(baked.get(name)!, i * w * TILE + (w * TILE - s.width) / 2, h * TILE - s.height);
      });
      row.append(figure(c, `frames: ${group.join(', ')} · ${frameMs} ms each`));
    }
    section('Animation frames', row);
  }

  // 3. In the game: at game scale, next to sprites the player already knows.
  const cast = [...compare.map((n) => [n]), ...show];
  const wTiles = Math.max(7, cast.length * 2 + 1);
  const hTiles = 4;
  const [scene, sctx] = canvasFor(wTiles, hTiles, SCENE_SCALE);
  const longest = Math.max(...cast.map((g) => g.length));
  animate(longest, (f) => {
    fillGround(sctx, wTiles, hTiles);
    cast.forEach((group, i) => stand(sctx, group[f % group.length], 1 + i * 2, 2));
  });
  section('In the game (actual size × 4 zoom, with existing sprites to compare)', figure(scene, cast.map((g) => g[0]).join(' · ')));
}
