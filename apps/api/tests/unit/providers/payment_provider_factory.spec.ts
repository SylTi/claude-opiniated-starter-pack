import { test } from '@japa/runner'

/**
 * Unit tests for the payment provider factory.
 *
 * The factory dynamically imports and instantiates payment providers
 * based on the PAYMENT_PROVIDER env var or an explicit name argument.
 *
 * In the test environment:
 *   - STRIPE_SECRET_KEY is set (via .env.test) so Stripe constructor succeeds
 *   - PADDLE_API_KEY, LEMONSQUEEZY_API_KEY, POLAR_ACCESS_TOKEN are NOT set,
 *     so their constructors throw PaymentProviderConfigError
 */

test.group('Payment Provider Factory - Stripe (configured)', () => {
  test('createPaymentProvider returns StripeProvider for "stripe"', async ({ assert }) => {
    const { createPaymentProvider } = await import('#services/providers/payment_provider_factory')
    const provider = await createPaymentProvider('stripe')

    assert.equal(provider.name, 'stripe')
  })

  test('default provider is stripe when no name is passed', async ({ assert }) => {
    const { createPaymentProvider } = await import('#services/providers/payment_provider_factory')
    const provider = await createPaymentProvider()

    assert.equal(provider.name, 'stripe')
  })

  test('StripeProvider implements the PaymentProvider interface', async ({ assert }) => {
    const { createPaymentProvider } = await import('#services/providers/payment_provider_factory')
    const provider = await createPaymentProvider('stripe')

    assert.isFunction(provider.createCheckoutSession)
    assert.isFunction(provider.createCustomerPortalSession)
    assert.isFunction(provider.handleWebhook)
    assert.isFunction(provider.verifyWebhookSignature)
    assert.isFunction(provider.cancelSubscription)
    assert.property(provider, 'name')
  })
})

test.group('Payment Provider Factory - Unconfigured Providers', () => {
  test('createPaymentProvider throws PaymentProviderConfigError for unconfigured paddle', async ({
    assert,
  }) => {
    const { createPaymentProvider } = await import('#services/providers/payment_provider_factory')

    try {
      await createPaymentProvider('paddle')
      assert.fail('Should have thrown PaymentProviderConfigError')
    } catch (error) {
      assert.equal((error as Error).name, 'PaymentProviderConfigError')
      assert.equal((error as Record<string, unknown>).provider, 'paddle')
      assert.equal((error as Record<string, unknown>).missingVar, 'PADDLE_API_KEY')
      assert.include((error as Error).message, 'paddle')
      assert.include((error as Error).message, 'PADDLE_API_KEY')
    }
  })

  test('createPaymentProvider throws PaymentProviderConfigError for unconfigured lemonsqueezy', async ({
    assert,
  }) => {
    const { createPaymentProvider } = await import('#services/providers/payment_provider_factory')

    try {
      await createPaymentProvider('lemonsqueezy')
      assert.fail('Should have thrown PaymentProviderConfigError')
    } catch (error) {
      assert.equal((error as Error).name, 'PaymentProviderConfigError')
      assert.equal((error as Record<string, unknown>).provider, 'lemonsqueezy')
      assert.equal((error as Record<string, unknown>).missingVar, 'LEMONSQUEEZY_API_KEY')
      assert.include((error as Error).message, 'lemonsqueezy')
      assert.include((error as Error).message, 'LEMONSQUEEZY_API_KEY')
    }
  })

  test('createPaymentProvider throws PaymentProviderConfigError for unconfigured polar', async ({
    assert,
  }) => {
    const { createPaymentProvider } = await import('#services/providers/payment_provider_factory')

    try {
      await createPaymentProvider('polar')
      assert.fail('Should have thrown PaymentProviderConfigError')
    } catch (error) {
      assert.equal((error as Error).name, 'PaymentProviderConfigError')
      assert.equal((error as Record<string, unknown>).provider, 'polar')
      assert.equal((error as Record<string, unknown>).missingVar, 'POLAR_ACCESS_TOKEN')
      assert.include((error as Error).message, 'polar')
      assert.include((error as Error).message, 'POLAR_ACCESS_TOKEN')
    }
  })
})

test.group('Payment Provider Factory - Unknown Provider', () => {
  test('createPaymentProvider throws Error for unknown provider name', async ({ assert }) => {
    const { createPaymentProvider } = await import('#services/providers/payment_provider_factory')

    try {
      await createPaymentProvider('unknown' as 'stripe')
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.include((error as Error).message, 'Unknown payment provider')
      assert.include((error as Error).message, 'unknown')
    }
  })

  test('createPaymentProvider throws Error for empty string provider name', async ({ assert }) => {
    const { createPaymentProvider } = await import('#services/providers/payment_provider_factory')

    try {
      await createPaymentProvider('' as 'stripe')
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.include((error as Error).message, 'Unknown payment provider')
    }
  })
})

test.group('Payment Provider Factory - Error Type Guards', () => {
  test('isPaymentProviderConfigError correctly identifies PaymentProviderConfigError', async ({
    assert,
  }) => {
    const { PaymentProviderConfigError, isPaymentProviderConfigError } =
      await import('#exceptions/billing_errors')

    const configError = new PaymentProviderConfigError('paddle', 'PADDLE_API_KEY')
    const genericError = new Error('something went wrong')

    assert.isTrue(isPaymentProviderConfigError(configError))
    assert.isFalse(isPaymentProviderConfigError(genericError))
    assert.isFalse(isPaymentProviderConfigError(null))
    assert.isFalse(isPaymentProviderConfigError(undefined))
    assert.isFalse(isPaymentProviderConfigError('string error'))
  })

  test('isWebhookVerificationError correctly identifies WebhookVerificationError', async ({
    assert,
  }) => {
    const { WebhookVerificationError, isWebhookVerificationError } =
      await import('#exceptions/billing_errors')

    const webhookError = new WebhookVerificationError('paddle', 'Invalid signature')
    const genericError = new Error('something went wrong')

    assert.isTrue(isWebhookVerificationError(webhookError))
    assert.isFalse(isWebhookVerificationError(genericError))
    assert.isFalse(isWebhookVerificationError(null))
    assert.isFalse(isWebhookVerificationError(undefined))
  })
})
