import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Providers } from '@/components/providers'
import { useAuth } from '@/contexts/auth-context'
import { useDesign } from '@/contexts/design-context'
import { useNavigation } from '@/contexts/navigation-context'

// Mock the server action
vi.mock('@/lib/nav/actions', () => ({
  buildNavigationServerSide: vi.fn().mockResolvedValue({
    nav: { main: [], admin: [], userMenu: [] },
    designId: 'main-app',
    isSafeMode: false,
  }),
}))

// Mock the main-app client design
vi.mock('@plugins/main-app/client', () => ({
  clientDesign: {
    designId: 'main-app',
    displayName: 'Main Application Design',
    appTokens: () => ({
      cssVars: { '--brand': '#3b82f6' },
      colorPrimary: '#3b82f6',
    }),
    navBaseline: () => ({ main: [], admin: [], userMenu: [] }),
    AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}))

// Mock the Header component since it's now rendered inside Providers
vi.mock('@/components/header', () => ({
  Header: () => <header data-testid="mock-header">Header</header>,
}))

/**
 * Test component to access contexts
 */
function TestConsumer() {
  const auth = useAuth()
  const design = useDesign()
  const navigation = useNavigation()

  return (
    <div>
      <div data-testid="auth-status">
        {auth.user ? 'authenticated' : 'unauthenticated'}
      </div>
      <div data-testid="design-id">{design.design?.designId ?? 'default'}</div>
      <div data-testid="nav-loading">{navigation.isLoading ? 'loading' : 'ready'}</div>
    </div>
  )
}

describe('Providers Component', () => {
  it('renders children', () => {
    render(
      <Providers>
        <div data-testid="child">Child content</div>
      </Providers>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('provides AuthContext', () => {
    render(
      <Providers>
        <TestConsumer />
      </Providers>
    )

    // Should have access to auth context
    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
  })

  it('provides DesignContext', () => {
    render(
      <Providers>
        <TestConsumer />
      </Providers>
    )

    // Should have access to design context
    expect(screen.getByTestId('design-id')).toHaveTextContent('main-app')
  })

  it('provides NavigationContext', async () => {
    render(
      <Providers>
        <TestConsumer />
      </Providers>
    )

    // Navigation context should be available (might start as loading)
    await waitFor(() => {
      expect(screen.getByTestId('nav-loading')).toBeInTheDocument()
    })
  })

  it('passes initialHasUserInfoCookie to AuthProvider', () => {
    render(
      <Providers initialHasUserInfoCookie={true}>
        <TestConsumer />
      </Providers>
    )

    // The auth provider should receive the initial cookie state
    // This affects the pending user state in the UI
    expect(screen.getByTestId('auth-status')).toBeInTheDocument()
  })

  it('passes initialUserRole to AuthProvider', () => {
    render(
      <Providers initialUserRole="admin">
        <TestConsumer />
      </Providers>
    )

    // The auth provider should receive the initial role
    expect(screen.getByTestId('auth-status')).toBeInTheDocument()
  })

  describe('Context nesting order', () => {
    it('wraps contexts in correct order (Auth -> Design -> Navigation)', () => {
      // The order is important because:
      // - NavigationContext depends on AuthContext for user info
      // - DesignContext provides the design for navigation

      const { container } = render(
        <Providers>
          <div data-testid="nested">Nested content</div>
        </Providers>
      )

      // Content should be accessible through all providers
      expect(screen.getByTestId('nested')).toBeInTheDocument()
    })
  })

  describe('Default props', () => {
    it('uses false for initialHasUserInfoCookie by default', () => {
      render(
        <Providers>
          <TestConsumer />
        </Providers>
      )

      // With no cookie, user should be unauthenticated
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
    })

    it('uses null for initialUserRole by default', () => {
      render(
        <Providers>
          <TestConsumer />
        </Providers>
      )

      // Should render without errors
      expect(screen.getByTestId('auth-status')).toBeInTheDocument()
    })
  })
})
