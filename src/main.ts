import './style.css';
import { cheats } from './cheats';
import { ITEMS, type ItemId } from './game/defs/items';
import { LEVELS, levelDef } from './game/defs/levels';
import { OBJECTS } from './game/defs/objects';
import { RECIPE_IDS, RECIPES } from './game/defs/recipes';
import { ROOM_IDS, type RoomId } from './game/defs/rooms';
import { PATH_IDS, PATHS, SKILLS, xpForPoints, pointsForXp } from './game/defs/skills';
import { Game, ORDER_IDS, RADIO_ORDERS, VOYAGE_DIESEL, type SaveData } from './game/game';
import { Tile } from './game/map';
import { LOW, NEED_IDS, type NeedId } from './game/needs';
import { isLang, LANGUAGES, preferredLang, setLang, t, type Lang, type Strings } from './i18n';
import { Animator, STEP_MS } from './ui/animator';
import { commandForKey, directionFrom, type Command } from './ui/input';
import { drawMap, stampSigns } from './ui/mapview';
import { DEPART_MS, Renderer, type Body, type Departure } from './ui/renderer';
import { bake } from './sprites';
import type { MapSign } from './i18n/types';

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
/**
 * A preview build (VITE_PREVIEW=<name>, served next to the main game on the
 * same site) keeps its own save and has no service worker, so it never
 * touches the main game's save or offline cache.
 */
const PREVIEW: string = import.meta.env.VITE_PREVIEW ?? '';
const STORE = PREVIEW ? `pwagame-${PREVIEW}` : 'pwagame';
const BODY_KEY = `${STORE}.body`;
const LANG_KEY = `${STORE}.lang`;
const SAVE_KEY = `${STORE}.save`;

if (PREVIEW) document.title = `pwagame · ${PREVIEW}`;
/** Preview builds and the dev server have a Cheats panel for testing (see cheats.ts). */
const CHEATS = !!PREVIEW || import.meta.env.DEV;

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
  hut: $<HTMLButtonElement>('btn-hut'),
  grill: $<HTMLButtonElement>('btn-grill'),
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
  const tide = game.tideKnown() ? ` · ${game.lowTide ? words.ui.lowTide : words.ui.highTide}` : '';
  ui.clock.textContent = `${words.clock(game.turn)}${phase === 'day' ? '' : ` · ${words.ui[phase]}`}${tide}`;
  const obj = game.objectAt(x, y);
  ui.shelter.textContent = game.hutHere()
    ? words.ui.inShelter(game.hutHere()!.kind)
    : game.nearFire(x, y)
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
  updateHutButton();
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

/** The Hut button shows while the explorer stands in a hut: it opens the inside. */
const hutIcon = ui.hut.querySelector('img')!;
function updateHutButton(): void {
  const hut = game.hutHere();
  ui.hut.hidden = !hut;
  if (!hut) return;
  const src = icon(game.objectSprite(hut));
  if (hutIcon.getAttribute('src') !== src) hutIcon.src = src;
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
  placeGrill(now);
  if (anim.busy(now) || renderer.departure) requestFrame();
  else ambientTimer = window.setTimeout(requestFrame, AMBIENT_FRAME_MS);
}

/** Pick up what just happened in the game: animate it, refresh the HUD, save. */
function afterTurn(): void {
  anim.consume(game.takeEvents(), performance.now(), game.player.id);
  requestFrame();
  updateHud();
  saveSoon();
  // Walking into the finished boat asks whether to leave (or shows the end again).
  if (game.takeSailRequest()) openSheet(game.goalUsed ? 'end' : 'sail');
  // Walking into the hut goes inside.
  if (game.takeHutRequest()) openSheet('hut');
  // Walking into a store crate opens it.
  if (game.takeStoreRequest()) openSheet('store');
  // Walking into the fishing boat opens the sea chart and the hold.
  if (game.takeChartRequest()) openSheet('chart');
  // Walking into the working radio (after the call for help) opens the Radio panel.
  if (game.takeRadioRequest()) openSheet('radio');
}

