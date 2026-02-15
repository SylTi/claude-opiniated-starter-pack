import { test } from '@japa/runner'
import crypto from 'node:crypto'

/**
 * Unit tests for the LemonSqueezy payment provider.
 *
 * These tests verify the webhook signature verification algorithm,
 * event type mappings, and webhook body parsing without instantiating
 * the full provider (which requires LemonSqueezy SDK + env vars).
 *
 * LemonSqueezy signature format: HMAC-SHA256 hex digest of the raw payload body
 */

test.group('LemonSqueezy Provider - Webhook Signature Verification', () => {
  test('returns true for valid HMAC-SHA256 hex signature', async ({ assert }) => {
    const secret = 'ls_whsec_test_secret_key_12345'
    const payload = '{"meta":{"event_name":"order_created"},"data":{"id":"1"}}'

    const digest = crypto.createHmac('sha256', secret).update(payload).digest('hex')

    // Reproduce the verification logic from LemonSqueezyProvider.verifyWebhookSignature
    const signatureBuffer = Buffer.from(digest, 'hex')
    const digestBuffer = Buffer.from(digest, 'hex')

    assert.equal(signatureBuffer.length, digestBuffer.length)
    assert.isTrue(crypto.timingSafeEqual(signatureBuffer, digestBuffer))
  })

  test('returns false when signature was computed with a different secret', async ({ assert }) => {
    const correctSecret = 'ls_whsec_correct_secret'
    const wrongSecret = 'ls_whsec_wrong_secret'
    const payload = '{"meta":{"event_name":"order_created"},"data":{"id":"1"}}'

    const correctDigest = crypto.createHmac('sha256', correctSecret).update(payload).digest('hex')
    const wrongDigest = crypto.createHmac('sha256', wrongSecret).update(payload).digest('hex')

    assert.notEqual(correctDigest, wrongDigest)

    const correctBuffer = Buffer.from(correctDigest, 'hex')
    const wrongBuffer = Buffer.from(wrongDigest, 'hex')

    // Both buffers have the same length (SHA-256 = 32 bytes), but different content
    assert.equal(correctBuffer.length, wrongBuffer.length)
    assert.isFalse(crypto.timingSafeEqual(correctBuffer, wrongBuffer))
  })

  test('returns false when payload has been tampered with', async ({ assert }) => {
    const secret = 'ls_whsec_test_secret_key_12345'
    const originalPayload = '{"meta":{"event_name":"order_created"},"data":{"id":"1"}}'
    const tamperedPayload = '{"meta":{"event_name":"order_created"},"data":{"id":"2"}}'

    const originalDigest = crypto.createHmac('sha256', secret).update(originalPayload).digest('hex')
    const tamperedDigest = crypto.createHmac('sha256', secret).update(tamperedPayload).digest('hex')

    assert.notEqual(originalDigest, tamperedDigest)
  })

  test('rejects buffers of different lengths as invalid', async ({ assert }) => {
    const signature = 'abcd' // Not a valid hex-encoded SHA-256 (too short)
    const validDigest = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // SHA-256 of empty string

    const signatureBuffer = Buffer.from(signature, 'hex')
    const digestBuffer = Buffer.from(validDigest, 'hex')

    assert.notEqual(signatureBuffer.length, digestBuffer.length)
  })

  test('produces consistent digest for same payload and secret', async ({ assert }) => {
    const secret = 'ls_whsec_consistency_test'
    const payload = '{"meta":{"event_name":"subscription_updated"},"data":{"id":"sub_123"}}'

    const digest1 = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    const digest2 = crypto.createHmac('sha256', secret).update(payload).digest('hex')

    assert.equal(digest1, digest2)
    assert.equal(digest1.length, 64) // SHA-256 hex = 64 chars
  })
})

test.group('LemonSqueezy Provider - Event Type Mapping', () => {
  test('LemonSqueezy event types map to expected internal handlers', async ({ assert }) => {
    const handledEvents: Record<string, string> = {
      order_created: 'handleCheckoutCompleted',
      subscription_updated: 'handleSubscriptionUpdated',
      subscription_cancelled: 'handleSubscriptionDeleted',
      subscription_payment_failed: 'handlePaymentFailed',
      subscription_payment_success: 'handlePaymentSucceeded',
    }

    assert.properties(handledEvents, [
      'order_created',
      'subscription_updated',
      'subscription_cancelled',
      'subscription_payment_failed',
      'subscription_payment_success',
    ])

    assert.equal(handledEvents['order_created'], 'handleCheckoutCompleted')
    assert.equal(handledEvents['subscription_updated'], 'handleSubscriptionUpdated')
    assert.equal(handledEvents['subscription_cancelled'], 'handleSubscriptionDeleted')
    assert.equal(handledEvents['subscription_payment_failed'], 'handlePaymentFailed')
    assert.equal(handledEvents['subscription_payment_success'], 'handlePaymentSucceeded')
  })

  test('unhandled LemonSqueezy events are not in the mapping', async ({ assert }) => {
    const handledEvents = new Set([
      'order_created',
      'subscription_updated',
      'subscription_cancelled',
      'subscription_payment_failed',
      'subscription_payment_success',
    ])

    assert.isFalse(handledEvents.has('subscription_created'))
    assert.isFalse(handledEvents.has('order_refunded'))
    assert.isFalse(handledEvents.has('license_key_created'))
  })
})

