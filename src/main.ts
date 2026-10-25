import './style.css';
import { ITEMS, type ItemId } from './game/defs/items';
import { OBJECTS } from './game/defs/objects';
import { RECIPE_IDS, RECIPES } from './game/defs/recipes';
import { PATH_IDS, PATHS, SKILLS, xpForPoints, pointsForXp } from './game/defs/skills';
import { Game, type SaveData } from './game/game';
import { LOW, NEED_IDS, type NeedId } from './game/needs';
import { isLang, LANGUAGES, preferredLang, setLang, t, type Lang, type Strings } from './i18n';
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
const LANG_KEY = 'pwagame.lang';
const SAVE_KEY = 'pwagame.save';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// The canvas only uses a web font once it has loaded; ask for the bold face early.
void document.fonts?.load(`bold 16px 'Pixelify Sans'`);

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
  skills: $<HTMLButtonElement>('btn-skills'),
  sleep: $<HTMLButtonElement>('btn-sleep'),
  sheet: $('sheet'),
  sheetTitle: $('sheet-title'),
  sheetBody: $('sheet-body'),
  sheetClose: $<HTMLButtonElement>('sheet-close'),
  picker: $('picker'),
  pickerLang: $<HTMLButtonElement>('picker-lang'),
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

// ---- Language ---------------------------------------------------------------------

const storedLang = readStore(LANG_KEY);
setLang(isLang(storedLang) ? storedLang : preferredLang(navigator.languages ?? [navigator.language]));

/** The language the switch button offers: the one that isn't on now. */
function otherLang(): Lang {
  return t().lang === 'en' ? 'de' : 'en';
}

function switchLang(): void {
  const lang = otherLang();
  setLang(lang);
  writeStore(LANG_KEY, lang);
  applyLang();
}

/** Put the current language into everything that is already on screen. */
function applyLang(): void {
  const words = t();
  document.documentElement.lang = words.lang;
  for (const node of document.querySelectorAll<HTMLElement>('[data-t]')) {
    node.textContent = words.ui[node.dataset.t as keyof Strings['ui']] as string;
  }
  ui.pickerLang.replaceChildren(...langButtonLabel());
  for (const [id, meter] of meters) {
    meter.querySelector('.need-label')!.textContent = words.needs[id];
    meter.setAttribute('aria-label', words.needs[id]);
  }
  updateHud();
}

/** Globe icon and the name of the other language. */
function langButtonLabel(): (Node | string)[] {
  return [el('img', { src: icon('ui_globe'), alt: '' }), LANGUAGES[otherLang()].name];
}

ui.pickerLang.addEventListener('click', switchLang);

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

