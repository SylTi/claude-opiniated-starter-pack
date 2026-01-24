import type { HttpContext } from '@adonisjs/core/http'
import PaymentService from '#services/payment_service'
import DiscountCodeService from '#services/discount_code_service'
import env from '#start/env'
import TenantMembership from '#models/tenant_membership'
import DiscountCode from '#models/discount_code'
import SubscriptionTier from '#models/subscription_tier'
import Product from '#models/product'
import {
  createCheckoutValidator,
  createPortalValidator,
  getSubscriptionValidator,
  cancelSubscriptionValidator,
} from '#validators/payment'
import { isDiscountCodeLimitReachedError } from '#exceptions/billing_errors'

/**
 * Validate that a return URL belongs to an allowed host to prevent open redirect attacks.
 */
function isValidReturnUrl(url: string, allowedHost: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.host === allowedHost
  } catch {
    return false
  }
}

export default class PaymentController {
  /**
   * Get available subscription tiers with prices
   * GET /api/v1/billing/tiers
   */
  async getTiers({ response }: HttpContext): Promise<void> {
    const paymentService = new PaymentService()
    const provider = paymentService.providerName
    const tiers = await SubscriptionTier.getActiveTiers()
    const products = await Product.getProductsWithPrices(provider)
    const productsByTierId = new Map(products.map((product) => [product.tierId, product]))

    const data = tiers.map((tier) => {
      const product = productsByTierId.get(tier.id)
      return {
        tier: {
          id: tier.id,
          slug: tier.slug,
          name: tier.name,
          description: null,
          level: tier.level,
          maxTeamMembers: tier.maxTeamMembers,
          priceMonthly: tier.priceMonthly,
          yearlyDiscountPercent: tier.yearlyDiscountPercent,
          features: tier.features,
          isActive: tier.isActive,
        },
        prices:
          product?.prices.map((price) => ({
            id: price.id,
            interval: price.interval,
            currency: price.currency,
            unitAmount: price.unitAmount,
            taxBehavior: price.taxBehavior,
            isActive: price.isActive,
          })) ?? [],
      }
    })

    response.json({ data })
  }

  /**
   * Create checkout session for subscription
   * POST /api/v1/billing/checkout
   * Tenant is the billing unit - no user-level subscriptions
   */
  async createCheckout({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!
    const { priceId, tenantId, discountCode } = await request.validateUsing(createCheckoutValidator)

    // Verify user can manage billing for this tenant
    const membership = await TenantMembership.query()
      .where('tenantId', tenantId)
      .where('userId', user.id)
      .first()

    if (!membership || !membership.isAdmin()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Only tenant admins can manage billing',
      })
    }

    // Validate discount code if provided
    let validatedDiscountCode: DiscountCode | null = null
    if (discountCode) {
      const discountCodeService = new DiscountCodeService()
      const validationResult = await discountCodeService.validateCode(
        discountCode,
        priceId,
        tenantId
      )
      if (!validationResult.valid) {
        return response.badRequest({
          error: 'InvalidDiscountCode',
          message: validationResult.message ?? 'Invalid discount code',
        })
      }
      validatedDiscountCode = validationResult.discountCode ?? null
    }

    const frontendUrl = env.get('FRONTEND_URL', 'http://localhost:3000')
    const successUrl = `${frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${frontendUrl}/billing/cancel`

