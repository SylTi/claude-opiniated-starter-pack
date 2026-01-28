import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Extends the request to include rawBody property
 */
declare module '@adonisjs/core/http' {
  interface Request {
    rawBody?: string
  }
}

/**
 * Webhook Raw Body Middleware
 *
 * Server-level middleware that captures the raw request body BEFORE bodyparser runs.
 * This is required for webhook signature verification (e.g., Stripe webhooks).
 *
 * Only captures raw body for webhook routes to avoid memory overhead on other routes.
 *
 * Security: Enforces a maximum body size to prevent DoS attacks via large payloads.
 */
export default class WebhookRawBodyMiddleware {
  /**
   * Routes that need raw body capture (matched by prefix)
   */
  private readonly webhookPrefixes = ['/api/v1/webhooks/']

  /**
   * Maximum allowed body size in bytes (1MB)
   * Stripe webhooks are typically < 64KB, so 1MB is generous
   */
  private readonly maxBodySize = 1024 * 1024

  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    const { request, response } = ctx
    const url = request.url()

    // Only capture raw body for webhook routes
    const isWebhookRoute = this.webhookPrefixes.some((prefix) => url.startsWith(prefix))

    if (isWebhookRoute) {
      try {
        request.rawBody = await this.captureRawBody(request.request)
      } catch (error) {
        if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') {
          return response.status(413).json({
            error: 'PayloadTooLarge',
            message: 'Request body exceeds maximum allowed size',
          })
        }
        throw error
      }
    }

    return next()
  }

  /**
   * Capture raw body from incoming request stream
   * Must be called before bodyparser consumes the stream
   *
   * @throws Error with message 'PAYLOAD_TOO_LARGE' if body exceeds maxBodySize
   */
  private captureRawBody(request: import('node:http').IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      let totalSize = 0

      request.on('data', (chunk: Buffer) => {
        totalSize += chunk.length

        // Check size limit to prevent memory exhaustion
        if (totalSize > this.maxBodySize) {
          request.destroy()
          reject(new Error('PAYLOAD_TOO_LARGE'))
          return
        }

        chunks.push(chunk)
      })

      request.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8')
        resolve(rawBody)
      })

      request.on('error', (err) => {
        reject(err)
      })
    })
  }
}
