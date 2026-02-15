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
import type { PluginManifest } from '@saas/plugins-core'

// Middleware collection type
type MiddlewareCollection = Awaited<typeof import('#start/kernel')>['middleware']
type MiddlewareEntry = ReturnType<MiddlewareCollection[keyof MiddlewareCollection]>
type RouteMiddleware = MiddlewareEntry

// Cache for lazily loaded middleware collection
let cachedMiddleware: MiddlewareCollection | null = null

export type TrustedPluginRequestScope = {
  tenantId: number
  actorUserId: number
  actorRole: string | undefined
  requestIp: string | null
  requestUserAgent: string | null
}

const trustedPluginRequestScopes = new WeakMap<object, TrustedPluginRequestScope>()

type PluginAwareHttpContext = HttpContext & {
  tenant?: { id?: number; membership?: { role?: string } }
  auth?: { user?: { id?: number } }
  request: HttpContext['request'] & {
    ip?: () => string | null | undefined
    header?: (name: string) => string | null | undefined
  }
  response?: {
    response?: {
      once?: (event: 'finish' | 'close', listener: () => void) => void
    }
  }
}

function captureTrustedPluginRequestScope(ctx: HttpContext): void {
  const pluginCtx = ctx as PluginAwareHttpContext
  const tenantId = pluginCtx.tenant?.id
  const actorUserId = pluginCtx.auth?.user?.id

  if (typeof tenantId !== 'number' || typeof actorUserId !== 'number') {
    return
  }

  const requestIp =
    typeof pluginCtx.request.ip === 'function' ? (pluginCtx.request.ip() ?? null) : null
  const requestUserAgent =
    typeof pluginCtx.request.header === 'function'
      ? (pluginCtx.request.header('user-agent') ?? null)
      : null

  trustedPluginRequestScopes.set(ctx, {
    tenantId,
    actorUserId,
    actorRole: pluginCtx.tenant?.membership?.role,
    requestIp,
    requestUserAgent,
  })

  const response = pluginCtx.response?.response
  if (response && typeof response.once === 'function') {
    const cleanup = () => {
      trustedPluginRequestScopes.delete(ctx)
    }
    response.once('finish', cleanup)
    response.once('close', cleanup)
  }
}

export function getTrustedPluginRequestScope(ctx: unknown): TrustedPluginRequestScope | null {
  if (typeof ctx !== 'object' || ctx === null) {
    return null
  }
  return trustedPluginRequestScopes.get(ctx) ?? null
}

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

export type RouteOptions = {
  middleware?: RouteMiddleware[]
  requiredFeatures?: string[]
  public?: boolean
}

type RouteRegistrationOptions = RouteOptions | RouteMiddleware[]

/**
 * Route definition.
 */
export interface RouteDefinition {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  path: string
  handler: RouteHandler
  middleware?: RouteMiddleware[]
  requiredFeatures?: string[]
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
  private declaredFeatures: ReadonlySet<string>
  private registeredRoutes: RegisteredRoute[] = []

  constructor(
    pluginId: string,
    routerInstance: typeof router,
    prefix?: string,
    manifest?: PluginManifest
  ) {
    this.pluginId = pluginId
    this.router = routerInstance
    this.prefix = prefix || `/api/v1/apps/${pluginId}`
    this.declaredFeatures = new Set(Object.keys(manifest?.features ?? {}))
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
  get(path: string, handler: RouteHandler, options?: RouteRegistrationOptions): Promise<void> {
    return this.registerRoute('get', path, handler, options)
  }

  /**
   * Register a POST route.
   */
  post(path: string, handler: RouteHandler, options?: RouteRegistrationOptions): Promise<void> {
    return this.registerRoute('post', path, handler, options)
  }

  /**
   * Register a PUT route.
   */
  put(path: string, handler: RouteHandler, options?: RouteRegistrationOptions): Promise<void> {
    return this.registerRoute('put', path, handler, options)
  }

  /**
   * Register a PATCH route.
   */
  patch(path: string, handler: RouteHandler, options?: RouteRegistrationOptions): Promise<void> {
    return this.registerRoute('patch', path, handler, options)
  }

  /**
   * Register a DELETE route.
   */
  delete(path: string, handler: RouteHandler, options?: RouteRegistrationOptions): Promise<void> {
    return this.registerRoute('delete', path, handler, options)
  }

  /**
   * Register multiple routes at once.
   */
  async registerRoutes(routes: RouteDefinition[]): Promise<void> {
    for (const route of routes) {
      await this.registerRoute(route.method, route.path, route.handler, {
        middleware: route.middleware,
        requiredFeatures: route.requiredFeatures,
      })
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
    options?: RouteRegistrationOptions
  ): Promise<void> {
    const normalizedOptions = this.normalizeOptions(options)

    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    if (normalizedOptions.public && !normalizedPath.startsWith('/public/')) {
      throw new Error(
        `Plugin "${this.pluginId}" public route "${normalizedPath}" must be under "/public/"`
      )
    }
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
    const wrappedHandler: RouteHandler = async (ctx: HttpContext) => {
      captureTrustedPluginRequestScope(ctx)
      await handler(ctx)
    }
    const route = this.router[method](fullPath, wrappedHandler)

    // Apply default middleware (auth, tenant, plugin enforcement)
    // Use the middleware collection functions which properly resolve the middleware
    const pluginId = this.pluginId
    const defaultMiddleware: RouteMiddleware[] = normalizedOptions.public
      ? [
          middleware.pluginPublicEnforcement({
            guards: [pluginId],
            requiredFeatures: normalizedOptions.requiredFeatures,
          }),
        ]
      : [
          middleware.auth(),
          middleware.tenant(),
          middleware.pluginEnforcement({
            guards: [pluginId],
            requiredFeatures: normalizedOptions.requiredFeatures,
          }),
        ]
    const allMiddleware = [...defaultMiddleware, ...(normalizedOptions.middleware || [])]
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

  private normalizeOptions(options: RouteRegistrationOptions | undefined): RouteOptions {
    if (Array.isArray(options)) {
      return { middleware: options, requiredFeatures: [] }
    }

    const requiredFeatures = (options?.requiredFeatures ?? []).map((featureId) => featureId.trim())
    const invalidFeatureId = requiredFeatures.find((featureId) => featureId.length === 0)
    if (invalidFeatureId !== undefined) {
      throw new Error(`Plugin "${this.pluginId}" declared an empty required feature ID`)
    }

    for (const featureId of requiredFeatures) {
      if (!this.declaredFeatures.has(featureId)) {
        throw new Error(
          `Plugin "${this.pluginId}" route requires undeclared feature "${featureId}". ` +
            `Add it to manifest.features first.`
        )
      }
    }

    return {
      middleware: options?.middleware ?? [],
      requiredFeatures,
      public: options?.public ?? false,
    }
  }
}

/**
 * Factory function to create a routes registrar for a plugin.
 */
export function createRoutesRegistrar(
  pluginId: string,
  routerInstance: typeof router,
  prefix?: string,
  manifest?: PluginManifest
): RoutesRegistrar {
  return new RoutesRegistrar(pluginId, routerInstance, prefix, manifest)
}
