import '../fonts.css';
import { bake, buildSprites, shoreTileName, spriteGroups, type Sprite } from './index';

// Dev page listing every sprite, plus a little island built from them.

const SCALE = 4;
const TILE = 16;

const ISLAND = [
  '~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~',
  '~~~......~~~~~',
  '~~.........~~~',
  '~~..........~~',
  '~~~.........~~',
  '~~~~.......~~~',
  '~~~~~~~..~~~~~',
  '~~~~~~~~~~~~~~',
];

const PROPS: [string, number, number][] = [
  ['palm_tall', 4, 4],
  ['palm_leaning', 9, 3],
  ['palm_young', 4, 6],
  ['stone_boulder', 10, 5],
  ['stone_pebbles', 3, 5],
  ['chest_closed', 7, 4],
  ['log_driftwood', 8, 7],
  ['log_pile', 5, 3],
  ['stone_mossy', 10, 4],
  ['male_right', 6, 5],
  ['female_down', 8, 5],
];

const css = `
  :root { color-scheme: dark; --bg: #101418; --panel: #171d22; --border: #27313a; --text: #dcd5c6; --muted: #8a9096; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.4 "Pixelify Sans", ui-monospace, Menlo, Consolas, monospace; }
  main { max-width: 960px; margin: 0 auto; padding: 24px max(16px, env(safe-area-inset-left)); display: grid; gap: 28px; }
  h1 { font-size: 20px; margin: 0; }
  h2 { font-size: 13px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
  .row { display: flex; flex-wrap: wrap; gap: 12px; }
  figure { margin: 0; display: grid; gap: 6px; justify-items: center; padding: 10px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; }
  figcaption { font-size: 11px; color: var(--muted); }
  canvas { image-rendering: pixelated; display: block; max-width: 100%; }
`;

const sprites = buildSprites();
const baked = new Map([...sprites].map(([name, s]) => [name, bake(s)]));

function sceneCanvas(widthTiles: number, heightTiles: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = widthTiles * TILE * SCALE;
  canvas.height = heightTiles * TILE * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(SCALE, SCALE);
  return [canvas, ctx];
}

/** Draw a sprite standing on tile (tx, ty): bottom-centre aligned. */
function drawOnTile(ctx: CanvasRenderingContext2D, sprite: Sprite, tx: number, ty: number): void {
  ctx.drawImage(baked.get(sprite.name)!, tx * TILE + TILE / 2 - sprite.width / 2, (ty + 1) * TILE - sprite.height);
}

function spriteFigure(sprite: Sprite, onSand: boolean): HTMLElement {
  const wTiles = Math.ceil(sprite.width / TILE);
  const hTiles = Math.ceil(sprite.height / TILE);
  const [canvas, ctx] = sceneCanvas(wTiles, hTiles);
  if (onSand) {
    for (let y = 0; y < hTiles; y++) for (let x = 0; x < wTiles; x++) ctx.drawImage(baked.get('sand')!, x * TILE, y * TILE);
  }
  ctx.drawImage(baked.get(sprite.name)!, (wTiles * TILE - sprite.width) / 2, hTiles * TILE - sprite.height);
  const fig = document.createElement('figure');
  const cap = document.createElement('figcaption');
  cap.textContent = sprite.name;
  fig.append(canvas, cap);
  return fig;
}

function islandScene(): HTMLCanvasElement {
  const h = ISLAND.length;
  const w = ISLAND[0].length;
  const isWater = (x: number, y: number) => (ISLAND[y]?.[x] ?? '~') === '~';
  const [canvas, ctx] = sceneCanvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const name = isWater(x, y) ? 'water' : shoreTileName((dx, dy) => isWater(x + dx, y + dy));
      ctx.drawImage(baked.get(name)!, x * TILE, y * TILE);
    }
  }
  for (const [name, x, y] of [...PROPS].sort((a, b) => a[2] - b[2])) drawOnTile(ctx, sprites.get(name)!, x, y);
  return canvas;
}

const style = document.createElement('style');
style.textContent = css;
document.head.append(style);

const main = document.getElementById('gallery')!;
const title = document.createElement('h1');
title.textContent = 'Sprites';
main.append(title);

const scene = document.createElement('section');
scene.innerHTML = '<h2>Island</h2>';
scene.append(islandScene());
main.append(scene);

for (const group of spriteGroups()) {
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = group.title;
  const row = document.createElement('div');
  row.className = 'row';
  const terrain = group.title === 'Sand' || group.title === 'Shores';
  row.append(...group.sprites.map((s) => spriteFigure(s, !terrain)));
  section.append(h2, row);
  main.append(section);
}
