# pwagame

A gentle, kid-friendly survival game for phones, built as an installable PWA
(works with a keyboard on desktop too). Wash up on an island, keep yourself
fed, watered, rested and warm, and build a home. No game engine: everything
is our own TypeScript on a 2D canvas.

Play it at https://chief7.github.io/pwagame/.

The **Island Compendium** (English and German) explains the mechanics, items,
skills and animals for players: https://chief7.github.io/pwagame/wiki/.

For architecture and mechanics in detail, see [docs/OVERVIEW.md](docs/OVERVIEW.md).

## Run

```sh
npm install
npm run dev       # dev server (also on your LAN, open it from a phone)
npm test          # unit tests (vitest)
npm run build     # typecheck + production build into dist/
npm run preview   # serve the build (service worker is only active here)
```

## Testing and publishing

- `main` is the published game: GitHub Pages serves it at the site root.
- `preview` is for testing. Push (or merge) updates there. The checks run,
  and then Pages also serves the preview at `<site>/preview/` (its
  compendium at `<site>/preview/wiki/`). It keeps its
  own save, so it does not touch the save of the main game.
- To publish everything that is on `preview` at once, merge it into `main`:

  ```sh
  git checkout main && git pull
  git merge preview
  git push
  ```

- The preview (and `npm run dev`) has a **Cheats** button in the Bag panel
  for testing: jump to any island, go to the goal and other places, fill
  the bag and needs, reveal the map, skip the clock. The game on `main`
  does not show it.
- Do not change `main` directly. If it changes, merge `main` into `preview`
  so the two stay in step.

The deploy workflow is `.github/workflows/pages.yml` (`PREVIEWS` lists the
preview folders and branches); the preview checks are in `preview.yml`.
A preview build (`VITE_PREVIEW=<folder>`) keeps its save under
`pwagame-<folder>.` and has no service worker.

## How it plays

- **Needs:** Health, Food, Water, Energy and Warmth (0–100). Food and Water
  run down as time passes, Energy while awake, and Warmth drops at night out
  in the open. An empty need slowly drains Health.
- **No harsh endings:** when Health runs out you faint and wake up at home
  the next morning with everything you carried. A hint tells you why you
  fainted. Animals can't be hurt;
  bumping one shoos it away.
- **Day and night:** a day is 240 turns. Nights are dark (you see less) and
  cold; a campfire, a shelter or a cave keeps you warm.
- **Gathering:** bump into things. Palms give coconuts and leaves, trees give
  a little wood by hand (and logs with a stone axe), berry bushes give
  berries; these regrow. Logs, pebbles, mushrooms and
  chests are used up. Springs and the river are fresh water; the sea is too
  salty.
- **Building:** campfire, lean-to and hut, placed in front of you. Sleeping
  in a shelter (or a cave) makes it home and rests you faster. A stone axe
  goes in your bag; a bridge goes across the river in front of you. The
  hut, the bridge and the big island goals need logs.
- **Carrying:** your bag holds 30 heavy things (wood, logs, stone, scrap
  and diesel). Food, leaves, rope and tools weigh nothing. When the bag is
  full, you cannot gather more heavy things. Keep the rest in a store crate
  (6 wood, 2 rope; one on each island): walk into it to put things in or
  take them out. The skill Strong back adds 10, and a pack frame (a skill
  and a recipe) adds 15.
- **The camp:** the hut is big work (24 logs, 12 wood, 30 leaves, 20 stone,
  8 rope), more than one bag holds. First build its frame, then walk into
  the frame to give it the materials, in as many trips as you like. Each
  island has only one hut. Walk into it to go inside. Its bed is the
  only place for a full rest: sleep elsewhere stops at 50 Energy in the
  open, 60 in a cave and 75 in a lean-to. In the bed, Health also comes back
  faster. From inside, add rooms: a workshop (rope made there gives one
  more), a hearth (cook fish at home, heal even faster) and a rain barrel
  (drink at home). Each room shows on the hut outside.
