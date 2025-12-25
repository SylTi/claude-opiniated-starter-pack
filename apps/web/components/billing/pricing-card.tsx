'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { BillingTierDTO, PriceDTO } from '@saas/shared'
import { Check } from 'lucide-react'

interface PricingCardProps {
  billingTier: BillingTierDTO
  currentTierSlug?: string
  selectedInterval: 'month' | 'year'
  selectedCurrency: string
  onSubscribe: (priceId: string) => void
  isLoading?: boolean
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount / 100)
}

export function PricingCard({
  billingTier,
  currentTierSlug,
  selectedInterval,
  selectedCurrency,
  onSubscribe,
  isLoading,
}: PricingCardProps): React.ReactElement {
  const { tier, prices } = billingTier
  const isCurrentTier = tier.slug === currentTierSlug
  const isFree = tier.slug === 'free'

  // Find the matching price
  const matchingPrice = prices.find(
    (p: PriceDTO) => p.interval === selectedInterval && p.currency === selectedCurrency && p.isActive
  )

  // Parse features from tier
  const features: string[] = []
  if (tier.features) {
    const featuresObj = tier.features as Record<string, unknown>
    Object.entries(featuresObj).forEach(([key, value]) => {
      if (typeof value === 'boolean' && value) {
        features.push(key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()))
      } else if (typeof value === 'number') {
        features.push(`${value} ${key.replace(/_/g, ' ')}`)
      } else if (typeof value === 'string') {
        features.push(value)
      }
    })
  }

  const handleSubscribe = (): void => {
    if (matchingPrice) {
      // The priceId passed to checkout should be the provider price ID
      // We need to look this up - for now we use the local price ID
      onSubscribe(matchingPrice.id.toString())
    }
  }

  return (
    <Card className={`flex flex-col ${isCurrentTier ? 'border-primary ring-2 ring-primary' : ''}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {tier.name}
          {isCurrentTier && (
            <span className="text-sm font-normal text-primary bg-primary/10 px-2 py-1 rounded">
              Current Plan
            </span>
          )}
        </CardTitle>
        <CardDescription>{tier.description || `${tier.name} tier features`}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="mb-6">
          {isFree ? (
            <div className="text-3xl font-bold">Free</div>
          ) : matchingPrice ? (
            <div>
              <span className="text-3xl font-bold">{formatPrice(matchingPrice.unitAmount, matchingPrice.currency)}</span>
              <span className="text-muted-foreground">/{selectedInterval}</span>
              {matchingPrice.taxBehavior === 'exclusive' && (
                <span className="text-sm text-muted-foreground block">+ applicable taxes</span>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground">Price not available</div>
          )}
        </div>

        {tier.maxTeamMembers !== undefined && tier.maxTeamMembers > 0 && (
          <p className="text-sm text-muted-foreground mb-4">
            Up to {tier.maxTeamMembers} team members
          </p>
        )}

        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        {isFree ? (
          <Button variant="outline" className="w-full" disabled>
            {isCurrentTier ? 'Current Plan' : 'Free Forever'}
          </Button>
        ) : isCurrentTier ? (
          <Button variant="outline" className="w-full" disabled>
            Current Plan
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={handleSubscribe}
            disabled={isLoading || !matchingPrice}
          >
            {isLoading ? 'Loading...' : `Upgrade to ${tier.name}`}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
