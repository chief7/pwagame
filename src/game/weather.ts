// The weather of each island. Like the clock and the tide, it follows from
// numbers the game already has (the game's seed, the island and the day), so
// it needs no save data and is the same after a reload.
//
// Kind to young players: rain only falls by day (it starts after 9:00 and
// stops by 20:00), clouds come an hour before it, and it never comes on the
// first day. Storms only blow on the oil rig.

import { dayNumber, minuteOfDay } from './clock';
import type { LevelId } from './defs/levels';

export type Weather = 'clear' | 'clouds' | 'rain' | 'storm';

/** One day's weather: clear, or one shower (or storm) from `start` to `end` (minutes after midnight). */
export interface DayWeather {
  day: number;
  kind: 'clear' | 'rain' | 'storm';
  start: number;
  end: number;
}

/** Clouds come this many minutes before the rain. */
export const CLOUDS_BEFORE = 60;
/** The earliest a shower starts, and the latest it ends (minutes after midnight). */
const FIRST_START = 9 * 60;
const LAST_END = 20 * 60;

interface IslandWeather {
  /** Chance that a day has a shower. */
  rainy: number;
  /** Shortest and longest shower, in minutes. */
  shower: [number, number];
  /** Chance that a rainy day brings a storm instead (the rig). */
  storm: number;
  /** Shortest and longest storm, in minutes. */
  stormLength: [number, number];
}

const ISLANDS: Record<LevelId, IslandWeather> = {
  1: { rainy: 0.65, shower: [120, 180], storm: 0, stormLength: [0, 0] },
  2: { rainy: 0.65, shower: [120, 180], storm: 0, stormLength: [0, 0] },
  3: { rainy: 0.5, shower: [90, 150], storm: 0, stormLength: [0, 0] },
  4: { rainy: 0.6, shower: [120, 180], storm: 0.5, stormLength: [60, 120] },
};

/** A small integer hash to [0, 1): the same inputs always give the same number. */
function hash(...parts: number[]): number {
  let h = 0x9e3779b9;
  for (const p of parts) {
    h = Math.imul(h ^ (p | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

/** The weather of one day on one island. */
export function dayWeather(seed: number, level: LevelId, day: number): DayWeather {
  const w = ISLANDS[level];
  if (day <= 1 || hash(seed, level, day, 1) >= w.rainy) return { day, kind: 'clear', start: 0, end: 0 };
  const storm = hash(seed, level, day, 2) < w.storm;
  const [min, max] = storm ? w.stormLength : w.shower;
  // Whole tens of minutes, so a shower starts and ends on a turn.
  const length = Math.round((min + hash(seed, level, day, 3) * (max - min)) / 10) * 10;
  const latest = LAST_END - length;
  const start = Math.round((FIRST_START + hash(seed, level, day, 4) * (latest - FIRST_START)) / 6) * 6;
  return { day, kind: storm ? 'storm' : 'rain', start, end: start + length };
}

/** The weather at a turn: clouds in the hour before a shower, then rain (or a storm). */
export function weatherAt(seed: number, level: LevelId, turn: number): Weather {
  const today = dayWeather(seed, level, dayNumber(turn));
  if (today.kind === 'clear') return 'clear';
  const m = minuteOfDay(turn);
  if (m >= today.start && m < today.end) return today.kind;
  if (m >= today.start - CLOUDS_BEFORE && m < today.start) return 'clouds';
  return 'clear';
}

/** Today's and tomorrow's weather, for the weather report on the radio. */
export function forecast(seed: number, level: LevelId, turn: number): [DayWeather, DayWeather] {
  const day = dayNumber(turn);
  return [dayWeather(seed, level, day), dayWeather(seed, level, day + 1)];
}
