import { de } from './de';
import { en } from './en';
import type { Lang, Strings } from './types';

export type { Lang, Strings } from './types';

export const LANGUAGES: Record<Lang, Strings> = { en, de };

let current: Strings = en;

/** The words for the language the player chose. */
export function t(): Strings {
  return current;
}

export function setLang(lang: Lang): void {
  current = LANGUAGES[lang];
}

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && Object.hasOwn(LANGUAGES, value);
}

/** German for German-speaking browsers, English for everyone else. */
export function preferredLang(languages: readonly string[]): Lang {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return 'en';
}
