import './wiki.css';
import { isLowTide, phase } from '../game/clock';
import { ANIMALS, type AnimalKind } from '../game/defs/animals';
import { ITEMS, type ItemId } from '../game/defs/items';
import { LEVELS } from '../game/defs/levels';
import { OBJECTS, type ObjectKind, type Yield } from '../game/defs/objects';
import { RECIPES, RECIPE_IDS } from '../game/defs/recipes';
import { ROOMS, ROOM_IDS, hutSprite, type RoomId } from '../game/defs/rooms';
import { PATHS, PATH_IDS, SKILLS, xpForPoints } from '../game/defs/skills';
import { BARREL_DRINK, BED_HEAL, CAVE_REST, HEARTH_HEAL, OPEN_REST, WORKSHOP_ROPE } from '../game/game';
import { Tile } from '../game/map';
import { NEED_IDS, tickNeeds, warmthTarget } from '../game/needs';
import { isLang, LANGUAGES, preferredLang, setLang, t, type Lang } from '../i18n';
import { bake, buildSprites } from '../sprites';
import {
  animalsByIsland, gatherRows, itemGroup, itemSources, itemsIn, itemUses, recipeSprite, turnsToHours, yieldRange, type ItemGroup,
} from './data';
import { WIKI, type Ground, type WikiWords } from './text';

// The Island Compendium: a page for players (not developers) that explains
// the mechanics, items and skills, in English and German. Prose comes from
// text.ts; names from the game's texts; every number from the game's data.

/** Shared with the game, so the compendium opens in the language the player chose there. */
const LANG_KEY = 'pwagame.lang';

const sprites = buildSprites();
const spriteUrls = new Map<string, string>();

function readLang(): Lang {
  const param = new URLSearchParams(location.search).get('lang');
  if (isLang(param)) return param;
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // Storage can be blocked; fall back to the browser language.
  }
  return preferredLang(navigator.languages ?? [navigator.language]);
}

function writeLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Not saved; the page still switches.
  }
}

// ---- Small DOM helpers -------------------------------------------------------------

type Child = Node | string | null | undefined | false;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, children: Child[] = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children.filter((c): c is Node | string => !!c));
  return node;
}

/** Text with **bold** parts. */
function rich(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  text.split(/\*\*(.+?)\*\*/).forEach((part, i) => frag.append(i % 2 ? el('strong', undefined, [part]) : part));
  return frag;
}

function para(text: string): HTMLParagraphElement {
  return el('p', undefined, [rich(text)]);
}

/** A sprite as a crisp image at a whole-number scale. */
function sprite(name: string, scale = 2, className = 'sprite'): HTMLImageElement {
  const s = sprites.get(name);
  const img = el('img', className);
  if (!s) return img;
  let url = spriteUrls.get(name);
  if (!url) {
    url = bake(s).toDataURL();
    spriteUrls.set(name, url);
  }
  img.src = url;
  img.alt = '';
  img.width = s.width * scale;
  img.height = s.height * scale;
  return img;
}

function table(head: string[], rows: Child[][], className = ''): HTMLElement {
  const thead = el('thead', undefined, [el('tr', undefined, head.map((h) => el('th', undefined, [h])))]);
  const tbody = el('tbody', undefined, rows.map((r) => el('tr', undefined, r.map((c) => el('td', undefined, [c])))));
  return el('div', 'table-wrap', [el('table', className, [thead, tbody])]);
}

function list(items: string[], ordered = false): HTMLElement {
  return el(ordered ? 'ol' : 'ul', undefined, items.map((i) => el('li', undefined, [rich(i)])));
}

/** An item icon with a number: [coconut] 1–2. */
function chip(item: ItemId, amount: string, note?: string): HTMLElement {
  return el('span', 'chip', [sprite(`item_${item}`, 1.5), el('span', undefined, [W.items[item], ' ', el('b', undefined, [`×${amount}`])]), note && el('small', undefined, [note])]);
}

function cost(c: Partial<Record<ItemId, number>>): HTMLElement {
  return el('span', 'chips', (Object.entries(c) as [ItemId, number][]).map(([item, n]) => chip(item, String(n))));
}

function names(kinds: ObjectKind[]): string {
  return [...new Set(kinds.map((k) => t().objectName(k)))].join(', ');
}

function section(id: string, title: string, children: Child[]): HTMLElement {
  return el('section', 'card', [Object.assign(el('h2', undefined, [title]), { id }), ...children]);
}

// ---- Sections ----------------------------------------------------------------------

let W: WikiWords = WIKI.en;

