'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { billingApi, ApiError } from '@/lib/api'
import type { BalanceDTO } from '@saas/shared'
import { Loader2, Wallet } from 'lucide-react'

interface BalanceCardProps {
  teamId?: number
}

function formatBalance(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100)
}

export function BalanceCard({ teamId }: BalanceCardProps): React.ReactElement {
  const [balance, setBalance] = useState<BalanceDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = async (): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await billingApi.getBalance(teamId)
      setBalance(data)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to load balance')
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBalance()
  }, [teamId])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Account Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Account Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Account Balance
        </CardTitle>
        <CardDescription>
          Your available credit balance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-primary">
          {balance ? formatBalance(balance.balance, balance.currency) : '$0.00'}
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          This balance will be applied to your next invoice.
        </p>
      </CardContent>
    </Card>
  )
}