- **Exploring:** you start on the home coast. A wall of brambles closes it
  off: chop through with a stone axe (which also chops logs from trees).
  Behind it is the wild forest, and then a river: build a bridge to reach
  the far side, where most hills and caves are. Further out are more chests.
  On the mountain island, the way up to the peak crosses a ring of rocky
  steps (build a ladder on one) and then a ring of ice walls (hang a
  climbing rope on one). Climbing costs a little Energy.
- **Deep caves:** every island has a few big caves in its rocky hills, each
  with one way in. Inside it is dark, also in the day. Glowing mushrooms
  (glowcaps: food with lots of Energy, they grow back), crystals and a
  chest at the far end are only found there. Make a crystal lantern from
  crystals to see further in caves and at night.
- **Animals:** crabs pinch if you linger, monkeys snatch food, piglets and
  bats keep their distance, turtles don't mind you. Far from camp live wild
  animals that hurt: wild boars charge at you, snakes bite, wasps chase you
  until you leave the grass, and cave bears swipe. They are why explorers
  faint and wake up back at camp. Cave bears sleep from 7:00 to 19:00; at
  night they follow you for a few steps, until you leave their cave.
- **Food matters:** food runs down fast, and fruit, berries and mushrooms
  fill you up only a little. Cooked fish is by far the best food. Health
  only comes back while Food and Water are both above 50.
- **Skills:** gathering, building and fishing give XP. XP earns skill points
  (the first at 10 XP, each next one 5 XP more), which you spend in the
  Skills panel on three paths: Building (fishing rod, cheaper building,
  rope maker, cartographer), Explorer (needs drop slower, night eyes, sure foot for
  climbing) and Improving (faster regrowth,
  better catches, animal friend, wild sense). Each path is learned in order.
  Wild sense marks in red the ground where an animal would come after you.
  A cartographer can look at a rough map of the explored island, but only
  in a hut (on its wall, in the Hut panel). It shows huts, campfires, springs, the island
  goal, the ways into the deep caves you found and where you saw cave bears.
- **Fishing:** with the Fishing rod skill you can make a fishing rod. Bump the
  sea while carrying it to fish. Raw fish can't be eaten: cook it next to a
  campfire (tap the grill button above the fire, or use the Build panel).
