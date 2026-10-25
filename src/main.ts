import './style.css';
import { ITEMS, itemLabel, type ItemId } from './game/defs/items';
import { OBJECTS } from './game/defs/objects';
import { RECIPE_IDS, RECIPES } from './game/defs/recipes';
import { Game, type SaveData } from './game/game';
import { LOW, NEED_IDS, NEED_LABELS } from './game/needs';
import { Animator, STEP_MS } from './ui/animator';
import { commandForKey, directionFrom, type Command } from './ui/input';
import { Renderer, type Body } from './ui/renderer';

const LOG_LINES = 3;
/** Finger travel (CSS px) beyond which a touch is no longer a tap. */
const TAP_SLOP = 12;
/** Press length before a touch becomes hold-to-walk. */
const HOLD_DELAY = 280;
/** Auto-moves run at the pace of the step animation so walking looks continuous. */
const HOLD_STEP_MS = STEP_MS + 15;
const TRAVEL_STEP_MS = STEP_MS;
/** Between animations the scene still redraws for the sea, fire and idle bobbing. */
const AMBIENT_FRAME_MS = 100;
const SAVE_DELAY_MS = 800;
const BODY_KEY = 'pwagame.body';
const SAVE_KEY = 'pwagame.save';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('view');
const renderer = new Renderer(canvas);
const anim = new Animator();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
anim.reducedMotion = reducedMotion.matches;
reducedMotion.addEventListener('change', () => {
  anim.reducedMotion = reducedMotion.matches;
});

const ui = {
  needs: $('needs'),
  clock: $('clock'),
  shelter: $('shelter'),
  log: $('log'),
  bag: $<HTMLButtonElement>('btn-bag'),
  build: $<HTMLButtonElement>('btn-build'),
  sleep: $<HTMLButtonElement>('btn-sleep'),
  sheet: $('sheet'),
  sheetTitle: $('sheet-title'),
  sheetBody: $('sheet-body'),
  sheetClose: $<HTMLButtonElement>('sheet-close'),
  picker: $('picker'),
};

// ---- Storage (every access may throw in private modes) -------------------------

function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Without storage the game still plays; it just won't be there next time.
  }
}

function loadGame(): Game {
  const raw = readStore(SAVE_KEY);
  if (raw) {
    try {
      return Game.fromSave(JSON.parse(raw) as SaveData);
    } catch (err) {
      console.warn('Could not load the saved game; starting a new island.', err);
    }
  }
  return new Game();
}

let game = loadGame();
let saveTimer: number | undefined;

function saveSoon(): void {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, SAVE_DELAY_MS);
}

function saveNow(): void {
  clearTimeout(saveTimer);
  writeStore(SAVE_KEY, JSON.stringify(game.toSave()));
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow();
});
window.addEventListener('pagehide', saveNow);

// ---- Explorer choice ------------------------------------------------------------

function chooseBody(body: Body): void {
  renderer.body = body;
  writeStore(BODY_KEY, body);
  ui.picker.hidden = true;
  requestFrame();
}

for (const button of ui.picker.querySelectorAll<HTMLButtonElement>('button[data-body]')) {
  const body = button.dataset.body as Body;
  renderer.drawIcon(button.querySelector('canvas')!, `${body}_down`);
  button.addEventListener('click', () => chooseBody(body));
}

const rememberedBody = readStore(BODY_KEY);
if (rememberedBody === 'male' || rememberedBody === 'female') {
  renderer.body = rememberedBody;
  ui.picker.hidden = true;
}

// ---- HUD ---------------------------------------------------------------------

const meters = new Map(
  NEED_IDS.map((id) => {
    const el = document.createElement('div');
    el.className = 'need';
    el.style.setProperty('--fill', `var(--${id})`);
    el.innerHTML = `<span class="need-label">${NEED_LABELS[id]}</span><div class="need-bar"><div class="need-fill"></div></div>`;
    el.setAttribute('role', 'meter');
    el.setAttribute('aria-label', NEED_LABELS[id]);
    ui.needs.append(el);
    return [id, el] as const;
  }),
);

function updateHud(): void {
  for (const [id, el] of meters) {
    const value = Math.round(game.needs[id]);
    (el.querySelector('.need-fill') as HTMLElement).style.width = `${value}%`;
    el.classList.toggle('low', value < LOW);
    el.setAttribute('aria-valuenow', String(value));
  }
  const { x, y } = game.player;
  const phaseLabel = { dawn: 'dawn', day: '', dusk: 'dusk', night: 'night' }[game.phase];
  ui.clock.textContent = `${game.clock}${phaseLabel ? ` · ${phaseLabel}` : ''}`;
  const obj = game.objectAt(x, y);
  ui.shelter.textContent = game.nearFire(x, y)
    ? 'By the fire'
    : obj && OBJECTS[obj.kind].shelter
      ? `In your ${OBJECTS[obj.kind].name}`
      : game.shelterAt(x, y) > 0
        ? 'In a cave'
        : '';

  const recent = game.log.slice(-LOG_LINES);
  ui.log.replaceChildren(
    ...recent.map((entry, i) => {
      const li = document.createElement('li');
      li.textContent = entry.text;
      li.className = entry.tone + (i < recent.length - 1 ? ' old' : '');
      return li;
    }),
  );
  if (!ui.sheet.hidden) renderSheet();
}