function startSection(): HTMLElement {
  const s = W.start;
  return section('start', s.title, [para(s.intro), list(s.steps, true)]);
}

function needsSection(): HTMLElement {
  const n = W.needs;
  const cards = el('div', 'needs', NEED_IDS.map((id) => el('div', `need need-${id}`, [
    el('h3', undefined, [t().needs[id]]),
    el('p', undefined, [el('b', 'up', ['▲ ', n.fill]), ' ', n.cards[id].fill]),
    el('p', undefined, [el('b', 'down', ['▼ ', n.drain]), ' ', n.cards[id].drain]),
  ])));
  const val = (v?: number) => (v ? `+${v}` : '–');
  const foods = itemsIn('food').sort((a, b) => (ITEMS[a].eat!.food ?? 0) - (ITEMS[b].eat!.food ?? 0));
  const rows = foods.map((id) => {
    const eat = ITEMS[id].eat!;
    return [
      el('span', 'named', [sprite(`item_${id}`), W.items[id]]),
      el('span', 'bar-num', [bar(eat.food ?? 0, 'food'), val(eat.food)]),
      val(eat.water), val(eat.energy),
      sourceText(id),
    ];
  });
  return section('needs', n.title, [
    para(n.intro), cards,
    el('h3', undefined, [n.foodTitle]), para(n.foodIntro),
    table([n.cols.item, n.cols.food, n.cols.water, n.cols.energy, n.cols.from], rows),
    el('p', 'tip', [rich(n.foodTip)]),
  ]);
}

/** A small bar, 0 to 40 wide, so foods compare at a glance. */
function bar(value: number, need: string): HTMLElement {
  const b = el('span', `mini-bar need-${need}`);
  b.style.width = `${Math.min(100, (value / 40) * 100)}%`;
  return el('span', 'mini-track', [b]);
}

function sourceText(id: ItemId): string {
  const src = itemSources(id);
  const parts = [names(src.objects), ...src.recipes.map((r) => t().recipes[r].name)];
  if (src.fishing) parts.push(W.itemsSection.fishing);
  return parts.filter(Boolean).join(', ');
}

function healthSection(): HTMLElement {
  return section('health', W.health.title, W.health.paras.map(para));
}

function timeSection(): HTMLElement {
  const w = W.time;
  // One cell per hour from 0:00; turn 0 is 8:00.
  const turnAt = (hour: number) => ((hour - 8 + 24) % 24) * 10;
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const row = (label: string, cell: (h: number) => [string, string]) => el('div', 'tl-row', [
    el('span', 'tl-label', [label]),
    el('div', 'tl-cells', hours.map((h) => {
      const [cls, title] = cell(h);
      const c = el('span', `tl-cell ${cls}`);
      c.title = `${h}:00 · ${title}`;
      return c;
    })),
  ]);
  const timeline = el('div', 'timeline', [
    row(w.rowLight, (h) => { const p = phase(turnAt(h)); return [`ph-${p}`, w.phases[p]]; }),
    row(w.rowTide, (h) => (isLowTide(turnAt(h)) ? ['low', w.lowTide] : ['high', w.highTide])),
    row(w.rowBears, (h) => (h >= 7 && h < 19 ? ['bear-sleep', w.bears] : ['bear-awake', ''])),
    el('div', 'tl-row', [el('span', 'tl-label'), el('div', 'tl-cells tl-hours', hours.map((h) => el('span', undefined, [h % 6 === 0 ? `${h}` : ''])))]),
  ]);
  const legend = el('div', 'legend', [
    ...(['night', 'dawn', 'day', 'dusk'] as const).map((p) => el('span', undefined, [el('i', `tl-cell ph-${p}`), w.phases[p]])),
    el('span', undefined, [el('i', 'tl-cell low'), w.lowTide]),
    el('span', undefined, [el('i', 'tl-cell high'), w.highTide]),
    el('span', undefined, [el('i', 'tl-cell bear-sleep'), w.bears]),
  ]);
  return section('time', w.title, [para(w.paras[0]), timeline, legend, para(w.paras[1])]);
}

/** Turns to sleep from Energy 20 up to the place's rest limit with this much shelter, by the game's own rules. */
function sleepTurns(shelter: number, rest: number): number {
  const n = { health: 100, food: 100, water: 100, energy: 20, warmth: 100 };
  let turns = 0;
  while (n.energy < rest && turns < 1000) {
    tickNeeds(n, { sleeping: true, shelter, nearFire: true, daylight: 1 });
    turns++;
  }
  return turns;
}

