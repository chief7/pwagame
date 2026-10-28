---
name: add-content
description: Propose and then add new game content to pwagame (items, food, world objects, plants, buildings, recipes, animals, sprites, animations). Use when the user asks to add, design or suggest new content or mechanics, or runs /add-content. Always makes a proposal with rendered sprites first and waits for approval before building.
argument-hint: "<idea, e.g. a fishing rod that catches fish at the shore>"
---

# Add content to pwagame

You add content in two phases. **Phase 1 makes a proposal and stops.** Phase 2
starts only after the user approves the proposal. Never skip phase 1, also not
for small content.

The idea from the user: `$ARGUMENTS`. If it is empty, ask what to add, or
offer 2–3 ideas that fit the game and the known limits in `docs/OVERVIEW.md`.

Write all messages to the user in the style from `CLAUDE.md` (ASD-STE100).

## Before you start

1. Read `docs/OVERVIEW.md` completely. It explains the registries, the
   mechanics, the sprite rules and the tuning values.
2. Read the registry files the idea touches (`src/game/defs/*.ts`), the
   word files (`src/i18n/en.ts`, `src/i18n/de.ts`), and the sprite files of
   similar content (`src/sprites/*.ts`).
3. Make sure the working tree is clean (`git status`). Create a branch from
   `main`: `git checkout -b content/<slug>` (for example `content/fishing-rod`).
   All work for this content stays on that branch until the user approves
   the merge into `main`. You can merge it into `preview` at any time.

## Phase 1: proposal

### 1.1 Design the content

Fit the content to the game:

- **Kid-friendly.** No death, no hurting animals, no scary or violent
  content. Setbacks are mild and recoverable (as with fainting).
- **Fits the island.** Natural materials, beach, forest and cave themes.
- **Balanced against what exists.** Compare numbers with similar entries.
  For example, compare a new food with coconut (10 food, 18 water),
  berries (7 food, 4 water) and cooked fish (40 food, 10 energy). Compare
  a recipe cost with the hut (10 wood, 8 leaves, 4 stone).
- **Data first.** Prefer a registry entry over new code. Decide which of
  these the content needs:
  - **Data only:** new entries in `ITEMS`, `OBJECTS`, `RECIPES`, `ANIMALS`,
    `SCATTER`. No change to rules.
  - **Engine change:** a new field, a new action, a new animal temper, a new
    UI element, a change to the save shape. Mark this clearly in the
    proposal. It needs more care and tests.

### 1.2 Make the sprites now

The proposal must show real sprites, not descriptions.

1. Write the sprite functions in the correct file in `src/sprites/`
   (see the table in `docs/OVERVIEW.md` §7 and the layout in `README.md`).
2. Register them in `spriteGroups()` in `src/sprites/index.ts`, in the
   correct group.
3. Follow the sprite style:
   - Use colours from `palette.ts` only. Add new palette entries if
     necessary, with names that tell their use.
   - Light comes from the top left: light colours top-left, dark colours
     bottom-right.
   - Call `.outline()` (1 px dark outline), then `.shadow(...)` for objects
     that stand on the ground. Terrain tiles have no outline and no shadow,
     and must be fully opaque and tile seamlessly.
   - Size: 16 × 16 for most things. Tall things (trees, buildings) may be
     up to 24 × 32. They stand bottom-centre on their cell.
   - Use `fromRows()` for small hand-drawn sprites (characters, animals,
     chests). Use shape helpers (ellipses, blobs, `hash2` noise) for natural
     shapes (rocks, foliage).
   - Item icons are 16 × 16, named `item_<id>`, with outline and no shadow.
4. **Animation, if the content moves or flickers:**
   - Objects: draw 2 frames and list them in the object's `frames` field
     (the renderer cycles them every 220 ms). Use this for fire, water,
     sparkles and other small loops.
   - Animals and characters: today animals hop when they move and have no
     frames. Animal walk frames are an engine change (see 1.1).
   - Effects of an action (sparkles, floating text, lunge): use the existing
     events (`docs/OVERVIEW.md` §2, Events). A new effect is an engine change.
   - Respect reduced motion: an animation must still read correctly with
     only its first frame.
5. Run `npx tsc --noEmit` and `npx vitest run src/sprites`. Fix all errors.

### 1.3 Render the preview

1. Start the dev server if it does not run: `npm run dev -- --port 5199`
   (in the background).
