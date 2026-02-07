import type { HttpContext } from '@adonisjs/core/http'
import PaymentService from '#services/payment_service'
import StripeProvider from '#services/providers/stripe_provider'
import logger from '@adonisjs/core/services/logger'

export default class WebhookController {
  /**
   * Handle Stripe webhooks
   * POST /api/v1/webhooks/stripe
   */
  async handleStripe({ request, response }: HttpContext): Promise<void> {
    try {
      const rawBody = request.rawBody

      if (!rawBody) {
        return response.badRequest({
          error: 'InvalidPayload',
          message: 'Missing request body',
        })
      }

      const signature = request.header('stripe-signature')

      if (!signature) {
        return response.badRequest({
          error: 'InvalidSignature',
          message: 'Missing Stripe signature header',
        })
      }

      const paymentService = new PaymentService(new StripeProvider())
      const result = await paymentService.processWebhook(rawBody, signature)

      response.json({
        data: {
          received: true,
          processed: result.processed,
          eventType: result.eventType,
        },
        message: result.message,
      })
    } catch (error) {
      logger.error(
        { err: error, signature: request.header('stripe-signature')?.substring(0, 20) + '...' },
        'Stripe webhook processing failed'
      )

      return response.badRequest({
        error: 'WebhookError',
        message: 'Webhook processing failed',
      })
    }
  }

  /**
   * Handle Paddle webhooks
   * POST /api/v1/webhooks/paddle
   */
  async handlePaddle({ request, response }: HttpContext): Promise<void> {
    try {
      const rawBody = request.rawBody

      if (!rawBody) {
        return response.badRequest({
          error: 'InvalidPayload',
          message: 'Missing request body',
        })
      }

      const signature = request.header('paddle-signature')

      if (!signature) {
        return response.badRequest({
          error: 'InvalidSignature',
          message: 'Missing Paddle signature header',
        })
      }

      const { default: PaddleProvider } = await import('#services/providers/paddle_provider')
      const paymentService = new PaymentService(new PaddleProvider())
      const result = await paymentService.processWebhook(rawBody, signature)

      response.json({
        data: {
          received: true,
          processed: result.processed,
          eventType: result.eventType,
        },
        message: result.message,
      })
    } catch (error) {
      logger.error({ err: error }, 'Paddle webhook processing failed')

      return response.badRequest({
        error: 'WebhookError',
        message: 'Webhook processing failed',
      })
    }
  }

  /**
   * Handle LemonSqueezy webhooks
   * POST /api/v1/webhooks/lemonsqueezy
   */
  async handleLemonSqueezy({ request, response }: HttpContext): Promise<void> {
    try {
      const rawBody = request.rawBody

      if (!rawBody) {
        return response.badRequest({
          error: 'InvalidPayload',
          message: 'Missing request body',
        })
      }

      const signature = request.header('x-signature')

      if (!signature) {
        return response.badRequest({
          error: 'InvalidSignature',
          message: 'Missing LemonSqueezy signature header',
        })
      }

      const { default: LemonSqueezyProvider } =
        await import('#services/providers/lemonsqueezy_provider')
      const paymentService = new PaymentService(new LemonSqueezyProvider())
      const result = await paymentService.processWebhook(rawBody, signature)

      response.json({
        data: {
          received: true,
          processed: result.processed,
          eventType: result.eventType,
        },
        message: result.message,
      })
    } catch (error) {
      logger.error({ err: error }, 'LemonSqueezy webhook processing failed')

      return response.badRequest({
        error: 'WebhookError',
        message: 'Webhook processing failed',
      })
    }
  }

  /**
   * Handle Polar webhooks
   * POST /api/v1/webhooks/polar
   */
  async handlePolar({ request, response }: HttpContext): Promise<void> {
    try {
      const rawBody = request.rawBody

      if (!rawBody) {
        return response.badRequest({
          error: 'InvalidPayload',
          message: 'Missing request body',
        })
      }

      const webhookId = request.header('webhook-id')
      const webhookTimestamp = request.header('webhook-timestamp')
      const webhookSignature = request.header('webhook-signature')

      if (!webhookSignature) {
        return response.badRequest({
          error: 'InvalidSignature',
          message: 'Missing Polar signature header',
        })
      }

      // Encode all three Standard Webhooks headers as pipe-delimited string
      // for the PaymentProvider interface that accepts a single signature param
      const signature = `${webhookId ?? ''}|${webhookTimestamp ?? ''}|${webhookSignature}`

      const { default: PolarProvider } = await import('#services/providers/polar_provider')
      const paymentService = new PaymentService(new PolarProvider())
      const result = await paymentService.processWebhook(rawBody, signature)

      response.json({
        data: {
          received: true,
          processed: result.processed,
          eventType: result.eventType,
        },
        message: result.message,
      })
    } catch (error) {
      logger.error({ err: error }, 'Polar webhook processing failed')

      return response.badRequest({
        error: 'WebhookError',
        message: 'Webhook processing failed',
      })
    }
  }
}