// ---- Render loop ------------------------------------------------------------------
//
// Full frame rate while something is animating, a slow tick otherwise.

let frameQueued = false;
let ambientTimer: number | undefined;

function requestFrame(): void {
  clearTimeout(ambientTimer);
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(frame);
}

function frame(now: number): void {
  frameQueued = false;
  renderer.render(game, anim, now);
  if (anim.busy(now)) requestFrame();
  else ambientTimer = window.setTimeout(requestFrame, AMBIENT_FRAME_MS);
}

/** Pick up what just happened in the game: animate it, refresh the HUD, save. */
function afterTurn(): void {
  anim.consume(game.takeEvents(), performance.now(), game.player.id);
  requestFrame();
  updateHud();
  saveSoon();
}

function run(cmd: Command): void {
  switch (cmd.type) {
    case 'move': game.move(cmd.dx, cmd.dy); break;
    case 'wait': game.wait(); break;
    case 'sleep': game.sleep(); break;
    case 'bag': openSheet('bag'); return;
    case 'build': openSheet('build'); return;
  }
  afterTurn();
}

// ---- Bag and build sheets -----------------------------------------------------------

type SheetKind = 'bag' | 'build';
let sheetKind: SheetKind = 'bag';
let confirmNewIsland = false;
const icons = new Map<string, string>();

function icon(name: string): string {
  if (!icons.has(name)) icons.set(name, renderer.iconURL(name));
  return icons.get(name)!;
}

function openSheet(kind: SheetKind): void {
  stopAuto();
  sheetKind = kind;
  confirmNewIsland = false;
  ui.sheet.hidden = false;
  renderSheet();
  ui.sheetClose.focus();
}

function closeSheet(): void {
  ui.sheet.hidden = true;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, children: (Node | string)[] = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function row(image: string, title: string, note: Node | string, action?: HTMLButtonElement): HTMLElement {
  return el('div', { className: 'row' }, [
    el('img', { src: image, alt: '' }),
    el('div', { className: 'row-text' }, [el('span', { className: 'row-title', textContent: title }), note]),
    action ?? '',
  ]);
}

function renderSheet(): void {
  ui.sheetTitle.textContent = sheetKind === 'bag' ? 'Your bag' : 'Build';
  const rows = el('div', { className: 'rows' });
  if (sheetKind === 'bag') {
    const entries = game.inventory.entries();
    if (!entries.length) rows.append(el('p', { className: 'empty', textContent: 'Your bag is empty. Bump into plants, logs and stones to gather things.' }));
    for (const [id, count] of entries) {
      const food = ITEMS[id].eat;
      const button = food ? el('button', { type: 'button', textContent: 'Eat' }) : undefined;
      button?.addEventListener('click', () => {
        if (game.eat(id)) afterTurn();
        else updateHud();
      });
      const note = food ? Object.entries(food).map(([need, n]) => `+${n} ${need}`).join(' · ') : 'For building';
      rows.append(row(icon(`item_${id}`), `${count} × ${ITEMS[id].plural}`, el('span', { className: 'row-note', textContent: note }), button));
    }
  } else {
    for (const id of RECIPE_IDS) {
      const recipe = RECIPES[id];
      const problem = game.buildProblem(id);
      const button = el('button', { type: 'button', textContent: 'Build', disabled: !!problem, className: problem ? '' : 'primary' });
      button.addEventListener('click', () => {
        if (game.build(id)) {
          closeSheet();
          afterTurn();
        }
      });
      const costs = el('div', { className: 'costs' });
      for (const [item, need] of Object.entries(recipe.cost) as [ItemId, number][]) {
        const have = game.inventory.count(item);
        costs.append(
          el('span', { className: `cost${have < need ? ' missing' : ''}`, title: itemLabel(item, need) }, [
            el('img', { src: icon(`item_${item}`), alt: ITEMS[item].plural }),
            `${have}/${need}`,
          ]),
        );
      }
      const note = el('div', {}, [el('span', { className: 'row-note', textContent: recipe.description }), costs]);
      rows.append(row(icon(recipe.builds), recipe.name, note, button));
    }
    rows.append(el('p', { className: 'empty', textContent: 'Buildings go in front of you.' }));
  }

  const foot = el('div', { className: 'sheet-foot' });
  if (sheetKind === 'bag') {
    const change = el('button', { type: 'button', textContent: 'Change explorer' });
    change.addEventListener('click', () => {
      closeSheet();
      ui.picker.hidden = false;
    });
    const fresh = el('button', { type: 'button', textContent: confirmNewIsland ? 'Tap again to confirm' : 'New island' });
    fresh.addEventListener('click', () => {
      if (!confirmNewIsland) {
        confirmNewIsland = true;
        renderSheet();
        return;
      }
      game = new Game();
      anim.consume([{ type: 'fade', late: false }], performance.now(), game.player.id);
      closeSheet();
      afterTurn();
      saveNow();
    });
    foot.append(change, fresh);
  }
  ui.sheetBody.replaceChildren(rows, foot);
}

ui.sheetClose.addEventListener('click', closeSheet);
ui.sheet.addEventListener('click', (e) => {
  if (e.target === ui.sheet) closeSheet();
});

// ---- Auto-movement (travel and hold) ---------------------------------------------------

let autoTimer: number | undefined;

function stopAuto(): void {
  clearTimeout(autoTimer);
  autoTimer = undefined;
}

/**
 * Repeat `step` until it says stop, something new comes into view, the
 * explorer gets a warning, or a turn moves them somewhere else entirely.
 * The first step always happens.
 */
function autoMove(step: () => boolean, delay: number): void {
  stopAuto();
  const seen = new Set(game.visibleAnimals().map((a) => a.id));
  const tick = () => {
    const logBefore = game.log.length;
    const keepGoing = step();
    afterTurn();
    const surprise = game.visibleAnimals().some((a) => !seen.has(a.id));
    const warned = game.log.slice(logBefore).some((m) => m.tone === 'warn');
    autoTimer = keepGoing && !surprise && !warned ? window.setTimeout(tick, delay) : undefined;
  };
  tick();
}

// ---- Keyboard ---------------------------------------------------------------------

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!ui.picker.hidden) return;
  if (!ui.sheet.hidden) {
    if (e.key === 'Escape') closeSheet();
    return;
  }
  const cmd = commandForKey(e);
  if (!cmd) return;
  e.preventDefault();
  stopAuto();
  run(cmd);
});