function run(cmd: Command): void {
  if (renderer.departure) return;
  switch (cmd.type) {
    case 'move': game.move(cmd.dx, cmd.dy); break;
    case 'wait': game.wait(); break;
    case 'sleep': game.sleep(); break;
    case 'bag': openSheet('bag'); return;
    case 'build': openSheet('build'); return;
    case 'skills': openSheet('skills'); return;
    case 'map': if (game.canReadMap()) openSheet('map'); return;
    case 'hut': if (game.hutHere()) openSheet('hut'); return;
    case 'grill': grill(); return;
  }
  afterTurn();
}

// ---- Grill button ---------------------------------------------------------------------
//
// With raw fish in the bag, a button floats above the campfire the explorer
// stands by. It follows the fire as the camera moves.

/** Gap between the top of the fire's cell and the button, in CSS px. */
const GRILL_LIFT = 6;
const GRILL_FRAME_MS = 220;
const grillIcon = ui.grill.querySelector('img')!;
const grillCount = ui.grill.querySelector('.count')!;

function grill(): void {
  stopAuto();
  if (game.build('cooked_fish')) {
    // Restart the sizzle shake on every tap.
    ui.grill.classList.remove('sizzle');
    void ui.grill.offsetWidth;
    ui.grill.classList.add('sizzle');
  }
  afterTurn();
}

/** Show the button above the nearest fire while a fish can be cooked there; else hide it. */
function placeGrill(now: number): void {
  const { x, y } = game.player;
  const fire = game.buildProblem('cooked_fish') ? null : game.nearestFire(x, y);
  ui.grill.hidden = !fire || !game.map.isVisible(fire.x, fire.y);
  if (ui.grill.hidden || !fire) return;
  const fish = game.inventory.count('fish');
  const label = t().ui.grill(fish);
  if (ui.grill.getAttribute('aria-label') !== label) {
    ui.grill.setAttribute('aria-label', label);
    ui.grill.title = label;
    grillCount.textContent = `×${fish}`;
  }
  const frameName = !anim.reducedMotion && Math.floor(now / GRILL_FRAME_MS) % 2 ? 'ui_grill_2' : 'ui_grill';
  const src = icon(frameName);
  if (grillIcon.getAttribute('src') !== src) grillIcon.src = src;
  // Centred above the fire, but always fully on the map.
  const rect = canvas.getBoundingClientRect();
  const top = renderer.cellTop(fire.x, fire.y);
  const w = ui.grill.offsetWidth;
  const h = ui.grill.offsetHeight;
  const left = Math.min(Math.max(top.x - w / 2, 4), rect.width - w - 4);
  const above = Math.min(Math.max(top.y - h - GRILL_LIFT, 4), rect.height - h - 4);
  ui.grill.style.transform = `translate(${Math.round(rect.left + left)}px, ${Math.round(rect.top + above)}px)`;
}

// ---- Bag and build sheets -----------------------------------------------------------

type SheetKind = 'bag' | 'build' | 'skills' | 'map' | 'hut' | 'store' | 'chart' | 'radio' | 'sail' | 'end' | 'cheats';
let sheetKind: SheetKind = 'bag';
/** Flickers the hearth in the Hut panel while it is open. */
let hearthTimer: number | undefined;
/** The footer button that waits for a second tap before it starts over. */
let confirming: 'island' | 'reset' | 'keep' | null = null;
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
  clearInterval(hearthTimer);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, children: (Node | string)[] = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function row(image: string, title: string, note: Node | string, action?: HTMLElement): HTMLElement {
  return el('div', { className: 'row' }, [
    el('img', { src: image, alt: '' }),
    el('div', { className: 'row-text' }, [el('span', { className: 'row-title', textContent: title }), note]),
    action ?? '',
  ]);
}

