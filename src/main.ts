import './style.css';
import { Game } from './game/game';
import { Animator, STEP_MS } from './ui/animator';
import { commandForKey, directionFrom, type Command } from './ui/input';
import { Renderer, type Body } from './ui/renderer';

const LOG_LINES = 4;
/** Finger travel (CSS px) beyond which a touch is no longer a tap. */
const TAP_SLOP = 12;
/** Press length before a touch becomes hold-to-walk. */
const HOLD_DELAY = 280;
/** Auto-moves run at the pace of the step animation so walking looks continuous. */
const HOLD_STEP_MS = STEP_MS + 15;
const TRAVEL_STEP_MS = STEP_MS;
/** Between animations the scene still redraws for the sea and idle bobbing. */
const AMBIENT_FRAME_MS = 100;
const BODY_KEY = 'pwagame.body';

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
  hpFill: $('hp-fill'),
  hpText: $('hp-text'),
  stats: $('stats'),
  log: $('log'),
  wait: $<HTMLButtonElement>('btn-wait'),
  drink: $<HTMLButtonElement>('btn-drink'),
  sail: $<HTMLButtonElement>('btn-sail'),
  gameOver: $('game-over'),
  gameOverText: $('game-over-text'),
  restart: $<HTMLButtonElement>('btn-restart'),
  change: $<HTMLButtonElement>('btn-change'),
  picker: $('picker'),
};

let game = new Game();

// ---- Explorer choice ------------------------------------------------------

function savedBody(): Body | null {
  try {
    const v = localStorage.getItem(BODY_KEY);
    return v === 'male' || v === 'female' ? v : null;
  } catch {
    return null;
  }
}

function chooseBody(body: Body): void {
  renderer.body = body;
  try {
    localStorage.setItem(BODY_KEY, body);
  } catch {
    // Storage can be unavailable (private mode); the choice still applies now.
  }
  ui.picker.hidden = true;
  draw();
}

for (const button of ui.picker.querySelectorAll<HTMLButtonElement>('button[data-body]')) {
  const body = button.dataset.body as Body;
  renderer.drawIcon(button.querySelector('canvas')!, `${body}_down`);
  button.addEventListener('click', () => chooseBody(body));
}

// ---- Turn handling ----------------------------------------------------------

function run(cmd: Command): void {
  switch (cmd.type) {
    case 'move': game.move(cmd.dx, cmd.dy); break;
    case 'wait': game.wait(); break;
    case 'sail': game.sail(); break;
    case 'drink': game.drinkTonic(); break;
  }
  draw();
}

// ---- Render loop -------------------------------------------------------------
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

/** Pick up what just happened in the game: start its animations and refresh the HUD. */
function draw(): void {
  anim.consume(game.takeEvents(), performance.now(), game.player.id);
  requestFrame();
  const { player } = game;
  ui.hpFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
  ui.hpText.textContent = `${player.hp}/${player.maxHp}`;
  ui.stats.textContent = `Isle ${game.depth} · Lv${game.level} · ${game.xp}/${game.xpToNext}xp`;
  ui.drink.textContent = `Tonic ×${game.tonics}`;
  ui.drink.disabled = game.over || game.tonics === 0;
  ui.wait.disabled = game.over;
  ui.sail.disabled = game.over || !game.onRaft;
  ui.sail.classList.toggle('ready', game.onRaft && !game.over);

  const recent = game.log.slice(-LOG_LINES);
  ui.log.replaceChildren(
    ...recent.map((entry, i) => {
      const li = document.createElement('li');
      li.textContent = entry.text;
      li.className = entry.tone + (i < recent.length - 1 ? ' old' : '');
      return li;
    }),
  );

  ui.gameOver.hidden = !game.over;
  if (game.over) {
    ui.gameOverText.textContent = `Island ${game.depth}, level ${game.level}, ${game.turn} turns.`;
  }
}

// ---- Auto-movement (travel and hold) ------------------------------------------

let autoTimer: number | undefined;

function stopAuto(): void {
  clearTimeout(autoTimer);
  autoTimer = undefined;
}

/**
 * Repeat `step` until it says stop, a monster comes into view, the island
 * changes or the game ends. The first step always happens.
 */
function autoMove(step: () => boolean, delay: number): void {
  stopAuto();
  const depth = game.depth;
  const tick = () => {
    const keepGoing = step();
    draw();
    const interrupted = game.over || game.depth !== depth || game.visibleMonsters().length > 0;
    autoTimer = keepGoing && !interrupted ? window.setTimeout(tick, delay) : undefined;
  };
  tick();
}

// ---- Keyboard -------------------------------------------------------------

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!ui.picker.hidden) return;
  if (game.over && (e.key === 'Enter' || e.key === ' ')) {
    restart();
    e.preventDefault();
    return;
  }
  const cmd = commandForKey(e);
  if (!cmd) return;
  e.preventDefault();
  stopAuto();
  run(cmd);
});

// ---- Touch and mouse ------------------------------------------------------------
//
// Tap next to the explorer: step there (or attack / open). Tap the explorer:
// wait. Tap further away: walk there along a known path. Press and hold:
// keep walking towards the finger until release or a monster shows up.

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
  if (press || game.over) return;
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
  // Somewhere we can't walk to (sea, scenery, the unknown): step that way.
  const c = renderer.playerCenter();
  const dir = directionFrom(c.x, c.y, x, y, 0);
  if (dir) run({ type: 'move', dx: dir[0], dy: dir[1] });
}

// ---- Buttons and lifecycle --------------------------------------------------------

ui.wait.addEventListener('click', () => { stopAuto(); run({ type: 'wait' }); });
ui.drink.addEventListener('click', () => { stopAuto(); run({ type: 'drink' }); });
ui.sail.addEventListener('click', () => { stopAuto(); run({ type: 'sail' }); });
ui.restart.addEventListener('click', restart);
ui.change.addEventListener('click', () => {
  restart();
  ui.picker.hidden = false;
});

function restart(): void {
  stopAuto();
  game = new Game();
  anim.consume([{ type: 'island', late: false }], performance.now(), game.player.id);
  draw();
}

new ResizeObserver(() => {
  renderer.resize();
  requestFrame();
}).observe(canvas);

const remembered = savedBody();
if (remembered) {
  renderer.body = remembered;
  ui.picker.hidden = true;
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.warn('Service worker registration failed', err);
    });
  });
}
