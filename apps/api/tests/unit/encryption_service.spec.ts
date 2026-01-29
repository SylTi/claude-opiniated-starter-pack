/**
 * Encryption Service Unit Tests
 *
 * Tests for the encryption service security features:
 * - Encrypt/decrypt round-trip (v1 format)
 * - Versioned format detection
 * - Key rotation support
 * - AAD (Additional Authenticated Data)
 * - Strict format validation
 * - Safe error handling
 */

import { test } from '@japa/runner'
import { EncryptionService } from '#services/encryption_service'

// Test keys (must be at least 32 characters)
const TEST_KEY = 'test-key-that-is-at-least-32-characters-long'
const ALT_KEY = 'alternative-key-also-32-characters-long!'
const KEY_32_EXACT = '12345678901234567890123456789012'

test.group('EncryptionService - encrypt() v1 format', () => {
  test('encrypts with v1 format prefix', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const plaintext = 'my-secret-value'

    const encrypted = service.encrypt(plaintext)

    assert.isTrue(encrypted.startsWith('enc:v1:'))
  })

  test('encrypted format has 7 colon-separated parts', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const encrypted = service.encrypt('test')

    const parts = encrypted.split(':')
    assert.equal(parts.length, 7, 'Format: enc:v1:<keyId>:<salt>:<iv>:<tag>:<ct>')
  })

  test('includes key ID in encrypted value', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const encrypted = service.encrypt('test')

    const parts = encrypted.split(':')
    assert.equal(parts[2], 'k1', 'Default key ID should be k1')
  })

  test('returns empty string for empty input', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    assert.equal(service.encrypt(''), '')
  })

  test('returns null for null input', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    // @ts-expect-error - Testing null handling
    assert.isNull(service.encrypt(null))
  })

  test('produces different ciphertext for same plaintext (random IV)', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const encrypted1 = service.encrypt('same-value')
    const encrypted2 = service.encrypt('same-value')

    assert.notEqual(encrypted1, encrypted2)
  })
})

test.group('EncryptionService - decrypt() v1 format', () => {
  test('round-trips: decrypt(encrypt(x)) === x', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const plaintext = 'my-secret-value-123!@#'

    const encrypted = service.encrypt(plaintext)
    const decrypted = service.decrypt(encrypted)

    assert.equal(decrypted, plaintext)
  })

  test('round-trips unicode content', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const plaintext = '日本語テスト 🔐 émojis'

    const encrypted = service.encrypt(plaintext)
    const decrypted = service.decrypt(encrypted)

    assert.equal(decrypted, plaintext)
  })

  test('round-trips long content', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const plaintext = 'a'.repeat(10000)

    const encrypted = service.encrypt(plaintext)
    const decrypted = service.decrypt(encrypted)

    assert.equal(decrypted, plaintext)
  })

  test('returns empty string for empty input', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    assert.equal(service.decrypt(''), '')
  })

  test('returns plaintext as-is for non-encrypted values', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    assert.equal(service.decrypt('just-a-regular-string'), 'just-a-regular-string')
  })

  test('returns plaintext for colon-separated but invalid format', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    assert.equal(service.decrypt('a:b:c:d'), 'a:b:c:d')
    assert.equal(service.decrypt('a:b:c:d:e:f:g'), 'a:b:c:d:e:f:g')
  })
})

test.group('EncryptionService - AAD (Additional Authenticated Data)', () => {
  test('encrypt/decrypt with AAD succeeds', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const plaintext = 'secret-with-aad'
    const aad = 'tenant:123|table:configs|field:secret'

    const encrypted = service.encrypt(plaintext, aad)
    const decrypted = service.decrypt(encrypted, aad)

    assert.equal(decrypted, plaintext)
  })

  test('decrypt with wrong AAD fails', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const plaintext = 'secret-with-aad'
    const aad1 = 'tenant:123|table:configs|field:secret'
    const aad2 = 'tenant:456|table:configs|field:secret'

    const encrypted = service.encrypt(plaintext, aad1)

    assert.throws(() => service.decrypt(encrypted, aad2), /Failed to decrypt/)
  })

  test('decrypt without AAD fails when encrypted with AAD', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const plaintext = 'secret-with-aad'
    const aad = 'tenant:123|table:configs|field:secret'

    const encrypted = service.encrypt(plaintext, aad)

    assert.throws(() => service.decrypt(encrypted), /Failed to decrypt/)
  })

  test('decrypt with AAD fails when encrypted without AAD', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const plaintext = 'secret-no-aad'

    const encrypted = service.encrypt(plaintext)

    assert.throws(() => service.decrypt(encrypted, 'some-aad'), /Failed to decrypt/)
  })

  test('buildAAD creates correct format', ({ assert }) => {
    const aad = EncryptionService.buildAAD({
      tenantId: 123,
      table: 'configs',
      field: 'secret',
      recordId: 456,
    })

    assert.equal(aad, 'tenant:123|table:configs|field:secret|id:456')
  })

  test('buildAAD handles partial components', ({ assert }) => {
    const aad = EncryptionService.buildAAD({
      tenantId: 123,
      field: 'secret',
    })

    assert.equal(aad, 'tenant:123|field:secret')
  })

  test('buildAAD handles empty components', ({ assert }) => {
    const aad = EncryptionService.buildAAD({})

    assert.equal(aad, '')
  })
})

