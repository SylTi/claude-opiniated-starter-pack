/*
|--------------------------------------------------------------------------
| HTTP kernel file
|--------------------------------------------------------------------------
|
| The HTTP kernel file is used to register the middleware with the server
| or the router.
|
*/

import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'
import { createRbacMiddleware } from '#middleware/rbac_middleware'
import type { TenantAction } from '#constants/permissions'

/**
 * The error handler is used to convert an exception
 * to an HTTP response.
 */
server.errorHandler(() => import('#exceptions/handler'))

/**
 * The server middleware stack runs middleware on all the HTTP
 * requests, even if there is no route registered for
 * the request URL.
 */
server.use([
  () => import('#middleware/security_headers_middleware'),
  () => import('#middleware/container_bindings_middleware'),
  () => import('#middleware/force_json_response_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
])

/**
 * The router middleware stack runs middleware on all the HTTP
 * requests with a registered route.
 */
router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/session/session_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
  () => import('#middleware/initialize_bouncer_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
])

/**
 * Named middleware collection must be explicitly assigned to
 * the routes or the routes group.
 */
export const middleware = router.named({
  guest: () => import('#middleware/guest_middleware'),
  auth: () => import('#middleware/auth_middleware'),
  admin: () => import('#middleware/admin_middleware'),
  rawBody: () => import('#middleware/raw_body_middleware'),
  tenant: () => import('#middleware/tenant_context_middleware'),
})

/**
 * RBAC middleware factory for route-level authorization.
 *
 * @param actions - One or more actions required for the route
 * @returns Middleware class to use with .use()
 *
 * @example
 * ```typescript
 * import { rbac } from '#start/kernel'
 * import { ACTIONS } from '#constants/permissions'
 *
 * router.put('/:id', [Controller, 'update']).use(rbac(ACTIONS.TENANT_UPDATE))
 * router.delete('/:id', [Controller, 'destroy']).use(rbac(ACTIONS.TENANT_DELETE))
 * ```
 */
export function rbac(...actions: TenantAction[]) {
  return createRbacMiddleware(...actions)
}
