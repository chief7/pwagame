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

## How it plays

- **Needs:** Health, Food, Water, Energy and Warmth (0–100). Food and Water
  run down as time passes, Energy while awake, and Warmth drops at night out
  in the open. An empty need slowly drains Health.
- **No harsh endings:** when Health runs out you faint and wake up at home
  the next morning with everything you carried. Animals can't be hurt;
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
- **Exploring:** you start on the home coast. A wall of brambles closes it
  off: chop through with a stone axe (which also gets more wood from trees).
  Behind it is the wild forest, and then a river: build a bridge to reach
  the far side, where most hills and caves are. Further out are more chests.
- **Animals:** crabs pinch if you linger, monkeys snatch food, piglets and
  bats keep their distance, turtles don't mind you. Far from camp live wild
  animals that hurt: wild boars charge at you, snakes bite, wasps chase you
  until you leave the grass, and cave bears swipe. They are why explorers
  faint and wake up back at camp.
- **Food matters:** food runs down fast, and fruit, berries and mushrooms
  fill you up only a little. Cooked fish is by far the best food. Health
  only comes back while Food and Water are both above 50.
- **Skills:** gathering, building and fishing give XP. XP earns skill points
  (the first at 10 XP, each next one 5 XP more), which you spend in the
  Skills panel on three paths: Building (fishing rod, cheaper building),
  Explorer (needs drop slower, night eyes) and Improving (faster regrowth,
  better catches, animal friend, wild sense). Each path is learned in order.
  Wild sense marks in red the ground where an animal would come after you.
- **Fishing:** with the Fishing rod skill you can make a fishing rod. Bump the
  sea while carrying it to fish. Raw fish can't be eaten: cook it next to a
  campfire (Build panel).
- **Saving:** the game saves itself to the browser after every action.

## Controls

- **Touch:** tap next to your explorer to step, or to gather, drink or shoo
  what's there; tap further away to walk there along a known path; press and
  hold to keep walking towards your finger. Walking stops when something new
  comes into view. Tap your explorer to wait a turn. Buttons: Bag (eat, change
  explorer, new island), Build, Skills (a star shows when you have points to
  spend), Sleep.
- **Keyboard:** arrows / WASD / `hjkl` / numpad to move, `.` or `5` wait,
  `i` bag, `b` build, `p` skills, `z` sleep, `Esc` closes panels.

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
    defs/        data registries: items, objects, recipes, animals, skills
    game.ts      actions, turn loop, needs, animals, fainting, sleep, save/load
    needs.ts     the five needs and how they change each turn
    clock.ts     time of day, daylight, phases
    inventory.ts what the explorer carries
    worldgen.ts  island generation: beach, forest, rocky hills and caves, bramble wall, river, scenery
    map.ts       tile grid + explored/visible layers
    fov.ts       recursive shadowcasting field of view
    pathing.ts   BFS distance maps (travel, animals, placement), reach across bridgeable rivers
    actors.ts    player and animal shapes
    rng.ts       seeded PRNG (mulberry32), saveable
  ui/
    renderer.ts  sprite renderer (integer scaling), night lighting, camera
    animator.ts  turns game events into tweens, lunges, flashes, floating text, fades
    input.ts     keyboard mapping and tap/hold direction helper
  main.ts      HUD, Bag/Build/Skills panels, input, render loop, autosave
  sprites/     pixel-art sprites, generated in code (no image files)
    palette.ts   the shared colour palette
    pixel.ts     Sprite grid, outline/shadow helpers, fromRows() for hand-drawn art
    terrain.ts   sand, water, river, grass, rock, cave floor, shore, grass-edge and river-bank transitions
    forest.ts    trees, bushes, berry bushes, mushrooms, brambles
    objects.ts   stones, logs, chests, stalagmite, spring
    palms.ts     palm trees (24×32), with bare versions
    structures.ts campfire (animated), lean-to, hut, bridges
    creatures.ts animals, item icons, raft
    ui.ts        interface icons (globe) and the app icon
    characters.ts  male and female explorer, 4 facings × idle + 2 walk frames
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
