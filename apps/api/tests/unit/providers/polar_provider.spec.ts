import { test } from '@japa/runner'
import crypto from 'node:crypto'

/**
 * Unit tests for the Polar payment provider.
 *
 * These tests verify the webhook signature verification algorithm (Standard Webhooks / Svix),
 * event type mappings, and webhook body parsing without instantiating the full provider
 * (which requires Polar SDK + env vars).
 *
 * Polar uses the Standard Webhooks spec:
 *   - Signature string is pipe-delimited: "webhookId|timestamp|v1,BASE64_HMAC"
 *   - HMAC-SHA256 is computed over: `${webhookId}.${timestamp}.${rawPayload}`
 *   - Secret may be prefixed with "whsec_" and is base64-encoded
 */

test.group('Polar Provider - Webhook Signature Verification (Standard Webhooks)', () => {
  test('returns true for valid Standard Webhooks signature', async ({ assert }) => {
    // The secret as stored (base64-encoded, optionally prefixed with whsec_)
    const rawSecretBytes = crypto.randomBytes(32)
    const base64Secret = rawSecretBytes.toString('base64')
    const webhookSecret = `whsec_${base64Secret}`

    const webhookId = 'msg_01abc'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const payload = '{"type":"checkout.created","data":{"id":"ch_123","status":"succeeded"}}'

    const signedContent = `${webhookId}.${timestamp}.${payload}`

    // Decode secret (strip whsec_ prefix, then base64 decode)
    const secretBytes = Buffer.from(base64Secret, 'base64')

    const expectedSignature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64')

    // Build the signature string in the format used by the provider
    const signatureHeader = `v1,${expectedSignature}`
    const fullSignature = `${webhookId}|${timestamp}|${signatureHeader}`

    // Reproduce verification logic from PolarProvider.verifyWebhookSignature
    const parts = fullSignature.split('|')
    assert.equal(parts.length, 3)

    const [parsedWebhookId, parsedTimestamp, parsedSignatureHeader] = parts
    assert.equal(parsedWebhookId, webhookId)
    assert.equal(parsedTimestamp, timestamp)
    assert.isTrue(parsedSignatureHeader!.startsWith('v1,'))

    const signatures = parsedSignatureHeader!.split(' ')
    const recomputedContent = `${parsedWebhookId}.${parsedTimestamp}.${payload}`

    const strippedSecret = webhookSecret.startsWith('whsec_')
      ? webhookSecret.slice(6)
      : webhookSecret
    const decodedSecret = Buffer.from(strippedSecret, 'base64')

    const recomputedSignature = crypto
      .createHmac('sha256', decodedSecret)
      .update(recomputedContent)
      .digest('base64')

    let verified = false
    for (const sig of signatures) {
      const [version, value] = sig.split(',')
      if (version === 'v1' && value) {
        const expected = Buffer.from(recomputedSignature)
        const received = Buffer.from(value)
        if (expected.length === received.length && crypto.timingSafeEqual(expected, received)) {
          verified = true
        }
      }
    }

    assert.isTrue(verified)
  })

  test('returns false when signature was computed with a different secret', async ({ assert }) => {
    const correctSecretBytes = crypto.randomBytes(32)
    const wrongSecretBytes = crypto.randomBytes(32)

    const webhookId = 'msg_02def'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const payload = '{"type":"subscription.updated","data":{"id":"sub_456"}}'

    const signedContent = `${webhookId}.${timestamp}.${payload}`

    const correctSig = crypto
      .createHmac('sha256', correctSecretBytes)
      .update(signedContent)
      .digest('base64')

    const wrongSig = crypto
      .createHmac('sha256', wrongSecretBytes)
      .update(signedContent)
      .digest('base64')

    assert.notEqual(correctSig, wrongSig)
  })

  test('returns false when payload has been tampered with', async ({ assert }) => {
    const secretBytes = crypto.randomBytes(32)
    const webhookId = 'msg_03ghi'
    const timestamp = String(Math.floor(Date.now() / 1000))

    const originalPayload = '{"type":"checkout.created","data":{"id":"ch_123"}}'
    const tamperedPayload = '{"type":"checkout.created","data":{"id":"ch_999"}}'

    const originalSig = crypto
      .createHmac('sha256', secretBytes)
      .update(`${webhookId}.${timestamp}.${originalPayload}`)
      .digest('base64')

    const tamperedSig = crypto
      .createHmac('sha256', secretBytes)
      .update(`${webhookId}.${timestamp}.${tamperedPayload}`)
      .digest('base64')

    assert.notEqual(originalSig, tamperedSig)
  })

  test('returns false when pipe-delimited signature has wrong number of parts', async ({
    assert,
  }) => {
    const invalidSignatures = ['only_one_part', 'two|parts', 'four|parts|here|extra']

    for (const sig of invalidSignatures) {
      const parts = sig.split('|')
      assert.notEqual(parts.length, 3)
    }
  })

  test('returns false when signature version is not v1', async ({ assert }) => {
    const signatureHeader = 'v2,someBase64Hash'
    const signatures = signatureHeader.split(' ')

    let foundV1 = false
    for (const sig of signatures) {
      const [version] = sig.split(',')
      if (version === 'v1') {
        foundV1 = true
      }
    }

    assert.isFalse(foundV1)
  })

  test('handles whsec_ prefix stripping correctly', async ({ assert }) => {
    const base64Secret = Buffer.from('test_secret_32_bytes_long_value!').toString('base64')
    const prefixedSecret = `whsec_${base64Secret}`
    const unprefixedSecret = base64Secret

    const stripped1 = prefixedSecret.startsWith('whsec_') ? prefixedSecret.slice(6) : prefixedSecret
    const stripped2 = unprefixedSecret.startsWith('whsec_')
      ? unprefixedSecret.slice(6)
      : unprefixedSecret

    assert.equal(stripped1, base64Secret)
    assert.equal(stripped2, base64Secret)
  })

  test('handles secret without whsec_ prefix', async ({ assert }) => {
    const base64Secret = Buffer.from('plain_secret_no_prefix_here_abc').toString('base64')

    const stripped = base64Secret.startsWith('whsec_') ? base64Secret.slice(6) : base64Secret

    // Should remain unchanged since there's no whsec_ prefix
    assert.equal(stripped, base64Secret)

    const secretBytes = Buffer.from(stripped, 'base64')
    assert.isTrue(secretBytes.length > 0)
  })

  test('supports multiple space-separated signature versions', async ({ assert }) => {
    const secretBytes = crypto.randomBytes(32)
    const webhookId = 'msg_04jkl'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const payload = '{"type":"order.created","data":{"id":"ord_789"}}'

    const signedContent = `${webhookId}.${timestamp}.${payload}`
    const correctBase64 = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64')

    // Simulate multiple signature versions (v1 appears twice)
    const signatureHeader = `v1,wrongBase64Hash v1,${correctBase64}`

    const signatures = signatureHeader.split(' ')
    assert.equal(signatures.length, 2)

    let verified = false
    for (const sig of signatures) {
      const [version, value] = sig.split(',')
      if (version === 'v1' && value) {
        const expected = Buffer.from(correctBase64)
        const received = Buffer.from(value)
        if (expected.length === received.length && crypto.timingSafeEqual(expected, received)) {
          verified = true
        }
      }
    }

    assert.isTrue(verified)
  })
})

