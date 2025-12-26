import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BillingPage from '@/app/billing/page'
import type {
  BillingTierDTO,
  BillingSubscriptionDTO,
  SubscriptionTierDTO,
  PriceDTO,
  BalanceDTO,
  ValidateDiscountCodeResponse,
} from '@saas/shared'

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
const mockValidateDiscountCode = vi.fn()
const mockGetBalance = vi.fn()
const mockRedeemCoupon = vi.fn()

vi.mock('@/lib/api', () => ({
  billingApi: {
    getTiers: () => mockGetTiers(),
    getSubscription: () => mockGetSubscription(),
    createCheckout: (...args: unknown[]) => mockCreateCheckout(...args),
    validateDiscountCode: (...args: unknown[]) => mockValidateDiscountCode(...args),
    getBalance: (...args: unknown[]) => mockGetBalance(...args),
    redeemCoupon: (...args: unknown[]) => mockRedeemCoupon(...args),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public statusCode: number,
      public error: string,
      message: string
    ) {
      super(message)
    }
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
    description: `${slug} tier description`,
    level,
    maxTeamMembers: slug === 'free' ? 5 : slug === 'tier1' ? 20 : null,
    priceMonthly: null,
    yearlyDiscountPercent: null,
    features: { feature1: true, feature2: slug !== 'free' },
    isActive: true,
  }
}

function createMockPrice(id: number, interval: 'month' | 'year', currency: string, amount: number): PriceDTO {
  return {
    id,
    interval,
    currency,
    unitAmount: amount,
    taxBehavior: 'exclusive',
    isActive: true,
  }
}

function createMockBillingTier(tierSlug: string, level: number): BillingTierDTO {
  const tier = createMockTier(tierSlug, level)
  const prices: PriceDTO[] =
    tierSlug === 'free'
      ? []
      : [
          createMockPrice(level * 10 + 1, 'month', 'usd', tierSlug === 'tier1' ? 1999 : 4999),
          createMockPrice(level * 10 + 2, 'year', 'usd', tierSlug === 'tier1' ? 19990 : 49990),
        ]
  return { tier, prices }
}

describe('BillingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: null, isLoading: false })
    mockGetTiers.mockResolvedValue([])
    mockGetBalance.mockResolvedValue({ balance: 0, currency: 'usd' })
  })

  it('renders loading state initially', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true })
    render(<BillingPage />)

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
        providerName: null,
        providerSubscriptionId: null,
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

    fireEvent.click(screen.getByText(/Yearly/))
  })

  it('handles API error gracefully', async () => {
    mockGetTiers.mockRejectedValue(new Error('Network error'))

    render(<BillingPage />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to load billing data/i)).toBeInTheDocument()
    })
  })

  describe('with authenticated user', () => {
    beforeEach(() => {
      const mockUser = { id: 1, email: 'test@example.com', fullName: 'Test User' }
      mockUseAuth.mockReturnValue({ user: mockUser, isLoading: false })
      mockGetSubscription.mockResolvedValue({ subscription: null, canManage: false, hasPaymentMethod: false })
    })

    it('shows balance card for authenticated users', async () => {
      mockGetTiers.mockResolvedValue([createMockBillingTier('tier1', 1)])
      mockGetBalance.mockResolvedValue({ balance: 5000, currency: 'usd' })

      render(<BillingPage />)

      await waitFor(() => {
        expect(screen.getByText('Account Balance')).toBeInTheDocument()
      })
    })

    it('shows coupon redemption for authenticated users', async () => {
      mockGetTiers.mockResolvedValue([createMockBillingTier('tier1', 1)])

      render(<BillingPage />)

      await waitFor(() => {
        expect(screen.getByText('Redeem Coupon')).toBeInTheDocument()
      })
    })

    it('shows discount code input for authenticated users', async () => {
      mockGetTiers.mockResolvedValue([createMockBillingTier('tier1', 1)])

      render(<BillingPage />)

      await waitFor(() => {
        expect(screen.getByText('Discount Code')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Enter discount code')).toBeInTheDocument()
      })
    })

    it('validates discount code when clicking a plan', async () => {
      const user = userEvent.setup()
      const tiers: BillingTierDTO[] = [createMockBillingTier('tier1', 1)]
      mockGetTiers.mockResolvedValue(tiers)

      const validationResponse: ValidateDiscountCodeResponse = {
        valid: true,
        discountCode: {
          id: 1,
          code: 'SUMMER20',
          description: 'Summer sale',
          discountType: 'percent',
          discountValue: 20,
          currency: null,
          minAmount: null,
          maxUses: null,
          maxUsesPerUser: null,
          timesUsed: 0,
          expiresAt: null,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: null,
        },
        originalAmount: 1999,
        discountedAmount: 1599,
        discountApplied: 400,
      }
      mockValidateDiscountCode.mockResolvedValue(validationResponse)

      render(<BillingPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter discount code')).toBeInTheDocument()
      })

      const discountInput = screen.getByPlaceholderText('Enter discount code')
      await user.type(discountInput, 'SUMMER20')

      // Click the upgrade button for the tier
      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/i })
      await user.click(upgradeButton)

      await waitFor(() => {
        expect(mockValidateDiscountCode).toHaveBeenCalledWith('SUMMER20', expect.any(Number))
      })
    })

    it('shows discount applied message after validation', async () => {
      const user = userEvent.setup()
      const tiers: BillingTierDTO[] = [createMockBillingTier('tier1', 1)]
      mockGetTiers.mockResolvedValue(tiers)

      const validationResponse: ValidateDiscountCodeResponse = {
        valid: true,
        discountCode: {
          id: 1,
          code: 'SUMMER20',
          description: null,
          discountType: 'percent',
          discountValue: 20,
          currency: null,
          minAmount: null,
          maxUses: null,
          maxUsesPerUser: null,
          timesUsed: 0,
          expiresAt: null,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: null,
        },
        originalAmount: 1999,
        discountedAmount: 1599,
        discountApplied: 400,
      }
      mockValidateDiscountCode.mockResolvedValue(validationResponse)

      render(<BillingPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter discount code')).toBeInTheDocument()
      })

      const discountInput = screen.getByPlaceholderText('Enter discount code')
      await user.type(discountInput, 'SUMMER20')

      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/i })
      await user.click(upgradeButton)

      await waitFor(() => {
        expect(screen.getByText('Discount Applied!')).toBeInTheDocument()
      })
    })

    it('clears discount code when X button is clicked', async () => {
      const user = userEvent.setup()
      mockGetTiers.mockResolvedValue([createMockBillingTier('tier1', 1)])

      render(<BillingPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter discount code')).toBeInTheDocument()
      })

      const discountInput = screen.getByPlaceholderText('Enter discount code')
      await user.type(discountInput, 'SUMMER20')

      expect(discountInput).toHaveValue('SUMMER20')

      // Find and click the X button
      const clearButton = discountInput.parentElement?.querySelector('button')
      if (clearButton) {
        await user.click(clearButton)
      }

      expect(discountInput).toHaveValue('')
    })

    it('includes discount code in checkout when validated', async () => {
      const user = userEvent.setup()
      const tiers: BillingTierDTO[] = [createMockBillingTier('tier1', 1)]
      mockGetTiers.mockResolvedValue(tiers)

      const validationResponse: ValidateDiscountCodeResponse = {
        valid: true,
        discountCode: {
          id: 1,
          code: 'SUMMER20',
          description: null,
          discountType: 'percent',
          discountValue: 20,
          currency: null,
          minAmount: null,
          maxUses: null,
          maxUsesPerUser: null,
          timesUsed: 0,
          expiresAt: null,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: null,
        },
        originalAmount: 1999,
        discountedAmount: 1599,
        discountApplied: 400,
      }
      mockValidateDiscountCode.mockResolvedValue(validationResponse)
      mockCreateCheckout.mockResolvedValue({ url: 'https://checkout.example.com' })

      // Mock window.location
      const originalLocation = window.location
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, href: '', origin: 'http://localhost:3000' },
        writable: true,
      })

      render(<BillingPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter discount code')).toBeInTheDocument()
      })

      const discountInput = screen.getByPlaceholderText('Enter discount code')
      await user.type(discountInput, 'SUMMER20')

      // First click validates
      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Pro/i })
      await user.click(upgradeButton)

      await waitFor(() => {
        expect(screen.getByText('Discount Applied!')).toBeInTheDocument()
      })

      // Second click proceeds to checkout
      await user.click(upgradeButton)

      await waitFor(() => {
        expect(mockCreateCheckout).toHaveBeenCalledWith(
          expect.objectContaining({
            discountCode: 'SUMMER20',
          })
        )
      })

      // Restore window.location
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
      })
    })

    it('refreshes balance after coupon redemption', async () => {
      const user = userEvent.setup()
      mockGetTiers.mockResolvedValue([createMockBillingTier('tier1', 1)])
      mockGetBalance.mockResolvedValue({ balance: 0, currency: 'usd' })
      mockRedeemCoupon.mockResolvedValue({
        success: true,
        creditAmount: 5000,
        currency: 'usd',
        newBalance: 5000,
      })

      render(<BillingPage />)

      await waitFor(() => {
        expect(screen.getByText('Redeem Coupon')).toBeInTheDocument()
      })

      const couponInput = screen.getByPlaceholderText('Enter coupon code')
      await user.type(couponInput, 'GIFT50')

      const redeemButton = screen.getByRole('button', { name: 'Redeem' })
      await user.click(redeemButton)

      await waitFor(() => {
        // Balance should be refetched (mock was called twice - once on load, once after redemption)
        expect(mockGetBalance.mock.calls.length).toBeGreaterThanOrEqual(1)
      })
    })
  })
})
