'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { BillingSubscriptionDTO } from '@saas/shared'
import { billingApi } from '@/lib/api'
import { CreditCard, ExternalLink } from 'lucide-react'

interface SubscriptionStatusProps {
  subscription: BillingSubscriptionDTO
  onUpdate?: () => void
}

export function SubscriptionStatus({
  subscription,
  onUpdate,
}: SubscriptionStatusProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { subscription: sub, canManage, hasPaymentMethod } = subscription
  const tier = sub?.tier

  const handleManageBilling = async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      const { url } = await billingApi.createPortal(window.location.href)
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal')
      setIsLoading(false)
    }
  }

  const handleCancelSubscription = async (): Promise<void> => {
    setIsCancelling(true)
    setError(null)
    try {
      await billingApi.cancelSubscription()
      onUpdate?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setIsCancelling(false)
    }
  }

  const getStatusBadge = (): React.ReactElement | null => {
    if (!sub) return null

    const statusColors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      trialing: 'bg-blue-100 text-blue-800',
      past_due: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
    }

    return (
      <span className={`px-2 py-1 rounded text-sm font-medium ${statusColors[sub.status] || 'bg-gray-100 text-gray-800'}`}>
        {sub.status.charAt(0).toUpperCase() + sub.status.slice(1).replace('_', ' ')}
      </span>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Subscription
          {getStatusBadge()}
        </CardTitle>
        <CardDescription>
          {tier ? `You are currently on the ${tier.name} plan` : 'No active subscription'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tier && (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">{tier.name}</h4>
              {tier.description && (
                <p className="text-sm text-muted-foreground">{tier.description}</p>
              )}
            </div>

            {sub?.expiresAt && (
              <div className="text-sm">
                <span className="text-muted-foreground">
                  {sub.status === 'cancelled' ? 'Access until: ' : 'Renews on: '}
                </span>
                {new Date(sub.expiresAt).toLocaleDateString()}
              </div>
            )}

            {sub?.providerName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                Managed via {sub.providerName.charAt(0).toUpperCase() + sub.providerName.slice(1)}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded text-sm">
            {error}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        {hasPaymentMethod && canManage && (
          <Button
            variant="outline"
            onClick={handleManageBilling}
            disabled={isLoading}
          >
            {isLoading ? (
              'Loading...'
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage Billing
              </>
            )}
          </Button>
        )}

        {sub?.providerSubscriptionId && sub.status === 'active' && canManage && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isCancelling}>
                {isCancelling ? 'Cancelling...' : 'Cancel Subscription'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your subscription will remain active until the end of the current billing period.
                  After that, you will be downgraded to the free plan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancelSubscription}>
                  Yes, Cancel
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardFooter>
    </Card>
  )
}