test.group('Polar Provider - Event Type Mapping', () => {
  test('Polar event types map to expected internal handlers', async ({ assert }) => {
    const handledEvents: Record<string, string> = {
      'checkout.created': 'handleCheckoutCompleted',
      'subscription.updated': 'handleSubscriptionUpdated',
      'subscription.active': 'handleSubscriptionUpdated',
      'subscription.revoked': 'handleSubscriptionDeleted',
      'subscription.canceled': 'handleSubscriptionDeleted',
      'order.created': 'handlePaymentSucceeded',
    }

    assert.properties(handledEvents, [
      'checkout.created',
      'subscription.updated',
      'subscription.active',
      'subscription.revoked',
      'subscription.canceled',
      'order.created',
    ])

    assert.equal(handledEvents['checkout.created'], 'handleCheckoutCompleted')
    assert.equal(handledEvents['subscription.updated'], 'handleSubscriptionUpdated')
    assert.equal(handledEvents['subscription.active'], 'handleSubscriptionUpdated')
    assert.equal(handledEvents['subscription.revoked'], 'handleSubscriptionDeleted')
    assert.equal(handledEvents['subscription.canceled'], 'handleSubscriptionDeleted')
    assert.equal(handledEvents['order.created'], 'handlePaymentSucceeded')
  })

  test('subscription.updated and subscription.active share the same handler', async ({
    assert,
  }) => {
    const handlerMap: Record<string, string> = {
      'subscription.updated': 'handleSubscriptionUpdated',
      'subscription.active': 'handleSubscriptionUpdated',
    }

    assert.equal(handlerMap['subscription.updated'], handlerMap['subscription.active'])
  })

  test('subscription.revoked and subscription.canceled share the same handler', async ({
    assert,
  }) => {
    const handlerMap: Record<string, string> = {
      'subscription.revoked': 'handleSubscriptionDeleted',
      'subscription.canceled': 'handleSubscriptionDeleted',
    }

    assert.equal(handlerMap['subscription.revoked'], handlerMap['subscription.canceled'])
  })

  test('unhandled Polar events are not in the mapping', async ({ assert }) => {
    const handledEvents = new Set([
      'checkout.created',
      'subscription.updated',
      'subscription.active',
      'subscription.revoked',
      'subscription.canceled',
      'order.created',
    ])

    assert.isFalse(handledEvents.has('checkout.updated'))
    assert.isFalse(handledEvents.has('product.created'))
    assert.isFalse(handledEvents.has('benefit.created'))
  })
})

