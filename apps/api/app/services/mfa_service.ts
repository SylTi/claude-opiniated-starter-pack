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
   * 1. Backup codes are high-entropy random strings (10 alphanumeric chars = ~59 bits)
   * 2. Fast hashing is acceptable for high-entropy inputs
   * 3. No need for salting since each code is unique and random
   *
   * Normalizes input by removing hyphens and converting to uppercase before hashing.
   */
  private hashBackupCode(code: string): string {
    // Normalize: remove hyphens and convert to uppercase
    const normalized = code.replace(/-/g, '').toUpperCase()
    return createHash('sha256').update(normalized).digest('hex')
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
   * Alphanumeric character set for backup codes (0-9, A-Z)
   * Excludes ambiguous characters: 0/O, 1/I/L, 5/S, 8/B
   */
  private readonly BACKUP_CODE_CHARSET = '234679ACDEFGHJKMNPQRTUVWXYZ'

  /**
   * Generate backup codes with high entropy
   *
   * Format: XXXXX-XXXXX (10 characters, hyphen for readability)
   * Entropy: ~47 bits per code (27^10 combinations)
   *
   * Uses a character set without ambiguous characters to reduce
   * user errors when typing codes manually.
   */
  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = []
    const charsetLength = this.BACKUP_CODE_CHARSET.length

    for (let i = 0; i < count; i++) {
      // Generate 10 random characters (5 + hyphen + 5)
      const bytes = randomBytes(10)
      let code = ''

      for (let j = 0; j < 10; j++) {
        // Use modulo to map byte to charset
        // Note: slight bias for charsets not power of 2, but acceptable for backup codes
        const index = bytes[j] % charsetLength
        code += this.BACKUP_CODE_CHARSET[index]

        // Add hyphen after 5th character for readability
        if (j === 4) {
          code += '-'
        }
      }

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
