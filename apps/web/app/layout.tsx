import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import '@fontsource/geist'
import '@fontsource/geist-mono'
import './globals.css'
import type { UserDTO } from '@saas/shared'
import { AuthProvider } from '@/contexts/auth-context'
import { Header } from '@/components/header'
import { Toaster } from '@/components/ui/sonner'
import { verifyUserCookie } from '@/lib/cookie-signing'

export const metadata: Metadata = {
  title: 'SaaS Monorepo',
  description: 'Modern SaaS application with Next.js and AdonisJS',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): Promise<React.ReactElement> {
  const userInfoCookie = (await cookies()).get('user-info')
  let hasVerifiedUserCookie = false
  let initialUserRole: UserDTO['role'] | null = null

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
        <AuthProvider
          initialHasUserInfoCookie={hasVerifiedUserCookie}
          initialUserRole={initialUserRole}
        >
          <Header />
          <main>{children}</main>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
