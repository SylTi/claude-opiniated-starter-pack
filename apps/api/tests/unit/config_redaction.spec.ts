import { test } from '@japa/runner'
import { redactSensitiveConfig } from '#services/plugins/config_redaction'

test.group('config_redaction', () => {
  test('redacts sensitive keys recursively', ({ assert }) => {
    const redacted = redactSensitiveConfig({
      apiKey: 'plain-key',
      nested: {
        secretAccessKey: 'super-secret',
        password: 'p@ss',
      },
      array: [{ signingSecret: 'sign-me' }],
    }) as Record<string, unknown>

    assert.equal(redacted.apiKey, '[REDACTED]')
    assert.deepEqual(redacted.nested, {
      secretAccessKey: '[REDACTED]',
      password: '[REDACTED]',
    })
    assert.deepEqual(redacted.array, [{ signingSecret: '[REDACTED]' }])
  })

  test('keeps non-sensitive keys untouched', ({ assert }) => {
    const source = {
      maxTokens: 4096,
      featureFlags: {
        booking: true,
      },
    }

    const redacted = redactSensitiveConfig(source)
    assert.deepEqual(redacted, source)
  })
})
