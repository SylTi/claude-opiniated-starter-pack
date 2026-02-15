import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import '@fontsource/geist'
import '@fontsource/geist-mono'
import './globals.css'
import type { UserDTO } from '@saas/shared'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/sonner'
import { verifyUserCookie } from '@/lib/cookie-signing'
import { type Theme, THEME_COOKIE_NAME, DEFAULT_THEME } from '@/lib/theme-config'
import { LOCALE_COOKIE_NAME } from '@/lib/i18n/constants'
import { loadMainAppDesign } from '@saas/config/main-app'

/**
 * Default metadata fallback.
 */
const DEFAULT_METADATA: Metadata = {
  title: 'SaaS App',
  description: 'A modern SaaS application',
}

function normalizeLocale(value: string | undefined): string {
  const normalized = (value ?? '').trim().toLowerCase()
  return normalized.length > 0 ? normalized : 'en'
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

/**
 * Generate metadata from main-app plugin design.
 * Falls back to defaults if design doesn't provide branding.
 */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const design = await loadMainAppDesign()
    const tokens = design.appTokens()
    const iconUrl = tokens.faviconUrl ?? tokens.logoUrl
    return {
      title: tokens.appName ?? DEFAULT_METADATA.title,
      description: tokens.appDescription ?? DEFAULT_METADATA.description,
      ...(iconUrl && {
        icons: {
          icon: iconUrl,
        },
      }),
    }
  } catch {
    // If design fails, use safe defaults
    return DEFAULT_METADATA
  }
}

/**
 * Check if running in safe mode.
 * Uses server-only SAFE_MODE env var.
 */
function isSafeMode(): boolean {
  return process.env.SAFE_MODE === '1' || process.env.SAFE_MODE === 'true'
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): Promise<React.ReactElement> {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const userInfoCookie = cookieStore.get('user-info')
  const themeCookie = cookieStore.get(THEME_COOKIE_NAME)
  const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME)

  let hasVerifiedUserCookie = false
  let initialUserRole: UserDTO['role'] | null = null
  const serverSafeMode = isSafeMode()

  // Parse theme from cookie (validate it's a valid Theme value)
  const initialTheme: Theme = (themeCookie?.value === 'light' || themeCookie?.value === 'dark')
    ? themeCookie.value
    : DEFAULT_THEME
  const initialLocale = localeCookie?.value
    ? normalizeLocale(localeCookie.value)
    : (resolveAcceptLanguageLocale(headerStore.get('accept-language')) ?? 'en')

  if (userInfoCookie?.value) {
    const userInfo = await verifyUserCookie(userInfoCookie.value)
    if (userInfo?.role) {
      initialUserRole = userInfo.role as UserDTO['role']
      hasVerifiedUserCookie = true
    }
  }

  return (
    <html lang={initialLocale} className={initialTheme === 'dark' ? 'dark' : ''}>
      <body className="antialiased">
        <Providers
          initialHasUserInfoCookie={hasVerifiedUserCookie}
          initialUserRole={initialUserRole}
          initialLocale={initialLocale}
          serverSafeMode={serverSafeMode}
          initialTheme={initialTheme}
        >
          {/* Header is rendered inside Providers (needs context) but outside ShellWrapper */}
          {/* Only page content goes through ShellWrapper for area-specific layouts */}
          {children}
        </Providers>
        {/* Toaster is outside Providers - not affected by shell layout or context */}
        <Toaster />
      </body>
    </html>
  )
}
