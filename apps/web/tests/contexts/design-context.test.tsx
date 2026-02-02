import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, renderHook } from '@testing-library/react'
import {
  DesignProvider,
  useDesign,
  useThemeTokens,
  useSafeMode,
} from '@/contexts/design-context'
import type { AppDesign, ThemeTokens, ShellArea } from '@saas/plugins-core'

// Track pathname changes
let mockPathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

// Mock theme utilities
const mockApplyThemeTokens = vi.fn()
const mockGetDefaultThemeTokens = vi.fn(() => ({
  cssVars: { '--brand': '#default' },
}))
const mockGetTokensForArea: Mock<(design: AppDesign | null, area: ShellArea) => Record<string, string> | null> = vi.fn()

vi.mock('@/lib/theme/apply-theme-tokens', () => ({
  applyThemeTokens: (tokens: ThemeTokens) => mockApplyThemeTokens(tokens),
  getDefaultThemeTokens: () => mockGetDefaultThemeTokens(),
}))

vi.mock('@/lib/theme/get-shell-for-area', () => ({
  getTokensForArea: (design: AppDesign | null, area: ShellArea) => mockGetTokensForArea(design, area),
}))

// Test consumer to verify context values
function TestConsumer() {
  const { design, themeTokens, isLoaded, isDefault, isSafeMode, applyAreaTokens } = useDesign()
  return (
    <div>
      <div data-testid="has-design">{design ? 'yes' : 'no'}</div>
      <div data-testid="is-loaded">{isLoaded ? 'yes' : 'no'}</div>
      <div data-testid="is-default">{isDefault ? 'yes' : 'no'}</div>
      <div data-testid="is-safe-mode">{isSafeMode ? 'yes' : 'no'}</div>
      <div data-testid="tokens">{JSON.stringify(themeTokens)}</div>
      <button onClick={() => applyAreaTokens('admin')} data-testid="apply-admin">
        Apply Admin
      </button>
    </div>
  )
}

// Helper to set pathname before render
function setPathname(path: string) {
  mockPathname = path
}

