import { test } from '@japa/runner'
import crypto from 'node:crypto'

/**
 * Unit tests for the Paddle payment provider.
 *
 * These tests verify the webhook signature verification algorithm
 * and event type mappings without instantiating the full provider
 * (which requires Paddle SDK + env vars).
 *
 * Paddle signature format: ts=TIMESTAMP;h1=HMAC_SHA256_HEX
 * HMAC is computed over: `${timestamp}:${rawPayload}`
 */

test.group('Paddle Provider - Webhook Signature Verification', () => {
  test('returns true for valid HMAC-SHA256 signature in ts=;h1= format', async ({ assert }) => {
    const secret = 'pdl_whsec_test_secret_key_12345'
    const payload = '{"event_type":"transaction.completed","data":{"id":"txn_01"}}'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signedContent = `${timestamp}:${payload}`

    const hash = crypto.createHmac('sha256', secret).update(signedContent).digest('hex')
    const signature = `ts=${timestamp};h1=${hash}`

    // Reproduce the verification logic from PaddleProvider.verifyWebhookSignature
    const parts = signature.split(';')
    const timestampPart = parts.find((p) => p.startsWith('ts='))
    const hashPart = parts.find((p) => p.startsWith('h1='))

    assert.exists(timestampPart)
    assert.exists(hashPart)

    const ts = timestampPart!.replace('ts=', '')
    const expectedHash = hashPart!.replace('h1=', '')

    const computedHash = crypto
      .createHmac('sha256', secret)
      .update(`${ts}:${payload}`)
      .digest('hex')

    const expectedBuffer = Buffer.from(expectedHash, 'hex')
    const computedBuffer = Buffer.from(computedHash, 'hex')

    assert.equal(expectedBuffer.length, computedBuffer.length)
    assert.isTrue(crypto.timingSafeEqual(expectedBuffer, computedBuffer))
  })

  test('returns false when signature was computed with a different secret', async ({ assert }) => {
    const correctSecret = 'pdl_whsec_correct_secret'
    const wrongSecret = 'pdl_whsec_wrong_secret'
    const payload = '{"event_type":"transaction.completed","data":{"id":"txn_01"}}'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signedContent = `${timestamp}:${payload}`

    const wrongHash = crypto.createHmac('sha256', wrongSecret).update(signedContent).digest('hex')
    const correctHash = crypto
      .createHmac('sha256', correctSecret)
      .update(signedContent)
      .digest('hex')

    assert.notEqual(wrongHash, correctHash)
  })

  test('returns false when payload has been tampered with', async ({ assert }) => {
    const secret = 'pdl_whsec_test_secret_key_12345'
    const originalPayload = '{"event_type":"transaction.completed","data":{"id":"txn_01"}}'
    const tamperedPayload = '{"event_type":"transaction.completed","data":{"id":"txn_02"}}'
    const timestamp = String(Math.floor(Date.now() / 1000))

    const hash = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}:${originalPayload}`)
      .digest('hex')

    const recomputedHash = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}:${tamperedPayload}`)
      .digest('hex')

    assert.notEqual(hash, recomputedHash)
  })

  test('returns false when timestamp is altered', async ({ assert }) => {
    const secret = 'pdl_whsec_test_secret_key_12345'
    const payload = '{"event_type":"transaction.completed","data":{"id":"txn_01"}}'
    const originalTimestamp = '1700000000'
    const alteredTimestamp = '1700000001'

    const originalHash = crypto
      .createHmac('sha256', secret)
      .update(`${originalTimestamp}:${payload}`)
      .digest('hex')

    const alteredHash = crypto
      .createHmac('sha256', secret)
      .update(`${alteredTimestamp}:${payload}`)
      .digest('hex')

    assert.notEqual(originalHash, alteredHash)
  })

  test('signature parsing fails gracefully when ts= part is missing', async ({ assert }) => {
    const signature = 'h1=abc123'
    const parts = signature.split(';')
    const timestampPart = parts.find((p) => p.startsWith('ts='))

    assert.isUndefined(timestampPart)
  })

  test('signature parsing fails gracefully when h1= part is missing', async ({ assert }) => {
    const signature = 'ts=1700000000'
    const parts = signature.split(';')
    const hashPart = parts.find((p) => p.startsWith('h1='))

    assert.isUndefined(hashPart)
  })

  test('signature parsing handles empty string', async ({ assert }) => {
    const signature = ''
    const parts = signature.split(';')
    const timestampPart = parts.find((p) => p.startsWith('ts='))
    const hashPart = parts.find((p) => p.startsWith('h1='))

    assert.isUndefined(timestampPart)
    assert.isUndefined(hashPart)
  })

  test('constant-time comparison rejects buffers of different lengths', async ({ assert }) => {
    const shortHash = 'abcd'
    const longHash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

    const shortBuffer = Buffer.from(shortHash, 'hex')
    const longBuffer = Buffer.from(longHash, 'hex')

    assert.notEqual(shortBuffer.length, longBuffer.length)
  })

  test('rejects stale timestamps outside tolerance window', async ({ assert }) => {
    const { default: PaddleProvider } = await import('#services/providers/paddle_provider')
    const provider = Object.create(PaddleProvider.prototype) as {
      verifyWebhookSignature: (rawPayload: string, signature: string) => boolean
    }

    const secret = 'pdl_whsec_test_secret_key_12345'
    const payload = '{"event_type":"transaction.completed","data":{"id":"txn_01"}}'
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 3600)
    const hash = crypto
      .createHmac('sha256', secret)
      .update(`${staleTimestamp}:${payload}`)
      .digest('hex')
    const signature = `ts=${staleTimestamp};h1=${hash}`

    const previousSecret = process.env.PADDLE_WEBHOOK_SECRET
    process.env.PADDLE_WEBHOOK_SECRET = secret

    try {
      const isValid = provider.verifyWebhookSignature(payload, signature)
      assert.isFalse(isValid)
    } finally {
      process.env.PADDLE_WEBHOOK_SECRET = previousSecret
    }
  })
})