2. Make a screenshot of the preview page:

   ```sh
   node .claude/skills/add-content/preview-shot.cjs <scratchpad>/proposal.png \
     "show=<new sprites, animation frames joined with |>&bg=<sand|grass|cave_floor>&compare=<existing sprites>" 5199
   ```

   - `compare`: choose 2–3 existing sprites that are similar in size or
     theme, plus the explorer (`male_down` or `female_down`). This shows if
     the size and style match.
   - `bg`: the ground the content appears on.
3. Look at the screenshot yourself. Fix sprite problems before you show it:
   wrong size, missing outline, colours outside the palette, an unclear
   shape at game size.
4. Send the screenshot to the user (`SendUserFile`, display `render`). If
   you cannot make screenshots, give the user the preview URL instead.

### 1.4 Write the proposal and stop

Send the proposal in this form, then **stop and wait**:

```
**Proposal: <name>**

What it is: <one or two sentences, as a player sees it>

How to get or use it:
- <gather from / find in / build with / ...>

Numbers (compared with existing content):
| Entry | Value | Compare |
|---|---|---|

Changes:
- Data: <registry entries, SCATTER chances, recipe cost>
- Words: <English and German names and messages; German gender>
- Sprites: <names, sizes>; animation: <frames and speed, or "none">
- Engine change: <none / describe it and why it is necessary>
- Save: <no change / SAVE_VERSION must increase because ...>

Open questions:
- <choices the user can make, each with your recommendation>

Approve, or tell me what to change.
```

Rules for this step:

- Do not add the registry entries, world placement or tests yet. Only the
  sprites exist at this point.
- You can commit the sprites on the branch and merge the branch into
  `preview`, so the user can see them in `<site>/preview/sprites.html`.
  Follow the rules for `preview` in `CLAUDE.md`. Never touch `main`.

### 1.5 Refine

When the user asks for changes:

1. Change the design and/or the sprites.
2. Render the preview again and send it.
3. Send the proposal again with the changes marked.
4. Stop and wait again.

Repeat until the user approves ("yes", "approve", "go", "looks good").

If the user rejects the idea, delete the branch
(`git checkout main && git branch -D content/<slug>`) and tell the user that
nothing changed.

## Phase 2: build (only after approval)

Build exactly what the user approved. If you find that something must be
different (a number, a new engine change), stop and ask before you continue.

1. **Data.** Add the entries to the registries and their TypeScript types
   (`ItemId`, `ObjectKind`, `RecipeId`, `AnimalKind`). Add world placement in
   `SCATTER` (`src/game/worldgen.ts`) if the content appears in the world.
   Add the words in **both** `src/i18n/en.ts` and `src/i18n/de.ts`: names,
   gather texts, shoo texts, recipe names and descriptions. German nouns
   need their gender (and an adjective stem if they have one). New messages
   are new `Msg` keys in `src/game/messages.ts`; the game layer never builds
   text itself.
2. **Engine changes** (only if approved). Keep the game layer free of DOM
   code. Send events for the UI instead of drawing from game code. If the
   save shape changes, increase `SAVE_VERSION`.
3. **Tests.** Add tests to `src/game/game.test.ts` that show the content
   works in play. Use the `sandbox()` and `place()` helpers. Examples: it can
   be gathered and gives the right items; food changes the right needs; the
   recipe builds the object; the animal behaves as its temper says.
4. **Checks.** Run all of these and fix every failure:
   - `npx tsc --noEmit`
   - `npx vitest run`
   - `npm run build`
5. **Play check.** Look at the content in the real game if you can (for
   example a Playwright screenshot of the dev server at phone size). If the
   content needs a special place, inject a save as described in
   `docs/OVERVIEW.md` §9.
6. **Docs.** Update `docs/OVERVIEW.md`: the "Current content" table (§6), and
   every section the content changes (mechanics, tuning values, known
   limits). Update `README.md` only if the player-facing rules change.
7. **Commit and push to the preview.**
   - Commit on the branch with a message that says what was added.
   - Push the branch (`git push -u origin content/<slug>`).
   - Merge the branch into `preview` (`git checkout preview && git merge
     --no-ff content/<slug>`) and push `preview`. Do not ask first.
8. **Report** to the user: what was added, the final preview screenshot, the
   test and build results, what you could not check, and that the build is
   in `<site>/preview/`. Ask: "Merge into main?" Then stop and wait.
9. **Merge into main (only after the user approves it).**
   - Merge the branch into `main` (`git checkout main && git merge
     --ff-only content/<slug>`; use `--no-ff` if a fast-forward is not
     possible), push `main`, and delete the branch.
   - Do not merge all of `preview` into `main` unless the user asks for
     that. `preview` can contain other work that is not approved.
