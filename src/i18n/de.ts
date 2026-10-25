import { dayNumber, minuteOfDay } from '../game/clock';
import type { ObjectKind } from '../game/defs/objects';
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
/** "in dem" → "im", "in das" → "ins", "an dem" → "am". */
const contract = (s: string) => s.replace(/^(in|an) dem /, (_, p: string) => (p === 'in' ? 'im ' : 'am ')).replace(/^in das /, 'ins ');

const ITEM: ItemWords<CountNoun> = {
  coconut: { g: 'f', word: 'Kokosnuss', plural: 'Kokosnüsse', short: ['Kokosnuss', 'Kokosnüsse'] },
  berries: { g: 'f', word: 'Handvoll Beeren', plural: 'Handvoll Beeren', short: ['Beeren', 'Beeren'] },
  mushroom: { g: 'm', word: 'Pilz', plural: 'Pilze', short: ['Pilz', 'Pilze'] },
  wood: { g: 'n', word: 'Stück Holz', plural: 'Stück Holz', short: ['Holz', 'Holz'] },
  leaves: { g: 'n', word: 'Blatt', adj: 'groß', plural: 'große Blätter', short: ['Blatt', 'Blätter'] },
  stone: { g: 'm', word: 'Stein', plural: 'Steine', short: ['Stein', 'Steine'] },
  axe: { g: 'f', word: 'Steinaxt', plural: 'Steinäxte', short: ['Axt', 'Äxte'] },
  fish: { g: 'm', word: 'Fisch', plural: 'Fische', short: ['Fisch', 'Fische'] },
  cooked_fish: { g: 'm', word: 'Fisch', adj: 'gebraten', plural: 'gebratene Fische', short: ['Bratfisch', 'Bratfische'] },
  fishing_rod: { g: 'f', word: 'Angelrute', plural: 'Angelruten', short: ['Angel', 'Angeln'] },
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
  bramble: { g: 'n', word: 'Dornengestrüpp', gather: 'Du schlägst dich durch das Dornengestrüpp' },
  bridge_ns: { g: 'f', word: 'Brücke' },
  bridge_ew: { g: 'f', word: 'Brücke' },
};

const ANIMAL: AnimalWords<Noun & { shoo: string }> = {
  crab: { g: 'f', word: 'Krabbe', shoo: 'Du verscheuchst die Krabbe. Sie krabbelt seitwärts davon.' },
  turtle: { g: 'f', word: 'Schildkröte', shoo: 'Die Schildkröte blinzelt dich langsam an.' },
  monkey: { g: 'm', word: 'Affe', shoo: 'Du verscheuchst den Affen. Er schnattert und flitzt davon.' },
  piglet: { g: 'n', word: 'Ferkel', shoo: 'Das Ferkel quiekt und trabt davon.' },
  bat: { g: 'f', word: 'Fledermaus', shoo: 'Die Fledermaus flattert an deinem Ohr vorbei.' },
};

const NEEDS = { health: 'Leben', food: 'Essen', water: 'Wasser', energy: 'Energie', warmth: 'Wärme' };

const obj = (kind: ObjectKind, c: Case, det: Det) => phrase(OBJECT[kind], c, det);

/** In the accusative, as items always are in messages: "eine Kokosnuss", "3 große Blätter". */
function itemCount(id: keyof typeof ITEM, count: number): string {
  return count === 1 ? phrase(ITEM[id], 'acc', 'a') : `${count} ${ITEM[id].plural}`;
}