// ---- Touch and mouse ------------------------------------------------------------------
//
// Tap next to the explorer: step there, or gather / drink / shoo what's
// there. Tap the explorer: wait. Tap further away: walk there along a
// known path. Press and hold: keep walking towards the finger.

interface Press {
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  holdTimer: number;
  holding: boolean;
  cancelled: boolean;
}

let press: Press | null = null;

function local(e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function holdDirection(p: Press): [number, number] | null {
  const c = renderer.playerCenter();
  return directionFrom(c.x, c.y, p.x, p.y, renderer.cellSize * 0.5);
}

canvas.addEventListener('pointerdown', (e) => {
  stopAuto();
  if (press) return;
  canvas.setPointerCapture(e.pointerId);
  const { x, y } = local(e);
  const p: Press = { id: e.pointerId, startX: x, startY: y, x, y, holdTimer: 0, holding: false, cancelled: false };
  p.holdTimer = window.setTimeout(() => {
    if (p.cancelled || !holdDirection(p)) return;
    p.holding = true;
    autoMove(() => {
      const dir = press === p ? holdDirection(p) : null;
      return dir !== null && game.move(dir[0], dir[1]);
    }, HOLD_STEP_MS);
  }, HOLD_DELAY);
  press = p;
});

canvas.addEventListener('pointermove', (e) => {
  if (!press || press.id !== e.pointerId) return;
  const { x, y } = local(e);
  press.x = x;
  press.y = y;
  // Dragging before the hold kicks in cancels the tap; while holding it steers.
  if (!press.holding && Math.hypot(x - press.startX, y - press.startY) > TAP_SLOP) press.cancelled = true;
});

function endPress(e: PointerEvent, cancel: boolean): void {
  if (!press || press.id !== e.pointerId) return;
  const p = press;
  press = null;
  clearTimeout(p.holdTimer);
  if (p.holding) {
    stopAuto();
    return;
  }
  if (cancel || p.cancelled) return;
  tap(p.startX, p.startY);
}

canvas.addEventListener('pointerup', (e) => endPress(e, false));
canvas.addEventListener('pointercancel', (e) => endPress(e, true));

function tap(x: number, y: number): void {
  const target = renderer.cellAt(x, y);
  const dx = target.x - game.player.x;
  const dy = target.y - game.player.y;
  if (dx === 0 && dy === 0) return run({ type: 'wait' });
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) return run({ type: 'move', dx, dy });
  if (game.isPassable(target.x, target.y) && game.map.isExplored(target.x, target.y)) {
    autoMove(() => game.travelStep(target.x, target.y) === 'moved', TRAVEL_STEP_MS);
    return;
  }
  // Somewhere we can't walk to (sea, trees, the unknown): step that way.
  const c = renderer.playerCenter();
  const dir = directionFrom(c.x, c.y, x, y, 0);
  if (dir) run({ type: 'move', dx: dir[0], dy: dir[1] });
}

// ---- Buttons and lifecycle --------------------------------------------------------------

ui.bag.addEventListener('click', () => run({ type: 'bag' }));
ui.build.addEventListener('click', () => run({ type: 'build' }));
ui.sleep.addEventListener('click', () => {
  stopAuto();
  run({ type: 'sleep' });
});

new ResizeObserver(() => {
  renderer.resize();
  requestFrame();
}).observe(canvas);

updateHud();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.warn('Service worker registration failed', err);
    });
  });
}
