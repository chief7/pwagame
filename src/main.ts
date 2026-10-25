import './style.css';
import { Game } from './game/game';
import { commandForKey, commandForTap, type Command } from './ui/input';
import { Renderer } from './ui/renderer';

const LOG_LINES = 4;
const TAP_SLOP = 12;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('view');
const renderer = new Renderer(canvas);
const ui = {
  hpFill: $('hp-fill'),
  hpText: $('hp-text'),
  stats: $('stats'),
  log: $('log'),
  wait: $<HTMLButtonElement>('btn-wait'),
  drink: $<HTMLButtonElement>('btn-drink'),
  descend: $<HTMLButtonElement>('btn-descend'),
  gameOver: $('game-over'),
  gameOverText: $('game-over-text'),
  restart: $<HTMLButtonElement>('btn-restart'),
};

let game = new Game();

function run(cmd: Command): void {
  switch (cmd.type) {
    case 'move': game.move(cmd.dx, cmd.dy); break;
    case 'wait': game.wait(); break;
    case 'descend': game.descend(); break;
    case 'drink': game.drinkTonic(); break;
  }
  draw();
}

function draw(): void {
  renderer.render(game);
  const { player } = game;
  ui.hpFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
  ui.hpText.textContent = `${player.hp}/${player.maxHp}`;
  ui.stats.textContent = `D${game.depth} · Lv${game.level} · ${game.xp}/${game.xpToNext}xp`;
  ui.drink.textContent = `Tonic ×${game.tonics}`;
  ui.drink.disabled = game.over || game.tonics === 0;
  ui.wait.disabled = game.over;
  ui.descend.disabled = game.over || !game.onStairs;
  ui.descend.classList.toggle('ready', game.onStairs && !game.over);

  const recent = game.log.slice(-LOG_LINES);
  ui.log.replaceChildren(
    ...recent.map((entry, i) => {
      const li = document.createElement('li');
      li.textContent = entry.text;
      li.className = entry.tone + (i < recent.length - 1 ? ' old' : '');
      return li;
    }),
  );

  ui.gameOver.hidden = !game.over;
  if (game.over) {
    ui.gameOverText.textContent = `Depth ${game.depth}, level ${game.level}, ${game.turn} turns.`;
  }
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (game.over && (e.key === 'Enter' || e.key === ' ')) {
    restart();
    e.preventDefault();
    return;
  }
  const cmd = commandForKey(e);
  if (!cmd) return;
  e.preventDefault();
  run(cmd);
});

let down: { x: number; y: number; id: number } | null = null;
canvas.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, id: e.pointerId };
});
canvas.addEventListener('pointerup', (e) => {
  if (!down || down.id !== e.pointerId) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > TAP_SLOP) return;
  const rect = canvas.getBoundingClientRect();
  const center = renderer.playerCenter();
  run(commandForTap(e.clientX - rect.left, e.clientY - rect.top, center.x, center.y, renderer.cellSize));
});
canvas.addEventListener('pointercancel', () => {
  down = null;
});

ui.wait.addEventListener('click', () => run({ type: 'wait' }));
ui.drink.addEventListener('click', () => run({ type: 'drink' }));
ui.descend.addEventListener('click', () => run({ type: 'descend' }));
ui.restart.addEventListener('click', restart);

function restart(): void {
  game = new Game();
  draw();
}

new ResizeObserver(() => {
  renderer.resize();
  draw();
}).observe(canvas);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.warn('Service worker registration failed', err);
    });
  });
}