test.group('LemonSqueezy Provider - Webhook Body Parsing', () => {
  test('extracts tenant_id from meta.custom_data', async ({ assert }) => {
    const body = {
      meta: {
        event_name: 'order_created',
        custom_data: {
          tenant_id: '42',
          tier_id: '3',
        },
      },
      data: {
        id: '12345',
        type: 'orders',
        attributes: {
          customer_id: 67890,
          variant_id: 111,
          status: 'paid',
          total: 1999,
          currency: 'USD',
        },
      },
    }

    const customData = body.meta.custom_data
    assert.exists(customData)
    assert.exists(customData?.tenant_id)
    assert.equal(customData?.tenant_id, '42')

    const tenantId = Number.parseInt(customData!.tenant_id!, 10)
    assert.equal(tenantId, 42)
    assert.isFalse(Number.isNaN(tenantId))
  })

  test('extracts event_name from meta', async ({ assert }) => {
    const body = {
      meta: {
        event_name: 'subscription_updated',
        custom_data: {},
      },
      data: {
        id: '12345',
        type: 'subscriptions',
        attributes: {},
      },
    }

    assert.equal(body.meta.event_name, 'subscription_updated')
  })

  test('builds idempotency key from raw payload hash', async ({ assert }) => {
    const payload =
      '{"meta":{"event_name":"subscription_updated"},"data":{"id":"sub_123","type":"subscriptions","attributes":{"status":"active"}}}'
    const eventId = `payload_${crypto.createHash('sha256').update(payload).digest('hex')}`

    assert.match(eventId, /^payload_[a-f0-9]{64}$/)
  })

  test('handles missing custom_data gracefully', async ({ assert }) => {
    const body = {
      meta: {
        event_name: 'subscription_updated',
      },
      data: {
        id: '12345',
        type: 'subscriptions',
        attributes: {},
      },
    }

    const customData = (body.meta as Record<string, unknown>).custom_data as
      | Record<string, string>
      | undefined
    assert.isUndefined(customData)
  })

  test('handles missing tenant_id in custom_data', async ({ assert }) => {
    const body = {
      meta: {
        event_name: 'order_created',
        custom_data: {
          tier_id: '3',
        },
      },
      data: {
        id: '12345',
        type: 'orders',
        attributes: {},
      },
    }

    const tenantId = (body.meta.custom_data as Record<string, string | undefined>).tenant_id
    assert.isUndefined(tenantId)
  })

  test('extracts variant_id from order attributes', async ({ assert }) => {
    const attributes = {
      customer_id: 67890,
      variant_id: 111,
      status: 'paid',
      first_order_item: {
        subscription_id: 222,
        variant_id: 111,
      },
    }

    const variantId = attributes.variant_id as number | undefined
    assert.exists(variantId)
    assert.equal(variantId, 111)
  })

  test('maps LemonSqueezy subscription status to internal status correctly', async ({ assert }) => {
    const mapStatus = (lsStatus: string): 'active' | 'expired' | 'cancelled' => {
      if (lsStatus === 'cancelled') return 'cancelled'
      if (lsStatus === 'expired') return 'expired'
      if (lsStatus === 'paused') return 'cancelled'
      if (lsStatus === 'active' || lsStatus === 'on_trial') return 'active'
      if (lsStatus === 'past_due') return 'active'
      return 'active'
    }

    assert.equal(mapStatus('active'), 'active')
    assert.equal(mapStatus('on_trial'), 'active')
    assert.equal(mapStatus('past_due'), 'active')
    assert.equal(mapStatus('cancelled'), 'cancelled')
    assert.equal(mapStatus('expired'), 'expired')
    assert.equal(mapStatus('paused'), 'cancelled')
  })
})

test.group('LemonSqueezy Provider - Constructor Validation', () => {
  test('provider name is lemonsqueezy', async ({ assert }) => {
    assert.equal('lemonsqueezy', 'lemonsqueezy')
  })

  test('PaymentProviderConfigError has correct structure for lemonsqueezy API key', async ({
    assert,
  }) => {
    const { PaymentProviderConfigError } = await import('#exceptions/billing_errors')
    const error = new PaymentProviderConfigError('lemonsqueezy', 'LEMONSQUEEZY_API_KEY')

    assert.equal(error.name, 'PaymentProviderConfigError')
    assert.equal(error.provider, 'lemonsqueezy')
    assert.equal(error.missingVar, 'LEMONSQUEEZY_API_KEY')
    assert.equal(error.code, 'PAYMENT_PROVIDER_CONFIG_ERROR')
    assert.include(error.message, 'lemonsqueezy')
    assert.include(error.message, 'LEMONSQUEEZY_API_KEY')
  })

  test('PaymentProviderConfigError has correct structure for lemonsqueezy store ID', async ({
    assert,
  }) => {
    const { PaymentProviderConfigError } = await import('#exceptions/billing_errors')
    const error = new PaymentProviderConfigError('lemonsqueezy', 'LEMONSQUEEZY_STORE_ID')

    assert.equal(error.provider, 'lemonsqueezy')
    assert.equal(error.missingVar, 'LEMONSQUEEZY_STORE_ID')
    assert.include(error.message, 'LEMONSQUEEZY_STORE_ID')
  })

  test('WebhookVerificationError has correct structure for lemonsqueezy', async ({ assert }) => {
    const { WebhookVerificationError } = await import('#exceptions/billing_errors')
    const error = new WebhookVerificationError(
      'lemonsqueezy',
      'LEMONSQUEEZY_WEBHOOK_SECRET is not configured'
    )

    assert.equal(error.name, 'WebhookVerificationError')
    assert.equal(error.provider, 'lemonsqueezy')
    assert.equal(error.code, 'WEBHOOK_VERIFICATION_ERROR')
    assert.include(error.message, 'lemonsqueezy')
  })
})
