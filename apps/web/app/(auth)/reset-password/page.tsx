'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { authApi } from '@/lib/auth'
import { ApiError } from '@/lib/api'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations'

function ResetPasswordForm(): React.ReactElement {
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
      setError('Invalid reset link')
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
        setError('An unexpected error occurred')
      }
    }
  }

  if (!token) {
    return (
      <>
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Invalid link</h2>
          <p className="mt-4 text-gray-600">
            This password reset link is invalid or has expired.
          </p>
          <Link href="/forgot-password">
            <Button className="mt-6">Request new link</Button>
          </Link>
        </div>
      </>
    )
  }

  if (success) {
    return (
      <>
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Password reset successful
          </h2>
          <p className="mt-4 text-gray-600">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
          <Button className="mt-6" onClick={() => router.push('/login')}>
            Go to Login
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Reset your password</h2>
        <p className="mt-2 text-sm text-gray-600">
          Enter your new password below.
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
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              className="mt-1"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="passwordConfirmation">Confirm new password</Label>
            <Input
              id="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              {...register('passwordConfirmation')}
              className="mt-1"
            />
            {errors.passwordConfirmation && (
              <p className="mt-1 text-sm text-red-600">{errors.passwordConfirmation.message}</p>
            )}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Resetting...
            </>
          ) : (
            'Reset password'
          )}
        </Button>

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            <ArrowLeft className="inline-block mr-1 h-4 w-4" />
            Back to login
          </Link>
        </div>
      </form>
    </>
  )
}

export default function ResetPasswordPage(): React.ReactElement {
  return (
    <Suspense fallback={<div className="text-center">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