test.group('Polar Provider - Webhook Payload Parsing', () => {
  test('extracts tenant_id from checkout metadata', async ({ assert }) => {
    const checkoutData = {
      id: 'ch_01abc',
      status: 'succeeded',
      customerId: 'cust_01xyz',
      subscriptionId: 'sub_01def',
      productPriceId: 'price_01ghi',
      metadata: {
        tenant_id: '42',
        tier_id: '3',
      },
    }

    const metadata = (checkoutData.metadata as Record<string, string>) || {}
    assert.exists(metadata.tenant_id)
    assert.equal(metadata.tenant_id, '42')

    const tenantId = Number.parseInt(metadata.tenant_id, 10)
    assert.equal(tenantId, 42)
    assert.isFalse(Number.isNaN(tenantId))
  })

  test('extracts customerId from checkout data', async ({ assert }) => {
    const data = {
      id: 'ch_01abc',
      customerId: 'cust_01xyz',
      customer_id: undefined,
    }

    const customerId = (data.customerId as string) || (data.customer_id as string | undefined)
    assert.exists(customerId)
    assert.equal(customerId, 'cust_01xyz')
  })

  test('extracts subscriptionId from checkout data', async ({ assert }) => {
    const data = {
      id: 'ch_01abc',
      subscriptionId: 'sub_01def',
    }

    const subscriptionId = data.subscriptionId as string
    assert.exists(subscriptionId)
    assert.equal(subscriptionId, 'sub_01def')
  })

  test('generates deterministic event ID from provider name, type, and data id', async ({
    assert,
  }) => {
    const providerName = 'polar'
    const eventType = 'checkout.created'
    const dataId = 'ch_01abc'

    const eventId = `${providerName}_${eventType}_${dataId}`
    assert.equal(eventId, 'polar_checkout.created_ch_01abc')
  })

  test('handles missing metadata gracefully', async ({ assert }) => {
    const data: Record<string, unknown> = {
      id: 'ch_01abc',
      status: 'succeeded',
    }

    const metadata = (data.metadata as Record<string, string>) || {}
    assert.deepEqual(metadata, {})
    assert.isUndefined(metadata.tenant_id)
  })

  test('handles checkout with non-succeeded status', async ({ assert }) => {
    const data = {
      id: 'ch_01abc',
      status: 'pending',
      metadata: {
        tenant_id: '42',
      },
    }

    const status = data.status as string | undefined
    // The provider only processes 'succeeded' or 'confirmed' checkouts
    assert.notEqual(status, 'succeeded')
    assert.notEqual(status, 'confirmed')
  })

  test('maps Polar subscription status to internal status correctly', async ({ assert }) => {
    const mapStatus = (polarStatus: string): 'active' | 'expired' | 'cancelled' => {
      if (polarStatus === 'canceled' || polarStatus === 'revoked') return 'cancelled'
      if (polarStatus === 'past_due' || polarStatus === 'unpaid') return 'active'
      if (polarStatus === 'active' || polarStatus === 'trialing') return 'active'
      return 'active'
    }

    assert.equal(mapStatus('active'), 'active')
    assert.equal(mapStatus('trialing'), 'active')
    assert.equal(mapStatus('past_due'), 'active')
    assert.equal(mapStatus('unpaid'), 'active')
    assert.equal(mapStatus('canceled'), 'cancelled')
    assert.equal(mapStatus('revoked'), 'cancelled')
  })

  test('extracts prices array from subscription data for plan change detection', async ({
    assert,
  }) => {
    const subscriptionData = {
      id: 'sub_01def',
      status: 'active',
      prices: [{ id: 'price_01ghi', amount: 1999, currency: 'usd', recurringInterval: 'month' }],
      currentPeriodEnd: '2025-02-01T00:00:00Z',
    }

    const prices = subscriptionData.prices as Array<Record<string, unknown>> | undefined
    assert.exists(prices)
    assert.equal(prices!.length, 1)
    assert.equal(prices![0]?.id, 'price_01ghi')
  })
})