test.group('EncryptionService - Key Rotation', () => {
  test('encrypts with primary key', ({ assert }) => {
    const service = new EncryptionService(undefined, [
      { id: 'new', key: TEST_KEY },
      { id: 'old', key: ALT_KEY },
    ])

    const encrypted = service.encrypt('secret')
    const parts = encrypted.split(':')

    assert.equal(parts[2], 'new', 'Should use first (primary) key ID')
  })

  test('decrypts with correct key by ID', ({ assert }) => {
    const service = new EncryptionService(undefined, [
      { id: 'k1', key: TEST_KEY },
      { id: 'k2', key: ALT_KEY },
    ])

    const encrypted = service.encrypt('secret')
    const decrypted = service.decrypt(encrypted)

    assert.equal(decrypted, 'secret')
  })

  test('fails to decrypt with unknown key ID', ({ assert }) => {
    const service1 = new EncryptionService(undefined, [{ id: 'k1', key: TEST_KEY }])
    const service2 = new EncryptionService(undefined, [{ id: 'k2', key: ALT_KEY }])

    const encrypted = service1.encrypt('secret')

    assert.throws(() => service2.decrypt(encrypted), /unknown key ID/)
  })

  test('getPrimaryKeyId returns first key ID', ({ assert }) => {
    const service = new EncryptionService(undefined, [
      { id: 'primary', key: TEST_KEY },
      { id: 'secondary', key: ALT_KEY },
    ])

    assert.equal(service.getPrimaryKeyId(), 'primary')
  })

  test('getKeyIds returns all key IDs', ({ assert }) => {
    const service = new EncryptionService(undefined, [
      { id: 'k1', key: TEST_KEY },
      { id: 'k2', key: ALT_KEY },
    ])

    assert.deepEqual(service.getKeyIds(), ['k1', 'k2'])
  })

  test('can decrypt old data with secondary key after rotation', ({ assert }) => {
    // Simulate: encrypt with old key, then add new key as primary
    const oldService = new EncryptionService(undefined, [{ id: 'k1', key: TEST_KEY }])
    const encryptedWithOldKey = oldService.encrypt('old-secret')

    // New service with rotated keys (new primary + old secondary)
    const newService = new EncryptionService(undefined, [
      { id: 'k2', key: ALT_KEY },
      { id: 'k1', key: TEST_KEY },
    ])

    // Should still decrypt old data
    const decrypted = newService.decrypt(encryptedWithOldKey)
    assert.equal(decrypted, 'old-secret')

    // New encryptions use new key
    const encryptedWithNewKey = newService.encrypt('new-secret')
    assert.isTrue(encryptedWithNewKey.includes(':k2:'))
  })
})

test.group('EncryptionService - reencrypt()', () => {
  test('reencrypt produces new ciphertext with primary key', ({ assert }) => {
    const service = new EncryptionService(undefined, [
      { id: 'k2', key: ALT_KEY },
      { id: 'k1', key: TEST_KEY },
    ])

    // Encrypt with k2 (primary)
    const original = service.encrypt('secret')
    assert.isTrue(original.includes(':k2:'))

    // Simulate: change primary to k1
    const rotatedService = new EncryptionService(undefined, [
      { id: 'k1', key: TEST_KEY },
      { id: 'k2', key: ALT_KEY },
    ])

    // Reencrypt - should now use k1
    const reencrypted = rotatedService.reencrypt(original)
    assert.isTrue(reencrypted.includes(':k1:'))
    assert.equal(rotatedService.decrypt(reencrypted), 'secret')
  })

  test('reencrypt with new AAD', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const original = service.encrypt('secret', 'old-aad')

    const reencrypted = service.reencrypt(original, 'old-aad', 'new-aad')

    assert.equal(service.decrypt(reencrypted, 'new-aad'), 'secret')
  })

  test('reencrypt returns non-encrypted values as-is', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)

    assert.equal(service.reencrypt('plain-text'), 'plain-text')
  })
})

test.group('EncryptionService - Format Detection', () => {
  test('isEncrypted returns true for v1 format', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const encrypted = service.encrypt('test')

    assert.isTrue(service.isEncrypted(encrypted))
  })

  test('isEncrypted returns false for plain string', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)

    assert.isFalse(service.isEncrypted('just-a-plain-string'))
  })

  test('isEncrypted returns false for empty string', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)

    assert.isFalse(service.isEncrypted(''))
  })

  test('isEncrypted returns false for null', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)

    // @ts-expect-error - Testing null handling
    assert.isFalse(service.isEncrypted(null))
  })

  test('isEncrypted returns false for invalid v1 format', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)

    // Wrong prefix
    assert.isFalse(service.isEncrypted('foo:v1:k1:salt:iv:tag:ct'))
    // Wrong version
    assert.isFalse(service.isEncrypted('enc:v2:k1:salt:iv:tag:ct'))
    // Missing parts
    assert.isFalse(service.isEncrypted('enc:v1:k1:salt:iv:tag'))
    // Invalid key ID
    assert.isFalse(service.isEncrypted('enc:v1:key-with-dashes:salt:iv:tag:ct'))
  })

  test('isEncrypted validates byte lengths', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)

    // Create fake with wrong byte lengths
    const wrongSalt = Buffer.alloc(8, 0).toString('base64') // Should be 16
    const iv = Buffer.alloc(12, 0).toString('base64')
    const tag = Buffer.alloc(16, 0).toString('base64')
    const ct = Buffer.from('test').toString('base64')

    assert.isFalse(service.isEncrypted(`enc:v1:k1:${wrongSalt}:${iv}:${tag}:${ct}`))
  })
})