describe('DesignContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname = '/'
    mockGetDefaultThemeTokens.mockReturnValue({
      cssVars: { '--brand': '#default' },
    })
    mockGetTokensForArea.mockReturnValue(null)
  })

  describe('DesignProvider', () => {
    it('provides design context to children', async () => {
      render(
        <DesignProvider>
          <TestConsumer />
        </DesignProvider>
      )

      expect(screen.getByTestId('has-design')).toHaveTextContent('no')
      expect(screen.getByTestId('is-default')).toHaveTextContent('yes')
    })

    it('accepts design prop', async () => {
      const mockDesign: Partial<AppDesign> = {
        designId: 'test-design',
        appTokens: () => ({ cssVars: { '--brand': '#test' } } as ThemeTokens),
      }

      render(
        <DesignProvider design={mockDesign as AppDesign}>
          <TestConsumer />
        </DesignProvider>
      )

      expect(screen.getByTestId('has-design')).toHaveTextContent('yes')
      expect(screen.getByTestId('is-default')).toHaveTextContent('no')
    })
  })

  describe('area detection from pathname', () => {
    it('detects app area for root path', () => {
      setPathname('/')
      mockGetTokensForArea.mockImplementation((_design: AppDesign | null, area: ShellArea) => {
        return { detectedArea: area }
      })

      const mockDesign: Partial<AppDesign> = {
        designId: 'test-design',
        appTokens: () => ({ cssVars: {} } as ThemeTokens),
      }

      render(
        <DesignProvider design={mockDesign as AppDesign}>
          <TestConsumer />
        </DesignProvider>
      )

      // Should call getTokensForArea with 'app' area
      expect(mockGetTokensForArea).toHaveBeenCalledWith(mockDesign, 'app')
    })

    it('detects admin area for /admin paths', () => {
      setPathname('/admin/settings')
      mockGetTokensForArea.mockImplementation((_design: AppDesign | null, area: ShellArea) => {
        return { detectedArea: area }
      })

      const mockDesign: Partial<AppDesign> = {
        designId: 'test-design',
        appTokens: () => ({ cssVars: {} } as ThemeTokens),
      }

      render(
        <DesignProvider design={mockDesign as AppDesign}>
          <TestConsumer />
        </DesignProvider>
      )

      expect(mockGetTokensForArea).toHaveBeenCalledWith(mockDesign, 'admin')
    })

    it('detects auth area for /login path', () => {
      setPathname('/login')
      mockGetTokensForArea.mockImplementation((_design: AppDesign | null, area: ShellArea) => {
        return { detectedArea: area }
      })

      const mockDesign: Partial<AppDesign> = {
        designId: 'test-design',
        appTokens: () => ({ cssVars: {} } as ThemeTokens),
      }

      render(
        <DesignProvider design={mockDesign as AppDesign}>
          <TestConsumer />
        </DesignProvider>
      )

      expect(mockGetTokensForArea).toHaveBeenCalledWith(mockDesign, 'auth')
    })

    it('detects auth area for /register path', () => {
      setPathname('/register')
      mockGetTokensForArea.mockImplementation((_design: AppDesign | null, area: ShellArea) => {
        return { detectedArea: area }
      })

      const mockDesign: Partial<AppDesign> = {
        designId: 'test-design',
        appTokens: () => ({ cssVars: {} } as ThemeTokens),
      }

      render(
        <DesignProvider design={mockDesign as AppDesign}>
          <TestConsumer />
        </DesignProvider>
      )

      expect(mockGetTokensForArea).toHaveBeenCalledWith(mockDesign, 'auth')
    })

    it('detects app area for /dashboard path', () => {
      setPathname('/dashboard')
      mockGetTokensForArea.mockImplementation((_design: AppDesign | null, area: ShellArea) => {
        return { detectedArea: area }
      })

      const mockDesign: Partial<AppDesign> = {
        designId: 'test-design',
        appTokens: () => ({ cssVars: {} } as ThemeTokens),
      }

      render(
        <DesignProvider design={mockDesign as AppDesign}>
          <TestConsumer />
        </DesignProvider>
      )

      expect(mockGetTokensForArea).toHaveBeenCalledWith(mockDesign, 'app')
    })

    it('uses initialArea prop when provided instead of pathname detection', () => {
      setPathname('/dashboard') // Would normally be 'app'
      mockGetTokensForArea.mockImplementation((_design: AppDesign | null, area: ShellArea) => {
        return { detectedArea: area }
      })

      const mockDesign: Partial<AppDesign> = {
        designId: 'test-design',
        appTokens: () => ({ cssVars: {} } as ThemeTokens),
      }

      render(
        <DesignProvider design={mockDesign as AppDesign} initialArea="admin">
          <TestConsumer />
        </DesignProvider>
      )

      // initialArea should override pathname detection
      expect(mockGetTokensForArea).toHaveBeenCalledWith(mockDesign, 'admin')
    })
  })

  describe('safe mode', () => {
    it('uses default tokens in safe mode', async () => {
      render(
        <DesignProvider serverSafeMode={true}>
          <TestConsumer />
        </DesignProvider>
      )

      expect(screen.getByTestId('is-safe-mode')).toHaveTextContent('yes')
      expect(screen.getByTestId('is-default')).toHaveTextContent('yes')
    })

    it('ignores design in safe mode', async () => {
      const mockDesign: Partial<AppDesign> = {
        designId: 'test-design',
        appTokens: () => ({ cssVars: { '--brand': '#test' } } as ThemeTokens),
      }

      render(
        <DesignProvider design={mockDesign as AppDesign} serverSafeMode={true}>
          <TestConsumer />
        </DesignProvider>
      )

      // In safe mode, design should not be exposed
      expect(screen.getByTestId('has-design')).toHaveTextContent('no')
      expect(screen.getByTestId('is-safe-mode')).toHaveTextContent('yes')
    })
  })

  describe('useDesign hook', () => {
    it('throws when used outside DesignProvider', () => {
      expect(() => {
        renderHook(() => useDesign())
      }).toThrow('useDesign must be used within a DesignProvider')
    })
  })

  describe('useThemeTokens hook', () => {
    it('returns current theme tokens', () => {
      const { result } = renderHook(() => useThemeTokens(), {
        wrapper: ({ children }) => (
          <DesignProvider>{children}</DesignProvider>
        ),
      })

      expect(result.current).toHaveProperty('cssVars')
    })
  })

  describe('useSafeMode hook', () => {
    it('returns false when not in safe mode', () => {
      const { result } = renderHook(() => useSafeMode(), {
        wrapper: ({ children }) => (
          <DesignProvider>{children}</DesignProvider>
        ),
      })

      expect(result.current).toBe(false)
    })

    it('returns true when in safe mode', () => {
      const { result } = renderHook(() => useSafeMode(), {
        wrapper: ({ children }) => (
          <DesignProvider serverSafeMode={true}>{children}</DesignProvider>
        ),
      })

      expect(result.current).toBe(true)
    })
  })

  describe('applyAreaTokens (no-op)', () => {
    it('is a no-op function for API compatibility', async () => {
      // This test verifies that applyAreaTokens exists and can be called
      // without causing errors (it's now a no-op since area is derived from pathname)
      setPathname('/dashboard')

      function ApplyAreaTokensConsumer() {
        const { applyAreaTokens } = useDesign()
        return (
          <button onClick={() => applyAreaTokens('admin')} data-testid="apply">
            Apply
          </button>
        )
      }

      render(
        <DesignProvider>
          <ApplyAreaTokensConsumer />
        </DesignProvider>
      )

      // Click the button to call applyAreaTokens - should not throw
      screen.getByTestId('apply').click()

      // If we get here without errors, the no-op function works correctly
      expect(screen.getByTestId('apply')).toBeInTheDocument()
    })
  })
})
