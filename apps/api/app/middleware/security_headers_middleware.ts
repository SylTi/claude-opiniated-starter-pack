import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import app from '@adonisjs/core/services/app'

/**
 * Security headers middleware
 *
 * Adds essential security headers to all HTTP responses.
 * For more comprehensive protection (CSRF tokens, CSP), consider installing @adonisjs/shield.
 */
export default class SecurityHeadersMiddleware {
  async handle({ response }: HttpContext, next: NextFn): Promise<void> {
    // Prevent MIME type sniffing
    response.header('X-Content-Type-Options', 'nosniff')

    // Prevent clickjacking
    response.header('X-Frame-Options', 'DENY')

    // Enable browser XSS filter (legacy, but still useful)
    response.header('X-XSS-Protection', '1; mode=block')

    // Control referrer information
    response.header('Referrer-Policy', 'strict-origin-when-cross-origin')

    // Restrict browser features
    response.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

    // Prevent DNS prefetching
    response.header('X-DNS-Prefetch-Control', 'off')

    // Prevent IE from executing downloads in site's context
    response.header('X-Download-Options', 'noopen')

    // Disable client-side caching for API responses (sensitive data)
    response.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.header('Pragma', 'no-cache')
    response.header('Expires', '0')

    // Content Security Policy - strict for API (no scripts, no frames)
    response.header(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    )

    // HTTP Strict Transport Security - production only
    // Forces HTTPS for 1 year, includes subdomains
    if (app.inProduction) {
      response.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    }

    await next()
  }
}
