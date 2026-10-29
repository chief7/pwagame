import { dayNumber, minuteOfDay } from '../game/clock';
import { stageLevel, type StageId } from '../game/defs/levels';
import type { ObjectKind } from '../game/defs/objects';
import type { RoomId } from '../game/defs/rooms';
import type { AnimalWords, ItemWords, ObjectWords, Strings } from './types';

// German needs the gender and case of each noun. A noun is stored once
// (gender, word, optional adjective stem) and phrase() builds the article
// and adjective endings: "die junge Palme", "einen bemoosten Stein".

type Gender = 'm' | 'f' | 'n' | 'pl';
type Case = 'nom' | 'acc' | 'dat';
type Det = 'the' | 'a' | 'your';

interface Noun {
  g: Gender;
  word: string;
  /** Adjective stem in front of the noun: "jung" → "die junge Palme". */
  adj?: string;
}

interface CountNoun extends Noun {
  /** Plural, without article: "Kokosnüsse", "Stück Holz". */
  plural: string;
  /** For floating numbers: [one, many]. */
  short: [string, string];
}

const ARTICLES: Record<Det, Record<Case, Record<Gender, string>>> = {
  the: {
    nom: { m: 'der', f: 'die', n: 'das', pl: 'die' },
    acc: { m: 'den', f: 'die', n: 'das', pl: 'die' },
    dat: { m: 'dem', f: 'der', n: 'dem', pl: 'den' },
  },
  a: {
    nom: { m: 'ein', f: 'eine', n: 'ein', pl: '' },
    acc: { m: 'einen', f: 'eine', n: 'ein', pl: '' },
    dat: { m: 'einem', f: 'einer', n: 'einem', pl: '' },
  },
  your: {
    nom: { m: 'dein', f: 'deine', n: 'dein', pl: 'deine' },
    acc: { m: 'deinen', f: 'deine', n: 'dein', pl: 'deine' },
    dat: { m: 'deinem', f: 'deiner', n: 'deinem', pl: 'deinen' },
  },
};

/** Adjective endings after "der" (weak) and after "ein"/"dein" (mixed; strong in the plural). */
function adjEnding(det: Det, c: Case, g: Gender): string {
  if (c === 'dat') return 'en';
  if (det === 'the') return g === 'pl' || (c === 'acc' && g === 'm') ? 'en' : 'e';
  if (g === 'pl') return det === 'a' ? 'e' : 'en';
  if (g === 'm') return c === 'nom' ? 'er' : 'en';
  return g === 'n' ? 'es' : 'e';
}