function warmthSection(): HTMLElement {
  const w = W.warmth;
  // Where you are, its shelter, rest limit and whether a fire is near.
  const places: [Child, number, number, boolean][] = [
    [w.open, 0, OPEN_REST, false],
    [el('span', 'named', [sprite('cave_floor'), w.cave]), 0.5, CAVE_REST, false],
    [el('span', 'named', [sprite('lean_to', 1.5), t().objectName('lean_to')]), OBJECTS.lean_to.shelter!, OBJECTS.lean_to.rest!, false],
    [el('span', 'named', [sprite('hut', 1.5), t().objectName('hut')]), OBJECTS.hut.shelter!, OBJECTS.hut.rest!, false],
    [el('span', 'named', [sprite('campfire'), w.fire]), 0, OPEN_REST, true],
  ];
  const rows = places.map(([label, shelter, rest, nearFire]) => {
    const target = Math.round(warmthTarget({ sleeping: false, shelter, nearFire, daylight: 0 }));
    const hours = Math.round(turnsToHours(sleepTurns(shelter, rest)) * 2) / 2;
    return [label, el('span', 'bar-num', [bar(target * 0.4, 'warmth'), String(target)]), el('span', 'bar-num', [bar(rest * 0.4, 'energy'), String(rest)]), W.hours(hours)];
  });
  return section('warmth', w.title, [
    ...w.paras.map(para),
    table([w.cols.place, w.cols.target, w.cols.rest, w.cols.sleep], rows),
    el('p', 'tip', [rich(w.tip)]),
  ]);
}

function campSection(): HTMLElement {
  const c = W.camp;
  const effect: Record<RoomId, string> = {
    workshop: c.workshop(WORKSHOP_ROPE),
    hearth: c.hearth(BED_HEAL, HEARTH_HEAL),
    barrel: c.barrel(BARREL_DRINK),
  };
  const rows = ROOM_IDS.map((id) => [
    el('span', 'named', [sprite(hutSprite([id]), 1.5), el('strong', undefined, [t().rooms[id].name])]),
    cost(ROOMS[id].cost),
    el('span', undefined, [t().rooms[id].description, el('br'), el('small', undefined, [effect[id]])]),
  ]);
  const inside = el('div', 'hut-inside', ['room_main_map', ...ROOM_IDS.map((id) => `room_${id}`)].map((name) => sprite(name, 3)));
  return section('camp', c.title, [
    el('div', 'camp-head', [sprite(hutSprite(ROOM_IDS), 3), el('div', undefined, c.paras.map(para))]),
    el('h3', undefined, [c.hutCost]),
    cost(RECIPES.hut.cost),
    el('h3', undefined, [c.roomsTitle]),
    para(c.roomsIntro),
    inside,
    table([c.cols.room, c.cols.cost, c.cols.effect], rows),
  ]);
}

function yieldChip(y: Yield): HTMLElement {
  const notes = [y.chance !== undefined && W.gather.chance(y.chance * 100), y.tool && W.gather.withTool(W.items[y.tool])].filter(Boolean);
  return chip(y.item, yieldRange(y), notes.length ? notes.join(', ') : undefined);
}

function islandsText(islands: number[]): string {
  return islands.join(', ');
}

function gatherSection(): HTMLElement {
  const g = W.gather;
  const rows = gatherRows().map((r) => {
    const after = r.gather.after;
    const afterText = 'regrow' in after ? g.regrow(W.hours(turnsToHours(after.regrow))) : 'remove' in after ? g.gone : g.becomes(t().objectName(after.becomes));
    const notes = [
      r.gather.needs && g.needs(W.items[r.gather.needs]),
    ].filter(Boolean) as string[];
    return [
      el('span', 'named', [el('span', 'sprites', r.kinds.map((k) => sprite(k, 1.5))), names(r.kinds)]),
      el('span', 'chips', [...r.gather.yields.map(yieldChip), ...notes.map((n) => el('small', 'note', [n]))]),
      afterText,
      islandsText(r.islands),
    ];
  });
  const water = [
    [el('span', 'named', [sprite('spring'), t().objectName('spring')]), g.waterRows.spring],
    [el('span', 'named', [sprite('river'), g.river]), g.waterRows.river],
    [el('span', 'named', [sprite('water'), g.sea]), g.waterRows.sea],
  ];
  return section('gather', g.title, [
    para(g.intro),
    table([g.cols.what, g.cols.gives, g.cols.after, g.cols.islands], rows, 'gather'),
    el('h3', undefined, [g.water]),
    table([g.cols.what, ''], water),
  ]);
}

