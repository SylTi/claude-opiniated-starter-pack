'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import  Image from 'next/image'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Shield, ShieldCheck, ShieldX, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@saas/ui/button'
import { Input } from '@saas/ui/input'
import { Label } from '@saas/ui/label'
import { Separator } from '@saas/ui/separator'
import { Alert, AlertDescription } from '@saas/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@saas/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { mfaApi, authApi } from '@/lib/auth'
import { ApiError } from '@/lib/api'
import { mfaCodeSchema, changePasswordSchema, type MfaCodeFormData, type ChangePasswordFormData } from '@/lib/validations'
import type { MfaSetupDTO, MfaStatusDTO } from '@saas/shared'

export default function SecurityPage(): React.ReactElement {
  const { t } = useI18n('skeleton')
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
        setError(t('security.failedStartMfaSetup'))
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
      toast.success(t('security.mfaEnabledSuccess'))
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError(t('security.failedEnableMfa'))
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
      toast.success(t('security.mfaDisabledSuccess'))
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError(t('security.failedDisableMfa'))
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
      toast.success(t('security.passwordChangedSuccess'))
    } catch (err) {
      if (err instanceof ApiError) {
        setPasswordError(err.message)
      } else {
        setPasswordError(t('security.failedChangePassword'))
      }
    }
  }

  const copyBackupCodes = (): void => {
    if (setupData) {
      navigator.clipboard.writeText(setupData.backupCodes.join('\n'))
      setCopiedCodes(true)
      setTimeout(() => setCopiedCodes(false), 2000)
      toast.success(t('security.backupCodesCopied'))
    }
  }

  if (!user) {
    return <></>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('security.title')}</h1>
      <p className="text-muted-foreground mt-1">{t('security.subtitle')}</p>

      <Separator className="my-6" />

      {/* Two-Factor Authentication */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('security.twoFactorTitle')}
          </CardTitle>
          <CardDescription>
            {t('security.twoFactorDescription')}
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
                <span>{t('security.twoFactorEnabledMessage')}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('security.backupCodesRemaining', { count: mfaStatus.backupCodesRemaining })}
              </p>

              {showDisable ? (
                <form onSubmit={handleSubmitMfa(handleDisableMfa)} className="space-y-4 max-w-sm">
                  <div>
                    <Label htmlFor="disableCode">{t('security.disableCodeLabel')}</Label>
                    <Input
                      id="disableCode"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder={t('security.mfaCodePlaceholder')}
                      {...registerMfa('code')}
                      className="mt-1"
                    />
                    {mfaErrors.code && (
                      <p className="mt-1 text-sm text-destructive">{mfaErrors.code.message}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" variant="destructive" disabled={isSubmittingMfa}>
                      {isSubmittingMfa ? <Loader2 className="h-4 w-4 animate-spin" /> : t('security.disable')}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowDisable(false)}>
                      {t('security.cancel')}
                    </Button>
                  </div>
                </form>
              ) : (
                <Button variant="outline" onClick={() => setShowDisable(true)}>
                  <ShieldX className="mr-2 h-4 w-4" />
                  {t('security.disable2fa')}
                </Button>
              )}
            </div>
          ) : showSetup && setupData ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">{t('security.step1Title')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('security.step1Description')}
                </p>
                <div className="bg-card p-4 rounded-lg border inline-block">
                  <Image src={setupData.qrCode} alt={t('security.qrCodeAlt')} className="w-48 h-48" />
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">{t('security.step2Title')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('security.step2Description')}
                </p>
                <div className="bg-muted p-4 rounded-lg border">
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
                        {t('security.copied')}
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        {t('security.copyCodes')}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <form onSubmit={handleSubmitMfa(handleEnableMfa)} className="space-y-4 max-w-sm">
                <div>
                  <Label htmlFor="enableCode">{t('security.step3Label')}</Label>
                  <Input
                    id="enableCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder={t('security.mfaCodePlaceholder')}
                    {...registerMfa('code')}
                    className="mt-1"
                  />
                  {mfaErrors.code && (
                    <p className="mt-1 text-sm text-destructive">{mfaErrors.code.message}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmittingMfa}>
                    {isSubmittingMfa ? <Loader2 className="h-4 w-4 animate-spin" /> : t('security.enable2fa')}
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
                    {t('security.cancel')}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <ShieldX className="h-5 w-5" />
                <span>{t('security.twoFactorDisabledMessage')}</span>
              </div>
              <Button onClick={handleStartSetup}>
                <Shield className="mr-2 h-4 w-4" />
                {t('security.setup2fa')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>{t('security.changePasswordTitle')}</CardTitle>
          <CardDescription>
            {t('security.changePasswordDescription')}
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
              <Label htmlFor="currentPassword">{t('security.currentPassword')}</Label>
              <Input
                id="currentPassword"
                type="password"
                {...registerPassword('currentPassword')}
                className="mt-1"
              />
              {passwordErrors.currentPassword && (
                <p className="mt-1 text-sm text-destructive">{passwordErrors.currentPassword.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="newPassword">{t('security.newPassword')}</Label>
              <Input
                id="newPassword"
                type="password"
                {...registerPassword('newPassword')}
                className="mt-1"
              />
              {passwordErrors.newPassword && (
                <p className="mt-1 text-sm text-destructive">{passwordErrors.newPassword.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="newPasswordConfirmation">{t('security.confirmNewPassword')}</Label>
              <Input
                id="newPasswordConfirmation"
                type="password"
                {...registerPassword('newPasswordConfirmation')}
                className="mt-1"
              />
              {passwordErrors.newPasswordConfirmation && (
                <p className="mt-1 text-sm text-destructive">{passwordErrors.newPasswordConfirmation.message}</p>
              )}
            </div>

            <Button type="submit" disabled={isSubmittingPassword}>
              {isSubmittingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('security.changing')}
                </>
              ) : (
                t('security.changePassword')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
