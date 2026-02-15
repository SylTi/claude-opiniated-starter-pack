'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@saas/ui/utils'
import type { NavItemWithIcon } from '@/lib/nav/types'

/**
 * Props for NavItem component.
 */
export interface NavItemProps {
  item: NavItemWithIcon

  /** Additional class names */
  className?: string

  /** Variant for different nav contexts */
  variant?: 'header' | 'sidebar' | 'dropdown'

  /** Optional click handler (e.g., to close parent dropdown) */
  onClick?: () => void
}

/**
 * Navigation item component.
 */
export function NavItem({ item, className, variant = 'header', onClick }: NavItemProps): React.ReactElement {
  const pathname = usePathname()
  const isActive = pathname === item.href

  const Icon = item.icon

  // If onClick handler is defined, use button
  if (item.onClick) {
    return (
      <button
        type="button"
        onClick={() => {
          item.onClick?.()
          onClick?.()
        }}
        className={cn(
          'flex items-center gap-2 text-sm font-medium transition-colors',
          variant === 'header' && 'px-3 py-2 hover:bg-gray-100 rounded-md',
          variant === 'sidebar' && 'w-full px-3 py-2 rounded-md hover:bg-gray-100',
          variant === 'dropdown' && 'w-full px-2 py-1.5 text-left hover:bg-gray-100 rounded-sm',
          className
        )}
      >
        {Icon && <Icon className="h-4 w-4" />}
        <span>{item.label}</span>
        {item.badge && (
          <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
            {item.badge}
          </span>
        )}
      </button>
    )
  }

  // External links
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={cn(
          'flex items-center gap-2 text-sm font-medium transition-colors',
          variant === 'header' && 'px-3 py-2 hover:bg-gray-100 rounded-md',
          variant === 'sidebar' && 'w-full px-3 py-2 rounded-md hover:bg-gray-100',
          variant === 'dropdown' && 'w-full px-2 py-1.5 hover:bg-gray-100 rounded-sm',
          className
        )}
      >
        {Icon && <Icon className="h-4 w-4" />}
        <span>{item.label}</span>
        {item.badge && (
          <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
            {item.badge}
          </span>
        )}
      </a>
    )
  }

  // Internal links
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 text-sm font-medium transition-colors',
        variant === 'header' && [
          'px-3 py-2 rounded-md',
          isActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700',
        ],
        variant === 'sidebar' && [
          'w-full px-3 py-2 rounded-md',
          isActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700',
        ],
        variant === 'dropdown' && [
          'w-full px-2 py-1.5 rounded-sm',
          isActive ? 'bg-gray-100' : 'hover:bg-gray-100',
        ],
        className
      )}
    >
      {Icon && <Icon className={cn('h-4 w-4', variant === 'sidebar' && 'h-5 w-5')} />}
      <span>{item.label}</span>
      {item.badge && (
        <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
          {item.badge}
        </span>
      )}
    </Link>
  )
}
