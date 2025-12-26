'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { billingApi, ApiError } from '@/lib/api'
import { PricingCard } from '@/components/billing/pricing-card'
import { SubscriptionStatus } from '@/components/billing/subscription-status'
import { BalanceCard } from '@/components/billing/balance-card'
import { CouponRedemption } from '@/components/billing/coupon-redemption'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { BillingTierDTO, BillingSubscriptionDTO, ValidateDiscountCodeResponse } from '@saas/shared'
import { Loader2, Tag, X, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100)
}

export default function BillingPage(): React.ReactElement {
  const { user, isLoading: authLoading } = useAuth()
  const [tiers, setTiers] = useState<BillingTierDTO[]>([])
  const [subscription, setSubscription] = useState<BillingSubscriptionDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedInterval, setSelectedInterval] = useState<'month' | 'year'>('month')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('usd')
  const [balanceKey, setBalanceKey] = useState(0)

  // Discount code state
  const [discountCode, setDiscountCode] = useState('')
  const [discountValidation, setDiscountValidation] = useState<ValidateDiscountCodeResponse | null>(null)
  const [validatingDiscount, setValidatingDiscount] = useState(false)
  const [selectedPriceId, setSelectedPriceId] = useState<number | null>(null)

  const loadData = useCallback(async (): Promise<void> => {
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
  }, [user])

  useEffect(() => {
    if (!authLoading) {
      loadData()
    }
  }, [authLoading, loadData])

  const handleValidateDiscountCode = async (priceId: number): Promise<void> => {
    if (!discountCode.trim()) {
      setDiscountValidation(null)
      return
    }

    try {
      setValidatingDiscount(true)
      setSelectedPriceId(priceId)
      const result = await billingApi.validateDiscountCode(discountCode.trim().toUpperCase(), priceId)
      setDiscountValidation(result)
      if (!result.valid) {
        toast.error(result.message ?? 'Invalid discount code')
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message)
        setDiscountValidation(null)
      }
    } finally {
      setValidatingDiscount(false)
    }
  }

  const clearDiscountCode = (): void => {
    setDiscountCode('')
    setDiscountValidation(null)
    setSelectedPriceId(null)
  }

  const handleSubscribe = async (priceId: string): Promise<void> => {
    setCheckoutLoading(true)
    setError(null)
    try {
      const payload: {
        priceId: string
        successUrl: string
        cancelUrl: string
        discountCode?: string
      } = {
        priceId,
        successUrl: `${window.location.origin}/billing/success`,
        cancelUrl: `${window.location.origin}/billing`,
      }

      // Include discount code if validated
      if (discountValidation?.valid && discountCode.trim()) {
        payload.discountCode = discountCode.trim().toUpperCase()
      }

      const { url } = await billingApi.createCheckout(payload)
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checkout session')
      setCheckoutLoading(false)
    }
  }

  const handleBalanceRefresh = (): void => {
    setBalanceKey((prev) => prev + 1)
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

      {user && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <BalanceCard key={balanceKey} />
          <CouponRedemption onRedeemed={handleBalanceRefresh} />
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

        {/* Discount Code Input */}
        {user && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Discount Code
              </CardTitle>
              <CardDescription>
                Enter a discount code to apply to your subscription
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Enter discount code"
                    value={discountCode}
                    onChange={(e) => {
                      setDiscountCode(e.target.value.toUpperCase())
                      if (discountValidation) {
                        setDiscountValidation(null)
                      }
                    }}
                    disabled={validatingDiscount}
                    className="font-mono uppercase pr-8"
                  />
                  {discountCode && (
                    <button
                      onClick={clearDiscountCode}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {discountValidation?.valid && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Discount Applied!</span>
                  </div>
                  <div className="mt-1 text-sm text-green-600">
                    <p>Original: {formatAmount(discountValidation.originalAmount, selectedCurrency)}</p>
                    <p>Discount: -{formatAmount(discountValidation.discountApplied, selectedCurrency)}</p>
                    <p className="font-semibold">
                      New Price: {formatAmount(discountValidation.discountedAmount, selectedCurrency)}
                    </p>
                  </div>
                </div>
              )}

              {discountCode && !discountValidation && !validatingDiscount && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Click on a plan to validate the discount code
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tiers
          .sort((a, b) => a.tier.level - b.tier.level)
          .map((billingTier) => {
            const matchingPrice = billingTier.prices.find(
              (p) => p.interval === selectedInterval && p.currency === selectedCurrency && p.isActive
            )
            const priceId = matchingPrice?.id

            return (
              <PricingCard
                key={billingTier.tier.id}
                billingTier={billingTier}
                currentTierSlug={subscription?.subscription?.tier?.slug}
                selectedInterval={selectedInterval}
                selectedCurrency={selectedCurrency}
                onSubscribe={(id) => {
                  // Validate discount code before subscribing if one is entered
                  if (discountCode.trim() && priceId && (!discountValidation || selectedPriceId !== priceId)) {
                    handleValidateDiscountCode(priceId).then(() => {
                      // After validation, let user click again to proceed
                    })
                  } else {
                    handleSubscribe(id)
                  }
                }}
                isLoading={checkoutLoading || (validatingDiscount && selectedPriceId === priceId)}
                discountValidation={
                  discountValidation?.valid && selectedPriceId === priceId
                    ? discountValidation
                    : undefined
                }
              />
            )
          })}
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
