'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { billingApi } from '@/lib/api'
import { PricingCard } from '@/components/billing/pricing-card'
import { SubscriptionStatus } from '@/components/billing/subscription-status'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { BillingTierDTO, BillingSubscriptionDTO } from '@saas/shared'

export default function BillingPage(): React.ReactElement {
  const { user, isLoading: authLoading } = useAuth()
  const [tiers, setTiers] = useState<BillingTierDTO[]>([])
  const [subscription, setSubscription] = useState<BillingSubscriptionDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedInterval, setSelectedInterval] = useState<'month' | 'year'>('month')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('usd')

  const loadData = async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      const tiersData = await billingApi.getTiers()
      setTiers(tiersData)

      if (user) {
        const subData = await billingApi.getSubscription()
        setSubscription(subData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) {
      loadData()
    }
  }, [authLoading, user])

  const handleSubscribe = async (priceId: string): Promise<void> => {
    setCheckoutLoading(true)
    setError(null)
    try {
      const { url } = await billingApi.createCheckout({
        priceId,
        successUrl: `${window.location.origin}/billing/success`,
        cancelUrl: `${window.location.origin}/billing`,
      })
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checkout session')
      setCheckoutLoading(false)
    }
  }

  // Get available currencies from prices
  const availableCurrencies = Array.from(
    new Set(
      tiers.flatMap((t) => t.prices.map((p) => p.currency))
    )
  )

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing settings
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded">
          {error}
        </div>
      )}

      {user && subscription && (
        <div className="mb-8">
          <SubscriptionStatus subscription={subscription} onUpdate={loadData} />
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-4">Available Plans</h2>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Tabs
            value={selectedInterval}
            onValueChange={(v) => setSelectedInterval(v as 'month' | 'year')}
          >
            <TabsList>
              <TabsTrigger value="month">Monthly</TabsTrigger>
              <TabsTrigger value="year">
                Yearly
                <span className="ml-1 text-xs text-green-600">(Save 20%)</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {availableCurrencies.length > 1 && (
            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableCurrencies.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tiers
          .sort((a, b) => a.tier.level - b.tier.level)
          .map((billingTier) => (
            <PricingCard
              key={billingTier.tier.id}
              billingTier={billingTier}
              currentTierSlug={subscription?.subscription?.tier?.slug}
              selectedInterval={selectedInterval}
              selectedCurrency={selectedCurrency}
              onSubscribe={handleSubscribe}
              isLoading={checkoutLoading}
            />
          ))}
      </div>

      {!user && (
        <div className="mt-8 p-4 bg-muted rounded text-center">
          <p className="text-muted-foreground">
            Please <a href="/auth/login" className="text-primary underline">sign in</a> to manage your subscription.
          </p>
        </div>
      )}
    </div>
  )
}
