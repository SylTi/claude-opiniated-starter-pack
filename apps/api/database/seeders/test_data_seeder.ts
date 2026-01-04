import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import User from '#models/user'
import Team from '#models/team'
import TeamMember from '#models/team_member'
import SubscriptionTier from '#models/subscription_tier'
import Subscription from '#models/subscription'
import Product from '#models/product'
import Price from '#models/price'
import Coupon from '#models/coupon'
import DiscountCode from '#models/discount_code'

export default class extends BaseSeeder {
  async run(): Promise<void> {
    // Skip in production
    if (app.inProduction) {
      console.log('Skipping test data seeder in production')
      return
    }

    console.log('Seeding test data...')

    // Create subscription tiers
    await this.seedSubscriptionTiers()

    // Create products and prices
    await this.seedProductsAndPrices()

    // Create test users
    const users = await this.seedUsers()

    // Create teams
    await this.seedTeams(users)

    // Create coupons
    await this.seedCoupons()

    // Create discount codes
    await this.seedDiscountCodes()

    console.log('Test data seeding complete!')
  }

  private async seedSubscriptionTiers(): Promise<void> {
    const tiers = [
      {
        slug: 'free',
        name: 'Free',
        level: 0,
        maxTeamMembers: 1,
        priceMonthly: 0,
        yearlyDiscountPercent: 0,
        features: { storage: '1GB', support: 'community' },
        isActive: true,
      },
      {
        slug: 'tier1',
        name: 'Pro',
        level: 1,
        maxTeamMembers: 5,
        priceMonthly: 999,
        yearlyDiscountPercent: 20,
        features: { storage: '10GB', support: 'email', analytics: true },
        isActive: true,
      },
      {
        slug: 'tier2',
        name: 'Enterprise',
        level: 2,
        maxTeamMembers: 50,
        priceMonthly: 4999,
        yearlyDiscountPercent: 25,
        features: { storage: '100GB', support: 'priority', analytics: true, sso: true },
        isActive: true,
      },
    ]

    for (const tierData of tiers) {
      const existing = await SubscriptionTier.findBySlug(tierData.slug)
      if (existing) {
        console.log(`  Tier already exists: ${tierData.slug}`)
        continue
      }
      await SubscriptionTier.create(tierData)
      console.log(`  Created tier: ${tierData.slug}`)
    }
  }

  private async seedUsers(): Promise<Record<string, User>> {
    const testUsers = [
      {
        key: 'freeUser',
        email: 'free@test.com',
        password: 'password123',
        fullName: 'Free User',
        role: 'user' as const,
        emailVerified: true,
        tier: 'free',
      },
      {
        key: 'proUser',
        email: 'pro@test.com',
        password: 'password123',
        fullName: 'Pro User',
        role: 'user' as const,
        emailVerified: true,
        tier: 'tier1',
      },
      {
        key: 'enterpriseUser',
        email: 'enterprise@test.com',
        password: 'password123',
        fullName: 'Enterprise User',
        role: 'user' as const,
        emailVerified: true,
        tier: 'tier2',
      },
      {
        key: 'adminUser',
        email: 'admin@test.com',
        password: 'password123',
        fullName: 'Admin User',
        role: 'admin' as const,
        emailVerified: true,
        tier: 'tier2',
      },
      {
        key: 'teamOwner',
        email: 'owner@test.com',
        password: 'password123',
        fullName: 'Team Owner',
        role: 'user' as const,
        emailVerified: true,
        balance: 5000,
      },
      {
        key: 'teamMember',
        email: 'member@test.com',
        password: 'password123',
        fullName: 'Team Member',
        role: 'user' as const,
        emailVerified: true,
      },
      {
        key: 'unverified',
        email: 'unverified@test.com',
        password: 'password123',
        fullName: 'Unverified User',
        role: 'user' as const,
        emailVerified: false,
      },
    ]

    const users: Record<string, User> = {}

    for (const userData of testUsers) {
      const existing = await User.findBy('email', userData.email)
      if (existing) {
        console.log(`  User already exists: ${userData.email}`)
        users[userData.key] = existing
        continue
      }

      const user = await User.create({
        email: userData.email,
        password: userData.password,
        fullName: userData.fullName,
        role: userData.role,
        emailVerified: userData.emailVerified,
        balance: userData.balance ?? 0,
        balanceCurrency: 'usd',
      })

      // Create subscription if tier specified
      if (userData.tier) {
        const tier = await SubscriptionTier.findBySlug(userData.tier)
        if (tier) {
          await Subscription.create({
            subscriberType: 'user',
            subscriberId: user.id,
            tierId: tier.id,
            status: 'active',
            startsAt: DateTime.now(),
            expiresAt: userData.tier === 'free' ? null : DateTime.now().plus({ years: 1 }),
          })
        }
      }

      users[userData.key] = user
      console.log(`  Created user: ${userData.email}`)
    }

    return users
  }