function clock(turn: number): string {
  const m = Math.floor(minuteOfDay(turn));
  return `Tag ${dayNumber(turn)} · ${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
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
    byFire: 'Am Feuer',
    inCave: 'In einer Höhle',
    inShelter: (kind) => `In ${obj(kind, 'dat', 'your')}`,
    dawn: 'Morgengrauen',
    dusk: 'Abend',
    night: 'Nacht',
    skills: 'Talente',
    learn: 'Lernen',
    learned: 'Gelernt',
    raw: 'Roh. Brate ihn am Lagerfeuer.',
    skillsHint: 'Sammle, baue und angle, um EP zu bekommen. Mit EP bekommst du Talentpunkte, mit denen du Talente lernst.',
    skillPoints: (n) => `${n} ${n === 1 ? 'Talentpunkt' : 'Talentpunkte'}`,
    xpToNext: (have, need) => `EP ${have} / ${need} bis zum nächsten Punkt`,
    skillCost: (n) => `Kostet ${n} ${n === 1 ? 'Punkt' : 'Punkte'}`,
  },
  clock,
  needs: NEEDS,
  recipes: {
    campfire: { name: 'Lagerfeuer', description: 'Hält dich warm und macht die Nacht hell.' },
    lean_to: { name: 'Unterstand', description: 'Ein einfacher Unterschlupf. Hier schläfst du gut und bleibst wärmer.' },
    hut: { name: 'Hütte', description: 'Ein gemütliches Zuhause. Warme Nächte und der beste Schlaf.' },
    axe: { name: 'Steinaxt', description: 'Schlägt dir einen Weg durch Dornengestrüpp und bringt mehr Holz von Bäumen.' },
    bridge: { name: 'Brücke', description: 'Führt über einen Fluss, bis zu 3 Schritte breit. Schau zum Wasser, um sie zu bauen.' },
    fishing_rod: { name: 'Angelrute', description: 'Lauf damit ins Meer, um Fische zu fangen.' },
    cooked_fish: { name: 'Fisch braten', description: 'Stell dich neben ein Lagerfeuer. Gebratener Fisch ist leckeres Essen.' },
  },
  paths: { survival: 'Überleben', craft: 'Handwerk', explorer: 'Entdecker' },
  skills: {
    small_sips: { name: 'Kleine Schlucke', description: 'Dein Wasser sinkt 20 % langsamer.' },
    small_appetite: { name: 'Kleiner Hunger', description: 'Dein Essen sinkt 20 % langsamer.' },
    thick_skin: { name: 'Dickes Fell', description: 'Du verlierst Wärme 30 % langsamer.' },
    fishing_rod: { name: 'Angelrute', description: 'Du kannst eine Angelrute bauen. Lauf damit ins Meer, um zu angeln.' },
    patient_angler: { name: 'Geduldiger Angler', description: 'Fische beißen öfter an.' },
    handy_builder: { name: 'Geschickter Baumeister', description: 'Alles, was du baust, kostet 1 Holz weniger.' },
    green_thumb: { name: 'Grüner Daumen', description: 'Pflanzen wachsen schneller nach.' },
    night_eyes: { name: 'Eulenaugen', description: 'Du siehst nachts weiter.' },
    animal_friend: { name: 'Tierfreund', description: 'Krabben zwicken dich nicht, und Affen klauen dir kein Essen.' },
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
      case 'stepInto': return `Du gehst ${contract(`in ${obj(msg.obj, 'acc', 'the')}`)}. Ein guter Platz zum Schlafen.`;
      case 'tooFull': return 'Du bist zu satt, um das zu essen.';
      case 'eat': return `Du isst ${itemCount(msg.item, 1)}. Lecker!`;
      case 'build': return `Du baust ${obj(msg.obj, 'acc', 'a')}.`;
      case 'make': return `Du baust ${itemCount(msg.item, 1)}.`;
      case 'needMaterials': return 'Du brauchst mehr Material.';
      case 'noRoom': return 'Hier ist kein Platz zum Bauen.';
      case 'noBridgeSpot': return 'Stell dich an einen Fluss und schau zum Wasser. Eine Brücke reicht bis zu 3 Schritte weit.';
      case 'haveTool': return `Du hast schon ${itemCount(msg.item, 1)}.`;
      case 'needTool': return `${cap(obj(msg.obj, 'nom', 'the'))} ist zu dornig für deine Hände. Du brauchst ${itemCount(msg.item, 1)}.`;
      case 'notSleepy': return 'Du bist gerade nicht müde.';
      case 'fallAsleep': {
        const place = msg.obj ? contract(`in ${obj(msg.obj, 'dat', 'the')}`) : 'in der Höhle';
        return `Du rollst dich ${place} zusammen und schläfst ein.`;
      }
      case 'dozeOff': return 'Du legst dich auf den Boden und döst ein.';
      case 'wake': {
        const text = {
          rested: 'Du wachst gut erholt auf.',
          cold: 'Brr! Zu kalt zum Schlafen. Ein Feuer oder ein Unterschlupf würde helfen.',
          hungry: 'Dein knurrender Magen weckt dich auf.',
          thirsty: 'Du wachst durstig auf.',
          none: 'Du wachst auf.',
        }[msg.reason];
        return `${text} (${clock(msg.turn)})`;
      }
      case 'notThirsty': return 'Du hast keinen Durst.';
      case 'drink': return 'Du trinkst das kühle, frische Wasser. Herrlich!';
      case 'drinkRiver': return 'Du schöpfst kühles Flusswasser. Herrlich!';
      case 'look': return `${cap(obj(msg.obj, 'nom', 'a'))}.`;
      case 'nothingLeft': return `${cap(contract(`an ${obj(msg.obj, 'dat', 'the')}`))} ist nichts mehr. Komm später wieder.`;
      case 'gather': {
        const verb = OBJECT[msg.obj].gather ?? 'Du suchst';
        const list = msg.got.map(([item, n]) => itemCount(item, n)).join(' und ');
        return list ? `${verb} und bekommst ${list}.` : `${verb}, findest aber nichts.`;
      }
      case 'shoo': return ANIMAL[msg.animal].shoo;
      case 'low': return {
        food: 'Dein Magen knurrt. Zeit, etwas zu essen zu finden.',
        water: 'Du hast Durst. Such eine Quelle oder eine Kokosnuss.',
        energy: 'Du wirst müde. Eine Pause würde helfen.',
        warmth: 'Brr, dir wird kalt. Ein Feuer oder ein Unterschlupf würde helfen.',
      }[msg.need];
      case 'faint': return 'Dir wird schwummrig und du setzt dich zum Ausruhen hin …';
      case 'wakeAtCamp': return 'Du wachst im Lager auf und fühlst dich besser. Denk daran zu essen, zu trinken und dich warm zu halten!';
      case 'pinch': return `Autsch! ${cap(phrase(ANIMAL[msg.animal], 'nom', 'the'))} hat dich gezwickt.`;
      case 'snatch': return `${cap(phrase(ANIMAL[msg.animal], 'nom', 'the', 'frech'))} hat dir ${itemCount(msg.item, 1)} stibitzt!`;
      case 'cook': return `Du brätst über dem Feuer und bekommst ${itemCount(msg.item, 1)}. Das duftet lecker!`;
      case 'needFire': return 'Stell dich neben ein Lagerfeuer, um zu braten.';
      case 'needSkill': return `Lerne zuerst das Talent „${de.skills[msg.skill].name}“.`;
      case 'needPoints': return 'Du brauchst mehr Talentpunkte. Sammle und baue, um welche zu bekommen.';
      case 'skillPoint': return 'Du wirst geschickter! Du bekommst einen Talentpunkt.';
      case 'learn': return `Du hast gelernt: ${de.skills[msg.skill].name}.`;
      case 'catch': return 'Du wirfst die Angel aus … und fängst einen Fisch!';
      case 'noBite': return 'Nichts beißt an. Versuch es noch mal!';
      case 'legacy': return msg.text;
    }
  },
};
