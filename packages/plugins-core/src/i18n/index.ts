import type { PluginTranslations, TranslationCatalog, TranslateOptions } from '../types/i18n.js'

type LocaleListener = (locale: string) => void

const DEFAULT_LOCALE = 'en'
const LOCALE_SPLIT_PATTERN = /[-_]/
const INTERPOLATION_PATTERN = /\{(\w+)\}/g

const translationRegistry = new Map<string, Map<string, TranslationCatalog>>()
const localeListeners = new Set<LocaleListener>()

let activeLocale = DEFAULT_LOCALE

function normalizeLocale(locale: string | null | undefined): string {
  const normalized = (locale ?? '').trim().toLowerCase()
  return normalized.length > 0 ? normalized : DEFAULT_LOCALE
}

function resolveLocaleCandidates(locale: string): string[] {
  const normalized = normalizeLocale(locale)
  const [language] = normalized.split(LOCALE_SPLIT_PATTERN)
  if (!language || language === normalized) {
    return [normalized, DEFAULT_LOCALE]
  }
  return [normalized, language, DEFAULT_LOCALE]
}

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) {
    return template
  }

  return template.replace(INTERPOLATION_PATTERN, (_match, token: string) => {
    const value = values[token]
    return value === undefined ? `{${token}}` : String(value)
  })
}

function ensureEnglishCatalog(pluginId: string, translations: PluginTranslations): void {
  const hasEnglish = Object.keys(translations).some((locale) => normalizeLocale(locale) === DEFAULT_LOCALE)
  if (!hasEnglish) {
    throw new Error(`Plugin "${pluginId}" must provide an "en" translation catalog`)
  }
}

export function registerPluginTranslations(pluginId: string, translations: PluginTranslations): void {
  ensureEnglishCatalog(pluginId, translations)

  const localeMap = new Map<string, TranslationCatalog>()
  for (const [locale, catalog] of Object.entries(translations)) {
    localeMap.set(normalizeLocale(locale), { ...catalog })
  }

  translationRegistry.set(pluginId, localeMap)
}

export function hasPluginTranslations(pluginId: string): boolean {
  return translationRegistry.has(pluginId)
}

export function listTranslationNamespaces(): string[] {
  return Array.from(translationRegistry.keys()).sort()
}

export function getActiveLocale(): string {
  return activeLocale
}

export function setActiveLocale(locale: string): void {
  const nextLocale = normalizeLocale(locale)
  if (nextLocale === activeLocale) {
    return
  }

  activeLocale = nextLocale
  for (const listener of localeListeners) {
    listener(activeLocale)
  }
}

export function subscribeToLocale(listener: LocaleListener): () => void {
  localeListeners.add(listener)
  return () => {
    localeListeners.delete(listener)
  }
}

export function resolvePluginCatalog(pluginId: string, locale?: string): TranslationCatalog | null {
  const localeMap = translationRegistry.get(pluginId)
  if (!localeMap) {
    return null
  }

  const candidates = resolveLocaleCandidates(locale ?? activeLocale)
  for (const candidate of candidates) {
    const catalog = localeMap.get(candidate)
    if (catalog) {
      return catalog
    }
  }

  return null
}

export function translatePlugin(
  pluginId: string,
  key: string,
  options: TranslateOptions = {}
): string {
  const localizedCatalog = resolvePluginCatalog(pluginId, options.locale)
  const englishCatalog = resolvePluginCatalog(pluginId, DEFAULT_LOCALE)
  const template = localizedCatalog?.[key] ?? englishCatalog?.[key] ?? options.defaultValue ?? key
  return interpolate(template, options.values)
}
