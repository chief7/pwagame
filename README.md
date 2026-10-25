# pwagame

A turn-based, island-hopping roguelike built as an installable PWA for phones
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

- **Touch:** tap next to your explorer to step (or attack / open a chest);
  tap further away to walk there along a known path; press and hold to keep
  walking towards your finger. Walking stops when a monster comes into view.
  Tap your explorer to wait. Buttons: Wait, Tonic (heal), Sail (on the raft).
- **Keyboard:** arrows / WASD / `hjklyubn` / numpad to move, `.` or `5` wait,
  `q` drink tonic, `Enter` or `>` sail.

Each island has palms, stones, logs and 2–3 chests (bump to open for
tonics). Find the raft to sail to the next, harder island.

## Layout

```
src/
  game/        pure game logic, no DOM — unit-testable
    rng.ts       seeded PRNG (mulberry32)
    map.ts       tile grid + explored/visible layers
    island.ts    cellular-automata islands (one landmass, coast cleaned for the shore tiles, raft far away)
    props.ts     scenery and chest kinds (all block movement; some block sight)
    fov.ts       recursive shadowcasting field of view
    pathing.ts   BFS distance maps (monster chasing, placement)
    actors.ts    player + monster definitions
    game.ts      turn loop, combat, AI, XP/levels, items, depth
  ui/
    renderer.ts  sprite renderer (integer pixel scaling), camera centred on the player
    input.ts     keyboard mapping and tap/hold direction helper
  main.ts      wires game, renderer, HUD and input together
  sprites/     pixel-art sprites, generated in code (no image files)
    palette.ts   the shared colour palette
    pixel.ts     Sprite grid, outline/shadow helpers, fromRows() for hand-drawn art
    terrain.ts   sand, water and 12 autotiling shore tiles (+ shoreTileName())
    objects.ts   stones, logs, chests
    creatures.ts monsters and the raft
    palms.ts     three palm trees (24×32, overhang the tile above)
    characters.ts  male and female explorer, 4 facings, recolourable via Look
    gallery.ts   the sprite gallery page
public/        manifest, icons, service worker (offline cache)
```

## Sprites

Run `npm run dev` and open `/sprites.html` to see every sprite plus a small
island composed from them. Terrain tiles are 16×16; objects are drawn
bottom-centre on their tile. `bake()` turns a sprite into a canvas for
`drawImage` (keep `imageSmoothingEnabled = false` when scaling up).
