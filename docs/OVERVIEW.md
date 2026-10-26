# pwagame overview

This document describes how the game is built and how its mechanics work.
Read it before you change the code or add content. The numbers here are the
values in the code at the time of writing; the code is the source of truth.

Contents:

1. [What the game is](#1-what-the-game-is)
2. [Architecture](#2-architecture)
3. [The turn](#3-the-turn)
4. [Mechanics](#4-mechanics)
5. [The world](#5-the-world)
6. [Content registries](#6-content-registries)
7. [Sprites and rendering](#7-sprites-and-rendering)
8. [Input](#8-input)
9. [Saving](#9-saving)
10. [Tests](#10-tests)
11. [Tuning reference](#11-tuning-reference)
12. [Known limits](#12-known-limits)
13. [Languages](#13-languages)

---

## 1. What the game is

A turn-based survival game for children, played on a phone in the browser
(a PWA). The player washes up on an island and must keep five needs filled:
Health, Food, Water, Energy and Warmth. The player gathers food and
materials, builds shelters and gets through the nights.

Design rules:

- **No death.** When Health is zero, the player faints and wakes up at camp
  the next morning with all items.
- **No fighting.** Animals can be a nuisance. They cannot be hurt. Walking
  into an animal shoos it away.
- **Short, readable feedback.** Every action gives a log message, and most
  give a floating text or an animation.
- **Mobile first.** All actions work with taps. A keyboard also works.

There is no game engine and no runtime dependency. The code is TypeScript,
built with Vite. The sprites are generated in code (no image files).

---

## 2. Architecture

The code has three layers. Each layer only depends on the layers below it.

```mermaid
flowchart TB
  subgraph UI["UI layer (DOM, canvas)"]
    main["main.ts<br/>HUD, panels, input, render loop, autosave"]
    renderer["ui/renderer.ts<br/>draws the world"]
    animator["ui/animator.ts<br/>plays events as animations"]
    input["ui/input.ts<br/>key and direction helpers"]
  end
  subgraph Logic["Game layer (pure, no DOM)"]
    game["game/game.ts<br/>Game: actions, turn, animals, save"]
    needs["needs.ts"]
    clock["clock.ts"]
    inv["inventory.ts"]
    world["worldgen.ts"]
    support["map.ts · fov.ts · pathing.ts · rng.ts · actors.ts"]
    defs["defs/<br/>items · objects · recipes · animals · skills · levels"]
  end
  subgraph Art["Sprite layer (pure data)"]
    sprites["sprites/<br/>pixel art generated in code"]
  end
  main --> game
  main --> renderer
  main --> animator
  main --> input
  renderer --> sprites
  renderer --> game
  animator --> game
  game --> needs & clock & inv & world & support & defs
```

### Responsibilities

| Module | Responsibility |
|---|---|
| `src/game/game.ts` | The `Game` class. Holds all state. Runs actions and the turn. Sends events. Saves and loads. |
| `src/game/defs/*.ts` | Data registries for items, world objects, recipes, animals, skills and levels (island goals). |
| `src/game/needs.ts` | The five needs and how one turn changes them. |
| `src/game/clock.ts` | Time of day, daylight, day and night phases. |
| `src/game/inventory.ts` | What the player carries (a count per item). |
| `src/game/worldgen.ts` | Makes a new island: terrain, caves, objects. |
| `src/game/map.ts` | The tile grid, plus the "explored" and "visible" layers. |
| `src/game/fov.ts` | Field of view (recursive shadowcasting). |
| `src/game/pathing.ts` | Breadth-first distance maps (8 directions). |
| `src/game/rng.ts` | Seeded random numbers (mulberry32). Its state can be saved. |
| `src/game/actors.ts` | The `Player` and `Animal` shapes and facing helpers. |
| `src/ui/renderer.ts` | Draws terrain, objects, animals, the player, night light and effects on a canvas. |
| `src/ui/animator.ts` | Turns game events into timed animations. |
| `src/ui/input.ts` | Maps keys to commands. Finds a direction from a touch point. |
| `src/main.ts` | Connects everything: HUD, Bag, Build and Skills panels, the grill button above the campfire, the island goal card, the sail question and end screen, touch and keys, render loop, autosave, language switch. |
| `src/game/messages.ts` | The `Msg` type: every log message as data (a key and its arguments). |
| `src/i18n/*.ts` | All text the player sees, in English (`en.ts`) and German (`de.ts`). |
| `src/sprites/*.ts` | All pixel art, made in code from a shared palette. |

### Key rule: the game layer has no DOM

`src/game/` must not use `document`, `window` or the canvas. This keeps all
rules testable with Vitest in Node. The UI reads the game state and calls
game actions. The game tells the UI what happened through **events**.

### Events

Each action can send events. The UI collects them with `game.takeEvents()`
after each action and gives them to the animator.

| Event | Meaning | Animation |
|---|---|---|
| `move` | An actor moved one cell | Slide between cells, walk frames |
| `lunge` | An actor reached towards a cell (gather, shoo, pinch, build, cook at the fire) | Short push towards the target |
| `cast` | The explorer cast the fishing rod towards a sea cell | Fishing pose for 0.7 s (also with reduced motion) |
| `hit` | An actor lost Health | White flash and a red number |
| `float` | Show a number at a cell (`+2 wood`, `+35 water`, `+1 XP`): `amount` and `what` (an item, a need or XP) | Text rises and fades. XP has its own colour (lavender). |
| `sparkle` | Something good happened at a cell (chest, building, skill point, skill learned) | Gold sparkles |
| `fade` | Time jumped (sleep, faint, new island, sailing to island 2) | Screen fades in from dark |

Each event has a `late` flag. `late` is true for events from the animals'
part of the turn. The animator starts late events 90 ms after the player's
events, so the player sees cause before effect.

---

## 3. The turn

The game is turn-based. Time only moves when the player acts. One turn is six
minutes of game time.

```mermaid
sequenceDiagram
  participant P as Player input
  participant G as Game
  participant A as Animals
  participant UI as main.ts / Animator
  P->>G: move / eat / build / sleep / wait
  G->>G: do the action (may fail: no turn passes)
  G->>G: endTurn(): turn + 1
  G->>G: tick needs (shelter, fire, daylight)
  G->>G: warn about low needs
  G->>A: each animal acts (events marked late)
  G->>G: every 50 turns: replace missing animals
  G->>G: Health 0? faint and wake at camp
  G->>G: update field of view
  UI->>G: takeEvents()
  UI->>UI: animate, update HUD, save after 0.8 s
```

### Actions

All actions return `true` when time passed and `false` when nothing happened.

| Action | What it does |
|---|---|
| `move(dx, dy)` | Steps one cell. If something is there, it interacts instead (see below). |
| `travelStep(x, y)` | One step on the shortest known path to a cell. Used for tap-to-travel. |
| `wait()` | Passes one turn. |
| `eat(item)` | Eats one food item from the bag. |
| `feedDog(item)` | Gives the dog one food item from the bag (see 4.13). |
| `build(recipe)` | Builds in front of the player, or makes an item for the bag. |
| `learn(skill)` | Spends skill points on a skill. No turn passes. |
| `sail()` | Leaves the island on the finished goal (see 4.12). |
| `sleep()` | Sleeps for many turns until a stop condition (see 4.4). |

What `move` does when the target cell is not free:

1. **Animal there:** shoo it. The animal runs away for 8 turns (calm animals do not run).
   The stray dog is different: the player adopts it (see 4.13).
   **Your dog there:** swap places with it.
2. **Solid object there:** interact with it:
   - Spring: drink.
   - The island goal (the boat): give it materials (see 4.12).
   - Object with `gather`: gather from it. If it `needs` a tool that the
     player does not carry (bramble: axe), say so. No turn passes.
   - Other object: show its name. No turn passes.
3. **River** (with no bridge): drink, +35 Water.
4. **Sea:** with a fishing rod in the bag, fish (see 4.11). Else show "too
   salty". No turn passes.
5. **Rock:** nothing happens. No turn passes.

---

## 4. Mechanics

### 4.1 Needs

All needs go from 0 to 100. A new game starts with Health 100, Food 80,
Water 80, Energy 90 and Warmth 100.

Change per turn:

| Need | Awake | Asleep |
|---|---|---|
| Food | −0.45 | −0.225 |
| Water | −0.45 | −0.225 |
| Energy | −0.25 | +1.4 × (0.4 + 0.6 × shelter) |
| Warmth | moves towards a target (see 4.3): +1.5 up, −0.6 down | same |
| Health | −1 for each empty need (Food, Water, Energy, Warmth) | same |
| Health | +0.25 if no need is empty and Food and Water are above 50 | +0.5 |

What this means in play (awake, no food or drink):

- Water goes from 80 to 0 in about 180 turns (three quarters of a day).
- Food goes from 80 to 0 in about 180 turns. A day uses about 108 Food:
  11 coconuts, or less than 3 cooked fish.
- Health from animals comes back only while Food and Water are above 50. So
  an explorer who eats badly stays hurt.
- Energy goes from 90 to 0 in about 360 turns (one and a half days).

**Warnings.** When a need goes below 25 (`LOW`), the log shows a warning one
time. The warning resets when the need is above 35 again. The HUD bar of a
low need pulses. The Water warning gives a tip for the island: a spring or a
coconut on island 1, a spring or the river on island 2 (no coconuts there).
The `low` message carries the `level` for this.

### 4.2 Fainting (no death)

When Health is 0 at the end of a turn:

1. The log says the player feels woozy.
2. Time jumps to the next 6:00.
3. The player moves to **home** (the camp).
4. Needs become: Health 50, Food at least 25, Water at least 30, Energy 70,
   Warmth 80.
5. All items stay in the bag.
6. The log gives a hint (`faintWhy`): which needs ran out, with a tip for
   each. If no need was empty, wild animals did it.

**Home** is the last shelter or cave where the player slept. At the start,
home is the start point on the beach.

### 4.3 Warmth, shelter and fire

Warmth moves towards a target value each turn:

- Near a campfire (2 cells or less): target 100.
- Else: target = 100 − (1 − shelter) × ((1 − daylight) × 95 + cold), at
  least 0. `cold` is 40 on snow (`SNOW_CHILL`, island 2) and 0 elsewhere. So
  open snow has a target of 60 by day and 0 at night. A hut or a campfire
  still gives 100. Stepping onto snow logs `snowCold`.

Shelter values:

| Place | Shelter | Night warmth target |
|---|---|---|
| Open ground | 0 | 5 |
| Cave floor | 0.5 | about 52 |
| Lean-to | 0.6 | 62 |
| Hut | 1 | 100 |
| Next to a campfire | (any) | 100 |

### 4.4 Sleep

The player can sleep when Energy is below 95. Sleep repeats turns until one of
these occurs:

- Energy is 100 ("You wake up feeling rested").
- Warmth is below 12 ("Too cold to sleep").
- Food or Water is 0.
- 200 turns have passed.
- The player faints.

When the player sleeps in a shelter or a cave, that cell becomes home.

Time to sleep from Energy 20 to 100:

| Place | Turns | Game hours |
|---|---|---|
| Open ground | about 143 | 14 (the cold usually wakes the player first) |
| Cave | about 82 | 8 |
| Lean-to | about 75 | 7.5 |
| Hut | about 57 | 5.7 |

The UI does not animate each turn of sleep. It shows one `fade` event.

### 4.5 Day and night

- One day is 240 turns. One turn is 6 minutes. A new game starts at 8:00 on day 1.
- Phases: dawn 5:00–7:00, day 7:00–19:00, dusk 19:00–21:00, night 21:00–5:00.
- Daylight is 1 in the day, 0 at night, and changes smoothly at dawn and dusk.
- The view distance is 4 + 4 × daylight cells (8 by day, 4 at night).
- The renderer darkens cells at night. Campfires light 5 cells around them.
  The player always lights a small area around themselves.

### 4.6 Gathering

Walking into an object with `gather` gives items. Each yield has a random
amount (min to max) and can have a chance. After gathering, one of three
things happens:

| `after` | Effect | Examples |
|---|---|---|
| `{ regrow: n }` | The object stays. It gives items again after n turns. It shows its `depletedSprite` until then. | palms, trees, bushes, berry bushes |
| `{ remove: true }` | The object is gone. | logs, driftwood, pebbles, mushrooms |
| `{ becomes: kind }` | The object turns into another object. | closed chest → open chest |

Two optional fields use tools:

- `needs: item`: the player must carry this item to gather at all. A
  bramble needs the axe. Brambles are removed and never come back.
- `bonus: { tool, item, amount }`: extra items when the player carries the
  tool. Trees give 1 more wood with the axe.

Tools (`tool: true` on the item) stay in the bag. They are never used up.

### 4.7 Eating and drinking

- **Eat** from the Bag panel. Each food adds to Food, Water and/or Energy.
  The player cannot eat when Food is 98 or more, unless the food also gives Water.
- **Drink** by walking into a spring or the river: +35 Water. Not possible
  when Water is 98 or more.
- The sea cannot be used for drinking.

### 4.8 Building

The Build panel lists all recipes. A recipe needs items. The building goes:

1. In front of the player (the facing direction), if the cell is free floor.
2. Else in the first free neighbour cell.

A solid building (for example a campfire) is not placed where it would cut
off part of the island. This check counts brambles as open and rivers as
crossable (as if every bramble were cleared and every bridge built).
Shelters (`walkable`) can be placed anywhere free, and the player can walk
into them.

Special recipes:

- **Items** (`makes` instead of `builds`): the item goes into the bag. A
  tool cannot be made when the player already has one (`haveTool`).
- **Skill** (`skill`): the recipe needs a skill (fishing rod). The Build
  panel shows the recipe with a note until the skill is learned.
- **At the fire** (`atFire`): the player must be within a campfire's warmth
  (2 cells). Cooking fish works this way, with the message `cook`.
- **Handy builder:** with this skill, a recipe that needs wood costs 1 wood
  less. `game.recipeCost(id)` gives the cost after skills. Always use it,
  not `RECIPES[id].cost`.
- **Bridge** (an object with `bridge: true`): it goes straight ahead, in the
  facing direction. The cells in front must be river, 1 to 3 cells
  (`BRIDGE_SPAN`), with free ground after them. The bridge fills all those
  cells. Facing left or right builds `bridge_ew`, else `bridge_ns`. If
  there is no such river, the message is `noBridgeSpot`.

### 4.9 Animals

Animals have a **temper**. They only react when the player is within their
`notice` range and in view.

| Temper | Behaviour when the player is near | Animals |
|---|---|---|
| `calm` | Ignores the player. | turtle |
| `shy` | Moves away from the player. | piglet, bat, rabbit |
| `grumpy` | If next to the player: `hitChance` (default 50%) per turn to hurt (−`damage` Health), then runs away for `fleeAfter` turns (default 4). | crab (−4), snake (70%, −8), cave bear (50%, −20) |
| `cheeky` | If the player carries food: comes near and takes one food item, then runs away for 12 turns. It does not take food that the goal's current stage still needs (for example the coconuts and cooked fish for the boat supplies), only the extra food. | monkey, squirrel |
| `stray` | Stays near its place (`notice` 0). Walking into it with food adopts it (see 4.13). | stray dog |
| `charger` | Runs at the player, 2 cells per turn (`CHARGE_STEPS`), with the message `alert`. When it starts a turn next to the player, it knocks them over (−`damage` Health), then trots off for 10 turns. | wild boar (−12), mountain goat (−10) |
| `chaser` | Follows the player for 6 turns (`CHASE_TURNS`, stored as `chase` on the animal) and stings each turn it is next to them (−3 Health). It gives up at once when the player stands off its habitat (sand, cave, shelter). Then it flies off for 8 turns. | wasps |

**Islands.** `islands` lists the islands (levels) where an animal lives
(default `[1]`). `islandAnimals(level)` gives the list. Island 1: crab,
turtle, monkey, piglet, bat, boar, snake, wasps, bear. Island 2: crab, bat,
boar, wasps, bear, rabbit, squirrel, mountain goat.

**Wild animals** (`wild: true`: boar, snake, wasps, cave bear, mountain goat) only appear
at least `minHomeDistance` (25) cells from home. A new hurt message is
`hurt`, with a text for each animal in `src/i18n/`. Crabs keep `pinch`.

Other rules:

- Animals only walk on their `habitat` tiles. They never enter objects or the player's cell.
  No habitat has river tiles, so animals never cross the river, also not on bridges.
- When they do not react, they wander (chance per turn = `wander`).
- Shooed animals run away for 8 turns.
- Animals do not act on the player while the player sleeps. Sleep also ends a wasp chase.
- `game.noticeRange(kind)` gives the notice range after skills.
- Every 50 turns, the game adds one animal of each kind that is below its
  `population`, out of the player's view.

### 4.10 Experience and skills

The player gets XP (experience):

| Action | XP |
|---|---|
| Gather from an object | 1 |
| Build or make a recipe | 1 for each item in its cost (campfire 5, hut 22, cook a fish 1) |
| Catch a fish | 2 |
| Give an item to the island goal (the boat) | 1 for each item |

Each XP gain sends a `float` event (`what: { xp: true }`) next to the other
floating text.

**Skill points.** The first point needs 10 XP. Each next point needs 5 XP
more than the one before: 10, 25, 45, 70, 100 XP in total
(`xpForPoints`, `pointsForXp` in `skills.ts`). Points are not stored: free
points = points earned from XP − cost of the learned skills. When a point is
earned, the log says so (`skillPoint`) and the player sparkles.

**Skills.** Three paths: Building (skills to build things), Explorer (skills
that change the explorer) and Improving (skills that make things work
better). In a path, a skill needs the skill before it. The first two skills
on a path cost 1 point, the third and fourth cost 2.

| Path | Skill | Effect | Where |
|---|---|---|---|
| Building | Fishing rod | Unlocks the fishing rod recipe | `recipes.ts` (`skill`) |
| | Handy builder | Recipes cost 1 wood less | `Game.recipeCost()` |
| Explorer | Small sips | Water drops 20% slower | `needs.ts` (`thirst`) |
| | Small appetite | Food drops 20% slower | `needs.ts` (`hunger`) |
| | Thick skin | Warmth drops 30% slower | `needs.ts` (`chill`) |
| | Night eyes | Up to 2 more cells of sight at night | `Game.sightRadius` |
| Improving | Green thumb | Plants regrow in 70% of the time | `Game.interact()` |
| | Patient angler | Bite chance 40% → 70% | `Game.fish()` |
| | Animal friend | Crabs do not pinch, monkeys do not take food. Wild animals notice the player 2 cells later (at least 1) | `Game.noticeRange()`, `Game.animalAct()` |
| | Wild sense | A red tint with a red border marks the cells where a visible animal would come after the player or hurt them | `Game.dangerCells()`, `renderer.ts` |

The Skills panel shows the free points, an XP bar to the next point, and each
path. The Skills button shows a star when there are free points.

### 4.11 Fishing and cooking

- Walking into the sea with a fishing rod in the bag casts the line (a
  `cast` event: the explorer shows the fishing pose). One turn passes.
- Chance of a bite: 40%, or 70% with Patient angler. A catch gives 1 raw fish
  and 2 XP. Else the log says "Nothing bites".
- The river is only for drinking. Fishing works only in the sea.
- Raw fish (`raw: true`) cannot be eaten. The recipe "Cook a fish" (1 fish,
  at a campfire) makes a cooked fish: +40 Food, +10 Energy. This is the best
  food on the island (coconut 10, berries 7, mushroom 9), so fishing is the
  way to stay well fed.
- **Grill button.** While the recipe can be made (raw fish in the bag, a
  campfire within 2 cells), `main.ts` shows a round button above the nearest
  visible fire (`game.nearestFire()`). It shows `ui_grill` / `ui_grill_2`
  (220 ms each), an ember glow and the number of raw fish. A tap (or the `g`
  key) runs `game.build('cooked_fish')`, and the icon shakes. The button
  follows the fire as the camera moves (`renderer.cellTop()`), and stays
  inside the map view. With reduced motion, the icon, glow and shake stay
  still. Cooking sends a `lunge` towards the fire.

### 4.12 The island goal (levels)

Each island is a **level** with one big goal: something the player builds
in stages to leave the island. `src/game/defs/levels.ts` (`LEVELS`) holds
each level's `biome` (how world generation shapes it, see §5), its goal
object (`site`) and its stages. Two levels exist: 1 (`tropical`) and 2
(`mountain`).

Level 1: an old boat wreck (`boat_wreck`) lies on a beach of the far side.

| Stage | Cost | The boat becomes |
|---|---|---|
| Hull | 20 wood, 6 stone | `boat_hull` |
| Mast | 10 wood, 6 rope | `boat_mast` |
| Sail | 12 leaves, 3 rope | `boat_sail` |
| Supplies | 4 coconuts, 3 cooked fish | `boat_ready` |

Rope is a recipe: 2 leaves make 1 rope. All stages together need 30 wood,
6 stone, 30 leaves, 4 coconuts and 3 cooked fish (about three huts, and
fishing).

How it works:

- When the boat first comes into view, the log says so (`goalFound`).
- Walking into the boat gives it everything from the bag that the current
  stage still needs. Each item floats as a minus number and gives 1 XP.
  `game.goalGiven` stores what the stage already got, so the player can
  bring things in many trips. If the bag has nothing it needs, the log
  lists what is missing (`goalNeeds`) and no turn passes.
- When a stage is complete, the object becomes the next kind, with
  sparkles. Objects with `goal: true` are goal objects; the stage is
  found from the kind (`goalProgress()`), so it is not stored separately.
- Walking into the finished goal sets a flag that the UI reads with
  `game.takeSailRequest()`. The UI asks the level's question ("Set sail?",
  "Light the beacon?"). `game.sail()` logs `sailAway` and sends a `fade`.
- **The boat trip.** Before the UI calls `sail()` on level 1, it plays the
  boat sailing away for 1.6 s (`DEPART_MS`): `boatTrip()` in `main.ts` picks
  the straight line from the boat with the fewest cells to the sea, and
  `renderer.departure` draws `boat_away_<body>` with the explorer on board
  while the camera follows it. Input is ignored during the trip. With
  reduced motion there is no trip, only the fade.
- **On level 1**, `sail()` then lands the player on level 2 (`landOn()`): a
  new island from `generateWorld(…, 2)`, the player on its start point
  (also the new home), new animals for that island, `goalGiven` cleared,
  and the clock at 8:00 the next day. The bag, XP, skills and needs stay.
  The log says `landIsland`. `sailed` stays false.
- **On the last level** (2), `sail()` sets `sailed`. The beacon then burns
  (`done.frames` of `beacon_ready`: `beacon_lit`, `beacon_lit_2`) and lights
  7 cells at night (`done.lightRadius`); it does not warm. The end screen says
  that a ship took the player on board and the next island comes soon. The
  player can stay on the island or start a new island.
  `nextLevel(level)` gives the next level, or null on the last one.
- `game.goal()` gives the state for the goal card at the top of the Build
  panel: `missing` (an old island without a boat), `find`, `build` (with
  the stage and what it still needs), `ready` or `sailed`. The words for
  each level are in `Strings.levels`.

Level 2 (Pine Ridge): an old stone ring (`beacon_site`) stands on the
highest snow of the mountain. The player builds a signal beacon on it.

| Stage | Cost | The beacon becomes |
|---|---|---|
| Stone base | 16 stone | `beacon_base` |
| Wood pile | 18 wood, 4 rope | `beacon_pyre` |
| Tinder | 12 leaves, 4 wood | `beacon_ready` |

All stages together need 22 wood, 16 stone and 20 leaves (8 of them for
rope). There are no coconuts on island 2: apples, berries, mushrooms and
fish are the food there.

### 4.13 The dog

Each island has one stray dog (`dog`, temper `stray`, on grass, 25 or more
cells from camp) until the player has a dog.

- **Adopt.** Walk into the stray dog with food in the bag. It eats one
  item (raw fish first, else the food with the least Food) and becomes
  `game.dog`. Without food, the log says `dogSniff` and no turn passes.
  After that, no new stray dog appears.
- **Follow.** The dog acts first in the animals' part of the turn
  (`dogAct`). It steps towards the player when it is more than 1 cell away.
  More than 12 cells away (`DOG_LOST`), it jumps next to the player. It
  also comes along after fainting and to the next island
  (`dogToPlayer`). Walking into the dog swaps places with it. Animals and
  buildings cannot use its cell.
- **Bark.** When a visible animal with `scaredByDog` (crab, monkey,
  squirrel, snake) is within 3 cells (`DOG_BARK_RANGE`) and is not already
  running, the dog barks (`dogBark`, a `lunge`). All such animals within 3
  cells run away for 8 turns (`SHOO_TURNS`). Boars, goats, wasps and bears
  do not care.
- **Needs.** The dog has Food and Water (0 to 100). Each turn, Food drops
  0.3 and Water 0.35 (`DOG_HUNGER`, `DOG_THIRST`; half while the player
  sleeps). Below 25, the log warns one time (`dogLow`).
- **Food.** "Feed dog" in the Bag panel (`feedDog`) gives the item's Food
  value. Raw fish gives 30 (`DOG_RAW_FISH`). The dog must be within 2 cells
  (`DOG_REACH`), else `dogFar`. At 98 Food or more, `dogFull`.
- **Water.** The dog drinks (+50, `DOG_DRINK`) when the player drinks
  within 3 cells of it, and by itself when it stands next to a spring or
  the river with Water below 80.
- **Tired.** When Food or Water is 0, the dog is tired (`dogTired`). It
  trails behind every other turn, stays up to 2 cells away, does not bark
  and shows `dog_rest`. It never dies. When Food and Water are both above 0
  again, it is happy again (`dogBack`).
- **Sleep.** When the player sleeps, the dog comes next to the player
  (`dogToPlayer`) and lies down (`napping`, shows `dog_rest`). It gets up on
  the first turn after the player wakes. Saves from before have no
  `napping`; that means awake.
- The Bag panel shows a dog row with its Food and Water, and a "Feed dog"
  button on each item the dog can eat.

---

## 5. The world

`generateWorld(rng)` makes one island, 104 × 80 cells. The same seed always
makes the same island.

Tiles: `Water`, `Sand`, `Grass`, `Rock` (blocks movement and sight),
`CaveFloor` and `River` (fresh water: blocks movement, not sight).
`map.isWet()` is true for sea and river; `map.isLand()` is the opposite.

Steps:

1. **Landmass.** Random land, more likely near the centre, then 5 smoothing
   passes (cellular automaton). A 2-cell ring of water stays at the edge.
2. **Clean the coast.** Remove land that the shore tiles cannot draw (land
   with water on opposite sides, or water only on two corners). Keep only the
   largest landmass. Repeat until nothing changes. The island must be at
   least 42% of the map, else start again.
3. **Biomes.** Measure each land cell's distance from the sea.
   - Distance below 3 to 5 (with noise): beach (`Sand`).
   - Further in: forest (`Grass`). Clean grass edges the same way as the coast.
   - Distance 5 or more and high "hill" noise: `Rock`. Inside rock, "cave"
     noise makes `CaveFloor`.
   - Cave floor needs rock around it, else it becomes grass. Grass never
     touches the sea.
4. **Start point.** A random sand cell with free floor on all 8 sides.
5. **Connect.** Any floor that the start cannot reach gets a tunnel. The
   tunnel follows the shortest path through land and turns rock into cave floor.
6. **Regions.** Measure the walking distance (8 ways) from the start to all
   floor. Two distances split the floor into three regions:
   - **Home coast** (region 0): the nearest 38% of the floor (`HOME_SHARE`).
   - **Wild forest** (region 1): up to 70% (`FOREST_SHARE`).
   - **Far side** (region 2): the rest. It must be at least 15%.

   All floor at exactly the first distance gets a **bramble**. All floor at
   the second distance and one more becomes **river**, 2 cells wide. Each
   step changes the distance by at most 1, so every way out of a region must
   cross its band. Then the banks are cleaned: no land strip one cell thin
   between water, and no grass that touches both river and sand (that grass
   becomes sand). The island is made again if the far side is too small, or
   if some floor cannot be reached with bridges of up to 3 cells
   (`reachWithBridges` in `pathing.ts`).
7. **Objects.** The brambles come first. Each other free floor cell can get
   one object, with chances per biome (`SCATTER`). Forest density follows a
   noise map, so trees form groves. Cells next to the river (4 ways) stay
   free, so a bridge always has a place to land. An object is not placed if
   it cuts off part of the island (brambles count as open, rivers as
   bridgeable). A fast local test skips the full check when the open cells
   around the new object still touch each other. Then the generator adds 8
   springs (forest or cave, at least 2 on the home coast) and 8 chests
   (2 home, 3 forest, 3 far side; 10 or more cells from the start).
   The island goal (the boat wreck) is placed first, before the scatter: on
   a sand cell next to the sea, in the far side if possible
   (`GOAL_REGIONS`: far side, then forest, then home coast). Its 8
   neighbour cells stay free, so the big sprite is not hidden by trees.
8. **Animals.** `Game` adds each animal kind of the island
   (`islandAnimals`) up to its population, on its habitat, 8 or more cells
   from the start. Animals in other regions stay there.

### Island 2: forest and mountains

`generateWorld(rng, width, height, 2)` uses the same steps, with these
changes (`biome: 'mountain'`):

- **Biomes** (`addMountains`). The beach is narrower (`MOUNTAIN_BEACH_WIDTH`,
  2 cells, plus noise). The height of a cell is 0.6 × its distance from the
  sea (scaled to 0..1) + 0.4 × a ridge noise (`1 − |2n − 1|`, which makes
  long ridges). Of the inland cells (5 or more from the sea), the lowest
  60% stay forest (`FOREST_LINE`). Above that is mountain: "cliff" noise
  makes `Rock` (sometimes with `CaveFloor` inside), else walkable `Scree`.
  The top 7% are `Snow` (`SNOW_LINE`), with some rock.
- **Cleaning** (`cleanGrass`). Cave floor needs rock around it, else it
  becomes scree. Snow never touches grass (it becomes scree). Thin strips
  of grass become sand near the beach and scree in the hills. Thin strips
  of snow become scree.
- **Tunnels** from the connect step are `Scree` (mountain passes), not cave
  floor.
- **Regions, brambles and the river** are the same as on island 1. The
  river often runs down through the mountain.
- **The goal** (`beacon_site`) goes on the highest snow cell that has at
  least 5 floor neighbours (`GOAL_OPEN_SIDES`), so the player can walk up
  to it. If no such cell exists, the island is made again.
- **Scatter** uses the `mountain` table of `SCATTER`: driftwood and pebbles
  on the beach; spruce, birch, apple tree, broadleaf tree, fern, bushes and
  mushrooms in the forest; pebbles, boulders and some spruces on scree;
  snowy spruces and boulders on snow. There are no palms. Springs can also
  be on scree.

A typical island 2 has about 1,700 forest, 450 scree, 250 rock and 100 snow
cells. Generation takes 0.1 to 0.3 seconds.

A typical island has about 3,100 floor cells (about 1,150 home, 1,000 forest,
850 far side), 50 to 200 river cells and 50 to 80 brambles. Generation
takes 0.1 to 0.3 seconds.

---

## 6. Content registries

All content is data. To add content, add one entry to a registry and one
sprite. The sprite test fails if a sprite is missing.

| Registry | File | Sprite name | Used by |
|---|---|---|---|
| Items | `src/game/defs/items.ts` (`ITEMS`) | `item_<id>` | Bag panel, recipes, gathering, eating |
| World objects | `src/game/defs/objects.ts` (`OBJECTS`) | `<kind>`, plus `depletedSprite` and `frames` if set | World, gathering, shelter, fire |
| Recipes | `src/game/defs/recipes.ts` (`RECIPES`) | the sprite of the object it builds | Build panel |
| Levels | `src/game/defs/levels.ts` (`LEVELS`) | the sprites of the goal objects | Island goal (see 4.12) |
| Animals | `src/game/defs/animals.ts` (`ANIMALS`) | `animal_<kind>` | Spawning, animal behaviour |

The registries hold no text. Names, gather texts and other words for each
entry are in `src/i18n/en.ts` and `src/i18n/de.ts` (see §13). TypeScript
gives an error if a language does not have words for an entry.

### Items

```ts
coconut: { id: 'coconut', eat: { food: 10, water: 18 } },
```

- `eat` is optional. With `eat`, the item is food and shows an Eat button.
- `tool: true` marks a tool: it is kept in the bag, and only one can be made.
- `raw: true` marks food that must be cooked first. The Bag panel says so.
- Also add the id to the `ItemId` type.

### World objects

| Field | Effect |
|---|---|
| `walkable` | The player can walk into it (shelters). Animals cannot. |
| `blocksSight` | Blocks the field of view (trees, boulders). |
| `gather` | `yields` and `after` (see 4.6). The gather text ("You shake the palm tree") is in `src/i18n/`. |
| `depletedSprite` | Sprite while waiting to regrow. |
| `drink` | Water per drink. |
| `shelter` | 0 to 1. Warmer nights, faster sleep, becomes home. |
| `warmthRadius` | Warms the player within this many cells. |
| `lightRadius` | Lights cells at night. |
| `frames` | Sprite names for an animation (2 frames, 220 ms each). |
| `bridge` | Built across river cells (see 4.8). The player can walk on it. |
| `goal` | The island goal: walking into it gives it materials (see 4.12). |
| `done` | A finished goal after `sail()` (the lit beacon): `frames` to show instead and its `lightRadius`. |

Also add the kind to the `ObjectKind` type.

To put a new object in the world, add it to `SCATTER` in `worldgen.ts` with
a chance per biome. Or make it buildable with a recipe.

### Recipes

```ts
campfire: { id: 'campfire', builds: 'campfire', cost: { wood: 3, stone: 2 } },
axe: { id: 'axe', makes: 'axe', cost: { wood: 2, stone: 2, leaves: 1 } },
```

A recipe has `builds` (an object) or `makes` (an item for the bag).
Optional: `skill` (a skill must be learned first) and `atFire` (the player
must be next to a campfire).

### Skills

`src/game/defs/skills.ts` has `PATHS` (each path's skills, in order) and the
skill point thresholds. A skill's cost comes from its place in the path
(1, 1, 2, 2). The effect of a skill is code where it applies: check it with
`game.has(id)`. Names and descriptions are in `src/i18n/` (`skills`,
`paths`). The path icons are `ui_path_<path>`.

### Animals

```ts
crab: { kind: 'crab', temper: 'grumpy', habitat: [Tile.Sand], notice: 2, wander: 0.4, population: 6 },
```

Also add the kind to the `AnimalKind` type. A new temper needs new code in
`Game.animalAct()`.

### Current content

| Type | Entries |
|---|---|
| Items | coconut, berries, mushroom, cooked fish, apple (food; apple 12 food, 8 water); wood, leaves, stone, fish, rope (materials; fish is raw); stone axe, fishing rod (tools) |
| Objects | 3 palms, broadleaf and pine trees, bush, berry bush, mushroom, 3 stones, stalagmite, 3 logs, chest (closed and open), spring, campfire, lean-to, hut, bramble, bridge (2 directions), boat (wreck, hull, mast, sail, ready). Island 2: spruce, snowy spruce, birch (wood, 50% a leaf), apple tree (1–3 apples, regrows in 200 turns), fern (1–2 leaves, regrows in 90 turns), beacon (site, base, pyre, ready) |
| Recipes | campfire (3 wood, 2 stone), lean-to (4 wood, 5 leaves), hut (10 wood, 8 leaves, 4 stone), stone axe (2 wood, 2 stone, 1 leaves), rope (2 leaves), bridge (6 wood, 3 leaves), fishing rod (3 wood, 2 leaves; needs the skill), cook a fish (1 fish; at a campfire) |
| Skills | Building: fishing rod, handy builder. Explorer: small sips, small appetite, thick skin, night eyes. Improving: green thumb, patient angler, animal friend, wild sense |
| Levels | 1: repair the boat (hull, mast, sail, supplies). 2: build a signal beacon on the peak (stone base, wood pile, tinder) |
| Dog | A stray dog on each island; adopt it with food. It follows you, barks crabs, monkeys, squirrels and snakes away, and needs food and water (see 4.13) |
| Animals | Island 1: crab, turtle (beach); monkey (forest and beach); piglet (forest); bat (caves); wild: boar, wasps (forest), snake (forest and beach), cave bear (caves). Island 2: crab, rabbit (shy, forest), squirrel (cheeky, forest), bat; wild: boar, wasps, cave bear, mountain goat (charger, scree and snow) |

---

## 7. Sprites and rendering

### Sprites

- All sprites are made in code in `src/sprites/`. There are no image files.
- Every colour comes from `palette.ts`, so the set looks consistent.
- A `Sprite` is a grid of colours (null is transparent).
- `fromRows()` builds a sprite from text rows (one character = one pixel).
  Use it for hand-drawn art (chests, characters, animals).
- Shape helpers draw shaded ellipses and blobs (rocks, foliage).
- `outline()` adds a 1 px dark outline. `shadow()` adds a soft ground shadow.
  Call `outline()` first.
- Sizes: terrain tiles are 16 × 16. Most objects are 16 × 16. Palms and trees
  are 24 × 32, the boat 24 × 30, the hut and the beacon 24 × 28, the lean-to
  20 × 20 and the fishing pose 32 × 24. All are drawn bottom-centre on their
  cell, so tall sprites overlap the cell above.
- **Transition tiles** are 12 tiles per set: 4 edges, 4 outer corners and 4
  inner corners. `transitionTileName()` picks one from the neighbour cells.
  The sets:

  | Cell | Next to | Set |
  |---|---|---|
  | Sand | sea or river | `shore_*` |
  | Grass | sand / river / scree | `grass_*` / `bank_*` / `grass_scree_*` |
  | Snow | scree / river | `snow_*` / `snow_bank_*` |
  | Scree | river | `scree_bank_*` |
  | Cave floor | river | `cave_bank_*` |
  | River | sea | `mouth_*` (2 frames: `mouth_*`, `mouth2_*`) |

  The renderer asks `edgeTileName()` for every cell. When a cell is next to
  more than one kind (for example grass with sand on one side and scree on
  another), it gets a mixed tile `mix_<ground>_<8 letters>` (one letter per
  neighbour). `mixedTile()` paints it on first use: each pixel takes the edge
  band of its nearest side. The bands are the same functions that paint the
  sets. Scree and snow keep hard edges against rock and cave floor (cliffs).
- The river has 2 frames (`river`, `river_2`), 220 ms each.
- Characters have 4 facings × 3 frames (stand, step 1, step 2). The left
  facing is the right facing, mirrored. Each facing also has a fishing pose
  (`<body>_<facing>_fish`), shown while the `cast` event plays.
- **Animals** are drawn facing right (or straight at you). `animal()` in
  `creatures.ts` makes 6 sprites from one drawing: `animal_<kind>`,
  `_step1`, `_step2`, and the same three mirrored (`animal_<kind>_left…`).
  The step frames lift every other leg (the lowest row). The bat and the
  wasps flap their wings instead, and the snake sways its tail. Walking
  animals and the dog show step frames and do not hop; the bat and the
  wasps still hop a little. An animal turns only when it moves left or
  right (`tryStep`), so it keeps its side when it moves up or down.
- The gallery page (`/sprites.html`) shows every sprite.
- The preview page (`/preview.html?show=…`) shows chosen sprites in close-up,
  their animation frames, and a scene at game size next to existing sprites.
  The `add-content` skill uses it for proposals. Parameters: `show` (sprites,
  comma-separated; join animation frames with `|`), `bg` (ground tile),
  `compare` (existing sprites), `ms` (time per frame).

### Renderer

`Renderer.render(game, animator, now)` draws one frame:

1. Fill with fog colour.
2. Terrain for all explored cells. The sea tiles change every 750 ms, the
   river tiles every 220 ms.
3. Row by row, top to bottom: objects, then animals and the player in that
   row. This makes tall sprites overlap correctly.
4. Night darkness per cell, with light from campfires and the player.
5. Dim for remembered cells (explored, not visible). Fog for unknown cells.
6. Sparkles and floating texts.
7. The fade overlay (after sleep or faint).

Pixels stay sharp: the scale is a whole number, chosen so a phone shows about
12 cells across (maximum 48 CSS px per cell).

### Animator

The animator keeps short-lived effects keyed by time. The renderer asks it
for each actor's pose (position, walk frame, hop, flash). With
`prefers-reduced-motion`, movement snaps, and there is no bobbing, water or
fire animation. Flashes and floating texts stay.

The render loop runs at full frame rate while the animator is busy, and every
100 ms when not (for water, fire and idle bobbing).

---

## 8. Input

| Input | Result |
|---|---|
| Tap a neighbour cell | Step, or interact with what is there |
| Tap the player | Wait one turn |
| Tap a far explored cell | Walk there along the shortest known path |
| Tap a far cell that cannot be reached | Step in that direction |
| Press and hold (280 ms) | Walk towards the finger until release. Moving the finger steers. |
| Bag / Build / Skills / Sleep buttons | Open the panels, or sleep |
| Grill button (above a campfire, with raw fish) | Cook one fish |
| Feed dog (Bag panel) | Give the dog one item |
| Walk into your dog | Swap places with it |
| 🌐 button (Bag panel and explorer picker) | Switch between English and German |
| Keys | Arrows, WASD, `hjkl`, numpad: move. `.` or `5`: wait. `i`: bag. `b`: build. `p`: skills. `g`: grill a fish at the fire. `z`: sleep. `Esc`: close a panel. |

Auto-walk (travel and hold) stops when:

- An animal that was not in view comes into view.
- The log shows a warning.
- The path is blocked or the player arrives.

---

## 9. Saving

- `main.ts` saves `game.toSave()` as JSON in `localStorage` (`pwagame.save`)
  0.8 s after each action, when the page is hidden, and on `pagehide`.
- On start, the game loads the save. If the save is missing or broken, a new
  island starts.
- The save holds: seed, random number state, turn, tiles, explored cells,
  objects, animals, player, home, needs, inventory, XP, learned skills,
  level, what the goal's stage already got (`goalGiven`), `sailed`, the dog,
  warnings and the last 30 log lines. It is about 30 KB (15 KB on islands from before the larger
  size). The save keeps the island size, so old saves load their old,
  smaller island without brambles or river.
- `SAVE_VERSION` is 6. **If you change the shape of the save, increase
  `SAVE_VERSION`** and decide how to handle old saves. Version 6 added
  `dog` (null before you adopt one); version 5 saves load without a dog.
  Version 4 saves load
  with `sailed: false`: they had only one island, so a player who already
  sailed walks into the finished boat again and can sail to island 2. The
  tiles of island 2 (`Scree` 6, `Snow` 7) need no change to the save
  shape. Version 3 saves load
  at level 1, but their island has no boat: the goal card tells the player
  to start a new island. Version 2 saves load with 0 XP and no skills. Version 1 saves also load: their log lines were
  English text and become `legacy` messages.
- The chosen explorer (female or male) is saved as `pwagame.body`.
- The language is saved as `pwagame.lang`.
- The Bag panel has "New island" and "Reset all progress" (tap two times to
  confirm each). Reset also forgets the chosen explorer and shows the
  explorer picker again. The language stays.

**Test a special situation in the browser.** You can start the game in any
state: edit a save and load it before the game starts. The game saves on
`pagehide`, so do not edit `localStorage` and then reload the same page (the
game writes its own state over your edit). Instead, inject the edited save
before the page loads, for example with Playwright:

```js
await page.addInitScript((json) => {
  if (!sessionStorage.getItem('injected')) {
    localStorage.setItem('pwagame.save', json);
    sessionStorage.setItem('injected', '1');
  }
}, JSON.stringify(editedSave));
await page.goto('http://localhost:5173/');
```

Useful edits: move `player.x` / `player.y`, set `turn` (for example 140 is
22:00 on day 1), set `explored` to all `"1"`, and add objects to `objects`
as `[cellIndex, kind]` (cellIndex = y × width + x).

---

## 10. Tests

Run `npm test`. The tests are in:

| File | What it checks |
|---|---|
| `src/game/game.test.ts` | Island generation (all floor reachable, all edges drawable, biomes present, the boat on a far-side beach; island 2: scree and snow, the beacon on the peak, mountain edges drawable), the island goal (stages, many trips, sailing to island 2, the beacon), snow cold, the dog (adopt, follow, swap, bark, feed, drink, tired, faint, sailing, saves), clock, needs, gathering and regrowing, eating, drinking, building, sleeping, fainting, animals, XP and skills, fishing and cooking, saving, events |
| `src/sprites/sprites.test.ts` | Each sprite is valid. Each item, object and animal has its sprites. Each possible neighbour pattern has a transition tile. |
| `src/ui/animator.test.ts` | Movement tweens, late events, reduced motion, walk frames |
| `src/i18n/i18n.test.ts` | Every message works in both languages; German articles, cases and adjective endings; English text is unchanged; browser language choice |

To add content, use the `add-content` skill (`.claude/skills/add-content/`).
It makes a proposal with rendered sprites first, and builds only after
approval.

Also run `npm run build` (typecheck and build) before you commit.

---

## 11. Tuning reference

| Value | Where | Now |
|---|---|---|
| Need rates | `needs.ts` → `RATES` | see 4.1 |
| Low-need warning | `needs.ts` → `LOW` | 25 |
| Night cold | `needs.ts` → `warmthTarget()` | 95 |
| Day length | `clock.ts` → `TURNS_PER_DAY` | 240 turns |
| Cave shelter | `game.ts` → `CAVE_SHELTER` | 0.5 |
| Animal damage and hit chance | `animals.ts` → `damage`, `hitChance`, `fleeAfter` | crab 4, snake 8, boar 12, wasps 3, bear 20 |
| Default hit chance, flee after a hit | `game.ts` → `HIT_CHANCE`, `FLEE_AFTER_HIT` | 0.5, 4 turns |
| Charge speed, chase length | `game.ts` → `CHARGE_STEPS`, `CHASE_TURNS` | 2 cells, 6 turns |
| Animal friend notice cut | `game.ts` → `FRIEND_NOTICE_LESS` | 2 cells |
| Wild animals from camp | `animals.ts` → `minHomeDistance` | 25 cells |
| Health regen threshold | `needs.ts` → `RATES.healthRegenAbove` | 50 |
| Animal top-up | `game.ts` → `RESPAWN_EVERY` | 50 turns |
| Longest sleep | `game.ts` → `SLEEP_LIMIT` | 200 turns |
| Island size | `worldgen.ts` → `WORLD_WIDTH`, `WORLD_HEIGHT` | 104 × 80 |
| Region sizes | `worldgen.ts` → `HOME_SHARE`, `FOREST_SHARE`, `MIN_FAR_SHARE` | 0.38, 0.7, 0.15 |
| Springs and chests | `worldgen.ts` → `SPRINGS`, `HOME_SPRINGS`, `CHESTS` | 8, 2, [2, 3, 3] |
| Bridge span | `pathing.ts` → `BRIDGE_SPAN` | 3 cells |
| Island goal stages | `levels.ts` → `LEVELS` | see 4.12 |
| Where the goal goes | `worldgen.ts` → `GOAL_REGIONS` | far side, forest, home |
| River drink | `game.ts` → `RIVER_DRINK` | 35 |
| Snow cold | `game.ts` → `SNOW_CHILL` | 40 |
| Dog hunger, thirst | `game.ts` → `DOG_HUNGER`, `DOG_THIRST` | 0.3, 0.35 per turn |
| Dog start, raw fish, drink | `game.ts` → `DOG_START_FOOD`, `DOG_START_WATER`, `DOG_RAW_FISH`, `DOG_DRINK` | 40 (+ the snack), 60, 30, 50 |
| Dog ranges | `game.ts` → `DOG_REACH`, `DOG_DRINK_RANGE`, `DOG_BARK_RANGE`, `DOG_LOST` | 2, 3, 3, 12 cells |
| Shoo and bark | `game.ts` → `SHOO_TURNS` | 8 turns |
| Island 2 beach, forest line, snow line | `worldgen.ts` → `MOUNTAIN_BEACH_WIDTH`, `FOREST_LINE`, `SNOW_LINE` | 2, 0.6, 0.93 |
| Island 2 goal room | `worldgen.ts` → `GOAL_OPEN_SIDES` | 5 |
| XP per gather, per fish | `game.ts` → `GATHER_XP`, `CATCH_XP` | 1, 2 |
| Skill point thresholds | `skills.ts` → `FIRST_POINT_XP`, `POINT_XP_STEP` | 10, 5 |
| Bite chance | `game.ts` → `BITE_CHANCE`, `PATIENT_BITE_CHANCE` | 0.4, 0.7 |
| Skill effects | `game.ts` → `SMALL_SIPS`, `SMALL_APPETITE`, `THICK_SKIN`, `GREEN_THUMB`, `NIGHT_EYES` | 0.8, 0.8, 0.7, 0.7, 2 |
| Beach width, hills | `worldgen.ts` → `BEACH_WIDTH`, `HILL_MIN_DIST` | 3, 5 |
| Object density | `worldgen.ts` → `SCATTER` | chance per cell and biome |
| Step speed | `animator.ts` → `STEP_MS` | 130 ms |
| Cells across a phone | `renderer.ts` → `TILES_ACROSS` | 12 |
| Grill button frame time, lift above the fire | `main.ts` → `GRILL_FRAME_MS`, `GRILL_LIFT` | 220 ms, 6 px |

---

## 12. Known limits

- The balance (need rates, day length) has not been tested with real play.
  The harder food and animal values (see 4.1 and 4.9) are a first guess.
- A wild animal only checks the distance from home when it appears. It can
  wander closer to camp later.
- Animals and the dog only face left or right; when they walk straight up
  or down they keep their side. A tired dog shows its resting sprite also
  while it walks.
- Only one dog: after the first is adopted, no other stray dog appears.
- Objects that are removed (logs, pebbles, mushrooms) do not come back.
- Only two levels exist. After the beacon on island 2, there is no next
  island yet: the player stays on the island or starts a new one.
- Island 1 cannot be visited again after sailing. "New island" always
  starts again on island 1.
- Islands from saves before version 4 have no boat, so they have no goal.
- During the boat trip, the boat faces right also when it sails up or down.
- There is no sound.
- The balance of XP and skill costs has not been tested with real play.
- The game has not been tested on a real phone.

---

## 13. Languages

The game is in English and German. All text the player sees comes from
`src/i18n/`. The game layer only sends data:

- Log messages are `Msg` objects (`src/game/messages.ts`), for example
  `{ key: 'eat', item: 'coconut' }`. The log stores these, not text. So when
  the player switches the language, the old log lines change language too.
- Floating numbers are `amount` plus `what` (an item or a need).
- The clock is made from the turn (`strings.clock(turn)`).

`src/i18n/index.ts` holds the current language. `t()` gives the words for
it. `main.ts` reads `pwagame.lang` from `localStorage`. If there is no
stored language, it uses German for a German browser and English for all
others. The 🌐 button in the Bag panel and in the explorer picker switches
the language. Static labels in `index.html` have a `data-t` attribute with
the key of their text in `Strings.ui`.

**German grammar.** Each German noun has a gender (`m`, `f`, `n`, `pl`), a
word and, if necessary, an adjective stem. `phrase(noun, case, det)` in
`de.ts` adds the correct article and adjective ending, for example
"ein bemooster Stein", "an der jungen Palme", "in deinem Unterstand". Items
also have a plural (`große Blätter`) and short forms for floating numbers.

**To add a language,** add a file like `de.ts` that implements `Strings`,
add it to `LANGUAGES` in `src/i18n/index.ts`, and add it to the `Lang`
type. The language button then needs a menu instead of a toggle.

**Not translated:** the sprite gallery and preview pages (developer tools)
and the app name in the web manifest.

