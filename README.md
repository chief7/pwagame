# pwagame

A gentle, kid-friendly survival game for phones, built as an installable PWA
(works with a keyboard on desktop too). Wash up on an island, keep yourself
fed, watered, rested and warm, and build a home. No game engine: everything
is our own TypeScript on a 2D canvas.

Play it at https://chief7.github.io/pwagame/.

For architecture and mechanics in detail, see [docs/OVERVIEW.md](docs/OVERVIEW.md).

## Run

```sh
npm install
npm run dev       # dev server (also on your LAN, open it from a phone)
npm test          # unit tests (vitest)
npm run build     # typecheck + production build into dist/
npm run preview   # serve the build (service worker is only active here)
```

GitHub Pages serves the game on `main` at the site root. The deploy workflow
(`.github/workflows/pages.yml`) can also build other branches into their own
folders (`PREVIEWS`, for example `camp=<branch>` → `<site>/camp/`). A
preview build (`VITE_PREVIEW=<folder>`) keeps its own save and has no service
worker, so it does not touch the main game's save.

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
  wood, berry bushes give berries; these regrow. Logs, pebbles, mushrooms and
  chests are used up. Springs and the river are fresh water; the sea is too
  salty.
- **Building:** campfire, lean-to and hut, placed in front of you. Sleeping
  in a shelter (or a cave) makes it home and rests you faster. A stone axe
  goes in your bag; a bridge goes across the river in front of you.
- **The camp:** the hut is big work (40 wood, 30 leaves, 20 stone, 8 rope),
  and each island has only one. Walk into it to go inside. Its bed is the
  only place for a full rest: sleep elsewhere stops at 50 Energy in the
  open, 60 in a cave and 75 in a lean-to. In the bed, Health also comes back
  faster. From inside, add rooms: a workshop (rope made there gives one
  more), a hearth (cook fish at home, heal even faster) and a rain barrel
  (drink at home). Each room shows on the hut outside.
- **Exploring:** you start on the home coast. A wall of brambles closes it
  off: chop through with a stone axe (which also gets more wood from trees).
  Behind it is the wild forest, and then a river: build a bridge to reach
  the far side, where most hills and caves are. Further out are more chests.
  On the mountain island, the way up to the peak crosses a ring of rocky
  steps (build a ladder on one) and then a ring of ice walls (hang a
  climbing rope on one). Climbing costs a little Energy.
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
  goal and where you saw cave bears.
- **Fishing:** with the Fishing rod skill you can make a fishing rod. Bump the
  sea while carrying it to fish. Raw fish can't be eaten: cook it next to a
  campfire (tap the grill button above the fire, or use the Build panel).
- **Island goal:** an old boat wreck lies on a beach on the far side.
  Repair it in four steps (hull, mast, sail, supplies) by walking into it
  with what it needs; you can bring things in as many trips as you like.
  The hull needs tar from the old barrels on a little tide islet off the
  coast. A sandbar leads there, but it is dry only at low tide (5–11 and
  17–23 o'clock); if the water comes in while you are on it, you wade back,
  wet and cold.
  Rope for the mast and sail is twisted from leaves (Build panel). The Build
  panel shows the next step. When the boat is ready, walk into it to set
  sail to the second island. You keep your bag, XP, skills and needs.
- **Island 2 (Pine Ridge):** a cold island with a northern forest (spruces,
  birches, apple trees, ferns) and a mountain of cliffs and scree with snow
  on the peak. Snow is cold even in the day: bring wood for a fire. Build a
  signal beacon on the peak in three steps (stone base, wood pile, tinder),
  then light it so a passing ship takes you on board. The tinder needs resin
  from the snowy spruces. The next island is not
  built yet, so you can stay or start a new one.
- **Island stars:** each island has three optional tasks (open every
  chest, catch 5 fish or explore most of the island, go 3 days without
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
    worldgen.ts  island generation: beach, forest, rocky hills and caves (island 2: mountains, scree, snow), bramble wall, river, scenery
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
  sprites/     pixel-art sprites, generated in code (no image files)
    palette.ts   the shared colour palette
    pixel.ts     Sprite grid, outline/shadow helpers, fromRows() for hand-drawn art
    terrain.ts   sand, water, river, grass, rock, cave floor, scree, snow, and all edge transitions (also mixed ones)
    forest.ts    trees, bushes, berry bushes, mushrooms, brambles
    objects.ts   stones, logs, chests, stalagmite, spring, steep steps (rocky step, ice wall) with ladder and rope
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
