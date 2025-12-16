import type { HttpContext } from '@adonisjs/core/http'
import { verifyMfaValidator } from '#validators/auth'
import MfaService from '#services/mfa_service'

export default class MfaController {
  private mfaService = new MfaService()

  /**
   * Get MFA setup data (secret, QR code, backup codes)
   * POST /api/v1/auth/mfa/setup
   */
  async setup({ response, auth }: HttpContext): Promise<void> {
    const user = auth.user!

    if (user.mfaEnabled) {
      response.badRequest({
        error: 'MfaAlreadyEnabled',
        message: 'MFA is already enabled for this account',
      })
      return
    }

    const setupData = await this.mfaService.generateSetup(user)

    response.ok({
      data: {
        secret: setupData.secret,
        qrCode: setupData.qrCodeDataUrl,
        backupCodes: setupData.backupCodes,
      },
      message: 'Scan the QR code with your authenticator app',
    })
  }

  /**
   * Enable MFA after verifying the code
   * POST /api/v1/auth/mfa/enable
   */
  async enable({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!
    const { code } = await request.validateUsing(verifyMfaValidator)
    const { secret, backupCodes } = request.only(['secret', 'backupCodes'])

    if (!secret || !backupCodes) {
      response.badRequest({
        error: 'MissingData',
        message: 'Secret and backup codes are required',
      })
      return
    }

    if (user.mfaEnabled) {
      response.badRequest({
        error: 'MfaAlreadyEnabled',
        message: 'MFA is already enabled for this account',
      })
      return
    }

    const success = await this.mfaService.enable(user, secret, code, backupCodes)

    if (!success) {
      response.badRequest({
        error: 'InvalidCode',
        message: 'Invalid verification code',
      })
      return
    }

    response.ok({
      data: { mfaEnabled: true },
      message: 'MFA has been enabled successfully',
    })
  }

  /**
   * Disable MFA
   * POST /api/v1/auth/mfa/disable
   */
  async disable({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!
    const { code } = await request.validateUsing(verifyMfaValidator)

    if (!user.mfaEnabled) {
      response.badRequest({
        error: 'MfaNotEnabled',
        message: 'MFA is not enabled for this account',
      })
      return
    }

    // Verify MFA code before disabling
    const isValid = await this.mfaService.verifyUserMfa(user, code)

    if (!isValid) {
      response.badRequest({
        error: 'InvalidCode',
        message: 'Invalid verification code',
      })
      return
    }

    await this.mfaService.disable(user)

    response.ok({
      data: { mfaEnabled: false },
      message: 'MFA has been disabled successfully',
    })
  }

  /**
   * Get MFA status
   * GET /api/v1/auth/mfa/status
   */
  async status({ response, auth }: HttpContext): Promise<void> {
    const user = auth.user!

    response.ok({
      data: {
        mfaEnabled: user.mfaEnabled,
        backupCodesRemaining: user.getMfaBackupCodes().length,
      },
    })
  }

  /**
   * Regenerate backup codes
   * POST /api/v1/auth/mfa/regenerate-backup-codes
   */
  async regenerateBackupCodes({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!
    const { code } = await request.validateUsing(verifyMfaValidator)

    if (!user.mfaEnabled) {
      response.badRequest({
        error: 'MfaNotEnabled',
        message: 'MFA is not enabled for this account',
      })
      return
    }

    // Verify MFA code before regenerating
    const isValid = await this.mfaService.verifyUserMfa(user, code)

    if (!isValid) {
      response.badRequest({
        error: 'InvalidCode',
        message: 'Invalid verification code',
      })
      return
    }

    const backupCodes = await this.mfaService.regenerateBackupCodes(user)

    response.ok({
      data: { backupCodes },
      message: 'Backup codes have been regenerated',
    })
  }
}
