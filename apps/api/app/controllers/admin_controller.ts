import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import User from '#models/user'
import LoginHistory from '#models/login_history'
import Tenant from '#models/tenant'
import Subscription from '#models/subscription'
import SubscriptionTier from '#models/subscription_tier'
import Product from '#models/product'
import Price from '#models/price'
import SubscriptionService from '#services/subscription_service'
import {
  updateUserTierValidator,
  updateTenantTierValidator,
  createProductValidator,
  updateProductValidator,
  listPricesValidator,
  createPriceValidator,
  updatePriceValidator,
} from '#validators/admin'

export default class AdminController {
  /**
   * Get admin dashboard statistics
   */
  async getStats({ response }: HttpContext): Promise<void> {
    const totalUsers = await User.query().count('* as total')
    const verifiedUsers = await User.query().where('emailVerified', true).count('* as total')
    const mfaEnabledUsers = await User.query().where('mfaEnabled', true).count('* as total')

    const now = DateTime.now()
    const thirtyDaysAgo = now.minus({ days: 30 })
    const sevenDaysAgo = now.minus({ days: 7 })

    const newUsersThisMonth = await User.query()
      .where('createdAt', '>=', thirtyDaysAgo.toSQL())
      .count('* as total')

    const activeSessionsThisWeek = await LoginHistory.query()
      .where('createdAt', '>=', sevenDaysAgo.toSQL())
      .where('success', true)
      .countDistinct('user_id as total')

    const usersByRole = await User.query().select('role').count('* as count').groupBy('role')

    response.json({
      data: {
        totalUsers: Number(totalUsers[0].$extras.total),
        verifiedUsers: Number(verifiedUsers[0].$extras.total),
        mfaEnabledUsers: Number(mfaEnabledUsers[0].$extras.total),
        newUsersThisMonth: Number(newUsersThisMonth[0].$extras.total),
        activeUsersThisWeek: Number(activeSessionsThisWeek[0].$extras.total),
        usersByRole: usersByRole.map((r) => ({
          role: r.role,
          count: Number(r.$extras.count),
        })),
      },
    })
  }

  /**
   * List all users with admin details
   */
  async listUsers({ response }: HttpContext): Promise<void> {
    const users = await User.query()
      .select(
        'id',
        'email',
        'fullName',
        'role',
        'currentTenantId',
        'emailVerified',
        'emailVerifiedAt',
        'mfaEnabled',
        'avatarUrl',
        'createdAt',
        'updatedAt'
      )
      .preload('currentTenant')
      .orderBy('createdAt', 'desc')

    // Get subscriptions for all users based on their current tenant
    const usersWithSubscriptions = await Promise.all(
      users.map(async (user) => {
        let subscription = null
        if (user.currentTenantId) {
          subscription = await Subscription.getActiveForTenant(user.currentTenantId)
        }
        return {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          subscriptionTier: subscription?.tier?.slug ?? 'free',
          subscriptionExpiresAt: subscription?.expiresAt?.toISO() ?? null,
          currentTenantId: user.currentTenantId,
          currentTenantName: user.currentTenant?.name ?? null,
          emailVerified: user.emailVerified,
          emailVerifiedAt: user.emailVerifiedAt?.toISO() ?? null,
          mfaEnabled: user.mfaEnabled,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt.toISO(),
          updatedAt: user.updatedAt?.toISO() ?? null,
        }
      })
    )

    response.json({
      data: usersWithSubscriptions,
    })
  }

