'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@saas/ui/card'
import { Input } from '@saas/ui/input'
import { Button } from '@saas/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { billingApi, ApiError } from '@/lib/api'
import { Loader2, Gift, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface CouponRedemptionProps {
  teamId?: number
  onRedeemed?: () => void
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100)
}

export function CouponRedemption({ teamId, onRedeemed }: CouponRedemptionProps): React.ReactElement {
  const { t } = useI18n('skeleton')
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState<{ amount: string; newBalance: string } | null>(null)

  const handleRedeem = async (): Promise<void> => {
    if (!code.trim()) {
      toast.error(t('billing.enterCouponCodeError'))
      return
    }

    try {
      setIsLoading(true)
      setSuccess(null)
      const result = await billingApi.redeemCoupon(code.trim().toUpperCase(), teamId)

      setSuccess({
        amount: formatAmount(result.creditAmount, result.currency),
        newBalance: formatAmount(result.newBalance, result.currency),
      })
      setCode('')
      toast.success(result.message ?? t('billing.couponRedeemedSuccess'))

      if (onRedeemed) {
        onRedeemed()
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message)
      } else {
        toast.error(t('billing.redeemCouponError'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleRedeem()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          {t('billing.redeemCoupon')}
        </CardTitle>
        <CardDescription>
          {t('billing.redeemCouponDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-green-800">{t('billing.couponRedeemed')}</p>
              <p className="text-sm text-green-700">
                {t('billing.amountAdded', { amount: success.amount })}
              </p>
              <p className="text-sm text-green-700">
                {t('billing.newBalance', { balance: success.newBalance })}
              </p>
              <Button
                variant="link"
                className="p-0 h-auto text-green-700"
                onClick={() => setSuccess(null)}
              >
                {t('billing.redeemAnotherCoupon')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder={t('billing.enterCouponCode')}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="font-mono uppercase"
            />
            <Button onClick={handleRedeem} disabled={isLoading || !code.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('billing.redeeming')}
                </>
              ) : (
                t('billing.redeem')
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