    try {
      const paymentService = new PaymentService()
      const result = await paymentService.createCheckoutSession(
        tenantId,
        priceId,
        successUrl,
        cancelUrl
      )

      // Record discount code usage if one was applied (atomic with race condition protection)
      if (validatedDiscountCode) {
        const discountCodeService = new DiscountCodeService()
        await discountCodeService.recordUsage(
          validatedDiscountCode.id,
          tenantId,
          user.id,
          result.sessionId
        )
      }

      response.json({
        data: {
          sessionId: result.sessionId,
          url: result.url,
        },
      })
    } catch (error) {
      // Handle discount code limit reached (race condition protection)
      if (isDiscountCodeLimitReachedError(error)) {
        return response.badRequest({
          error: 'DiscountCodeLimitReached',
          message: error.message,
        })
      }
      response.badRequest({
        error: 'CheckoutError',
        message: error instanceof Error ? error.message : 'Failed to create checkout session',
      })
    }
  }

  /**
   * Create customer portal session
   * POST /api/v1/billing/portal
   */
  async createPortal({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!
    const { returnUrl, tenantId } = await request.validateUsing(createPortalValidator)

    // Verify user can manage billing for this tenant
    const membership = await TenantMembership.query()
      .where('tenantId', tenantId)
      .where('userId', user.id)
      .first()

    if (!membership || !membership.isAdmin()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Only tenant admins can manage billing',
      })
    }

    const frontendUrl = env.get('FRONTEND_URL', 'http://localhost:3000')
    const allowedHost = new URL(frontendUrl).host

    // Validate returnUrl to prevent open redirect attacks
    const finalReturnUrl =
      returnUrl && isValidReturnUrl(returnUrl, allowedHost) ? returnUrl : `${frontendUrl}/billing`

    try {
      const paymentService = new PaymentService()
      const result = await paymentService.createCustomerPortalSession(tenantId, finalReturnUrl)

      response.json({
        data: {
          url: result.url,
        },
      })
    } catch (error) {
      response.badRequest({
        error: 'PortalError',
        message: error instanceof Error ? error.message : 'Failed to create portal session',
      })
    }
  }

  /**
   * Get current subscription details
   * GET /api/v1/billing/subscription
   */
  async getSubscription({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!
    const { tenantId } = await request.validateUsing(getSubscriptionValidator)

    // Verify user is a member of the tenant
    const membership = await TenantMembership.query()
      .where('tenantId', tenantId)
      .where('userId', user.id)
      .first()

    if (!membership) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Not a member of this tenant',
      })
    }

    const paymentService = new PaymentService()
    const subscription = await paymentService.getCurrentSubscription(tenantId)
    const canManage = membership.isAdmin() && (await paymentService.canManageBilling(tenantId))

    let subscriptionData = null
    if (subscription) {
      await subscription.load('tier')
      subscriptionData = {
        id: subscription.id,
        tenantId: subscription.tenantId,
        tier: {
          id: subscription.tier.id,
          slug: subscription.tier.slug,
          name: subscription.tier.name,
          level: subscription.tier.level,
          maxTeamMembers: subscription.tier.maxTeamMembers,
          priceMonthly: subscription.tier.priceMonthly,
          yearlyDiscountPercent: subscription.tier.yearlyDiscountPercent,
          features: subscription.tier.features,
          isActive: subscription.tier.isActive,
        },
        status: subscription.status,
        startsAt: subscription.startsAt.toISO(),
        expiresAt: subscription.expiresAt?.toISO() ?? null,
        providerName: subscription.providerName,
        providerSubscriptionId: subscription.providerSubscriptionId,
        createdAt: subscription.createdAt.toISO(),
        updatedAt: subscription.updatedAt?.toISO() ?? null,
      }
    }

    response.json({
      data: {
        subscription: subscriptionData,
        canManage,
        hasPaymentMethod: canManage,
      },
    })
  }

  /**
   * Cancel subscription
   * POST /api/v1/billing/cancel
   */
  async cancelSubscription({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!
    const { tenantId } = await request.validateUsing(cancelSubscriptionValidator)

    // Verify user can manage billing for this tenant
    const membership = await TenantMembership.query()
      .where('tenantId', tenantId)
      .where('userId', user.id)
      .first()

    if (!membership || !membership.isAdmin()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Only tenant admins can cancel subscriptions',
      })
    }

    const paymentService = new PaymentService()
    const subscription = await paymentService.getCurrentSubscription(tenantId)

    if (!subscription) {
      return response.badRequest({
        error: 'NoSubscription',
        message: 'No active subscription found',
      })
    }

    if (!subscription.providerSubscriptionId) {
      return response.badRequest({
        error: 'NotManaged',
        message: 'Subscription is not managed by payment provider',
      })
    }

    try {
      await paymentService.cancelSubscription(subscription)
      response.json({
        data: null,
        message: 'Subscription cancellation initiated',
      })
    } catch (error) {
      response.badRequest({
        error: 'CancelError',
        message: error instanceof Error ? error.message : 'Failed to cancel subscription',
      })
    }
  }
}