- **Island goal:** each island has one big goal that gets you off it (see
  [The islands](#the-islands) below). Walk into the goal with what it needs;
  you can bring things in as many trips as you like. The Build panel shows
  the next step.
- **Island stars:** each island has three optional tasks (open every
  chest, catch 5 fish, explore most of the island, or go 3 days without
  fainting). The Build panel shows them; each star gives 5 XP.
- **The dog:** a stray dog lives far from camp on each island. Walk into it
  with food to adopt it. Your dog follows you and barks crabs, monkeys,
  squirrels and snakes away. It needs food (Feed dog in the Bag, raw fish
  works too) and water (it drinks with you and next to springs and rivers).
  If its food or water runs out it is too tired to help until you look
  after it.
- **Saving:** the game saves itself to the browser after every action.
  Saves from before the tide islet still work. Their island 1 has no islet,
  so the hull needs no tar, and the Build panel offers a new island 1 that
  keeps your bag, XP, skills and dog.

## The islands

Islands 1 to 3 have the same three parts: the home coast where you start,
the wild forest behind a wall of brambles, and the far side across a river
(a lava flow on island 3).
Each of them has springs, chests, a few deep caves, a stray dog and room
for one hut. Each island (and the oil rig) also has one goal and three
stars.

### Island 1: the tropical island

- **The land:** wide sandy beaches with palms, a forest of broadleaf and
  pine trees, and rocky hills with caves, mostly on the far side. Three deep
  caves.
- **Food:** coconuts, berries, mushrooms, fish, and glowcaps in the deep
  caves.
- **Animals:** crabs, turtles, monkeys, piglets and bats. Wild: boars,
  wasps, snakes and cave bears.
- **The tide islet:** a little islet off a beach, with three old tar
  barrels, a palm and a chest. A sandbar leads there, but it is dry only at
  low tide (5–11 and 17–23 o'clock); if the water comes in while you are on
  it, you wade back, wet and cold.
- **Goal: repair the boat and sail away.** An old boat wreck lies on a beach
  on the far side. Repair it in four steps:
  1. Hull: 12 logs, 6 wood, 6 stone, 4 tar (from the barrels on the islet).
  2. Mast: 4 logs, 2 wood, 6 rope.
  3. Sail: 12 leaves, 3 rope.
  4. Supplies: 4 coconuts, 3 cooked fish.

  Logs come from trees chopped with a stone axe. Rope is twisted from
  leaves (Build panel). When the boat is ready, walk into it to set sail to
  the second island. You keep your bag, XP, skills, stars, needs and dog.
- **Stars:** open every chest, catch 5 fish, go 3 days without fainting.

### Island 2: Pine Ridge

- **The land:** a narrow beach, a northern forest (spruces, birches, apple
  trees, ferns) and a mountain of cliffs and scree with snow on the peak.
  Two deep caves. Snow is cold even in the day: bring wood for a fire.
- **Food:** apples, berries, mushrooms, fish, and glowcaps in the deep
  caves. There are no coconuts.
- **Animals:** crabs, rabbits, squirrels and bats. Wild: boars, wasps, cave
  bears and mountain goats (they climb over the steps).
- **The way up:** a ring of rocky steps (build a ladder on one) and then a
  ring of ice walls (hang a climbing rope on one) go round the peak.
  Climbing costs a little Energy.
- **Goal: light a signal beacon on the peak.** An old stone ring stands on
  the highest snow. Build the beacon in three steps:
  1. Stone base: 16 stone.
  2. Wood pile: 10 logs, 4 wood, 4 rope.
  3. Tinder: 12 leaves, 4 wood, 3 resin (from the snowy spruces).

  Then walk into it to light it, and a passing ship takes you on board. A
  storm drives the ship off course, and it puts you ashore on the third
  island. You keep your bag, XP, skills, stars, needs and dog.
- **Stars:** open every chest, explore most of the island, go 3 days
  without fainting.

### Island 3: Ember Isle

- **The land:** a warm volcano island. Beaches with palms and a jungle
  below, grey ash and black basalt cliffs above, and a lake of lava in the
  crater. Two deep caves. The ash is hot in the sun: out there in the day,
  your Water drops up to 50% faster.
- **Water:** only 4 springs and no river, but 3 hot springs on the ash give
  water and warm you like a small fire.
- **Food:** coconuts, berries, mushrooms, fish, and glowcaps in the deep
  caves.
- **Animals:** crabs, turtles, monkeys, bats, shy lizards and seagulls that
  snatch food. Wild: boars, wasps, snakes and scorpions that sting.
- **The lava flow:** it takes the place of the river. Lava is too hot to
  walk on, so lay stepping stones (8 stones) across it.
- **Goal: repair the hot-air balloon and fly away.** An old balloon lies on
  the crater rim. Fix it in three steps:
  1. Basket: 4 logs, 8 wood, 4 rope.
  2. Balloon cloth: 16 leaves, 4 rope.
  3. Burner: 8 stone, 2 logs, 4 sulphur (from the steam vents near the
     crater).

  Then walk into it to fly away. The wind turns, and the balloon comes
  down on an old oil rig.
- **Stars:** open every chest, catch 5 fish, explore most of the island.

### Island 4: the old oil rig

- **The land:** none. Steel platforms stand on legs in the open sea,
  joined by gangways. One platform has a helipad.
- **Water:** 2 rain water tanks. No springs and no river.
- **Food:** fish from the decks, and mussels on the rig legs at the
  waterline. There are no trees and no fruit.
- **Materials:** scrap metal from scrap piles, wood from old pallets, rope
  from old fishing nets, and diesel from old fuel drums.
- **Animals:** only seagulls that snatch food.
- **Camp:** the crew cabin has a bed for a full rest and a stove to cook
  fish on.
- **Broken gangways:** 2 to 4 gangways are broken in the middle. Build
  "Mend gangway" (6 scrap) next to a broken end to cross.
- **Goal: repair the radio and call for help.** The radio room stands on
  the platform furthest away. Fix it in three steps:
  1. Aerial: 8 scrap, 2 rope.
  2. Generator: 6 scrap, 4 diesel.
  3. Radio: 4 scrap, 2 rope.

  Then walk into it to call for help. This is the end of the game for now:
  you can stay on the rig or start a new island.
- **Stars:** open every chest, catch 5 fish, explore most of the rig.
- **The derrick and the fishing boat:** repair the old drilling tower (12
  scrap, 2 rope): its pump gives 2 diesel every half day. Repair the old
  fishing boat at the dock (10 scrap, 6 wood, 4 rope), then walk into it to
  open the sea chart. Sail to islands 1, 2 or 3 and back: a trip takes 6
  hours and 2 diesel (3 hours and 1 diesel with the boat motor). The boat's hold carries 60 heavy things. Every island
  stays as you left it.
- **Supply drops:** after the call for help, walk into the radio to order
  one free crate each day: food, building materials or fuel. Special parts
  (solar panel, electric cooker, motor) cost materials from your bag. Then
  walk onto the helipad, and a helicopter comes and drops your order there.
- **The rig habitat:** build a solar station (2 solar panels, 4 steel
  plates, 6 scrap), a galley (1 cooker, 4 steel plates, 6 wood) and a
  machine shop (1 motor, 6 steel plates, 4 scrap) on steel frames, in trips.
  The solar station opens lamp posts and the cooker and motor orders; the
  galley opens fish stew; the machine shop opens a motor for the boat.
- **New platforms:** build "Platform" (6 scrap, 2 wood) at the edge of the
  crew platform to add a piece of deck, and "Rain tank" (6 scrap) for
  water. New deck stays near the cabin and away from gangways.
- **The rig workshop:** make a pickaxe, a shovel and a crowbar from scrap.
  Mine iron ore and coal on Pine Ridge, dig clay at the river of island 1,
  and open sealed crates with spare parts on islands 1 to 3. On the rig,
  build a furnace (smelt steel plates), a greenhouse (vegetables), a water
  maker, fish traps, and a bigger hold for the boat (two times).

## Controls

- **Touch:** tap next to your explorer to step, or to gather, drink or shoo
  what's there; tap further away to walk there along a known path; press and
  hold to keep walking towards your finger. Walking stops when something new
  comes into view. Tap your explorer to wait a turn. Buttons: Bag (eat, change
  explorer, new island, reset all progress), Build, Skills (a star shows when you have points to
  spend), Hut (while you stand in your hut), Sleep. With raw fish next to a
  campfire, tap the grill button above the fire to cook a fish.
- **Keyboard:** arrows / WASD / `hjkl` / numpad to move, `.` or `5` wait,
  `i` bag, `b` build, `p` skills, `g` grill a fish at the fire, `e` go inside
  the hut you stand in, `m` map (in a hut, with Cartographer), `z` sleep, `Esc` closes panels.

## Adding things

In Claude Code, run `/add-content <idea>`. The skill proposes the content with
rendered sprites, waits for your approval or changes, and then builds it.
The details below are for manual changes.

Content lives in data registries under `src/game/defs/`. Each entry needs a
matching sprite (see below); the sprite test fails if one is missing.

- **Item:** add it to `ITEMS` in `items.ts` (give it `eat` to make it food)
  and draw `item_<id>` in `sprites/creatures.ts` → `itemIcons()`.
- **World object:** add it to `OBJECTS` in `objects.ts`. `gather` describes
  what bumping it yields and whether it is removed, becomes something else or
  regrows; `drink`, `shelter`, `warmthRadius`, `lightRadius`, `walkable` and
  `blocksSight` add behaviour. Place it in the world via `SCATTER` in
  `worldgen.ts`, or make it buildable.
- **Recipe:** add it to `RECIPES` in `recipes.ts`; the Build panel lists it
  automatically. `skill` locks it until a skill is learned; `atFire` makes it
  need a campfire next to you.
- **Skill:** add it to a path in `PATHS` in `skills.ts` and give it words in
  `src/i18n/`. Its effect is code where it applies (`game.has(id)`).
- **Animal:** add it to `ANIMALS` in `animals.ts` with a temper (`calm`,
  `shy`, `grumpy`, `cheeky`, `charger`, `chaser`), habitat, notice range and
  population (plus `damage`, `hitChance`, `wild` and `minHomeDistance` for
  animals that hurt), and draw
  `animal_<kind>`.
- **Need:** `needs.ts` holds the rates and the warmth model.

## Layout

```
src/
  game/        pure game logic, no DOM — unit-testable
    defs/        data registries: items, objects, recipes, hut rooms, animals, skills, levels
    game.ts      actions, turn loop, needs, animals, fainting, sleep, save/load
    needs.ts     the five needs and how they change each turn
    clock.ts     time of day, daylight, phases
    inventory.ts what the explorer carries
    worldgen.ts  island generation: beach, forest, rocky hills and caves (island 2: mountains, scree, snow; island 3: volcano, ash, lava), deep caves, bramble wall, river (lava flow), scenery
    riggen.ts    the oil rig (island 4): platforms, gangways, helipad, and what stands on the decks
    caves.ts     finds the deep caves (big caves with few ways in) from the tiles
    map.ts       tile grid + explored/visible layers
    fov.ts       recursive shadowcasting field of view
    pathing.ts   BFS distance maps (travel, animals, placement), reach across bridgeable rivers
    actors.ts    player and animal shapes
    rng.ts       seeded PRNG (mulberry32), saveable
  ui/
    renderer.ts  sprite renderer (integer scaling), night lighting, camera
    animator.ts  turns game events into tweens, lunges, flashes, floating text, fades
    input.ts     keyboard mapping and tap/hold direction helper
  main.ts      HUD, Bag/Build/Skills/Hut/Map panels, input, render loop, autosave
  wiki/        the Island Compendium page (wiki/index.html): player guide in English and German
    text.ts      its explanations; names come from src/i18n/, numbers from the game data
    data.ts      tables read from the registries (gathering, items, animals)
  sprites/     pixel-art sprites, generated in code (no image files)
    palette.ts   the shared colour palette
    pixel.ts     Sprite grid, outline/shadow helpers, fromRows() for hand-drawn art
    terrain.ts   sand, water, river, grass, rock, cave floor, scree, snow, and all edge transitions (also mixed ones)
    forest.ts    trees, bushes, berry bushes, mushrooms, brambles
    objects.ts   stones, logs, chests, stalagmite, spring, steep steps (rocky step, ice wall) with ladder and rope, glowcaps and crystals
    palms.ts     palm trees (24×32), with bare versions
    structures.ts campfire (animated), lean-to, hut (with each set of rooms), bridges, boat (also sailing away), beacon (also lit)
    interiors.ts the rooms inside the hut (32×24 each), for the Hut panel
    creatures.ts animals (with step frames and left facing), item icons
    ui.ts        interface icons (globe) and the app icon
    characters.ts  male and female explorer, 4 facings × idle + 2 walk frames, fishing poses
    gallery.ts   the sprite gallery page
  fonts/       Pixelify Sans pixel font (OFL), loaded by fonts.css
scripts/
  app-icons.mjs  writes the app icons in public/ from the app icon sprite
public/        manifest, icons, service worker (offline cache)
```

## Sprites

Run `npm run dev` and open `/sprites.html` to see every sprite plus a small
island composed from them. Terrain tiles are 16×16; objects are drawn
bottom-centre on their tile. `bake()` turns a sprite into a canvas for
`drawImage` (keep `imageSmoothingEnabled = false` when scaling up).

The app icons in `public/` are made from the `appIcon()` sprite in
`sprites/ui.ts`. After you change it, run `npm run icons`.
