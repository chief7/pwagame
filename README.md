# pwagame

A turn-based, cave-crawling roguelike built as an installable PWA for phones
(works with a keyboard on desktop too). No game engine — everything is our own
TypeScript on a 2D canvas.

## Run

```sh
npm install
npm run dev       # dev server (also on your LAN, open it from a phone)
npm test          # unit tests (vitest)
npm run build     # typecheck + production build into dist/
npm run preview   # serve the build (service worker is only active here)
```

## Controls

- **Touch:** tap anywhere around `@` to step that way (8 directions); tap `@` to wait.
  Bump into monsters to attack. Buttons: Wait, Tonic (heal), Descend (on `>`).
- **Keyboard:** arrows / `hjklyubn` / numpad to move, `.` or `5` wait,
  `q` drink tonic, `>` descend.

## Layout

```
src/
  game/        pure game logic, no DOM — unit-testable
    rng.ts       seeded PRNG (mulberry32)
    map.ts       tile grid + explored/visible layers
    caves.ts     cellular-automata cave generation (connected, stairs placed far away)
    fov.ts       recursive shadowcasting field of view
    pathing.ts   BFS distance maps (monster chasing, placement)
    actors.ts    player + monster definitions
    game.ts      turn loop, combat, AI, XP/levels, items, depth
  ui/
    renderer.ts  canvas glyph renderer, camera centred on the player
    input.ts     key and tap → command mapping
  main.ts      wires game, renderer, HUD and input together
public/        manifest, icons, service worker (offline cache)
```
