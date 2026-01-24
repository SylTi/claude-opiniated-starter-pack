import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SubscriptionStatus } from '@/components/billing/subscription-status'
import type { BillingSubscriptionDTO, SubscriptionTierDTO, SubscriptionDTO } from '@saas/shared'

// Mock the billing API
const mockCreatePortal = vi.fn()
const mockCancelSubscription = vi.fn()
vi.mock('@/lib/api', () => ({
  billingApi: {
    createPortal: (...args: unknown[]) => mockCreatePortal(...args),
    cancelSubscription: () => mockCancelSubscription(),
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
    features: null,
    isActive: true,
  }
}

function createMockSubscription(
  tierSlug: string,
  status: SubscriptionDTO['status'],
  providerName: string | null = null,
  providerSubscriptionId: string | null = null
): BillingSubscriptionDTO {
  const tier = createMockTier(tierSlug, tierSlug === 'free' ? 0 : tierSlug === 'tier1' ? 1 : 2)
  return {
    subscription: {
      id: 1,
      tenantId: 1,
      tier,
      status,
      startsAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
      providerName,
      providerSubscriptionId,
    },
    canManage: true,
    hasPaymentMethod: !!providerName,
  }
}

describe('SubscriptionStatus', () => {
  const mockOnUpdate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders subscription info', () => {
    const subscription = createMockSubscription('tier1', 'active', 'stripe', 'sub_123')

    render(<SubscriptionStatus subscription={subscription} onUpdate={mockOnUpdate} />)

    expect(screen.getByText('Subscription')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows status badge with correct styling', () => {
    const subscription = createMockSubscription('tier1', 'active', 'stripe', 'sub_123')

    render(<SubscriptionStatus subscription={subscription} />)

    const badge = screen.getByText('Active')
    expect(badge).toHaveClass('bg-green-100')
  })

  it('shows cancelled status correctly', () => {
    const subscription = createMockSubscription('tier1', 'cancelled', 'stripe', 'sub_123')

    render(<SubscriptionStatus subscription={subscription} />)

    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByText('Cancelled')).toHaveClass('bg-red-100')
  })

  it('shows expired status correctly', () => {
    const subscription = createMockSubscription('tier1', 'expired', 'stripe', 'sub_123')

    render(<SubscriptionStatus subscription={subscription} />)

    expect(screen.getByText('Expired')).toBeInTheDocument()
    expect(screen.getByText('Expired')).toHaveClass('bg-gray-100')
  })

  it('shows provider info when available', () => {
    const subscription = createMockSubscription('tier1', 'active', 'stripe', 'sub_123')

    render(<SubscriptionStatus subscription={subscription} />)

    expect(screen.getByText(/Managed via Stripe/i)).toBeInTheDocument()
  })

  it('shows renewal date for active subscription', () => {
    const subscription = createMockSubscription('tier1', 'active', 'stripe', 'sub_123')

    render(<SubscriptionStatus subscription={subscription} />)

    expect(screen.getByText(/Renews on:/i)).toBeInTheDocument()
  })

  it('shows access until date for cancelled subscription', () => {
    const subscription = createMockSubscription('tier1', 'cancelled', 'stripe', 'sub_123')

    render(<SubscriptionStatus subscription={subscription} />)

    expect(screen.getByText(/Access until:/i)).toBeInTheDocument()
  })

  it('shows Manage Billing button when has payment method', () => {
    const subscription = createMockSubscription('tier1', 'active', 'stripe', 'sub_123')

    render(<SubscriptionStatus subscription={subscription} />)

    expect(screen.getByText('Manage Billing')).toBeInTheDocument()
  })

  it('does not show Manage Billing button without payment method', () => {
    const subscription = createMockSubscription('tier1', 'active')
    subscription.hasPaymentMethod = false

    render(<SubscriptionStatus subscription={subscription} />)

    expect(screen.queryByText('Manage Billing')).not.toBeInTheDocument()
  })

  it('opens billing portal when Manage Billing clicked', async () => {
    const subscription = createMockSubscription('tier1', 'active', 'stripe', 'sub_123')
    mockCreatePortal.mockResolvedValue({ url: 'https://billing.stripe.com/portal' })

    // Mock window.location
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost', assign: vi.fn() },
      writable: true,
    })

    render(<SubscriptionStatus subscription={subscription} />)

    fireEvent.click(screen.getByText('Manage Billing'))

    await waitFor(() => {
      expect(mockCreatePortal).toHaveBeenCalledWith('http://localhost')
    })

    // Restore
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
  })

  it('shows Cancel Subscription button for active provider subscription', () => {
    const subscription = createMockSubscription('tier1', 'active', 'stripe', 'sub_123')

    render(<SubscriptionStatus subscription={subscription} />)

    expect(screen.getByText('Cancel Subscription')).toBeInTheDocument()
  })

  it('does not show Cancel button for cancelled subscription', () => {
    const subscription = createMockSubscription('tier1', 'cancelled', 'stripe', 'sub_123')

    render(<SubscriptionStatus subscription={subscription} />)

    expect(screen.queryByText('Cancel Subscription')).not.toBeInTheDocument()
  })

  it('shows confirmation dialog when Cancel clicked', () => {
    const subscription = createMockSubscription('tier1', 'active', 'stripe', 'sub_123')

    render(<SubscriptionStatus subscription={subscription} />)

    fireEvent.click(screen.getByText('Cancel Subscription'))

    expect(screen.getByText('Cancel Subscription?')).toBeInTheDocument()
    expect(screen.getByText(/will remain active until the end/i)).toBeInTheDocument()
  })

  it('calls cancelSubscription when confirmed', async () => {
    const subscription = createMockSubscription('tier1', 'active', 'stripe', 'sub_123')
    mockCancelSubscription.mockResolvedValue(undefined)

    render(<SubscriptionStatus subscription={subscription} onUpdate={mockOnUpdate} />)

    // Open dialog
    fireEvent.click(screen.getByText('Cancel Subscription'))

    // Confirm
    fireEvent.click(screen.getByText('Yes, Cancel'))

    await waitFor(() => {
      expect(mockCancelSubscription).toHaveBeenCalled()
      expect(mockOnUpdate).toHaveBeenCalled()
    })
  })

  it('handles cancel error gracefully', async () => {
    const subscription = createMockSubscription('tier1', 'active', 'stripe', 'sub_123')
    mockCancelSubscription.mockRejectedValue(new Error('Cancel failed'))

    render(<SubscriptionStatus subscription={subscription} />)

    fireEvent.click(screen.getByText('Cancel Subscription'))
    fireEvent.click(screen.getByText('Yes, Cancel'))

    await waitFor(() => {
      expect(screen.getByText(/Cancel failed/i)).toBeInTheDocument()
    })
  })

  it('shows no subscription message when null', () => {
    const subscription: BillingSubscriptionDTO = {
      subscription: null,
      canManage: false,
      hasPaymentMethod: false,
    }

    render(<SubscriptionStatus subscription={subscription} />)

    expect(screen.getByText('No active subscription')).toBeInTheDocument()
  })
})
