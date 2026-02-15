/**
 * Plugin i18n Types
 *
 * Plugins own their translation catalogs.
 * Core runtime resolves locale fallback and interpolation.
 */

export type TranslationValue = string

/**
 * Flat message catalog for a locale.
 * Key format is plugin-defined (for example: "ui.save").
 */
export type TranslationCatalog = Record<string, TranslationValue>

/**
 * Locale -> catalog map for a plugin namespace.
 * An "en" catalog is mandatory.
 */
export type PluginTranslations = Record<string, TranslationCatalog>

export interface TranslateOptions {
  locale?: string
  values?: Record<string, string | number>
  defaultValue?: string
}
