'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'

/**
 * Get safe callback URL from search params.
 * Only allows relative paths to prevent open redirect.
 * Blocks auth routes to prevent redirect loops.
 */
function getSafeCallbackUrl(callbackUrl: string | null, isNewUser: boolean): string {
  const defaultUrl = isNewUser ? '/profile' : '/dashboard'

  if (!callbackUrl) {
    return defaultUrl
  }

  // Must be a relative path starting with /
  if (!callbackUrl.startsWith('/')) {
    return defaultUrl
  }

  // Reject protocol-relative URLs (//evil.com)
  if (callbackUrl.startsWith('//')) {
    return defaultUrl
  }

  // Reject backslash (path traversal)
  if (callbackUrl.includes('\\')) {
    return defaultUrl
  }

  // Reject auth routes to prevent redirect loops
  // These routes would just redirect back here or to login
  if (
    callbackUrl === '/login' ||
    callbackUrl.startsWith('/login/') ||
    callbackUrl.startsWith('/auth/')
  ) {
    return defaultUrl
  }

  return callbackUrl
}

function OAuthCallbackContent(): React.ReactElement {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser } = useAuth()
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const success = searchParams.get('success')
  const error = searchParams.get('error')
  const isNewUser = searchParams.get('isNewUser') === 'true'
  const callbackUrl = searchParams.get('callbackUrl')

  // Determine redirect URL - use callbackUrl if provided, otherwise default
  const redirectUrl = getSafeCallbackUrl(callbackUrl, isNewUser)

  useEffect(() => {
    if (success === 'true') {
      // Refresh user data and redirect to callback URL
      refreshUser()
        .then(() => {
          router.push(redirectUrl)
        })
        .catch((err) => {
          console.error('[OAuthCallback] Failed to refresh user:', err)
          setRefreshError('Failed to complete authentication. Please try again.')
        })
    }
  }, [success, redirectUrl, router, refreshUser])

  // Show error from URL params, refresh failure, or invalid callback status
  const invalidCallback = success !== 'true' && !error
  const displayError =
    error ||
    refreshError ||
    (invalidCallback ? 'Invalid authentication callback. Please sign in again.' : null)
  if (displayError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Authentication Failed</h2>
          <Alert variant="destructive">
            <AlertDescription>{displayError}</AlertDescription>
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
