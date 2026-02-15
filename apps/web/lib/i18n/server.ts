import { cookies, headers } from 'next/headers'
import {
  hasPluginTranslations,
  registerPluginTranslations,
  translatePlugin,
  type PluginTranslations,
} from '@saas/plugins-core'
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME } from '@/lib/i18n/constants'
import { SKELETON_TRANSLATIONS } from '@/lib/i18n/skeleton-translations'

function normalizeLocale(value: string | undefined): string {
  const normalized = (value ?? '').trim().toLowerCase()
  return normalized.length > 0 ? normalized : DEFAULT_LOCALE
}

function resolveAcceptLanguageLocale(value: string | null): string | null {
  if (!value) {
    return null
  }

  const first = value
    .split(',')
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.length > 0)

  if (!first) {
    return null
  }

  const language = first.split(';')[0]?.trim()
  return language ? normalizeLocale(language) : null
}

function ensureTranslations(namespace: string, translations: PluginTranslations): void {
  if (hasPluginTranslations(namespace)) {
    return
  }
  registerPluginTranslations(namespace, translations)
}

export async function getServerLocale(): Promise<string> {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value
  if (cookieLocale) {
    return normalizeLocale(cookieLocale)
  }

  const headerStore = await headers()
  const acceptLanguage = headerStore.get('accept-language')
  return resolveAcceptLanguageLocale(acceptLanguage) ?? DEFAULT_LOCALE
}

export async function getServerI18n(
  namespace: string = 'skeleton'
): Promise<{
  locale: string
  t: (key: string, values?: Record<string, string | number>, defaultValue?: string) => string
}> {
  if (namespace === 'skeleton') {
    ensureTranslations('skeleton', SKELETON_TRANSLATIONS)
  }

  const locale = await getServerLocale()
  const t = (key: string, values?: Record<string, string | number>, defaultValue?: string): string =>
    translatePlugin(namespace, key, {
      locale,
      values,
      defaultValue,
    })

  return { locale, t }
}