function renderSheet(): void {
  const words = t();
  ui.sheetTitle.textContent = {
    bag: words.ui.yourBag, build: words.ui.build, skills: words.ui.skills, map: words.ui.yourMap, hut: game.hutHere()?.kind === 'crew_cabin' ? words.ui.yourCabin : words.ui.yourHut, store: words.ui.store, chart: words.ui.chart, radio: words.ui.radio, sail: words.levels[game.level].sailTitle, end: words.ui.endTitle,
    cheats: 'Cheats',
  }[sheetKind];
  const rows = el('div', { className: 'rows' });
  clearInterval(hearthTimer);
  if (sheetKind === 'hut') {
    renderHut(rows);
  } else if (sheetKind === 'store') {
    renderStore(rows);
  } else if (sheetKind === 'chart') {
    renderChart(rows);
  } else if (sheetKind === 'radio') {
    renderRadio(rows);
  } else if (sheetKind === 'sail' || sheetKind === 'end') {
    renderVoyage(rows);
  } else if (sheetKind === 'skills') {
    renderSkills(rows);
  } else if (sheetKind === 'cheats') {
    renderCheats(rows);
  } else if (sheetKind === 'map') {
    renderMap(rows);
  } else if (sheetKind === 'bag') {
    const entries = game.inventory.entries();
    const dog = game.dog;
    if (dog) {
      const note = el('div', {}, [
        el('span', { className: 'row-note', textContent: words.ui.dogNeeds(Math.round(dog.food), Math.round(dog.water)) }),
      ]);
      if (dog.tired) note.append(el('span', { className: 'row-note locked', textContent: words.ui.dogTired }));
      rows.append(row(icon(dog.tired ? 'dog_rest' : 'dog'), words.ui.yourDog, note));
    }
    rows.append(loadRow());
    if (!entries.length) rows.append(el('p', { className: 'empty', textContent: words.ui.bagEmpty }));
    for (const [id, count] of entries) {
      const food = ITEMS[id].eat;
      const actions = el('div', { className: 'row-actions' });
      if (food) {
        const eat = el('button', { type: 'button', textContent: words.ui.eat });
        eat.addEventListener('click', () => {
          if (game.eat(id)) afterTurn();
          else updateHud();
        });
        actions.append(eat);
      }
      if (dog && game.dogFoodValue(id) > 0) {
        const feed = el('button', { type: 'button', textContent: words.ui.feedDog });
        feed.addEventListener('click', () => {
          if (game.feedDog(id)) afterTurn();
          else updateHud();
        });
        actions.append(feed);
      }
      const note = food
        ? (Object.entries(food) as [NeedId, number][]).map(([need, n]) => words.float(n, { need })).join(' · ')
        : ITEMS[id].tool ? words.ui.tool : ITEMS[id].raw ? words.ui.raw : ITEMS[id].heavy ? `${words.ui.heavy} · ${words.ui.forBuilding}` : words.ui.forBuilding;
      rows.append(row(icon(`item_${id}`), words.itemStack(id, count), el('span', { className: 'row-note', textContent: note }), actions.childElementCount ? actions : undefined));
    }
  } else {
    rows.append(goalCard(), starsCard());
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
      // A building that goes up in trips shows what its site will take, or still needs once it stands.
      const site = 'builds' in recipe ? siteOf(recipe.builds) : null;
      const costs = costList(site ?? (recipe.siteCost ? game.siteCost(id) : game.recipeCost(id)));
      const { description } = words.recipes[id];
      const makes = game.recipeMakes(id);
      const name = makes > 1 ? `${words.recipes[id].name} ×${makes}` : words.recipes[id].name;
      const note = el('div', {}, [el('span', { className: 'row-note', textContent: description }), costs]);
      // Say why when it isn't just missing materials: a skill to learn, a fire to stand by.
      const told = ['needSkill', 'needFire', 'needFurnace', 'oneHut', 'oneStore', 'rigOnly', 'holdMax'];
      if (problem && !site && told.includes(problem.key)) {
        note.append(el('span', { className: 'row-note locked', textContent: words.message(problem) }));
      }
      if (site) note.insertBefore(el('span', { className: 'row-note goal-step', textContent: words.ui.siteLeft }), costs);
      else if (recipe.siteCost) note.append(el('span', { className: 'row-note goal-hint', textContent: words.ui.siteNote }));
      // The map on the hut wall needs the Cartographer skill: say so before the hut is built.
      if (id === 'hut' && !game.hasHut() && !game.has('cartographer')) {
        note.append(el('span', { className: 'row-note goal-hint', textContent: words.ui.hutMapRemark }));
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
    const fresh = confirmButton('island', words.ui.newIsland, () => startNewIsland());
    const lang = el('button', { type: 'button', className: 'wide lang-switch' }, langButtonLabel());
    lang.addEventListener('click', switchLang);
    const reset = confirmButton('reset', words.ui.resetProgress, resetProgress);
    reset.classList.add('wide');
    foot.append(change, fresh, lang, reset);
    if (CHEATS) {
      const open = el('button', { type: 'button', className: 'wide', textContent: 'Cheats (preview only)' });
      open.addEventListener('click', () => openSheet('cheats'));
      foot.append(open);
    }
  }
  ui.sheetBody.replaceChildren(rows, foot);
}

/** How many heavy things the explorer carries, of how many the bag holds. */
function loadRow(): HTMLElement {
  const words = t();
  const full = game.load >= game.loadLimit;
  const note = el('div', {}, [
    el('div', { className: `row-note${full ? ' locked' : ''}`, textContent: words.ui.loadOf(game.load, game.loadLimit) }),
    el('div', { className: 'row-note', textContent: words.ui.loadNote }),
  ]);
  return row(icon('ui_load'), words.ui.load, note);
}

/** What the island's building site of this kind still needs, or null when there is none. */
function siteOf(kind: string): Partial<Record<ItemId, number>> | null {
  for (const [i, obj] of game.objects) {
    if (obj.kind !== kind || !OBJECTS[obj.kind].site) continue;
    const x = i % game.map.width;
    return game.siteLeft(x, (i - x) / game.map.width);
  }
  return null;
}

/**
 * The bag and a container (the store crate or the boat's hold) one under
 * the other, with buttons to move things between them. Moving takes no time.
 */
function renderStock(rows: HTMLElement, title: string, empty: string, stock: Partial<Record<ItemId, number>>,
  put: (id: ItemId, n: number) => boolean, take: (id: ItemId, n: number) => boolean): void {
  const words = t();
  const act = (fn: () => boolean) => () => {
    fn();
    updateHud();
    saveSoon();
  };
  const buttons = (labels: [string, () => boolean][]) => {
    const box = el('div', { className: 'row-actions' });
    for (const [label, fn] of labels) {
      const b = el('button', { type: 'button', textContent: label });
      b.addEventListener('click', act(fn));
      box.append(b);
    }
    return box;
  };
  const heavy = (id: ItemId) => el('span', { className: 'row-note', textContent: ITEMS[id].heavy ? words.ui.heavy : '' });
  rows.append(el('h3', { className: 'path', textContent: title }));
  const kept = (Object.entries(stock) as [ItemId, number][]).filter(([, n]) => n > 0);
  if (!kept.length) rows.append(el('p', { className: 'empty', textContent: empty }));
  for (const [id, count] of kept) {
    rows.append(row(icon(`item_${id}`), words.itemStack(id, count), heavy(id),
      buttons([[words.ui.takeOne, () => take(id, 1)], [words.ui.takeAll, () => take(id, count)]])));
  }
  rows.append(el('h3', { className: 'path', textContent: words.ui.inBag }));
  const bag = game.inventory.entries();
  if (!bag.length) rows.append(el('p', { className: 'empty', textContent: words.ui.bagEmptyShort }));
  for (const [id, count] of bag) {
    rows.append(row(icon(`item_${id}`), words.itemStack(id, count), heavy(id),
      buttons([[words.ui.putOne, () => put(id, 1)], [words.ui.putAll, () => put(id, count)]])));
  }
}

/** The Store panel: the store crate and the bag. */
function renderStore(rows: HTMLElement): void {
  const words = t();
  const store = game.storeNear();
  if (!store) {
    rows.append(el('p', { className: 'empty', textContent: words.ui.notAtStore }));
    return;
  }
  rows.append(loadRow());
  renderStock(rows, words.ui.inStore, words.ui.storeEmpty, store.store ?? {}, (id, n) => game.storeItem(id, n), (id, n) => game.takeItem(id, n));
}

/** The Radio panel: order one supply crate each day; the helicopter drops it on the helipad. */
function renderRadio(rows: HTMLElement): void {
  const words = t();
  if (!game.atRadio) {
    rows.append(el('p', { className: 'empty', textContent: words.message({ key: 'noRadio' }) }));
    return;
  }
  rows.append(el('p', { className: 'empty', textContent: words.ui.radioNote }));
  const problem = game.orderProblem();
  if (problem) rows.append(el('p', { className: 'empty locked', textContent: words.message(problem) }));
  for (const id of ORDER_IDS) {
    const button = el('button', { type: 'button', textContent: words.ui.order, disabled: !!problem, className: problem ? '' : 'primary' });
    button.addEventListener('click', () => {
      if (game.order(id)) saveSoon();
      updateHud();
    });
    const contents = el('div', { className: 'costs' });
    for (const [item, n] of Object.entries(RADIO_ORDERS[id]) as [ItemId, number][]) {
      contents.append(el('span', { className: 'cost', title: words.itemCount(item, n) }, [el('img', { src: icon(`item_${item}`), alt: words.itemCount(item, n) }), `${n}`]));
    }
    rows.append(row(icon('supply_crate'), words.ui.orders[id], contents, button));
  }
}

/** The sea chart: where the fishing boat can sail, then its hold and the bag. */
function renderChart(rows: HTMLElement): void {
  const words = t();
  if (!game.boatNear()) {
    rows.append(el('p', { className: 'empty', textContent: words.message({ key: 'noBoat' }) }));
    return;
  }
  rows.append(el('p', { className: 'empty', textContent: words.ui.chartNote(VOYAGE_DIESEL, game.dieselAboard) }));
  for (const level of LEVELS.map((l) => l.level)) {
    if (level === game.level) continue;
    const problem = game.voyageProblem(level);
    const go = el('button', { type: 'button', textContent: words.ui.sailTo, disabled: !!problem, className: problem ? '' : 'primary' });
    go.addEventListener('click', () => {
      closeSheet();
      if (game.voyage(level)) afterTurn();
      else updateHud();
    });
    const note = el('span', { className: 'row-note', textContent: game.visited(level) ? words.ui.beenThere : words.ui.newPlace });
    rows.append(row(icon(levelDef(level).site), words.ui.islandName(level), note, go));
  }
  rows.append(row(icon('ui_load'), words.ui.hold, el('div', {}, [
    el('div', { className: `row-note${game.holdLoad >= game.holdLimit ? ' locked' : ''}`, textContent: words.ui.loadOf(game.holdLoad, game.holdLimit) }),
    el('div', { className: 'row-note', textContent: words.ui.holdNote }),
  ])));
  rows.append(loadRow());
  renderStock(rows, words.ui.inHold, words.ui.holdEmpty, game.hold, (id, n) => game.loadItem(id, n), (id, n) => game.unloadItem(id, n));
}

/** The Cheats panel of preview builds: each row does one cheat, then closes the panel. */
function renderCheats(rows: HTMLElement): void {
  for (const group of cheats(game)) {
    rows.append(el('p', { className: 'empty', textContent: group.title }));
    for (const cheat of group.cheats) {
      const use = el('button', { type: 'button', className: 'primary', textContent: 'Use' });
      use.addEventListener('click', () => {
        stopAuto();
        if (!cheat.run(game)) return;
        renderer.departure = null;
        closeSheet();
        afterTurn();
        saveNow();
      });
      rows.append(row(icon(cheat.icon), cheat.label, el('span', { className: 'row-note', textContent: cheat.note }), use));
    }
  }
}

/** A button that asks for a second tap before it does something that can't be undone. */
function confirmButton(kind: 'island' | 'reset' | 'keep', label: string, action: () => void): HTMLButtonElement {
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

/** A new island; `make` can carry things over from the old one. */
function startNewIsland(make: () => Game = () => new Game()): void {
  game = make();
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
  const level = words.levels[game.level];
  const goal = game.goal();
  const note = el('div', {});
  const say = (text: string) => note.append(el('span', { className: 'row-note', textContent: text }));
  let sprite: string = levelDef(game.level).site;
  switch (goal.state) {
    case 'missing': say(words.ui.goalMissing); break;
    case 'find': say(level.goalFind); break;
    case 'build':
      sprite = goal.obj;
      note.append(el('span', { className: 'row-note goal-step', textContent: words.ui.goalStep(goal.index, goal.count, goal.stage.id) }));
      note.append(costList(goal.left));
      say(level.goalHint);
      // Where to find a rare material the stage still needs.
      for (const item of Object.keys(goal.left) as ItemId[]) {
        const hint = words.rareHints[item];
        if (hint) note.append(el('span', { className: 'row-note goal-hint', textContent: hint }));
      }
      break;
    case 'ready': sprite = goalDone(); say(level.goalReady); break;
    case 'sailed': sprite = goalDone(); say(level.goalSailed); break;
  }
  if (game.oldIsland) {
    // An island from before the tide islet: offer the new island 1, keeping what the explorer has.
    note.append(el('span', { className: 'row-note goal-hint', textContent: words.ui.oldIsland }));
    const keep = confirmButton('keep', words.ui.keepProgress, () => startNewIsland(() => Game.newIslandKeeping(game)));
    keep.classList.add('keep-progress');
    note.append(keep);
  }
  const card = row(icon(sprite), level.goalTitle, note);
  card.classList.add('goal');
  return card;
}

/** The island's three optional stars, with how far along each one is. */
function starsCard(): HTMLElement {
  const words = t();
  const list = el('ul', { className: 'stars' });
  for (const star of game.starStates()) {
    const progress = star.id === 'explore' ? `${star.have}% / ${star.need}%` : `${star.have}/${star.need}`;
    list.append(
      el('li', { className: star.done ? 'done' : '' }, [
        el('img', { src: icon(star.done ? 'ui_star' : 'ui_star_empty'), alt: '' }),
        el('span', {}, [
          el('b', { textContent: words.stars[star.id].name }),
          ` ${words.stars[star.id].task}`,
          star.done ? '' : el('span', { className: 'star-progress', textContent: ` ${progress}` }),
        ]),
      ]),
    );
  }
  const card = row(icon('ui_star'), words.ui.islandStars, list);
  card.classList.add('stars-card');
  return card;
}

/** The finished goal of this island: the ready boat, the ready beacon (lit once used), the balloon. */
function goalDone(): string {
  const kind = levelDef(game.level).stages.at(-1)!.becomes;
  const done = OBJECTS[kind].done;
  return game.goalUsed && done ? done.icon ?? done.frames[0] : kind;
}

/**
 * Leave on the finished goal. The boat first sails off over the water, and
 * the balloon rises into the sky (not with reduced motion); the last goal
 * ends the game.
 */
function setSail(): void {
  closeSheet();
  const biome = levelDef(game.level).biome;
  const now = performance.now();
  const trip = anim.reducedMotion ? null : biome === 'tropical' ? boatTrip(now) : biome === 'volcano' ? balloonTrip(now) : null;
  const leave = () => {
    renderer.departure = null;
    if (!game.sail()) return;
    afterTurn();
    if (game.goalUsed) openSheet('end');
  };
  if (!trip) return leave();
  stopAuto();
  renderer.departure = trip;
  requestFrame();
  window.setTimeout(leave, DEPART_MS);
}

/** The boat's way out: the straight line from the goal with the least ground before the sea. */
function boatTrip(now: number): Departure | null {
  for (const [i, obj] of game.objects) {
    if (!OBJECTS[obj.kind].goal) continue;
    const x = i % game.map.width;
    const y = (i - x) / game.map.width;
    let best: Departure | null = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      for (let d = 1; d <= 12; d++) {
        if (game.map.get(x + dx * d, y + dy * d) !== Tile.Water) continue;
        if (!best || d + 4 < best.cells) best = { x, y, dx, dy, cells: d + 4, start: now };
        break;
      }
    }
    return best;
  }
  return null;
}

/** The balloon's way up: straight into the sky from the crater rim. */
function balloonTrip(now: number): Departure | null {
  for (const [i, obj] of game.objects) {
    if (!OBJECTS[obj.kind].goal) continue;
    const x = i % game.map.width;
    return { x, y: (i - x) / game.map.width, dx: 0, dy: -1, cells: 10, start: now, balloon: true };
  }
  return null;
}

/** "Set sail?" before leaving, and the end screen after the last island. */
function renderVoyage(rows: HTMLElement): void {
  const words = t();
  const leaving = sheetKind === 'sail';
  rows.append(
    el('div', { className: 'voyage' }, [
      el('img', { src: icon(goalDone()), alt: '' }),
      el('p', { textContent: leaving ? words.levels[game.level].sailText : words.ui.endText }),
      leaving ? '' : el('p', { className: 'end-stars', textContent: words.ui.endStars(game.stars.length, LEVELS.reduce((n, l) => n + l.stars.length, 0)) }),
    ]),
  );
  const foot = el('div', { className: 'sheet-foot' });
  if (leaving) {
    const go = el('button', { type: 'button', className: 'primary', textContent: words.levels[game.level].setSail });
    go.addEventListener('click', setSail);
    const wait = el('button', { type: 'button', textContent: words.ui.notYet });
    wait.addEventListener('click', closeSheet);
    foot.append(wait, go);
  } else {
    const stay = el('button', { type: 'button', textContent: words.ui.stay });
    stay.addEventListener('click', closeSheet);
    const fresh = el('button', { type: 'button', className: 'primary', textContent: words.ui.newIsland });
    fresh.addEventListener('click', () => startNewIsland());
    foot.append(stay, fresh);
  }
  rows.append(foot);
}

// ---- The hut, inside ---------------------------------------------------------------
//
// The rooms stand side by side as one picture; under it, what each room is
// for, and the rooms still to add.

const HEARTH_FRAME_MS = 220;
const bakedRooms = new Map<string, HTMLCanvasElement>();

/** Sprite of a room inside the hut (frame 1 is the hearth's second flame). */
function roomSprite(room: RoomId | 'main', frame = 0): string {
  // The crew cabin on the rig has its own steel rooms.
  const kind = inCabin() ? 'cabin' : 'room';
  if (room === 'main') return game.canReadMap() ? `${kind}_main_map` : `${kind}_main`;
  return room === 'hearth' && frame % 2 ? `${kind}_hearth_2` : `${kind}_${room}`;
}

/** The explorer is in the crew cabin, not a hut. */
function inCabin(): boolean {
  return game.hutHere()?.kind === 'crew_cabin';
}

/** A room's name and description: the cabin's rooms have their own. */
function roomWords(room: RoomId): { name: string; description: string } {
  return (inCabin() ? t().cabinRooms : t().rooms)[room];
}

/** Act from inside the hut: a turn passes, and the panel shows the result. */
function hutAction(act: () => boolean): void {
  // Either way the HUD update draws the panel again.
  if (act()) afterTurn();
  else updateHud();
}

function renderHut(rows: HTMLElement): void {
  const words = t();
  const hut = game.hutHere();
  if (!hut) {
    rows.append(el('p', { className: 'empty', textContent: words.message({ key: 'notInHut' }) }));
    return;
  }
  const built = ROOM_IDS.filter((r) => hut.rooms?.includes(r));
  rows.append(hutScene(['main', ...built]));

  const button = (label: string, action: () => boolean, disabled = false) => {
    const b = el('button', { type: 'button', textContent: label, disabled, className: disabled ? '' : 'primary' });
    b.addEventListener('click', () => hutAction(action));
    return b;
  };
  const note = (...texts: string[]) => el('div', {}, texts.map((text) => el('span', { className: 'row-note', textContent: text })));

  // The bed: a full night's rest.
  const bed = el('button', { type: 'button', textContent: words.ui.sleep, className: 'primary' });
  bed.addEventListener('click', () => {
    closeSheet();
    run({ type: 'sleep' });
  });
  rows.append(row(icon(inCabin() ? 'cabin_main' : 'room_main'), words.ui.bed, note(words.ui.bedNote), bed));

  // The map on the wall, or the empty nail.
  if (game.canReadMap()) {
    const look = el('button', { type: 'button', textContent: words.ui.lookAtMap, className: 'primary' });
    look.addEventListener('click', () => openSheet('map'));
    rows.append(row(icon('ui_map'), words.ui.map, note(words.ui.mapNote), look));
  } else {
    const nail = row(icon('ui_map'), words.ui.map, el('span', { className: 'row-note locked', textContent: words.ui.noMap }));
    nail.classList.add('learned');
    rows.append(nail);
  }

  for (const room of built) {
    const name = roomWords(room).name;
    if (room === 'workshop') {
      const problem = game.buildProblem('rope');
      rows.append(row(icon(roomSprite(room)), name, el('div', {}, [
        el('span', { className: 'row-note', textContent: words.ui.workbenchNote(game.recipeMakes('rope')) }), costList(game.recipeCost('rope')),
      ]), button(words.ui.makeRope, () => game.build('rope'), !!problem)));
    } else if (room === 'hearth') {
      const fish = game.inventory.count('fish');
      rows.append(row(icon(roomSprite(room)), name, el('div', {}, [
        el('span', { className: 'row-note', textContent: words.ui.hearthNote }), costList(game.recipeCost('cooked_fish')),
      ]), button(words.ui.cook, () => game.build('cooked_fish'), fish === 0)));
    } else {
      rows.append(row(icon(roomSprite(room)), name, note(words.ui.barrelNote), button(words.ui.drink, () => game.drinkBarrel(), game.needs.water >= 98)));
    }
  }

  const missing = ROOM_IDS.filter((r) => !built.includes(r));
  if (missing.length) rows.append(el('h3', { className: 'path', textContent: words.ui.addRoom }));
  for (const room of missing) {
    const problem = game.roomProblem(room);
    rows.append(row(icon(roomSprite(room)), roomWords(room).name, el('div', {}, [
      el('span', { className: 'row-note', textContent: roomWords(room).description }), costList(game.roomCost(room)),
    ]), button(words.ui.build, () => game.addRoom(room), !!problem)));
  }
}

/** The rooms of the hut side by side, at the largest whole scale that fits; the hearth flickers. */
function hutScene(rooms: (RoomId | 'main')[]): HTMLElement {
  const dpr = window.devicePixelRatio || 1;
  const first = renderer.sprite(roomSprite('main'))!;
  const width = first.width * rooms.length;
  const room = Math.max(ui.sheetBody.clientWidth, 200) * dpr;
  const scale = Math.max(1, Math.floor(room / width));
  const view = el('canvas', { width: width * scale, height: first.height * scale });
  view.style.width = `${view.width / dpr}px`;
  view.setAttribute('role', 'img');
  view.setAttribute('aria-label', inCabin() ? t().ui.yourCabin : t().ui.yourHut);
  const ctx = view.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const draw = (frame: number) => {
    rooms.forEach((r, i) => {
      const name = roomSprite(r, frame);
      const s = renderer.sprite(name);
      if (!s) return;
      if (!bakedRooms.has(name)) bakedRooms.set(name, bake(s));
      ctx.drawImage(bakedRooms.get(name)!, i * first.width * scale, 0, s.width * scale, s.height * scale);
    });
  };
  draw(0);
  if (rooms.includes('hearth') && !anim.reducedMotion) {
    let frame = 0;
    hearthTimer = window.setInterval(() => draw(++frame), HEARTH_FRAME_MS);
  }
  return el('div', { className: 'hut-scene' }, [view]);
}

/** The Cartographer's map of the explored island, at the largest whole scale that fits. */
function renderMap(rows: HTMLElement): void {
  const words = t();
  const picture = drawMap(game.map, game.objects, game.player, game.bearSpots, game.caves().flatMap((c) => c.entrances));
  const paper = bake(stampSigns(picture, (name) => renderer.sprite(name)));
  const dpr = window.devicePixelRatio || 1;
  const room = Math.max(ui.sheetBody.clientWidth, 200) * dpr;
  const scale = Math.max(1, Math.floor(room / paper.width));
  const view = el('canvas', { width: paper.width * scale, height: paper.height * scale });
  view.style.width = `${view.width / dpr}px`;
  const ctx = view.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(paper, 0, 0, view.width, view.height);
  view.setAttribute('role', 'img');
  view.setAttribute('aria-label', words.ui.yourMap);
  const shown = new Set(picture.markers.map((m) => m.sign));
  const signs = (['you', 'hut', 'fire', 'spring', 'goal', 'cave', 'bear'] as MapSign[])
    .filter((sign) => shown.has(sign))
    .map((sign) => el('li', {}, [el('img', { src: icon(`map_${sign}`), alt: '' }), words.ui.mapSigns[sign]]));
  rows.append(el('div', { className: 'map' }, [view, el('ul', { className: 'map-signs' }, signs)]));
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
    // A panel that opened on the way (walking into the hut) also stops the walk.
    autoTimer = keepGoing && !surprise && !warned && ui.sheet.hidden ? window.setTimeout(tick, delay) : undefined;
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
  if (press || renderer.departure) return;
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
  const target = renderer.tapCell(game, x, y);
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
ui.hut.addEventListener('click', () => run({ type: 'hut' }));
ui.grill.addEventListener('click', grill);
ui.sleep.addEventListener('click', () => {
  stopAuto();
  run({ type: 'sleep' });
});

new ResizeObserver(() => {
  renderer.resize();
  requestFrame();
}).observe(canvas);

applyLang();

if ('serviceWorker' in navigator && import.meta.env.PROD && !PREVIEW) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.warn('Service worker registration failed', err);
    });
  });
}
