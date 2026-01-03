'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Shield, Settings, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'

const navigation = [
  { name: 'Profile', href: '/profile', icon: User },
  { name: 'Security', href: '/profile/security', icon: Shield },
  { name: 'Settings', href: '/profile/settings', icon: Settings },
]

/**
 * Profile layout component.
 * Authentication is handled by Next.js middleware (middleware.ts).
 */
export default function ProfileLayout({ children }: { children: ReactNode }): React.ReactElement {
  const pathname = usePathname()
  const { user, isLoading } = useAuth()

  // Show loading state while auth context initializes
  if (isLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full lg:w-64 shrink-0">
            <nav className="bg-white rounded-lg shadow p-4">
              <ul className="space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow p-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
