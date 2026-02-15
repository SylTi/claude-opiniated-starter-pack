'use client'

import { useState } from 'react'
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
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/lib/validations'

export default function ForgotPasswordPage(): React.ReactElement {
  const { t } = useI18n('skeleton')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onBlur',
  })

  const onSubmit = async (data: ForgotPasswordFormData): Promise<void> => {
    try {
      setError(null)
      await authApi.forgotPassword(data.email)
      setSuccess(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError(t('common.unexpectedError'))
      }
    }
  }

  if (success) {
    return (
      <>
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{t('auth.forgot.checkEmailTitle')}</h2>
          <p className="mt-4 text-muted-foreground">
            {t('auth.forgot.checkEmailMessage')}
          </p>
          <Link href="/login">
            <Button className="mt-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('common.backToLogin')}
            </Button>
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{t('auth.forgot.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('auth.forgot.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div>
          <Label htmlFor="email">{t('auth.login.emailLabel')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className="mt-1"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('auth.forgot.sending')}
            </>
          ) : (
            t('auth.forgot.sendResetLink')
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
