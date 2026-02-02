import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import '@fontsource/geist'
import '@fontsource/geist-mono'
import './globals.css'
import type { UserDTO } from '@saas/shared'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/sonner'
import { verifyUserCookie } from '@/lib/cookie-signing'

export const metadata: Metadata = {
  title: 'SaaS Monorepo',
  description: 'Modern SaaS application with Next.js and AdonisJS',
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
  const userInfoCookie = (await cookies()).get('user-info')
  let hasVerifiedUserCookie = false
  let initialUserRole: UserDTO['role'] | null = null
  const serverSafeMode = isSafeMode()

  if (userInfoCookie?.value) {
    const userInfo = await verifyUserCookie(userInfoCookie.value)
    if (userInfo?.role) {
      initialUserRole = userInfo.role as UserDTO['role']
      hasVerifiedUserCookie = true
    }
  }

  return (
    <html lang="en">
      <body className="antialiased">
        <Providers
          initialHasUserInfoCookie={hasVerifiedUserCookie}
          initialUserRole={initialUserRole}
          serverSafeMode={serverSafeMode}
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
