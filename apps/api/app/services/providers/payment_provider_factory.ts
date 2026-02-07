import env from '#start/env'
import type { PaymentProvider } from '#services/types/payment_provider'
import type { PaymentProviderName } from '@saas/shared'

/**
 * Create a payment provider instance based on the PAYMENT_PROVIDER env var.
 * Uses dynamic imports so only the active provider's SDK is loaded.
 */
export async function createPaymentProvider(name?: PaymentProviderName): Promise<PaymentProvider> {
  const providerName = name ?? env.get('PAYMENT_PROVIDER', 'stripe')

  switch (providerName) {
    case 'stripe': {
      const { default: StripeProvider } = await import('#services/providers/stripe_provider')
      return new StripeProvider()
    }
    case 'paddle': {
      const { default: PaddleProvider } = await import('#services/providers/paddle_provider')
      return new PaddleProvider()
    }
    case 'lemonsqueezy': {
      const { default: LemonSqueezyProvider } =
        await import('#services/providers/lemonsqueezy_provider')
      return new LemonSqueezyProvider()
    }
    case 'polar': {
      const { default: PolarProvider } = await import('#services/providers/polar_provider')
      return new PolarProvider()
    }
    default:
      throw new Error(`Unknown payment provider: ${providerName as string}`)
  }
}
