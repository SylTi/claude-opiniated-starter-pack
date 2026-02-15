import { translatePlugin, type PluginTranslations } from '@saas/plugins-core'

const NAV_LINKS_EN_CATALOG = {
  'defaults.documentation': 'Documentation',
  'nav.mainSection': 'Main',
} as const

type NavLinksTranslationKey = keyof typeof NAV_LINKS_EN_CATALOG

export const translations: PluginTranslations = {
  en: NAV_LINKS_EN_CATALOG,
  fr: {
    'defaults.documentation': 'Documentation',
    'nav.mainSection': 'Principal',
  },
}

export function navLinksText(
  key: NavLinksTranslationKey,
  options?: { locale?: string; defaultValue?: string }
): string {
  return translatePlugin('nav-links', key, {
    locale: options?.locale,
    defaultValue: options?.defaultValue ?? NAV_LINKS_EN_CATALOG[key],
  })
}
