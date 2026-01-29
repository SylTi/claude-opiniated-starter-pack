/**
 * Encryption Service v1
 *
 * Provides symmetric encryption for sensitive data at rest.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * Security features:
 * - Versioned format with `enc:v1:` prefix (unambiguous detection)
 * - Key rotation support with key IDs
 * - AAD (Additional Authenticated Data) to prevent swap attacks
 * - HKDF key derivation (non-blocking, fast)
 * - Strict format validation before decryption attempts
 * - Safe error handling (no internal crypto errors exposed)
 *
 * Format: enc:v1:<keyId>:<saltB64>:<ivB64>:<tagB64>:<ctB64>
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import env from '#start/env'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits for GCM
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 16
const KEY_LENGTH = 32 // 256 bits

// Format constants
const FORMAT_PREFIX = 'enc'
const FORMAT_VERSION = 'v1'
const HKDF_INFO = 'saas:secrets:v1'

// Base64 validation pattern
const BASE64_PATTERN = /^[A-Za-z0-9+/]+=*$/

// Key ID pattern (alphanumeric, 1-16 chars)
const KEY_ID_PATTERN = /^[a-zA-Z0-9]{1,16}$/

interface KeyEntry {
  id: string
  key: Buffer
}

export class EncryptionService {
  private _keys: KeyEntry[] = []
  private _primaryKeyId: string = ''
  private _initialized = false
  private _injectedKeys: KeyEntry[] | null = null

  /**
   * Create encryption service instance
   * @param masterKey Optional key override (for testing only) - single key with id 'k1'
   * @param keys Optional key entries for testing multiple keys
   */
  constructor(masterKey?: string, keys?: Array<{ id: string; key: string }>) {
    if (keys && keys.length > 0) {
      // Multiple keys provided (for testing key rotation)
      this._injectedKeys = keys.map((k) => {
        const keyBytes = this.parseKeyString(k.key)
        return { id: k.id, key: keyBytes }
      })
      this._keys = this._injectedKeys
      this._primaryKeyId = keys[0].id
      this._initialized = true
    } else if (masterKey) {
      // Single key provided (simple testing)
      const keyBytes = this.parseKeyString(masterKey)
      this._injectedKeys = [{ id: 'k1', key: keyBytes }]
      this._keys = this._injectedKeys
      this._primaryKeyId = 'k1'
      this._initialized = true
    }
  }

  /**
   * Parse a key string (plain text or base64) into a 32-byte buffer
   */
  private parseKeyString(keyStr: string): Buffer {
    // Try base64 first (if it looks like base64 and decodes to 32 bytes)
    if (BASE64_PATTERN.test(keyStr)) {
      try {
        const decoded = Buffer.from(keyStr, 'base64')
        if (decoded.length === KEY_LENGTH) {
          return decoded
        }
      } catch {
        // Not valid base64, fall through to plain text
      }
    }

    // Plain text key - must be at least 32 characters
    if (keyStr.length < 32) {
      throw new Error('Master key must be at least 32 characters for encryption')
    }
    return Buffer.from(keyStr, 'utf8')
  }

  /**
   * Initialize keys from environment variables (lazy loading)
   */
  private initializeKeys(): void {
    if (this._initialized) return

    // Check for dedicated encryption key first, fall back to APP_KEY
    const keyString = env.get('ENCRYPTION_MASTER_KEY') || env.get('APP_KEY')

    if (!keyString) {
      throw new Error('ENCRYPTION_MASTER_KEY or APP_KEY must be set for encryption')
    }

    // Support comma-separated keys for rotation: "newKey,oldKey"
    const keyStrings = keyString.split(',').map((k) => k.trim())

    this._keys = keyStrings.map((k, i) => ({
      id: `k${i + 1}`,
      key: this.parseKeyString(k),
    }))

    this._primaryKeyId = this._keys[0].id
    this._initialized = true
  }

  /**
   * Get the primary key for encryption
   */
  private get primaryKey(): KeyEntry {
    this.initializeKeys()
    return this._keys[0]
  }

  /**
   * Get a key by ID (for decryption)
   */
  private getKeyById(keyId: string): KeyEntry | undefined {
    this.initializeKeys()
    return this._keys.find((k) => k.id === keyId)
  }

  /**
   * Derive an encryption key using HKDF (fast, non-blocking)
   */
  private deriveKey(masterKey: Buffer, salt: Buffer): Buffer {
    return Buffer.from(hkdfSync('sha256', masterKey, salt, HKDF_INFO, KEY_LENGTH))
  }

  /**
   * Encrypt a string value with optional AAD
   *
   * @param plaintext The value to encrypt
   * @param aad Optional additional authenticated data (e.g., "tenant:123|table:configs|field:secret")
   * @returns Encrypted string in format: enc:v1:<keyId>:<salt>:<iv>:<tag>:<ciphertext>
   */
  encrypt(plaintext: string, aad?: string): string {
    if (!plaintext) {
      return plaintext
    }

    const keyEntry = this.primaryKey
    const salt = randomBytes(SALT_LENGTH)
    const derivedKey = this.deriveKey(keyEntry.key, salt)
    const iv = randomBytes(IV_LENGTH)

    const cipher = createCipheriv(ALGORITHM, derivedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    })

    // Set AAD if provided
    if (aad) {
      cipher.setAAD(Buffer.from(aad, 'utf8'))
    }

    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    const authTag = cipher.getAuthTag()

    // Format: enc:v1:<keyId>:<salt>:<iv>:<tag>:<ciphertext>
    return [
      FORMAT_PREFIX,
      FORMAT_VERSION,
      keyEntry.id,
      salt.toString('base64'),
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted,
    ].join(':')
  }

  /**
   * Decrypt an encrypted string with optional AAD
   *
   * Returns plaintext as-is for non-encrypted values (backward compatibility).
   *
   * @param encryptedValue The encrypted value
   * @param aad Optional AAD (must match what was used during encryption)
   * @returns Decrypted plaintext
   * @throws Error if decryption fails
   */
  decrypt(encryptedValue: string, aad?: string): string {
    if (!encryptedValue) {
      return encryptedValue
    }

    // Check if this is encrypted
    if (!this.isEncrypted(encryptedValue)) {
      // Not encrypted, return as-is (for plaintext values)
      return encryptedValue
    }

    const parts = encryptedValue.split(':')
    // parts[0] = 'enc', parts[1] = 'v1', parts[2] = keyId, parts[3-6] = crypto components
    const [, , keyId, saltB64, ivB64, authTagB64, ciphertext] = parts

    const keyEntry = this.getKeyById(keyId)
    if (!keyEntry) {
      throw new Error('Failed to decrypt: unknown key ID')
    }

    const salt = Buffer.from(saltB64, 'base64')
    const iv = Buffer.from(ivB64, 'base64')
    const authTag = Buffer.from(authTagB64, 'base64')

    // Validate byte lengths (defense in depth)
    if (salt.length !== SALT_LENGTH) {
      throw new Error('Failed to decrypt: invalid payload')
    }
    if (iv.length !== IV_LENGTH) {
      throw new Error('Failed to decrypt: invalid payload')
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Failed to decrypt: invalid payload')
    }

    try {
      const derivedKey = this.deriveKey(keyEntry.key, salt)

      const decipher = createDecipheriv(ALGORITHM, derivedKey, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      })

      // Set AAD if provided
      if (aad) {
        decipher.setAAD(Buffer.from(aad, 'utf8'))
      }

      decipher.setAuthTag(authTag)

      let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch {
      throw new Error('Failed to decrypt: invalid payload or wrong key')
    }
  }

  /**
   * Check if a value is encrypted (v1 format)
   *
   * Validates:
   * - Format: enc:v1:<keyId>:<salt>:<iv>:<tag>:<ciphertext>
   * - All parts are valid base64
   * - Decoded byte lengths are correct
   */
  isEncrypted(value: string): boolean {
    if (!value) return false

    // Must start with enc:v1:
    if (!value.startsWith(`${FORMAT_PREFIX}:${FORMAT_VERSION}:`)) {
      return false
    }

    const parts = value.split(':')
    if (parts.length !== 7) return false

    const [prefix, version, keyId, saltB64, ivB64, authTagB64, ciphertext] = parts

    if (prefix !== FORMAT_PREFIX || version !== FORMAT_VERSION) {
      return false
    }

    if (!KEY_ID_PATTERN.test(keyId)) {
      return false
    }

    if (
      !BASE64_PATTERN.test(saltB64) ||
      !BASE64_PATTERN.test(ivB64) ||
      !BASE64_PATTERN.test(authTagB64) ||
      !BASE64_PATTERN.test(ciphertext)
    ) {
      return false
    }

    if (ciphertext.length === 0) {
      return false
    }

    // Validate decoded byte lengths
    try {
      const salt = Buffer.from(saltB64, 'base64')
      const iv = Buffer.from(ivB64, 'base64')
      const authTag = Buffer.from(authTagB64, 'base64')

      return (
        salt.length === SALT_LENGTH && iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH
      )
    } catch {
      return false
    }
  }

  /**
   * Re-encrypt a value with the current primary key
   * Useful for key rotation
   *
   * @param encryptedValue The encrypted value (any format)
   * @param oldAad Optional AAD used for the original encryption
   * @param newAad Optional AAD for the new encryption
   * @returns Re-encrypted value, or original if not encrypted
   */
  reencrypt(encryptedValue: string, oldAad?: string, newAad?: string): string {
    if (!this.isEncrypted(encryptedValue)) {
      return encryptedValue
    }

    // Decrypt with old AAD
    const plaintext = this.decrypt(encryptedValue, oldAad)

    // Re-encrypt with new AAD
    return this.encrypt(plaintext, newAad)
  }

  /**
   * Get the current primary key ID
   */
  getPrimaryKeyId(): string {
    this.initializeKeys()
    return this._primaryKeyId
  }

  /**
   * Get all available key IDs
   */
  getKeyIds(): string[] {
    this.initializeKeys()
    return this._keys.map((k) => k.id)
  }

  /**
   * Build AAD string from components
   * Standard format: tenant:<id>|table:<name>|field:<name>|id:<id>
   */
  static buildAAD(components: {
    tenantId?: number | string
    table?: string
    field?: string
    recordId?: number | string
  }): string {
    const parts: string[] = []

    if (components.tenantId !== undefined) {
      parts.push(`tenant:${components.tenantId}`)
    }
    if (components.table) {
      parts.push(`table:${components.table}`)
    }
    if (components.field) {
      parts.push(`field:${components.field}`)
    }
    if (components.recordId !== undefined) {
      parts.push(`id:${components.recordId}`)
    }

    return parts.join('|')
  }
}

// Singleton instance
export const encryptionService = new EncryptionService()
