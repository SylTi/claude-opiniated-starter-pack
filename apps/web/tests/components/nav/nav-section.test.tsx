import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Home, Settings, Users } from 'lucide-react'
import { NavSection } from '@/components/nav/nav-section'
import type { NavSectionWithIcons, NavItemWithIcon } from '@/lib/nav/types'

describe('NavSection Component', () => {
  const baseItems: NavItemWithIcon[] = [
    { id: 'core.dashboard', label: 'Dashboard', href: '/dashboard', icon: Home },
    { id: 'core.settings', label: 'Settings', href: '/settings', icon: Settings },
  ]

  const baseSection: NavSectionWithIcons = {
    id: 'core.main',
    title: 'Main Navigation',
    items: baseItems,
  }

  describe('Header variant', () => {
    it('renders items inline', () => {
      render(<NavSection section={baseSection} variant="header" />)

      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    })

    it('renders items in a flex container', () => {
      const { container } = render(<NavSection section={baseSection} variant="header" />)

      const wrapper = container.firstChild
      expect(wrapper).toHaveClass('flex')
      expect(wrapper).toHaveClass('items-center')
    })

    it('does not render section title in header variant', () => {
      render(<NavSection section={baseSection} variant="header" />)

      // Title should not be visible in header variant
      expect(screen.queryByText('Main Navigation')).not.toBeInTheDocument()
    })
  })

  describe('Sidebar variant', () => {
    it('renders items in a list', () => {
      render(<NavSection section={baseSection} variant="sidebar" />)

      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    })

    it('renders section title when provided', () => {
      render(<NavSection section={baseSection} variant="sidebar" />)

      expect(screen.getByText('Main Navigation')).toBeInTheDocument()
    })

    it('renders items in <ul> and <li> elements', () => {
      render(<NavSection section={baseSection} variant="sidebar" />)

      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })

    it('does not render title when not provided', () => {
      const sectionWithoutTitle: NavSectionWithIcons = {
        ...baseSection,
        title: undefined,
      }

      render(<NavSection section={sectionWithoutTitle} variant="sidebar" />)

      // Only items should be rendered, no heading
      expect(screen.queryByText('Main Navigation')).not.toBeInTheDocument()
    })
  })

  describe('Dropdown variant', () => {
    it('renders items in a list format', () => {
      render(<NavSection section={baseSection} variant="dropdown" />)

      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    })

    it('renders section title with small styling', () => {
      render(<NavSection section={baseSection} variant="dropdown" />)

      const title = screen.getByText('Main Navigation')
      expect(title).toHaveClass('text-xs')
      expect(title).toHaveClass('font-semibold')
    })
  })

  describe('Collapsible behavior', () => {
    const collapsibleSection: NavSectionWithIcons = {
      ...baseSection,
      collapsible: true,
    }

    it('shows chevron icon when collapsible', () => {
      const { container } = render(<NavSection section={collapsibleSection} variant="sidebar" />)

      // Look for the chevron icon
      const chevron = container.querySelector('svg')
      expect(chevron).toBeInTheDocument()
    })

    it('hides items when collapsed', async () => {
      const user = userEvent.setup()

      render(<NavSection section={collapsibleSection} variant="sidebar" />)

      // Initially items should be visible
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()

      // Click to collapse
      const collapseButton = screen.getByRole('button', { name: /Main Navigation/i })
      await user.click(collapseButton)

      // Items should be hidden
      expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
    })

    it('shows items again when expanded', async () => {
      const user = userEvent.setup()

      render(<NavSection section={collapsibleSection} variant="sidebar" />)

      const collapseButton = screen.getByRole('button', { name: /Main Navigation/i })

      // Collapse
      await user.click(collapseButton)
      expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()

      // Expand
      await user.click(collapseButton)
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    })

    it('starts collapsed when defaultCollapsed is true', () => {
      const defaultCollapsedSection: NavSectionWithIcons = {
        ...collapsibleSection,
        defaultCollapsed: true,
      }

      render(<NavSection section={defaultCollapsedSection} variant="sidebar" />)

      // Items should not be visible initially
      expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
    })
  })

  describe('Empty section', () => {
    it('renders without items', () => {
      const emptySection: NavSectionWithIcons = {
        id: 'core.empty',
        title: 'Empty Section',
        items: [],
      }

      render(<NavSection section={emptySection} variant="sidebar" />)

      expect(screen.getByText('Empty Section')).toBeInTheDocument()
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
  })

  describe('Custom className', () => {
    it('merges custom className with default styles', () => {
      const { container } = render(
        <NavSection section={baseSection} variant="header" className="custom-class" />
      )

      const wrapper = container.firstChild
      expect(wrapper).toHaveClass('custom-class')
    })
  })

  describe('Items with various properties', () => {
    it('renders items with onClick handlers as buttons', () => {
      const sectionWithButton: NavSectionWithIcons = {
        id: 'core.actions',
        items: [
          { id: 'core.logout', label: 'Log out', href: '#', onClick: vi.fn() },
        ],
      }

      render(<NavSection section={sectionWithButton} variant="sidebar" />)

      expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
    })

    it('renders items with badges', () => {
      const sectionWithBadge: NavSectionWithIcons = {
        id: 'core.main',
        items: [
          { id: 'core.notifications', label: 'Notifications', href: '/notifications', badge: '5' },
        ],
      }

      render(<NavSection section={sectionWithBadge} variant="sidebar" />)

      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('renders external links correctly', () => {
      const sectionWithExternal: NavSectionWithIcons = {
        id: 'core.external',
        items: [
          { id: 'core.docs', label: 'Docs', href: 'https://docs.example.com', external: true },
        ],
      }

      render(<NavSection section={sectionWithExternal} variant="sidebar" />)

      const link = screen.getByRole('link', { name: 'Docs' })
      expect(link).toHaveAttribute('target', '_blank')
    })
  })
})
