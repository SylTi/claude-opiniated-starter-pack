'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState<{ amount: string; newBalance: string } | null>(null)

  const handleRedeem = async (): Promise<void> => {
    if (!code.trim()) {
      toast.error('Please enter a coupon code')
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
      toast.success(result.message ?? 'Coupon redeemed successfully!')

      if (onRedeemed) {
        onRedeemed()
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message)
      } else {
        toast.error('Failed to redeem coupon')
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
          Redeem Coupon
        </CardTitle>
        <CardDescription>
          Enter a coupon code to add credit to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-green-800">Coupon Redeemed!</p>
              <p className="text-sm text-green-700">
                {success.amount} has been added to your account.
              </p>
              <p className="text-sm text-green-700">
                New balance: {success.newBalance}
              </p>
              <Button
                variant="link"
                className="p-0 h-auto text-green-700"
                onClick={() => setSuccess(null)}
              >
                Redeem another coupon
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="Enter coupon code"
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
                  Redeeming...
                </>
              ) : (
                'Redeem'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
