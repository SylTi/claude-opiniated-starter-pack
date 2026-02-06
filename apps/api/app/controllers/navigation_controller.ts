/**
 * Navigation Controller
 *
 * Provides centralized navigation composition with full hook pipeline.
 *
 * This controller is the single source of truth for navigation building.
 * The web frontend fetches composed navigation from here instead of
 * building it locally (which would skip hooks registered in the API runtime).
 *
 * Per spec §8.2:
 * baseline → filters → mandatory → sort → collision check → permission filter
 */

import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { designRegistry, buildNavModel, type NavContext, type NavModel } from '@saas/plugins-core'
import TenantMembership from '#models/tenant_membership'
import Subscription from '#models/subscription'

/**
 * Navigation model response.
 */
interface NavigationModelResponse {
  nav: NavModel
  designId: string | null
  isSafeMode: boolean
}

export default class NavigationController {
  /**
   * GET /api/v1/navigation/model
   *
   * Build and return the navigation model with full hook pipeline.
   * Requires authentication - navigation is user-specific based on
   * entitlements, role, and tenant context.
   */
  async model(ctx: HttpContext): Promise<void> {
    const { auth, response } = ctx
    const user = auth.user

    if (!user) {
      return response.unauthorized({
        error: 'Unauthorized',
        message: 'Authentication required',
      })
    }

    // Check safe mode
    const safeMode = this.isSafeMode()
    if (safeMode) {
      // In safe mode, return minimal nav without design
      return response.ok({
        data: {
          nav: this.createMinimalNav(),
          designId: null,
          isSafeMode: true,
        } satisfies NavigationModelResponse,
      })
    }

    // Check if design is registered
    if (!designRegistry.has()) {
      return response.serviceUnavailable({
        error: 'DesignNotRegistered',
        message: 'No design registered. Plugin system may not be fully initialized.',
      })
    }

    const design = designRegistry.get()

    // Build NavContext from authenticated user (queries DB with RLS context)
    // Use authDb transaction for RLS-aware queries when available
    const context = await this.buildNavContext(user, ctx.authDb)

    try {
      // Build navigation with FULL pipeline including hooks
      // This is the critical difference from web-side building
      const nav = await buildNavModel({
        design,
        context,
        skipHooks: false, // Run hooks registered in API runtime
        skipPermissionFilter: false,
        skipValidation: false, // Boot-fatal collision check
      })

      return response.ok({
        data: {
          nav,
          designId: design.designId,
          isSafeMode: false,
        } satisfies NavigationModelResponse,
      })
    } catch (error) {
      // Log full error details server-side for debugging
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[NavigationController] Navigation build failed:', errorMessage)

      // Return sanitized error to client (no internal details)
      return response.internalServerError({
        error: 'NavigationBuildFailed',
        message: 'Navigation model could not be built. Please contact support if this persists.',
      })
    }
  }

  /**
   * Check if running in safe mode.
   */
  private isSafeMode(): boolean {
    return process.env.SAFE_MODE === '1' || process.env.SAFE_MODE === 'true'
  }

  /**
   * Build NavContext from authenticated user.
   * Queries actual tenant count and subscription tier from database.
   *
   * SECURITY: Uses authDb transaction for RLS-aware queries when available.
   * This ensures queries respect row-level security policies set by
   * auth_context_middleware (app.user_id, app.tenant_id session vars).
   */
  private async buildNavContext(
    user: NonNullable<HttpContext['auth']['user']>,
    authDb?: TransactionClientContract
  ): Promise<NavContext> {
    // Build entitlements set
    const entitlements = new Set<string>()

    // Add role-based entitlements
    if (user.role === 'admin') {
      entitlements.add('admin')
    }

    // Query actual tenant count for hasMultipleTenants
    // Use authDb transaction for RLS context when available
    const tenantCountQuery = authDb
      ? TenantMembership.query({ client: authDb })
      : TenantMembership.query()
    const tenantCount = await tenantCountQuery.where('user_id', user.id).count('* as total').first()
    const hasMultipleTenants = Number(tenantCount?.$extras?.total ?? 0) > 1

    // Query tier level from current tenant's subscription
    // Use authDb transaction for RLS context when available
    let tierLevel = 0
    if (user.currentTenantId) {
      const subscriptionQuery = authDb
        ? Subscription.query({ client: authDb })
        : Subscription.query()
      const subscription = await subscriptionQuery
        .where('tenant_id', user.currentTenantId)
        .whereIn('status', ['active', 'trialing'])
        .preload('tier')
        .first()
      tierLevel = subscription?.tier?.level ?? 0
    }

    return {
      userId: String(user.id),
      userRole: user.role as 'user' | 'admin',
      entitlements,
      tenantId: user.currentTenantId ? String(user.currentTenantId) : null,
      tierLevel,
      hasMultipleTenants,
      abilities: undefined,
    }
  }

  /**
   * Create minimal navigation for safe mode.
   */
  private createMinimalNav(): NavModel {
    return {
      main: [
        {
          id: 'core.main',
          label: 'Main',
          order: 100,
          items: [
            {
              id: 'core.dashboard',
              label: 'Dashboard',
              href: '/dashboard',
              icon: 'Home',
              order: 100,
            },
          ],
        },
      ],
      admin: [],
      userMenu: [
        {
          id: 'core.account',
          label: 'Account',
          order: 9000,
          items: [
            {
              id: 'core.logout',
              label: 'Log out',
              href: '#',
              icon: 'LogOut',
              order: 9999,
              onClick: 'logout',
            },
          ],
        },
      ],
    }
  }
}
