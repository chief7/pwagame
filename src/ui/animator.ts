import type { GameEvent, Tone } from '../game/game';
import { t as strings } from '../i18n';

// Turns game events into short-lived visual effects. Everything is keyed by
// time (ms, from performance.now()) so the renderer can ask "where is this
// actor right now?" on any frame.

export const STEP_MS = 130;
const LATE_DELAY_MS = 90;
const LUNGE_MS = 160;
const FLASH_MS = 140;
const FLOAT_MS = 800;
const SPARKLE_MS = 600;
const FADE_MS = 700;
/** How long the explorer holds the fishing pose after a cast. */
const CAST_MS = 700;

const TONE_COLORS: Record<Tone, string> = {
  info: '#fff1b0',
  good: '#8fd18b',
  warn: '#ff8a73',
  loot: '#f7d774',
};
/** Experience floats in its own colour, so it doesn't read as an item. */
const XP_COLOR = '#b9a4ff';

interface Tween {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  start: number;
  /** Alternates each step so walk cycles swap feet. */
  stride: number;
}

interface Lunge {
  dx: number;
  dy: number;
  start: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  start: number;
}

export interface Sparkle {
  x: number;
  y: number;
  start: number;
}

export interface ActorPose {
  /** Fractional cell position. */
  x: number;
  y: number;
  /** Walk frame: 0 standing, 1 or 2 mid-step. */
  frame: 0 | 1 | 2;
  /** Hop height in sprite pixels, for creatures without walk frames. */
  hop: number;
  /** 0..1 strength of the white hit flash. */
  flash: number;
}

export class Animator {
  private tweens = new Map<number, Tween>();
  private lunges = new Map<number, Lunge>();
  private flashes = new Map<number, number>();
  /** When each actor last cast a fishing rod. */
  private casts = new Map<number, number>();
  private strides = new Map<number, number>();
  floats: FloatingText[] = [];
  sparkles: Sparkle[] = [];
  private fadeStart = -Infinity;
  private busyUntil = 0;
  /** With reduced motion, positions snap and only informative effects remain. */
  reducedMotion = false;

  consume(events: readonly GameEvent[], now: number, playerId: number): void {
    const stacked = new Map<string, number>();
    for (const e of events) {
      const t = now + (e.late ? LATE_DELAY_MS : 0);
      switch (e.type) {
        case 'move': {
          if (this.reducedMotion) break;
          // Start from wherever the actor is drawn now, so quick steps chain smoothly.
          const current = this.tweens.get(e.id);
          const from = current ? this.lerp(current, t) : { x: e.fromX, y: e.fromY };
          const stride = (this.strides.get(e.id) ?? 0) + 1;
          this.strides.set(e.id, stride);
          this.tweens.set(e.id, { fromX: from.x, fromY: from.y, toX: e.toX, toY: e.toY, start: t, stride });
          this.extend(t + STEP_MS);
          break;
        }
        case 'lunge':
          if (this.reducedMotion) break;
          this.lunges.set(e.id, { dx: Math.sign(e.targetX - e.x), dy: Math.sign(e.targetY - e.y), start: t });
          this.extend(t + LUNGE_MS);
          break;
        case 'cast':
          // The pose tells what happened, so it shows with reduced motion too.
          this.casts.set(e.id, t);
          this.extend(t + CAST_MS);
          break;
        case 'hit':
          this.flashes.set(e.id, t + LUNGE_MS / 2);
          this.float(e.x, e.y, `-${e.damage}`, e.id === playerId ? TONE_COLORS.warn : TONE_COLORS.info, t + LUNGE_MS / 2);
          break;
        case 'float': {
          // Several floats on one cell in a batch rise one after another.
          const key = `${e.x},${e.y}`;
          const n = stacked.get(key) ?? 0;
          stacked.set(key, n + 1);
          const color = 'xp' in e.what ? XP_COLOR : TONE_COLORS[e.tone];
          this.float(e.x, e.y, strings().float(e.amount, e.what), color, t + n * 220);
          break;
        }
        case 'sparkle':
          this.sparkles.push({ x: e.x, y: e.y, start: t });
          this.extend(t + SPARKLE_MS);
          break;
        case 'fade':
          this.reset();
          this.fadeStart = now;
          this.extend(now + FADE_MS);
          break;
      }
    }
  }

