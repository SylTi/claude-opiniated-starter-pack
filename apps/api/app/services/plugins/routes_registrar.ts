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
  middleware?: string[]
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
  get(path: string, handler: RouteHandler, middleware?: string[]): void {
    this.registerRoute('get', path, handler, middleware)
  }

  /**
   * Register a POST route.
   */
  post(path: string, handler: RouteHandler, middleware?: string[]): void {
    this.registerRoute('post', path, handler, middleware)
  }

  /**
   * Register a PUT route.
   */
  put(path: string, handler: RouteHandler, middleware?: string[]): void {
    this.registerRoute('put', path, handler, middleware)
  }

  /**
   * Register a PATCH route.
   */
  patch(path: string, handler: RouteHandler, middleware?: string[]): void {
    this.registerRoute('patch', path, handler, middleware)
  }

  /**
   * Register a DELETE route.
   */
  delete(path: string, handler: RouteHandler, middleware?: string[]): void {
    this.registerRoute('delete', path, handler, middleware)
  }

  /**
   * Register multiple routes at once.
   */
  registerRoutes(routes: RouteDefinition[]): void {
    for (const route of routes) {
      this.registerRoute(route.method, route.path, route.handler, route.middleware)
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
  private registerRoute(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    handler: RouteHandler,
    middleware?: string[]
  ): void {
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const fullPath = `${this.prefix}${normalizedPath}`

    // Create the route
    const route = this.router[method](fullPath, async (ctx: HttpContext) => {
      // Extend existing plugin context (set by middleware) instead of overwriting
      // This preserves the richer context (manifest, state, capabilities) from middleware
      const existingPlugin = (ctx as any).plugin || {}
      ;(ctx as any).plugin = {
        ...existingPlugin,
        id: this.pluginId,
      }
      await handler(ctx)
    })

    // Apply default middleware (auth, tenant, plugin enforcement)
    const defaultMiddleware = ['auth', 'tenant', `pluginEnforcement:${this.pluginId}`]
    const allMiddleware = [...defaultMiddleware, ...(middleware || [])]
    // Use type assertion for named middleware (AdonisJS parses string middleware names)

    route.use(allMiddleware as any)

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
