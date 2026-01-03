/*
|--------------------------------------------------------------------------
| Rate Limiter Definitions
|--------------------------------------------------------------------------
|
| Define rate limiting rules for different routes.
| These are applied via middleware in routes.ts
|
| Rate limiting is disabled in test environment to avoid flaky tests.
|
*/

import limiter from '@adonisjs/limiter/services/main'
import env from '#start/env'

const isTestEnv = env.get('NODE_ENV') === 'test'

/**
 * Login throttle: 5 attempts per 15 minutes per IP
 * Strict to prevent brute force attacks
 * Disabled in test environment
 */
export const loginThrottle = limiter.define('login', (ctx) => {
  if (isTestEnv) {
    return limiter.allowRequests(10000).every('1 minute').usingKey('test')
  }
  return limiter.allowRequests(5).every('15 minutes').usingKey(`login_${ctx.request.ip()}`)
})

/**
 * Register throttle: 3 attempts per hour per IP
 * Prevent mass account creation
 * Disabled in test environment
 */
export const registerThrottle = limiter.define('register', (ctx) => {
  if (isTestEnv) {
    return limiter.allowRequests(10000).every('1 minute').usingKey('test')
  }
  return limiter.allowRequests(3).every('1 hour').usingKey(`register_${ctx.request.ip()}`)
})

/**
 * Forgot password throttle: 3 attempts per hour per IP
 * Prevent email bombing
 * Disabled in test environment
 */
export const forgotPasswordThrottle = limiter.define('forgotPassword', (ctx) => {
  if (isTestEnv) {
    return limiter.allowRequests(10000).every('1 minute').usingKey('test')
  }
  return limiter.allowRequests(3).every('1 hour').usingKey(`forgot_${ctx.request.ip()}`)
})

/**
 * Admin routes throttle: More generous but still protected
 * 100 requests per minute for authenticated admins
 * Disabled in test environment
 */
export const adminThrottle = limiter.define('admin', (ctx) => {
  if (isTestEnv) {
    return limiter.allowRequests(10000).every('1 minute').usingKey('test')
  }
  const userId = ctx.auth?.user?.id ?? 'anon'
  return limiter.allowRequests(100).every('1 minute').usingKey(`admin_${userId}`)
})

/**
 * API throttle: General API rate limiting
 * Different limits for authenticated vs guest users
 * Disabled in test environment
 */
export const apiThrottle = limiter.define('api', (ctx) => {
  if (isTestEnv) {
    return limiter.allowRequests(10000).every('1 minute').usingKey('test')
  }
  if (ctx.auth?.user) {
    return limiter.allowRequests(100).every('1 minute').usingKey(`api_user_${ctx.auth.user.id}`)
  }
  return limiter.allowRequests(20).every('1 minute').usingKey(`api_ip_${ctx.request.ip()}`)
})
