'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'

function OAuthCallbackContent(): React.ReactElement {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser } = useAuth()

  const success = searchParams.get('success')
  const error = searchParams.get('error')
  const isNewUser = searchParams.get('isNewUser') === 'true'

  useEffect(() => {
    if (success === 'true') {
      // Refresh user data and redirect
      refreshUser().then(() => {
        router.push(isNewUser ? '/profile' : '/dashboard')
      })
    }
  }, [success, isNewUser, router, refreshUser])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Authentication Failed</h2>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => router.push('/login')}>Back to Login</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  )
}

export default function OAuthCallbackPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  )
}
