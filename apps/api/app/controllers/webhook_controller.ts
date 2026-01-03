import type { HttpContext } from '@adonisjs/core/http'
import PaymentService from '#services/payment_service'
import logger from '@adonisjs/core/services/logger'

export default class WebhookController {
  /**
   * Handle Stripe webhooks
   * POST /api/v1/webhooks/stripe
   */
  async handleStripe({ request, response }: HttpContext): Promise<void> {
    // Get raw body (set by RawBodyMiddleware)
    const rawBody = request.rawBody

    if (!rawBody) {
      return response.badRequest({
        error: 'InvalidPayload',
        message: 'Missing request body',
      })
    }

    // Get Stripe signature header
    const signature = request.header('stripe-signature')

    if (!signature) {
      return response.badRequest({
        error: 'InvalidSignature',
        message: 'Missing Stripe signature header',
      })
    }

    try {
      const paymentService = new PaymentService()
      const result = await paymentService.processWebhook(rawBody, signature)

      // Return 200 to acknowledge receipt
      response.json({
        received: true,
        processed: result.processed,
        eventType: result.eventType,
        message: result.message,
      })
    } catch (error) {
      // Log detailed error internally for debugging
      logger.error(
        { err: error, signature: signature?.substring(0, 20) + '...' },
        'Stripe webhook processing failed'
      )

      // Return generic error to Stripe to avoid leaking internal details
      return response.badRequest({
        error: 'WebhookError',
        message: 'Webhook processing failed',
      })
    }
  }
}
