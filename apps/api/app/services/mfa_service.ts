import { authenticator } from 'otplib'
import * as QRCode from 'qrcode'
import { randomBytes, createHash } from 'node:crypto'
import env from '#start/env'
import User from '#models/user'

interface MfaSetupResult {
  secret: string
  qrCodeDataUrl: string
  backupCodes: string[]
}

export default class MfaService {
  private readonly appName = env.get('APP_NAME', 'SaaS App')

  /**
   * Hash a backup code using SHA-256
   * We use SHA-256 instead of bcrypt/scrypt because:
   * 1. Backup codes are already high-entropy random strings (8 hex chars = 32 bits)
   * 2. Fast hashing is acceptable for high-entropy inputs
   * 3. No need for salting since each code is unique and random
   */
  private hashBackupCode(code: string): string {
    return createHash('sha256').update(code.toUpperCase()).digest('hex')
  }

  /**
   * Hash an array of backup codes for storage
   */
  private hashBackupCodes(codes: string[]): string[] {
    return codes.map((code) => this.hashBackupCode(code))
  }

  /**
   * Generate MFA setup data for a user
   */
  async generateSetup(user: User): Promise<MfaSetupResult> {
    const secret = authenticator.generateSecret()
    const otpAuthUrl = authenticator.keyuri(user.email, this.appName, secret)

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl)

    // Generate backup codes (plaintext - returned to user)
    const backupCodes = this.generateBackupCodes()

    return {
      secret,
      qrCodeDataUrl,
      backupCodes,
    }
  }

  /**
   * Enable MFA for a user
   * Stores hashed backup codes, not plaintext
   */
  async enable(user: User, secret: string, code: string, backupCodes: string[]): Promise<boolean> {
    // Verify the code before enabling
    if (!this.verifyCode(secret, code)) {
      return false
    }

    user.mfaEnabled = true
    user.mfaSecret = secret
    // Store HASHED backup codes, not plaintext
    user.setMfaBackupCodes(this.hashBackupCodes(backupCodes))
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
   * Backup codes are stored as hashes, so we hash the input before comparing
   */
  async verifyUserMfa(user: User, code: string): Promise<boolean> {
    if (!user.mfaEnabled || !user.mfaSecret) {
      return false
    }

    // First try TOTP verification
    if (this.verifyCode(user.mfaSecret, code)) {
      return true
    }

    // Then try backup codes (stored as hashes)
    const storedHashes = user.getMfaBackupCodes()
    const inputHash = this.hashBackupCode(code)
    const hashIndex = storedHashes.indexOf(inputHash)

    if (hashIndex !== -1) {
      // Remove used backup code hash
      storedHashes.splice(hashIndex, 1)
      user.setMfaBackupCodes(storedHashes)
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
   * Returns plaintext codes for user to save, stores hashed codes in DB
   */
  async regenerateBackupCodes(user: User): Promise<string[]> {
    const backupCodes = this.generateBackupCodes()
    // Store HASHED codes, return plaintext to user
    user.setMfaBackupCodes(this.hashBackupCodes(backupCodes))
    await user.save()
    return backupCodes
  }
}
