import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import {
  NavigationProvider,
  useNavigation,
  useMainNav,
  useAdminNav,
  useUserMenuNav,
  useNavSection,
} from '@/contexts/navigation-context'
import { AuthProvider } from '@/contexts/auth-context'
import type { NavModel, NavContext } from '@saas/plugins-core'

// Mock the server action
const mockBuildNavigationServerSide = vi.fn()
vi.mock('@/lib/nav/actions', () => ({
  buildNavigationServerSide: (...args: unknown[]) => mockBuildNavigationServerSide(...args),
}))

// Mock the main-app client design
vi.mock('@plugins/main-app/client', () => ({
  clientDesign: {
    designId: 'main-app',
    displayName: 'Main Application Design',
    appTokens: () => ({ cssVars: { '--brand': '#3b82f6' } }),
    navBaseline: () => ({ main: [], admin: [], userMenu: [] }),
    AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}))

// Wrapper that provides required contexts
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider initialHasUserInfoCookie={false} initialUserRole={null}>
      <NavigationProvider>{children}</NavigationProvider>
    </AuthProvider>
  )
}

// Test consumer component
function TestConsumer() {
  const { nav, navContext, isLoading, error } = useNavigation()
  const mainSections = useMainNav()
  const adminSections = useAdminNav()
  const userMenuSections = useUserMenuNav()

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="error">{error ?? 'no-error'}</div>
      <div data-testid="main-count">{nav.main.length}</div>
      <div data-testid="admin-count">{nav.admin.length}</div>
      <div data-testid="usermenu-count">{nav.userMenu.length}</div>
      <div data-testid="main-hook-count">{mainSections.length}</div>
      <div data-testid="admin-hook-count">{adminSections.length}</div>
      <div data-testid="usermenu-hook-count">{userMenuSections.length}</div>
      <div data-testid="user-role">{navContext.userRole ?? 'null'}</div>
    </div>
  )
}

describe('NavigationContext', () => {
  beforeEach(() => {
    mockBuildNavigationServerSide.mockReset()
    mockBuildNavigationServerSide.mockResolvedValue({
      nav: { main: [], admin: [], userMenu: [] },
      designId: 'main-app',
      isSafeMode: false,
    })
  })

  describe('NavigationProvider', () => {
    it('provides navigation context to children', async () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      )

      // Should eventually be ready
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready')
      })
    })

    it('starts with loading state', () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      )

      // Initially should be loading
      expect(screen.getByTestId('loading')).toHaveTextContent('loading')
    })

    it('calls buildNavigationServerSide on mount', async () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockBuildNavigationServerSide).toHaveBeenCalled()
      })
    })

    it('handles server action errors gracefully', async () => {
      mockBuildNavigationServerSide.mockRejectedValue(new Error('Server error'))

      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Server error')
      })
    })
  })

  describe('useNavigation hook', () => {
    it('throws when used outside NavigationProvider', () => {
      // This will throw, so we need to catch it
      const renderOutsideProvider = () => {
        render(<TestConsumer />)
      }

      expect(renderOutsideProvider).toThrow('useNavigation must be used within a NavigationProvider')
    })

    it('returns navigation model with all areas', async () => {
      mockBuildNavigationServerSide.mockResolvedValue({
        nav: {
          main: [{ id: 'core.main', items: [] }],
          admin: [{ id: 'core.admin', items: [] }],
          userMenu: [{ id: 'core.account', items: [] }],
        },
        designId: 'main-app',
        isSafeMode: false,
      })

      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('main-count')).toHaveTextContent('1')
        expect(screen.getByTestId('admin-count')).toHaveTextContent('1')
        expect(screen.getByTestId('usermenu-count')).toHaveTextContent('1')
      })
    })
  })

  describe('useMainNav hook', () => {
    it('returns main navigation sections', async () => {
      mockBuildNavigationServerSide.mockResolvedValue({
        nav: {
          main: [
            { id: 'core.main', items: [{ id: 'core.dashboard', label: 'Dashboard', href: '/dashboard' }] },
          ],
          admin: [],
          userMenu: [],
        },
        designId: 'main-app',
        isSafeMode: false,
      })

      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('main-hook-count')).toHaveTextContent('1')
      })
    })
  })

  describe('useAdminNav hook', () => {
    it('returns admin navigation sections', async () => {
      mockBuildNavigationServerSide.mockResolvedValue({
        nav: {
          main: [],
          admin: [
            { id: 'core.admin', items: [{ id: 'core.admin.users', label: 'Users', href: '/admin/users' }] },
            { id: 'core.admin.settings', items: [] },
          ],
          userMenu: [],
        },
        designId: 'main-app',
        isSafeMode: false,
      })

      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('admin-hook-count')).toHaveTextContent('2')
      })
    })
  })

  describe('useUserMenuNav hook', () => {
    it('returns user menu navigation sections', async () => {
      mockBuildNavigationServerSide.mockResolvedValue({
        nav: {
          main: [],
          admin: [],
          userMenu: [
            { id: 'core.account', items: [{ id: 'core.profile', label: 'Profile', href: '/profile' }] },
          ],
        },
        designId: 'main-app',
        isSafeMode: false,
      })

      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('usermenu-hook-count')).toHaveTextContent('1')
      })
    })
  })

  describe('useNavSection hook', () => {
    it('finds section by ID across all areas', async () => {
      mockBuildNavigationServerSide.mockResolvedValue({
        nav: {
          main: [{ id: 'core.main', label: 'Main', items: [] }],
          admin: [{ id: 'core.admin', label: 'Admin', items: [] }],
          userMenu: [{ id: 'core.account', label: 'Account', items: [] }],
        },
        designId: 'main-app',
        isSafeMode: false,
      })

      function SectionConsumer({ sectionId }: { sectionId: string }) {
        const section = useNavSection(sectionId)
        return <div data-testid="section-label">{section?.label ?? 'not-found'}</div>
      }

      render(
        <TestWrapper>
          <SectionConsumer sectionId="core.admin" />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('section-label')).toHaveTextContent('Admin')
      })
    })

    it('returns undefined for unknown section ID', async () => {
      mockBuildNavigationServerSide.mockResolvedValue({
        nav: { main: [], admin: [], userMenu: [] },
        designId: 'main-app',
        isSafeMode: false,
      })

      function SectionConsumer({ sectionId }: { sectionId: string }) {
        const section = useNavSection(sectionId)
        return <div data-testid="section-label">{section?.label ?? 'not-found'}</div>
      }

      render(
        <TestWrapper>
          <SectionConsumer sectionId="unknown.section" />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('section-label')).toHaveTextContent('not-found')
      })
    })
  })

  describe('NavContext building', () => {
    it('builds context from user state', async () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      )

      await waitFor(() => {
        // With no user, role should be null
        expect(screen.getByTestId('user-role')).toHaveTextContent('null')
      })
    })
  })
})