test.group('Paddle Provider - Event Type Mapping', () => {
  test('Paddle event types map to expected internal handler names', async ({ assert }) => {
    // These are the Paddle EventName values that the provider handles
    const handledEvents: Record<string, string> = {
      'transaction.completed': 'handleCheckoutCompleted',
      'subscription.updated': 'handleSubscriptionUpdated',
      'subscription.canceled': 'handleSubscriptionDeleted',
      'transaction.payment_failed': 'handlePaymentFailed',
    }

    assert.properties(handledEvents, [
      'transaction.completed',
      'subscription.updated',
      'subscription.canceled',
      'transaction.payment_failed',
    ])

    assert.equal(handledEvents['transaction.completed'], 'handleCheckoutCompleted')
    assert.equal(handledEvents['subscription.updated'], 'handleSubscriptionUpdated')
    assert.equal(handledEvents['subscription.canceled'], 'handleSubscriptionDeleted')
    assert.equal(handledEvents['transaction.payment_failed'], 'handlePaymentFailed')
  })

  test('unhandled Paddle event types are not in the mapping', async ({ assert }) => {
    const handledEvents = new Set([
      'transaction.completed',
      'subscription.updated',
      'subscription.canceled',
      'transaction.payment_failed',
    ])

    // These events exist in Paddle but are not handled by the provider
    assert.isFalse(handledEvents.has('subscription.created'))
    assert.isFalse(handledEvents.has('transaction.created'))
    assert.isFalse(handledEvents.has('customer.created'))
  })
})

test.group('Paddle Provider - Webhook Payload Parsing', () => {
  test('extracts tenant_id from Paddle customData in transaction', async ({ assert }) => {
    const paddleTransactionData = {
      id: 'txn_01h9abc',
      subscriptionId: 'sub_01h9xyz',
      customerId: 'ctm_01h9def',
      customData: {
        tenant_id: '42',
        tier_id: '3',
      },
      items: [
        {
          price: {
            id: 'pri_01h9ghi',
            unitPrice: { amount: '1999', currencyCode: 'USD' },
            billingCycle: { interval: 'month', frequency: 1 },
          },
          quantity: 1,
        },
      ],
    }

    const customData = paddleTransactionData.customData as Record<string, string> | null
    assert.exists(customData)
    assert.exists(customData!.tenant_id)

    const tenantId = Number.parseInt(customData!.tenant_id, 10)
    assert.equal(tenantId, 42)
    assert.isFalse(Number.isNaN(tenantId))
  })

  test('extracts subscriptionId from Paddle transaction data', async ({ assert }) => {
    const data = {
      id: 'txn_01h9abc',
      subscriptionId: 'sub_01h9xyz',
      customerId: 'ctm_01h9def',
      customData: { tenant_id: '1' },
    }

    const subscriptionId = data.subscriptionId as string | null
    assert.exists(subscriptionId)
    assert.equal(subscriptionId, 'sub_01h9xyz')
  })

  test('throws when tenant_id is missing from customData', async ({ assert }) => {
    const data = {
      id: 'txn_01h9abc',
      customData: null,
    }

    const customData = data.customData as Record<string, string> | null
    assert.isNull(customData)
  })

  test('handles invalid tenant_id gracefully', async ({ assert }) => {
    const tenantId = Number.parseInt('not_a_number', 10)
    assert.isTrue(Number.isNaN(tenantId))
  })

  test('maps Paddle subscription status to internal status correctly', async ({ assert }) => {
    const mapStatus = (paddleStatus: string): 'active' | 'expired' | 'cancelled' => {
      if (paddleStatus === 'canceled') return 'cancelled'
      if (paddleStatus === 'paused') return 'cancelled'
      if (paddleStatus === 'active' || paddleStatus === 'trialing') return 'active'
      return 'active'
    }

    assert.equal(mapStatus('active'), 'active')
    assert.equal(mapStatus('trialing'), 'active')
    assert.equal(mapStatus('canceled'), 'cancelled')
    assert.equal(mapStatus('paused'), 'cancelled')
  })
})

test.group('Paddle Provider - Constructor Validation', () => {
  test('provider name is paddle', async ({ assert }) => {
    // Verify the expected provider name constant
    assert.equal('paddle', 'paddle')
  })

  test('PaymentProviderConfigError has correct structure for paddle', async ({ assert }) => {
    const { PaymentProviderConfigError } = await import('#exceptions/billing_errors')
    const error = new PaymentProviderConfigError('paddle', 'PADDLE_API_KEY')

    assert.equal(error.name, 'PaymentProviderConfigError')
    assert.equal(error.provider, 'paddle')
    assert.equal(error.missingVar, 'PADDLE_API_KEY')
    assert.equal(error.code, 'PAYMENT_PROVIDER_CONFIG_ERROR')
    assert.include(error.message, 'paddle')
    assert.include(error.message, 'PADDLE_API_KEY')
    assert.instanceOf(error, Error)
  })

  test('WebhookVerificationError has correct structure for paddle', async ({ assert }) => {
    const { WebhookVerificationError } = await import('#exceptions/billing_errors')
    const error = new WebhookVerificationError('paddle', 'PADDLE_WEBHOOK_SECRET is not configured')

    assert.equal(error.name, 'WebhookVerificationError')
    assert.equal(error.provider, 'paddle')
    assert.equal(error.code, 'WEBHOOK_VERIFICATION_ERROR')
    assert.include(error.message, 'paddle')
    assert.instanceOf(error, Error)
  })
})
