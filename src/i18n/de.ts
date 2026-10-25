import { dayNumber, minuteOfDay } from '../game/clock';
import { stageLevel, type StageId } from '../game/defs/levels';
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
  apple: { g: 'm', word: 'Apfel', plural: 'Äpfel', short: ['Apfel', 'Äpfel'] },
  fishing_rod: { g: 'f', word: 'Angelrute', plural: 'Angelruten', short: ['Angel', 'Angeln'] },
  rope: { g: 'n', word: 'Seil', plural: 'Seile', short: ['Seil', 'Seile'] },
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
  bear: { g: 'm', word: 'Höhlenbär', shoo: 'Der Höhlenbär brummt und tapst davon.', hurt: 'Der Höhlenbär wacht auf und haut nach dir!' },
  rabbit: { g: 'm', word: 'Hase', shoo: 'Der Hase zuckt mit der Nase und hoppelt davon.' },
  squirrel: { g: 'n', word: 'Eichhörnchen', shoo: 'Das Eichhörnchen schimpft und flitzt einen Baum hinauf.' },
  dog: { g: 'm', word: 'Hund', adj: 'streunend', shoo: 'Der Hund wedelt mit dem Schwanz.' },
  goat: {
    g: 'f', word: 'Bergziege', shoo: 'Du fuchtelst mit den Armen. Die Ziege meckert und springt über die Felsen davon.',
    hurt: 'Bums! Die Bergziege stößt dich mit den Hörnern.', alert: 'Eine Bergziege senkt die Hörner und rennt auf dich zu!',
  },
};

const NEEDS = { health: 'Leben', food: 'Essen', water: 'Wasser', energy: 'Energie', warmth: 'Wärme' };

const obj = (kind: ObjectKind, c: Case, det: Det) => phrase(OBJECT[kind], c, det);

/** In the accusative, as items always are in messages: "eine Kokosnuss", "3 große Blätter". */
function itemCount(id: keyof typeof ITEM, count: number): string {
  return count === 1 ? phrase(ITEM[id], 'acc', 'a') : `${count} ${ITEM[id].plural}`;
}

/** "20 Stück Holz und 6 Steine". */
function itemList(items: [keyof typeof ITEM, number][]): string {
  const parts = items.map(([id, n]) => itemCount(id, n));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} und ${parts.at(-1)}` : parts.join('');
}

/** The goal of a stage's island: "das Boot", "dem Leuchtfeuer" (both neuter). */
function goalName(stage: StageId, c: Case): string {
  return phrase({ g: 'n', word: stageLevel(stage) === 2 ? 'Leuchtfeuer' : 'Boot' }, c, 'the');
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
    resetProgress: 'Gesamten Fortschritt löschen',
    byFire: 'Am Feuer',
    grill: (n) => `Fisch grillen (noch ${n})`,
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
    goalMissing: 'Auf dieser Insel gibt es kein Boot. Starte in deiner Tasche eine neue Insel, um eins zu bekommen.',
    goalStep: (index, count, stage) => `Schritt ${index + 1} von ${count}: ${de.stages[stage]}`,
    notYet: 'Noch nicht',
    endTitle: 'Geschafft!',
    endText: 'Ein Schiff hat dein Leuchtfeuer gesehen und dich an Bord geholt. Die nächste Insel kommt bald! Bis dahin kannst du hierbleiben oder eine neue Insel starten.',
    stay: 'Auf dieser Insel bleiben',
    yourDog: 'Dein Hund',
    dogNeeds: (food, water) => `Essen ${food} · Wasser ${water}`,
    dogTired: 'Müde. Gib ihm Essen und geh an Wasser vorbei, damit er trinken kann.',
    feedDog: 'Füttern',
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
  },
  clock,
  needs: NEEDS,
  recipes: {
    campfire: { name: 'Lagerfeuer', description: 'Hält dich warm und macht die Nacht hell.' },
    lean_to: { name: 'Unterstand', description: 'Ein einfacher Unterschlupf. Hier schläfst du gut und bleibst wärmer.' },
    hut: { name: 'Hütte', description: 'Ein gemütliches Zuhause. Warme Nächte und der beste Schlaf.' },
    rope: { name: 'Seil', description: 'Aus großen Blättern gedreht. Für das Inselziel brauchst du Seile.' },
    axe: { name: 'Steinaxt', description: 'Schlägt dir einen Weg durch Dornengestrüpp und bringt mehr Holz von Bäumen.' },
    bridge: { name: 'Brücke', description: 'Führt über einen Fluss, bis zu 3 Schritte breit. Schau zum Wasser, um sie zu bauen.' },
    fishing_rod: { name: 'Angelrute', description: 'Lauf damit ins Meer, um Fische zu fangen.' },
    cooked_fish: { name: 'Fisch braten', description: 'Stell dich neben ein Lagerfeuer. Gebratener Fisch ist leckeres Essen.' },
  },
  paths: { build: 'Bauen', explorer: 'Entdecker', improve: 'Verbessern' },
  stages: { hull: 'Rumpf', mast: 'Mast', sail: 'Segel', supplies: 'Vorräte', base: 'Steinsockel', pyre: 'Holzstoß', tinder: 'Zunder' },
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
        : 'Du findest ein altes Bootswrack am Strand! Vielleicht kannst du es reparieren und wegsegeln.';
      case 'goalNeeds': {
        const stage = {
          hull: 'den Rumpf', mast: 'den Mast', sail: 'das Segel', supplies: 'die Vorräte',
          base: 'den Steinsockel', pyre: 'den Holzstoß', tinder: 'den Zunder',
        }[msg.stage];
        return `${cap(goalName(msg.stage, 'nom'))} braucht ${itemList(msg.left)} für ${stage}.`;
      }
      case 'goalGive': return `Du gibst ${goalName(msg.stage, 'dat')} ${itemList(msg.given)}. Es braucht noch ${itemList(msg.left)}.`;
      case 'goalStage': return {
        hull: 'Der Rumpf ist fertig! Jetzt braucht das Boot einen Mast.',
        mast: 'Der Mast steht! Jetzt braucht das Boot ein Segel.',
        sail: 'Das Segel ist dran! Jetzt pack Essen für die Reise ein.',
        supplies: 'Die Vorräte sind an Bord. Das Boot ist bereit zum Lossegeln!',
        base: 'Der Steinsockel ist fertig! Jetzt staple Holz darauf.',
        pyre: 'Der Holzstoß steht! Jetzt braucht er trockenen Zunder.',
        tinder: 'Der Zunder ist drin. Das Leuchtfeuer ist bereit zum Anzünden!',
      }[msg.stage];
      case 'goalReady': return msg.level === 2 ? 'Das Leuchtfeuer ist bereit zum Anzünden.' : 'Das Boot ist bereit zum Lossegeln.';
      case 'sailAway': return msg.level === 2
        ? 'Du zündest das Leuchtfeuer an. Rauch steigt hoch in den Himmel, und bald holt dich ein Schiff an Bord!'
        : 'Du schiebst das Boot in die Wellen und segelst davon!';
      case 'landIsland': return 'Nach einer langen Fahrt landet dein Boot auf einer neuen Insel. Hohe Bäume und verschneite Berge! Hier ist es kälter.';
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
      case 'legacy': return msg.text;
    }
  },
};
