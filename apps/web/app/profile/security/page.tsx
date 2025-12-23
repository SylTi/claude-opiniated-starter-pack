'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import  Image from 'next/image'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Shield, ShieldCheck, ShieldX, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { mfaApi, authApi } from '@/lib/auth'
import { ApiError } from '@/lib/api'
import { mfaCodeSchema, changePasswordSchema, type MfaCodeFormData, type ChangePasswordFormData } from '@/lib/validations'
import type { MfaSetupDTO, MfaStatusDTO } from '@saas/shared'

export default function SecurityPage(): React.ReactElement {
  const { user, refreshUser } = useAuth()
  const [mfaStatus, setMfaStatus] = useState<MfaStatusDTO | null>(null)
  const [setupData, setSetupData] = useState<MfaSetupDTO | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [showDisable, setShowDisable] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const {
    register: registerMfa,
    handleSubmit: handleSubmitMfa,
    reset: resetMfa,
    formState: { errors: mfaErrors, isSubmitting: isSubmittingMfa },
  } = useForm<MfaCodeFormData>({
    resolver: zodResolver(mfaCodeSchema),
    mode: 'onBlur',
  })

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors, isSubmitting: isSubmittingPassword },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onBlur',
  })

  useEffect(() => {
    const loadMfaStatus = async (): Promise<void> => {
      try {
        const status = await mfaApi.status()
        setMfaStatus(status)
      } catch {
        // Ignore errors, user might not have MFA set up
      }
    }
    loadMfaStatus()
  }, [])

  const handleStartSetup = async (): Promise<void> => {
    try {
      setError(null)
      const data = await mfaApi.setup()
      setSetupData(data)
      setShowSetup(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to start MFA setup')
      }
    }
  }

  const handleEnableMfa = async (data: MfaCodeFormData): Promise<void> => {
    if (!setupData) return

    try {
      setError(null)
      await mfaApi.enable({
        code: data.code,
        secret: setupData.secret,
        backupCodes: setupData.backupCodes,
      })
      await refreshUser()
      setMfaStatus({ mfaEnabled: true, backupCodesRemaining: setupData.backupCodes.length })
      setShowSetup(false)
      setSetupData(null)
      resetMfa()
      toast.success('Two-factor authentication enabled')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to enable MFA')
      }
    }
  }

  const handleDisableMfa = async (data: MfaCodeFormData): Promise<void> => {
    try {
      setError(null)
      await mfaApi.disable(data.code)
      await refreshUser()
      setMfaStatus({ mfaEnabled: false, backupCodesRemaining: 0 })
      setShowDisable(false)
      resetMfa()
      toast.success('Two-factor authentication disabled')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to disable MFA')
      }
    }
  }

  const handleChangePassword = async (data: ChangePasswordFormData): Promise<void> => {
    try {
      setPasswordError(null)
      await authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        newPasswordConfirmation: data.newPasswordConfirmation,
      })
      resetPassword()
      toast.success('Password changed successfully')
    } catch (err) {
      if (err instanceof ApiError) {
        setPasswordError(err.message)
      } else {
        setPasswordError('Failed to change password')
      }
    }
  }

  const copyBackupCodes = (): void => {
    if (setupData) {
      navigator.clipboard.writeText(setupData.backupCodes.join('\n'))
      setCopiedCodes(true)
      setTimeout(() => setCopiedCodes(false), 2000)
      toast.success('Backup codes copied to clipboard')
    }
  }

  if (!user) {
    return <></>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Security</h1>
      <p className="text-gray-600 mt-1">Manage your security settings</p>

      <Separator className="my-6" />

      {/* Two-Factor Authentication */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {mfaStatus?.mfaEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <ShieldCheck className="h-5 w-5" />
                <span>Two-factor authentication is enabled</span>
              </div>
              <p className="text-sm text-gray-600">
                Backup codes remaining: {mfaStatus.backupCodesRemaining}
              </p>

              {showDisable ? (
                <form onSubmit={handleSubmitMfa(handleDisableMfa)} className="space-y-4 max-w-sm">
                  <div>
                    <Label htmlFor="disableCode">Enter your 2FA code to disable</Label>
                    <Input
                      id="disableCode"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      {...registerMfa('code')}
                      className="mt-1"
                    />
                    {mfaErrors.code && (
                      <p className="mt-1 text-sm text-red-600">{mfaErrors.code.message}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" variant="destructive" disabled={isSubmittingMfa}>
                      {isSubmittingMfa ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disable'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowDisable(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <Button variant="outline" onClick={() => setShowDisable(true)}>
                  <ShieldX className="mr-2 h-4 w-4" />
                  Disable 2FA
                </Button>
              )}
            </div>
          ) : showSetup && setupData ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">1. Scan QR Code</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                <div className="bg-white p-4 rounded-lg border inline-block">
                  <Image src={setupData.qrCode} alt="MFA QR Code" className="w-48 h-48" />
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">2. Save Backup Codes</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                    {setupData.backupCodes.map((code: string, i: number) => (
                      <div key={i}>{code}</div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyBackupCodes}
                    className="mt-4"
                  >
                    {copiedCodes ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy codes
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <form onSubmit={handleSubmitMfa(handleEnableMfa)} className="space-y-4 max-w-sm">
                <div>
                  <Label htmlFor="enableCode">3. Enter verification code</Label>
                  <Input
                    id="enableCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    {...registerMfa('code')}
                    className="mt-1"
                  />
                  {mfaErrors.code && (
                    <p className="mt-1 text-sm text-red-600">{mfaErrors.code.message}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmittingMfa}>
                    {isSubmittingMfa ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enable 2FA'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowSetup(false)
                      setSetupData(null)
                      resetMfa()
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <ShieldX className="h-5 w-5" />
                <span>Two-factor authentication is not enabled</span>
              </div>
              <Button onClick={handleStartSetup}>
                <Shield className="mr-2 h-4 w-4" />
                Set up 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          {passwordError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{passwordError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmitPassword(handleChangePassword)} className="space-y-4 max-w-sm">
            <div>
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                {...registerPassword('currentPassword')}
                className="mt-1"
              />
              {passwordErrors.currentPassword && (
                <p className="mt-1 text-sm text-red-600">{passwordErrors.currentPassword.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                {...registerPassword('newPassword')}
                className="mt-1"
              />
              {passwordErrors.newPassword && (
                <p className="mt-1 text-sm text-red-600">{passwordErrors.newPassword.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="newPasswordConfirmation">Confirm new password</Label>
              <Input
                id="newPasswordConfirmation"
                type="password"
                {...registerPassword('newPasswordConfirmation')}
                className="mt-1"
              />
              {passwordErrors.newPasswordConfirmation && (
                <p className="mt-1 text-sm text-red-600">{passwordErrors.newPasswordConfirmation.message}</p>
              )}
            </div>

            <Button type="submit" disabled={isSubmittingPassword}>
              {isSubmittingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                'Change password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
