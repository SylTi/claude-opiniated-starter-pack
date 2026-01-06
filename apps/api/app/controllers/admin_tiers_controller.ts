import type { HttpContext } from '@adonisjs/core/http'
import SubscriptionTier from '#models/subscription_tier'
import { createTierValidator, updateTierValidator } from '#validators/admin'

export default class AdminTiersController {
  /**
   * List all available subscription tiers
   */
  async index({ response }: HttpContext): Promise<void> {
    const tiers = await SubscriptionTier.query().orderBy('level', 'asc')

    response.json({
      data: tiers.map((tier) => ({
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
        createdAt: tier.createdAt.toISO(),
        updatedAt: tier.updatedAt?.toISO() ?? null,
      })),
    })
  }

  /**
   * Create a new subscription tier
   */
  async store({ request, response }: HttpContext): Promise<void> {
    const data = await request.validateUsing(createTierValidator)

    const existing = await SubscriptionTier.findBySlug(data.slug)
    if (existing) {
      return response.conflict({
        error: 'ConflictError',
        message: 'A tier with this slug already exists',
      })
    }

    const tier = await SubscriptionTier.create({
      slug: data.slug,
      name: data.name,
      level: data.level ?? 0,
      maxTeamMembers: data.maxTeamMembers ?? null,
      priceMonthly: data.priceMonthly ?? null,
      yearlyDiscountPercent: data.yearlyDiscountPercent ?? null,
      features: data.features ?? null,
      isActive: data.isActive ?? true,
    })

    response.created({
      data: {
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
      message: 'Tier created successfully',
    })
  }

  /**
   * Update a subscription tier
   */
  async update({ params, request, response }: HttpContext): Promise<void> {
    const tier = await SubscriptionTier.findOrFail(params.id)
    const data = await request.validateUsing(updateTierValidator)

    if (data.name !== undefined) tier.name = data.name
    if (data.level !== undefined) tier.level = data.level
    if (data.maxTeamMembers !== undefined) tier.maxTeamMembers = data.maxTeamMembers
    if (data.priceMonthly !== undefined) tier.priceMonthly = data.priceMonthly
    if (data.yearlyDiscountPercent !== undefined)
      tier.yearlyDiscountPercent = data.yearlyDiscountPercent
    if (data.features !== undefined) tier.features = data.features
    if (data.isActive !== undefined) tier.isActive = data.isActive

    await tier.save()

    response.json({
      data: {
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
      message: 'Tier updated successfully',
    })
  }

  /**
   * Delete a subscription tier
   */
  async destroy({ params, response }: HttpContext): Promise<void> {
    const tier = await SubscriptionTier.findOrFail(params.id)
    await tier.delete()

    response.json({
      message: 'Tier deleted successfully',
    })
  }
}
