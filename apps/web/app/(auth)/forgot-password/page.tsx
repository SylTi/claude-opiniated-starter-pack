'use client'

import { useState } from 'react'
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
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/lib/validations'

export default function ForgotPasswordPage(): React.ReactElement {
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
        setError('An unexpected error occurred')
      }
    }
  }

  if (success) {
    return (
      <>
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Check your email</h2>
          <p className="mt-4 text-gray-600">
            If an account exists with this email, you will receive a password reset link.
          </p>
          <Link href="/login">
            <Button className="mt-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Button>
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Forgot password?</h2>
        <p className="mt-2 text-sm text-gray-600">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className="mt-1"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            'Send reset link'
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
