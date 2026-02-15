'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@saas/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { authApi } from '@/lib/auth'
import { ApiError } from '@/lib/api'

type VerificationState = 'loading' | 'success' | 'error' | 'no-token'

function VerifyEmailContent(): React.ReactElement {
  const { t } = useI18n('skeleton')
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [state, setState] = useState<VerificationState>(() => (token ? 'loading' : 'no-token'))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      return
    }

    const verifyEmail = async (): Promise<void> => {
      try {
        await authApi.verifyEmail(token)
        setState('success')
      } catch (err) {
        setState('error')
        if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError(t('common.unexpectedError'))
        }
      }
    }

    verifyEmail()
  }, [token, t])

  if (state === 'loading') {
    return (
      <div className="text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
          {t('auth.verify.verifyingTitle')}
        </h2>
        <p className="mt-2 text-muted-foreground">{t('auth.verify.verifyingMessage')}</p>
      </div>
    )
  }

  if (state === 'no-token') {
    return (
      <div className="text-center">
        <XCircle className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground">{t('auth.verify.invalidLinkTitle')}</h2>
        <p className="mt-2 text-muted-foreground">
          {t('auth.verify.invalidLinkMessage')}
        </p>
        <Link href="/login">
          <Button className="mt-6">{t('common.goToLogin')}</Button>
        </Link>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="text-center">
        <XCircle className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
          {t('auth.verify.failedTitle')}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {error || t('auth.verify.failedFallback')}
        </p>
        <div className="mt-6 space-x-4">
          <Link href="/login">
            <Button variant="outline">{t('common.goToLogin')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center">
      <CheckCircle className="mx-auto h-12 w-12 text-primary" />
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground">{t('auth.verify.successTitle')}</h2>
      <p className="mt-2 text-muted-foreground">
        {t('auth.verify.successMessage')}
      </p>
      <Link href="/login">
        <Button className="mt-6">{t('auth.verify.continueToLogin')}</Button>
      </Link>
    </div>
  )
}

export default function VerifyEmailPage(): React.ReactElement {
  const { t } = useI18n('skeleton')

  return (
    <Suspense
      fallback={
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">{t('auth.verify.loading')}</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
