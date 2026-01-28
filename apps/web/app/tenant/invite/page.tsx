'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle, XCircle, Users, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { invitationsApi, setTenantId } from '@/lib/api'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import type { InvitationDetailsDTO } from '@saas/shared'

type InviteState = 'loading' | 'loaded' | 'accepting' | 'accepted' | 'declined' | 'error' | 'no-token' | 'login-required'

function InviteContent(): React.ReactElement {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [state, setState] = useState<InviteState>(() => (token ? 'loading' : 'no-token'))
  const [invitation, setInvitation] = useState<InvitationDetailsDTO | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      return
    }

    // Wait for auth to load
    if (authLoading) {
      return
    }

    const fetchInvitation = async (): Promise<void> => {
      try {
        const data = await invitationsApi.getByToken(token)
        setInvitation(data)

        // Check if user needs to login
        if (!isAuthenticated) {
          setState('login-required')
          return
        }

        setState('loaded')
      } catch (err) {
        setState('error')
        if (err instanceof ApiError) {
          if (err.statusCode === 404) {
            setError('This invitation link is invalid or has expired.')
          } else {
            setError(err.message)
          }
        } else {
          setError('An unexpected error occurred.')
        }
      }
    }

    fetchInvitation()
  }, [token, isAuthenticated, authLoading])

  const handleAccept = async (): Promise<void> => {
    if (!token) return

    setState('accepting')
    try {
      const result = await invitationsApi.accept(token)
      // Switch to the new tenant
      setTenantId(result.tenantId)
      setState('accepted')
    } catch (err) {
      setState('error')
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to accept invitation.')
      }
    }
  }

  const handleDecline = async (): Promise<void> => {
    if (!token) return

    try {
      await invitationsApi.decline(token)
      setState('declined')
    } catch (err) {
      setState('error')
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to decline invitation.')
      }
    }
  }

  if (state === 'loading' || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading invitation...</p>
        </div>
      </div>
    )
  }

  if (state === 'no-token') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <CardTitle className="mt-4">Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid. Please check your email for the correct link.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <CardTitle className="mt-4">Invitation Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === 'login-required' && invitation) {
    const loginUrl = `/login?returnTo=${encodeURIComponent(`/tenant/invite?token=${token}`)}`
    const registerUrl = `/register?returnTo=${encodeURIComponent(`/tenant/invite?token=${token}`)}`

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Users className="mx-auto h-12 w-12 text-blue-600" />
            <CardTitle className="mt-4">Workspace Invitation</CardTitle>
            <CardDescription>
              You&apos;ve been invited to join <strong>{invitation.tenant.name}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <p className="text-sm text-gray-600">Invited by</p>
              <p className="font-medium">{invitation.invitedBy.fullName || invitation.invitedBy.email}</p>
              <p className="mt-2 text-sm text-gray-600">Role</p>
              <p className="font-medium capitalize">{invitation.role}</p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please sign in or create an account to accept this invitation.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Link href={loginUrl} className="block">
                <Button className="w-full">Sign In</Button>
              </Link>
              <Link href={registerUrl} className="block">
                <Button variant="outline" className="w-full">Create Account</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === 'accepted') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <CardTitle className="mt-4">Welcome to the team!</CardTitle>
            <CardDescription>
              You&apos;ve successfully joined <strong>{invitation?.tenant.name}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === 'declined') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-gray-400" />
            <CardTitle className="mt-4">Invitation Declined</CardTitle>
            <CardDescription>
              You&apos;ve declined the invitation to join {invitation?.tenant.name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/dashboard">
              <Button variant="outline">Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // state === 'loaded' || state === 'accepting'
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Users className="mx-auto h-12 w-12 text-blue-600" />
          <CardTitle className="mt-4">Workspace Invitation</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join <strong>{invitation?.tenant.name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-600">Invited by</p>
            <p className="font-medium">{invitation?.invitedBy.fullName || invitation?.invitedBy.email}</p>
            <p className="mt-2 text-sm text-gray-600">Role</p>
            <p className="font-medium capitalize">{invitation?.role}</p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDecline}
              disabled={state === 'accepting'}
            >
              Decline
            </Button>
            <Button
              className="flex-1"
              onClick={handleAccept}
              disabled={state === 'accepting'}
            >
              {state === 'accepting' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                'Accept Invitation'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function TenantInvitePage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  )
}
