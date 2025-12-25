import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PricingCard } from '@/components/billing/pricing-card'
import type { BillingTierDTO, SubscriptionTierDTO, PriceDTO } from '@saas/shared'

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
    features: { api_access: true, priority_support: slug !== 'free' },
    isActive: true,
  }
}

function createMockPrice(
  interval: 'month' | 'year',
  currency: string,
  amount: number,
  isActive = true
): PriceDTO {
  return {
    id: Math.random(),
    interval,
    currency,
    unitAmount: amount,
    taxBehavior: 'exclusive',
    isActive,
  }
}

function createMockBillingTier(tierSlug: string, level: number, withPrices = true): BillingTierDTO {
  const tier = createMockTier(tierSlug, level)
  const prices: PriceDTO[] = !withPrices || tierSlug === 'free' ? [] : [
    createMockPrice('month', 'usd', tierSlug === 'tier1' ? 1999 : 4999),
    createMockPrice('year', 'usd', tierSlug === 'tier1' ? 19990 : 49990),
    createMockPrice('month', 'eur', tierSlug === 'tier1' ? 1899 : 4699),
  ]
  return { tier, prices }
}

describe('PricingCard', () => {
  const mockOnSubscribe = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders tier name and description', () => {
    const billingTier = createMockBillingTier('tier1', 1)

    render(
      <PricingCard
        billingTier={billingTier}
        selectedInterval="month"
        selectedCurrency="usd"
        onSubscribe={mockOnSubscribe}
      />
    )

    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('tier1 tier description')).toBeInTheDocument()
  })

  it('displays monthly price correctly', () => {
    const billingTier = createMockBillingTier('tier1', 1)

    render(
      <PricingCard
        billingTier={billingTier}
        selectedInterval="month"
        selectedCurrency="usd"
        onSubscribe={mockOnSubscribe}
      />
    )

    expect(screen.getByText('$19.99')).toBeInTheDocument()
    expect(screen.getByText('/month')).toBeInTheDocument()
  })

  it('displays yearly price correctly', () => {
    const billingTier = createMockBillingTier('tier1', 1)

    render(
      <PricingCard
        billingTier={billingTier}
        selectedInterval="year"
        selectedCurrency="usd"
        onSubscribe={mockOnSubscribe}
      />
    )

    expect(screen.getByText('$199.90')).toBeInTheDocument()
    expect(screen.getByText('/year')).toBeInTheDocument()
  })

  it('displays EUR price when selected', () => {
    const billingTier = createMockBillingTier('tier1', 1)

    render(
      <PricingCard
        billingTier={billingTier}
        selectedInterval="month"
        selectedCurrency="eur"
        onSubscribe={mockOnSubscribe}
      />
    )

    // EUR format
    expect(screen.getByText(/18\.99/)).toBeInTheDocument()
  })

  it('shows "Free" for free tier', () => {
    const billingTier = createMockBillingTier('free', 0)

    render(
      <PricingCard
        billingTier={billingTier}
        selectedInterval="month"
        selectedCurrency="usd"
        onSubscribe={mockOnSubscribe}
      />
    )

    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Free Forever')).toBeInTheDocument()
  })

  it('shows "Current Plan" badge when on current tier', () => {
    const billingTier = createMockBillingTier('tier1', 1)

    render(
      <PricingCard
        billingTier={billingTier}
        currentTierSlug="tier1"
        selectedInterval="month"
        selectedCurrency="usd"
        onSubscribe={mockOnSubscribe}
      />
    )

    expect(screen.getAllByText('Current Plan').length).toBeGreaterThan(0)
  })

  it('shows upgrade button for non-current paid tiers', () => {
    const billingTier = createMockBillingTier('tier1', 1)

    render(
      <PricingCard
        billingTier={billingTier}
        currentTierSlug="free"
        selectedInterval="month"
        selectedCurrency="usd"
        onSubscribe={mockOnSubscribe}
      />
    )

    expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
  })

  it('calls onSubscribe when upgrade button clicked', () => {
    const billingTier = createMockBillingTier('tier1', 1)

    render(
      <PricingCard
        billingTier={billingTier}
        currentTierSlug="free"
        selectedInterval="month"
        selectedCurrency="usd"
        onSubscribe={mockOnSubscribe}
      />
    )

    fireEvent.click(screen.getByText('Upgrade to Pro'))

    expect(mockOnSubscribe).toHaveBeenCalled()
  })

  it('disables button when loading', () => {
    const billingTier = createMockBillingTier('tier1', 1)

    render(
      <PricingCard
        billingTier={billingTier}
        currentTierSlug="free"
        selectedInterval="month"
        selectedCurrency="usd"
        onSubscribe={mockOnSubscribe}
        isLoading={true}
      />
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled()
  })

  it('shows max team members when defined', () => {
    const billingTier = createMockBillingTier('tier1', 1)

    render(
      <PricingCard
        billingTier={billingTier}
        selectedInterval="month"
        selectedCurrency="usd"
        onSubscribe={mockOnSubscribe}
      />
    )

    expect(screen.getByText(/up to 20 team members/i)).toBeInTheDocument()
  })

  it('renders features from tier', () => {
    const billingTier = createMockBillingTier('tier1', 1)

    render(
      <PricingCard
        billingTier={billingTier}
        selectedInterval="month"
        selectedCurrency="usd"
        onSubscribe={mockOnSubscribe}
      />
    )

    // Features from mock tier
    expect(screen.getByText(/Api Access/i)).toBeInTheDocument()
    expect(screen.getByText(/Priority Support/i)).toBeInTheDocument()
  })

  it('shows "Price not available" when no matching price', () => {
    const billingTier = createMockBillingTier('tier1', 1)
    // Remove all prices
    billingTier.prices = []

    render(
      <PricingCard
        billingTier={billingTier}
        selectedInterval="month"
        selectedCurrency="usd"
        onSubscribe={mockOnSubscribe}
      />
    )

    expect(screen.getByText('Price not available')).toBeInTheDocument()
  })

  it('shows tax note for exclusive tax behavior', () => {
    const billingTier = createMockBillingTier('tier1', 1)

    render(
      <PricingCard
        billingTier={billingTier}
        selectedInterval="month"
        selectedCurrency="usd"
        onSubscribe={mockOnSubscribe}
      />
    )

    expect(screen.getByText(/applicable taxes/i)).toBeInTheDocument()
  })
})
