import { ITEM_IDS, type ItemId } from './game/defs/items';
import { LEVELS, levelDef } from './game/defs/levels';
import { OBJECTS, type ObjectKind } from './game/defs/objects';
import type { Game } from './game/game';
import { Tile } from './game/map';

// Cheats for testing a preview build: jump to an island, go to a place,
// fill the bag, the needs and the clock. Only preview builds and the dev
// server show them (see main.ts). No DOM here; the words are English only,
// like the other developer tools.

export interface Cheat {
  /** Sprite name for the row's picture. */
  icon: string;
  label: string;
  note: string;
  /** Does the cheat; returns false when there was nothing to do. */
  run(game: Game): boolean;
}

/** What "Give a starter kit" puts in the bag: tools and plenty of materials. */
const KIT: Partial<Record<ItemId, number>> = {
  axe: 1, fishing_rod: 1, lantern: 1, wood: 30, log: 30, leaves: 40, stone: 30, rope: 12, cooked_fish: 5, coconut: 5,
};

/** Cells this close to the explorer count as "here": "go to" picks the next one further out, so tapping again moves on. */
const HERE = 3;

function give(game: Game, items: Partial<Record<ItemId, number>>): boolean {
  const list = Object.entries(items) as [ItemId, number][];
  for (const [id, n] of list) game.inventory.add(id, n);
  return list.length > 0;
}

/** Go to the nearest cell (not right here) that passes `test`. */
function goTo(game: Game, test: (i: number) => boolean): boolean {
  const { map, player } = game;
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < map.tiles.length; i++) {
    if (!test(i)) continue;
    const x = i % map.width;
    const d = Math.max(Math.abs(x - player.x), Math.abs((i - x) / map.width - player.y));
    if (d > HERE && d < bestDist) [best, bestDist] = [i, d];
  }
  return best >= 0 && game.teleportNear(best);
}

const objectIs = (game: Game, kinds: (kind: ObjectKind) => boolean) => (i: number) => {
  const obj = game.objects.get(i);
  return !!obj && kinds(obj.kind);
};

/** Everything the goal still needs for this stage and all later ones. */
function goalMaterials(game: Game): Partial<Record<ItemId, number>> {
  const goal = game.goal();
  if (goal.state !== 'build') return {};
  const total: Partial<Record<ItemId, number>> = { ...goal.left };
  for (const stage of levelDef(game.level).stages.slice(goal.index + 1)) {
    for (const [id, n] of Object.entries(game.stageCost(stage)) as [ItemId, number][]) total[id] = (total[id] ?? 0) + n;
  }
  return total;
}

export function cheats(game: Game): { title: string; cheats: Cheat[] }[] {
  const has = (kinds: (kind: ObjectKind) => boolean) => [...game.objects.values()].some((o) => kinds(o.kind));
  const places: Cheat[] = [
    {
      icon: levelDef(game.level).site, label: 'Go to the island goal', note: 'Next to it, and you see it.',
      run: (g) => goTo(g, objectIs(g, (k) => !!OBJECTS[k].goal)),
    },
  ];
  const flow = game.map.tiles.includes(Tile.Lava) ? 'lava flow' : 'river';
  if (game.map.tiles.includes(Tile.Lava) || game.map.tiles.includes(Tile.River)) {
    places.push({
      icon: flow === 'river' ? 'river' : 'lava', label: `Go to the ${flow}`, note: 'The nearest bank. Tap again for the next place.',
      run: (g) => goTo(g, (i) => g.map.isFlow(i % g.map.width, Math.floor(i / g.map.width)) && !g.objects.has(i)),
    });
  }
  const spots: [ObjectKind, string][] = [
    ['steam_vent', 'a steam vent'], ['hot_spring', 'a hot spring'], ['sandbar_ns', 'the sandbar'], ['barrel', 'the tar barrels'],
    ['gangway_end_e', 'a broken gangway'], ['crew_cabin', 'the crew cabin'], ['diesel_drums', 'the fuel drums'],
    ['fishing_boat_wreck', 'the fishing boat'], ['derrick', 'the derrick'],
  ];
  for (const [kind, name] of spots) {
    const same = (k: ObjectKind) => k === kind || (kind === 'sandbar_ns' && k === 'sandbar_ew') || (kind === 'gangway_end_e' && !!OBJECTS[k].broken)
      || (kind === 'fishing_boat_wreck' && k === 'fishing_boat') || (kind === 'derrick' && k === 'derrick_working');
    if (has(same)) places.push({ icon: kind, label: `Go to ${name}`, note: 'Tap again for the next one.', run: (g) => goTo(g, objectIs(g, same)) });
  }
  if (game.caves().length) {
    places.push({
      icon: 'cave_floor', label: 'Go into a deep cave', note: 'Tap again for the next cave.',
      run: (g) => {
        const cells = new Set(g.caves().flatMap((c) => c.cells.slice(0, 1)));
        return goTo(g, (i) => cells.has(i));
      },
    });
  }

  return [
    {
      title: 'Islands',
      cheats: LEVELS.map((l) => ({
        icon: l.site, label: `Go to island ${l.level}`, note: 'A new island. You keep your bag, XP, skills and dog.',
        run: (g: Game) => {
          g.jumpToIsland(l.level);
          return true;
        },
      })),
    },
    { title: 'Places', cheats: places },
    {
      title: 'Bag and goal',
      cheats: [
        { icon: 'item_axe', label: 'Give a starter kit', note: 'Axe, fishing rod, lantern, and lots of wood, logs, leaves, stone and rope.', run: (g) => give(g, KIT) },
        { icon: 'item_rope', label: 'Give the goal materials', note: 'Everything the goal still needs, for every stage.', run: (g) => give(g, goalMaterials(g)) },
        {
          icon: 'item_crystal', label: 'Give 5 of every item', note: 'Food, materials and rare materials (no tools).',
          run: (g) => give(g, Object.fromEntries(ITEM_IDS.filter((id) => !['axe', 'fishing_rod', 'lantern'].includes(id)).map((id) => [id, 5]))),
        },
      ],
    },
    {
      title: 'Explorer',
      cheats: [
        {
          icon: 'item_cooked_fish', label: 'Fill all needs', note: 'Health, Food, Water, Energy and Warmth to 100.',
          run: (g) => {
            Object.assign(g.needs, { health: 100, food: 100, water: 100, energy: 100, warmth: 100 });
            return true;
          },
        },
        {
          icon: 'ui_star', label: 'Give 50 XP', note: 'For skill points.',
          run: (g) => {
            g.xp += 50;
            return true;
          },
        },
        {
          icon: 'map_you', label: 'Reveal the map', note: 'The whole island counts as explored.',
          run: (g) => {
            g.revealMap();
            return true;
          },
        },
      ],
    },
    {
      title: 'Time',
      cheats: [7, 12, 22].map((hour) => ({
        icon: hour === 22 ? 'campfire' : 'grass_flowers', label: `Skip to ${hour}:00`, note: hour === 22 ? 'Night.' : hour === 7 ? 'Morning.' : 'Midday.',
        run: (g: Game) => {
          g.skipToHour(hour);
          return true;
        },
      })),
    },
  ];
}
