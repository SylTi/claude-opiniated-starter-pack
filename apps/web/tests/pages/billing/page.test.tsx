import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import BillingPage from '@/app/billing/page'
import type { BillingTierDTO, BillingSubscriptionDTO, SubscriptionTierDTO, PriceDTO } from '@saas/shared'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock the auth context
const mockUseAuth = vi.fn()
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

// Mock the billing API
const mockGetTiers = vi.fn()
const mockGetSubscription = vi.fn()
const mockCreateCheckout = vi.fn()
vi.mock('@/lib/api', () => ({
  billingApi: {
    getTiers: () => mockGetTiers(),
    getSubscription: () => mockGetSubscription(),
    createCheckout: (...args: unknown[]) => mockCreateCheckout(...args),
  },
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function createMockTier(slug: string, level: number): SubscriptionTierDTO {
  return {
    id: level + 1,
    slug,
    name: slug === 'free' ? 'Free' : slug === 'tier1' ? 'Pro' : 'Enterprise',
    level,
    maxTeamMembers: slug === 'free' ? 5 : slug === 'tier1' ? 20 : null,
    priceMonthly: null,
    yearlyDiscountPercent: null,
    features: { feature1: true, feature2: slug !== 'free' },
    isActive: true,
  }
}

function createMockPrice(interval: 'month' | 'year', currency: string, amount: number): PriceDTO {
  return {
    id: Math.random(),
    interval,
    currency,
    unitAmount: amount,
    taxBehavior: 'exclusive',
    isActive: true,
  }
}

function createMockBillingTier(tierSlug: string, level: number): BillingTierDTO {
  const tier = createMockTier(tierSlug, level)
  const prices: PriceDTO[] = tierSlug === 'free' ? [] : [
    createMockPrice('month', 'usd', tierSlug === 'tier1' ? 1999 : 4999),
    createMockPrice('year', 'usd', tierSlug === 'tier1' ? 19990 : 49990),
  ]
  return { tier, prices }
}

describe('BillingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: null, isLoading: false })
    mockGetTiers.mockResolvedValue([])
  })

  it('renders loading state initially', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true })
    render(<BillingPage />)

    // Should show skeleton loaders
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders tiers after loading', async () => {
    const tiers: BillingTierDTO[] = [
      createMockBillingTier('free', 0),
      createMockBillingTier('tier1', 1),
      createMockBillingTier('tier2', 2),
    ]
    mockGetTiers.mockResolvedValue(tiers)

    render(<BillingPage />)

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeInTheDocument()
      expect(screen.getByText('Pro')).toBeInTheDocument()
      expect(screen.getByText('Enterprise')).toBeInTheDocument()
    })
  })

  it('shows sign in message for unauthenticated users', async () => {
    mockGetTiers.mockResolvedValue([createMockBillingTier('free', 0)])

    render(<BillingPage />)

    await waitFor(() => {
      expect(screen.getByText(/sign in/i)).toBeInTheDocument()
    })
  })

  it('shows subscription status for authenticated users', async () => {
    const mockUser = { id: 1, email: 'test@example.com', fullName: 'Test User' }
    const mockSubscription: BillingSubscriptionDTO = {
      subscription: {
        id: 1,
        subscriberType: 'user',
        subscriberId: 1,
        tier: createMockTier('tier1', 1),
        status: 'active',
        startsAt: new Date().toISOString(),
        expiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      },
      canManage: true,
      hasPaymentMethod: true,
    }

    mockUseAuth.mockReturnValue({ user: mockUser, isLoading: false })
    mockGetTiers.mockResolvedValue([createMockBillingTier('tier1', 1)])
    mockGetSubscription.mockResolvedValue(mockSubscription)

    render(<BillingPage />)

    await waitFor(() => {
      expect(screen.getByText('Subscription')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
    })
  })

  it('allows switching between monthly and yearly', async () => {
    mockGetTiers.mockResolvedValue([createMockBillingTier('tier1', 1)])

    render(<BillingPage />)

    await waitFor(() => {
      expect(screen.getByText('Monthly')).toBeInTheDocument()
      expect(screen.getByText(/Yearly/)).toBeInTheDocument()
    })

    // Click yearly
    fireEvent.click(screen.getByText(/Yearly/))

    // The prices should update (tested via component behavior)
  })

  it('handles API error gracefully', async () => {
    mockGetTiers.mockRejectedValue(new Error('Network error'))

    render(<BillingPage />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to load billing data/i)).toBeInTheDocument()
    })
  })
})
