// Time of day. One turn is six minutes, so a day is 240 turns.

export const TURNS_PER_DAY = 240;
const MINUTES_PER_TURN = (24 * 60) / TURNS_PER_DAY;
/** Turn 0 is 8:00 on day 1. */
const START_MINUTE = 8 * 60;

export type Phase = 'dawn' | 'day' | 'dusk' | 'night';

export function minuteOfDay(turn: number): number {
  return (START_MINUTE + turn * MINUTES_PER_TURN) % (24 * 60);
}

export function dayNumber(turn: number): number {
  return Math.floor((START_MINUTE + turn * MINUTES_PER_TURN) / (24 * 60)) + 1;
}

export function phase(turn: number): Phase {
  const h = minuteOfDay(turn) / 60;
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 19) return 'day';
  if (h >= 19 && h < 21) return 'dusk';
  return 'night';
}

export function isNight(turn: number): boolean {
  return phase(turn) === 'night';
}

/** Daylight from 0 (darkest night) to 1 (full day), easing through dawn and dusk. */
export function daylight(turn: number): number {
  const h = minuteOfDay(turn) / 60;
  if (h >= 7 && h < 19) return 1;
  if (h >= 5 && h < 7) return (h - 5) / 2;
  if (h >= 19 && h < 21) return 1 - (h - 19) / 2;
  return 0;
}

/** Turns from `turn` until the next 6:00. */
export function turnsUntilMorning(turn: number): number {
  const minutes = minuteOfDay(turn);
  const target = 6 * 60;
  const wait = (target - minutes + 24 * 60) % (24 * 60);
  return Math.ceil(wait / MINUTES_PER_TURN);
}

export function clockLabel(turn: number): string {
  const m = Math.floor(minuteOfDay(turn));
  const hh = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  return `Day ${dayNumber(turn)} · ${hh}:${mm}`;
}
