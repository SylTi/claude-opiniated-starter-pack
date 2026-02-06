/**
 * Routes Registrar
 *
 * Facade for plugin route registration.
 * Enforces route namespace and applies middleware defaults.
 *
 * Plugins MUST NOT access the raw router directly.
 */

import type { HttpContext } from '@adonisjs/core/http'
import type router from '@adonisjs/core/services/router'

// Middleware collection type
type MiddlewareCollection = Awaited<typeof import('#start/kernel')>['middleware']
type MiddlewareEntry = ReturnType<MiddlewareCollection[keyof MiddlewareCollection]>
type RouteMiddleware = MiddlewareEntry

// Cache for lazily loaded middleware collection
let cachedMiddleware: MiddlewareCollection | null = null

/**
 * Lazily get the middleware collection from kernel.
 * This avoids circular dependency issues during boot.
 */
async function getMiddlewareCollection(): Promise<MiddlewareCollection> {
  if (!cachedMiddleware) {
    const kernel = await import('#start/kernel')
    cachedMiddleware = kernel.middleware
  }
  return cachedMiddleware
}

/**
 * Route handler type.
 */
export type RouteHandler = (ctx: HttpContext) => Promise<void> | void

/**
 * Route definition.
 */
export interface RouteDefinition {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  path: string
  handler: RouteHandler
  middleware?: RouteMiddleware[]
}

/**
 * Registered route info.
 */
export interface RegisteredRoute {
  pluginId: string
  method: string
  fullPath: string
  registeredAt: Date
}

/**
 * Routes Registrar for plugin route registration.
 */
export class RoutesRegistrar {
  private pluginId: string
  private router: typeof router
  private prefix: string
  private registeredRoutes: RegisteredRoute[] = []

  constructor(pluginId: string, routerInstance: typeof router, prefix?: string) {
    this.pluginId = pluginId
    this.router = routerInstance
    this.prefix = prefix || `/api/v1/apps/${pluginId}`
  }

  /**
   * Get the route prefix for this plugin.
   */
  getPrefix(): string {
    return this.prefix
  }

  /**
   * Register a GET route.
   */
  get(path: string, handler: RouteHandler, middleware?: RouteMiddleware[]): Promise<void> {
    return this.registerRoute('get', path, handler, middleware)
  }

  /**
   * Register a POST route.
   */
  post(path: string, handler: RouteHandler, middleware?: RouteMiddleware[]): Promise<void> {
    return this.registerRoute('post', path, handler, middleware)
  }

  /**
   * Register a PUT route.
   */
  put(path: string, handler: RouteHandler, middleware?: RouteMiddleware[]): Promise<void> {
    return this.registerRoute('put', path, handler, middleware)
  }

  /**
   * Register a PATCH route.
   */
  patch(path: string, handler: RouteHandler, middleware?: RouteMiddleware[]): Promise<void> {
    return this.registerRoute('patch', path, handler, middleware)
  }

  /**
   * Register a DELETE route.
   */
  delete(path: string, handler: RouteHandler, middleware?: RouteMiddleware[]): Promise<void> {
    return this.registerRoute('delete', path, handler, middleware)
  }

  /**
   * Register multiple routes at once.
   */
  async registerRoutes(routes: RouteDefinition[]): Promise<void> {
    for (const route of routes) {
      await this.registerRoute(route.method, route.path, route.handler, route.middleware)
    }
  }

  /**
   * Get all registered routes for this plugin.
   */
  getRegisteredRoutes(): RegisteredRoute[] {
    return [...this.registeredRoutes]
  }

  /**
   * Internal route registration.
   */
  private async registerRoute(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    handler: RouteHandler,
    additionalMiddleware?: RouteMiddleware[]
  ): Promise<void> {
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const fullPath = `${this.prefix}${normalizedPath}`

    // Get the middleware collection (lazy loaded to avoid circular deps)
    const middleware = await getMiddlewareCollection()

    // Create the route
    // NOTE: ctx.plugin is fully set by pluginEnforcement middleware with:
    // - id: the validated pluginId
    // - manifest: from plugin registry
    // - state: from database (tenant-specific)
    // - grantedCapabilities: from registry
    // We don't modify ctx.plugin here - the middleware handles it securely.
    const route = this.router[method](fullPath, handler)

    // Apply default middleware (auth, tenant, plugin enforcement)
    // Use the middleware collection functions which properly resolve the middleware
    const pluginId = this.pluginId
    const defaultMiddleware: RouteMiddleware[] = [
      middleware.auth(),
      middleware.tenant(),
      middleware.pluginEnforcement({ guards: [pluginId] }),
    ]
    const allMiddleware = [...defaultMiddleware, ...(additionalMiddleware || [])]
    route.use(allMiddleware)

    // Track registered route
    this.registeredRoutes.push({
      pluginId: this.pluginId,
      method: method.toUpperCase(),
      fullPath,
      registeredAt: new Date(),
    })

    console.log(
      `[RoutesRegistrar] Registered ${method.toUpperCase()} ${fullPath} for plugin ${this.pluginId}`
    )
  }
}

/**
 * Factory function to create a routes registrar for a plugin.
 */
export function createRoutesRegistrar(
  pluginId: string,
  routerInstance: typeof router,
  prefix?: string
): RoutesRegistrar {
  return new RoutesRegistrar(pluginId, routerInstance, prefix)
}