  /** Where and how to draw an actor at time `now`. */
  pose(id: number, x: number, y: number, now: number): ActorPose {
    let px = x;
    let py = y;
    let frame: 0 | 1 | 2 = 0;
    let hop = 0;
    const tween = this.tweens.get(id);
    if (tween) {
      const p = (now - tween.start) / STEP_MS;
      if (p >= 1) {
        this.tweens.delete(id);
      } else if (p >= 0) {
        const pos = this.lerp(tween, now);
        px = pos.x;
        py = pos.y;
        frame = tween.stride % 2 === 0 ? 2 : 1;
        hop = Math.sin(p * Math.PI) * 2;
      } else {
        px = tween.fromX;
        py = tween.fromY;
      }
    }
    const lunge = this.lunges.get(id);
    if (lunge) {
      const p = (now - lunge.start) / LUNGE_MS;
      if (p >= 1) this.lunges.delete(id);
      else if (p >= 0) {
        const reach = Math.sin(p * Math.PI) * 0.35;
        px += lunge.dx * reach;
        py += lunge.dy * reach;
      }
    }
    let flash = 0;
    const flashAt = this.flashes.get(id);
    if (flashAt !== undefined) {
      const p = (now - flashAt) / FLASH_MS;
      if (p >= 1) this.flashes.delete(id);
      else if (p >= 0) flash = 1 - p;
    }
    return { x: px, y: py, frame, hop, flash };
  }

  /** True while the actor holds the fishing pose. */
  casting(id: number, now: number): boolean {
    const start = this.casts.get(id);
    if (start === undefined) return false;
    if (now - start < CAST_MS) return now >= start;
    this.casts.delete(id);
    return false;
  }

  /** Gentle idle bob in sprite pixels (0 or 1), staggered per actor. */
  idleBob(id: number, now: number): number {
    if (this.reducedMotion) return 0;
    return Math.floor((now / 600 + id * 0.37) % 2) === 0 ? 0 : 1;
  }

  /** 0..1 progress of an effect that started at `start`, or null when not running. */
  progress(start: number, duration: number, now: number): number | null {
    const p = (now - start) / duration;
    return p < 0 || p >= 1 ? null : p;
  }

  readonly floatMs = FLOAT_MS;
  readonly sparkleMs = SPARKLE_MS;

  /** Opacity of the dark cover after sleeping or fainting (1 → 0). */
  fade(now: number): number {
    const p = (now - this.fadeStart) / FADE_MS;
    return p >= 1 || p < 0 ? 0 : 1 - p;
  }

  /** True while anything is mid-animation and frames should run flat out. */
  busy(now: number): boolean {
    this.floats = this.floats.filter((f) => now - f.start < FLOAT_MS);
    this.sparkles = this.sparkles.filter((s) => now - s.start < SPARKLE_MS);
    return now < this.busyUntil || this.floats.length > 0;
  }

  private float(x: number, y: number, text: string, color: string, start: number): void {
    this.floats.push({ x, y, text, color, start });
    this.extend(start + FLOAT_MS);
  }

  private extend(until: number): void {
    this.busyUntil = Math.max(this.busyUntil, until);
  }

  private lerp(t: Tween, now: number): { x: number; y: number } {
    const p = Math.min(1, Math.max(0, (now - t.start) / STEP_MS));
    const ease = 1 - (1 - p) * (1 - p);
    return { x: t.fromX + (t.toX - t.fromX) * ease, y: t.fromY + (t.toY - t.fromY) * ease };
  }

  private reset(): void {
    this.tweens.clear();
    this.lunges.clear();
    this.flashes.clear();
    this.casts.clear();
    this.floats = [];
    this.sparkles = [];
  }
}