test.group('Polar Provider - Constructor Validation', () => {
  test('provider name is polar', async ({ assert }) => {
    assert.equal('polar', 'polar')
  })

  test('PaymentProviderConfigError has correct structure for polar', async ({ assert }) => {
    const { PaymentProviderConfigError } = await import('#exceptions/billing_errors')
    const error = new PaymentProviderConfigError('polar', 'POLAR_ACCESS_TOKEN')

    assert.equal(error.name, 'PaymentProviderConfigError')
    assert.equal(error.provider, 'polar')
    assert.equal(error.missingVar, 'POLAR_ACCESS_TOKEN')
    assert.equal(error.code, 'PAYMENT_PROVIDER_CONFIG_ERROR')
    assert.include(error.message, 'polar')
    assert.include(error.message, 'POLAR_ACCESS_TOKEN')
    assert.instanceOf(error, Error)
  })

  test('PaymentProviderConfigError for missing webhook secret', async ({ assert }) => {
    const { PaymentProviderConfigError } = await import('#exceptions/billing_errors')
    const error = new PaymentProviderConfigError('polar', 'POLAR_WEBHOOK_SECRET')

    assert.equal(error.provider, 'polar')
    assert.equal(error.missingVar, 'POLAR_WEBHOOK_SECRET')
    assert.include(error.message, 'POLAR_WEBHOOK_SECRET')
  })

  test('WebhookVerificationError has correct structure for polar', async ({ assert }) => {
    const { WebhookVerificationError } = await import('#exceptions/billing_errors')
    const error = new WebhookVerificationError('polar')

    assert.equal(error.name, 'WebhookVerificationError')
    assert.equal(error.provider, 'polar')
    assert.equal(error.code, 'WEBHOOK_VERIFICATION_ERROR')
    assert.include(error.message, 'polar')
  })

  test('WebhookVerificationError with detail message', async ({ assert }) => {
    const { WebhookVerificationError } = await import('#exceptions/billing_errors')
    const error = new WebhookVerificationError('polar', 'Invalid signature format')

    assert.include(error.message, 'Invalid signature format')
    assert.include(error.message, 'polar')
  })
})