function itemsSection(): HTMLElement {
  const w = W.itemsSection;
  const groups: ItemGroup[] = ['food', 'material', 'rare', 'tool'];
  return section('items', w.title, [
    para(w.intro),
    ...groups.map((group) => el('div', 'item-group', [
      el('h3', undefined, [w.groups[group]]),
      el('div', 'item-grid', itemsIn(group).map(itemCard)),
    ])),
  ]);
}

function itemCard(id: ItemId): HTMLElement {
  const w = W.itemsSection;
  const def = ITEMS[id];
  const uses = itemUses(id);
  const usedFor = [...uses.recipes.map((r) => t().recipes[r].name), ...uses.stages.map((s) => t().stages[s])];
  const eat = def.eat && el('span', 'eat', (['food', 'water', 'energy'] as const)
    .filter((k) => def.eat![k])
    .map((k) => el('span', `pill need-${k}`, [`+${def.eat![k]} ${t().needs[k]}`])));
  const from = sourceText(id);
  return el('div', `item item-${itemGroup(id)}`, [
    el('div', 'item-head', [sprite(`item_${id}`, 3), el('h4', undefined, [W.items[id]])]),
    eat,
    from && el('p', undefined, [el('b', undefined, [w.from, ': ']), from]),
    usedFor.length > 0 && el('p', undefined, [el('b', undefined, [w.usedFor, ': ']), usedFor.join(', ')]),
    def.raw && el('p', 'note', [w.rawNote]),
    def.tool && el('p', 'note', [w.toolNote]),
  ]);
}

function buildSection(): HTMLElement {
  const b = W.build;
  const rows = RECIPE_IDS.map((id) => {
    const r = RECIPES[id];
    const notes = [
      r.skill && b.skill(t().skills[r.skill].name),
      r.atFire && b.atFire,
      r.onto && b.onto(t().objectName(r.onto)),
    ].filter(Boolean) as string[];
    return [
      el('span', 'named', [sprite(recipeSprite(id), 'builds' in r ? 1.5 : 2), el('span', undefined, [el('strong', undefined, [t().recipes[id].name]), el('br'), el('small', undefined, [t().recipes[id].description])])]),
      cost(r.cost),
      notes.join(' '),
    ];
  });
  return section('build', b.title, [para(b.intro), table([b.cols.what, b.cols.cost, b.cols.note], rows, 'build'), ...b.paras.map(para)]);
}

function skillsSection(): HTMLElement {
  const s = W.skills;
  const points = Array.from({ length: 8 }, (_, i) => i + 1);
  const pointRow = el('div', 'points', points.map((n) => el('div', 'point', [el('small', undefined, [s.point(n)]), el('strong', undefined, [`${xpForPoints(n)} ${s.xp}`])])));
  const paths = el('div', 'paths', PATH_IDS.map((path) => el('div', 'path', [
    el('div', 'path-head', [sprite(`ui_path_${path}`, 2), el('h3', undefined, [t().paths[path]])]),
    el('p', 'muted', [s.paths[path]]),
    el('ol', 'skill-list', PATHS[path].map((id) => el('li', undefined, [
      el('div', 'skill-head', [el('strong', undefined, [t().skills[id].name]), el('span', 'pill', [s.cost(SKILLS[id].cost)])]),
      el('p', undefined, [t().skills[id].description]),
      s.combo[id] && el('p', 'combo', [rich(s.combo[id]!)]),
    ]))),
  ])));
  return section('skills', s.title, [
    para(s.intro),
    el('h3', undefined, [s.xpTitle]), list(s.xpRows),
    el('h3', undefined, [s.pointsTitle]), para(s.pointsIntro), pointRow,
    el('h3', undefined, [s.pathsTitle]), paths,
  ]);
}

const GROUND: Partial<Record<Tile, Ground>> = {
  [Tile.Sand]: 'sand', [Tile.Grass]: 'grass', [Tile.CaveFloor]: 'cave', [Tile.Scree]: 'scree', [Tile.Snow]: 'snow',
};

function animalCard(kind: AnimalKind): HTMLElement {
  const a = W.animals;
  const def = ANIMALS[kind];
  const lives = def.habitat.map((tile) => W.ground[GROUND[tile]!]).join(', ');
  const facts = [
    a.tempers[def.temper],
    `${a.lives}: ${lives}.`,
    def.wild && a.wild,
    def.damage && a.harm(def.damage, Math.round((def.hitChance ?? 0.5) * 100)),
    def.nocturnal && a.sleeps,
    def.climber && a.climbs,
    def.scaredByDog && a.dog,
  ].filter(Boolean) as string[];
  return el('div', `animal${def.wild ? ' wild' : ''}`, [
    el('div', 'animal-head', [sprite(`animal_${kind}`, 3), def.nocturnal && sprite(`animal_${kind}_sleep`, 3), el('h4', undefined, [t().animalName(kind)])]),
    el('ul', undefined, facts.map((f) => el('li', undefined, [f]))),
  ]);
}