  /**
   * Manually verify a user's email
   */
  async verifyUserEmail({ params, response }: HttpContext): Promise<void> {
    const user = await User.findOrFail(params.id)

    if (user.emailVerified) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'User email is already verified',
      })
    }

    user.emailVerified = true
    user.emailVerifiedAt = DateTime.now()
    await user.save()

    response.json({
      data: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt?.toISO(),
      },
      message: 'User email has been verified successfully',
    })
  }

  /**
   * Manually unverify a user's email (for testing purposes)
   */
  async unverifyUserEmail({ params, response }: HttpContext): Promise<void> {
    const user = await User.findOrFail(params.id)

    if (!user.emailVerified) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'User email is already unverified',
      })
    }

    user.emailVerified = false
    user.emailVerifiedAt = null
    await user.save()

    response.json({
      data: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        emailVerifiedAt: null,
      },
      message: 'User email has been unverified successfully',
    })
  }

  /**
   * Delete a user
   */
  async deleteUser({ params, auth, response }: HttpContext): Promise<void> {
    const user = await User.findOrFail(params.id)
    const currentUser = auth.user!

    if (user.id === currentUser.id) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'You cannot delete your own account from admin panel',
      })
    }

    await user.delete()

    response.json({
      message: 'User has been deleted successfully',
    })
  }

  /**
   * Update user's current tenant subscription tier (admin override)
   * @deprecated Use updateTenantTier instead - tenant is the billing unit
   */
  async updateUserTier({ params, request, response }: HttpContext): Promise<void> {
    const user = await User.findOrFail(params.id)
    const { subscriptionTier, subscriptionExpiresAt } =
      await request.validateUsing(updateUserTierValidator)

    // User must have a current tenant
    if (!user.currentTenantId) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'User has no current tenant. Create a tenant first.',
      })
    }

    // Validate tier exists
    const tier = await SubscriptionTier.findBySlug(subscriptionTier)
    if (!tier) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Invalid subscription tier',
      })
    }

    // Parse expiration date
    let expiresAt: DateTime | null = null
    if (subscriptionTier !== 'free' && subscriptionExpiresAt) {
      expiresAt = DateTime.fromJSDate(subscriptionExpiresAt)
    }

    // Use subscription service to update the tenant's subscription
    const subscriptionService = new SubscriptionService()
    const subscription = await subscriptionService.updateTenantSubscription(
      user.currentTenantId,
      subscriptionTier,
      expiresAt
    )

    response.json({
      data: {
        id: user.id,
        email: user.email,
        tenantId: user.currentTenantId,
        subscriptionTier: tier.slug,
        subscriptionExpiresAt: subscription.expiresAt?.toISO() ?? null,
      },
      message: 'User tenant subscription tier has been updated successfully',
    })
  }

  /**
   * List all tenants with admin details
   */
  async listTenants({ response }: HttpContext): Promise<void> {
    const tenants = await Tenant.query()
      .preload('owner')
      .preload('memberships')
      .orderBy('createdAt', 'desc')

    // Get subscriptions for all tenants
    const tenantsWithSubscriptions = await Promise.all(
      tenants.map(async (tenant: Tenant) => {
        const subscription = await tenant.getActiveSubscription()
        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          type: tenant.type,
          subscriptionTier: subscription?.tier?.slug ?? 'free',
          subscriptionExpiresAt: subscription?.expiresAt?.toISO() ?? null,
          ownerId: tenant.ownerId,
          ownerEmail: tenant.owner?.email ?? null,
          memberCount: tenant.memberships.length,
          balance: tenant.balance ?? 0,
          balanceCurrency: tenant.balanceCurrency ?? 'usd',
          createdAt: tenant.createdAt.toISO(),
          updatedAt: tenant.updatedAt?.toISO() ?? null,
        }
      })
    )

    response.json({
      data: tenantsWithSubscriptions,
    })
  }

  /**
   * Update tenant's subscription tier (tenant is the billing unit)
   */
  async updateTenantTier({ params, request, response }: HttpContext): Promise<void> {
    const tenant = await Tenant.findOrFail(params.id)
    const { subscriptionTier, subscriptionExpiresAt } =
      await request.validateUsing(updateTenantTierValidator)

    // Validate tier exists
    const tier = await SubscriptionTier.findBySlug(subscriptionTier)
    if (!tier) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Invalid subscription tier',
      })
    }

    // Parse expiration date
    let expiresAt: DateTime | null = null
    if (subscriptionTier !== 'free' && subscriptionExpiresAt) {
      expiresAt = DateTime.fromJSDate(subscriptionExpiresAt)
    }

    // Use subscription service to update
    const subscriptionService = new SubscriptionService()
    const subscription = await subscriptionService.updateTenantSubscription(
      tenant.id,
      subscriptionTier,
      expiresAt
    )

    response.json({
      data: {
        id: tenant.id,
        name: tenant.name,
        subscriptionTier: tier.slug,
        subscriptionExpiresAt: subscription.expiresAt?.toISO() ?? null,
      },
      message: 'Tenant subscription tier has been updated successfully',
    })
  }

  // ==========================================
  // Product Management (Tier <-> Stripe Product)
  // ==========================================

  /**
   * List all products with their prices
   */
  async listProducts({ response }: HttpContext): Promise<void> {
    const products = await Product.query()
      .preload('tier')
      .preload('prices')
      .orderBy('tierId', 'asc')

    response.json({
      data: products.map((product) => ({
        id: product.id,
        tierId: product.tierId,
        tierSlug: product.tier.slug,
        tierName: product.tier.name,
        provider: product.provider,
        providerProductId: product.providerProductId,
        prices: product.prices.map((price) => ({
          id: price.id,
          interval: price.interval,
          currency: price.currency,
          unitAmount: price.unitAmount,
          taxBehavior: price.taxBehavior,
          isActive: price.isActive,
          providerPriceId: price.providerPriceId,
        })),
        createdAt: product.createdAt.toISO(),
        updatedAt: product.updatedAt?.toISO() ?? null,
      })),
    })
  }

  /**
   * Create a new product (link tier to Stripe product)
   */
  async createProduct({ request, response }: HttpContext): Promise<void> {
    const { tierId, provider, providerProductId } =
      await request.validateUsing(createProductValidator)

    // Check if tier exists
    const tier = await SubscriptionTier.find(tierId)
    if (!tier) {
      return response.notFound({
        error: 'NotFoundError',
        message: 'Tier not found',
      })
    }

    // Check if product already exists for this tier and provider
    const existing = await Product.findByTierAndProvider(tierId, provider)
    if (existing) {
      return response.conflict({
        error: 'ConflictError',
        message: 'A product already exists for this tier and provider',
      })
    }

    const product = await Product.create({
      tierId,
      provider,
      providerProductId,
    })
    await product.load('tier')

    response.created({
      data: {
        id: product.id,
        tierId: product.tierId,
        tierSlug: product.tier.slug,
        tierName: product.tier.name,
        provider: product.provider,
        providerProductId: product.providerProductId,
      },
      message: 'Product created successfully',
    })
  }

  /**
   * Update a product
   */
  async updateProduct({ params, request, response }: HttpContext): Promise<void> {
    const product = await Product.findOrFail(params.id)
    const { providerProductId } = await request.validateUsing(updateProductValidator)

    if (providerProductId !== undefined) {
      product.providerProductId = providerProductId
    }

    await product.save()
    await product.load('tier')

    response.json({
      data: {
        id: product.id,
        tierId: product.tierId,
        tierSlug: product.tier.slug,
        tierName: product.tier.name,
        provider: product.provider,
        providerProductId: product.providerProductId,
      },
      message: 'Product updated successfully',
    })
  }

  /**
   * Delete a product
   */
  async deleteProduct({ params, response }: HttpContext): Promise<void> {
    const product = await Product.findOrFail(params.id)

    // This will cascade delete associated prices
    await product.delete()

    response.json({
      message: 'Product and associated prices deleted successfully',
    })
  }

  // ==========================================
  // Price Management
  // ==========================================

  /**
   * List all prices
   */
  async listPrices({ request, response }: HttpContext): Promise<void> {
    const { productId } = await request.validateUsing(listPricesValidator)

    let query = Price.query().preload('product', (q) => q.preload('tier'))

    if (productId) {
      query = query.where('productId', productId)
    }

    const prices = await query.orderBy('productId', 'asc').orderBy('interval', 'asc')

    response.json({
      data: prices.map((price) => ({
        id: price.id,
        productId: price.productId,
        tierSlug: price.product.tier.slug,
        tierName: price.product.tier.name,
        provider: price.provider,
        providerPriceId: price.providerPriceId,
        interval: price.interval,
        currency: price.currency,
        unitAmount: price.unitAmount,
        taxBehavior: price.taxBehavior,
        isActive: price.isActive,
        createdAt: price.createdAt.toISO(),
        updatedAt: price.updatedAt?.toISO() ?? null,
      })),
    })
  }

  /**
   * Create a new price
   */
  async createPrice({ request, response }: HttpContext): Promise<void> {
    const data = await request.validateUsing(createPriceValidator)

    // Check if product exists
    const product = await Product.find(data.productId)
    if (!product) {
      return response.notFound({
        error: 'NotFoundError',
        message: 'Product not found',
      })
    }

    // Check if price already exists for this provider price ID
    const existing = await Price.findByProviderPriceId(data.provider, data.providerPriceId)
    if (existing) {
      return response.conflict({
        error: 'ConflictError',
        message: 'A price with this provider price ID already exists',
      })
    }

    const price = await Price.create({
      productId: data.productId,
      provider: data.provider,
      providerPriceId: data.providerPriceId,
      interval: data.interval,
      currency: data.currency.toLowerCase(),
      unitAmount: data.unitAmount,
      taxBehavior: data.taxBehavior ?? 'exclusive',
      isActive: data.isActive ?? true,
    })

    await price.load('product', (q) => q.preload('tier'))

    response.created({
      data: {
        id: price.id,
        productId: price.productId,
        tierSlug: price.product.tier.slug,
        tierName: price.product.tier.name,
        provider: price.provider,
        providerPriceId: price.providerPriceId,
        interval: price.interval,
        currency: price.currency,
        unitAmount: price.unitAmount,
        taxBehavior: price.taxBehavior,
        isActive: price.isActive,
      },
      message: 'Price created successfully',
    })
  }

  /**
   * Update a price
   */
  async updatePrice({ params, request, response }: HttpContext): Promise<void> {
    const price = await Price.findOrFail(params.id)
    const data = await request.validateUsing(updatePriceValidator)

    // Note: interval and currency should not be changed after creation
    if (data.providerPriceId !== undefined) price.providerPriceId = data.providerPriceId
    if (data.unitAmount !== undefined) price.unitAmount = data.unitAmount
    if (data.taxBehavior !== undefined) price.taxBehavior = data.taxBehavior
    if (data.isActive !== undefined) price.isActive = data.isActive

    await price.save()
    await price.load('product', (q) => q.preload('tier'))

    response.json({
      data: {
        id: price.id,
        productId: price.productId,
        tierSlug: price.product.tier.slug,
        tierName: price.product.tier.name,
        provider: price.provider,
        providerPriceId: price.providerPriceId,
        interval: price.interval,
        currency: price.currency,
        unitAmount: price.unitAmount,
        taxBehavior: price.taxBehavior,
        isActive: price.isActive,
      },
      message: 'Price updated successfully',
    })
  }

  /**
   * Delete a price
   */
  async deletePrice({ params, response }: HttpContext): Promise<void> {
    const price = await Price.findOrFail(params.id)
    await price.delete()

    response.json({
      message: 'Price deleted successfully',
    })
  }
}