test.group('EncryptionService - Security', () => {
  test('different key cannot decrypt', ({ assert }) => {
    const service1 = new EncryptionService(TEST_KEY)
    const service2 = new EncryptionService(ALT_KEY)

    const encrypted = service1.encrypt('secret')

    assert.throws(() => service2.decrypt(encrypted), /Failed to decrypt/)
  })

  test('tampered ciphertext fails authentication', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const encrypted = service.encrypt('secret')

    const parts = encrypted.split(':')
    parts[6] = 'AAAA' + parts[6].slice(4)
    const tampered = parts.join(':')

    assert.throws(() => service.decrypt(tampered), /Failed to decrypt/)
  })

  test('tampered auth tag fails authentication', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const encrypted = service.encrypt('secret')

    const parts = encrypted.split(':')
    parts[5] = 'AAAA' + parts[5].slice(4)
    const tampered = parts.join(':')

    assert.throws(() => service.decrypt(tampered), /Failed to decrypt/)
  })

  test('tampered salt fails decryption', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const encrypted = service.encrypt('secret')

    const parts = encrypted.split(':')
    parts[3] = 'AAAA' + parts[3].slice(4)
    const tampered = parts.join(':')

    assert.throws(() => service.decrypt(tampered), /Failed to decrypt/)
  })

  test('tampered IV fails decryption', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const encrypted = service.encrypt('secret')

    const parts = encrypted.split(':')
    parts[4] = 'AAAA' + parts[4].slice(4)
    const tampered = parts.join(':')

    assert.throws(() => service.decrypt(tampered), /Failed to decrypt/)
  })

  test('tampered key ID fails decryption', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const encrypted = service.encrypt('secret')

    const parts = encrypted.split(':')
    parts[2] = 'unknown'
    const tampered = parts.join(':')

    assert.throws(() => service.decrypt(tampered), /unknown key ID/)
  })
})

test.group('EncryptionService - Constructor', () => {
  test('throws for key shorter than 32 characters', ({ assert }) => {
    assert.throws(() => new EncryptionService('short-key'), /must be at least 32 characters/)
  })

  test('accepts key with exactly 32 characters', ({ assert }) => {
    assert.doesNotThrow(() => new EncryptionService(KEY_32_EXACT))
  })

  test('accepts base64-encoded 32-byte key', ({ assert }) => {
    const base64Key = Buffer.alloc(32, 0x42).toString('base64')
    assert.doesNotThrow(() => new EncryptionService(base64Key))
  })

  test('single key gets ID k1', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    assert.equal(service.getPrimaryKeyId(), 'k1')
  })

  test('multiple keys use provided IDs', ({ assert }) => {
    const service = new EncryptionService(undefined, [
      { id: 'primary', key: TEST_KEY },
      { id: 'backup', key: ALT_KEY },
    ])

    assert.deepEqual(service.getKeyIds(), ['primary', 'backup'])
  })
})

test.group('EncryptionService - Edge Cases', () => {
  test('handles JSON content', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const json = JSON.stringify({ key: 'value', nested: { array: [1, 2, 3] } })

    const encrypted = service.encrypt(json)
    const decrypted = service.decrypt(encrypted)

    assert.deepEqual(JSON.parse(decrypted), JSON.parse(json))
  })

  test('handles content with colons', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const plaintext = 'user:password:extra:colons:here'

    const encrypted = service.encrypt(plaintext)
    const decrypted = service.decrypt(encrypted)

    assert.equal(decrypted, plaintext)
  })

  test('handles content with newlines', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const plaintext = 'line1\nline2\r\nline3'

    const encrypted = service.encrypt(plaintext)
    const decrypted = service.decrypt(encrypted)

    assert.equal(decrypted, plaintext)
  })

  test('handles content with special characters', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const plaintext = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~'

    const encrypted = service.encrypt(plaintext)
    const decrypted = service.decrypt(encrypted)

    assert.equal(decrypted, plaintext)
  })

  test('handles very long AAD', ({ assert }) => {
    const service = new EncryptionService(TEST_KEY)
    const longAad = 'a'.repeat(10000)

    const encrypted = service.encrypt('secret', longAad)
    const decrypted = service.decrypt(encrypted, longAad)

    assert.equal(decrypted, 'secret')
  })
})