  private async seedProductsAndPrices(): Promise<void> {
    const tierConfigs = [
      {
        slug: 'tier1',
        providerProductId: 'prod_test_tier1',
        prices: [
          { providerPriceId: 'price_test_tier1_month', interval: 'month', unitAmount: 1999 },
          { providerPriceId: 'price_test_tier1_year', interval: 'year', unitAmount: 19990 },
        ],
      },
      {
        slug: 'tier2',
        providerProductId: 'prod_test_tier2',
        prices: [
          { providerPriceId: 'price_test_tier2_month', interval: 'month', unitAmount: 4999 },
          { providerPriceId: 'price_test_tier2_year', interval: 'year', unitAmount: 49990 },
        ],
      },
    ]

    for (const config of tierConfigs) {
      const tier = await SubscriptionTier.findBySlug(config.slug)
      if (!tier) {
        console.log(`  Tier not found for product seed: ${config.slug}`)
        continue
      }

      let product = await Product.findByTierAndProvider(tier.id, 'stripe')
      if (!product) {
        product = await Product.create({
          tierId: tier.id,
          provider: 'stripe',
          providerProductId: config.providerProductId,
        })
        console.log(`  Created product for tier: ${config.slug}`)
      }

      const existingPrices = await Price.query()
        .where('productId', product.id)
        .where('provider', 'stripe')

      if (existingPrices.length > 0) {
        continue
      }

      for (const price of config.prices) {
        await Price.create({
          productId: product.id,
          provider: 'stripe',
          providerPriceId: price.providerPriceId,
          interval: price.interval,
          currency: 'usd',
          unitAmount: price.unitAmount,
          taxBehavior: 'exclusive',
          isActive: true,
        })
      }
      console.log(`  Created prices for tier: ${config.slug}`)
    }
  }

  private async seedTeams(users: Record<string, User>): Promise<void> {
    const owner = users['teamOwner']
    const member = users['teamMember']

    if (!owner || !member) {
      console.log('  Skipping team creation - required users not found')
      return
    }

    // Check if team already exists
    const existingTeam = await Team.findBy('slug', 'test-team')
    if (existingTeam) {
      console.log('  Team already exists: test-team')
      return
    }

    // Create team
    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
      balance: 10000,
      balanceCurrency: 'usd',
    })

    // Add owner as member
    await TeamMember.create({
      userId: owner.id,
      teamId: team.id,
      role: 'owner',
    })

    // Add member
    await TeamMember.create({
      userId: member.id,
      teamId: team.id,
      role: 'member',
    })

    // Update current team for users
    owner.currentTeamId = team.id
    await owner.save()
    member.currentTeamId = team.id
    await member.save()

    // Create team subscription
    const tier = await SubscriptionTier.findBySlug('tier1')
    if (tier) {
      await Subscription.create({
        subscriberType: 'team',
        subscriberId: team.id,
        tierId: tier.id,
        status: 'active',
        startsAt: DateTime.now(),
        expiresAt: DateTime.now().plus({ years: 1 }),
      })
    }

    console.log(`  Created team: ${team.name} with 2 members`)
  }

  private async seedCoupons(): Promise<void> {
    const coupons = [
      {
        code: 'WELCOME50',
        description: 'Welcome bonus - $50 credit',
        creditAmount: 5000,
        currency: 'usd',
        expiresAt: DateTime.now().plus({ months: 6 }),
        isActive: true,
      },
      {
        code: 'TESTCREDIT',
        description: 'Test coupon - $10 credit',
        creditAmount: 1000,
        currency: 'usd',
        expiresAt: DateTime.now().plus({ days: 30 }),
        isActive: true,
      },
      {
        code: 'EXPIRED',
        description: 'Expired coupon',
        creditAmount: 500,
        currency: 'usd',
        expiresAt: DateTime.now().minus({ days: 1 }),
        isActive: true,
      },
      {
        code: 'INACTIVE',
        description: 'Inactive coupon',
        creditAmount: 500,
        currency: 'usd',
        expiresAt: DateTime.now().plus({ months: 1 }),
        isActive: false,
      },
    ]

    for (const couponData of coupons) {
      const existing = await Coupon.findByCode(couponData.code)
      if (existing) {
        console.log(`  Coupon already exists: ${couponData.code}`)
        continue
      }
      await Coupon.create(couponData)
      console.log(`  Created coupon: ${couponData.code}`)
    }
  }

  private async seedDiscountCodes(): Promise<void> {
    const discountCodes = [
      {
        code: 'SAVE20',
        description: '20% off your purchase',
        discountType: 'percent' as const,
        discountValue: 20,
        maxUses: 100,
        maxUsesPerUser: 1,
        expiresAt: DateTime.now().plus({ months: 3 }),
        isActive: true,
      },
      {
        code: 'FLAT10',
        description: '$10 off',
        discountType: 'fixed' as const,
        discountValue: 1000,
        currency: 'usd',
        minAmount: 2000,
        maxUses: 50,
        maxUsesPerUser: 1,
        expiresAt: DateTime.now().plus({ months: 1 }),
        isActive: true,
      },
      {
        code: 'UNLIMITED',
        description: '10% off - unlimited uses',
        discountType: 'percent' as const,
        discountValue: 10,
        maxUses: null,
        maxUsesPerUser: null,
        expiresAt: null,
        isActive: true,
      },
    ]

    for (const codeData of discountCodes) {
      const existing = await DiscountCode.findByCode(codeData.code)
      if (existing) {
        console.log(`  Discount code already exists: ${codeData.code}`)
        continue
      }
      await DiscountCode.create(codeData)
      console.log(`  Created discount code: ${codeData.code}`)
    }
  }
}
