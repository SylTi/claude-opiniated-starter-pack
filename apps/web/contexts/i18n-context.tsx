'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  registerPluginTranslations,
  setActiveLocale,
  subscribeToLocale,
  translatePlugin,
  type PluginTranslations,
} from '@saas/plugins-core'
import { clientPluginLoaders } from '@saas/config/plugins/client'
import { SKELETON_TRANSLATIONS } from '@/lib/i18n/skeleton-translations'
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME } from '@/lib/i18n/constants'
const registeredNamespaces = new Set<string>()

function normalizeLocale(locale: string | null | undefined): string {
  const normalized = (locale ?? '').trim().toLowerCase()
  return normalized.length > 0 ? normalized : DEFAULT_LOCALE
}

function readLocaleCookie(): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]+)`)
  )
  return match ? decodeURIComponent(match[1]) : null
}

function writeLocaleCookie(locale: string): void {
  if (typeof document === 'undefined') {
    return
  }
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)};path=/;max-age=31536000;SameSite=Lax`
}

function detectNavigatorLocale(): string {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LOCALE
  }
  return normalizeLocale(navigator.language)
}

function ensureRegisteredNamespace(namespace: string, translations: PluginTranslations): void {
  if (registeredNamespaces.has(namespace)) {
    return
  }
  registerPluginTranslations(namespace, translations)
  registeredNamespaces.add(namespace)
}

interface I18nContextValue {
  locale: string
  setLocale: (locale: string) => void
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

interface I18nProviderProps {
  children: ReactNode
  initialLocale?: string
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps): React.ReactElement {
  const [locale, setLocaleState] = useState<string>(() => normalizeLocale(initialLocale ?? DEFAULT_LOCALE))

  useEffect(() => {
    ensureRegisteredNamespace('skeleton', SKELETON_TRANSLATIONS)
  }, [])

  useEffect(() => {
    let cancelled = false

    const registerPluginNamespaces = async (): Promise<void> => {
      await Promise.all(
        Object.entries(clientPluginLoaders).map(async ([pluginId, loader]) => {
          try {
            const pluginModule = await loader()
            const pluginTranslations = (pluginModule as { translations?: unknown }).translations
            if (
              cancelled ||
              !pluginTranslations ||
              typeof pluginTranslations !== 'object'
            ) {
              return
            }

            ensureRegisteredNamespace(pluginId, pluginTranslations as PluginTranslations)
          } catch {
            // Plugin translation registration is best effort.
          }
        })
      )
    }

    void registerPluginNamespaces()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeToLocale((nextLocale) => {
      setLocaleState(nextLocale)
      if (typeof document !== 'undefined') {
        document.documentElement.lang = nextLocale
      }
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const persisted = readLocaleCookie()
    const detected = persisted ?? detectNavigatorLocale()
    const resolved = normalizeLocale(detected)
    setActiveLocale(resolved)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = resolved
    }
  }, [])

  const setLocale = useCallback((nextLocale: string) => {
    const normalized = normalizeLocale(nextLocale)
    setActiveLocale(normalized)
    writeLocaleCookie(normalized)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = normalized
    }
  }, [])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
    }),
    [locale, setLocale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useLocale(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useLocale must be used within I18nProvider')
  }
  return context
}

export function useI18n(namespace: string = 'skeleton'): {
  locale: string
  t: (key: string, values?: Record<string, string | number>, defaultValue?: string) => string
} {
  const { locale } = useLocale()

  const t = useCallback(
    (key: string, values?: Record<string, string | number>, defaultValue?: string) =>
      translatePlugin(namespace, key, {
        locale,
        values,
        defaultValue,
      }),
    [locale, namespace]
  )

  return { locale, t }
}
