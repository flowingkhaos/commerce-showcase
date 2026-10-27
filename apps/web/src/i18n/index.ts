import { en, type Dict } from './en'
import { fr } from './fr'

export type Locale = 'en' | 'fr'
export type Key = keyof Dict

const dicts: Record<Locale, Record<Key, string>> = { en, fr }

/** One UI string, with `{name}` placeholders filled. Safe in islands: no env, no server code. */
export function t(locale: Locale, key: Key, vars: Record<string, string | number> = {}) {
  return dicts[locale][key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`))
}

/** `en` lives at /, `fr` under /fr. */
export const prefix = (locale: Locale) => (locale === 'fr' ? '/fr' : '')
export const localePath = (locale: Locale, path: string) => `${prefix(locale)}${path}` || '/'

/** Rest-param routes: `undefined` is English, `fr` is French. */
export const localeFromParam = (lang: string | undefined): Locale | null =>
  lang === undefined ? 'en' : lang === 'fr' ? 'fr' : null