function phrase(noun: Noun, c: Case, det: Det, adj = noun.adj): string {
  const article = ARTICLES[det][c][noun.g];
  const words = [article, adj && adj + adjEnding(det, c, noun.g), noun.word];
  return words.filter(Boolean).join(' ');
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** A noun with no article, as a heading: "Junge Palme", "Streunender Hund". */
const name = (noun: Noun) => cap(phrase(noun, 'nom', 'a').replace(/^(ein|eine) /, ''));
/** "in dem" → "im", "in das" → "ins", "an dem" → "am". */
const contract = (s: string) => s.replace(/^(in|an) dem /, (_, p: string) => (p === 'in' ? 'im ' : 'am ')).replace(/^in das /, 'ins ');

const ITEM: ItemWords<CountNoun> = {
  coconut: { g: 'f', word: 'Kokosnuss', plural: 'Kokosnüsse', short: ['Kokosnuss', 'Kokosnüsse'] },
  berries: { g: 'f', word: 'Handvoll Beeren', plural: 'Handvoll Beeren', short: ['Beeren', 'Beeren'] },
  mushroom: { g: 'm', word: 'Pilz', plural: 'Pilze', short: ['Pilz', 'Pilze'] },
  wood: { g: 'n', word: 'Stück Holz', plural: 'Stück Holz', short: ['Holz', 'Holz'] },
  log: { g: 'm', word: 'Holzstamm', plural: 'Holzstämme', short: ['Stamm', 'Stämme'] },
  leaves: { g: 'n', word: 'Blatt', adj: 'groß', plural: 'große Blätter', short: ['Blatt', 'Blätter'] },
  stone: { g: 'm', word: 'Stein', plural: 'Steine', short: ['Stein', 'Steine'] },
  axe: { g: 'f', word: 'Steinaxt', plural: 'Steinäxte', short: ['Axt', 'Äxte'] },
  fish: { g: 'm', word: 'Fisch', plural: 'Fische', short: ['Fisch', 'Fische'] },
  cooked_fish: { g: 'm', word: 'Fisch', adj: 'gebraten', plural: 'gebratene Fische', short: ['Bratfisch', 'Bratfische'] },
  apple: { g: 'm', word: 'Apfel', plural: 'Äpfel', short: ['Apfel', 'Äpfel'] },
  fishing_rod: { g: 'f', word: 'Angelrute', plural: 'Angelruten', short: ['Angel', 'Angeln'] },
  rope: { g: 'n', word: 'Seil', plural: 'Seile', short: ['Seil', 'Seile'] },
  tar: { g: 'm', word: 'Topf Teer', plural: 'Töpfe Teer', short: ['Teer', 'Teer'] },
  resin: { g: 'n', word: 'Stück Harz', plural: 'Stück Harz', short: ['Harz', 'Harz'] },
  sulphur: { g: 'm', word: 'Brocken Schwefel', plural: 'Brocken Schwefel', short: ['Schwefel', 'Schwefel'] },
  glowcap: { g: 'm', word: 'Leuchtpilz', plural: 'Leuchtpilze', short: ['Leuchtpilz', 'Leuchtpilze'] },
  crystal: { g: 'm', word: 'Kristall', plural: 'Kristalle', short: ['Kristall', 'Kristalle'] },
  lantern: { g: 'f', word: 'Kristalllaterne', plural: 'Kristalllaternen', short: ['Laterne', 'Laternen'] },
  scrap: { g: 'n', word: 'Stück Schrott', plural: 'Stück Schrott', short: ['Schrott', 'Schrott'] },
  diesel: { g: 'm', word: 'Kanister Diesel', plural: 'Kanister Diesel', short: ['Diesel', 'Diesel'] },
  mussels: { g: 'f', word: 'Handvoll Muscheln', plural: 'Handvoll Muscheln', short: ['Muscheln', 'Muscheln'] },
  pack_frame: { g: 'f', word: 'Kraxe', plural: 'Kraxen', short: ['Kraxe', 'Kraxen'] },
  pickaxe: { g: 'f', word: 'Spitzhacke', plural: 'Spitzhacken', short: ['Hacke', 'Hacken'] },
  shovel: { g: 'f', word: 'Schaufel', plural: 'Schaufeln', short: ['Schaufel', 'Schaufeln'] },
  crowbar: { g: 'n', word: 'Brecheisen', plural: 'Brecheisen', short: ['Brecheisen', 'Brecheisen'] },
  iron_ore: { g: 'm', word: 'Brocken Eisenerz', plural: 'Brocken Eisenerz', short: ['Erz', 'Erz'] },
  coal: { g: 'm', word: 'Brocken Kohle', plural: 'Brocken Kohle', short: ['Kohle', 'Kohle'] },
  clay: { g: 'm', word: 'Klumpen Lehm', plural: 'Klumpen Lehm', short: ['Lehm', 'Lehm'] },
  spare_part: { g: 'n', word: 'Ersatzteil', plural: 'Ersatzteile', short: ['Teil', 'Teile'] },
  steel_plate: { g: 'f', word: 'Stahlplatte', plural: 'Stahlplatten', short: ['Platte', 'Platten'] },
  vegetables: { g: 'm', word: 'Korb Gemüse', plural: 'Körbe Gemüse', short: ['Gemüse', 'Gemüse'] },
};

/** The noun, and what gathering from it looks like ("Du schüttelst die Palme"). */
const OBJECT: ObjectWords<Noun & { gather?: string }> = {
  palm_tall: { g: 'f', word: 'Palme', gather: 'Du schüttelst die Palme' },
  palm_leaning: { g: 'f', word: 'Palme', gather: 'Du schüttelst die Palme' },
  palm_young: { g: 'f', word: 'Palme', adj: 'jung', gather: 'Du pflückst ein paar Blätter' },
  tree_broadleaf: { g: 'm', word: 'Baum', gather: 'Du sammelst heruntergefallene Äste' },
  tree_pine: { g: 'f', word: 'Kiefer', gather: 'Du sammelst heruntergefallene Äste' },
  bush: { g: 'm', word: 'Busch', gather: 'Du pflückst ein paar Blätter' },
  berry_bush: { g: 'm', word: 'Beerenbusch', gather: 'Du pflückst Beeren' },
  mushroom: { g: 'pl', word: 'Pilze', gather: 'Du pflückst die Pilze' },
  stone_boulder: { g: 'm', word: 'Felsbrocken' },
  stone_mossy: { g: 'm', word: 'Stein', adj: 'bemoost' },
  stone_pebbles: { g: 'pl', word: 'Kiesel', gather: 'Du hebst Steine auf' },
  stalagmite: { g: 'm', word: 'Stalagmit' },
  log: { g: 'm', word: 'Baumstamm', gather: 'Du zerbrichst den Baumstamm' },
  log_pile: { g: 'm', word: 'Holzstapel', gather: 'Du nimmst Holz vom Stapel' },
  log_driftwood: { g: 'n', word: 'Treibholz', gather: 'Du hebst das Treibholz auf' },
  chest_closed: { g: 'f', word: 'Truhe', gather: 'Du öffnest die Truhe' },
  chest_open: { g: 'f', word: 'Truhe', adj: 'leer' },
  spring: { g: 'f', word: 'Quelle' },
  campfire: { g: 'n', word: 'Lagerfeuer' },
  lean_to: { g: 'm', word: 'Unterstand' },
  hut: { g: 'f', word: 'Hütte' },
  hut_site: { g: 'n', word: 'Hüttengerüst' },
  store_crate: { g: 'f', word: 'Vorratskiste' },
  bramble: { g: 'n', word: 'Dornengestrüpp', gather: 'Du schlägst dich durch das Dornengestrüpp' },
  bridge_ns: { g: 'f', word: 'Brücke' },
  bridge_ew: { g: 'f', word: 'Brücke' },
  boat_wreck: { g: 'n', word: 'Bootswrack', adj: 'alt' },
  boat_hull: { g: 'n', word: 'Boot' },
  boat_mast: { g: 'n', word: 'Boot' },
  boat_sail: { g: 'n', word: 'Boot' },
  boat_ready: { g: 'n', word: 'Boot' },
  tree_spruce: { g: 'f', word: 'Fichte', gather: 'Du sammelst heruntergefallene Äste' },
  tree_spruce_snow: { g: 'f', word: 'Fichte', adj: 'verschneit', gather: 'Du schüttelst den Schnee ab und sammelst Äste' },
  tree_birch: { g: 'f', word: 'Birke', gather: 'Du sammelst heruntergefallene Äste' },
  tree_apple: { g: 'm', word: 'Apfelbaum', gather: 'Du pflückst Äpfel' },
  fern: { g: 'm', word: 'Farn', gather: 'Du pflückst ein paar Farnblätter' },
  beacon_site: { g: 'm', word: 'Steinkreis', adj: 'alt' },
  beacon_base: { g: 'n', word: 'Leuchtfeuer' },
  beacon_pyre: { g: 'n', word: 'Leuchtfeuer' },
  beacon_ready: { g: 'n', word: 'Leuchtfeuer' },
  ledge: { g: 'f', word: 'Felsstufe' },
  ledge_ladder: { g: 'f', word: 'Leiter' },
  ice_wall: { g: 'f', word: 'Eiswand' },
  ice_wall_rope: { g: 'n', word: 'Kletterseil' },
  barrel: { g: 'n', word: 'Teerfass', adj: 'alt', gather: 'Du schöpfst Teer aus dem alten Fass' },
  barrel_empty: { g: 'n', word: 'Fass', adj: 'leer' },
  sandbar_ns: { g: 'f', word: 'Sandbank' },
  sandbar_ew: { g: 'f', word: 'Sandbank' },
  glowcap: { g: 'pl', word: 'Leuchtpilze', gather: 'Du pflückst die leuchtenden Pilze' },
  crystal_cluster: { g: 'f', word: 'Kristallgruppe', gather: 'Du brichst ein paar Kristalle ab' },
  lava_stones_ns: { g: 'pl', word: 'Trittsteine' },
  lava_stones_ew: { g: 'pl', word: 'Trittsteine' },
  steam_vent: { g: 'n', word: 'Dampfloch', gather: 'Du kratzt gelben Schwefel vom Dampfloch' },
  hot_spring: { g: 'f', word: 'Quelle', adj: 'heiß' },
  balloon_site: { g: 'm', word: 'Ballon', adj: 'alt' },
  balloon_basket: { g: 'm', word: 'Ballon' },
  balloon_envelope: { g: 'm', word: 'Ballon' },
  balloon_ready: { g: 'm', word: 'Ballon' },
  gangway_ns: { g: 'm', word: 'Steg' },
  gangway_ew: { g: 'm', word: 'Steg' },
  gangway_end_n: { g: 'm', word: 'Steg', adj: 'kaputt' },
  gangway_end_s: { g: 'm', word: 'Steg', adj: 'kaputt' },
  gangway_end_e: { g: 'm', word: 'Steg', adj: 'kaputt' },
  gangway_end_w: { g: 'm', word: 'Steg', adj: 'kaputt' },
  scrap_pile: { g: 'm', word: 'Schrotthaufen', gather: 'Du wühlst im Schrott' },
  rig_container: { g: 'm', word: 'Container', adj: 'rostig' },
  diesel_drums: { g: 'pl', word: 'Ölfässer', adj: 'alt', gather: 'Du füllst Diesel aus den alten Fässern ab' },
  diesel_drums_empty: { g: 'pl', word: 'Fässer', adj: 'leer' },
  pallet: { g: 'f', word: 'Holzpalette', gather: 'Du zerlegst die Palette' },
  old_net: { g: 'n', word: 'Fischernetz', adj: 'alt', gather: 'Du ziehst Seil aus dem alten Netz' },
  water_tank: { g: 'm', word: 'Regenwassertank' },
  mussel_bed: { g: 'f', word: 'Muschelbank', gather: 'Du pflückst Muscheln vom Bein der Bohrinsel' },
  life_ring: { g: 'm', word: 'Rettungsring' },
  derrick: { g: 'm', word: 'Bohrturm', adj: 'alt' },
  crane: { g: 'm', word: 'Kran' },
  crew_cabin: { g: 'f', word: 'Mannschaftskabine' },
  balloon_crashed: { g: 'm', word: 'Ballon', adj: 'abgestürzt' },
  radio_hut: { g: 'm', word: 'Funkraum' },
  radio_aerial: { g: 'm', word: 'Funkraum' },
  radio_power: { g: 'm', word: 'Funkraum' },
  radio_ready: { g: 'm', word: 'Funkraum' },
  derrick_working: { g: 'm', word: 'Bohrturm', gather: 'Du füllst Diesel aus der Pumpe ab' },
  fishing_boat_wreck: { g: 'n', word: 'Fischerboot', adj: 'alt' },
  fishing_boat: { g: 'n', word: 'Fischerboot' },
  supply_crate: { g: 'f', word: 'Versorgungskiste' },
  platform_deck: { g: 'f', word: 'Plattform' },
  storage_container_0: { g: 'm', word: 'Lagercontainer' },
  storage_container_1: { g: 'm', word: 'Lagercontainer' },
  storage_container_2: { g: 'm', word: 'Lagercontainer' },
  storage_container_3: { g: 'm', word: 'Lagercontainer' },
  storage_container_4: { g: 'm', word: 'Lagercontainer' },
  storage_container_5: { g: 'm', word: 'Lagercontainer' },
  storage_container_back: { g: 'm', word: 'Lagercontainer' },
  ore_vein: { g: 'f', word: 'Erzader', gather: 'Du hackst Erz aus dem Fels' },
  clay_bank: { g: 'f', word: 'Lehmbank', gather: 'Du gräbst nassen Lehm aus' },
  sealed_crate: { g: 'f', word: 'Kiste', adj: 'versiegelt', gather: 'Du brichst die Kiste auf' },
  furnace: { g: 'm', word: 'Schmelzofen' },
  greenhouse: { g: 'n', word: 'Gewächshaus', gather: 'Du erntest Gemüse' },
  water_maker: { g: 'f', word: 'Wasseranlage' },
  fish_trap: { g: 'f', word: 'Fischreuse', gather: 'Du ziehst die Fischreuse hoch' },
  hold_upgrade: { g: 'm', word: 'Laderaum', adj: 'größer' },
};

const ANIMAL: AnimalWords<Noun & { shoo: string; hurt?: string; alert?: string }> = {
  crab: { g: 'f', word: 'Krabbe', shoo: 'Du verscheuchst die Krabbe. Sie krabbelt seitwärts davon.' },
  turtle: { g: 'f', word: 'Schildkröte', shoo: 'Die Schildkröte blinzelt dich langsam an.' },
  monkey: { g: 'm', word: 'Affe', shoo: 'Du verscheuchst den Affen. Er schnattert und flitzt davon.' },
  piglet: { g: 'n', word: 'Ferkel', shoo: 'Das Ferkel quiekt und trabt davon.' },
  bat: { g: 'f', word: 'Fledermaus', shoo: 'Die Fledermaus flattert an deinem Ohr vorbei.' },
  boar: {
    g: 'n', word: 'Wildschwein', shoo: 'Du fuchtelst mit den Armen. Das Wildschwein schnaubt und trabt davon.',
    hurt: 'Uff! Das Wildschwein rempelt dich an und wirft dich um.', alert: 'Ein Wildschwein schnaubt und rennt auf dich zu!',
  },
  snake: { g: 'f', word: 'Schlange', shoo: 'Die Schlange zischt und gleitet davon.', hurt: 'Autsch! Die Schlange beißt dich.' },
  wasps: {
    g: 'pl', word: 'Wespen', shoo: 'Du schlägst nach den Wespen. Sie summen davon.',
    hurt: 'Autsch! Eine Wespe sticht dich.', alert: 'Bzzz! Wespen fliegen dir nach. Lauf weg vom Gras!',
  },
  bear: {
    g: 'm', word: 'Höhlenbär', shoo: 'Der Höhlenbär brummt und tapst davon.',
    hurt: 'Der Höhlenbär haut nach dir!', alert: 'Ein Höhlenbär brummt und tapst dir nach! Verlass seine Höhle.',
  },
  rabbit: { g: 'm', word: 'Hase', shoo: 'Der Hase zuckt mit der Nase und hoppelt davon.' },
  squirrel: { g: 'n', word: 'Eichhörnchen', shoo: 'Das Eichhörnchen schimpft und flitzt einen Baum hinauf.' },
  dog: { g: 'm', word: 'Hund', adj: 'streunend', shoo: 'Der Hund wedelt mit dem Schwanz.' },
  goat: {
    g: 'f', word: 'Bergziege', shoo: 'Du fuchtelst mit den Armen. Die Ziege meckert und springt über die Felsen davon.',
    hurt: 'Bums! Die Bergziege stößt dich mit den Hörnern.', alert: 'Eine Bergziege senkt die Hörner und rennt auf dich zu!',
  },
  lizard: { g: 'f', word: 'Eidechse', shoo: 'Die Eidechse zuckt mit dem Schwanz und huscht davon.' },
  gull: { g: 'f', word: 'Möwe', shoo: 'Die Möwe kreischt und flattert den Strand entlang davon.' },
  scorpion: {
    g: 'm', word: 'Skorpion', shoo: 'Der Skorpion hebt den Schwanz und krabbelt davon.', hurt: 'Autsch! Der Skorpion sticht dich.',
  },
};

const NEEDS = { health: 'Leben', food: 'Essen', water: 'Wasser', energy: 'Energie', warmth: 'Wärme' };

const obj = (kind: ObjectKind, c: Case, det: Det) => phrase(OBJECT[kind], c, det);

/** The rooms of the crew cabin on the oil rig. */
const CABIN_ROOM: Record<RoomId, Noun> = {
  workshop: { g: 'f', word: 'Werkbank' },
  hearth: { g: 'm', word: 'Ofen' },
  barrel: { g: 'm', word: 'Wassertank' },
};

const ROOM: Record<RoomId, Noun> = {
  workshop: { g: 'f', word: 'Werkstatt' },
  hearth: { g: 'm', word: 'Kamin' },
  barrel: { g: 'f', word: 'Regentonne' },
};

/** In the accusative, as items always are in messages: "eine Kokosnuss", "3 große Blätter". */
function itemCount(id: keyof typeof ITEM, count: number): string {
  return count === 1 ? phrase(ITEM[id], 'acc', 'a') : `${count} ${ITEM[id].plural}`;
}

/** "20 Stück Holz und 6 Steine". */
function itemList(items: [keyof typeof ITEM, number][]): string {
  const parts = items.map(([id, n]) => itemCount(id, n));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} und ${parts.at(-1)}` : parts.join('');
}

/** The goal of a stage's island: das Boot, das Leuchtfeuer, der Ballon, der Funkraum. */
function goalNoun(stage: StageId): Noun {
  return ({ 1: { g: 'n', word: 'Boot' }, 2: { g: 'n', word: 'Leuchtfeuer' }, 3: { g: 'm', word: 'Ballon' }, 4: { g: 'm', word: 'Funkraum' } } as const)[stageLevel(stage)];
}

/** "das Boot", "dem Ballon". */
function goalName(stage: StageId, c: Case): string {
  return phrase(goalNoun(stage), c, 'the');
}

/** "17:00". */
function time(turn: number): string {
  const m = Math.floor(minuteOfDay(turn));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

function clock(turn: number): string {
  return `Tag ${dayNumber(turn)} · ${time(turn)}`;
}

export const de: Strings = {
  lang: 'de',
  name: 'Deutsch',
  ui: {
    bag: 'Tasche',
    build: 'Bauen',
    sleep: 'Schlafen',
    close: 'Schließen',
    chooseExplorer: 'Wähle deine Figur',
    female: 'Mädchen',
    male: 'Junge',
    yourBag: 'Deine Tasche',
    bagEmpty: 'Deine Tasche ist leer. Lauf gegen Pflanzen, Baumstämme und Steine, um Dinge zu sammeln.',
    eat: 'Essen',
    forBuilding: 'Zum Bauen',
    tool: 'Ein Werkzeug. Behalte es in deiner Tasche.',
    buildHint: 'Gebäude entstehen vor dir.',
    changeExplorer: 'Figur wechseln',
    newIsland: 'Neue Insel',
    confirmNewIsland: 'Zum Bestätigen noch mal tippen',
    resetProgress: 'Gesamten Fortschritt löschen',
    byFire: 'Am Feuer',
    grill: (n) => `Fisch grillen (noch ${n})`,
    inCave: 'In einer Höhle',
    inShelter: (kind) => `In ${obj(kind, 'dat', 'your')}`,
    dawn: 'Morgengrauen',
    dusk: 'Abend',
    night: 'Nacht',
    lowTide: 'Ebbe',
    highTide: 'Flut',
    skills: 'Talente',
    learn: 'Lernen',
    learned: 'Gelernt',
    raw: 'Roh. Brate ihn am Lagerfeuer.',
    skillsHint: 'Sammle, baue und angle, um EP zu bekommen. Mit EP bekommst du Talentpunkte, mit denen du Talente lernst.',
    skillPoints: (n) => `${n} ${n === 1 ? 'Talentpunkt' : 'Talentpunkte'}`,
    xpToNext: (have, need) => `EP ${have} / ${need} bis zum nächsten Punkt`,
    skillCost: (n) => `Kostet ${n} ${n === 1 ? 'Punkt' : 'Punkte'}`,
    goalMissing: 'Auf dieser Insel gibt es kein Boot. Starte in deiner Tasche eine neue Insel, um eins zu bekommen.',
    goalStep: (index, count, stage) => `Schritt ${index + 1} von ${count}: ${de.stages[stage]}`,
    notYet: 'Noch nicht',
    endTitle: 'Geschafft!',
    endText: 'Eine Stimme antwortet im Funkgerät! Hilfe ist unterwegs. Du kannst auf der Bohrinsel bleiben: Repariere den Bohrturm und das Fischerboot und fahr zu den Inseln. Oder starte eine neue Insel.',
    stay: 'Hierbleiben',
    yourDog: 'Dein Hund',
    dogNeeds: (food, water) => `Essen ${food} · Wasser ${water}`,
    dogTired: 'Müde. Gib ihm Essen und geh an Wasser vorbei, damit er trinken kann.',
    map: 'Karte',
    yourMap: 'Deine Karte',
    mapSigns: { you: 'Du', hut: 'Hütte', fire: 'Lagerfeuer', spring: 'Quelle', goal: 'Ziel', bear: 'Bären', cave: 'Höhle' },
    feedDog: 'Füttern',
    islandStars: 'Inselsterne',
    endStars: (n, of) => `Sterne: ${n} von ${of}`,
    oldIsland: 'Deine Insel ist aus einer älteren Version. Eine neue Insel 1 hat eine kleine Gezeiteninsel mit mehr zu entdecken. Du behältst deine Tasche, EP, Talente und deinen Hund.',
    keepProgress: 'Neue Insel, Fortschritt behalten',
    hut: 'Hütte',
    yourHut: 'Deine Hütte',
    yourCabin: 'Deine Mannschaftskabine',
    bed: 'Bett',
    bedNote: 'Hier erholst du dich ganz. Gesundheit kommt schneller zurück.',
    lookAtMap: 'Ansehen',
    mapNote: 'Deine Karte von allem, was du erkundet hast.',
    noMap: 'Ein leerer Nagel. Lerne das Talent Kartograf, dann hängt hier eine Karte der Insel.',
    hutMapRemark: 'Lerne das Talent Kartograf, dann hängt an ihrer Wand eine Karte der Insel.',
    workbenchNote: (n) => `Hier drehst du ${n} ${n === 1 ? 'Seil' : 'Seile'} aus 2 großen Blättern.`,
    makeRope: 'Seil drehen',
    hearthNote: 'Hier brätst du Fisch. Im Schlaf kommt Gesundheit schneller zurück.',
    cook: 'Braten',
    barrelNote: 'Frisches Regenwasser vom Dach. +35 Wasser.',
    drink: 'Trinken',
    addRoom: 'Raum anbauen',
    load: 'Last',
    loadOf: (have, limit) => `${have} / ${limit} schwere Dinge`,
    loadNote: 'Holz, Holzstämme, Steine, Schrott und Diesel sind schwer. Den Rest bewahrst du in einer Vorratskiste auf.',
    store: 'Vorratskiste',
    notAtStore: 'Stell dich neben deine Vorratskiste.',
    inBag: 'In deiner Tasche',
    inStore: 'In der Vorratskiste',
    bagEmptyShort: 'Deine Tasche ist leer.',
    storeEmpty: 'Die Vorratskiste ist leer.',
    container: 'Lagercontainer',
    inContainer: 'Im Lagercontainer',
    containerEmpty: 'Der Lagercontainer ist leer.',
    heavy: 'Schwer',
    putOne: '1 hineinlegen',
    putAll: 'Alle hineinlegen',
    takeOne: '1 nehmen',
    takeAll: 'Alle nehmen',
    siteNote: 'Zuerst baust du das Gerüst. Dann lauf dagegen, um ihm diese Dinge zu geben, so oft du willst.',
    siteLeft: 'Das Gerüst braucht noch:',
    chart: 'Seekarte',
    chartNote: (diesel, aboard) => `Eine Fahrt dauert 6 Stunden und braucht ${diesel} Diesel. Du hast ${aboard} Diesel in Tasche und Laderaum.`,
    islandName: (level) => ({ 1: 'Insel 1: die Tropeninsel', 2: 'Insel 2: Kiefernkamm', 3: 'Insel 3: Glutinsel', 4: 'Die Bohrinsel' })[level],
    sailTo: 'Losfahren',
    beenThere: 'Hier warst du schon. Alles ist so, wie du es verlassen hast.',
    newPlace: 'Hier warst du noch nicht mit dem Boot. Eine neue Insel wartet.',
    hold: 'Laderaum',
    holdNote: 'Der Laderaum fährt mit dem Boot. Schwere Dinge zählen, der Rest nicht.',
    inHold: 'Im Laderaum',
    holdEmpty: 'Der Laderaum ist leer.',
    radio: 'Funkgerät',
    radioNote: 'Bestell jeden Tag eine Kiste. Dann geh zum Landeplatz: Ein Hubschrauber kommt und wirft sie dort ab.',
    order: 'Bestellen',
    orders: { food: 'Essenskiste', build: 'Baukiste', fuel: 'Treibstoffkiste' },
  },
  rooms: {
    workshop: { name: 'Werkstatt', description: 'Eine Werkbank. Seile, die du in der Hütte drehst, geben 1 mehr.' },
    hearth: { name: 'Kamin', description: 'Ein Feuer drinnen. Brate Fisch zu Hause und werde im Schlaf schneller gesund.' },
    barrel: { name: 'Regentonne', description: 'Fängt Regen vom Dach auf. So kannst du zu Hause trinken.' },
  },
  cabinRooms: {
    workshop: { name: 'Werkbank', description: 'Eine Stahlbank mit Schraubstock. Seile, die du in der Kabine drehst, geben 1 mehr.' },
    hearth: { name: 'Ofen', description: 'Ein eiserner Ofen. Brate Fisch zu Hause und werde im Schlaf schneller gesund.' },
    barrel: { name: 'Wassertank', description: 'Fängt Regen vom Kabinendach auf. So kannst du zu Hause trinken.' },
  },
  stars: {
    chests: { name: 'Schatzsucher', task: 'Öffne jede Truhe auf dieser Insel.' },
    fish: { name: 'Angler', task: 'Fang 5 Fische auf dieser Insel.' },
    explore: { name: 'Entdecker', task: 'Erkunde 3/4 dieser Insel.' },
    safe: { name: 'Gesund und munter', task: 'Halte 3 Tage am Stück durch, ohne ohnmächtig zu werden.' },
  },
  rareHints: {
    tar: 'Teer: Alte Fässer stehen auf einer kleinen Insel vor der Küste. Geh bei Ebbe über die Sandbank (5–11 und 17–23 Uhr).',
    resin: 'Harz: Schüttle die verschneiten Fichten hoch oben am Berg.',
    sulphur: 'Schwefel: Kratz ihn von den dampfenden Löchern nahe am Krater.',
    diesel: 'Diesel: Füll ihn aus den alten roten Ölfässern auf den Plattformen ab.',
  },
  levels: {
    1: {
      goalTitle: 'Inselziel: Repariere das Boot',
      goalFind: 'Finde das alte Boot. Es liegt an einem Strand auf der anderen Seite der Insel.',
      goalHint: 'Lauf gegen das Boot, um ihm zu geben, was du dabeihast.',
      goalReady: 'Das Boot ist fertig! Lauf dagegen, um loszusegeln.',
      goalSailed: 'Du bist von dieser Insel weggesegelt.',
      sailTitle: 'Lossegeln?',
      sailText: 'Das Boot ist fertig. Willst du zu einer neuen Insel segeln? Deine Tasche und deine Talente nimmst du mit.',
      setSail: 'Lossegeln!',
    },
    2: {
      goalTitle: 'Inselziel: Zünde ein Leuchtfeuer an',
      goalFind: 'Steig auf den Berg. Finde den alten Steinkreis auf dem verschneiten Gipfel.',
      goalHint: 'Lauf gegen das Leuchtfeuer, um ihm zu geben, was du dabeihast.',
      goalReady: 'Das Leuchtfeuer ist fertig! Lauf dagegen, um es anzuzünden.',
      goalSailed: 'Ein Schiff hat dich von dieser Insel abgeholt.',
      sailTitle: 'Leuchtfeuer anzünden?',
      sailText: 'Das Leuchtfeuer ist fertig. Willst du es anzünden, damit ein Schiff dich sieht?',
      setSail: 'Anzünden!',
    },
    3: {
      goalTitle: 'Inselziel: Flieg mit dem Ballon',
      goalFind: 'Steig auf den Vulkan. Ein alter Ballon liegt am Kraterrand.',
      goalHint: 'Lauf gegen den Ballon, um ihm zu geben, was du dabeihast.',
      goalReady: 'Der Ballon ist fertig! Lauf dagegen, um loszufliegen.',
      goalSailed: 'Du bist mit dem Ballon von dieser Insel weggeflogen.',
      sailTitle: 'Losfliegen?',
      sailText: 'Der Ballon ist fertig. Willst du über das Meer davonfliegen?',
      setSail: 'Losfliegen!',
    },
    4: {
      goalTitle: 'Ziel: Repariere das Funkgerät',
      goalFind: 'Finde den Funkraum. Er steht auf einer fernen Plattform der Bohrinsel. Repariere die kaputten Stege mit Schrott, um hinzukommen.',
      goalHint: 'Lauf gegen den Funkraum, um ihm zu geben, was du dabeihast.',
      goalReady: 'Das Funkgerät geht! Lauf gegen den Funkraum, um Hilfe zu rufen.',
      goalSailed: 'Du hast über Funk Hilfe gerufen.',
      sailTitle: 'Hilfe rufen?',
      sailText: 'Das Funkgerät geht. Willst du Hilfe rufen?',
      setSail: 'Rufen!',
    },
  },
  clock,
  needs: NEEDS,
  recipes: {
    campfire: { name: 'Lagerfeuer', description: 'Hält dich warm und macht die Nacht hell.' },
    lean_to: { name: 'Unterstand', description: 'Ein einfacher Unterschlupf für unterwegs. Wärmere Nächte, aber nur das Bett in einer Hütte gibt volle Erholung.' },
    hut: { name: 'Hütte', description: 'Dein Lager. Ein Bett für volle Erholung, und drinnen baust du neue Räume an. Eine pro Insel.' },
    store_crate: { name: 'Vorratskiste', description: 'Bewahrt auf, was du nicht trägst. Lauf dagegen, um Dinge hineinzulegen oder herauszunehmen. Eine pro Insel. 6 Holzstämme gehen auch statt Holz.' },
    pack_frame: { name: 'Kraxe', description: 'Ein Holzgestell für den Rücken. Du trägst 15 schwere Dinge mehr.' },
    rope: { name: 'Seil', description: 'Aus großen Blättern gedreht. Für das Inselziel brauchst du Seile.' },
    axe: { name: 'Steinaxt', description: 'Schlägt Holzstämme von Bäumen und einen Weg durch Dornengestrüpp.' },
    bridge: { name: 'Brücke', description: 'Führt über einen Fluss, bis zu 3 Schritte breit. Schau zum Wasser, um sie zu bauen.' },
    lava_stones: { name: 'Trittsteine', description: 'Flache Steine über den Lavastrom, bis zu 3 Schritte. Schau zur Lava, um sie zu legen.' },
    fishing_rod: { name: 'Angelrute', description: 'Lauf damit ins Meer, um Fische zu fangen.' },
    cooked_fish: { name: 'Fisch braten', description: 'Stell dich neben ein Lagerfeuer. Gebratener Fisch ist leckeres Essen.' },
    ladder: { name: 'Leiter', description: 'Bringt dich über eine Felsstufe in den Bergen. Stell dich neben die Stufe, um sie zu bauen.' },
    climbing_rope: { name: 'Kletterseil', description: 'Bringt dich über eine Eiswand nahe am Gipfel. Stell dich neben die Wand, um es zu bauen.' },
    lantern: { name: 'Kristalllaterne', description: 'Höhlenkristalle leuchten in einem kleinen Holzrahmen. Du siehst weiter in dunklen Höhlen und in der Nacht.' },
    pickaxe: { name: 'Spitzhacke', description: 'Hackt Eisenerz und Kohle aus den Erzadern auf dem Kiefernkamm (Insel 2).' },
    shovel: { name: 'Schaufel', description: 'Gräbt Lehm aus den Lehmbänken am Fluss von Insel 1.' },
    crowbar: { name: 'Brecheisen', description: 'Öffnet die versiegelten Kisten auf den Inseln 1 bis 3. Darin sind Ersatzteile.' },
    furnace: { name: 'Schmelzofen', description: 'Ein Ofen aus Lehm auf der Bohrinsel. Stell dich daneben, um Stahlplatten zu schmelzen.' },
    smelt: { name: 'Stahl schmelzen', description: 'Stell dich neben den Schmelzofen. 2 Eisenerz und 1 Kohle geben eine Stahlplatte.' },
    greenhouse: { name: 'Gewächshaus', description: 'Hier wächst Gemüse auf der Bohrinsel. Lauf dagegen, um es zu ernten; es wächst nach.' },
    water_maker: { name: 'Wasseranlage', description: 'Macht Trinkwasser aus dem Meer. Trink so viel du willst.' },
    fish_trap: { name: 'Fischreuse', description: 'Ein Käfig im Meer, der Fische fängt. Stell dich auf ein Deck und schau aufs Meer, um sie zu bauen.' },
    hold_upgrade: { name: 'Größerer Laderaum', description: 'Stell dich neben das Fischerboot. Sein Laderaum trägt 30 schwere Dinge mehr (zweimal).' },
    platform: { name: 'Plattform', description: 'Legt ein neues Stück Deck an den Rand der Mannschaftsplattform. Stell dich an den Rand und schau aufs Meer.' },
    rain_tank: { name: 'Regentank', description: 'Ein Stahltank, der Regenwasser auffängt. Trink daraus.' },
    gangway: { name: 'Steg reparieren', description: 'Repariert einen kaputten Steg der Bohrinsel mit Schrott. Stell dich neben ein kaputtes Ende, um ihn zu bauen.' },
  },
  paths: { build: 'Bauen', explorer: 'Entdecker', improve: 'Verbessern' },
  objectName: (kind) => name(OBJECT[kind]),
  animalName: (kind) => name(ANIMAL[kind]),
  stages: {
    hull: 'Rumpf', mast: 'Mast', sail: 'Segel', supplies: 'Vorräte', base: 'Steinsockel', pyre: 'Holzstoß', tinder: 'Zunder',
    basket: 'Korb', envelope: 'Ballonhülle', burner: 'Brenner', aerial: 'Antenne', generator: 'Generator', radio_set: 'Funkgerät',
  },
  skills: {
    small_sips: { name: 'Kleine Schlucke', description: 'Dein Wasser sinkt 20 % langsamer.' },
    small_appetite: { name: 'Kleiner Hunger', description: 'Dein Essen sinkt 20 % langsamer.' },
    thick_skin: { name: 'Dickes Fell', description: 'Du verlierst Wärme 30 % langsamer.' },
    fishing_rod: { name: 'Angelrute', description: 'Du kannst eine Angelrute bauen. Lauf damit ins Meer, um zu angeln.' },
    patient_angler: { name: 'Geduldiger Angler', description: 'Fische beißen öfter an.' },
    handy_builder: { name: 'Geschickter Baumeister', description: 'Alles, was du baust, kostet 1 Holz weniger.' },
    green_thumb: { name: 'Grüner Daumen', description: 'Pflanzen wachsen schneller nach.' },
    night_eyes: { name: 'Eulenaugen', description: 'Du siehst nachts weiter.' },
    animal_friend: { name: 'Tierfreund', description: 'Krabben zwicken dich nicht, und Affen klauen dir kein Essen. Wilde Tiere bemerken dich später.' },
    rope_maker: { name: 'Seilmacher', description: 'Du drehst 2 Seile aus 2 großen Blättern, nicht nur 1.' },
    sure_foot: { name: 'Trittsicher', description: 'Klettern an Leiter oder Seil macht dich nicht müde.' },
    cartographer: { name: 'Kartograf', description: 'In einer Hütte siehst du eine Karte von allem, was du erkundet hast.' },
    strong_back: { name: 'Starker Rücken', description: 'Du trägst 10 schwere Dinge mehr.' },
    pack_frame: { name: 'Kraxe', description: 'Du kannst eine Kraxe bauen. Mit ihr trägst du 15 schwere Dinge mehr.' },
    wild_sense: { name: 'Spürsinn', description: 'Du siehst, wo Tiere dich verfolgen oder dir wehtun würden. Diese Stellen sind rot.' },
  },
  itemStack: (id, count) => `${count} × ${ITEM[id].plural}`,
  itemCount,
  float(amount, what) {
    const label = 'item' in what ? ITEM[what.item].short[Math.abs(amount) === 1 ? 0 : 1] : 'need' in what ? NEEDS[what.need] : 'EP';
    return `${amount > 0 ? '+' : ''}${amount} ${label}`;
  },
  message(msg) {
    switch (msg.key) {
      case 'arrive': return 'Du wirst an eine stille Insel gespült. Sammle Essen und Wasser und baue einen Unterschlupf, bevor es Nacht wird.';
      case 'seaSalty': return 'Das Meerwasser ist zu salzig zum Trinken. Such nach frischem Wasser.';
      case 'mapHint': return 'An der Hüttenwand hängt deine Karte. Tippe auf Karte, um sie anzusehen.';
      case 'stepInto': return `Du gehst ${contract(`in ${obj(msg.obj, 'acc', 'the')}`)}. Ein guter Platz zum Schlafen.`;
      case 'enterHut': return msg.obj ? `Du gehst ${contract(`in ${obj(msg.obj, 'acc', 'the')}`)}.` : 'Du gehst in deine Hütte.';
      case 'oneHut': return 'Du hast schon eine Hütte auf dieser Insel. Drinnen baust du neue Räume an.';
      case 'roomBuilt': return msg.cabin
        ? `Du baust ${phrase(CABIN_ROOM[msg.room], 'acc', 'a')} in deine Mannschaftskabine ein.`
        : `Du baust ${phrase(ROOM[msg.room], 'acc', 'a')} an deine Hütte an.`;
      case 'notInHut': return 'Das geht nur in deiner Hütte.';
      case 'drinkBarrel': return 'Du trinkst frisches Regenwasser aus der Tonne. Herrlich!';
      case 'restLimit': return `Hier kannst du dich nicht mehr erholen (Energie ${msg.cap}). Nur das Bett in deiner Hütte gibt dir volle Erholung.`;
      case 'tooFull': return 'Du bist zu satt, um das zu essen.';
      case 'eat': return `Du isst ${itemCount(msg.item, 1)}. Lecker!`;
      case 'build': return `Du baust ${obj(msg.obj, 'acc', 'a')}.`;
      case 'make': return `Du baust ${itemCount(msg.item, msg.count ?? 1)}.`;
      case 'needMaterials': return 'Du brauchst mehr Material.';
      case 'noRoom': return 'Hier ist kein Platz zum Bauen.';
      case 'noBridgeSpot': return 'Stell dich an einen Fluss und schau zum Wasser. Eine Brücke reicht bis zu 3 Schritte weit.';
      case 'noLavaSpot': return 'Stell dich an den Lavastrom und schau zur Lava. Trittsteine reichen bis zu 3 Schritte weit.';
      case 'tooHeavy': return `Deine Tasche ist zu schwer für mehr Holz, Holzstämme, Steine, Schrott oder Diesel. Leg etwas in ${msg.container ? 'den Lagercontainer' : 'eine Vorratskiste'}, oder verbrauche es.`;
      case 'openStore': return msg.container ? 'Du öffnest den Lagercontainer.' : 'Du öffnest deine Vorratskiste.';
      case 'oneStore': return 'Du hast schon eine Vorratskiste auf dieser Insel.';
      case 'siteNeeds': return `${cap(obj(msg.obj, 'nom', 'the'))} braucht noch ${itemList(msg.left)}.`;
      case 'siteGive': return `Du gibst ${obj(msg.obj, 'dat', 'the')} ${itemList(msg.given)}. Es braucht noch ${itemList(msg.left)}.`;
      case 'siteDone': return msg.obj === 'fishing_boat'
        ? 'Das Fischerboot ist repariert! Lauf dagegen, um den Laderaum zu füllen und loszufahren.'
        : msg.obj === 'derrick_working'
          ? 'Der Bohrturm läuft wieder! Seine Pumpe holt Diesel herauf. Lauf dagegen, um abzufüllen.'
          : `${cap(obj(msg.obj, 'nom', 'the'))} ist fertig! Lauf hinein.`;
      case 'rigOnly': return 'Das kannst du nur auf der Bohrinsel bauen.';
      case 'needFurnace': return 'Stell dich neben den Schmelzofen, um zu schmelzen.';
      case 'noSeaSpot': return 'Stell dich auf ein Deck an den Rand und schau aufs Meer.';
      case 'holdMax': return 'Der Laderaum ist so groß, wie er sein kann.';
      case 'holdUpgraded': return `Du machst den Laderaum größer. Er trägt jetzt ${msg.limit} schwere Dinge.`;
      case 'openRadio': return 'Das Funkgerät summt. Du kannst Vorräte bestellen.';
      case 'noRadio': return 'Stell dich neben das Funkgerät, nachdem du Hilfe gerufen hast.';
      case 'onTheWay': return 'Deine Kiste ist unterwegs. Geh zum Landeplatz und warte auf den Hubschrauber.';
      case 'orderedToday': return 'Du hast heute schon eine Kiste bestellt. Versuch es morgen wieder.';
      case 'ordered': return `„Eine ${de.ui.orders[msg.order]}, bitte!“ Das Funkgerät knistert: „Ist unterwegs!“`;
      case 'delivered': return `Ein Hubschrauber donnert über die Bohrinsel und wirft eine ${de.ui.orders[msg.order]} auf dem Landeplatz ab!`;
      case 'platformBuilt': return 'Du schraubst ein neues Stück Deck an die Plattform.';
      case 'noDeckSpot': return 'Stell dich an den Rand der Mannschaftsplattform und schau aufs Meer. Neues Deck muss nahe an der Kabine bleiben, weg von Stegen und anderen Plattformen.';
      case 'openChart': return 'Du steigst an Bord und rollst die Seekarte aus.';
      case 'noBoat': return 'Stell dich neben das Fischerboot.';
      case 'hereAlready': return 'Hier bist du schon.';
      case 'needDiesel': return `Das Boot braucht ${msg.n} Diesel für die Fahrt. Trag ihn in der Tasche oder im Laderaum.`;
      case 'holdFull': return 'Der Laderaum ist voll mit schweren Dingen.';
      case 'voyage': return msg.level === 4
        ? 'Nach sechs Stunden auf See machst du das Boot wieder an der Bohrinsel fest.'
        : `Nach sechs Stunden auf See landest du auf ${{ 1: 'der Tropeninsel', 2: 'dem Kiefernkamm', 3: 'der Glutinsel' }[msg.level]}.`;
      case 'gangwayBroken': return 'Dieser Steg ist in der Mitte kaputt. Repariere ihn mit Schrott: Bau „Steg reparieren“ daneben.';
      case 'gangwayMended': return 'Du schraubst Schrott über die Lücke. Der Steg ist wieder ganz!';
      case 'lavaHot': return 'Viel zu heiß! Auf Lava kannst du nicht laufen. Leg Trittsteine über den Lavastrom.';
      case 'ashHot': return 'Puh! Die Asche ist heiß in der Sonne. Hier oben bekommst du schneller Durst.';
      case 'haveTool': return `Du hast schon ${itemCount(msg.item, 1)}.`;
      case 'needTool': return msg.obj === 'bramble'
        ? `${cap(obj(msg.obj, 'nom', 'the'))} ist zu dornig für deine Hände. Du brauchst ${itemCount(msg.item, 1)}.`
        : `Für ${obj(msg.obj, 'acc', 'the')} brauchst du ${itemCount(msg.item, 1)}. Werkzeuge aus Metall baust du auf der Bohrinsel.`;
      case 'notSleepy': return 'Du bist gerade nicht müde.';
      case 'fallAsleep': {
        if (msg.obj === 'hut' || msg.obj === 'crew_cabin') return 'Du kuschelst dich in dein Bett und schläfst ein.';
        const place = msg.obj ? contract(`in ${obj(msg.obj, 'dat', 'the')}`) : 'in der Höhle';
        return `Du rollst dich ${place} zusammen und schläfst ein.`;
      }
      case 'dozeOff': return 'Du legst dich auf den Boden und döst ein.';
      case 'wake': {
        const text = {
          rested: 'Du wachst gut erholt auf.',
          restless: 'Du wachst auf, aber nicht ganz erholt. Nur das Bett in deiner Hütte gibt dir volle Erholung.',
          cold: 'Brr! Zu kalt zum Schlafen. Ein Feuer oder ein Unterschlupf würde helfen.',
          hungry: 'Dein knurrender Magen weckt dich auf.',
          thirsty: 'Du wachst durstig auf.',
          none: 'Du wachst auf.',
        }[msg.reason];
        return `${text} (${clock(msg.turn)})`;
      }
      case 'notThirsty': return 'Du hast keinen Durst.';
      case 'drink': return msg.warm ? 'Du trinkst das warme Wasser. Es schmeckt nach Stein, aber es tut gut.'
        : msg.tank ? 'Du trinkst Regenwasser aus dem Tank. Herrlich!'
        : 'Du trinkst das kühle, frische Wasser. Herrlich!';
      case 'drinkRiver': return 'Du schöpfst kühles Flusswasser. Herrlich!';
      case 'look': return `${cap(obj(msg.obj, 'nom', 'a'))}.`;
      case 'nothingLeft': return `${cap(contract(`an ${obj(msg.obj, 'dat', 'the')}`))} ist nichts mehr. Komm später wieder.`;
      case 'gather': {
        const verb = msg.used
          ? `Du hackst mit ${phrase(ITEM[msg.used], 'dat', 'your')} ${contract(`an ${obj(msg.obj, 'dat', 'the')}`)}`
          : OBJECT[msg.obj].gather ?? 'Du suchst';
        const list = msg.got.map(([item, n]) => itemCount(item, n)).join(' und ');
        const hint = msg.lack ? ` Mit ${phrase(ITEM[msg.lack.tool], 'dat', 'a')} könntest du auch ${ITEM[msg.lack.item].plural} schlagen.` : '';
        return (list ? `${verb} und bekommst ${list}.` : `${verb}, findest aber nichts.`) + hint;
      }
      case 'shoo': return ANIMAL[msg.animal].shoo;
      case 'low': return {
        food: 'Dein Magen knurrt. Zeit, etwas zu essen zu finden.',
        water: msg.level === 2 ? 'Du hast Durst. Trink an einer Quelle oder am Fluss.'
          : msg.level === 3 ? 'Du hast Durst. Trink an einer Quelle oder einer heißen Quelle, oder such eine Kokosnuss.'
          : msg.level === 4 ? 'Du hast Durst. Trink an einem Regenwassertank.'
          : 'Du hast Durst. Such eine Quelle oder eine Kokosnuss.',
        energy: 'Du wirst müde. Eine Pause würde helfen.',
        warmth: 'Brr, dir wird kalt. Ein Feuer oder ein Unterschlupf würde helfen.',
      }[msg.need];
      case 'faint': return 'Dir wird schwummrig und du setzt dich zum Ausruhen hin …';
      case 'wakeAtCamp': return 'Du wachst am nächsten Morgen im Lager auf und fühlst dich besser.';
      case 'faintWhy': {
        if (!msg.empty.length) return 'Wilde Tiere haben dich zu oft verletzt. Halte Abstand und iss und trink gut, damit du heilst.';
        const tips = {
          food: 'Iss Beeren, Kokosnüsse oder Fisch.',
          water: 'Trink an einer Quelle oder an einem Fluss.',
          energy: 'Schlaf nachts, am besten in einem Unterschlupf.',
          warmth: 'Bleib nachts am Feuer oder in einem Unterschlupf.',
        };
        const names = msg.empty.map((need) => NEEDS[need]);
        const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} und ${names.at(-1)}` : names[0];
        return `Du bist umgekippt, weil ${list} leer ${names.length > 1 ? 'waren' : 'war'}. ${msg.empty.map((need) => tips[need]).join(' ')}`;
      }
      case 'pinch': return `Autsch! ${cap(phrase(ANIMAL[msg.animal], 'nom', 'the'))} hat dich gezwickt.`;
      case 'hurt': return ANIMAL[msg.animal].hurt ?? `Autsch! ${cap(phrase(ANIMAL[msg.animal], 'nom', 'the'))} hat dir wehgetan.`;
      case 'alert': return ANIMAL[msg.animal].alert ?? `${cap(phrase(ANIMAL[msg.animal], 'nom', 'the'))} kommt auf dich zu!`;
      case 'snatch': return `${cap(phrase(ANIMAL[msg.animal], 'nom', 'the', 'frech'))} hat dir ${itemCount(msg.item, 1)} stibitzt!`;
      case 'cook': return `Du brätst über dem Feuer und bekommst ${itemCount(msg.item, 1)}. Das duftet lecker!`;
      case 'needFire': return 'Stell dich neben ein Lagerfeuer, um zu braten.';
      case 'needSkill': return `Lerne zuerst das Talent „${de.skills[msg.skill].name}“.`;
      case 'needPoints': return 'Du brauchst mehr Talentpunkte. Sammle und baue, um welche zu bekommen.';
      case 'skillPoint': return 'Du wirst geschickter! Du bekommst einen Talentpunkt.';
      case 'learn': return `Du hast gelernt: ${de.skills[msg.skill].name}.`;
      case 'catch': return 'Du wirfst die Angel aus … und fängst einen Fisch!';
      case 'noBite': return 'Nichts beißt an. Versuch es noch mal!';
      case 'goalFound': return msg.obj === 'beacon_site'
        ? 'Du findest einen alten Steinkreis auf dem Gipfel! Ein Leuchtfeuer hier könnte ein Schiff rufen.'
        : msg.obj === 'balloon_site'
          ? 'Du findest einen alten Ballon am Kraterrand! Der Korb ist kaputt und die Hülle zerrissen. Vielleicht kannst du ihn reparieren und wegfliegen.'
          : msg.obj === 'radio_hut'
            ? 'Du findest den alten Funkraum! Die Antenne ist verbogen, und es gibt keinen Strom. Repariere ihn und ruf Hilfe.'
            : 'Du findest ein altes Bootswrack am Strand! Vielleicht kannst du es reparieren und wegsegeln.';
      case 'goalNeeds': {
        const stage = {
          hull: 'den Rumpf', mast: 'den Mast', sail: 'das Segel', supplies: 'die Vorräte',
          base: 'den Steinsockel', pyre: 'den Holzstoß', tinder: 'den Zunder',
          basket: 'den Korb', envelope: 'die Ballonhülle', burner: 'den Brenner',
          aerial: 'die Antenne', generator: 'den Generator', radio_set: 'das Funkgerät',
        }[msg.stage];
        return `${cap(goalName(msg.stage, 'nom'))} braucht ${itemList(msg.left)} für ${stage}.`;
      }
      case 'goalGive': return `Du gibst ${goalName(msg.stage, 'dat')} ${itemList(msg.given)}. ${goalNoun(msg.stage).g === 'm' ? 'Er' : 'Es'} braucht noch ${itemList(msg.left)}.`;
      case 'goalStage': return {
        hull: 'Der Rumpf ist fertig! Jetzt braucht das Boot einen Mast.',
        mast: 'Der Mast steht! Jetzt braucht das Boot ein Segel.',
        sail: 'Das Segel ist dran! Jetzt pack Essen für die Reise ein.',
        supplies: 'Die Vorräte sind an Bord. Das Boot ist bereit zum Lossegeln!',
        base: 'Der Steinsockel ist fertig! Jetzt staple Holz darauf.',
        pyre: 'Der Holzstoß steht! Jetzt braucht er trockenen Zunder.',
        tinder: 'Der Zunder ist drin. Das Leuchtfeuer ist bereit zum Anzünden!',
        basket: 'Der Korb ist repariert! Jetzt braucht der Ballon seine Hülle.',
        envelope: 'Die Hülle ist geflickt! Jetzt braucht sie einen Brenner für heiße Luft.',
        burner: 'Der Brenner ist dran. Der Ballon ist bereit zum Losfliegen!',
        aerial: 'Die Antenne steht wieder gerade! Jetzt braucht das Funkgerät Strom.',
        generator: 'Der Generator läuft! Jetzt repariere das Funkgerät.',
        radio_set: 'Das Funkgerät knistert und geht an. Du kannst Hilfe rufen!',
      }[msg.stage];
      case 'goalReady': return { 1: 'Das Boot ist bereit zum Lossegeln.', 2: 'Das Leuchtfeuer ist bereit zum Anzünden.', 3: 'Der Ballon ist bereit zum Losfliegen.', 4: 'Das Funkgerät ist bereit, um Hilfe zu rufen.' }[msg.level];
      case 'sailAway': return {
        1: 'Du schiebst das Boot in die Wellen und segelst davon!',
        2: 'Du zündest das Leuchtfeuer an. Rauch steigt hoch in den Himmel, und bald holt dich ein Schiff an Bord!',
        3: 'Der Brenner faucht, und der Ballon steigt über den Krater. Du fliegst über das Meer davon!',
        4: 'Du funkst: „Hallo? Hört mich jemand?“ Es knistert, und dann antwortet eine Stimme!',
      }[msg.level];
      case 'landIsland': if (msg.level === 4) return 'Der Wind dreht, und dein Ballon treibt weit aufs Meer hinaus. Rumms! Er landet auf einer alten Bohrinsel. Der Ballon ist kaputt. Schau dich um: Vielleicht geht das alte Funkgerät noch.';
        return msg.level === 3
        ? 'Ein Sturm treibt das Schiff weit vom Kurs ab. Es muss dich an einer Vulkaninsel an Land setzen. Hier ist es warm, und der Berg raucht! Finde selbst einen Weg nach Hause.'
        : 'Nach einer langen Fahrt landet dein Boot auf einer neuen Insel. Hohe Bäume und verschneite Berge! Hier ist es kälter.';
      case 'dogSniff': return 'Ein streunender Hund schnuppert an deiner Hand. Er sieht hungrig aus. Bring ihm etwas zu essen.';
      case 'dogAdopt': return `Du gibst dem Hund ${itemCount(msg.item, 1)}. Er wedelt mit dem Schwanz und folgt dir. Du hast einen Hund!`;
      case 'dogBark': return `Wuff! Dein Hund bellt, und ${phrase(ANIMAL[msg.animal], 'nom', 'the')} rennt weg.`;
      case 'dogFeed': return `Dein Hund frisst ${itemCount(msg.item, 1)} und wedelt mit dem Schwanz.`;
      case 'dogFull': return 'Dein Hund hat keinen Hunger.';
      case 'dogFar': return 'Dein Hund ist zu weit weg. Geh zuerst zu ihm.';
      case 'dogLow': return msg.need === 'food'
        ? 'Dein Hund hat Hunger. Füttere ihn aus deiner Tasche.'
        : 'Dein Hund hat Durst. Geh an einer Quelle oder am Fluss vorbei.';
      case 'dogTired': return 'Dein Hund ist zu hungrig oder durstig, um zu helfen. Er trottet langsam hinter dir her.';
      case 'dogBack': return 'Dein Hund springt auf und ist wieder fröhlich!';
      case 'snowCold': return 'Brr! Der Schnee ist kalt, auch am Tag. Ein Feuer oder ein Unterschlupf hilft hier oben.';
      case 'caveEnter': return msg.lantern
        ? 'Du gehst in eine tiefe Höhle. Deine Kristalllaterne leuchtet dir den Weg.'
        : 'Du gehst in eine tiefe Höhle. Hier ist es dunkel, auch am Tag.';
      case 'tooSteep': return `${cap(obj(msg.obj, 'nom', 'the'))} ist zu steil zum Klettern. Bau ${obj(msg.way, 'acc', 'a')} daran.`;
      case 'noStep': return `Stell dich neben ${obj(msg.obj, 'acc', 'a')}, um das zu bauen.`;
      case 'climb': return `Du kletterst ${contract(`an ${obj(msg.obj, 'dat', 'the')}`)} über die Stufe. ${msg.easy ? 'Ganz leicht!' : 'Puh, das ist anstrengend!'}`;
      case 'tideOut': return 'Ebbe! Das Wasser geht zurück. Die Sandbank zur kleinen Insel ist jetzt trocken.';
      case 'tideIn': return 'Flut! Das Wasser steigt, und die Sandbank geht unter.';
      case 'tideHigh': return `Die Sandbank ist unter Wasser. Um ${time(msg.turn)} Uhr ist wieder Ebbe.`;
      case 'tideWade': return 'Die Flut kommt! Du watest zurück an Land. Brr, nass und kalt.';
      case 'star': return `Du hast einen Stern verdient: ${de.stars[msg.star].name}!`;
      case 'legacy': return msg.text;
    }
  },
};
