/**
 * Encryption Service
 *
 * Provides symmetric encryption for sensitive data at rest.
 * Uses AES-256-GCM for authenticated encryption.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import env from '#start/env'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits for GCM
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 16
const KEY_LENGTH = 32 // 256 bits

export class EncryptionService {
  private _masterKey: string | null = null

  /**
   * Lazy-load master key to avoid throwing during module import
   * (important for test environments where env may not be loaded yet)
   */
  private get masterKey(): string {
    if (!this._masterKey) {
      this._masterKey = env.get('APP_KEY')
      if (!this._masterKey || this._masterKey.length < 32) {
        throw new Error('APP_KEY must be at least 32 characters for encryption')
      }
    }
    return this._masterKey
  }

  /**
   * Derive an encryption key from the master key and a salt
   */
  private deriveKey(salt: Buffer): Buffer {
    return scryptSync(this.masterKey, salt, KEY_LENGTH)
  }

  /**
   * Encrypt a string value
   * Returns: salt:iv:authTag:ciphertext (all base64 encoded)
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return plaintext
    }

    const salt = randomBytes(SALT_LENGTH)
    const key = this.deriveKey(salt)
    const iv = randomBytes(IV_LENGTH)

    const cipher = createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    })

    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    const authTag = cipher.getAuthTag()

    // Format: salt:iv:authTag:ciphertext
    return [
      salt.toString('base64'),
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted,
    ].join(':')
  }

  /**
   * Decrypt an encrypted string
   */
  decrypt(encryptedValue: string): string {
    if (!encryptedValue) {
      return encryptedValue
    }

    // Check if this looks like an encrypted value
    const parts = encryptedValue.split(':')
    if (parts.length !== 4) {
      // Not encrypted, return as-is (for backward compatibility)
      return encryptedValue
    }

    const [saltB64, ivB64, authTagB64, ciphertext] = parts

    const salt = Buffer.from(saltB64, 'base64')
    const iv = Buffer.from(ivB64, 'base64')
    const authTag = Buffer.from(authTagB64, 'base64')
    const key = this.deriveKey(salt)

    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    })
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  /**
   * Check if a value appears to be encrypted
   * Validates the format: base64(salt):base64(iv):base64(authTag):base64(ciphertext)
   */
  isEncrypted(value: string): boolean {
    if (!value) return false
    const parts = value.split(':')
    if (parts.length !== 4) return false

    // Validate each part looks like base64 and has expected lengths
    const [saltB64, ivB64, authTagB64, ciphertext] = parts

    // Salt should be 16 bytes = ~24 base64 chars (with padding)
    // IV should be 12 bytes = 16 base64 chars
    // AuthTag should be 16 bytes = ~24 base64 chars
    // Ciphertext should be non-empty
    const base64Pattern = /^[A-Za-z0-9+/]+=*$/

    return (
      saltB64.length >= 20 &&
      saltB64.length <= 24 &&
      base64Pattern.test(saltB64) &&
      ivB64.length === 16 &&
      base64Pattern.test(ivB64) &&
      authTagB64.length >= 20 &&
      authTagB64.length <= 24 &&
      base64Pattern.test(authTagB64) &&
      ciphertext.length > 0 &&
      base64Pattern.test(ciphertext)
    )
  }
}

// Singleton instance
export const encryptionService = new EncryptionService()
