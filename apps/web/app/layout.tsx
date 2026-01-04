import type { Metadata } from 'next'
import '@fontsource/geist'
import '@fontsource/geist-mono'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { Header } from '@/components/header'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'SaaS Monorepo',
  description: 'Modern SaaS application with Next.js and AdonisJS',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): React.ReactElement {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <Header />
          <main>{children}</main>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
