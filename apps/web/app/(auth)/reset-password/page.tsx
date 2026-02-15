'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@saas/ui/button'
import { Input } from '@saas/ui/input'
import { Label } from '@saas/ui/label'
import { Alert, AlertDescription } from '@saas/ui/alert'
import { useI18n } from '@/contexts/i18n-context'
import { authApi } from '@/lib/auth'
import { ApiError } from '@/lib/api'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations'

function ResetPasswordForm(): React.ReactElement {
  const { t } = useI18n('skeleton')
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onBlur',
  })

  const onSubmit = async (data: ResetPasswordFormData): Promise<void> => {
    if (!token) {
      setError(t('auth.reset.invalidLink'))
      return
    }

    try {
      setError(null)
      await authApi.resetPassword({
        token,
        password: data.password,
        passwordConfirmation: data.passwordConfirmation,
      })
      setSuccess(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError(t('common.unexpectedError'))
      }
    }
  }

  if (!token) {
    return (
      <>
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{t('auth.reset.invalidLinkTitle')}</h2>
          <p className="mt-4 text-muted-foreground">
            {t('auth.reset.invalidLinkMessage')}
          </p>
          <Link href="/forgot-password">
            <Button className="mt-6">{t('auth.reset.requestNewLink')}</Button>
          </Link>
        </div>
      </>
    )
  }

  if (success) {
    return (
      <>
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {t('auth.reset.successTitle')}
          </h2>
          <p className="mt-4 text-muted-foreground">
            {t('auth.reset.successMessage')}
          </p>
          <Button className="mt-6" onClick={() => router.push('/login')}>
            {t('common.goToLogin')}
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{t('auth.reset.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('auth.reset.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="password">{t('auth.reset.newPassword')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              className="mt-1"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="passwordConfirmation">{t('auth.reset.confirmNewPassword')}</Label>
            <Input
              id="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              {...register('passwordConfirmation')}
              className="mt-1"
            />
            {errors.passwordConfirmation && (
              <p className="mt-1 text-sm text-destructive">{errors.passwordConfirmation.message}</p>
            )}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('auth.reset.resetting')}
            </>
          ) : (
            t('auth.reset.resetButton')
          )}
        </Button>

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            <ArrowLeft className="inline-block mr-1 h-4 w-4" />
            {t('common.backToLoginLower')}
          </Link>
        </div>
      </form>
    </>
  )
}

export default function ResetPasswordPage(): React.ReactElement {
  const { t } = useI18n('skeleton')

  return (
    <Suspense fallback={<div className="text-center">{t('common.loading')}</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
