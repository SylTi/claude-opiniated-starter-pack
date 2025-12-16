import { authenticator } from 'otplib'
import * as QRCode from 'qrcode'
import { randomBytes } from 'node:crypto'
import User from '#models/user'

interface MfaSetupResult {
  secret: string
  qrCodeDataUrl: string
  backupCodes: string[]
}

export default class MfaService {
  private readonly appName = 'SaaS App'

  /**
   * Generate MFA setup data for a user
   */
  async generateSetup(user: User): Promise<MfaSetupResult> {
    const secret = authenticator.generateSecret()
    const otpAuthUrl = authenticator.keyuri(user.email, this.appName, secret)

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl)

    // Generate backup codes
    const backupCodes = this.generateBackupCodes()

    return {
      secret,
      qrCodeDataUrl,
      backupCodes,
    }
  }

  /**
   * Enable MFA for a user
   */
  async enable(user: User, secret: string, code: string, backupCodes: string[]): Promise<boolean> {
    // Verify the code before enabling
    if (!this.verifyCode(secret, code)) {
      return false
    }

    user.mfaEnabled = true
    user.mfaSecret = secret
    user.setMfaBackupCodes(backupCodes)
    await user.save()

    return true
  }

  /**
   * Disable MFA for a user
   */
  async disable(user: User): Promise<void> {
    user.mfaEnabled = false
    user.mfaSecret = null
    user.mfaBackupCodes = null
    await user.save()
  }

  /**
   * Verify a TOTP code
   */
  verifyCode(secret: string, code: string): boolean {
    return authenticator.verify({ token: code, secret })
  }

  /**
   * Verify MFA code for a user (TOTP or backup code)
   */
  async verifyUserMfa(user: User, code: string): Promise<boolean> {
    if (!user.mfaEnabled || !user.mfaSecret) {
      return false
    }

    // First try TOTP verification
    if (this.verifyCode(user.mfaSecret, code)) {
      return true
    }

    // Then try backup codes
    const backupCodes = user.getMfaBackupCodes()
    const codeIndex = backupCodes.indexOf(code)

    if (codeIndex !== -1) {
      // Remove used backup code
      backupCodes.splice(codeIndex, 1)
      user.setMfaBackupCodes(backupCodes)
      await user.save()
      return true
    }

    return false
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = []
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const code = randomBytes(4).toString('hex').toUpperCase()
      codes.push(code)
    }
    return codes
  }

  /**
   * Regenerate backup codes for a user
   */
  async regenerateBackupCodes(user: User): Promise<string[]> {
    const backupCodes = this.generateBackupCodes()
    user.setMfaBackupCodes(backupCodes)
    await user.save()
    return backupCodes
  }
}
