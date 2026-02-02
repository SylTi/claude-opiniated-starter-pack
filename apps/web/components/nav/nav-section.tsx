'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NavSectionWithIcons } from '@/lib/nav/types'
import { NavItem } from './nav-item'

/**
 * Props for NavSection component.
 */
export interface NavSectionProps {
  section: NavSectionWithIcons

  /** Additional class names */
  className?: string

  /** Variant for different nav contexts */
  variant?: 'header' | 'sidebar' | 'dropdown'
}

/**
 * Navigation section component.
 * Groups related nav items together.
 */
export function NavSection({ section, className, variant = 'sidebar' }: NavSectionProps): React.ReactElement {
  const [isCollapsed, setIsCollapsed] = useState(section.defaultCollapsed ?? false)

  // For header variant, render items inline
  if (variant === 'header') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {section.items.map((item) => (
          <NavItem key={item.id} item={item} variant="header" />
        ))}
      </div>
    )
  }

  // Section heading: prefer label, fall back to deprecated title
  const sectionHeading = section.label ?? section.title

  // For dropdown variant, render items in a list
  if (variant === 'dropdown') {
    return (
      <div className={cn('py-1', className)}>
        {sectionHeading && (
          <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {sectionHeading}
          </div>
        )}
        {section.items.map((item) => (
          <NavItem key={item.id} item={item} variant="dropdown" />
        ))}
      </div>
    )
  }

  // Sidebar variant with optional collapsible behavior
  return (
    <div className={cn('space-y-1', className)}>
      {sectionHeading && section.collapsible ? (
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700"
        >
          <span>{sectionHeading}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              isCollapsed && '-rotate-90'
            )}
          />
        </button>
      ) : sectionHeading ? (
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {sectionHeading}
        </div>
      ) : null}

      {!isCollapsed && (
        <ul className="space-y-1">
          {section.items.map((item) => (
            <li key={item.id}>
              <NavItem item={item} variant="sidebar" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
