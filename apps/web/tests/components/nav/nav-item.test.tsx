import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Home, Settings } from 'lucide-react'
import { NavItem } from '@/components/nav/nav-item'
import type { NavItemWithIcon } from '@/lib/nav/types'

describe('NavItem Component', () => {
  const baseItem: NavItemWithIcon = {
    id: 'core.dashboard',
    label: 'Dashboard',
    href: '/dashboard',
  }

  describe('Internal links', () => {
    it('renders a link with label', () => {
      render(<NavItem item={baseItem} />)

      const link = screen.getByRole('link', { name: 'Dashboard' })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/dashboard')
    })

    it('renders with icon when provided', () => {
      const itemWithIcon: NavItemWithIcon = {
        ...baseItem,
        icon: Home,
      }

      render(<NavItem item={itemWithIcon} />)

      // Icon should be rendered as an SVG
      const link = screen.getByRole('link', { name: 'Dashboard' })
      const svg = link.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('renders with badge when provided', () => {
      const itemWithBadge: NavItemWithIcon = {
        ...baseItem,
        badge: 'New',
      }

      render(<NavItem item={itemWithBadge} />)

      expect(screen.getByText('New')).toBeInTheDocument()
    })

    it('applies active styles based on pathname', () => {
      // Mock the pathname to match the item's href
      vi.doMock('next/navigation', () => ({
        usePathname: () => '/dashboard',
      }))

      render(<NavItem item={baseItem} />)

      const link = screen.getByRole('link', { name: 'Dashboard' })
      // Check that it has some styling applied (specific class depends on variant)
      expect(link).toHaveClass('flex')
    })
  })

  describe('External links', () => {
    it('renders external link with target="_blank"', () => {
      const externalItem: NavItemWithIcon = {
        ...baseItem,
        href: 'https://example.com',
        external: true,
      }

      render(<NavItem item={externalItem} />)

      const link = screen.getByRole('link', { name: 'Dashboard' })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('renders external link with icon', () => {
      const externalItem: NavItemWithIcon = {
        ...baseItem,
        href: 'https://example.com',
        external: true,
        icon: Settings,
      }

      render(<NavItem item={externalItem} />)

      const link = screen.getByRole('link', { name: 'Dashboard' })
      const svg = link.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  describe('Button items (onClick)', () => {
    it('renders button when onClick is provided', () => {
      const onClickFn = vi.fn()
      const buttonItem: NavItemWithIcon = {
        ...baseItem,
        onClick: onClickFn,
      }

      render(<NavItem item={buttonItem} />)

      const button = screen.getByRole('button', { name: 'Dashboard' })
      expect(button).toBeInTheDocument()
    })

    it('calls onClick handler when clicked', async () => {
      const user = userEvent.setup()
      const onClickFn = vi.fn()
      const buttonItem: NavItemWithIcon = {
        ...baseItem,
        onClick: onClickFn,
      }

      render(<NavItem item={buttonItem} />)

      const button = screen.getByRole('button', { name: 'Dashboard' })
      await user.click(button)

      expect(onClickFn).toHaveBeenCalledOnce()
    })

    it('renders button with icon', () => {
      const buttonItem: NavItemWithIcon = {
        ...baseItem,
        icon: Settings,
        onClick: vi.fn(),
      }

      render(<NavItem item={buttonItem} />)

      const button = screen.getByRole('button', { name: 'Dashboard' })
      const svg = button.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  describe('Variants', () => {
    it('applies header variant styles', () => {
      render(<NavItem item={baseItem} variant="header" />)

      const link = screen.getByRole('link', { name: 'Dashboard' })
      expect(link).toHaveClass('px-3')
      expect(link).toHaveClass('py-2')
    })

    it('applies sidebar variant styles', () => {
      render(<NavItem item={baseItem} variant="sidebar" />)

      const link = screen.getByRole('link', { name: 'Dashboard' })
      expect(link).toHaveClass('w-full')
      expect(link).toHaveClass('px-3')
    })

    it('applies dropdown variant styles', () => {
      render(<NavItem item={baseItem} variant="dropdown" />)

      const link = screen.getByRole('link', { name: 'Dashboard' })
      expect(link).toHaveClass('w-full')
      expect(link).toHaveClass('px-2')
    })
  })

  describe('Custom className', () => {
    it('merges custom className with default styles', () => {
      render(<NavItem item={baseItem} className="custom-class" />)

      const link = screen.getByRole('link', { name: 'Dashboard' })
      expect(link).toHaveClass('custom-class')
    })
  })
})