function animalsSection(): HTMLElement {
  const a = W.animals;
  return section('animals', a.title, [
    para(a.intro),
    ...LEVELS.map((l) => el('div', undefined, [el('h3', undefined, [W.island(l.level)]), el('div', 'animal-grid', animalsByIsland(l.level).map(animalCard))])),
    ...a.paras.map(para),
  ]);
}

function dogSection(): HTMLElement {
  return section('dog', W.dog.title, [
    el('div', 'dog-sprites', [sprite('animal_dog', 3), el('span', 'arrow', ['→']), sprite('dog', 3), sprite('dog_rest', 3)]),
    ...W.dog.paras.map(para),
  ]);
}

function islandsSection(): HTMLElement {
  const w = W.islands;
  const parts = LEVELS.map((level) => {
    const text = level.level === 1 ? w.one : w.two;
    const total: Partial<Record<ItemId, number>> = {};
    for (const stage of level.stages) for (const [item, n] of Object.entries(stage.cost) as [ItemId, number][]) total[item] = (total[item] ?? 0) + n;
    const rows: Child[][] = level.stages.map((stage, i) => [
      el('span', 'named', [sprite(stage.becomes, 1.5), `${i + 1}. ${t().stages[stage.id]}`]),
      cost(stage.cost),
    ]);
    rows.push([el('strong', undefined, [w.total]), cost(total)]);
    const stars = el('ul', 'stars', level.stars.map((star) => el('li', undefined, [sprite('ui_star', 1.5), el('strong', undefined, [t().stars[star].name]), ' – ', t().stars[star].task])));
    return el('div', 'island', [
      el('div', 'island-head', [sprite(level.site, 2), el('h3', undefined, [text.title])]),
      ...text.paras.map(para),
      el('h4', undefined, [w.goalTitle]),
      table([w.stageCols.stage, w.stageCols.cost], rows),
      el('h4', undefined, [w.starsTitle]),
      stars,
    ]);
  });
  return section('islands', w.title, [para(w.goalIntro), ...parts, para(w.starsIntro)]);
}

function togetherSection(): HTMLElement {
  const w = W.together;
  return section('together', w.title, [
    para(w.intro),
    el('div', 'chains', w.chains.map((c) => el('div', 'chain', [
      el('h3', undefined, [c.title]),
      el('ol', 'flow', c.steps.map((step) => el('li', undefined, [step]))),
    ]))),
  ]);
}

function tipsSection(): HTMLElement {
  return section('tips', W.tips.title, [list(W.tips.list)]);
}

// ---- Page --------------------------------------------------------------------------

function render(lang: Lang): void {
  setLang(lang);
  W = WIKI[lang];
  document.documentElement.lang = lang;
  document.title = W.title;
  const other: Lang = lang === 'en' ? 'de' : 'en';

  const langButton = el('button', 'lang', [sprite('ui_globe', 1.5), LANGUAGES[other].name]);
  langButton.type = 'button';
  langButton.addEventListener('click', () => {
    writeLang(other);
    const url = new URL(location.href);
    url.searchParams.set('lang', other);
    history.replaceState(null, '', url);
    render(other);
  });
  const play = Object.assign(el('a', 'play', [W.play, ' ▶']), { href: '../' });

  const sections = [
    startSection(), togetherSection(), needsSection(), healthSection(), timeSection(), warmthSection(), campSection(),
    gatherSection(), itemsSection(), buildSection(), skillsSection(), animalsSection(), dogSection(),
    islandsSection(), tipsSection(),
  ];
  const toc = el('nav', 'toc', [
    el('h2', undefined, [W.contents]),
    el('ol', undefined, sections.map((s) => {
      const h = s.querySelector('h2')!;
      return el('li', undefined, [Object.assign(el('a', undefined, [h.textContent ?? '']), { href: `#${h.id}` })]);
    })),
  ]);

  const header = el('header', 'top', [
    el('div', 'top-bar', [play, langButton]),
    el('div', 'hero', [sprite('female_down', 4, 'hero-sprite'), el('div', undefined, [el('h1', undefined, [W.title]), el('p', 'tagline', [W.tagline])]), sprite('male_down', 4, 'hero-sprite')]),
  ]);
  const main = el('main', undefined, [toc, ...sections]);
  const footer = el('footer', undefined, [W.footer]);
  document.getElementById('wiki')!.replaceChildren(header, main, footer);
}

render(readLang());
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
