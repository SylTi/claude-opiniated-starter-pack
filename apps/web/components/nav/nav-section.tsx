'use client'

import { useState, useRef, useEffect } from 'react'
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
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return

    const handleClickOutside = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  // For header variant
  if (variant === 'header') {
    // Single item: render as direct link
    if (section.items.length === 1) {
      return (
        <div className={cn('flex items-center gap-1', className)}>
          <NavItem item={section.items[0]} variant="header" />
        </div>
      )
    }

    // Multiple items: render as dropdown menu
    const sectionLabel = section.label ?? section.title ?? 'Menu'

    return (
      <div ref={menuRef} className={cn('relative', className)}>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
        >
          {sectionLabel}
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              isMenuOpen && 'rotate-180'
            )}
          />
        </button>
        {isMenuOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-1 w-48 rounded-md border border-border bg-background shadow-md z-50"
          >
            {section.items.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                variant="dropdown"
                onClick={() => setIsMenuOpen(false)}
              />
            ))}
          </div>
        )}
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
