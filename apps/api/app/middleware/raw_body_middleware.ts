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
 * Raw body middleware captures the raw request body before it's parsed.
 * This is required for webhook signature verification.
 *
 * The raw body is stored in ctx.request.rawBody
 */
export default class RawBodyMiddleware {
  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    const request = ctx.request

    // Get the raw body from the request
    // AdonisJS stores the raw body internally, we can access it via the underlying request
    const rawBody = await this.getRawBody(request.request)

    // Store raw body on request object
    request.rawBody = rawBody

    return next()
  }

  /**
   * Read raw body from incoming request
   */
  private getRawBody(request: import('node:http').IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []

      // Check if body was already consumed
      if (request.readableEnded) {
        // Body already read - try to get from internal buffer if available
        resolve('')
        return
      }

      request.on('data', (chunk: Buffer) => {
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