const meters = new Map<NeedId, HTMLElement>(
  NEED_IDS.map((id) => {
    const el = document.createElement('div');
    el.className = 'need';
    el.style.setProperty('--fill', `var(--${id})`);
    el.innerHTML = `<span class="need-label"></span><div class="need-bar"><div class="need-fill"></div></div>`;
    el.setAttribute('role', 'meter');
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
  const words = t();
  const { x, y } = game.player;
  const phase = game.phase;
  ui.clock.textContent = `${words.clock(game.turn)}${phase === 'day' ? '' : ` · ${words.ui[phase]}`}`;
  const obj = game.objectAt(x, y);
  ui.shelter.textContent = game.nearFire(x, y)
    ? words.ui.byFire
    : obj && OBJECTS[obj.kind].shelter
      ? words.ui.inShelter(obj.kind)
      : game.shelterAt(x, y) > 0
        ? words.ui.inCave
        : '';

  const recent = game.log.slice(-LOG_LINES);
  ui.log.replaceChildren(
    ...recent.map((entry, i) => {
      const li = document.createElement('li');
      li.textContent = words.message(entry.msg);
      li.className = entry.tone + (i < recent.length - 1 ? ' old' : '');
      return li;
    }),
  );
  updateSkillsButton();
  if (!ui.sheet.hidden) renderSheet();
}

/** A star on the Skills button while there are points to spend. */
const skillStar = el('img', { className: 'star', alt: '' });
function updateSkillsButton(): void {
  const points = game.skillPoints;
  skillStar.src = icon('ui_star');
  if (points > 0) ui.skills.append(skillStar);
  else skillStar.remove();
  ui.skills.setAttribute('aria-label', points > 0 ? `${t().ui.skills}: ${t().ui.skillPoints(points)}` : t().ui.skills);
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
  // Walking into the finished boat asks whether to leave (or shows the end again).
  if (game.takeSailRequest()) openSheet(game.sailed ? 'end' : 'sail');
}

function run(cmd: Command): void {
  switch (cmd.type) {
    case 'move': game.move(cmd.dx, cmd.dy); break;
    case 'wait': game.wait(); break;
    case 'sleep': game.sleep(); break;
    case 'bag': openSheet('bag'); return;
    case 'build': openSheet('build'); return;
    case 'skills': openSheet('skills'); return;
  }
  afterTurn();
}

// ---- Bag and build sheets -----------------------------------------------------------

type SheetKind = 'bag' | 'build' | 'skills' | 'sail' | 'end';
let sheetKind: SheetKind = 'bag';
/** The footer button that waits for a second tap before it starts over. */
let confirming: 'island' | 'reset' | null = null;
const icons = new Map<string, string>();

function icon(name: string): string {
  if (!icons.has(name)) icons.set(name, renderer.iconURL(name));
  return icons.get(name)!;
}

function openSheet(kind: SheetKind): void {
  stopAuto();
  sheetKind = kind;
  confirming = null;
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
  const words = t();
  ui.sheetTitle.textContent = {
    bag: words.ui.yourBag, build: words.ui.build, skills: words.ui.skills, sail: words.ui.sailTitle, end: words.ui.endTitle,
  }[sheetKind];
  const rows = el('div', { className: 'rows' });
  if (sheetKind === 'sail' || sheetKind === 'end') {
    renderVoyage(rows);
  } else if (sheetKind === 'skills') {
    renderSkills(rows);
  } else if (sheetKind === 'bag') {
    const entries = game.inventory.entries();
    if (!entries.length) rows.append(el('p', { className: 'empty', textContent: words.ui.bagEmpty }));
    for (const [id, count] of entries) {
      const food = ITEMS[id].eat;
      const button = food ? el('button', { type: 'button', textContent: words.ui.eat }) : undefined;
      button?.addEventListener('click', () => {
        if (game.eat(id)) afterTurn();
        else updateHud();
      });
      const note = food
        ? (Object.entries(food) as [NeedId, number][]).map(([need, n]) => words.float(n, { need })).join(' · ')
        : ITEMS[id].tool ? words.ui.tool : ITEMS[id].raw ? words.ui.raw : words.ui.forBuilding;
      rows.append(row(icon(`item_${id}`), words.itemStack(id, count), el('span', { className: 'row-note', textContent: note }), button));
    }
  } else {
    rows.append(goalCard());
    for (const id of RECIPE_IDS) {
      const recipe = RECIPES[id];
      const problem = game.buildProblem(id);
      const button = el('button', { type: 'button', textContent: words.ui.build, disabled: !!problem, className: problem ? '' : 'primary' });
      button.addEventListener('click', () => {
        if (game.build(id)) {
          closeSheet();
          afterTurn();
        }
      });
      const costs = costList(game.recipeCost(id));
      const { name, description } = words.recipes[id];
      const note = el('div', {}, [el('span', { className: 'row-note', textContent: description }), costs]);
      // Say why when it isn't just missing materials: a skill to learn, a fire to stand by.
      if (problem && (problem.key === 'needSkill' || problem.key === 'needFire')) {
        note.append(el('span', { className: 'row-note locked', textContent: words.message(problem) }));
      }
      rows.append(row(icon('builds' in recipe ? recipe.builds : `item_${recipe.makes}`), name, note, button));
    }
    rows.append(el('p', { className: 'empty', textContent: words.ui.buildHint }));
  }

  const foot = el('div', { className: 'sheet-foot' });
  if (sheetKind === 'bag') {
    const change = el('button', { type: 'button', textContent: words.ui.changeExplorer });
    change.addEventListener('click', () => {
      closeSheet();
      ui.picker.hidden = false;
    });
    const fresh = confirmButton('island', words.ui.newIsland, startNewIsland);
    const lang = el('button', { type: 'button', className: 'wide lang-switch' }, langButtonLabel());
    lang.addEventListener('click', switchLang);
    const reset = confirmButton('reset', words.ui.resetProgress, resetProgress);
    reset.classList.add('wide');
    foot.append(change, fresh, lang, reset);
  }
  ui.sheetBody.replaceChildren(rows, foot);
}

/** A button that asks for a second tap before it does something that can't be undone. */
function confirmButton(kind: 'island' | 'reset', label: string, action: () => void): HTMLButtonElement {
  const button = el('button', { type: 'button', textContent: confirming === kind ? t().ui.confirmNewIsland : label });
  button.addEventListener('click', () => {
    if (confirming === kind) return action();
    confirming = kind;
    renderSheet();
  });
  return button;
}

/** Forget everything: the island, skills and the chosen explorer. The language stays. */
function resetProgress(): void {
  writeStore(BODY_KEY, null);
  startNewIsland();
  ui.picker.hidden = false;
}

function startNewIsland(): void {
  game = new Game();
  anim.consume([{ type: 'fade', late: false }], performance.now(), game.player.id);
  closeSheet();
  afterTurn();
  saveNow();
}

/** Item icons with "have/need" counts; red where the bag has too few. */
function costList(cost: Partial<Record<ItemId, number>>): HTMLElement {
  const words = t();
  const costs = el('div', { className: 'costs' });
  for (const [item, need] of Object.entries(cost) as [ItemId, number][]) {
    const have = game.inventory.count(item);
    costs.append(
      el('span', { className: `cost${have < need ? ' missing' : ''}`, title: words.itemCount(item, need) }, [
        el('img', { src: icon(`item_${item}`), alt: words.itemCount(item, need) }),
        `${have}/${need}`,
      ]),
    );
  }
  return costs;
}

/** The island goal at the top of the Build panel: what to do next for the boat. */
function goalCard(): HTMLElement {
  const words = t();
  const goal = game.goal();
  const note = el('div', {});
  const say = (text: string) => note.append(el('span', { className: 'row-note', textContent: text }));
  let sprite = 'boat_wreck';
  switch (goal.state) {
    case 'missing': say(words.ui.goalMissing); break;
    case 'find': say(words.ui.goalFind); break;
    case 'build':
      sprite = goal.obj;
      note.append(el('span', { className: 'row-note goal-step', textContent: words.ui.goalStep(goal.index, goal.count, goal.stage.id) }));
      note.append(costList(goal.left));
      say(words.ui.goalHint);
      break;
    case 'ready': sprite = 'boat_ready'; say(words.ui.goalReady); break;
    case 'sailed': sprite = 'boat_ready'; say(words.ui.goalSailed); break;
  }
  const card = row(icon(sprite), words.ui.goalTitle, note);
  card.classList.add('goal');
  return card;
}

/** "Set sail?" before leaving, and the end screen after. */
function renderVoyage(rows: HTMLElement): void {
  const words = t();
  const leaving = sheetKind === 'sail';
  rows.append(
    el('div', { className: 'voyage' }, [
      el('img', { src: icon('boat_ready'), alt: '' }),
      el('p', { textContent: leaving ? words.ui.sailText : words.ui.endText }),
    ]),
  );
  const foot = el('div', { className: 'sheet-foot' });
  if (leaving) {
    const go = el('button', { type: 'button', className: 'primary', textContent: words.ui.setSail });
    go.addEventListener('click', () => {
      if (!game.sail()) return closeSheet();
      afterTurn();
      openSheet('end');
    });
    const wait = el('button', { type: 'button', textContent: words.ui.notYet });
    wait.addEventListener('click', closeSheet);
    foot.append(wait, go);
  } else {
    const stay = el('button', { type: 'button', textContent: words.ui.stay });
    stay.addEventListener('click', closeSheet);
    const fresh = el('button', { type: 'button', className: 'primary', textContent: words.ui.newIsland });
    fresh.addEventListener('click', startNewIsland);
    foot.append(stay, fresh);
  }
  rows.append(foot);
}

/** XP bar, points to spend, and each path's skills in the order they're learned. */
function renderSkills(rows: HTMLElement): void {
  const words = t();
  const earned = pointsForXp(game.xp);
  const from = xpForPoints(earned);
  const to = xpForPoints(earned + 1);
  const bar = el('div', { className: 'xp-bar' }, [el('div', { className: 'xp-fill' })]);
  (bar.firstChild as HTMLElement).style.width = `${((game.xp - from) / (to - from)) * 100}%`;
  rows.append(
    el('div', { className: 'xp' }, [
      el('img', { src: icon('ui_star'), alt: '' }),
      el('div', { className: 'row-text' }, [
        el('span', { className: 'row-title', textContent: words.ui.skillPoints(game.skillPoints) }),
        bar,
        el('span', { className: 'row-note', textContent: words.ui.xpToNext(game.xp, to) }),
      ]),
    ]),
  );
  for (const path of PATH_IDS) {
    rows.append(el('h3', { className: 'path' }, [el('img', { src: icon(`ui_path_${path}`), alt: '' }), words.paths[path]]));
    for (const id of PATHS[path]) {
      const learned = game.has(id);
      const problem = learned ? null : game.skillProblem(id);
      const button = el('button', {
        type: 'button',
        textContent: learned ? words.ui.learned : words.ui.learn,
        disabled: learned || !!problem,
        className: learned || problem ? '' : 'primary',
      });
      button.addEventListener('click', () => {
        if (game.learn(id)) afterTurn();
        else updateHud();
      });
      const { name, description } = words.skills[id];
      const note = el('div', {}, [
        el('span', { className: 'row-note', textContent: description }),
        learned ? '' : el('span', { className: `row-note ${problem?.key === 'needSkill' ? 'locked' : 'skill-cost'}`, textContent: problem?.key === 'needSkill' ? words.message(problem) : words.ui.skillCost(SKILLS[id].cost) }),
      ]);
      const card = row(icon(`ui_path_${path}`), name, note, button);
      if (learned) card.classList.add('learned');
      rows.append(card);
    }
  }
  rows.append(el('p', { className: 'empty', textContent: words.ui.skillsHint }));
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
ui.skills.addEventListener('click', () => run({ type: 'skills' }));
ui.sleep.addEventListener('click', () => {
  stopAuto();
  run({ type: 'sleep' });
});

new ResizeObserver(() => {
  renderer.resize();
  requestFrame();
}).observe(canvas);

applyLang();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.warn('Service worker registration failed', err);
    });
  });
}
